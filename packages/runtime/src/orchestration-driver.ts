import type { VictError } from '@vict/contracts';
import {
  summarizeOutput,
  type CompiledGraph,
  type CompiledNode,
  type DecisionResult,
  type ExecutionMode,
  type KernelEvent,
} from '@vict/kernel';
import type {
  AttemptOutcome,
  ClaimedAttempt,
  CompleteAttemptCommand,
  OrchestrationEventInput,
  OrchestrationStore,
  StoredOrchestrationRun,
} from './orchestration-store-types.js';
import { VictRuntimeError, runtimeError } from './errors.js';
import { VictStoreError } from './store-errors.js';
import { decideEffectAuthorization } from './effect-policy.js';
import {
  deriveAttemptId,
  deriveIdempotencyKey,
  deriveInvocationId,
  forkLineageOf,
  joinTokenId,
  resolveBindings,
  resolveGraphForActivation,
  rootTokenId,
  type ResolvedBindings,
} from './orchestration-activation.js';
import { planContinuation, type PlannedCompletion } from './orchestration-plan.js';
import type {
  OrchestrationEngineDeps,
  OrchestrationRunResult,
  OrchestrationTimePort,
} from './orchestration-driver-types.js';
import { ORCHESTRATION_LIMITS } from './orchestration-driver-types.js';

/**
 * Stage 03 durable orchestration driver.
 *
 * The driver owns no orchestration logic that is not derived from durable
 * state and the pinned activation plan: it claims eligible tokens through
 * the semantic store, validates inputs against the pinned contracts,
 * persists attempt intent before every invocation (the store commits
 * `node.started` and the attempt row atomically inside the claim), invokes
 * only through the exact snapshotted capability binding, and feeds results
 * back as guarded atomic transitions. It never resumes a JavaScript call
 * stack; resume reconstructs durable token/attempt/wait state.
 *
 * Concurrency: a bounded local worker pool claims ready tokens up to the
 * configured bound. Deterministic claim order comes from the store
 * (creation instant, then token id). Join results stay deterministic by
 * branch key because the STORE computes the canonical join payload.
 */

interface ResolvedExecution {
  readonly graph: CompiledGraph;
  readonly bindings: ResolvedBindings['bindings'];
  readonly contracts: ResolvedBindings['contracts'];
}

interface EventEnvelopeFields {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly timestamp: number;
}

/** Raw driver-observed outcome before normalization. */
type OutcomeForPlan =
  | { readonly kind: 'completed'; readonly raw: unknown }
  | { readonly kind: 'failed'; readonly error: VictError }
  | { readonly kind: 'timed_out' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'outcome_unknown'; readonly error: VictError };

class TimeoutError extends Error {
  constructor() {
    super('The attempt exceeded its persisted deadline.');
  }
}

function randomId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Extract the decision value from a DecisionResult-shaped output. */
function extractDecisionValue(output: unknown): unknown {
  if (output === null || typeof output !== 'object') {
    return undefined;
  }
  const candidate = output as { route?: unknown; value?: unknown };
  if (typeof candidate.route !== 'string') {
    return undefined;
  }
  return { route: candidate.route, value: candidate.value };
}

function isTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

/**
 * Reduce author-controlled contract issues to structurally safe evidence.
 * A raw `parse()` implementation may place arbitrary strings (custom
 * messages, payload echoes, nested secrets) anywhere in an issue object,
 * so only a bounded, character-restricted `code` and `path` survive into
 * events. Genuine framework issues (`toSafeIssue`) keep their meaning;
 * hostile content cannot leak.
 */
function safeContractIssues(
  issues: readonly { readonly code?: unknown; readonly path?: unknown }[] | undefined,
): { code: string; path: string }[] {
  const safe = (value: unknown, max: number): string => {
    const raw = typeof value === 'string' ? value : '';
    return raw.replace(/[^A-Za-z0-9_.\-\[\]()/]/g, '').slice(0, max);
  };
  return (issues ?? [])
    .slice(0, 10)
    .map((issue) => ({ code: safe(issue.code, 64) || 'invalid', path: safe(issue.path, 120) }));
}

export class OrchestrationDriver {
  readonly #deps: OrchestrationEngineDeps;
  readonly #resolved = new Map<string, Promise<ResolvedExecution>>();
  /** In-process view of each run's completed root output (retention-independent). */
  readonly #completedOutputs = new Map<string, unknown>();

  constructor(deps: OrchestrationEngineDeps) {
    this.#deps = deps;
  }

  get orchestration(): OrchestrationStore {
    return this.#deps.orchestration;
  }

  get deps(): OrchestrationEngineDeps {
    return this.#deps;
  }

