import { createHash } from 'node:crypto';
import type { AgentControlStores, ControlAuditEvent } from '@vict/runtime';
import { COMMAND_IDEMPOTENCY_KEY_PATTERN, toCanonicalJson, VictControlError } from '@vict/runtime';
import type { ServerActorContext } from './auth.js';

/**
 * Stage 06B — the transport-free, versioned command service (API-002).
 *
 * The HTTP transport and the CLI consume the SAME typed dispatcher; no
 * caller bypasses governance. Properties enforced HERE (below the
 * transport, fail closed):
 *
 * - AUTHORIZATION MATRIX: every public command declares its required scope
 *   from the closed scope vocabulary and every authenticated actor is
 *   asserted against it BEFORE any store access;
 * - CLOSED PAYLOAD SCHEMAS: every command declares its exact payload field
 *   set; unknown fields and non-object payloads are rejected (never
 *   silently converted to `{}`);
 * - DURABLE COMMAND IDEMPOTENCY: every state-changing command requires a
 *   bounded `Idempotency-Key`; the receipt binds actor + command kind +
 *   canonical request digest + durable result/terminal disposition, so the
 *   same logical command returns the original result without repeating
 *   effects, a conflicting key fails with a stable error, and concurrent
 *   duplicates have exactly one winner;
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
 * The AUTHORIZATION MATRIX: the exact required scope (from the closed
 * `ACTOR_SCOPES` vocabulary) for every public command. Commands listed in
 * `AUTHENTICATED_ANY_SCOPE` require an authenticated actor but no specific
 * scope (identity/health introspection). Default policy remains denial:
 * a command absent from both tables does not exist.
 */
const COMMAND_SCOPES: Readonly<Record<VictCommandName, string>> = {
  'health.inspect': '*',
  'compatibility.inspect': '*',
  'actor.whoami': '*',
  'changeset.propose': 'changeset.propose',
  'changeset.revise': 'changeset.revise',
  'changeset.execute-check': 'changeset.propose',
  'changeset.attach-evidence': 'changeset.propose',
  'changeset.decide': 'changeset.approve',
  'changeset.commit': 'changeset.commit',
  'changeset.get': 'changeset.read',
  'changeset.list': 'changeset.read',
  'release.publish': 'release.publish',
  'release.select': 'release.select',
  'release.rollback': 'release.select',
  'release.get-selected': 'release.read',
  'activation.select': 'activation.select',
  'run.cancel': 'run.cancel',
  'agent.turn.start': 'agent.turn.start',
  'agent.turn.cancel': 'agent.turn.cancel',
  'agent.turn.get': 'run.read',
  'agent.tool.approve': 'agent.tool.approve',
  'agent.tool.decline': 'agent.tool.decline',
  'stream.inspect': 'agent.stream.read',
  'app.data.query': 'app.data.read',
  'app.data.mutate': 'app.data.write',
  'app.data.action': 'app.data.write',
};

/** The state-changing commands governed by durable idempotency. */
const MUTATION_COMMANDS: ReadonlySet<string> = new Set([
  'changeset.propose',
  'changeset.revise',
  'changeset.attach-evidence',
  'changeset.decide',
  'changeset.commit',
  'release.publish',
  'release.select',
  'release.rollback',
  'activation.select',
  'run.cancel',
  'agent.turn.start',
  'agent.turn.cancel',
  'agent.tool.approve',
  'agent.tool.decline',
  'app.data.mutate',
]);

/** True when the command mutates durable state (idempotency-governed). */
export function isMutationCommand(command: string): boolean {
  return MUTATION_COMMANDS.has(command);
}

/**
 * The closed per-command payload field sets. Unknown fields and non-object
 * payloads are rejected with `VICT_COMMAND_PAYLOAD_INVALID`; declared
 * fields are validated per command below.
 */
