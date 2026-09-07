import type { AgentControlStores, AgentStreamHub, ControlAuditEvent } from '@vict/runtime';
import { VictControlError } from '@vict/runtime';
import type { ServerActorContext } from './auth.js';

/**
 * Stage 06B — the transport-free, versioned command service (API-002).
 *
 * The HTTP transport and the CLI consume the SAME typed dispatcher; no
 * caller bypasses governance. Every command carries its closed schema
 * marker, bounded fields, and an idempotency identity where it mutates.
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

/** A closed, versioned command request. */
export interface VictCommandRequest {
  readonly command: VictCommandName;
  /** Bounded, command-specific payload (validated per command below). */
  readonly payload: Record<string, unknown>;
  /** Mutation idempotency key (required for mutations). */
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

/**
 * The versioned command dispatcher: transport-free and shared by HTTP and
 * the CLI. Every command re-derives its authorization from the
 * authenticated server context (never from the payload).
 */
export class VictCommandService {
  readonly #options: VictCommandServiceOptions;

  constructor(options: VictCommandServiceOptions) {
    this.#options = options;
  }

  /** Dispatch one command (closed schemas; stable safe errors). */
  async dispatch(
    actor: ServerActorContext,
    request: VictCommandRequest,
  ): Promise<VictCommandOutcome> {
    const payload = request.payload ?? {};
    switch (request.command) {
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
      case 'changeset.attach-evidence':
        if (payload.kind === 'validation') {
          return ok({
            changeset: (await this.#options.controlPlane.attachValidationEvidence(actor, {
              changesetId: boundedId(payload.changesetId, 'changesetId'),
              evidence: {
                runId: boundedId(payload.runId, 'runId'),
                outcome: evidenceOutcome(payload.outcome),
                recordedAt: boundedTimestamp(payload.recordedAt ?? Date.now(), 'recordedAt'),
              },
            })) as Record<string, unknown>,
          });
        }
        return ok({
          changeset: (await this.#options.controlPlane.attachSimulationEvidence(actor, {
            changesetId: boundedId(payload.changesetId, 'changesetId'),
            evidence: {
              runId: boundedId(payload.runId, 'runId'),
              outcome: simulationOutcome(payload.outcome),
              recordedAt: boundedTimestamp(payload.recordedAt ?? Date.now(), 'recordedAt'),
            },
          })) as Record<string, unknown>,
        });
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
      case 'changeset.get':
        return ok({
          changeset: ((await this.#options.controlPlane.get(
            boundedId(payload.changesetId, 'changesetId'),
          )) ?? {}) as Record<string, unknown>,
        });
      case 'changeset.list':
        return ok({ changesets: await this.#options.controlPlane.list() });
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
      case 'release.get-selected':
        return ok({
          release: ((await this.#options.controlPlane.getSelectedRelease(
            boundedId(payload.applicationId, 'applicationId'),
          )) ?? {}) as Record<string, unknown>,
        });
      case 'activation.select': {
        // Direct activation selection (operator path); audited by the
        // catalog's own selection record.
        const graphId = boundedId(payload.graphId, 'graphId');
        const activationVersion = boundedId(payload.activationVersion, 'activationVersion');
        const selection = await this.#options.controlPlane.selectActivation({
          graphId,
          activationVersion,
        });
        return ok({ selection: selection as unknown as Record<string, unknown> });
      }
      case 'run.cancel':
        return ok(await this.#cancelRun(actor, payload));
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
        const decision = request.command === 'agent.tool.approve' ? 'approved' : 'declined';
        return ok({
          approval: (await requireTurnService(this.#options.turnService).decideToolApproval(actor, {
            approvalId: boundedId(payload.approvalId, 'approvalId'),
            decision,
          })) as unknown as Record<string, unknown>,
        });
      }
      case 'stream.inspect': {
        const streamId = boundedId(payload.streamId, 'streamId');
        const ledger = this.#options.stores.streamLedger;
        return ok({
          streamId,
          latestSeq: await ledger.latestSeq(streamId),
          streams: await ledger.listStreamIds(),
        });
      }
      case 'app.data.query':
        return ok({ result: await requireAppData(this.#options.appData).query(actor, payload) });
      case 'app.data.mutate':
        return ok({ result: await requireAppData(this.#options.appData).mutate(actor, payload) });
      default:
        return { ok: false, code: 'VICT_COMMAND_UNKNOWN' };
    }
  }

  /** Activation selection + release read delegation (control plane). */
  /** Durable, actor-authorized run cancellation over the composed store. */
  async #cancelRun(
    actor: ServerActorContext,
    payload: Record<string, unknown>,
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
      requestId: boundedId(payload.requestId ?? payload.idempotencyKey, 'requestId'),
      reasonCode: typeof payload.reasonCode === 'string' ? payload.reasonCode : 'operator',
    })) as Record<string, unknown>;
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

function evidenceOutcome(value: unknown): 'passed' | 'failed' {
  if (value !== 'passed' && value !== 'failed') {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      'evidence outcome must be passed or failed.',
    );
  }
  return value;
}

function simulationOutcome(value: unknown): 'passed' | 'failed' | 'blocked' {
  if (value !== 'passed' && value !== 'failed' && value !== 'blocked') {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      'simulation outcome must be passed, failed, or blocked.',
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
  attachValidationEvidence(
    actor: ServerActorContext,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  attachSimulationEvidence(
    actor: ServerActorContext,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  decide(
    actor: ServerActorContext,
    input: { changesetId: string; decision: 'approved' | 'declined' },
  ): Promise<unknown>;
  commit(actor: ServerActorContext, input: { changesetId: string }): Promise<unknown>;
  decline(actor: ServerActorContext, input: { changesetId: string }): Promise<unknown>;
  get(changesetId: string): Promise<unknown>;
  list(): Promise<unknown>;
  publishRelease(actor: ServerActorContext, content: Record<string, unknown>): Promise<unknown>;
  selectRelease(actor: ServerActorContext, input: Record<string, unknown>): Promise<unknown>;
  rollbackRelease(actor: ServerActorContext, input: Record<string, unknown>): Promise<unknown>;
  getSelectedRelease(applicationId: string): Promise<unknown>;
  auditTrail(subject: {
    subjectType?: string;
    subjectId?: string;
  }): Promise<readonly ControlAuditEvent[]>;
  selectActivation(input: { graphId: string; activationVersion: string }): Promise<unknown>;
  cancelRun?(input: {
    runId: string;
    actorId: string;
    requestId: string;
    reasonCode: string;
  }): Promise<unknown>;
}
