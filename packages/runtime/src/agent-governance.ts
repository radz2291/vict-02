import type { AgentActivationRecord, AgentCredentialPort } from './agent-types.js';
import { validateAgentActivationRecord } from './agent-types.js';
import { VictRuntimeError } from './errors.js';

/**
 * Stage 06A — agent data-protection governance (MSTR-011).
 *
 * This module is the neutral foundation for the local data-protection
 * baseline:
 *
 * - `AgentCredentialPort` — protected-only, just-in-time credential
 *   resolution. Values never enter profiles, snapshots, messages, memory,
 *   traces, streams, diagnostics, errors, exports, or databases. Provider
 *   failures are converted into stable, non-echoing diagnostics; a failed
 *   provider read never poisons later invocations; no process-wide cache
 *   silently preserves rotated values.
 * - `AgentGovernanceStore` — durable deletion intents, per-step receipts,
 *   and persisted activation identity records. In-memory and SQLite
 *   implementations share one conformance discipline (idempotent writes,
 *   receipt deduplication).
 * - `ConversationDeletionCoordinator` — governed conversation deletion
 *   across the VICT application-domain store and the agent-framework memory store.
 *   Cross-store atomicity is impossible and is NOT claimed: the
 *   coordinator records durable intent, makes each step idempotent,
 *   persists progress receipts, resumes safely after failure or process
 *   restart, never resurrects deleted data, and reports truthful
 *   partial/blocked status.
 * - `ConversationExportService` — explicit, request-scoped export of only
 *   the data the classification policy promises; credentials, registry
 *   data, and raw protected traces are structurally excluded, and the
 *   generated export is never retained or logged by this service.
 */

/** Stable sanitized credential-failure codes (never provider content). */
export type AgentCredentialErrorCode = 'VICT_AGENT_CREDENTIAL_UNAVAILABLE';

/** Error thrown for credential-resolution failures (stable, non-echoing). */
export class AgentCredentialError extends Error {
  readonly code: AgentCredentialErrorCode;
  readonly credentialName: string;

  constructor(credentialName: string) {
    super(`Credential '${credentialName}' could not be resolved through the protected provider.`);
    this.name = 'AgentCredentialError';
    this.code = 'VICT_AGENT_CREDENTIAL_UNAVAILABLE';
    this.credentialName = credentialName;
  }
}

/**
 * A credential name: the accepted credential-reference policy is the SAME
 * closed pattern the profile compiler enforces for
 * `providerCredentialVar` — an environment-variable-style NAME matching
 * `^[A-Za-z_][A-Za-z0-9_]*$` (at most 128 characters). Value-like inputs
 * (separators, `=`, whitespace, secret content) are rejected BEFORE they
 * reach any provider, and an invalid name is never echoed.
 */
const CREDENTIAL_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_CREDENTIAL_NAME_LENGTH = 128;

/** A credential name: validated against the accepted credential-reference policy. */
export function assertCredentialName(name: string): void {
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    name.length > MAX_CREDENTIAL_NAME_LENGTH ||
    !CREDENTIAL_NAME_PATTERN.test(name)
  ) {
    throw new AgentCredentialError('(invalid credential name)');
  }
}

/**
 * Wrap a credential provider with the protected-resolution discipline:
 * - names are validated before reaching the provider;
 * - provider exceptions are converted into stable sanitized failures whose
 *   messages never include provider content;
 * - values are never cached — every read passes through to the provider, so
 *   rotation is observed and a rejected read cannot poison later reads.
 */
export function protectCredentialPort(port: AgentCredentialPort): AgentCredentialPort {
  return {
    async get(name: string): Promise<string | undefined> {
      assertCredentialName(name);
      let value: string | undefined;
      try {
        value = await port.get(name);
      } catch {
        // The provider's message never propagates; the failure is not
        // recorded anywhere and cannot poison later invocations.
        throw new AgentCredentialError(name);
      }
      if (value === undefined) {
        return undefined;
      }
      if (typeof value !== 'string') {
        throw new AgentCredentialError(name);
      }
      return value;
    },
  };
}

/** Stable non-echoing failure for a missing required credential. */
export function requireCredential(value: string | undefined, name: string): string {
  assertCredentialName(name);
  if (value === undefined) {
    throw new AgentCredentialError(name);
  }
  return value;
}

