import { createHash } from 'node:crypto';
import type { AgentControlStores, ControlAuditEvent } from '@vict/runtime';
import {
  COMMAND_IDEMPOTENCY_KEY_PATTERN,
  toCanonicalJson,
  VictControlError,
  type CommandIdempotencyReceipt,
} from '@vict/runtime';
import type { ServerActorContext } from './auth.js';

/**
 * Stage 06B — the transport-free, versioned command service (API-002).
 *
 * The HTTP transport and the CLI consume the SAME typed dispatcher; no
 * caller bypasses governance. Properties enforced HERE (below the
 * transport, fail closed):
 *
 * - ONE command registry: authorization scope, closed payload field set,
 *   and the mutation/idempotency policy are declared TOGETHER per command,
 *   so the command list, the scope matrix, and the mutation list cannot
 *   silently diverge;
 * - AUTHORIZATION MATRIX: every command's required scope is asserted from
 *   the closed scope vocabulary BEFORE any store access;
 * - CLOSED PAYLOAD SCHEMAS: unknown fields and non-object payloads are
 *   rejected (never silently converted to `{}`); payloads are canonicalized
 *   ONCE into plain data (own enumerable properties only — accessors,
 *   proxies that throw, and enumeration traps fail with a stable,
 *   non-echoing error) and that SAME canonical form is used for the
 *   request digest and for execution;
 * - DURABLE COMMAND IDEMPOTENCY: every state-changing command requires a
 *   bounded `Idempotency-Key`; receipts are NAMESPACED by (authenticated
 *   actor, command, key) and bind the canonical request digest. A pending
 *   receipt carries a durable LEASE (owner + expiry): concurrent
 *   duplicates answer `IN_PROGRESS`, a crashed claim's expired lease is
 *   taken over on retry (fenced re-execution through the domain's own
 *   idempotency), deterministic failures settle `failed` and replay, and
 *   retryable infrastructure failures RELEASE the claim instead of being
 *   permanently confused with command failure;
 * - SAFE RECEIPT RETENTION: receipts store a per-command SAFE replay
 *   projection (stable codes, identifiers, content references) — never the
 *   full command response, rationale, application rows, model content, or
 *   tool data. An authorized replay result is reconstructed from its
 *   authoritative domain when necessary;
 * - stable, structured, non-echoing errors.
 */

/** The versioned command envelope marker. */
export const VICT_COMMAND_SCHEMA = 'vict.command@1';

/** Closed command names (version 1). */
export const VICT_COMMANDS = [
  'health.inspect',
  'compatibility.inspect',
  'actor.whoami',
  'changeset.propose',
  'changeset.revise',
  'changeset.execute-check',
  'changeset.attach-evidence',
  'changeset.decide',
  'changeset.commit',
  'changeset.get',
  'changeset.list',
  'release.publish',
  'release.select',
  'release.rollback',
  'release.get-selected',
  'activation.select',
  'run.cancel',
  'agent.turn.start',
  'agent.turn.cancel',
  'agent.turn.get',
  'agent.tool.approve',
  'agent.tool.decline',
  'stream.inspect',
  'app.data.query',
  'app.data.mutate',
  'app.data.action',
] as const;
export type VictCommandName = (typeof VICT_COMMANDS)[number];

/**
 * The ONE command registry: every command declares its required scope
 * (closed vocabulary; `*` = authenticated any), its exact payload field
 * set, and whether it MUTATES durable state (creates runs, audits,
 * receipts, approvals, effects, or mutations) and is therefore governed by
 * durable idempotency. Default policy remains denial: a command absent
 * from this table does not exist.
 */
interface CommandSpec {
  readonly scope: string;
  readonly fields: readonly string[];
  readonly mutation: boolean;
}

