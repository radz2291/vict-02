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
import type { Contract, ContractResult, VictError } from '@vict/contracts';
import { CapabilityRegistry } from './registry.js';
import type { FrozenCapabilityBinding } from './registry.js';
import { decideEffectAuthorization } from './effect-policy.js';
import type { EffectPolicyOverrides } from './effect-policy.js';
import { VictRuntimeError, runtimeError, sanitiseThrownError } from './errors.js';
import { DurableRunTracker } from './durable-run.js';
import { createInMemoryStores } from './in-memory-stores.js';
import { deepFreeze, parseStoredJson, toCanonicalJson } from './serialization.js';
import { VictStoreError } from './store-errors.js';
import { ACTIVATION_MANIFEST_SCHEMA, RUN_EVENT_SCHEMA } from './store-types.js';
import type {
  ActivationManifest,
  ActivationManifestBinding,
  ActivationManifestContract,
  RecoveryResult,
  StoredActivation,
  StoredEvent,
  StoredRun,
  VictStores,
} from './store-types.js';
import type {
  ActivationResult,
  ActiveGraphInfo,
  CapabilityContext,
  CapabilityDefinition,
  DoubleInvoke,
  PayloadRetention,
  RestorationResult,
  RunNodeOptions,
  RunOptions,
  RunRecord,
  RunResult,
  VictRuntimeOptions,
} from './types.js';

const RETENTION_VALUES: readonly PayloadRetention[] = ['none', 'summary', 'full'];

const RECOVERY_CODE = 'VICT_RUN_INTERRUPTED_BY_RESTART';
const RECOVERY_REASON =
  'The process executing this run ended before the run reached a terminal state.';
const RECOVERY_REMEDIATION =
  'Automatic resume is unavailable at this stage. Inspect the run and its events, then start a deliberate new run; the new run receives a new run id.';

export { RECOVERY_CODE, RECOVERY_REASON, RECOVERY_REMEDIATION };

/**
 * A contract captured by value at activation: immutable metadata plus the
 * effective parse callable (bound at capture time). Swapping `parse` on the
 * caller-owned contract object afterwards cannot change what this binding
 * executes. It cannot detect mutated closure state inside the original
 * parse function — explicit revision discipline remains the accepted
 * author/build trust boundary.
 */
interface FrozenContractBinding {
  readonly id: string;
  readonly revision: string;
  readonly expected: string;
  readonly parse: (input: unknown) => ContractResult<unknown>;
}

/**
 * An immutable activation snapshot: the compiled graph plus frozen copies of
 * the execution-relevant capability bindings and captured contract parsing
 * handles.
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
  readonly contracts: ReadonlyMap<string, FrozenContractBinding>;
  readonly descriptors: CapabilityIndex;
  readonly contractEnvironment: ContractEnvironment;
}

/**
 * The usable in-process Vict runtime.
 *
 * Composes a capability registry, the active activation snapshot, execution
 * policy, and durable semantic stores (activation catalog + execution
 * store). Contains no ARA-specific logic.
 *
 * Safety model:
 * - Activation is atomic from the caller's perspective: the candidate is
 *   compiled, snapshotted, and published/selected in the catalog BEFORE the
 *   in-memory snapshot is replaced. A failed compile or storage write leaves
 *   the previously active graph selected and runnable.
 * - Activation manifests are immutable and durable; every run pins exactly
 *   one activationVersion (RUN-001), persisted with the run.
 * - Runs execute against the pinned snapshot; in-flight runs cannot observe
 *   registry changes. Every run transition and its events are committed
 *   atomically (DATA-003) with optimistic concurrency.
 * - Test doubles are snapshotted at run start; replacing a double mid-run
 *   affects only later runs. Duplicate `registerDouble` is rejected; use
 *   `replaceDouble`.
 * - Effect policy is enforced before any capability runs (see effect-policy).
 *   Irreversible effects never run their real implementation in simulate or
 *   test modes; in those modes a registered safe double may run, and without
 *   one the operation is blocked.
 * - Run records are retained according to the runtime's `payloadRetention`
 *   (default `'summary'`): complete payloads are stored only under explicit
 *   `'full'` retention — which transfers responsibility for the persisted
 *   content to the caller/operator. Thrown error messages are never stored.
 */
