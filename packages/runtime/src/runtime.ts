import { compileGraph, executeGraph } from '@vict/kernel';
import type {
  ApplicationGraphDefinition,
  CompiledGraph,
  EffectAuthorizationDecision,
  ExecutionMode,
  KernelEvent,
  KernelPorts,
  KernelRunOutput,
} from '@vict/kernel';
import type { VictError } from '@vict/contracts';
import { CapabilityRegistry } from './registry.js';
import { createInMemoryRunRepository } from './repository.js';
import { decideEffectAuthorization } from './effect-policy.js';
import type { EffectPolicyOverrides } from './effect-policy.js';
import { VictRuntimeError, runtimeError } from './errors.js';
import type {
  ActiveGraphInfo,
  ActivationResult,
  CapabilityDefinition,
  DoubleInvoke,
  RunNodeOptions,
  RunOptions,
  RunRecord,
  RunRepository,
  RunResult,
  VictRuntimeOptions,
} from './types.js';

/**
 * The usable in-process Vict runtime.
 *
 * Composes a capability registry, the active compiled graph, execution
 * policy, and an in-memory run repository. Contains no ARA-specific logic:
 * applications register capabilities and graphs through this facade, the
 * kernel executes them deterministically.
 *
 * Safety model:
 * - Activation is atomic: a failed compile leaves the previous graph active.
 * - Effect policy is enforced before any capability runs (see effect-policy).
 * - `simulate` and `test` modes cannot invoke unmocked read/write/irreversible
 *   capabilities; missing test doubles produce a structured blocked result.
 * - `irreversible` in normal mode requires an explicit `allowIrreversible`
 *   policy from the caller.
 * - `runNode` executes a single node in isolation: it does not traverse
 *   edges, change the active graph, or write to the run repository.
 */
export class VictRuntime {
  readonly #registry = new CapabilityRegistry();
  readonly #repository: RunRepository;
  readonly #defaultOverrides: EffectPolicyOverrides;
  readonly #defaultMaxSteps: number | undefined;
  #active: CompiledGraph | undefined;

  constructor(options: VictRuntimeOptions = {}) {
    this.#repository = options.repository ?? createInMemoryRunRepository();
    this.#defaultOverrides = options.policy ?? {};
    this.#defaultMaxSteps = options.maxSteps;
  }

  registerCapability<I, O>(definition: CapabilityDefinition<I, O>): this {
    this.#registry.registerCapability(definition as CapabilityDefinition);
    return this;
  }

  registerContract(contract: Parameters<CapabilityRegistry['registerContract']>[0]): this {
    this.#registry.registerContract(contract);
    return this;
  }

  registerDouble(capabilityId: string, invoke: DoubleInvoke): this {
    this.#registry.registerDouble(capabilityId, invoke);
    return this;
  }

  /**
   * Compile and activate a graph atomically. On failure the previously active
   * graph remains active and a structured rejection is returned.
   */
  activate(definition: ApplicationGraphDefinition): ActivationResult {
    const result = compileGraph({
      definition,
      capabilities: this.#registry.capabilityIndex(),
      contracts: this.#registry.contractEnvironment(),
    });
    if (!result.ok) {
      return {
        ok: false,
        issues: result.issues,
        previousGraph: this.activeGraph(),
      };
    }
    this.#active = result.graph;
    return {
      ok: true,
      graphId: result.graph.id,
      graphVersion: result.graph.version,
      nodeCount: result.graph.nodeCount,
    };
  }

  activeGraph(): ActiveGraphInfo | undefined {
    const active = this.#active;
    if (!active) {
      return undefined;
    }
    return {
      id: active.id,
      version: active.version,
      entryNodeId: active.entryNodeId,
      nodeCount: active.nodeCount,
    };
  }

  /** Execute the active graph. Persists the run to the repository. */
  async run<T = unknown>(input: unknown, options: RunOptions = {}): Promise<RunResult<T>> {
    const graph = this.#requireActive();
    const mode: ExecutionMode = options.mode ?? 'normal';
    const overrides = options.policy ?? this.#defaultOverrides;
    const output = await executeGraph({
      graph,
      input,
      mode,
      maxSteps: options.maxSteps ?? this.#defaultMaxSteps,
      ports: this.#buildPorts(mode, overrides, options.onEvent),
    });
    this.#recordRun(output, mode);
    return toRunResult<T>(output);
  }

