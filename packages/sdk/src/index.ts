/**
 * `@vict/sdk` — the stable authoring ABI for Vict.
 *
 * Stage 04 corrected the dependency direction: the SDK is a lightweight
 * authoring layer BELOW the kernel and runtime, so capability-pack and
 * application authors can install and import `@vict/sdk` without
 * installing the runtime:
 *
 *   @vict/contracts -> @vict/sdk -> @vict/kernel -> @vict/runtime
 *
 * This base surface is schema-library neutral and framework neutral:
 * - NO runtime composition APIs are exported here. Import `createRuntime`
 *   and friends explicitly from `@vict/runtime`.
 * - No Zod, Svelte, or runtime implementation type appears in these
 *   declarations. Optional Zod convenience lives in `@vict/sdk/zod`.
 * - Official factories return immutable (deep-frozen) definitions.
 */

// ---- Neutral executable contracts and structured results -----------------
export { defineContract, validateContractIdentity, neutralJsonContract } from '@vict/contracts';
export type {
  Contract,
  ContractDefinition,
  ContractIssue,
  ContractResult,
  VictError,
} from '@vict/contracts';
export { ContractDefinitionError } from '@vict/contracts';
export type { ContractDefinitionErrorCode } from '@vict/contracts';
export { victError, errorSignalContract } from '@vict/contracts';
export {
  describeReceived,
  formatPath,
  safeIssueMessage,
  sanitizeContractIssues,
  toSafeIssue,
  MAX_OBSERVABLE_ISSUES,
  SAFE_ISSUE_CODES,
  UNTRUSTED_ISSUE_CODE,
} from '@vict/contracts';
export type { ObservableContractIssue, RawSchemaIssue, SafeIssueOptions } from '@vict/contracts';

// ---- Capability authoring vocabulary (moved from kernel/runtime) ----------
export type {
  CapabilityConfigReader,
  CapabilityContext,
  CapabilityDefinition,
  CapabilitySecretReader,
  DoubleInvoke,
  EffectClass,
  ExecutionMode,
} from './capability.js';

// ---- Graph authoring vocabulary (moved from kernel) ------------------------
export type {
  ApplicationGraphDefinition,
  BranchEdgeDefinition,
  CapabilityNodeDefinition,
  CapabilityNodeFields,
  DecisionNodeDefinition,
  DecisionResult,
  ErrorEdgeDefinition,
  ForkNodeDefinition,
  GraphEdgeDefinition,
  GraphEdgeKind,
  GraphNodeDefinition,
  JoinNodeDefinition,
  RetryPolicy,
  RouteEdgeDefinition,
  SignalWaitDefinition,
  SuccessEdgeDefinition,
  TimeoutEdgeDefinition,
  TimerWaitDefinition,
  WaitNodeDefinition,
} from './graph.js';
export { MAX_BRANCH_COUNT, MAX_DELAY_MS_LIMIT, RETRY_MAX_ATTEMPTS_LIMIT } from './graph.js';

// ---- Capability packs --------------------------------------------------------
export {
  CAPABILITY_PACK_SCHEMA,
  VICT_AUTHORING_COMPAT_VERSION,
  defineCapabilityPack,
  satisfiesCompatibilityRange,
  validateCapabilityPack,
} from './pack.js';
export type {
  CapabilityPack,
  CapabilityPackBindings,
  CapabilityPackManifest,
  PackAmbiguityPolicy,
  PackCapabilityBinding,
  PackCapabilityDeclaration,
  PackConfigurationDescriptor,
  PackContractDeclaration,
  PackDocumentation,
  PackDoubleDeclaration,
  PackEvaluation,
  PackIssue,
  PackIssueCode,
  PackPermissionDeclaration,
  PackProvenance,
  PackSecretDescriptor,
  PackValidationOptions,
  PackValidationResult,
} from './pack.js';

// ---- Application / Resource / Release definitions ---------------------------
export {
  APPLICATION_DEFINITION_SCHEMA,
  APPLICATION_RELEASE_SCHEMA,
  RESOURCE_DEFINITION_SCHEMA,
} from './application.js';
export type {
  ActionDefinition,
  ApplicationCompatibility,
  ApplicationDefinition,
  ApplicationRelease,
  ComponentReference,
  FormBinding,
  FormField,
  ReleaseActivation,
  ReleaseDataAdapter,
  ReleaseComponentRegistry,
  ReleaseProvenance,
  ReleaseRenderer,
  ResourceDefinition,
  ResourceField,
  ResourceFieldType,
  ResourceMutation,
  ResourcePresentationHint,
  ResourceQuerySupport,
  ResourceRelationship,
  ScreenDefinition,
  ScreenRegion,
  ScreenStates,
  Surface,
  SurfaceRole,
  ViewBinding,
} from './application.js';

// ---- Authoring factories (immutable by construction) ------------------------
export {
  defineApplication,
  defineApplicationRelease,
  defineCapability,
  defineGraph,
  defineResource,
  VictAuthoringError,
  frozenCapture,
} from './authoring.js';
export type { AuthoringErrorCode } from './authoring.js';