const COMMAND_REGISTRY: Readonly<Record<VictCommandName, CommandSpec>> = {
  'health.inspect': { scope: '*', fields: [], mutation: false },
  'compatibility.inspect': { scope: '*', fields: [], mutation: false },
  'actor.whoami': { scope: '*', fields: [], mutation: false },
  'changeset.propose': {
    scope: 'changeset.propose',
    fields: [
      'changesetId',
      'base',
      'operations',
      'rationale',
      'riskClass',
      'requiredApproverCount',
      'expiresAt',
    ],
    mutation: true,
  },
  'changeset.revise': {
    scope: 'changeset.revise',
    fields: [
      'changesetId',
      'operations',
      'rationale',
      'riskClass',
      'requiredApproverCount',
      'expiresAt',
    ],
    mutation: true,
  },
  // Creates a durable control run: mutation-governed.
  'changeset.execute-check': {
    scope: 'changeset.propose',
    fields: ['changesetId', 'kind'],
    mutation: true,
  },
  'changeset.attach-evidence': {
    scope: 'changeset.propose',
    fields: ['changesetId', 'kind', 'runId'],
    mutation: true,
  },
  'changeset.decide': {
    scope: 'changeset.approve',
    fields: ['changesetId', 'decision', 'reason'],
    mutation: true,
  },
  'changeset.commit': { scope: 'changeset.commit', fields: ['changesetId'], mutation: true },
  'changeset.get': { scope: 'changeset.read', fields: ['changesetId'], mutation: false },
  'changeset.list': { scope: 'changeset.read', fields: [], mutation: false },
  'release.publish': {
    scope: 'release.publish',
    fields: [
      'releaseVersion',
      'applicationId',
      'applicationVersion',
      'rendererIdentity',
      'componentRegistryIdentity',
      'dataAdapterIdentity',
      'activationBinding',
    ],
    mutation: true,
  },
  'release.select': {
    scope: 'release.select',
    fields: ['applicationId', 'releaseVersion'],
    mutation: true,
  },
  'release.rollback': {
    scope: 'release.select',
    fields: ['applicationId', 'targetReleaseVersion'],
    mutation: true,
  },
  'release.get-selected': { scope: 'release.read', fields: ['applicationId'], mutation: false },
  'activation.select': {
    scope: 'activation.select',
    fields: ['graphId', 'activationVersion'],
    mutation: true,
  },
  'run.cancel': { scope: 'run.cancel', fields: ['runId', 'reasonCode'], mutation: true },
  'agent.turn.start': {
    scope: 'agent.turn.start',
    fields: ['threadId', 'input', 'applicationReleaseVersion'],
    mutation: true,
  },
  'agent.turn.cancel': {
    scope: 'agent.turn.cancel',
    fields: ['turnId', 'reasonCode'],
    mutation: true,
  },
  'agent.turn.get': { scope: 'run.read', fields: ['turnId'], mutation: false },
  'agent.tool.approve': {
    scope: 'agent.tool.approve',
    fields: ['approvalId', 'reason', 'decision'],
    mutation: true,
  },
  'agent.tool.decline': {
    scope: 'agent.tool.decline',
    fields: ['approvalId', 'reason', 'decision'],
    mutation: true,
  },
  'stream.inspect': { scope: 'agent.stream.read', fields: ['streamId'], mutation: false },
  'app.data.query': {
    scope: 'app.data.read',
    fields: ['resourceId', 'releaseVersion', 'filters'],
    mutation: false,
  },
  'app.data.mutate': {
    scope: 'app.data.write',
    fields: ['resourceId', 'releaseVersion', 'expectedRevision', 'actionKind'],
    mutation: true,
  },
  'app.data.action': {
    scope: 'app.data.write',
    fields: ['resourceId', 'releaseVersion', 'expectedRevision', 'actionKind'],
    mutation: true,
  },
};

/**
 * True when the command mutates durable state (idempotency-governed).
 * Derived from the ONE registry — the mutation policy can never silently
 * diverge from the command list.
 */
export function isMutationCommand(command: string): boolean {
  const spec = (COMMAND_REGISTRY as Record<string, CommandSpec | undefined>)[command];
  return spec?.mutation === true;
}

/** A closed, versioned command request. */
export interface VictCommandRequest {
  readonly command: VictCommandName;
  /** Bounded, command-specific payload (validated per command below). */
  readonly payload: Record<string, unknown>;
  /**
   * Durable mutation idempotency key (REQUIRED for state-changing
   * commands; validated against the closed bounded format).
   */
  readonly idempotencyKey?: string;
}

/** A safe command result. */
export interface VictCommandResult {
  readonly ok: true;
  readonly data: Record<string, unknown>;
}

/** A structured command error (safe, non-echoing). */
export interface VictCommandError {
  readonly ok: false;
  readonly code: string;
}

export type VictCommandOutcome = VictCommandResult | VictCommandError;

export interface VictCommandServiceOptions {
  readonly stores: AgentControlStores;
  /** The composed control-plane service (ChangeSets/releases/audit). */
  readonly controlPlane: ControlPlanePort;
  /** The composed agent-turn service (optional in governance-only deployments). */
  readonly turnService?: TurnServiceLike;
  readonly clock?: () => number;
  /** The remote Application data/action boundary. */
  readonly appData?: AppDataPort;
  /**
   * Durable lease duration for pending idempotency claims (default
   * 60_000 ms). A crashed claimer's lease expires and the key becomes
   * recoverable.
   */
  readonly idempotencyLeaseMs?: number;
  /** The lease owner token (defaults to a per-service instance token). */
  readonly idempotencyOwner?: string;
}

/** The subset of AgentTurnService the dispatcher uses. */
export interface TurnServicePort {
  startTurn(
    actor: ServerActorContext,
    input: { threadId: string; input: string },
  ): Promise<unknown>;
  cancelTurn(
    actor: ServerActorContext,
    input: { turnId: string; reasonCode?: string },
  ): Promise<unknown>;
  getTurn(actor: ServerActorContext, turnId: string): Promise<unknown>;
  decideToolApproval(
    actor: ServerActorContext,
    input: { approvalId: string; decision: 'approved' | 'declined'; reason?: string },
  ): Promise<unknown>;
  reconcileAfterRestart(): Promise<{ cancelled: number; failed: number; pendingApprovals: number }>;
}

type TurnServiceLike = TurnServicePort;

/**
 * The remote Application data/action port (Stage 05 adapter semantics
 * preserved: typed resource queries and mutations across the SAME server
 * authorization boundary). Implemented in `app-remote.ts`.
 */
export interface AppDataPort {
  query(actor: ServerActorContext, input: Record<string, unknown>): Promise<unknown>;
  mutate(actor: ServerActorContext, input: Record<string, unknown>): Promise<unknown>;
}

/** Bounded field validation helpers (closed schemas; fail closed). */
function boundedId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      `${field} must be a bounded identifier.`,
    );
  }
  return value;
}

function boundedString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.length > max) {
    throw new VictControlError('VICT_COMMAND_FIELD_INVALID', `${field} must be a bounded string.`);
  }
  return value;
}

