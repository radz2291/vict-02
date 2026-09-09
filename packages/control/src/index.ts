/**
 * `@victframework/control` — the Vict control plane (Stage 06B).
 *
 * Transport-free governance over the neutral runtime ports:
 *
 * - the authenticated actor boundary (roles, scopes, default deny);
 * - the ChangeSet lifecycle with immutable content identity, evidence,
 *   approvals, expiry, and forward-only status;
 * - activation and Application Release governance (publish/select/rollback
 *   over immutable versions, monotonic selections, audit trail);
 * - the agent-turn governance service (durable intents, tool invocation
 *   intents, VICT-authoritative approval records with exact binding,
 *   durable cancellation, restart reconciliation);
 * - the stream hub wiring helpers for server/adapter compositions.
 *
 * This package NEVER imports the optional agent-framework adapter and
 * carries no transport, HTTP, or framework type.
 */
export { ControlPlaneService, assertScopeForActor, resolveActorContext } from './control-plane.js';
export type {
  ActorAuthority,
  ApplicationReleaseRecordContent,
  ChangeSetSimulator,
  OperationGuard,
  ProposeChangeSetInput,
} from './control-plane.js';
export {
  SANDBOX_SIMULATOR_ID,
  createControlPlaneSandboxSimulator,
} from './control-plane-simulation.js';
export type {
  AgentTurnExecutor,
  AgentTurnServiceOptions,
  AgentTurnStartResult,
  ToolApprovalPolicy,
} from './agent-turns.js';
export { AgentTurnService, safeInputSummary } from './agent-turns.js';