export class VictRuntime {
  readonly #registry = new CapabilityRegistry();
  readonly #stores: VictStores;
  readonly #clock: { now(): number };
  readonly #ids: { runId(): string; errorId?(): string };
  readonly #defaultOverrides: EffectPolicyOverrides;
  readonly #defaultMaxSteps: number | undefined;
  readonly #retention: PayloadRetention;
  #active: ActivationSnapshot | undefined;

  constructor(options: VictRuntimeOptions = {}) {
    const retention = options.payloadRetention ?? 'summary';
    if (!RETENTION_VALUES.includes(retention)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_RETENTION',
        `payloadRetention must be one of ${RETENTION_VALUES.map((value) => `'${value}'`).join(', ')}; received ${JSON.stringify(retention)}.`,
      );
    }
    this.#retention = retention;
    if (options.stores !== undefined) {
      const stores: VictStores = options.stores;
      if (
        typeof stores.catalog?.publish !== 'function' ||
        typeof stores.execution?.createRun !== 'function'
      ) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_INVALID_STORES',
          'stores must provide conforming `catalog` (ActivationCatalog) and `execution` (ExecutionStore) ports.',
        );
      }
      this.#stores = stores;
    } else {
      this.#stores = createInMemoryStores();
    }
    this.#clock = options.clock ?? { now: (): number => Date.now() };
    this.#ids = options.ids ?? {
      runId: (): string => `run_${globalThis.crypto.randomUUID()}`,
    };
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
   * Compile and activate a graph atomically from the caller's perspective:
   *
   * 1. compile and resolve the candidate completely;
   * 2. snapshot capability and captured contract parsing semantics;
   * 3. build and validate the serializable manifest;
   * 4. publish and select it in the durable catalog (one transaction);
   * 5. only then replace the active in-memory snapshot.
   *
   * A compile failure returns a structured rejection; a storage failure
   * throws a structured store error. In both cases the previously active
   * graph remains selected and runnable, and durable state never claims an
   * activation the catalog did not select.
   */
  async activate(definition: ApplicationGraphDefinition): Promise<ActivationResult> {
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
    const snapshot = this.#captureSnapshot(result.graph);
    const manifest = this.#buildManifest(result.graph);
    const canonicalManifest = toCanonicalJson(manifest);
    await this.#stores.catalog.publishAndSelect({
      publish: { manifest, canonicalManifest },
      select: { graphId: result.graph.id },
    });
    this.#active = snapshot;
    return {
      ok: true,
      graphId: result.graph.id,
      graphVersion: result.graph.graphVersion,
      capabilitySetVersion: result.graph.capabilitySetVersion,
      activationVersion: result.graph.activationVersion,
      nodeCount: result.graph.nodeCount,
    };
  }

  /**
   * Restore the exact durable activation for a graph definition.
   *
   * The current registered code (capabilities and contracts) must reproduce
   * the stored activation exactly: the definition is recompiled against the
   * live registry, all three version identities are recomputed, and the
   * rebuilt canonical manifest is compared with the stored one. On an exact
   * match the activation becomes the active in-memory snapshot. On any
   * mismatch the stored manifest is preserved, the currently active graph is
   * left unchanged, no capability is executed, and no “closest” revision is
   * chosen.
   *
   * By default the activation currently selected for `definition.id` is
   * restored; pass `activationVersion` to restore a specific one.
   */
  async restoreActivation(
    definition: ApplicationGraphDefinition,
    options: { activationVersion?: string } = {},
  ): Promise<RestorationResult> {
    let stored: StoredActivation | undefined;
    if (options.activationVersion !== undefined) {
      stored = await this.#stores.catalog.get(options.activationVersion);
      if (!stored) {
        return {
          ok: false,
          code: 'VICT_RUNTIME_ACTIVATION_NOT_FOUND',
          message: `No stored activation '${options.activationVersion}' exists in the catalog.`,
          expectedActivationVersion: options.activationVersion,
        };
      }
    } else {
      stored = await this.#stores.catalog.getSelected(definition.id);
      if (!stored) {
        return {
          ok: false,
          code: 'VICT_RUNTIME_ACTIVATION_NOT_FOUND',
          message: `No activation is selected for graph '${definition.id}' in the catalog.`,
        };
      }
    }
    let manifest: ActivationManifest;
    try {
      manifest = parseManifest(stored);
    } catch {
      return {
        ok: false,
        code: 'VICT_RUNTIME_ACTIVATION_UNAVAILABLE',
        message: 'The stored activation manifest is corrupt and cannot be read.',
        expectedActivationVersion: stored.activationVersion,
      };
    }
    const compiled = compileGraph({
      definition,
      capabilities: this.#registry.capabilityIndex(),
      contracts: this.#registry.contractEnvironment(),
    });
    if (!compiled.ok) {
      return {
        ok: false,
        code: 'VICT_RUNTIME_ACTIVATION_UNAVAILABLE',
        message:
          'The current registered code cannot compile the graph; required capabilities or contracts are missing or invalid.',
        expectedActivationVersion: stored.activationVersion,
        issues: compiled.issues,
      };
    }
    const rebuilt = this.#buildManifest(compiled.graph);
    const rebuiltCanonical = toCanonicalJson(rebuilt);
    if (
      rebuilt.activationVersion !== stored.activationVersion ||
      rebuiltCanonical !== stored.canonicalManifest
    ) {
      return {
        ok: false,
        code: 'VICT_RUNTIME_ACTIVATION_MISMATCH',
        message:
          'The current registered code does not reproduce the stored activation. No capability was executed and the active graph is unchanged.',
        expectedActivationVersion: stored.activationVersion,
        actualActivationVersion: rebuilt.activationVersion,
        differences: describeManifestDifferences(manifest, rebuilt),
      };
    }
    const snapshot = this.#captureSnapshot(compiled.graph);
    this.#active = snapshot;
    return {
      ok: true,
      graphId: compiled.graph.id,
      graphVersion: compiled.graph.graphVersion,
      capabilitySetVersion: compiled.graph.capabilitySetVersion,
      activationVersion: compiled.graph.activationVersion,
      nodeCount: compiled.graph.nodeCount,
    };
  }

  /**
   * Explicit boot-time recovery (single local owner). Finds runs left in a
   * nonterminal running state by a previous process, atomically transitions
   * each to `blocked`, and appends one safe interruption event. Never
   * invokes or replays a capability. Repeated recovery is idempotent.
   */
  async recoverInterruptedRuns(): Promise<RecoveryResult> {
    return this.#stores.execution.recoverInterruptedRuns({
      code: RECOVERY_CODE,
      reason: RECOVERY_REASON,
      remediation: RECOVERY_REMEDIATION,
      timestamp: this.#clock.now(),
    });
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

  /**
   * Execute the active graph sequentially. Run transitions and events are
   * committed to the execution store atomically as the run progresses; when
   * `run()` resolves, the terminal record is durable.
   */
  async run<T = unknown>(input: unknown, options: RunOptions = {}): Promise<RunResult<T>> {
    const snapshot = this.#requireActive();
    const mode: ExecutionMode = options.mode ?? 'normal';
    const overrides = options.policy ?? this.#defaultOverrides;
    const doubles = this.#registry.snapshotDoubles();
    const runId = this.#ids.runId();
    const tracker = new DurableRunTracker(this.#stores.execution, {
      runId,
      graphId: snapshot.graph.id,
      graphVersion: snapshot.graph.graphVersion,
      capabilitySetVersion: snapshot.graph.capabilitySetVersion,
      activationVersion: snapshot.graph.activationVersion,
      mode,
      retention: this.#retention,
      entryNodeId: snapshot.graph.entryNodeId,
    });
    const onEvent = (event: KernelEvent): void => {
      tracker.onEvent(event);
      options.onEvent?.(event);
    };
    let output: KernelRunOutput;
    try {
      output = await executeGraph({
        graph: snapshot.graph,
        input,
        mode,
        maxSteps: options.maxSteps ?? this.#defaultMaxSteps,
        ports: this.#buildPorts(snapshot, doubles, overrides, onEvent, runId),
      });
    } catch (error) {
      // Kernel execution failed (e.g. a storage fail-fast): settle the
      // durable queue, then surface the storage failure or the original error.
      return await tracker.settle(error);
    }
    await tracker.finish(output);
    return toRunResult<T>(output);
  }

  /**
   * Execute a single node of the active graph in isolation (mode forced to
   * `'test'`). The isolated compile resolves against the activation snapshot,
   * so post-activation registry changes cannot affect it. Does not traverse
   * edges, does not change the active graph, and does not write durable run
   * records. The trace is returned directly.
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
      ports: this.#buildPorts(snapshot, doubles, {}, options.onEvent, undefined),
    });
    return toRunResult<T>(output);
  }

  /** All stored runs (assembled views with their traces), oldest first. */
  async listRuns(): Promise<readonly RunRecord[]> {
    const runs = await this.#stores.execution.listRuns();
    const records: RunRecord[] = [];
    for (const run of runs) {
      records.push(await this.#composeRunRecord(run));
    }
    return deepFreeze(records);
  }

  /** One stored run (assembled view with its trace), or undefined. */
  async getRun(runId: string): Promise<RunRecord | undefined> {
    const run = await this.#stores.execution.getRun(runId);
    if (!run) {
      return undefined;
    }
    return deepFreeze(await this.#composeRunRecord(run));
  }

  async #composeRunRecord(run: StoredRun): Promise<RunRecord> {
    const events = await this.#stores.execution.listEvents(run.runId);
    const trace = events.map((event) => storedEventToKernelEvent(event));
    const first = trace[0];
    const last = trace.at(-1);
    const record: RunRecord = {
      runId: run.runId,
      graphId: run.graphId,
      graphVersion: run.graphVersion,
      capabilitySetVersion: run.capabilitySetVersion,
      activationVersion: run.activationVersion,
      mode: run.mode,
      status: run.status,
      startedAt: first?.timestamp ?? run.createdAt,
      durationMs: first && last ? Math.max(0, last.timestamp - first.timestamp) : 0,
      steps: run.steps,
      retention: run.retention,
      currentNodeId: run.currentNodeId,
      recordRevision: run.recordRevision,
      trace,
      ...(run.outputSummary !== undefined ? { outputSummary: run.outputSummary } : {}),
      ...(run.output !== undefined ? { output: run.output } : {}),
      ...(run.error !== undefined ? { error: run.error } : {}),
    };
    return record;
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
   * copies of the execution-relevant capability bindings and captured
   * (bound) contract parsing handles the graph requires. Deliberately
   * narrow — the snapshot contains only what the activated graph needs, so
   * later registrations are invisible to it.
   */
  #captureSnapshot(graph: CompiledGraph): ActivationSnapshot {
    const bindings = new Map<string, FrozenCapabilityBinding>();
    const contracts = new Map<string, FrozenContractBinding>();
    const requireContract = (contractId: string): FrozenContractBinding => {
      const existing = contracts.get(contractId);
      if (existing) {
        return existing;
      }
      const live = this.#registry.getContract(contractId);
      if (!live) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_UNKNOWN_NODE',
          `Activation snapshot could not resolve contract '${contractId}' required by graph '${graph.id}'.`,
        );
      }
      // Capture the parse callable BY VALUE (bound now): replacing
      // `contract.parse` on the caller-owned object later cannot change what
      // this activation executes.
      const captured: FrozenContractBinding = {
        id: live.id,
        revision: live.revision,
        expected: live.expected,
        parse: live.parse.bind(live),
      };
      contracts.set(contractId, Object.freeze(captured));
      return captured;
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
      if (live.input !== undefined) {
        requireContract(live.input.id);
      }
      if (live.output !== undefined) {
        requireContract(live.output.id);
      }
      if (node.inputContractId !== undefined) {
        requireContract(node.inputContractId);
      }
      if (node.outputContractId !== undefined) {
        requireContract(node.outputContractId);
      }
    }
    const frozenBindings: ReadonlyMap<string, FrozenCapabilityBinding> = new Map(bindings);
    const frozenContracts: ReadonlyMap<string, FrozenContractBinding> = new Map(contracts);
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
      // Hand the kernel a frozen object whose parse is the captured callable.
      get: (contractId) => {
        const captured = frozenContracts.get(contractId);
        if (!captured) {
          return undefined;
        }
        const view: Contract<unknown> = Object.freeze({
          id: captured.id,
          revision: captured.revision,
          expected: captured.expected,
          parse: (input: unknown): ContractResult<unknown> => captured.parse(input),
        });
        return view;
      },
    };
    return Object.freeze({
      graph,
      bindings: frozenBindings,
      contracts: frozenContracts,
      descriptors,
      contractEnvironment,
    });
  }

  /**
   * Build the serializable activation manifest for a compiled graph from the
   * current registry. Contains only serializable meaning; canonical form is
   * stable across processes (registration order, timestamps and functions
   * never enter it).
   */
  #buildManifest(graph: CompiledGraph): ActivationManifest {
    const bindings: ActivationManifestBinding[] = [];
    const contractById = new Map<string, ActivationManifestContract>();
    const recordContract = (contractId: string | undefined): void => {
      if (contractId === undefined) {
        return;
      }
      const live = this.#registry.getContract(contractId);
      if (!live) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_UNKNOWN_NODE',
          `Activation manifest could not resolve contract '${contractId}' required by graph '${graph.id}'.`,
        );
      }
      contractById.set(live.id, { id: live.id, revision: live.revision });
    };
    for (const nodeId of graph.nodeIds) {
      const node = graph.getNode(nodeId);
      if (!node) {
        continue;
      }
      const live = this.#registry.getCapability(node.capability);
      if (!live) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_CAPABILITY_MISSING',
          `Activation manifest could not resolve capability '${node.capability}' required by graph '${graph.id}'.`,
        );
      }
      const inputId = node.inputContractId ?? live.input?.id;
      const outputId = node.outputContractId ?? live.output?.id;
      const inputRevision = node.inputContractId
        ? this.#registry.getContract(node.inputContractId)?.revision
        : live.input?.revision;
      const outputRevision = node.outputContractId
        ? this.#registry.getContract(node.outputContractId)?.revision
        : live.output?.revision;
      bindings.push({
        capability: live.id,
        revision: live.revision,
        effect: live.effect,
        input: inputId === undefined ? null : { id: inputId, revision: inputRevision ?? 'unknown' },
        output:
          outputId === undefined ? null : { id: outputId, revision: outputRevision ?? 'unknown' },
      });
      recordContract(live.input?.id);
      recordContract(live.output?.id);
      recordContract(node.inputContractId);
      recordContract(node.outputContractId);
    }
    const dedupedBindings = dedupeCanonical(bindings);
    const contracts = [...contractById.values()].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    return {
      manifestSchema: ACTIVATION_MANIFEST_SCHEMA,
      graphId: graph.id,
      graph: graph.toDefinition(),
      graphVersion: graph.graphVersion,
      capabilitySetVersion: graph.capabilitySetVersion,
      activationVersion: graph.activationVersion,
      bindings: dedupedBindings,
      contracts,
    };
  }

  #buildPorts(
    snapshot: ActivationSnapshot,
    doubles: ReadonlyMap<string, DoubleInvoke>,
    overrides: EffectPolicyOverrides,
    onEvent: ((event: KernelEvent) => void) | undefined,
    runId: string | undefined,
  ): KernelPorts {
    const bindings = snapshot.bindings;
    const contracts = snapshot.contractEnvironment;
    return {
      descriptors: snapshot.descriptors,
      contracts,
      onEvent,
      clock: this.#clock,
      ids: {
        runId: runId !== undefined ? (): string => runId : (): string => this.#ids.runId(),
        errorId: this.#ids.errorId
          ? (): string => this.#ids.errorId?.() ?? `err_${randomId()}`
          : undefined,
      },
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
          const invocationContext: CapabilityContext = {
            runId: context.runId,
            graphId: context.graphId,
            graphVersion: context.graphVersion,
            capabilitySetVersion: context.capabilitySetVersion,
            activationVersion: context.activationVersion,
            nodeId: context.nodeId,
            capabilityId,
            mode: context.mode,
            step: context.step,
            invokedVia: useDouble ? 'double' : 'real',
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
}

function dedupeCanonical<T>(items: readonly T[]): T[] {
  const sorted = [...items].sort((a, b) => {
    const keyA = toCanonicalJson(a);
    const keyB = toCanonicalJson(b);
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
  const deduped: T[] = [];
  let previous: string | undefined;
  for (const item of sorted) {
    const key = toCanonicalJson(item);
    if (key !== previous) {
      deduped.push(item);
      previous = key;
    }
  }
  return deduped;
}

/** Validate a stored activation's manifest against its row before use. */
function parseManifest(stored: StoredActivation): ActivationManifest {
  const parsed = parseStoredJson(stored.canonicalManifest, 'activation manifest') as
    ActivationManifest | null | undefined;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.manifestSchema !== ACTIVATION_MANIFEST_SCHEMA ||
    typeof parsed.activationVersion !== 'string' ||
    typeof parsed.graphId !== 'string' ||
    typeof parsed.graphVersion !== 'string' ||
    typeof parsed.capabilitySetVersion !== 'string' ||
    !Array.isArray(parsed.bindings) ||
    !Array.isArray(parsed.contracts) ||
    typeof parsed.graph !== 'object' ||
    parsed.graph === null
  ) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'The stored activation manifest is not a valid manifest for this schema.',
      { operation: 'catalog.parseManifest', activationVersion: stored.activationVersion },
    );
  }
  if (parsed.activationVersion !== stored.activationVersion) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'The stored activation manifest does not match its record identity.',
      {
        operation: 'catalog.parseManifest',
        activationVersion: stored.activationVersion,
      },
    );
  }
  if (
    parsed.graphId !== stored.graphId ||
    parsed.graphVersion !== stored.graphVersion ||
    parsed.capabilitySetVersion !== stored.capabilitySetVersion
  ) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'The stored activation manifest disagrees with its identity columns.',
      { operation: 'catalog.parseManifest', activationVersion: stored.activationVersion },
    );
  }
  return parsed;
}