/** Canonical digest over the EXACT canonical request payload. */
function requestDigest(canonicalPayload: Record<string, unknown>): string {
  return createHash('sha256')
    .update(`vict.command@1\u0000${toCanonicalJson(canonicalPayload)}`, 'utf8')
    .digest('hex');
}

/**
 * Canonicalize one command payload into PLAIN data, exactly once, before
 * any digest or execution:
 *
 * - only OWN ENUMERABLE properties cross the boundary (inherited fields
 *   and non-enumerable state are dropped);
 * - accessor properties (getters/setters) are REJECTED — reading them
 *   would invoke hostile code and could leak or mutate;
 * - property enumeration or reads that THROW (proxies, traps) fail with a
 *   stable non-echoing error instead of a raw exception;
 * - nested values must be plain objects, arrays, or JSON scalars.
 */
function canonicalPlainPayload(raw: unknown, depth = 0): Record<string, unknown> {
  if (depth > 8) {
    throw new VictControlError(
      'VICT_COMMAND_PAYLOAD_INVALID',
      'The command payload nests too deeply.',
    );
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new VictControlError(
      'VICT_COMMAND_PAYLOAD_INVALID',
      'The command payload must be a plain object; non-object payloads are never silently converted.',
    );
  }
  let keys: string[];
  try {
    keys = Object.keys(raw);
  } catch {
    throw new VictControlError(
      'VICT_COMMAND_PAYLOAD_INVALID',
      'The command payload could not be enumerated; hostile containers are rejected.',
    );
  }
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    let descriptor: PropertyDescriptor | undefined;
    let value: unknown;
    try {
      descriptor = Object.getOwnPropertyDescriptor(raw, key);
      if (descriptor === undefined) {
        throw new Error('own descriptor missing');
      }
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        throw new Error('accessor property');
      }
      value = descriptor.value;
    } catch {
      throw new VictControlError(
        'VICT_COMMAND_PAYLOAD_INVALID',
        'The command payload declares an accessor or unreadable property; hostile containers are rejected.',
      );
    }
    result[key] = canonicalPlainValue(value, depth);
  }
  return result;
}

function canonicalPlainValue(value: unknown, depth: number): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new VictControlError(
        'VICT_COMMAND_PAYLOAD_INVALID',
        'The command payload contains a non-finite number.',
      );
    }
    return value;
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      let item: unknown;
      try {
        item = (value as unknown[])[index];
      } catch {
        throw new VictControlError(
          'VICT_COMMAND_PAYLOAD_INVALID',
          'The command payload contains an unreadable array entry.',
        );
      }
      out.push(canonicalPlainValue(item, depth + 1));
    }
    return out;
  }
  return canonicalPlainPayload(value, depth + 1);
}

/** Deterministic owner token for this service instance (lease holder). */
let serviceInstanceCounter = 0;

/**
 * The versioned command dispatcher: transport-free and shared by HTTP and
 * the CLI. Every command re-derives its authorization from the
 * authenticated server context (never from the payload) and mutates only
 * through the durable idempotency policy.
 */
export class VictCommandService {
  readonly #options: VictCommandServiceOptions;
  readonly #owner: string;
  readonly #leaseMs: number;

  constructor(options: VictCommandServiceOptions) {
    this.#options = options;
    this.#leaseMs = options.idempotencyLeaseMs ?? 60_000;
    serviceInstanceCounter += 1;
    this.#owner = options.idempotencyOwner ?? `svc-${process.pid}-${serviceInstanceCounter}`;
  }

  /** Dispatch one command (closed schemas; durable idempotency; safe errors). */
  async dispatch(
    actor: ServerActorContext,
    request: VictCommandRequest,
  ): Promise<VictCommandOutcome> {
    const command = request.command;
    if (!(VICT_COMMANDS as readonly string[]).includes(command)) {
      return { ok: false, code: 'VICT_COMMAND_UNKNOWN' };
    }
    // ---- Canonical plain payload (ONE form for digest AND execution) ----
    // Hostile direct callers (getters, proxies, enumeration traps) fail
    // with the stable structured error, never a raw exception.
    let payload: Record<string, unknown>;
    try {
      payload = canonicalPlainPayload(request.payload);
    } catch (error) {
      if (error instanceof VictControlError) {
        throw error;
      }
      throw new VictControlError(
        'VICT_COMMAND_PAYLOAD_INVALID',
        'The command payload could not be canonicalized; hostile containers are rejected.',
      );
    }
    // ---- Closed payload schema (fail closed on unknown fields) ----------
    this.#assertPayloadFields(command, payload);
    // ---- Authorization matrix (BELOW the transport; default deny) -------
    const spec = COMMAND_REGISTRY[command];
    if (spec.scope !== '*') {
      assertCommandScope(actor, spec.scope);
    }
    // ---- Durable idempotency policy for state-changing commands ---------
    if (spec.mutation) {
      return this.#dispatchIdempotent(actor, command, payload, request.idempotencyKey);
    }
    return this.#execute(actor, command, payload, request.idempotencyKey);
  }