/** The durable deletion step a receipt covers. */
export type AgentDeletionStep = 'application-domain' | 'mastra-memory';

/** Deletion-intent lifecycle states. */
export type AgentDeletionIntentState = 'pending' | 'application-domain-deleted' | 'completed';

/** One durable per-step receipt. */
export interface AgentDeletionStepReceipt {
  readonly step: AgentDeletionStep;
  /** Epoch-ms timestamp from the injected clock. */
  readonly at: number;
}

/** A durable deletion intent with its recorded progress. */
export interface AgentDeletionIntentRecord {
  readonly intentId: string;
  readonly conversationId: string;
  readonly actorId: string;
  readonly createdAt: number;
  readonly state: AgentDeletionIntentState;
  readonly receipts: readonly AgentDeletionStepReceipt[];
}

/** Durable agent-governance records: activation identity + deletion intents. */
export interface AgentGovernanceStore {
  /** Persist an activation identity record (idempotent by activationVersion; content collision fails). */
  saveAgentActivation(record: AgentActivationRecord): Promise<void>;
  /** Read one activation identity record. */
  getAgentActivation(activationVersion: string): Promise<AgentActivationRecord | undefined>;

  /** Record a deletion intent (idempotent by intentId; same content is a no-op, conflicting content fails). */
  recordDeletionIntent(record: AgentDeletionIntentRecord): Promise<void>;
  /** Read one deletion intent. */
  getDeletionIntent(intentId: string): Promise<AgentDeletionIntentRecord | undefined>;
  /** List intents that have not reached `completed`. */
  listOpenDeletionIntents(): Promise<readonly AgentDeletionIntentRecord[]>;
  /** Record one step receipt (idempotent per intentId + step: duplicates are no-ops). */
  recordDeletionReceipt(intentId: string, step: AgentDeletionStep, at: number): Promise<void>;
  /** Advance the intent state (forward-only; regressions fail). */
  updateDeletionIntentState(intentId: string, state: AgentDeletionIntentState): Promise<void>;
  /** List ALL deletion intents (open and completed), canonically ordered. */
  listDeletionIntents(): Promise<readonly AgentDeletionIntentRecord[]>;
  /** Close underlying resources, if any (sync or async, per implementation). */
  close?(): Promise<void> | void;
}

const INTENT_STATE_ORDER: ReadonlyArray<AgentDeletionIntentState> = [
  'pending',
  'application-domain-deleted',
  'completed',
];

/**
 * Shared invariant enforcement for in-memory and SQLite stores.
 *
 * Transitions are forward-only AND stepwise: a state may only move to the
 * IMMEDIATELY next state in the lifecycle. Skipped transitions (for example
 * `pending` directly to `completed`) are rejected — completion always
 * requires both durable step receipts, which a skipped transition would
 * fabricate. Same-state updates are idempotent no-ops.
 */
export function assertDeletionStateTransition(
  from: AgentDeletionIntentState,
  to: AgentDeletionIntentState,
): void {
  if (from === to) {
    return; // idempotent no-op
  }
  const fromIndex = INTENT_STATE_ORDER.indexOf(from);
  const toIndex = INTENT_STATE_ORDER.indexOf(to);
  if (toIndex < fromIndex) {
    throw new Error(
      `VICT_AGENT_DELETION_STATE_REGRESSION: refusing to move deletion intent from '${from}' back to '${to}'.`,
    );
  }
  if (toIndex !== fromIndex + 1) {
    throw new Error(
      `VICT_AGENT_DELETION_STATE_SKIP: refusing to move deletion intent from '${from}' directly to '${to}'; completion requires each step's durable receipt.`,
    );
  }
}

/**
 * Receipt-enforced transition validation (shared by in-memory and SQLite
 * stores): a state may only advance when the receipt of the step it
 * ENTERS is durably recorded.
 *
 * - entering `application-domain-deleted` requires the durable
 *   `application-domain` receipt;
 * - entering `completed` requires BOTH durable step receipts.
 *
 * The check reads the ACTUAL STORED receipts — the caller must pass the
 * receipts exactly as they exist in the same store, and each store must
 * perform the check and the state update ATOMICALLY (one synchronous
 * critical section in memory; one transaction in SQLite). A receipt-free
 * two-step bypass (`pending → application-domain-deleted → completed`)
 * therefore fails at the FIRST transition and leaves the stored state
 * unchanged.
 */