/** Safe, structural description of a manifest mismatch (no payload values involved). */
function describeManifestDifferences(
  stored: ActivationManifest,
  rebuilt: ActivationManifest,
): string[] {
  const differences: string[] = [];
  if (stored.graphVersion !== rebuilt.graphVersion) {
    differences.push(
      `graphVersion differs: stored ${stored.graphVersion.slice(0, 18)}…, rebuilt ${rebuilt.graphVersion.slice(0, 18)}… (topology or declaration changed)`,
    );
  }
  if (stored.capabilitySetVersion !== rebuilt.capabilitySetVersion) {
    differences.push(
      'capabilitySetVersion differs (capability revisions, effect classes or contract bindings changed)',
    );
    const storedByCapability = new Map(stored.bindings.map((b) => [b.capability, b]));
    for (const binding of rebuilt.bindings) {
      const expected = storedByCapability.get(binding.capability);
      if (!expected) {
        differences.push(`capability '${binding.capability}' is not part of the stored activation`);
        continue;
      }
      if (expected.revision !== binding.revision) {
        differences.push(
          `capability '${binding.capability}' revision: stored '${expected.revision}', current '${binding.revision}'`,
        );
      }
      if (expected.effect !== binding.effect) {
        differences.push(
          `capability '${binding.capability}' effect: stored '${expected.effect}', current '${binding.effect}'`,
        );
      }
      for (const side of ['input', 'output'] as const) {
        const expectedContract = expected[side];
        const actualContract = binding[side];
        if (
          expectedContract?.id !== actualContract?.id ||
          expectedContract?.revision !== actualContract?.revision
        ) {
          differences.push(
            `capability '${binding.capability}' ${side} contract: stored ${
              expectedContract ? `${expectedContract.id}@${expectedContract.revision}` : 'none'
            }, current ${actualContract ? `${actualContract.id}@${actualContract.revision}` : 'none'}`,
          );
        }
      }
    }
  }
  if (JSON.stringify(stored.graph) !== JSON.stringify(rebuilt.graph)) {
    differences.push('graph declaration differs from the stored activation');
  }
  if (differences.length === 0) {
    differences.push('activationVersion differs for an unclassified reason');
  }
  return differences;
}

