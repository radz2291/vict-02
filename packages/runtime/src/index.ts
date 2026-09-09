export type {
  ActiveGraphInfo,
  ActivationResult,
  RestorationResult,
  RestorationFailureCode,
  CapabilityContext,
  CapabilityDefinition,
  DoubleInvoke,
  PayloadRetention,
  RunNodeOptions,
  RunOptions,
  RunRecord,
  RunResult,
  VictRuntimeOptions,
} from './types.js';
export type {
  EffectClass,
  ExecutionMode,
  KernelEvent,
  KernelEventType,
  OutputSummary,
} from '@victframework/kernel';
export type {
  ActivationCatalog,
  ActivationSelection,
  ActivationManifest,
  ActivationManifestBinding,
  ActivationManifestContract,
  CommitRunTransitionCommand,
  CreateRunCommand,
  DisposableVictStores,
  ExecutionStore,
  PublishActivationCommand,
  PublishAndSelectCommand,
  PublishResult,
  RecoveredRun,
  RecoveryCommand,
  RecoveryResult,
  RunQuery,
  SelectActivationCommand,
  StoredActivation,
  StoredEvent,
  StoredRun,
  StoredRunStatus,
  RunStateUpdate,
  TransitionFaultHooks,
  VictStores,
} from './store-types.js';
export {
  ACTIVATION_MANIFEST_SCHEMA,
  ACTIVATION_MANIFEST_SCHEMA_V2,
  RUN_EVENT_SCHEMA,
} from './store-types.js';
export type { InMemoryStoresOptions } from './in-memory-stores.js';
export { createInMemoryStores } from './in-memory-stores.js';
export type { OrchestrationInMemoryOptions } from './orchestration-in-memory.js';
export { createInMemoryOrchestrationStore } from './orchestration-in-memory.js';
export type {
  OrchestrationStore,
  OrchestrationSnapshotView,
  StoredOrchestrationRun,
  OrchestrationRunQuery,
  ClaimReadyTokenCommand,
  ClaimReadyTokenResult,
  ClaimedAttempt,
  ClaimPlanner,
  NodeExecutionPlanEntry,
  CompleteAttemptCommand,
  CompleteAttemptResult,
  AttemptContinuation,
  AttemptOutcome,
  NewWaitCommand,
  SignalWaitCommand,
  SignalDeliveryResult,
  DueTimerRecord,
  ClaimDueTimersCommand,
  ClaimDueTimersResult,
  ResolveDueTimerCommand,
  ResolveDueTimerResult,
  TimerRecord,
  RequestCancellationCommand,
  CancellationResult,
  ApplyCancellationCommand,
  RecoverableClaim,
  RecoverAttemptCommand,
  RecoverOrchestrationCommand,
  RecoverOrchestrationResult,
  ResolveBlockedCommand,
  ResolveBlockedResult,
  OrchestrationEventInput,
  OrchestrationFaultHooks,
  CreateOrchestrationRunCommand,
} from './orchestration-store-types.js';
export type { StoreErrorCode, StoreErrorDetails } from './store-errors.js';
export { VictStoreError } from './store-errors.js';
export type { RuntimeErrorCode } from './errors.js';
export { VictRuntime, createRuntime } from './runtime.js';
export { decideEffectAuthorization } from './effect-policy.js';
export type { EffectPolicyOverrides } from './effect-policy.js';
export { VictRuntimeError } from './errors.js';
// Stage 04 capability packs.
export { installCapabilityPack, VICT_RUNTIME_COMPAT_VERSION } from './pack-install.js';
export { runCapabilityPackConformanceSuite } from './pack-conformance.js';
export type {
  CapabilityPackConformanceFixture,
  CapabilityPackConformanceOptions,
} from './pack-conformance.js';
export { gateCapabilityInvoke } from './authority.js';
export type { CapabilityAuthority, ConfigurationPort, SecretResolutionPort } from './authority.js';
export { toCanonicalJson, canonicalPersistedValue } from './serialization.js';
export {
  assertPublishableManifest,
  assertRunMatchesActivation,
  assertActivationBelongsToGraph,
  assertEventMatchesRun,
  assertStoredActivationReadable,
} from './store-validation.js';
export type { ActivationIdentity, RunIdentityColumns } from './store-validation.js';