export function assertDeletionStateTransitionWithReceipts(
  from: AgentDeletionIntentState,
  to: AgentDeletionIntentState,
  receipts: ReadonlyArray<{ readonly step: AgentDeletionStep }>,
): void {
  assertDeletionStateTransition(from, to);
  if (from === to) {
    return; // idempotent no-op: no new state is entered
  }
  const has = (step: AgentDeletionStep): boolean =>
    receipts.some((receipt) => receipt.step === step);
  if (to === 'application-domain-deleted' && !has('application-domain')) {
    throw new Error(
      "VICT_AGENT_DELETION_RECEIPT_REQUIRED: entering 'application-domain-deleted' requires the durable 'application-domain' receipt; refusing to advance without it.",
    );
  }
  if (to === 'completed' && !(has('application-domain') && has('mastra-memory'))) {
    throw new Error(
      "VICT_AGENT_DELETION_RECEIPT_REQUIRED: entering 'completed' requires BOTH durable step receipts ('application-domain' and 'mastra-memory'); refusing to advance without them.",
    );
  }
}

/**
 * Validate a deletion-intent record at the durable boundary (shared by the
 * in-memory and SQLite stores). A NEW intent must start as `pending` with
 * NO receipts — arbitrary initial states and fabricated receipts are
 * rejected.
 */
export function assertDeletionIntentRecord(record: AgentDeletionIntentRecord): void {
  if (typeof record.intentId !== 'string' || record.intentId.length === 0) {
    throw new VictRuntimeError(
      'VICT_AGENT_DELETION_INTENT_INVALID',
      'A deletion intent requires a non-empty intentId.',
    );
  }
  if (typeof record.conversationId !== 'string' || record.conversationId.length === 0) {
    throw new VictRuntimeError(
      'VICT_AGENT_DELETION_INTENT_INVALID',
      'A deletion intent requires a non-empty conversationId.',
    );
  }
  if (typeof record.actorId !== 'string' || record.actorId.length === 0) {
    throw new VictRuntimeError(
      'VICT_AGENT_DELETION_INTENT_INVALID',
      'A deletion intent requires a non-empty actorId.',
    );
  }
  if (
    typeof record.createdAt !== 'number' ||
    !Number.isFinite(record.createdAt) ||
    record.createdAt < 0
  ) {
    throw new VictRuntimeError(
      'VICT_AGENT_DELETION_INTENT_INVALID',
      'A deletion intent requires a finite createdAt epoch-ms value.',
    );
  }
  if (record.state !== 'pending') {
    throw new VictRuntimeError(
      'VICT_AGENT_DELETION_INTENT_INVALID',
      `A deletion intent must be recorded in the 'pending' state; arbitrary initial states are rejected.`,
    );
  }
  if (!Array.isArray(record.receipts) || record.receipts.length > 0) {
    throw new VictRuntimeError(
      'VICT_AGENT_DELETION_INTENT_INVALID',
      'A new deletion intent must carry no receipts; fabricated receipts are rejected.',
    );
  }
}

/** In-memory AgentGovernanceStore (tests and non-durable compositions). */
export class InMemoryAgentGovernanceStore implements AgentGovernanceStore {
  readonly #activations = new Map<string, AgentActivationRecord>();
  readonly #intents = new Map<string, AgentDeletionIntentRecord>();