  time(): OrchestrationTimePort {
    return (
      this.#deps.time ?? {
        now: (): number => this.#deps.clock.now(),
        delay: (ms: number): Promise<void> =>
          new Promise((resolve) => setTimeout(resolve, Math.max(0, ms))),
      }
    );
  }

  /** Resolve (and cache) the exact executable meaning of one activation. */
  #resolveExecution(activationVersion: string): Promise<ResolvedExecution> {
    const cached = this.#resolved.get(activationVersion);
    if (cached) {
      return cached;
    }
    const deps = {
      catalog: { get: this.#deps.catalog.get },
      registry: this.#deps.registry,
    } as unknown as Parameters<typeof resolveGraphForActivation>[0];
    const resolution = (async (): Promise<ResolvedExecution> => {
      const graph = await resolveGraphForActivation(deps, activationVersion);
      if (!graph.ok || graph.graph === undefined) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_ACTIVATION_UNAVAILABLE',
          `${graph.message ?? 'Activation unavailable.'} [${(graph.issues ?? []).map((issue) => issue.code).join(',') || 'none'}]`,
        );
      }
      const bindings = await resolveBindings(deps, activationVersion);
      if (!bindings.ok || bindings.bindings === undefined || bindings.contracts === undefined) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_ACTIVATION_UNAVAILABLE',
          bindings.message ?? 'Bindings unavailable.',
        );
      }
      return { graph: graph.graph, bindings: bindings.bindings, contracts: bindings.contracts };
    })();
    // Cache only successful resolutions; failures are retried later.
    this.#resolved.set(activationVersion, resolution);
    resolution.catch(() => this.#resolved.delete(activationVersion));
    return resolution;
  }

  #eventEnvelope(activationVersion: string): Promise<{
    graphId: string;
    graphVersion: string;
    capabilitySetVersion: string;
    activationVersion: string;
  }> {
    return this.#resolveExecution(activationVersion).then((resolved) => ({
      graphId: resolved.graph.id,
      graphVersion: resolved.graph.graphVersion,
      capabilitySetVersion: resolved.graph.capabilitySetVersion,
      activationVersion: resolved.graph.activationVersion,
    }));
  }

  /** Root token id helper for the facade. */
  static rootTokenId(runId: string): string {
    return rootTokenId(runId);
  }

  /** @internal Facade accessor: resolve the exact compiled graph for an activation. */
  async resolveGraphForDriver(activationVersion: string): Promise<CompiledGraph> {
    const resolved = await this.#resolveExecution(activationVersion);
    return resolved.graph;
  }

  /** @internal Facade accessor: resolve the exact pinned bindings. */
  async resolveBindingsForDriver(activationVersion: string): Promise<ResolvedBindings> {
    await this.#resolveExecution(activationVersion);
    const bindings = await resolveBindings(
      { catalog: { get: this.#deps.catalog.get }, registry: this.#deps.registry },
      activationVersion,
    );
    if (!bindings.ok || bindings.bindings === undefined || bindings.contracts === undefined) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_ACTIVATION_UNAVAILABLE',
        bindings.message ?? 'Bindings unavailable.',
      );
    }
    return { bindings: bindings.bindings, contracts: bindings.contracts };
  }

  /** Public re-exports for facade wiring. */
  static resolveGraph = resolveGraphForActivation;
  static resolveBindingsFn = resolveBindings;

  /**
   * Start one orchestration run and drive it until terminal or quiescent.
   */
  async startRun<T>(
    graph: import('@vict/kernel').CompiledGraph,
    input: unknown,
    mode: import('@vict/kernel').ExecutionMode,
    runId: string,
    options: { concurrency?: number; onEvent?: (event: KernelEvent) => void } = {},
  ): Promise<import('./orchestration-driver-types.js').OrchestrationRunResult<T>> {
    const now = this.#deps.clock.now();
    const events: OrchestrationEventInput[] = [
      {
        type: 'run.started',
        runId,
        graphId: graph.id,
        graphVersion: graph.graphVersion,
        capabilitySetVersion: graph.capabilitySetVersion,
        activationVersion: graph.activationVersion,
        timestamp: now,
      },
    ];
    await this.#deps.orchestration.createOrchestrationRun({
      runId,
      graphId: graph.id,
      graphVersion: graph.graphVersion,
      capabilitySetVersion: graph.capabilitySetVersion,
      activationVersion: graph.activationVersion,
      mode,
      retention: this.#deps.retention,
      rootTokenId: rootTokenId(runId),
      entryNodeId: graph.entryNodeId,
      checkpoint: input,
      events,
      now,
    });
    return this.#drive<T>(runId, mode, options);
  }

  /**
   * Drive an existing run to terminal/quiescent against its EXACT pinned
   * activation. A newer selected activation never affects this run.
   */
  async resumeRun<T>(
    runId: string,
    options: { concurrency?: number; onEvent?: (event: KernelEvent) => void } = {},
  ): Promise<import('./orchestration-driver-types.js').OrchestrationRunResult<T>> {
    const stored = await this.#deps.orchestration.getOrchestrationRun(runId);
    if (!stored) {
      throw new VictRuntimeError('VICT_RUN_NOT_FOUND', `No orchestration run '${runId}' exists.`);
    }
    if (isTerminalStatus(stored.status)) {
      return resultFromRun<T>(stored, this.#deps.orchestration);
    }
    return this.#drive<T>(runId, stored.mode, options);
  }

  async #result<T>(
    runId: string,
  ): Promise<import('./orchestration-driver-types.js').OrchestrationRunResult<T>> {
    const run = await this.#deps.orchestration.getOrchestrationRun(runId);
    if (!run) {
      throw new VictRuntimeError('VICT_RUN_NOT_FOUND', `No orchestration run '${runId}' exists.`);
    }
    return resultFromRun<T>(run, this.#deps.orchestration, this.#completedOutputs);
  }

  /**
   * The bounded worker loop: claim ready work, execute it concurrently, and
   * feed every result back as a guarded atomic transition until the run is
   * terminal or quiescent.
   */
  async #drive<T>(
    runId: string,
    mode: import('@vict/kernel').ExecutionMode,
    options: { concurrency?: number; onEvent?: (event: KernelEvent) => void } = {},
  ): Promise<import('./orchestration-driver-types.js').OrchestrationRunResult<T>> {
    const run = await this.#deps.orchestration.getOrchestrationRun(runId);
    if (!run) {
      throw new VictRuntimeError('VICT_RUN_NOT_FOUND', `No orchestration run '${runId}' exists.`);
    }
    const resolved = await this.#resolveExecution(run.activationVersion);
    const concurrency = Math.min(
      Math.max(1, options.concurrency ?? ORCHESTRATION_LIMITS.defaultConcurrency),
      ORCHESTRATION_LIMITS.maxConcurrency,
    );
    const inFlight = new Set<Promise<void>>();
    let cancelledWhileDriving = false;
    for (;;) {
      while (inFlight.size < concurrency) {
        const claim = await this.#deps.orchestration.claimReadyToken({
          runId,
          ownerId: this.#deps.ownerId,
          leaseExpiresAt: this.#deps.clock.now() + (this.#deps.leaseMs ?? DEFAULT_LEASE_MS),
          now: this.#deps.clock.now(),
          planner: {
            invocationIdFor: (token) =>
              deriveInvocationId({
                runId,
                activationVersion: run.activationVersion,
                lineage: token.lineage,
                nodeId: token.nodeId,
              }),
            attemptIdFor: (token, attemptNumber) =>
              deriveAttemptId(
                deriveInvocationId({
                  runId,
                  activationVersion: run.activationVersion,
                  lineage: token.lineage,
                  nodeId: token.nodeId,
                }),
                attemptNumber,
              ),
            planFor: (token) => {
              const node = resolved.graph.getNode(token.nodeId);
              const binding = node ? resolved.bindings.get(node.capability) : undefined;
              const invocationId = deriveInvocationId({
                runId,
                activationVersion: run.activationVersion,
                lineage: token.lineage,
                nodeId: token.nodeId,
              });
              return {
                capabilityId: node?.capability ?? '',
                effectClass: binding?.effect ?? 'pure',
                deadlineAt:
                  node?.timeoutMs !== undefined ? this.#deps.clock.now() + node.timeoutMs : null,
                idempotencyKey:
                  node?.retry !== undefined
                    ? deriveIdempotencyKey({
                        runId,
                        activationVersion: run.activationVersion,
                        lineage: token.lineage,
                        nodeId: token.nodeId,
                        invocationId,
                      })
                    : null,
              };
            },
          },
        });
        if (!claim.claimed) {
          if (claim.reason === 'cancelled') {
            cancelledWhileDriving = true;
          }
          break;
        }
        const attempt = this.#executeAttempt(resolved, claim.claim, mode, options);
        const wrapped = attempt
          .catch(() => undefined)
          .finally(() => {
            inFlight.delete(wrapped);
          });
        inFlight.add(wrapped);
      }
      if (inFlight.size === 0) {
        break;
      }
      await Promise.race([...inFlight]);
    }
    // Cancellation was requested and no work remains: finalize once.
    const current = await this.#deps.orchestration.getOrchestrationRun(runId);
    if (current && !isTerminalStatus(current.status) && current.cancellation !== null) {
      await this.#deps.orchestration.applyCancellation({
        runId,
        now: this.#deps.clock.now(),
        requestId: current.cancellation.requestId,
        reasonCode: current.cancellation.reasonCode,
        steps: current.steps,
        removeCheckpoints: [],
        events: [
          {
            type: 'run.cancelled',
            requestId: current.cancellation.requestId,
            reasonCode: current.cancellation.reasonCode,
            steps: current.steps,
            runId,
            graphId: resolved.graph.id,
            graphVersion: resolved.graph.graphVersion,
            capabilitySetVersion: resolved.graph.capabilitySetVersion,
            activationVersion: resolved.graph.activationVersion,
            timestamp: this.#deps.clock.now(),
          },
        ],
      });
    }
    return this.#result<T>(runId);
  }

  /**
   * Execute one claimed attempt: validate the pinned checkpoint input,
   * enforce effect policy, race the invocation against the persisted
   * deadline with cooperative abort, and commit the planned continuation.
   * No capability may run unless durable intent committed (guaranteed by
   * the claim transaction) and the claim is current (owner + fence).
   */
  async #executeAttempt(
    resolved: ResolvedExecution,
    claim: ClaimedAttempt,
    mode: import('@vict/kernel').ExecutionMode,
    options: { onEvent?: (event: KernelEvent) => void } = {},
  ): Promise<void> {
    const { graph, bindings, contracts } = resolved;
    const run = (await this.#deps.orchestration.getOrchestrationRun(
      claim.token.runId,
    )) as StoredOrchestrationRun;
    const node = graph.getNode(claim.token.nodeId);
    if (!node) {
      return; // defensive: compiled graphs always resolve their nodes
    }
    const binding = bindings.get(node.capability);
    const now = this.#deps.clock.now();
    const envelope = {
      runId: run.runId,
      graphId: graph.id,
      graphVersion: graph.graphVersion,
      capabilitySetVersion: graph.capabilitySetVersion,
      activationVersion: graph.activationVersion,
      timestamp: now,
    };
    const onEvent = (event: KernelEvent): void => {
      options.onEvent?.(event);
    };

    // ---- Validate the checkpoint input against the node input contract ----
    let inputPayload: unknown = claim.checkpoint;
    if (node.inputContractId !== undefined) {
      const contract = contracts.get(node.inputContractId);
      if (!contract) {
        await this.#completeWithOutcome(
          resolved,
          claim,
          envelope,
          mode,
          {
            kind: 'failed',
            error: {
              code: 'VICT_KERNEL_UNKNOWN_CONTRACT',
              message: `Node '${node.id}' references unknown input contract '${node.inputContractId}'.`,
              retryable: false,
            } as unknown as VictError,
          },
          undefined,
          onEvent,
        );
        return;
      }
      const parsed = contract.parse(inputPayload);
      if (!parsed.ok) {
        const error = {
          code: 'VICT_KERNEL_CONTRACT_REJECTED',
          message: `Input contract '${node.inputContractId}' rejected the value at node '${node.id}'.`,
          retryable: false,
        } as unknown as VictError;
        onEvent({
          type: 'contract.rejected',
          stage: 'input',
          nodeId: node.id,
          capabilityId: node.capability,
          contractId: node.inputContractId,
          issues: safeContractIssues(parsed.issues),
          ...envelope,
          timestamp: this.#deps.clock.now(),
        } as unknown as KernelEvent);
        await this.#completeWithOutcome(
          resolved,
          claim,
          envelope,
          mode,
          { kind: 'failed', error },
          undefined,
          onEvent,
        );
        return;
      }
      inputPayload = parsed.value;
    }

    // ---- Control nodes complete directly (no capability invocation) -----
    if (node.kind === 'wait' || node.kind === 'fork' || node.kind === 'join') {
      if (node.kind === 'wait') {
        // First arrival parks (creates the durable wait); a post-wake
        // execution (the wait is already resolved) advances along the
        // wait's success edge with the resolved payload.
        const snapshot = await this.#deps.orchestration.getOrchestrationSnapshot(run.runId);
        const hasOpenWait = (snapshot?.waits ?? []).some(
          (wait) => wait.tokenId === claim.token.tokenId && wait.status === 'open',
        );
        if (
          hasOpenWait ||
          !(snapshot?.waits ?? []).some(
            (wait) => wait.tokenId === claim.token.tokenId && wait.status === 'resolved',
          )
        ) {
          await this.#completeWithOutcome(
            resolved,
            claim,
            envelope,
            mode,
            { kind: 'completed', raw: inputPayload },
            inputPayload,
            onEvent,
          );
          return;
        }
        // Wake path: the wait is already resolved. Do NOT park again and do
        // NOT force a plain advance — the completion is re-planned so that a
        // success target which is the fork's join routes through the durable
        // branch-arrival boundary (canonical checkpoint, single join-ready
        // token, validated join), exactly like any other branch completion.
        await this.#completeWithOutcome(
          resolved,
          claim,
          envelope,
          mode,
          { kind: 'completed', raw: inputPayload },
          inputPayload,
          onEvent,
          undefined,
          { resolvedWait: true },
        );
        return;
      }
      if (node.kind === 'join') {
        // Durable join boundary: the claimed token carries the private
        // canonical branch-result checkpoint created atomically by the
        // final branch arrival. #completeWithOutcome validates the join's
        // own declared output contract (outside any store transaction)
        // and one atomic transition either advances downstream, completes
        // a terminal join with the validated output, or fails the run
        // with a sanitized contract error. No capability is ever invoked
        // here and no author parser runs inside the persistence adapter.
        await this.#completeWithOutcome(
          resolved,
          claim,
          envelope,
          mode,
          { kind: 'completed', raw: inputPayload },
          inputPayload,
          onEvent,
        );
        return;
      }
      await this.#completeWithOutcome(
        resolved,
        claim,
        envelope,
        mode,
        { kind: 'completed', raw: inputPayload },
        inputPayload,
        onEvent,
      );
      return;
    }

    // ---- Effect policy -------------------------------------------------
    const decision = decideEffectAuthorization(
      { capabilityId: node.capability, effect: binding?.effect ?? 'pure', mode },
      this.#deps.defaultOverrides,
    );
    if (!decision.allowed) {
      const reason =
        decision.reason ??
        `Effect class '${binding?.effect ?? 'pure'}' is not allowed in '${mode}' mode.`;
      const remediation =
        decision.remediation ??
        'Adjust the execution policy or provide an approved implementation.';
      onEvent({
        type: 'effect.blocked',
        nodeId: node.id,
        capabilityId: node.capability,
        effect: binding?.effect ?? 'pure',
        mode,
        reason,
        remediation,
        ...envelope,
        timestamp: this.#deps.clock.now(),
      } as unknown as KernelEvent);
      await this.#completeWithOutcome(
        resolved,
        claim,
        envelope,
        mode,
        {
          kind: 'outcome_unknown',
          error: {
            code: 'VICT_ORCH_EFFECT_BLOCKED',
            message: reason,
            retryable: false,
          } as unknown as VictError,
        },
        undefined,
        onEvent,
      );
      return;
    }
    if (decision.useDouble) {
      // Doubles are a Stage 02 sequential-engine facility; the durable
      // orchestration engine always runs the pinned real binding.
      // (Test doubles for orchestration runs are provided as capabilities.)
    }

    // ---- Cooperative deadline + invocation ------------------------------
    const controller = new AbortController();
    const deadlineAt = claim.deadlineAt;
    const timeoutExceeded = deadlineAt !== null && deadlineAt < now;
    let timedOut = false;
    const deadlinePromise =
      deadlineAt !== null
        ? this.time()
            .delay(Math.max(0, deadlineAt - this.time().now()))
            .then(() => {
              timedOut = true;
              controller.abort();
            })
        : null;
    if (timeoutExceeded) {
      timedOut = true;
    }

    let outcome: OutcomeForPlan;
    try {
      if (timedOut) {
        throw new TimeoutError();
      }
      if (!binding) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_CAPABILITY_MISSING',
          `No implementation available for capability '${node.capability}' in the pinned activation snapshot.`,
        );
      }
      const context: import('./types.js').CapabilityContext = {
        runId: run.runId,
        graphId: graph.id,
        graphVersion: graph.graphVersion,
        capabilitySetVersion: graph.capabilitySetVersion,
        activationVersion: graph.activationVersion,
        nodeId: node.id,
        capabilityId: node.capability,
        mode,
        step: run.steps,
        invokedVia: 'real',
        invocationId: claim.invocationId,
        attemptId: claim.attempt.attemptId,
        attemptNumber: claim.attempt.attemptNumber,
        ...(claim.idempotencyKey !== null ? { idempotencyKey: claim.idempotencyKey } : {}),
        ...(deadlineAt !== null ? { deadlineAt } : {}),
        abortSignal: controller.signal,
        ...(claim.token.forkId !== null
          ? {
              branch: {
                forkId: claim.token.forkId,
                joinId: graph.joinOfFork(claim.token.forkId) ?? '',
                branchKey: claim.token.branchKey ?? '',
                lineage: claim.token.lineage,
              },
            }
          : {}),
      };
      let invocation: { ok: true; value: unknown } | { ok: false; error: VictError };
      // Promise.resolve().then ensures a SYNCHRONOUS throw from the handler
      // is still converted into a capability failure, not a driver failure.
      const invokePromise = Promise.resolve()
        .then(async () => binding.invoke(inputPayload, context))
        .then(
          (value) => ({ ok: true as const, value }),
          (cause: unknown) => ({
            ok: false as const,
            error: runtimeError(
              'VICT_RUNTIME_CAPABILITY_THREW',
              `Capability '${node.capability}' threw during invocation; the thrown message is not retained.`,
              {
                capabilityId: node.capability,
                nodeId: node.id,
                invokedVia: 'real',
                errorName: cause instanceof Error ? cause.name : typeof cause,
                errorId: this.#deps.ids.errorId?.() ?? `err_${randomId()}`,
              },
            ),
          }),
        );
      invocation =
        deadlinePromise === null
          ? await invokePromise
          : await Promise.race([
              invokePromise,
              deadlinePromise.then(() => {
                throw new TimeoutError();
              }),
            ]);
      if (invocation.ok) {
        outcome = { kind: 'completed' as const, raw: invocation.value };
      } else {
        outcome = { kind: 'failed' as const, error: invocation.error };
      }
    } catch (cause) {
      if (cause instanceof TimeoutError || timedOut) {
        outcome = { kind: 'timed_out' as const };
      } else {
        outcome = {
          kind: 'failed' as const,
          error: runtimeError(
            'VICT_RUNTIME_STORE_FAILURE',
            'The durable orchestration driver failed outside the capability invocation; the thrown message is not retained.',
            {
              errorName: cause instanceof Error ? cause.name : typeof cause,
              ...(cause instanceof VictStoreError ? { causeCode: cause.code } : {}),
              phase: 'completeWithOutcome',
            },
          ),
        };
      }
    }
    void deadlinePromise;

    await this.#completeWithOutcome(
      resolved,
      claim,
      envelope,
      mode,
      outcome,
      inputPayload,
      onEvent,
    );
  }

  /**
   * Plan and commit one completed attempt as one atomic guarded transition:
   * outcome classification, contract validation, retry/timeout/ambiguity
   * policy, events, checkpoints, waits, forks/joins, and run status.
   * Conflicts re-derive from fresh durable state (bounded).
   */
  async #completeWithOutcome(
    resolved: ResolvedExecution,
    claim: ClaimedAttempt,
    envelope: EventEnvelopeFields,
    mode: import('@vict/kernel').ExecutionMode,
    rawOutcome: OutcomeForPlan,
    inputPayload: unknown,
    onEvent?: (event: KernelEvent) => void,
    forcedContinuation?: import('./orchestration-store-types.js').AttemptContinuation,
    planning?: { readonly resolvedWait?: boolean },
  ): Promise<void> {
    const { graph, bindings, contracts } = resolved;
    const node = graph.getNode(claim.token.nodeId);
    if (!node) {
      return;
    }
    const binding = bindings.get(node.capability);
    // ---- Normalize the outcome and validate output contracts ----------
    let outcome: AttemptOutcome =
      rawOutcome.kind === 'completed'
        ? { kind: 'completed', outputSummary: { shape: 'undefined' } }
        : rawOutcome;
    let validatedOutput: unknown = undefined;
    let decisionResult: DecisionResult | undefined;
    if (rawOutcome.kind === 'completed') {
      validatedOutput = rawOutcome.raw;
      if (node.outputContractId !== undefined) {
        const contract = contracts.get(node.outputContractId);
        if (!contract) {
          outcome = {
            kind: 'failed',
            error: {
              code: 'VICT_KERNEL_UNKNOWN_CONTRACT',
              message: `Node '${node.id}' references unknown output contract '${node.outputContractId}'.`,
              retryable: false,
            } as unknown as VictError,
          };
          validatedOutput = undefined;
        } else {
          // Decision nodes validate the decision VALUE against the contract.
          const candidate =
            node.kind === 'decision' ? extractDecisionValue(validatedOutput) : validatedOutput;
          if (candidate === undefined) {
            outcome = {
              kind: 'failed',
              error: {
                code: 'VICT_KERNEL_CONTRACT_REJECTED',
                message: `A decision node must return a validated DecisionResult with a route and a value.`,
                retryable: false,
              } as unknown as VictError,
            };
          } else {
            const parsed = contract.parse(candidate);
            if (!parsed.ok) {
              onEvent?.({
                type: 'contract.rejected',
                stage: 'output',
                nodeId: node.id,
                capabilityId: node.capability,
                contractId: node.outputContractId,
                issues: safeContractIssues(parsed.issues),
                ...envelope,
                timestamp: this.#deps.clock.now(),
              } as unknown as KernelEvent);
              outcome = {
                kind: 'failed',
                error: {
                  code: 'VICT_KERNEL_CONTRACT_REJECTED',
                  message: `Output contract '${node.outputContractId}' rejected the value at node '${node.id}'.`,
                  retryable: false,
                } as unknown as VictError,
              };
              validatedOutput = undefined;
            } else {
              validatedOutput = node.kind === 'decision' ? rawOutcome.raw : parsed.value;
            }
          }
        }
      }
      if (outcome.kind === 'completed') {
        if (node.kind === 'decision') {
          const candidate = validatedOutput as DecisionResult | undefined;
          if (!candidate || typeof candidate !== 'object' || typeof candidate.route !== 'string') {
            outcome = {
              kind: 'failed',
              error: {
                code: 'VICT_ORCH_INVALID_TRANSITION',
                message: `Decision node '${node.id}' must return a validated DecisionResult.`,
                retryable: false,
              } as unknown as VictError,
            };
          } else {
            decisionResult = candidate;
          }
        }
      }
    }
    if (outcome.kind === 'completed') {
      outcome = {
        kind: 'completed',
        outputSummary: summarizeOutput(validatedOutput),
      };
    }

    // ---- Plan + commit (re-derive on store conflicts) -------------------
    const attemptOutcome: AttemptOutcome = outcome;
    let conflictRetries = 0;
    for (;;) {
      const plan = planContinuation({
        graph,
        claim,
        now: this.#deps.clock.now(),
        outcome: attemptOutcome,
        error: attemptOutcome.kind === 'failed' ? attemptOutcome.error : undefined,
        validatedOutput:
          attemptOutcome.kind === 'completed'
            ? node.kind === 'decision'
              ? decisionResult
              : validatedOutput
            : undefined,
        descriptor: binding,
        ...(planning?.resolvedWait === true ? { resolvedWait: true } : {}),
      });
      const effectivePlan: PlannedCompletion =
        forcedContinuation !== undefined
          ? { kind: 'transition', continuation: forcedContinuation, runStatus: 'running' }
          : plan;
      if (effectivePlan.kind === 'invalid') {
        // Invalid routing/shape: fail honestly (route along error edge or fail).
        const planError = effectivePlan.error;
        const failurePlan = planContinuation({
          graph,
          claim,
          now: this.#deps.clock.now(),
          outcome: { kind: 'failed', error: planError },
          error: planError,
          descriptor: binding,
        });
        if (failurePlan.kind === 'invalid') {
          throw new VictRuntimeError('VICT_ORCH_INVALID_TRANSITION', failurePlan.error.message);
        }
        const command = this.#buildCommand(
          graph,
          claim,
          envelope,
          failurePlan,
          attemptOutcome,
          validatedOutput,
          bindings,
        );
        await this.#commitCompletion(claim, command, onEvent);
        return;
      }
      if (
        effectivePlan.kind === 'transition' &&
        effectivePlan.runStatus === 'completed' &&
        attemptOutcome.kind === 'completed'
      ) {
        this.#completedOutputs.set(claim.token.runId, validatedOutput);
      }
      const command = this.#buildCommand(
        graph,
        claim,
        envelope,
        effectivePlan,
        attemptOutcome,
        validatedOutput,
        bindings,
      );
      try {
        await this.#commitCompletion(claim, command, onEvent);
        return;
      } catch (cause) {
        if (
          cause instanceof VictStoreError &&
          [
            'VICT_STORE_RUN_CONFLICT',
            'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
            'VICT_STORE_TOKEN_CONFLICT',
          ].includes(cause.code) &&
          conflictRetries < 5
        ) {
          conflictRetries += 1;
          continue; // re-derive from fresh durable state
        }
        throw cause;
      }
    }
  }

  /** Build the full atomic command for one planned completion. */
  #buildCommand(
    graph: CompiledGraph,
    claim: ClaimedAttempt,
    envelope: EventEnvelopeFields,
    plan: Extract<PlannedCompletion, { kind: 'transition' }>,
    attemptOutcome: AttemptOutcome,
    validatedOutput: unknown,
    bindings: ResolvedExecution['bindings'],
  ): CompleteAttemptCommand {
    const node = graph.getNode(claim.token.nodeId) as CompiledNode;
    const events: OrchestrationEventInput[] = [];
    const now = this.#deps.clock.now();
    const push = (event: Record<string, unknown>): void => {
      events.push({ ...event, ...envelope, timestamp: now } as unknown as OrchestrationEventInput);
    };
    const continuation = plan.continuation;
    let checkpoint: { tokenId: string; payload: unknown } | null | undefined;
    let childCheckpoints: { tokenId: string; payload: unknown }[] | undefined;
    let removeCheckpoints: string[] | undefined;
    let declaredBranchKeys: readonly string[] | undefined;
    let branchOutput: unknown;

    // Node-fact events.
    if (attemptOutcome.kind === 'completed') {
      push({
        type: 'node.completed',
        nodeId: node.id,
        capabilityId: node.capability,
        durationMs: Math.max(0, now - envelope.timestamp),
        invokedVia: 'real',
        output: attemptOutcome.outputSummary,
      });
    } else if (attemptOutcome.kind === 'failed') {
      push({
        type: 'node.failed',
        nodeId: node.id,
        capabilityId: node.capability,
        durationMs: Math.max(0, now - envelope.timestamp),
        error: attemptOutcome.error,
      });
    } else if (attemptOutcome.kind === 'timed_out') {
      push({
        type: 'node.timed_out',
        nodeId: node.id,
        capabilityId: node.capability,
        attempt: claim.attempt.attemptNumber,
        deadlineAt: claim.deadlineAt ?? now,
      });
    } else if (attemptOutcome.kind === 'cancelled') {
      push({
        type: 'node.cancelled',
        nodeId: node.id,
        capabilityId: node.capability,
        attempt: claim.attempt.attemptNumber,
      });
    }

    if (continuation.kind === 'advance') {
      checkpoint = { tokenId: claim.token.tokenId, payload: continuation.payload };
    } else if (continuation.kind === 'wait') {
      push({
        type: 'run.waiting',
        nodeId: node.id,
        waitId: continuation.wait.waitId,
        waitKind: continuation.wait.kind,
        ...(continuation.wait.signalName !== null
          ? { signalName: continuation.wait.signalName }
          : {}),
        ...(continuation.wait.dueAt !== null ? { dueAt: continuation.wait.dueAt } : {}),
      });
      if (continuation.wait.dueAt !== null) {
        push({
          type: 'timer.scheduled',
          timerId: `timer_${continuation.wait.waitId}`,
          nodeId: node.id,
          dueAt: continuation.wait.dueAt,
          kind: 'wait',
        });
      }
      if (continuation.wait.timeoutAt !== null) {
        push({
          type: 'timer.scheduled',
          timerId: `timer_timeout_${continuation.wait.waitId}`,
          nodeId: node.id,
          dueAt: continuation.wait.timeoutAt,
          kind: 'wait-timeout',
        });
      }
    } else if (continuation.kind === 'fork') {
      push({
        type: 'fork.created',
        forkId: node.id,
        joinId: continuation.joinId,
        branchKeys: continuation.children.map((child) => child.branchKey),
      });
      childCheckpoints = continuation.children.map((child) => ({
        tokenId: child.tokenId,
        payload: validatedOutput,
      }));
    } else if (continuation.kind === 'branchArrival') {
      push({
        type: 'branch.completed',
        forkId: continuation.forkId,
        joinId: continuation.joinId,
        branchKey: continuation.branchKey,
      });
      removeCheckpoints = [claim.token.tokenId];
      declaredBranchKeys = [...graph.branchKeysOf(continuation.forkId)];
      branchOutput = validatedOutput;
    } else if (continuation.kind === 'retry') {
      push({
        type: 'node.retry_scheduled',
        nodeId: node.id,
        capabilityId: node.capability,
        attempt: claim.attempt.attemptNumber,
        maxAttempts: continuation.maxAttempts,
        dueAt: continuation.dueAt,
        retryOnCode: continuation.retryOnCode,
      });
      push({
        type: 'timer.scheduled',
        timerId: `timer_retry_${claim.attempt.attemptId}`,
        nodeId: node.id,
        dueAt: continuation.dueAt,
        kind: 'retry',
      });
    } else if (continuation.kind === 'block') {
      push({
        type: 'run.blocked',
        steps: claim.attempt.attemptNumber,
        code: continuation.code,
        reason: continuation.reason,
        capabilityId: node.capability,
        effect: bindings.get(node.capability)?.effect,
        remediation: 'Resolve the blocked run through the operator API (runtime.resolveBlocked).',
      });
    }

    // The join.completed fact is committed exactly once, in the same
    // atomic transition that records the VALIDATED join completion and
    // its downstream continuation (or terminal completion). A rejecting
    // join contract never produces it.
    if (node.kind === 'join' && attemptOutcome.kind === 'completed') {
      const forkId = graph.forkOfJoin(node.id) ?? '';
      push({
        type: 'join.completed',
        forkId,
        joinId: node.id,
        branchKeys: [...graph.branchKeysOf(forkId)],
      });
    }

    // Terminal run events.
    const run: {
      status: typeof plan.runStatus;
      output?: unknown;
      outputSummary?: import('@vict/kernel').OutputSummary;
      error?: VictError;
    } = { status: plan.runStatus };
    if (plan.runStatus === 'completed') {
      push({
        type: 'run.completed',
        steps: claim.attempt.attemptNumber,
        output:
          attemptOutcome.kind === 'completed'
            ? attemptOutcome.outputSummary
            : { shape: 'undefined' },
      });
      if (this.#deps.retention === 'full' && validatedOutput !== undefined) {
        run.output = validatedOutput;
        run.outputSummary =
          attemptOutcome.kind === 'completed' ? attemptOutcome.outputSummary : undefined;
      } else if (this.#deps.retention !== 'none' && attemptOutcome.kind === 'completed') {
        run.outputSummary = attemptOutcome.outputSummary;
      }
    } else if (plan.runStatus === 'failed') {
      push({
        type: 'run.failed',
        steps: claim.attempt.attemptNumber,
        error:
          attemptOutcome.kind === 'failed'
            ? attemptOutcome.error
            : ({
                code: 'VICT_ORCH_RUN_FAILED',
                message: 'The run failed.',
                retryable: false,
              } as unknown as VictError),
      });
      if (attemptOutcome.kind === 'failed') {
        run.error = attemptOutcome.error;
      }
    }

    return {
      runId: claim.token.runId,
      attemptId: claim.attempt.attemptId,
      ownerId: claim.attempt.ownerId ?? '',
      expectedAttemptFence: claim.attempt.fence,
      now,
      outcome: attemptOutcome,
      continuation,
      events,
      run,
      ...(checkpoint !== undefined ? { checkpoint } : {}),
      ...(childCheckpoints !== undefined ? { childCheckpoints } : {}),
      ...(removeCheckpoints !== undefined ? { removeCheckpoints } : {}),
      ...(declaredBranchKeys !== undefined ? { declaredBranchKeys } : {}),
      ...(continuation.kind === 'branchArrival' ? { branchOutput } : {}),
    };
  }

  /** Commit one completion; conflicts re-derive (bounded retries upstream). */
  async #commitCompletion(
    claim: ClaimedAttempt,
    command: CompleteAttemptCommand,
    onEvent?: (event: KernelEvent) => void,
  ): Promise<void> {
    await this.#deps.orchestration.completeAttempt(command);
    for (const event of command.events) {
      onEvent?.(event as KernelEvent);
    }
    void claim;
  }
}