// ---- Product-agent boundary (Stage 06A) ------------------------------------
export type {
  AgentActivationRecord,
  AgentActivationRecordValidation,
  AgentActivationRestoreFailureCode,
  AgentActivationRestoreResult,
  AgentArtifact,
  AgentArtifactBinding,
  AgentArtifactKind,
  AgentCredentialPort,
  AgentHelperToolArtifact,
  AgentHelperToolDefinition,
  AgentHelperToolIO,
  AgentInstructionsArtifact,
  AgentMemoryPolicyArtifact,
  AgentMemoryPolicyConfig,
  AgentProcessorArtifact,
  AgentGuardrailArtifact,
  AgentProfileActivation,
  AgentStructuredOutputContractArtifact,
  AgentTurnExecutionContext,
  AgentTurnOutcome,
  AgentTurnRequest,
  AgentWorkflowArtifact,
  PinnedAgentTurnRunner,
  ProductAgentPort,
} from './agent-types.js';
export {
  AGENT_ACTIVATION_IDENTITY_SCHEMA,
  AGENT_ACTIVATION_RECORD_SCHEMA,
  pinAgentTurnRunner,
  validateAgentActivationRecord,
} from './agent-types.js';
export { AgentProfileRegistry } from './agent-registry.js';
export type { AgentProfileRegistryOptions } from './agent-registry.js';
export {
  AgentCredentialError,
  AgentConversationExportError,
  ConversationDeletionCoordinator,
  ConversationExportService,
  InMemoryAgentGovernanceStore,
  assertCredentialName,
  assertDeletionIntentRecord,
  assertDeletionReceiptStep,
  assertDeletionStateTransition,
  assertDeletionStateTransitionWithReceipts,
  DELETION_RECEIPT_STEP_INVALID_MESSAGE,
  DELETION_STEP_DOMAIN,
  protectCredentialPort,
  requireCredential,
} from './agent-governance.js';
export type {
  AgentConversationDomainPort,
  AgentConversationExport,
  AgentConversationExportErrorCode,
  AgentConversationExportMessage,
  AgentConversationExportResult,
  AgentConversationMemoryExportPort,
  AgentCredentialErrorCode,
  AgentDeletionIntentRecord,
  AgentDeletionIntentState,
  AgentDeletionOutcome,
  AgentDeletionStep,
  AgentDeletionStepReceipt,
  AgentGovernanceStore,
  AgentMemoryDeletionPort,
  ConversationDeletionCoordinatorOptions,
} from './agent-governance.js';

// ---- Stage 06B: control plane and governed remote execution ----------------
export { ACTOR_SCOPES, CHANGESET_BASE_NONE } from './control-types.js';
export type {
  ApplicationReleaseContent,
  ApplicationReleaseRecord,
  AuthenticatedActorContext,
  ActorDirectory,
  ActorRecord,
  ActorRole,
  ActorScope,
  ActorStatus,
  AgentApprovalRecord,
  AgentApprovalStatus,
  AgentApprovalStore,
  AgentControlStores,
  AgentStreamLedgerEvent,
  AgentStreamLedgerStore,
  AgentToolInvocationRecord,
  AgentToolInvocationStatus,
  TurnToolSlotAllocation,
  AgentToolInvocationStore,
  AgentTurnCorrelation,
  AgentTurnRecord,
  AgentTurnStatus,
  AgentTurnStore,
  ChangeSetApprovalDecision,
  ChangeSetBase,
  ChangeSetOperation,
  ChangeSetOperationReceipt,
  ChangeSetRecord,
  ChangeSetRiskClass,
  ChangeSetSimulationEvidence,
  ChangeSetStatus,
  ChangeSetValidationEvidence,
  CommandIdempotencyReceipt,
  CommandIdempotencyStore,
  CommandIdempotencyName,
  CommandIdempotencyLeaseTakeover,
  ControlAuditAction,
  ControlAuditEvent,
  ControlPlaneStore,
  ControlRunDetail,
  ControlRunKind,
  ControlRunOperationOutcome,
  ControlRunRecord,
  ReleaseSelectionRecord,
} from './control-types.js';
export {
  ACTOR_ROLES,
  CHANGESET_SCHEMA,
  CONTROL_AUDIT_ACTIONS,
  COMMAND_IDEMPOTENCY_KEY_PATTERN,
  CONTROL_ID_PATTERN,
  ROLE_SCOPES,
  AGENT_TURN_SCHEMA,
  assertActorScope,
  assertBoundedString,
  assertControlId,
  assertControlTimestamp,
  authenticatedActorContext,
  authoritativeScopes,
  captureClosedControlArray,
  captureClosedControlRecord,
  controlContentHash,
  isDurableStreamKind,
  streamEventPayloadOf,
  validateApplicationReleaseContent,
  validateChangeSetContent,
  validateChangeSetOperation,
  validateStreamLedgerAppend,
  changeSetOperationIdentity,
  VICT_IDEMPOTENCY_FENCE_CONFLICT,
  commandIdempotencyFenceToken,
} from './control-types.js';
export { ActorScopeDeniedError, VictControlError } from './control-types.js';
export {
  createInMemoryAgentControlStores,
  InMemoryActorDirectory,
  InMemoryAgentApprovalStore,
  InMemoryCommandIdempotencyStore,
  InMemoryAgentStreamLedgerStore,
  InMemoryAgentToolInvocationStore,
  InMemoryAgentTurnStore,
  InMemoryControlPlaneStore,
} from './control-in-memory.js';
export { AgentStreamHub } from './stream-hub.js';
// ---- Stage 07A: protected operator-configuration foundation -----------------
export {
  OPERATOR_CONFIG_SCHEMA,
  OperatorConfigError,
  OperatorCredentialUnavailableError,
  requireOperatorCredential,
  resolveOperatorConfiguration,
  resolveProviderProfileSelection,
  resolveRetentionBounds,
  resolveStoreLocationPlan,
  serializeOperatorConfiguration,
} from './operator-config.js';
export type {
  OperatorConfigErrorCode,
  OperatorConfiguration,
  OperatorConfigInput,
  OperatorCredentialEnvironment,
  OperatorProfileInput,
  OperatorRetentionInput,
  OperatorStoresInput,
  ProviderProfileSelection,
  RetentionBounds,
  StoreLocationPlan,
} from './operator-config.js';
export type {
  AgentStreamHubOptions,
  AgentStreamReplay,
  AgentStreamReplayStatus,
  AgentStreamSubscriber,
} from './stream-hub.js';
export {
  inMemoryAgentControlConformanceFactory,
  runAgentControlConformanceSuite,
} from './control-conformance.js';
export type { AgentControlConformanceFactory } from './control-conformance.js';