  async saveAgentActivation(record: AgentActivationRecord): Promise<void> {
    const validation = validateAgentActivationRecord(record);
    if (!validation.ok) {
      throw new VictRuntimeError(
        'VICT_AGENT_ACTIVATION_RECORD_INVALID',
        `The activation record is malformed and was not persisted: ${validation.reason}`,
      );
    }
    const existing = this.#activations.get(record.activationVersion);
    if (existing !== undefined) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new Error(
          'VICT_AGENT_ACTIVATION_COLLISION: an activation record exists with different content.',
        );
      }
      return;
    }
    this.#activations.set(record.activationVersion, structuredCloneAgent(record));
  }

  async getAgentActivation(activationVersion: string): Promise<AgentActivationRecord | undefined> {
    const record = this.#activations.get(activationVersion);
    return record === undefined ? undefined : structuredCloneAgent(record);
  }

  async recordDeletionIntent(record: AgentDeletionIntentRecord): Promise<void> {
    assertDeletionIntentRecord(record);
    const existing = this.#intents.get(record.intentId);
    if (existing !== undefined) {
      if (
        existing.conversationId !== record.conversationId ||
        existing.actorId !== record.actorId ||
        existing.createdAt !== record.createdAt
      ) {
        throw new Error(
          'VICT_AGENT_DELETION_INTENT_COLLISION: an intent exists with different content.',
        );
      }
      return;
    }
    this.#intents.set(record.intentId, structuredCloneAgent(record));
  }

  async getDeletionIntent(intentId: string): Promise<AgentDeletionIntentRecord | undefined> {
    const record = this.#intents.get(intentId);
    return record === undefined ? undefined : structuredCloneAgent(record);
  }

  async listOpenDeletionIntents(): Promise<readonly AgentDeletionIntentRecord[]> {
    return [...this.#intents.values()]
      .filter((record) => record.state !== 'completed')
      .sort((a, b) => (a.intentId < b.intentId ? -1 : 1))
      .map((record) => structuredCloneAgent(record));
  }

  async listDeletionIntents(): Promise<readonly AgentDeletionIntentRecord[]> {
    return [...this.#intents.values()]
      .sort((a, b) => (a.intentId < b.intentId ? -1 : 1))
      .map((record) => structuredCloneAgent(record));
  }

  async recordDeletionReceipt(
    intentId: string,
    step: AgentDeletionStep,
    at: number,
  ): Promise<void> {
    const record = this.#intents.get(intentId);
    if (record === undefined) {
      throw new Error('VICT_AGENT_DELETION_INTENT_MISSING');
    }
    if (record.receipts.some((receipt) => receipt.step === step)) {
      return; // idempotent: no duplicate receipt
    }
    // Receipt order mirrors the governed execution order: the memory step
    // receipt can only exist after the application-domain receipt. An
    // out-of-order receipt would fabricate durable progress and is
    // rejected.
    if (
      step === 'mastra-memory' &&
      !record.receipts.some((receipt) => receipt.step === 'application-domain')
    ) {
      throw new Error(
        'VICT_AGENT_DELETION_RECEIPT_ORDER: the memory step receipt requires the application-domain receipt to exist first.',
      );
    }
    const updated: AgentDeletionIntentRecord = {
      ...record,
      receipts: [...record.receipts, { step, at }].sort((a, b) => (a.step < b.step ? -1 : 1)),
    };
    this.#intents.set(intentId, updated);
  }

  async updateDeletionIntentState(
    intentId: string,
    state: AgentDeletionIntentState,
  ): Promise<void> {
    // Atomic check-and-update: the transition is validated against the
    // ACTUAL stored receipts inside the same synchronous critical section
    // that performs the update, so no interleaving write can slip between
    // the check and the update.
    const record = this.#intents.get(intentId);
    if (record === undefined) {
      throw new Error('VICT_AGENT_DELETION_INTENT_MISSING');
    }
    assertDeletionStateTransitionWithReceipts(record.state, state, record.receipts);
    this.#intents.set(intentId, { ...record, state });
  }
}

function structuredCloneAgent<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The application-domain side of governed conversation deletion. */
export interface AgentConversationDomainPort {
  /**
   * Delete the VICT application-domain conversation resource. Returns
   * `{ deleted: true }` when a record was deleted and
   * `{ deleted: false }` when it was already absent (idempotent).
   */
  deleteConversation(conversationId: string): Promise<{ readonly deleted: boolean }>;
}

/** The the agent framework-memory side of governed conversation deletion (adapter-owned). */
export interface AgentMemoryDeletionPort {
  /**
   * Delete the the agent framework thread (and its messages/memory state) bound to the
   * VICT conversation. Idempotent: returns `{ deleted: false }` when the
   * thread was already absent.
   */
  deleteConversationThread(conversationId: string): Promise<{ readonly deleted: boolean }>;
}

/** Result of one governed deletion attempt. */
export interface AgentDeletionOutcome {
  /** `completed` when every governed step has a durable receipt. */
  readonly status: 'completed' | 'pending';
  readonly intentId: string;
  readonly conversationId: string;
  /** Steps with durable receipts after this attempt, in policy order. */
  readonly completedSteps: readonly AgentDeletionStep[];
}

/** Options for the ConversationDeletionCoordinator. */
export interface ConversationDeletionCoordinatorOptions {
  readonly governance: AgentGovernanceStore;
  readonly domain: AgentConversationDomainPort;
  readonly memory: AgentMemoryDeletionPort;
  /** Injected clock (epoch ms). */
  readonly clock?: () => number;
}

/**
 * Governed conversation deletion across stores (amendment §8.1, MSTR-011).
 *
 * Cross-store atomicity is impossible and is never claimed. The
 * coordinator:
 * 1. records the durable deletion intent BEFORE touching either store;
 * 2. deletes the VICT application-domain resource through its governed
 *    port and records a durable receipt;
 * 3. deletes the the agent framework thread through the adapter port and records a
 *    durable receipt;
 * 4. advances the intent to `completed` only when both receipts exist.
 *
 * Every step is idempotent; receipts deduplicate; `recoverPending()`
 * resumes safely after a crash at ANY boundary without duplicating
 * receipts, losing completions, or resurrecting deleted data.
 */
export class ConversationDeletionCoordinator {
  readonly #governance: AgentGovernanceStore;
  readonly #domain: AgentConversationDomainPort;
  readonly #memory: AgentMemoryDeletionPort;
  readonly #clock: () => number;

  constructor(options: ConversationDeletionCoordinatorOptions) {
    this.#governance = options.governance;
    this.#domain = options.domain;
    this.#memory = options.memory;
    this.#clock = options.clock ?? (() => Date.now());
  }

  /** Deterministic intent id per conversation (idempotent re-deletes). */
  intentIdFor(conversationId: string): string {
    return `vict-del-${conversationId}`;
  }

  async deleteConversation(options: {
    readonly conversationId: string;
    readonly actorId: string;
  }): Promise<AgentDeletionOutcome> {
    const intentId = this.intentIdFor(options.conversationId);
    const existing = await this.#governance.getDeletionIntent(intentId);
    if (existing === undefined) {
      await this.#governance.recordDeletionIntent({
        intentId,
        conversationId: options.conversationId,
        actorId: options.actorId,
        createdAt: this.#clock(),
        state: 'pending',
        receipts: [],
      });
    } else if (existing.actorId !== options.actorId) {
      throw new Error(
        'VICT_AGENT_DELETION_ACTOR_MISMATCH: the intent exists under a different actor.',
      );
    }
    return this.#runSteps(intentId);
  }

  /**
   * Resume every open intent (crash recovery, process restart). Each open
   * intent continues from its recorded receipts; completed steps are never
   * re-executed against the stores... the underlying ports are idempotent
   * besides, but receipts are authoritative: a recorded receipt means the
   * step is durable and is NOT re-driven.
   */
  async recoverPending(): Promise<{
    readonly resumed: number;
    readonly completed: number;
    readonly pending: number;
  }> {
    const open = await this.#governance.listOpenDeletionIntents();
    let completed = 0;
    let pending = 0;
    for (const intent of open) {
      const outcome = await this.#runSteps(intent.intentId);
      if (outcome.status === 'completed') {
        completed += 1;
      } else {
        pending += 1;
      }
    }
    return { resumed: open.length, completed, pending };
  }

  async #runSteps(intentId: string): Promise<AgentDeletionOutcome> {
    const intent = await this.#governance.getDeletionIntent(intentId);
    if (intent === undefined) {
      throw new Error('VICT_AGENT_DELETION_INTENT_MISSING');
    }
    if (intent.state !== 'completed') {
      if (!intent.receipts.some((receipt) => receipt.step === 'application-domain')) {
        const result = await this.#domain.deleteConversation(intent.conversationId);
        if (typeof result?.deleted !== 'boolean') {
          throw new Error('VICT_AGENT_DELETION_DOMAIN_INVALID_RESULT');
        }
        await this.#governance.recordDeletionReceipt(intentId, 'application-domain', this.#clock());
      }
      // Advance stepwise (a crash may have left the durable state one step
      // behind its receipts; same-state updates are idempotent no-ops).
      const afterDomain = await this.#governance.getDeletionIntent(intentId);
      if (afterDomain !== undefined && afterDomain.state === 'pending') {
        await this.#governance.updateDeletionIntentState(intentId, 'application-domain-deleted');
      }
      const current = await this.#governance.getDeletionIntent(intentId);
      if (current === undefined) {
        throw new Error('VICT_AGENT_DELETION_INTENT_MISSING');
      }
      if (!current.receipts.some((receipt) => receipt.step === 'mastra-memory')) {
        const result = await this.#memory.deleteConversationThread(intent.conversationId);
        if (typeof result?.deleted !== 'boolean') {
          throw new Error('VICT_AGENT_DELETION_MEMORY_INVALID_RESULT');
        }
        await this.#governance.recordDeletionReceipt(intentId, 'mastra-memory', this.#clock());
      }
      const after = await this.#governance.getDeletionIntent(intentId);
      if (
        after !== undefined &&
        after.receipts.some((receipt) => receipt.step === 'application-domain') &&
        after.receipts.some((receipt) => receipt.step === 'mastra-memory') &&
        after.state !== 'completed'
      ) {
        // Completion always passes through the intermediate state — the
        // stepwise invariant forbids skipping it.
        await this.#governance.updateDeletionIntentState(intentId, 'application-domain-deleted');
        await this.#governance.updateDeletionIntentState(intentId, 'completed');
      }
    }
    const final = await this.#governance.getDeletionIntent(intentId);
    if (final === undefined) {
      throw new Error('VICT_AGENT_DELETION_INTENT_MISSING');
    }
    return {
      status: final.state === 'completed' ? 'completed' : 'pending',
      intentId,
      conversationId: final.conversationId,
      completedSteps: final.receipts.map((receipt) => receipt.step),
    };
  }
}

