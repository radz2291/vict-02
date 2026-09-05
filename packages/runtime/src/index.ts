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
} from '@vict/kernel';
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
  assertDeletionStateTransition,
  assertDeletionStateTransitionWithReceipts,
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
