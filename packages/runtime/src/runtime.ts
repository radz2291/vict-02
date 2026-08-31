import { compileGraph, executeGraph } from '@vict/kernel';
import type {
  ApplicationGraphDefinition,
  CapabilityIndex,
  CompiledGraph,
  CompiledNode,
  ContractEnvironment,
  EffectAuthorizationDecision,
  ExecutionMode,
  KernelEvent,
  KernelPorts,
  KernelRunOutput,
} from '@vict/kernel';
import type { Contract, VictError } from '@vict/contracts';
import { CapabilityRegistry } from './registry.js';
import type { FrozenCapabilityBinding } from './registry.js';
import { createInMemoryRunRepository } from './repository.js';
import { decideEffectAuthorization } from './effect-policy.js';
import type { EffectPolicyOverrides } from './effect-policy.js';
import { VictRuntimeError, runtimeError, sanitiseThrownError } from './errors.js';
import type {
  ActiveGraphInfo,
  ActivationResult,
  CapabilityDefinition,
  DoubleInvoke,
  PayloadRetention,
  RunNodeOptions,
  RunOptions,
  RunRecord,
  RunRepository,
  RunResult,
  VictRuntimeOptions,
} from './types.js';

const RETENTION_VALUES: readonly PayloadRetention[] = ['none', 'summary', 'full'];

/**
 * An immutable activation snapshot: the compiled graph plus frozen copies of
 * the execution-relevant capability bindings and the contracts they require.
 *
 * Runs execute against the snapshot — never against the live mutable
 * registry. Registering or mutating capabilities/contracts after activation
 * cannot affect an active graph; an explicit `activate()` call captures the
 * updated registry under a new activation identity when execution-relevant
 * metadata (revisions, effect classes, contracts) changed.
 */
interface ActivationSnapshot {
  readonly graph: CompiledGraph;
  readonly bindings: ReadonlyMap<string, FrozenCapabilityBinding>;
  readonly contracts: ReadonlyMap<string, Contract<unknown>>;
  readonly descriptors: CapabilityIndex;
  readonly contractEnvironment: ContractEnvironment;
}

/**
 * The usable in-process Vict runtime.
 *
 * Composes a capability registry, the active activation snapshot, execution
 * policy, and an in-memory run repository. Contains no ARA-specific logic.
 *
 * Safety model:
 * - Activation is atomic: a failed compile leaves the previous snapshot active.
 * - Runs pin the activation snapshot; in-flight runs cannot observe registry
 *   changes. Every run and event identifies graphId, graphVersion,
 *   capabilitySetVersion and activationVersion.
 * - Test doubles are snapshotted at run start; replacing a double mid-run
 *   affects only later runs. Duplicate `registerDouble` is rejected; use
 *   `replaceDouble`.
 * - Effect policy is enforced before any capability runs (see effect-policy).
 *   Irreversible effects never run their real implementation in simulate or
 *   test modes; in those modes a registered safe double may run, and without
 *   one the operation is blocked.
 * - Run records are retained according to the runtime's `payloadRetention`
 *   (default `'summary'`): complete payloads are stored only under explicit
 *   `'full'` retention. Thrown error messages are never retained.
 */
export class VictRuntime {
  readonly #registry = new CapabilityRegistry();
  readonly #repository: RunRepository;
  readonly #defaultOverrides: EffectPolicyOverrides;
  readonly #defaultMaxSteps: number | undefined;
  readonly #retention: PayloadRetention;
  #active: ActivationSnapshot | undefined;