  /**
   * Execute a single node of the active graph in isolation (mode forced to
   * `'test'`). Does not traverse edges, does not change the active graph, and
   * does not write to the run repository. The trace is returned directly.
   */
  async runNode<T = unknown>(
    nodeId: string,
    input: unknown,
    options: RunNodeOptions = {},
  ): Promise<RunResult<T>> {
    const graph = this.#requireActive();
    const node = graph.getNode(nodeId);
    if (!node) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_UNKNOWN_NODE',
        `Active graph '${graph.id}' has no node '${nodeId}'.`,
      );
    }
    const isolatedDefinition: ApplicationGraphDefinition = {
      id: `${graph.id}#isolated:${nodeId}`,
      entry: nodeId,
      nodes: [
        {
          id: node.id,
          capability: node.capability,
          input: node.inputContractId,
          output: node.outputContractId,
        },
      ],
      edges: [],
    };
    const isolated = compileGraph({
      definition: isolatedDefinition,
      capabilities: this.#registry.capabilityIndex(),
      contracts: this.#registry.contractEnvironment(),
    });
    if (!isolated.ok) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_UNKNOWN_NODE',
        `Isolated node graph for '${nodeId}' failed to compile: ${isolated.issues.map((issue) => issue.message).join(' ')}`,
      );
    }
    // Isolated tests always run in 'test' mode with no policy overrides:
    // irreversible effects are denied and read/write effects require doubles.
    const output = await executeGraph({
      graph: isolated.graph,
      input,
      mode: 'test',
      maxSteps: options.maxSteps ?? this.#defaultMaxSteps,
      ports: this.#buildPorts('test', {}, options.onEvent),
    });
    return toRunResult<T>(output);
  }

  listRuns(): readonly RunRecord[] {
    return this.#repository.list();
  }

  getRun(runId: string): RunRecord | undefined {
    return this.#repository.get(runId);
  }

  #requireActive(): CompiledGraph {
    const active = this.#active;
    if (!active) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_NO_ACTIVE_GRAPH',
        'No active graph. Compile and activate a graph with runtime.activate(definition) first.',
      );
    }
    return active;
  }

  #buildPorts(
    mode: ExecutionMode,
    overrides: EffectPolicyOverrides,
    onEvent: ((event: KernelEvent) => void) | undefined,
  ): KernelPorts {
    const registry = this.#registry;
    return {
      descriptors: registry.capabilityIndex(),
      contracts: registry.contractEnvironment(),
      onEvent,
      policy: {
        authorize(request): EffectAuthorizationDecision {
          const decision = decideEffectAuthorization(request, overrides);
          if (decision.allowed && decision.useDouble && !registry.hasDouble(request.capabilityId)) {
            return {
              allowed: false,
              useDouble: false,
              reason: `Effect class '${request.effect}' requires a registered test double in '${request.mode}' mode and none is registered.`,
              remediation: `Register a test double for capability '${request.capabilityId}' with runtime.registerDouble().`,
            };
          }
          return decision;
        },
      },
      capabilities: {
        async invoke(capabilityId, input, context) {
          const useDouble = context.useDouble;
          const double = useDouble ? registry.getDouble(capabilityId) : undefined;
          const definition = useDouble ? undefined : registry.getCapability(capabilityId);
          const invocationContext = {
            runId: context.runId,
            graphId: context.graphId,
            graphVersion: context.graphVersion,
            nodeId: context.nodeId,
            capabilityId,
            mode: context.mode,
            step: context.step,
            invokedVia: (useDouble ? 'double' : 'real') as 'real' | 'double',
          };
          if (useDouble && double) {
            try {
              return { ok: true as const, value: await double(input, invocationContext) };
            } catch (cause) {
              return {
                ok: false as const,
                error: runtimeError(
                  'VICT_RUNTIME_CAPABILITY_THREW',
                  `Test double for '${capabilityId}' threw: ${cause instanceof Error ? cause.message : String(cause)}.`,
                  { capabilityId, nodeId: context.nodeId },
                ),
              };
            }
          }
          if (definition) {
            try {
              return {
                ok: true as const,
                value: await definition.invoke(input, invocationContext),
              };
            } catch (cause) {
              return {
                ok: false as const,
                error: runtimeError(
                  'VICT_RUNTIME_CAPABILITY_THREW',
                  `Capability '${capabilityId}' threw: ${cause instanceof Error ? cause.message : String(cause)}.`,
                  { capabilityId, nodeId: context.nodeId },
                ),
              };
            }
          }
          // Defensive: the policy required a double that vanished, or the
          // capability was unregistered after activation.
          return {
            ok: false as const,
            error: runtimeError(
              'VICT_RUNTIME_CAPABILITY_MISSING',
              `No ${useDouble ? 'test double' : 'implementation'} available for capability '${capabilityId}'.`,
              { capabilityId, nodeId: context.nodeId },
            ),
          };
        },
      },
    };
  }

  #recordRun(output: KernelRunOutput, mode: ExecutionMode): void {
    const first = output.events[0];
    const last = output.events.at(-1);
    const record: RunRecord = {
      runId: output.runId,
      graphId: output.graphId,
      graphVersion: output.graphVersion,
      mode,
      status: output.status,
      startedAt: first?.timestamp ?? 0,
      durationMs: first && last ? Math.max(0, last.timestamp - first.timestamp) : 0,
      steps: output.steps,
      output: output.output,
      error: output.error,
      trace: output.events,
    };
    this.#repository.record(record);
  }
}

function toRunResult<T>(output: KernelRunOutput): RunResult<T> {
  const result: {
    runId: string;
    graphId: string;
    graphVersion: string;
    status: RunResult<T>['status'];
    output?: T;
    error?: VictError;
    trace: readonly KernelEvent[];
  } = {
    runId: output.runId,
    graphId: output.graphId,
    graphVersion: output.graphVersion,
    status: output.status,
    trace: output.events,
  };
  if (output.output !== undefined) {
    result.output = output.output as T;
  }
  if (output.error !== undefined) {
    result.error = output.error;
  }
  return result;
}

/** Create a runtime instance. Application code should use the `@vict/sdk` facade instead. */
export function createRuntime(options: VictRuntimeOptions = {}): VictRuntime {
  return new VictRuntime(options);
}