/** Validate a stored event row and rebuild the typed kernel event. */
function storedEventToKernelEvent(event: StoredEvent): KernelEvent {
  if (event.eventSchema !== RUN_EVENT_SCHEMA) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored event carries an unsupported event schema version.',
      { operation: 'execution.readEvent', runId: event.runId },
    );
  }
  const parsed = parseStoredJson(event.payload, 'run event') as {
    seq?: unknown;
    type?: unknown;
    runId?: unknown;
    graphId?: unknown;
    graphVersion?: unknown;
    capabilitySetVersion?: unknown;
    activationVersion?: unknown;
    timestamp?: unknown;
  } | null;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.seq !== event.seq ||
    parsed.type !== event.type ||
    parsed.runId !== event.runId ||
    parsed.graphId !== event.graphId ||
    parsed.graphVersion !== event.graphVersion ||
    parsed.capabilitySetVersion !== event.capabilitySetVersion ||
    parsed.activationVersion !== event.activationVersion ||
    typeof parsed.timestamp !== 'number' ||
    !Number.isFinite(parsed.timestamp)
  ) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored event payload disagrees with its columns.',
      { operation: 'execution.readEvent', runId: event.runId },
    );
  }
  return parsed as KernelEvent;
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

function randomId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Create a runtime instance. Application code should use the `@vict/sdk` facade instead. */
export function createRuntime(options: VictRuntimeOptions = {}): VictRuntime {
  return new VictRuntime(options);
}