  constructor(options: VictRuntimeOptions = {}) {
    this.#repository = options.repository ?? createInMemoryRunRepository();
    this.#defaultOverrides = options.policy ?? {};
    this.#defaultMaxSteps = options.maxSteps;
    const retention = options.payloadRetention ?? 'summary';
    if (!RETENTION_VALUES.includes(retention)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_RETENTION',
        `payloadRetention must be one of ${RETENTION_VALUES.map((value) => `'${value}'`).join(', ')}; received ${JSON.stringify(retention)}.`,
      );
    }
    this.#retention = retention;
  }

  registerCapability<I, O>(definition: CapabilityDefinition<I, O>): this {
    this.#registry.registerCapability(definition as CapabilityDefinition);
    return this;
  }

  registerContract(contract: Parameters<CapabilityRegistry['registerContract']>[0]): this {
    this.#registry.registerContract(contract);
    return this;
  }

  /** Register a test double. Duplicate registration is rejected; use `replaceDouble`. */
  registerDouble(capabilityId: string, invoke: DoubleInvoke): this {
    this.#registry.registerDouble(capabilityId, invoke);
    return this;
  }

  /** Explicitly replace an existing test double. Later runs use the replacement; in-flight runs do not. */
  replaceDouble(capabilityId: string, invoke: DoubleInvoke): this {
    this.#registry.replaceDouble(capabilityId, invoke);
    return this;
  }

  /**
   * Compile and activate a graph atomically, capturing an immutable snapshot
   * of the effective capabilities and contracts. On failure the previously
   * active snapshot remains active and a structured rejection is returned.
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
    this.#active = this.#captureSnapshot(result.graph);
    return {
      ok: true,
      graphId: result.graph.id,
      graphVersion: result.graph.graphVersion,
      capabilitySetVersion: result.graph.capabilitySetVersion,
      activationVersion: result.graph.activationVersion,
      nodeCount: result.graph.nodeCount,
    };
  }

  activeGraph(): ActiveGraphInfo | undefined {
    const active = this.#active;
    if (!active) {
      return undefined;
    }
    return {
      id: active.graph.id,
      version: active.graph.graphVersion,
      capabilitySetVersion: active.graph.capabilitySetVersion,
      activationVersion: active.graph.activationVersion,
      entryNodeId: active.graph.entryNodeId,
      nodeCount: active.graph.nodeCount,
    };
  }

  /** Execute the active graph. Persists the run record under the retention policy. */
  async run<T = unknown>(input: unknown, options: RunOptions = {}): Promise<RunResult<T>> {
    const snapshot = this.#requireActive();
    const mode: ExecutionMode = options.mode ?? 'normal';
    const overrides = options.policy ?? this.#defaultOverrides;
    const doubles = this.#registry.snapshotDoubles();
    const output = await executeGraph({
      graph: snapshot.graph,
      input,
      mode,
      maxSteps: options.maxSteps ?? this.#defaultMaxSteps,
      ports: this.#buildPorts(snapshot, doubles, overrides, options.onEvent),
    });
    this.#recordRun(output, mode);
    return toRunResult<T>(output);
  }

  /**
   * Execute a single node of the active graph in isolation (mode forced to
   * `'test'`). The isolated compile resolves against the activation snapshot,
   * so post-activation registry changes cannot affect it. Does not traverse
   * edges, does not change the active graph, and does not write to the run
   * repository. The trace is returned directly.
   */
  async runNode<T = unknown>(
    nodeId: string,
    input: unknown,
    options: RunNodeOptions = {},
  ): Promise<RunResult<T>> {
    const snapshot = this.#requireActive();
    const node = snapshot.graph.getNode(nodeId);
    if (!node) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_UNKNOWN_NODE',
        `Active graph '${snapshot.graph.id}' has no node '${nodeId}'.`,
      );
    }
    const isolatedDefinition: ApplicationGraphDefinition = {
      id: `${snapshot.graph.id}#isolated:${nodeId}`,
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
      capabilities: snapshot.descriptors,
      contracts: snapshot.contractEnvironment,
    });
    if (!isolated.ok) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_UNKNOWN_NODE',
        `Isolated node graph for '${nodeId}' failed to compile: ${isolated.issues.map((issue) => issue.message).join(' ')}`,
      );
    }
    // Isolated tests always run in 'test' mode with no policy overrides.
    // Irreversible effects never run their real implementation here: a
    // registered safe double may run, and without one the node is blocked.
    const doubles = this.#registry.snapshotDoubles();
    const output = await executeGraph({
      graph: isolated.graph,
      input,
      mode: 'test',
      maxSteps: options.maxSteps ?? this.#defaultMaxSteps,
      ports: this.#buildPorts(snapshot, doubles, {}, options.onEvent),
    });
    return toRunResult<T>(output);
  }

  listRuns(): readonly RunRecord[] {
    return this.#repository.list();
  }

  getRun(runId: string): RunRecord | undefined {
    return this.#repository.get(runId);
  }

  #requireActive(): ActivationSnapshot {
    const active = this.#active;
    if (!active) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_NO_ACTIVE_GRAPH',
        'No active graph. Compile and activate a graph with runtime.activate(definition) first.',
      );
    }
    return active;
  }

  /**
   * Capture the immutable snapshot for a freshly compiled graph: frozen
   * copies of the execution-relevant capability bindings and the contracts
   * the graph requires. Deliberately narrow — the snapshot contains only what
   * the activated graph needs, so later registrations are invisible to it.
   */
  #captureSnapshot(graph: CompiledGraph): ActivationSnapshot {
    const bindings = new Map<string, FrozenCapabilityBinding>();
    const contracts = new Map<string, Contract<unknown>>();
    const requireContract = (contractId: string): Contract<unknown> => {
      const contract = this.#registry.getContract(contractId);
      if (!contract) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_UNKNOWN_NODE',
          `Activation snapshot could not resolve contract '${contractId}' required by graph '${graph.id}'.`,
        );
      }
      contracts.set(contractId, contract);
      return contract;
    };
    for (const nodeId of graph.nodeIds) {
      const node: CompiledNode | undefined = graph.getNode(nodeId);
      if (!node) {
        continue;
      }
      const live = this.#registry.getCapability(node.capability);
      if (!live) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_CAPABILITY_MISSING',
          `Activation snapshot could not resolve capability '${node.capability}' required by graph '${graph.id}'.`,
        );
      }
      if (!bindings.has(node.capability)) {
        bindings.set(
          node.capability,
          Object.freeze({
            id: live.id,
            revision: live.revision,
            effect: live.effect,
            invoke: live.invoke,
            inputContractId: live.input?.id,
            inputRevision: live.input?.revision,
            outputContractId: live.output?.id,
            outputRevision: live.output?.revision,
          }),
        );
      }
      if (node.inputContractId !== undefined) {
        requireContract(node.inputContractId);
      }
      if (node.outputContractId !== undefined) {
        requireContract(node.outputContractId);
      }
    }
    const frozenBindings: ReadonlyMap<string, FrozenCapabilityBinding> = new Map(bindings);
    const frozenContracts: ReadonlyMap<string, Contract<unknown>> = new Map(contracts);
    const descriptors: CapabilityIndex = {
      getCapabilityDescriptor: (capabilityId) => {
        const binding = frozenBindings.get(capabilityId);
        if (!binding) {
          return undefined;
        }
        return {
          id: binding.id,
          revision: binding.revision,
          effect: binding.effect,
          inputContractId: binding.inputContractId,
          inputRevision: binding.inputRevision,
          outputContractId: binding.outputContractId,
          outputRevision: binding.outputRevision,
        };
      },
    };
    const contractEnvironment: ContractEnvironment = {
      has: (contractId) => frozenContracts.has(contractId),
      isCompatible: (from, to) => from === undefined || to === undefined || from === to,
      get: (contractId) => frozenContracts.get(contractId),
    };
    return Object.freeze({
      graph,
      bindings: frozenBindings,
      contracts: frozenContracts,
      descriptors,
      contractEnvironment,
    });
  }

  #buildPorts(
    snapshot: ActivationSnapshot,
    doubles: ReadonlyMap<string, DoubleInvoke>,
    overrides: EffectPolicyOverrides,
    onEvent: ((event: KernelEvent) => void) | undefined,
  ): KernelPorts {
    const bindings = snapshot.bindings;
    const contracts = snapshot.contractEnvironment;
    return {
      descriptors: snapshot.descriptors,
      contracts,
      onEvent,
      policy: {
        authorize(request): EffectAuthorizationDecision {
          const decision = decideEffectAuthorization(request, overrides);
          if (decision.allowed && decision.useDouble && !doubles.has(request.capabilityId)) {
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
          const double = useDouble ? doubles.get(capabilityId) : undefined;
          const binding = useDouble ? undefined : bindings.get(capabilityId);
          const invocationContext = {
            runId: context.runId,
            graphId: context.graphId,
            graphVersion: context.graphVersion,
            capabilitySetVersion: context.capabilitySetVersion,
            activationVersion: context.activationVersion,
            nodeId: context.nodeId,
            capabilityId,
            mode: context.mode,
            step: context.step,
            invokedVia: (useDouble ? 'double' : 'real') as 'real' | 'double',
          };
          // Thrown messages are untrusted content: they are never copied into
          // the structured error, only a safe type name and a correlation id.
          const failureFor = (target: string): { ok: false; error: VictError } => {
            return {
              ok: false,
              error: runtimeError(
                'VICT_RUNTIME_CAPABILITY_MISSING',
                `No ${target} available for capability '${capabilityId}' in the pinned activation snapshot.`,
                { capabilityId, nodeId: context.nodeId },
              ),
            };
          };
          if (useDouble) {
            if (!double) {
              return failureFor('test double');
            }
            try {
              return { ok: true as const, value: await double(input, invocationContext) };
            } catch (cause) {
              const sanitised = sanitiseThrownError(cause);
              return {
                ok: false as const,
                error: runtimeError(
                  'VICT_RUNTIME_CAPABILITY_THREW',
                  `Test double for '${capabilityId}' threw during invocation; the thrown message is not retained.`,
                  {
                    capabilityId,
                    nodeId: context.nodeId,
                    invokedVia: 'double',
                    ...sanitised,
                  },
                ),
              };
            }
          }
          if (binding) {
            try {
              return {
                ok: true as const,
                value: await binding.invoke(input, invocationContext),
              };
            } catch (cause) {
              const sanitised = sanitiseThrownError(cause);
              return {
                ok: false as const,
                error: runtimeError(
                  'VICT_RUNTIME_CAPABILITY_THREW',
                  `Capability '${capabilityId}' threw during invocation; the thrown message is not retained.`,
                  {
                    capabilityId,
                    nodeId: context.nodeId,
                    invokedVia: 'real',
                    ...sanitised,
                  },
                ),
              };
            }
          }
          return failureFor('implementation');
        },
      },
    };
  }

  #recordRun(output: KernelRunOutput, mode: ExecutionMode): void {
    const first = output.events[0];
    const last = output.events.at(-1);
    const completed = output.events.find((event) => event.type === 'run.completed');
    const record: RunRecord = {
      runId: output.runId,
      graphId: output.graphId,
      graphVersion: output.graphVersion,
      capabilitySetVersion: output.capabilitySetVersion,
      activationVersion: output.activationVersion,
      mode,
      status: output.status,
      startedAt: first?.timestamp ?? 0,
      durationMs: first && last ? Math.max(0, last.timestamp - first.timestamp) : 0,
      steps: output.steps,
      retention: this.#retention,
      error: output.error,
      trace: output.events,
      // Safe summary retained under 'summary' and 'full'; complete payload only under 'full'.
      ...(this.#retention !== 'none' && completed?.type === 'run.completed'
        ? { outputSummary: completed.output }
        : {}),
      ...(this.#retention === 'full' && output.output !== undefined
        ? { output: output.output }
        : {}),
    };
    this.#repository.record(record);
  }
}

function toRunResult<T>(output: KernelRunOutput): RunResult<T> {
  const result: {
    runId: string;
    graphId: string;
    graphVersion: string;
    capabilitySetVersion: string;
    activationVersion: string;
    status: RunResult<T>['status'];
    output?: T;
    error?: VictError;
    trace: readonly KernelEvent[];
  } = {
    runId: output.runId,
    graphId: output.graphId,
    graphVersion: output.graphVersion,
    capabilitySetVersion: output.capabilitySetVersion,
    activationVersion: output.activationVersion,
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