const DEFAULT_LEASE_MS = 30_000;

/** Assemble a safe run result (waits expose safe descriptors, never payloads). */
export async function resultFromRun<T>(
  run: import('./orchestration-store-types.js').StoredOrchestrationRun,
  orchestration: OrchestrationStore,
  completedOutputs?: ReadonlyMap<string, unknown>,
): Promise<import('./orchestration-driver-types.js').OrchestrationRunResult<T>> {
  let waits:
    { waitId: string; kind: 'signal' | 'timer'; signalName?: string; dueAt?: number }[] | undefined;
  if (run.status === 'waiting') {
    const openWaits = (await orchestration.listWaits(run.runId)).filter(
      (wait) => wait.status === 'open',
    );
    waits = openWaits.map((wait) => ({
      waitId: wait.waitId,
      kind: wait.kind,
      ...(wait.signalName !== null ? { signalName: wait.signalName } : {}),
      ...(wait.dueAt !== null ? { dueAt: wait.dueAt } : {}),
    }));
  }
  const trace = (await orchestration
    .listOrchestrationEvents(run.runId)
    .catch(() => [])) as readonly import('@vict/kernel').KernelEvent[];
  const result: import('./orchestration-driver-types.js').OrchestrationRunResult<T> = {
    runId: run.runId,
    graphId: run.graphId,
    graphVersion: run.graphVersion,
    capabilitySetVersion: run.capabilitySetVersion,
    activationVersion: run.activationVersion,
    status: run.status as 'completed' | 'failed' | 'cancelled' | 'waiting' | 'blocked',
    steps: run.steps,
    trace,
    ...(waits !== undefined ? { waits } : {}),
  };
  if (run.error !== undefined) {
    return { ...result, error: run.error };
  }
  if (run.status === 'completed') {
    const output = completedOutputs?.get(run.runId) ?? run.output;
    if (output !== undefined) {
      return {
        ...result,
        output,
      } as import('./orchestration-driver-types.js').OrchestrationRunResult<T>;
    }
  }
  return result;
}

/** Inject the in-process completed-output view (used by the driver). */
export function withCompletedOutputs<T>(
  run: import('./orchestration-store-types.js').StoredOrchestrationRun,
  orchestration: OrchestrationStore,
  completedOutputs: ReadonlyMap<string, unknown> | undefined,
): Promise<import('./orchestration-driver-types.js').OrchestrationRunResult<T>> {
  return resultFromRun<T>(run, orchestration, completedOutputs);
}