/** One exported conversation message (classification-policy fields only). */
export interface AgentConversationExportMessage {
  readonly seq: number;
  readonly role: 'user' | 'assistant' | 'system';
  /** Epoch-ms creation time from the owning store. */
  readonly createdAt: number;
  /** Message text content (intentionally retained conversation content). */
  readonly text: string;
}

/**
 * The export payload: only what the classification policy promises. No
 * credentials, no registry data, no raw traces, no operational history.
 */
export interface AgentConversationExport {
  readonly conversationId: string;
  readonly actorId: string;
  readonly threadCreatedAt: number | null;
  readonly messages: readonly AgentConversationExportMessage[];
}

/** The the agent framework-side export port (adapter-owned). */
export interface AgentConversationMemoryExportPort {
  exportConversationThread(conversationId: string): Promise<AgentConversationExport | undefined>;
}

/** Result of an export request. */
export interface AgentConversationExportResult {
  /** Deterministic structured export (ordering is meaningful). */
  readonly export: AgentConversationExport;
  /** The export is returned to the requestor and NOT retained anywhere. */
  readonly retained: false;
}

/** Stable denial codes for exports. */
export type AgentConversationExportErrorCode =
  'VICT_AGENT_EXPORT_NOT_FOUND' | 'VICT_AGENT_EXPORT_ACTOR_MISMATCH';

