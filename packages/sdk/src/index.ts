/**
 * `@vict/sdk` is the intended import surface for application and future
 * capability authors. Application code should not need deep kernel internals.
 *
 * The base surface is schema-library neutral. Zod convenience lives in the
 * optional `@vict/sdk/zod` subpath.
 *
 * Dependency direction: contracts <- kernel <- runtime, with the sdk layered
 * on top and lower packages never importing from it.
 */

// Neutral executable contracts and structured results.
export { defineContract, victError, errorSignalContract } from '@vict/contracts';
export type {
  Contract,
  ContractDefinition,
  ContractIssue,
  ContractResult,
  VictError,
} from '@vict/contracts';
export { ContractDefinitionError } from '@vict/contracts';
export type { ContractDefinitionErrorCode } from '@vict/contracts';

// Graph vocabulary (authoring types only; execution is runtime's job).
export type {
  ApplicationGraphDefinition,
  CompiledGraph,
  CompiledNode,
  EffectClass,
  ExecutionMode,
  GraphEdgeDefinition,
  GraphIssue,
  GraphIssueCode,
  GraphNodeDefinition,
  KernelEvent,
  OutputSummary,
  RunStatus,
} from '@vict/kernel';

// Runtime facade.
export {
  createRuntime,
  createInMemoryStores,
  decideEffectAuthorization,
  VictRuntime,
  VictRuntimeError,
  VictStoreError,
  ACTIVATION_MANIFEST_SCHEMA,
  RUN_EVENT_SCHEMA,
  toCanonicalJson,
} from '@vict/runtime';
export type {
  ActiveGraphInfo,
  ActivationResult,
  RestorationResult,
  RestorationFailureCode,
  CapabilityContext,
  CapabilityDefinition,
  DoubleInvoke,
  EffectPolicyOverrides,
  PayloadRetention,
  RunNodeOptions,
  RunOptions,
  RunRecord,
  RunResult,
  RuntimeErrorCode,
  StoreErrorCode,
  StoreErrorDetails,
  VictRuntimeOptions,
  VictStores,
  DisposableVictStores,
  ActivationCatalog,
  ActivationSelection,
  ActivationManifest,
  ActivationManifestBinding,
  ActivationManifestContract,
  ExecutionStore,
  StoredRun,
  StoredRunStatus,
  StoredEvent,
  StoredActivation,
  RunQuery,
  RecoveryResult,
  RecoveredRun,
  CreateRunCommand,
  CommitRunTransitionCommand,
  RunStateUpdate,
  PublishActivationCommand,
  PublishAndSelectCommand,
  PublishResult,
  SelectActivationCommand,
  RecoveryCommand,
  TransitionFaultHooks,
} from '@vict/runtime';

// Authoring helpers.
export { defineCapability, defineGraph } from './authoring.js';