  /** Validate the payload against the command's closed field set. */
  #assertPayloadFields(command: VictCommandName, payload: Record<string, unknown>): void {
    const allowed = COMMAND_REGISTRY[command].fields;
    for (const key of Object.keys(payload)) {
      if (!allowed.includes(key)) {
        throw new VictControlError(
          'VICT_COMMAND_PAYLOAD_INVALID',
          `The command payload declares an unknown field for '${command}'.`,
        );
      }
    }
  }

  /**
   * The durable idempotency boundary for one state-changing command:
   * namespaced claim (actor + command + key) with a durable lease →
   * execute → settle. Deterministic failures settle `failed` (replayed);
   * retryable infrastructure failures RELEASE the claim. A crashed
   * claimer's expired lease is taken over on retry; the re-execution is
   * FENCED by the domain's own idempotency (turn intents, commit saga
   * receipts, selection operation identities, content-identity guards).
   */
  async #dispatchIdempotent(
    actor: ServerActorContext,
    command: VictCommandName,
    payload: Record<string, unknown>,
    idempotencyKey: unknown,
  ): Promise<VictCommandOutcome> {
    if (
      typeof idempotencyKey !== 'string' ||
      !COMMAND_IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
    ) {
      throw new VictControlError(
        'VICT_COMMAND_IDEMPOTENCY_KEY_INVALID',
        'A state-changing command requires a bounded Idempotency-Key (letters, digits, ".", "_", ":", "-"; at most 128 characters).',
      );
    }
    const digest = requestDigest(payload);
    const store = this.#options.stores.commandIdempotency;
    const now = this.#options.clock ?? (() => Date.now());
    const namespace = { actorId: actor.actorId, command, idempotencyKey };
    const existing = await store.getReceipt(namespace);
    if (existing !== undefined) {
      // The receipt binds actor + command kind + request digest.
      if (
        existing.actorId !== actor.actorId ||
        existing.command !== command ||
        existing.requestDigest !== digest
      ) {
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
      }
      if (existing.status === 'pending') {
        // Crash recovery: an EXPIRED lease may be taken over; a live lease
        // answers the stable in-progress conflict.
        const takeover = await store.takeOverExpiredLease({
          actorId: actor.actorId,
          command,
          idempotencyKey,
          owner: this.#owner,
          leaseUntil: now() + this.#leaseMs,
          at: now(),
        });
        if (takeover === 'not-expired') {
          return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' };
        }
        // `taken`: fall through to fenced re-execution as the new owner.
      } else if (existing.status === 'failed') {
        return { ok: false, code: existing.responseCode ?? 'VICT_COMMAND_FAILED' };
      } else {
        return this.#replayResult(actor, command, existing);
      }
    } else {
      // Cross-command key reuse: the same actor reusing ONE Idempotency-Key
      // for a DIFFERENT command is a client bug and a stable conflict — the
      // key is not silently re-namespaced into a second logical request.
      const reused = await store.findReceiptByActorKey({ actorId: actor.actorId, idempotencyKey });
      if (reused !== undefined && reused.command !== command) {
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
      }
      const claim = await store.claimReceipt({
        idempotencyKey,
        actorId: actor.actorId,
        command,
        requestDigest: digest,
        status: 'pending',
        responseCode: undefined,
        resultJson: undefined,
        createdAt: now(),
        settledAt: undefined,
        owner: this.#owner,
        leaseUntil: now() + this.#leaseMs,
        attempts: 1,
      });
      if (claim === 'exists') {
        // Lost the concurrent race: re-read for the truthful disposition.
        const raced = await store.getReceipt(namespace);
        if (
          raced !== undefined &&
          (raced.actorId !== actor.actorId ||
            raced.command !== command ||
            raced.requestDigest !== digest)
        ) {
          return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
        }
        if (raced !== undefined && raced.status === 'completed') {
          return this.#replayResult(actor, command, raced);
        }
        if (raced !== undefined && raced.status === 'failed') {
          return { ok: false, code: raced.responseCode ?? 'VICT_COMMAND_FAILED' };
        }
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' };
      }
    }
    try {
      const outcome = await this.#execute(actor, command, payload, idempotencyKey);
      if (outcome.ok) {
        await store.completeReceipt({
          actorId: actor.actorId,
          command,
          idempotencyKey,
          resultJson: JSON.stringify(safeResultProjection(command, outcome.data)),
          at: now(),
        });
      } else {
        await store.failReceipt({
          actorId: actor.actorId,
          command,
          idempotencyKey,
          responseCode: outcome.code,
          at: now(),
        });
      }
      return outcome;
    } catch (error) {
      if (error instanceof VictControlError) {
        // Deterministic command failure: durable, stable, replayed.
        await store
          .failReceipt({
            actorId: actor.actorId,
            command,
            idempotencyKey,
            responseCode: error.code,
            at: now(),
          })
          .catch(() => undefined);
        throw error;
      }
      // RETRYABLE infrastructure failure: release the claim so a retry can
      // re-execute truthfully — never permanently confused with a
      // deterministic command failure.
      await store
        .releaseReceipt({ actorId: actor.actorId, command, idempotencyKey, at: now() })
        .catch(() => undefined);
      throw error;
    }
  }

  /**
   * Reconstruct an authorized replay result from its authoritative domain
   * where possible, using the SAFE projection stored in the receipt. The
   * projection itself never carries payloads; a replayed result that
   * requires the full record is re-derived under the CURRENT actor's
   * authorization (actor-scoped reads — never a data leak).
   */
  async #replayResult(
    actor: ServerActorContext,
    command: VictCommandName,
    receipt: CommandIdempotencyReceipt,
  ): Promise<VictCommandOutcome> {
    let projection: Record<string, unknown>;
    try {
      projection =
        receipt.resultJson === undefined
          ? {}
          : (JSON.parse(receipt.resultJson) as Record<string, unknown>);
    } catch {
      projection = {};
    }
    const changesetId = projection['changesetId'];
    if (
      typeof changesetId === 'string' &&
      (await this.#authorizedChangeset(actor, changesetId)) !== undefined
    ) {
      const record = await this.#authorizedChangeset(actor, changesetId);
      if (record !== undefined) {
        return { ok: true, data: { changeset: record } };
      }
    }
    const releaseVersion = projection['releaseVersion'];
    if (
      typeof releaseVersion === 'string' &&
      typeof projection['applicationId'] === 'string' &&
      (command === 'release.select' || command === 'release.rollback')
    ) {
      const release = await this.#options.stores.control.getRelease(releaseVersion);
      if (release !== undefined) {
        return {
          ok: true,
          data: {
            selection: {
              applicationId: projection['applicationId'],
              releaseVersion,
              selectionRevision: projection['selectionRevision'],
            },
          },
        };
      }
    }
    // Generic safe-projection replay (identifiers and stable codes only).
    return { ok: true, data: projection };
  }

  /** Actor-scoped ChangeSet read for replay reconstruction. */
  async #authorizedChangeset(actor: ServerActorContext, changesetId: string) {
    const get = this.#options.controlPlane.get;
    if (get === undefined) {
      return undefined;
    }
    try {
      return (await get.call(this.#options.controlPlane, actor, changesetId)) as
        Record<string, unknown> | undefined;
    } catch {
      return undefined;
    }
  }

  /** Execute one command (pre-validated payload; authorization asserted). */
  async #execute(
    actor: ServerActorContext,
    command: VictCommandName,
    payload: Record<string, unknown>,
    idempotencyKey: unknown,
  ): Promise<VictCommandOutcome> {
    switch (command) {
      case 'health.inspect':
        return ok({
          healthy: true,
          commandSchema: VICT_COMMAND_SCHEMA,
          turnExecutorComposed: this.#options.turnService !== undefined,
        });
      case 'compatibility.inspect':
        return ok({
          commandSchema: VICT_COMMAND_SCHEMA,
          streamSchema: 'vict.agent-stream@1',
          changesetSchema: 'vict.changeset@1',
          turnSchema: 'vict.agent-turn@1',
        });
      case 'actor.whoami':
        return ok({
          actorId: actor.actorId,
          roles: [...actor.roles],
          scopes: [...actor.scopes],
          mastraResourceId: actor.mastraResourceId,
        });
      case 'changeset.propose': {
        const record = await this.#options.controlPlane.propose(actor, {
          changesetId: boundedId(payload.changesetId, 'changesetId'),
          base: validateBase(payload.base),
          operations: requireArray(payload.operations, 'operations', 1, 64),
          rationale: boundedString(payload.rationale ?? '', 'rationale', 2000),
          riskClass: riskClass(payload.riskClass),
          requiredApproverCount: approverCount(payload.requiredApproverCount),
          expiresAt: boundedTimestamp(payload.expiresAt, 'expiresAt'),
        });
        return ok({ changeset: record as Record<string, unknown> });
      }
      case 'changeset.revise':
        return ok({
          changeset: (await this.#options.controlPlane.revise(actor, {
            changesetId: boundedId(payload.changesetId, 'changesetId'),
            operations: requireArray(payload.operations, 'operations', 1, 64),
            rationale: boundedString(payload.rationale ?? '', 'rationale', 2000),
            riskClass: riskClass(payload.riskClass),
            requiredApproverCount: approverCount(payload.requiredApproverCount),
            expiresAt: boundedTimestamp(payload.expiresAt, 'expiresAt'),
          })) as Record<string, unknown>,
        });
      case 'changeset.execute-check': {
        const kind =
          payload.kind === 'validation' || payload.kind === 'simulation' ? payload.kind : undefined;
        if (kind === undefined) {
          throw new VictControlError(
            'VICT_COMMAND_FIELD_INVALID',
            "kind must be 'validation' or 'simulation'.",
          );
        }
        const run = await this.#options.controlPlane.executeChangeSetCheck(actor, {
          changesetId: boundedId(payload.changesetId, 'changesetId'),
          kind,
        });
        return ok({ run: run as unknown as Record<string, unknown> });
      }
      case 'changeset.attach-evidence': {
        if (payload.kind !== 'validation' && payload.kind !== 'simulation') {
          throw new VictControlError(
            'VICT_COMMAND_FIELD_INVALID',
            "kind must be 'validation' or 'simulation'.",
          );
        }
        // The caller supplies ONLY the identity of an EXECUTED run; every
        // evidence field (outcome, timestamps, content hash, base binding,
        // runner profile, actor) is derived server-side from the durable
        // run record. Fabricated evidence cannot pass this boundary.
        const attach =
          payload.kind === 'validation'
            ? this.#options.controlPlane.attachValidationEvidence
            : this.#options.controlPlane.attachSimulationEvidence;
        return ok({
          changeset: (await attach.call(this.#options.controlPlane, actor, {
            changesetId: boundedId(payload.changesetId, 'changesetId'),
            runId: boundedId(payload.runId, 'runId'),
          })) as Record<string, unknown>,
        });
      }
      case 'changeset.decide':
        return ok({
          result: (await this.#options.controlPlane.decide(actor, {
            changesetId: boundedId(payload.changesetId, 'changesetId'),
            decision: decisionOf(payload.decision),
          })) as Record<string, unknown>,
        });
      case 'changeset.commit':
        return ok({
          result: (await this.#options.controlPlane.commit(actor, {
            changesetId: boundedId(payload.changesetId, 'changesetId'),
          })) as Record<string, unknown>,
        });
      case 'changeset.get': {
        const record = await this.#options.controlPlane.get(
          actor,
          boundedId(payload.changesetId, 'changesetId'),
        );
        if (record === undefined) {
          return { ok: false, code: 'VICT_CONTROL_CHANGESET_MISSING' };
        }
        return ok({ changeset: record as unknown as Record<string, unknown> });
      }
      case 'changeset.list':
        return ok({ changesets: await this.#options.controlPlane.list(actor) });
      case 'release.publish':
        return ok({
          release: (await this.#options.controlPlane.publishRelease(actor, {
            releaseVersion: boundedId(payload.releaseVersion, 'releaseVersion'),
            applicationId: boundedId(payload.applicationId, 'applicationId'),
            applicationVersion: boundedId(payload.applicationVersion, 'applicationVersion'),
            rendererIdentity: boundedId(payload.rendererIdentity, 'rendererIdentity'),
            componentRegistryIdentity: boundedId(
              payload.componentRegistryIdentity,
              'componentRegistryIdentity',
            ),
            dataAdapterIdentity: boundedId(payload.dataAdapterIdentity, 'dataAdapterIdentity'),
            activationBinding: boundedId(payload.activationBinding, 'activationBinding'),
          })) as Record<string, unknown>,
        });
      case 'release.select':
        return ok({
          selection: (await this.#options.controlPlane.selectRelease(actor, {
            applicationId: boundedId(payload.applicationId, 'applicationId'),
            releaseVersion: boundedId(payload.releaseVersion, 'releaseVersion'),
          })) as Record<string, unknown>,
        });
      case 'release.rollback':
        return ok({
          selection: (await this.#options.controlPlane.rollbackRelease(actor, {
            applicationId: boundedId(payload.applicationId, 'applicationId'),
            targetReleaseVersion: boundedId(payload.targetReleaseVersion, 'targetReleaseVersion'),
          })) as Record<string, unknown>,
        });
      case 'release.get-selected': {
        const release = await this.#options.controlPlane.getSelectedRelease(
          actor,
          boundedId(payload.applicationId, 'applicationId'),
        );
        if (release === undefined) {
          return { ok: false, code: 'VICT_CONTROL_RELEASE_MISSING' };
        }
        return ok({ release: release as unknown as Record<string, unknown> });
      }
      case 'activation.select': {
        // Direct activation selection (operator path): the authenticated
        // actor is asserted (activation.select scope) upstream and is the
        // ATTRIBUTED identity — never a synthetic "system" actor.
        const graphId = boundedId(payload.graphId, 'graphId');
        const activationVersion = boundedId(payload.activationVersion, 'activationVersion');
        const selection = await this.#options.controlPlane.selectActivation(actor, {
          graphId,
          activationVersion,
        });
        return ok({ selection: selection as unknown as Record<string, unknown> });
      }
      case 'run.cancel':
        return ok(await this.#cancelRun(actor, payload, idempotencyKey));
      case 'agent.turn.start': {
        const turnService = requireTurnService(this.#options.turnService);
        const result = (await turnService.startTurn(actor, {
          threadId: boundedId(payload.threadId, 'threadId'),
          input: boundedString(payload.input, 'input', 8000),
        })) as { turn: { turnId: string; streamId: string } };
        return ok({ turnId: result.turn.turnId, streamId: result.turn.streamId });
      }
      case 'agent.turn.cancel':
        return ok({
          result: (await requireTurnService(this.#options.turnService).cancelTurn(actor, {
            turnId: boundedId(payload.turnId, 'turnId'),
            ...(typeof payload.reasonCode === 'string' ? { reasonCode: payload.reasonCode } : {}),
          })) as Record<string, unknown>,
        });
      case 'agent.turn.get':
        return ok({
          turn: (await requireTurnService(this.#options.turnService).getTurn(
            actor,
            boundedId(payload.turnId, 'turnId'),
          )) as unknown as Record<string, unknown>,
        });
      case 'agent.tool.approve':
      case 'agent.tool.decline': {
        const decision = command === 'agent.tool.approve' ? 'approved' : 'declined';
        return ok({
          approval: (await requireTurnService(this.#options.turnService).decideToolApproval(actor, {
            approvalId: boundedId(payload.approvalId, 'approvalId'),
            decision,
            ...(typeof payload.reason === 'string' && payload.reason.length > 0
              ? { reason: boundedString(payload.reason, 'reason', 200) }
              : {}),
          })) as unknown as Record<string, unknown>,
        });
      }
      case 'stream.inspect': {
        // ACTOR-SCOPED stream inspection: identifiers of other actors are
        // never disclosed; privileged `operator.resolve` holders see all.
        const streamId = boundedId(payload.streamId, 'streamId');
        const ledger = this.#options.stores.streamLedger;
        const privileged = actor.scopes.includes('operator.resolve');
        const turnRows = await this.#options.stores.turns.listTurns();
        const ownStreamIds = new Set(
          turnRows
            .filter((turn) => privileged || turn.actorId === actor.actorId)
            .map((turn) => turn.streamId),
        );
        const owned = ownStreamIds.has(streamId);
        if (!owned) {
          // Existence is not disclosed across the actor boundary.
          return { ok: false, code: 'VICT_STREAM_ACTOR_MISMATCH' };
        }
        return ok({
          streamId,
          latestSeq: await ledger.latestSeq(streamId),
          streams: [...ownStreamIds].sort(),
        });
      }
      case 'app.data.query':
        return ok({ result: await requireAppData(this.#options.appData).query(actor, payload) });
      case 'app.data.mutate':
        return ok({ result: await requireAppData(this.#options.appData).mutate(actor, payload) });
      case 'app.data.action':
        return ok({ result: await requireAppData(this.#options.appData).mutate(actor, payload) });
      default:
        return { ok: false, code: 'VICT_COMMAND_UNKNOWN' };
    }
  }

  /** Durable, actor-authorized run cancellation over the composed store. */
  async #cancelRun(
    actor: ServerActorContext,
    payload: Record<string, unknown>,
    idempotencyKey: unknown,
  ): Promise<Record<string, unknown>> {
    const cancelRun = this.#options.controlPlane.cancelRun;
    if (cancelRun === undefined) {
      throw new VictControlError(
        'VICT_RUN_STORE_UNAVAILABLE',
        'No orchestration store is composed in this deployment; run cancellation is unavailable.',
      );
    }
    return (await cancelRun({
      runId: boundedId(payload.runId, 'runId'),
      actorId: actor.actorId,
      requestId: boundedId(
        typeof payload.reasonCode === 'string' &&
          payload.reasonCode.length > 0 &&
          idempotencyKey === undefined
          ? payload.reasonCode
          : idempotencyKey,
        'requestId',
      ),
      reasonCode: typeof payload.reasonCode === 'string' ? payload.reasonCode : 'operator',
    })) as Record<string, unknown>;
  }
}

/**
 * The SAFE per-command replay projection stored in the durable receipt.
 * Only stable codes, safe identifiers, and content references are
 * retained — NEVER full command responses, rationale text, application
 * rows, model content, tool data, or unrestricted payloads. An authorized
 * replay that needs the full record re-derives it from the authoritative
 * domain under the current actor's authorization.
 */
function safeResultProjection(
  command: VictCommandName,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const pick = (
    source: Record<string, unknown>,
    fields: readonly string[],
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      const value = source[field];
      if (
        value !== undefined &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      ) {
        out[field] = value;
      }
    }
    return out;
  };
  switch (command) {
    case 'changeset.propose':
    case 'changeset.revise': {
      const changeset = (data['changeset'] ?? {}) as Record<string, unknown>;
      return {
        command,
        ...pick(changeset, ['changesetId', 'contentHash', 'status']),
      };
    }
    case 'changeset.execute-check': {
      const run = (data['run'] ?? {}) as Record<string, unknown>;
      return { command, ...pick(run, ['runId', 'kind', 'outcome']) };
    }
    case 'changeset.attach-evidence': {
      const changeset = (data['changeset'] ?? {}) as Record<string, unknown>;
      const validation = (changeset['validation'] ?? undefined) as
        Record<string, unknown> | undefined;
      const simulation = (changeset['simulation'] ?? undefined) as
        Record<string, unknown> | undefined;
      return {
        command,
        changesetId: changeset['changesetId'],
        ...(validation !== undefined && typeof validation === 'object'
          ? { validationOutcome: validation['outcome'] }
          : {}),
        ...(simulation !== undefined && typeof simulation === 'object'
          ? { simulationOutcome: simulation['outcome'] }
          : {}),
      };
    }
    case 'changeset.decide': {
      const result = (data['result'] ?? {}) as Record<string, unknown>;
      const decision = (result['decision'] ?? undefined) as Record<string, unknown> | undefined;
      return {
        command,
        changesetId: result['changesetId'],
        ...(decision !== undefined && typeof decision === 'object'
          ? pick(decision, ['decision'])
          : {}),
      };
    }
    case 'changeset.commit': {
      const result = (data['result'] ?? {}) as Record<string, unknown>;
      const record = (result['record'] ?? {}) as Record<string, unknown>;
      const applied = Array.isArray(result['applied'])
        ? (result['applied'] as unknown[]).length
        : undefined;
      return {
        command,
        changesetId: record['changesetId'],
        status: record['status'],
        ...(applied !== undefined ? { appliedCount: applied } : {}),
      };
    }
    case 'release.publish': {
      const release = (data['release'] ?? {}) as Record<string, unknown>;
      return { command, ...pick(release, ['releaseVersion', 'applicationId', 'contentHash']) };
    }
    case 'release.select':
    case 'release.rollback': {
      const selection = (data['selection'] ?? {}) as Record<string, unknown>;
      return {
        command,
        ...pick(selection, ['applicationId', 'releaseVersion', 'selectionRevision']),
      };
    }
    case 'activation.select': {
      const selection = (data['selection'] ?? {}) as Record<string, unknown>;
      return { command, ...pick(selection, ['graphId', 'activationVersion', 'selectionRevision']) };
    }
    case 'run.cancel': {
      return { command, ...pick(data, ['runId', 'status']) };
    }
    case 'agent.turn.start':
      return { command, ...pick(data, ['turnId', 'streamId']) };
    case 'agent.turn.cancel': {
      const result = (data['result'] ?? {}) as Record<string, unknown>;
      return { command, ...pick(result, ['turnId', 'status']) };
    }
    case 'agent.tool.approve':
    case 'agent.tool.decline': {
      const approval = (data['approval'] ?? {}) as Record<string, unknown>;
      return { command, ...pick(approval, ['approvalId', 'status']) };
    }
    case 'app.data.mutate':
    case 'app.data.action':
      // Application mutation results live in the AUTHORITATIVE application
      // domain: only the requested identities are referenced here.
      return {
        command,
        ...pick(data, ['resourceId', 'releaseVersion']),
      };
    default:
      return { command };
  }
}

/** Enforce one matrix scope (fail closed; stable non-echoing denial). */
function assertCommandScope(actor: ServerActorContext, scope: string): void {
  if (!actor.scopes.includes(scope as never)) {
    throw new VictControlError('VICT_ACTOR_SCOPE_DENIED', `the required scope is not held.`);
  }
}

/** Dispatch-level health of the composed turn service. */
function requireTurnService(turnService: TurnServiceLike | undefined): TurnServiceLike {
  if (turnService === undefined) {
    throw new VictControlError(
      'VICT_TURN_EXECUTOR_UNAVAILABLE',
      'No agent-turn service is composed in this deployment; turn commands are unavailable.',
    );
  }
  return turnService;
}

function requireAppData(appData: AppDataPort | undefined): AppDataPort {
  if (appData === undefined) {
    throw new VictControlError(
      'VICT_APPDATA_UNAVAILABLE',
      'No Application data adapter is composed in this deployment.',
    );
  }
  return appData;
}

// ---- Closed payload validation helpers -------------------------------------

function validateBase(base: unknown): {
  kind: 'activation' | 'release';
  subjectId: string;
  expectedVersion: string;
} {
  if (typeof base !== 'object' || base === null) {
    throw new VictControlError('VICT_COMMAND_FIELD_INVALID', 'base must be an object.');
  }
  const candidate = base as Record<string, unknown>;
  if (candidate.kind !== 'activation' && candidate.kind !== 'release') {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      'base.kind must be activation or release.',
    );
  }
  return {
    kind: candidate.kind,
    subjectId: boundedId(candidate.subjectId, 'base.subjectId'),
    expectedVersion: boundedId(candidate.expectedVersion, 'base.expectedVersion'),
  };
}

function requireArray(value: unknown, field: string, min: number, max: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      `${field} must be an array of ${min}..${max} items.`,
    );
  }
  return value;
}

function riskClass(value: unknown): 'low' | 'medium' | 'high' {
  if (value !== 'low' && value !== 'medium' && value !== 'high') {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      'riskClass must be low, medium, or high.',
    );
  }
  return value;
}

function approverCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 8) {
    throw new VictControlError('VICT_COMMAND_FIELD_INVALID', 'requiredApproverCount must be 1..8.');
  }
  return value;
}

function boundedTimestamp(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      `${field} must be an epoch-ms integer.`,
    );
  }
  return value;
}

function decisionOf(value: unknown): 'approved' | 'declined' {
  if (value !== 'approved' && value !== 'declined') {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      'decision must be approved or declined.',
    );
  }
  return value;
}

function ok(data: Record<string, unknown>): VictCommandOutcome {
  return { ok: true, data };
}

/** The ControlPlanePort: the control-plane surface the server composes. */
export interface ControlPlanePort {
  propose(
    actor: ServerActorContext,
    input: {
      changesetId: string;
      base: { kind: 'activation' | 'release'; subjectId: string; expectedVersion: string };
      operations: readonly unknown[];
      rationale: string;
      riskClass: 'low' | 'medium' | 'high';
      requiredApproverCount: number;
      expiresAt: number;
    },
  ): Promise<unknown>;
  revise(actor: ServerActorContext, input: Record<string, unknown>): Promise<unknown>;
  executeChangeSetCheck(
    actor: ServerActorContext,
    input: { changesetId: string; kind: 'validation' | 'simulation' },
  ): Promise<unknown>;
  attachValidationEvidence(
    actor: ServerActorContext,
    input: { changesetId: string; runId: string },
  ): Promise<unknown>;
  attachSimulationEvidence(
    actor: ServerActorContext,
    input: { changesetId: string; runId: string },
  ): Promise<unknown>;
  decide(
    actor: ServerActorContext,
    input: { changesetId: string; decision: 'approved' | 'declined' },
  ): Promise<unknown>;
  commit(actor: ServerActorContext, input: { changesetId: string }): Promise<unknown>;
  decline(actor: ServerActorContext, input: { changesetId: string }): Promise<unknown>;
  get(actor: ServerActorContext, changesetId: string): Promise<unknown>;
  list(actor: ServerActorContext): Promise<unknown>;
  publishRelease(actor: ServerActorContext, content: Record<string, unknown>): Promise<unknown>;
  selectRelease(actor: ServerActorContext, input: Record<string, unknown>): Promise<unknown>;
  rollbackRelease(actor: ServerActorContext, input: Record<string, unknown>): Promise<unknown>;
  getSelectedRelease(actor: ServerActorContext, applicationId: string): Promise<unknown>;
  auditTrail(subject: {
    subjectType?: string;
    subjectId?: string;
  }): Promise<readonly ControlAuditEvent[]>;
  selectActivation(
    actor: ServerActorContext,
    input: { graphId: string; activationVersion: string },
  ): Promise<unknown>;
  cancelRun?(input: {
    runId: string;
    actorId: string;
    requestId: string;
    reasonCode: string;
  }): Promise<unknown>;
}