/** Error carrying a stable export denial (never raw content). */
export class AgentConversationExportError extends Error {
  readonly code: AgentConversationExportErrorCode;

  constructor(code: AgentConversationExportErrorCode) {
    super(code);
    this.name = 'AgentConversationExportError';
    this.code = code;
  }
}

/**
 * Governed conversation export (MSTR-011). Explicit and request-scoped:
 * the requestor must present the owning actor identity; the export
 * contains only classification-policy data; the result is handed to the
 * caller and never logged or retained by the service.
 */
export class ConversationExportService {
  readonly #memory: AgentConversationMemoryExportPort;

  constructor(options: { readonly memory: AgentConversationMemoryExportPort }) {
    this.#memory = options.memory;
  }

  async export(options: {
    readonly conversationId: string;
    readonly actorId: string;
  }): Promise<AgentConversationExportResult> {
    const found = await this.#memory.exportConversationThread(options.conversationId);
    if (found === undefined) {
      throw new AgentConversationExportError('VICT_AGENT_EXPORT_NOT_FOUND');
    }
    if (found.actorId !== options.actorId) {
      throw new AgentConversationExportError('VICT_AGENT_EXPORT_ACTOR_MISMATCH');
    }
    // Deterministic ordering by sequence; exportedAt comes from the
    // injected clock. The service retains nothing and logs nothing.
    const sorted = [...found.messages].sort((a, b) => a.seq - b.seq);
    return {
      export: {
        conversationId: found.conversationId,
        actorId: found.actorId,
        threadCreatedAt: found.threadCreatedAt,
        messages: sorted,
      },
      retained: false,
    };
  }
}