const COMMAND_PAYLOAD_FIELDS: Readonly<Record<VictCommandName, readonly string[]>> = {
  'health.inspect': [],
  'compatibility.inspect': [],
  'actor.whoami': [],
  'changeset.propose': [
    'changesetId',
    'base',
    'operations',
    'rationale',
    'riskClass',
    'requiredApproverCount',
    'expiresAt',
  ],
  'changeset.revise': [
    'changesetId',
    'operations',
    'rationale',
    'riskClass',
    'requiredApproverCount',
    'expiresAt',
  ],
  'changeset.execute-check': ['changesetId', 'kind'],
  'changeset.attach-evidence': ['changesetId', 'kind', 'runId'],
  'changeset.decide': ['changesetId', 'decision', 'reason'],
  'changeset.commit': ['changesetId'],
  'changeset.get': ['changesetId'],
  'changeset.list': [],
  'release.publish': [
    'releaseVersion',
    'applicationId',
    'applicationVersion',
    'rendererIdentity',
    'componentRegistryIdentity',
    'dataAdapterIdentity',
    'activationBinding',
  ],
  'release.select': ['applicationId', 'releaseVersion'],
  'release.rollback': ['applicationId', 'targetReleaseVersion'],
  'release.get-selected': ['applicationId'],
  'activation.select': ['graphId', 'activationVersion'],
  'run.cancel': ['runId', 'reasonCode'],
  'agent.turn.start': ['threadId', 'input', 'applicationReleaseVersion'],
  'agent.turn.cancel': ['turnId', 'reasonCode'],
  'agent.turn.get': ['turnId'],
  'agent.tool.approve': ['approvalId', 'reason', 'decision'],
  'agent.tool.decline': ['approvalId', 'reason', 'decision'],
  'stream.inspect': ['streamId'],
  'app.data.query': ['resourceId', 'releaseVersion', 'filters'],
  'app.data.mutate': ['resourceId', 'releaseVersion', 'expectedRevision', 'actionKind'],
  'app.data.action': ['resourceId', 'releaseVersion', 'expectedRevision', 'actionKind'],
};

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

/** Canonical digest over the exact request payload (stable, payload-safe). */
function requestDigest(payload: Record<string, unknown>): string {
  return createHash('sha256')
    .update(`vict.command@1\u0000${toCanonicalJson(payload)}`, 'utf8')
    .digest('hex');
}

/**
 * The versioned command dispatcher: transport-free and shared by HTTP and
 * the CLI. Every command re-derives its authorization from the
 * authenticated server context (never from the payload) and mutates only
 * through the durable idempotency policy.
 */
export class VictCommandService {
  readonly #options: VictCommandServiceOptions;

  constructor(options: VictCommandServiceOptions) {
    this.#options = options;
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
    // ---- Closed payload schema (fail closed on unknown/non-object) ------
    const payload = this.#validatedPayload(command, request.payload);
    // ---- Authorization matrix (BELOW the transport; default deny) -------
    const requiredScope = COMMAND_SCOPES[command];
    if (requiredScope !== '*') {
      assertCommandScope(actor, requiredScope);
    }
    // ---- Durable idempotency policy for state-changing commands ---------
    if (isMutationCommand(command)) {
      return this.#dispatchIdempotent(actor, command, payload, request.idempotencyKey);
    }
    return this.#execute(actor, command, payload, request.idempotencyKey);
  }

  /** Validate the payload against the command's closed field set. */
  #validatedPayload(command: VictCommandName, raw: unknown): Record<string, unknown> {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new VictControlError(
        'VICT_COMMAND_PAYLOAD_INVALID',
        'The command payload must be a plain object; non-object payloads are never silently converted.',
      );
    }
    const allowed = COMMAND_PAYLOAD_FIELDS[command];
    const candidate = raw as Record<string, unknown>;
    for (const key of Object.keys(candidate)) {
      if (!allowed.includes(key)) {
        throw new VictControlError(
          'VICT_COMMAND_PAYLOAD_INVALID',
          `The command payload declares an unknown field for '${command}'.`,
        );
      }
    }
    return candidate;
  }

  /**
   * The durable idempotency boundary for one state-changing command:
   * claim → execute → settle, with stable conflict semantics.
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
    const existing = await store.getReceipt(idempotencyKey);
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
        // A concurrent duplicate: exactly one winner is executing; the
        // loser receives the stable in-progress conflict.
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' };
      }
      if (existing.status === 'failed') {
        return { ok: false, code: existing.responseCode ?? 'VICT_COMMAND_FAILED' };
      }
      return { ok: true, data: JSON.parse(existing.resultJson ?? '{}') as Record<string, unknown> };
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
    });
    if (claim === 'exists') {
      // Lost the concurrent race: re-read the receipt for the truthful
      // disposition (the winner may have settled in the meantime).
      const raced = await store.getReceipt(idempotencyKey);
      if (
        raced !== undefined &&
        (raced.actorId !== actor.actorId ||
          raced.command !== command ||
          raced.requestDigest !== digest)
      ) {
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
      }
      if (raced !== undefined && raced.status === 'completed') {
        return { ok: true, data: JSON.parse(raced.resultJson ?? '{}') as Record<string, unknown> };
      }
      return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' };
    }
    try {
      const outcome = await this.#execute(actor, command, payload, idempotencyKey);
      if (outcome.ok) {
        await store.completeReceipt({
          idempotencyKey,
          resultJson: JSON.stringify(outcome.data),
          at: now(),
        });
      } else {
        await store.failReceipt({ idempotencyKey, responseCode: outcome.code, at: now() });
      }
      return outcome;
    } catch (error) {
      const code = error instanceof VictControlError ? error.code : 'VICT_COMMAND_FAILED';
      await store.failReceipt({ idempotencyKey, responseCode: code, at: now() });
      throw error;
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
