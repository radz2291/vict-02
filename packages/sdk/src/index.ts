/**
 * `@vict/sdk` is the intended import surface for application and future
 * capability authors. Application code should not need deep kernel internals.
 *
 * Dependency direction: contracts <- kernel <- runtime, with the sdk layered
 * on top and lower packages never importing from it.
 */

// Executable contracts and structured results.
export { defineContract, victError, errorSignalContract } from '@vict/contracts';
export type { Contract, ContractIssue, ContractResult, VictError } from '@vict/contracts';

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
  createInMemoryRunRepository,
  decideEffectAuthorization,
  VictRuntime,
  VictRuntimeError,
} from '@vict/runtime';
export type {
  ActiveGraphInfo,
  ActivationResult,
  CapabilityContext,
  CapabilityDefinition,
  DoubleInvoke,
  EffectPolicyOverrides,
  RunNodeOptions,
  RunOptions,
  RunRecord,
  RunRepository,
  RunResult,
  RuntimeErrorCode,
  VictRuntimeOptions,
} from '@vict/runtime';

// Authoring helpers.
export { defineCapability, defineGraph } from './authoring.js';
