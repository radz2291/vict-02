import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core';
import { Memory } from '@mastra/memory';
import type { Observability } from '@mastra/observability';
import { Observability as ObservabilityClass, MastraStorageExporter } from '@mastra/observability';
import type { LibSQLStore } from '@mastra/libsql';
import type {
  AgentProfileActivation,
  AgentTurnExecutionContext,
  AgentTurnOutcome,
  AgentTurnRequest,
  ProductAgentPort,
} from '@vict/runtime';
import type { AgentStreamEvent, AgentStreamUsage } from '@vict/contracts';
import { bridgeHelperToolToMastra, sanitizeToolName } from './helper-tools.js';

/**
 * The Mastra-backed `ProductAgentPort` implementation (Stage 06A).
 *
 * Construction and turn discipline (AI-004, amendment §6.4):
 * - the adapter is built from ONE immutable `AgentProfileActivation`
 *   snapshot; every Mastra primitive it owns (Agent, Memory, tools,
 *   observability) is DERIVED from that frozen snapshot and the dedicated
 *   store — never from a live registry;
 * - a turn receives ONLY the snapshot it pins: later registry mutation or
 *   re-activation cannot affect it, and the turn never consults a live
 *   mutable registry, processor list, model profile, or tool map;
 * - results crossing back are sanitized VICT structures: raw Mastra/
 *   provider errors, stack traces, and chunk types never cross the neutral
 *   boundary;
 * - the actual provider/model identity observed at execution (the offline
 *   fixture supplies it) is recorded as run metadata — never hashed.
 */

/** Neutral payload-safe tracing policy (MSTR-008). */
export interface MastraTracingPolicy {
  /** Explicit sampling strategy (never left at defaults). */
  readonly sampling:
    | { readonly type: 'always' }
    | { readonly type: 'never' }
    | { readonly type: 'ratio'; readonly probability: number };
  /**
   * Payload-safety switches. In this Stage 06A revision hiding is MANDATORY:
   * both flags default to `true` and only `true` is accepted — full-payload
   * tracing is an explicit protected opt-in that arrives with a separate
   * retention policy in a later, explicitly governed change.
   */
  readonly hideInput?: true;
  readonly hideOutput?: true;
}

/** Configuration for one adapter instance. */
export interface MastraProductAgentConfig {
  /** The dedicated file-backed Mastra store (physically separate from VICT stores). */
  readonly store: LibSQLStore;
  /**
   * Resolves the pinned model-profile declaration to a model
   * configuration. Stage 06A compositions supply the deterministic offline
   * fixture; provider-bound factories arrive in Stage 07 with credentials
   * resolved through the protected port — credential VALUES never pass
   * through this adapter.
   */
  readonly modelFactory: (modelProfile: {
    readonly id: string;
    readonly revision: string;
    readonly routerModel: string;
    readonly provider: string;
    readonly providerCredentialVar?: string;
  }) => unknown;
  /** Payload-safe tracing policy (defaults hide both directions). */
  readonly tracing?: MastraTracingPolicy;
  /** Injected clock (epoch ms). */
  readonly clock?: () => number;
}

/** The resolved, adapter-owned model metadata (recorded, never hashed). */
export interface MastraAdapterMetadata {
  /** The pinned activation identity the adapter is bound to. */
  readonly agentProfileVersion: string;
  readonly activationVersion: string;
  /** Provider/model identity observed from the model fixture, when supplied. */
  readonly providerModelIdentity?: string;
}

/** Apply payload-safe defaults (hiding is mandatory in Stage 06A). */
function resolveTracingPolicy(policy: MastraTracingPolicy | undefined): MastraTracingPolicy {
  return policy ?? { sampling: { type: 'always' }, hideInput: true, hideOutput: true };
}

/**
 * Error-redaction span formatter (MSTR-008 payload-safe discipline).
 *
 * The pinned Mastra observability records RAW error objects (message and
 * stack) on failed spans even when input/output hiding is on. Raw provider
 * errors are forbidden content at the VICT boundary (CONT-005/OBS-002;
 * amendment §10), so the exporter-level formatter replaces every span
 * error with a stable, non-echoing record BEFORE persistence: only the
 * fact that a failure occurred is retained. This runs on the EXPORTED
 * span projection (plain data), never on the internal span object.
 */
function errorRedactionSpanFormatter(): (span: Record<string, unknown>) => Record<string, unknown> {
  return (span: Record<string, unknown>) => {
    if (span['error'] !== null && span['error'] !== undefined) {
      return { ...span, error: { victRedacted: true, code: 'VICT_AGENT_TURN_FAILED' } };
    }
    return span;
  };
}

/** Create the payload-safe observability composition: explicit sampling + storage exporter. */
function composeObservability(policy: MastraTracingPolicy): Observability {
  return new ObservabilityClass({
    configs: {
      vict: {
        serviceName: 'vict-mastra-adapter',
        sampling:
          policy.sampling.type === 'ratio'
            ? ({ type: 'ratio', probability: policy.sampling.probability } as never)
            : policy.sampling.type === 'never'
              ? ({ type: 'never' } as never)
              : ({ type: 'always' } as never),
        exporters: [
          new MastraStorageExporter({
            customSpanFormatter: errorRedactionSpanFormatter() as never,
          }),
        ],
      },
    },
  });
}

/** Adapter implementation of the neutral ProductAgentPort. */
export class MastraProductAgent implements ProductAgentPort {
  readonly #activation: AgentProfileActivation;
  readonly #config: MastraProductAgentConfig;
  readonly #agent: Agent;
  readonly #memory: Memory;
  readonly #observability: Observability | undefined;
  readonly #metadata: MastraAdapterMetadata;
  readonly #knownThreads = new Set<string>();

  private constructor(
    activation: AgentProfileActivation,
    config: MastraProductAgentConfig,
    metadata: MastraAdapterMetadata,
  ) {
    this.#activation = activation;
    this.#config = config;
    this.#metadata = metadata;
    const profile = activation.profile.profile;

    // Memory from the pinned policy (exact revision, resolved at activation).
    const memoryConfig = activation.memoryPolicy.artifact.config;
    this.#memory = new Memory({
      storage: config.store,
      options: {
        lastMessages: memoryConfig.lastMessages === false ? false : memoryConfig.lastMessages,
        workingMemory: {
          enabled: memoryConfig.workingMemory.enabled,
          ...(memoryConfig.workingMemory.template !== undefined
            ? { template: memoryConfig.workingMemory.template }
            : {}),
        } as never,
      } as never,
    });

    // Helper tools: bridged from the FROZEN snapshot bindings only.
    const tools: Record<string, unknown> = {};
    for (const binding of activation.helperTools) {
      tools[sanitizeToolName(binding.artifact.id)] = bridgeHelperToolToMastra(binding);
    }

    // The REAL pinned Mastra Agent, derived from the frozen snapshot.
    this.#agent = new Agent({
      id: `vict-agent-${profile.id}`,
      name: profile.id,
      instructions: activation.instructions.artifact.text,
      model: config.modelFactory({
        id: profile.modelProfile.id,
        revision: profile.modelProfile.revision,
        routerModel: profile.modelProfile.routerModel,
        provider: profile.modelProfile.provider,
        ...(profile.modelProfile.providerCredentialVar !== undefined
          ? { providerCredentialVar: profile.modelProfile.providerCredentialVar }
          : {}),
      }) as never,
      ...(Object.keys(tools).length > 0 ? { tools: tools as never } : {}),
      memory: this.#memory,
    });

    const tracingPolicy = resolveTracingPolicy(config.tracing);
    if (tracingPolicy.sampling.type !== 'never') {
      // Registering on a Mastra instance binds the storage exporter so
      // traces are persisted into the DEDICATED observability domain.
      const observability = composeObservability(tracingPolicy);
      this.#observability = observability;
      const mastra = new Mastra({
        agents: { [profile.id]: this.#agent },
        storage: config.store,
        observability,
      });
      void mastra;
    }
  }

  /**
   * Build one adapter bound to one activation snapshot. Every construction
   * input is either the frozen snapshot or composition-owned dedicated
   * infrastructure — a live registry never reaches this boundary.
   */
  static create(
    activation: AgentProfileActivation,
    config: MastraProductAgentConfig,
  ): MastraProductAgent {
    const modelProfile = activation.profile.profile.modelProfile;
    const model = config.modelFactory({
      id: modelProfile.id,
      revision: modelProfile.revision,
      routerModel: modelProfile.routerModel,
      provider: modelProfile.provider,
      ...(modelProfile.providerCredentialVar !== undefined
        ? { providerCredentialVar: modelProfile.providerCredentialVar }
        : {}),
    }) as { providerModelIdentity?: string };
    return new MastraProductAgent(activation, config, {
      agentProfileVersion: activation.agentProfileVersion,
      activationVersion: activation.activationVersion,
      ...(typeof model?.providerModelIdentity === 'string'
        ? { providerModelIdentity: model.providerModelIdentity }
        : {}),
    });
  }

  /** The adapter's immutable binding metadata. */
  get metadata(): MastraAdapterMetadata {
    return this.#metadata;
  }

  /**
   * Orderly shutdown: settle background memory saves, wait for the pinned
   * store's message persistence to go QUIESCENT (the pinned Mastra save
   * queue is debounced behind `settled()`), and flush buffered
   * observability spans so a following store close never loses durable
   * records (close/reopen and fresh-process fixtures rely on this).
   */
  async flush(): Promise<void> {
    try {
      await this.#memory.settled();
    } catch {
      // settle failures do not block flush of the remaining signals
    }
    await this.#awaitMemoryQuiescence();
    try {
      await this.#observability?.flush();
    } catch {
      // documented: flush failure is surfaced by the store owner's own close
    }
  }

  /**
   * Deterministic readiness barrier over the pinned Mastra save queue:
   * saves are debounced (documented `debounceMs` 100ms, with a 1s staleness
   * flush), so quiescence is sampled only after the debounce window has
   * fully elapsed and is confirmed by two consecutive stable per-thread
   * counts. Bounded; never unbounded waiting.
   */
  async #awaitMemoryQuiescence(): Promise<void> {
    const domain = await this.#config.store.getStore('memory');
    if (domain === undefined) {
      return;
    }
    const SAVE_DEBOUNCE_BOUND_MS = 150; // > documented 100ms debounce
    await new Promise((resolve) => setTimeout(resolve, SAVE_DEBOUNCE_BOUND_MS));
    let lastCounts = '';
    let stableRounds = 0;
    for (let attempt = 0; attempt < 40 && stableRounds < 2; attempt += 1) {
      const counts: string[] = [];
      for (const threadId of this.#knownThreads) {
        try {
          const listed = await domain.listMessages({ threadId });
          counts.push(`${threadId}:${listed.messages.length}`);
        } catch {
          counts.push(`${threadId}:error`);
        }
      }
      const serialized = counts.join('|');
      if (serialized === lastCounts) {
        stableRounds += 1;
      } else {
        stableRounds = 0;
        lastCounts = serialized;
      }
      if (stableRounds < 2) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  get agentProfileVersion(): string {
    return this.#metadata.agentProfileVersion;
  }

  /** Run one turn against the pinned snapshot (see module docs). */
  async runTurn(
    request: AgentTurnRequest,
    context: AgentTurnExecutionContext,
  ): Promise<AgentTurnOutcome> {
    const events: AgentStreamEvent[] = [];
    const base = {
      streamId: `vict-stream-${request.turnId}`,
      turnId: request.turnId,
      threadId: request.threadId,
      actorId: request.actorId,
      agentProfileVersion: this.#metadata.agentProfileVersion,
      ...(context.victRunId !== undefined ? { victRunId: context.victRunId } : {}),
    };
    let seq = 0;
    const emit = (event: Record<string, unknown>): void => {
      seq += 1;
      const full = { ...base, seq, ...event } as unknown as AgentStreamEvent;
      events.push(full);
      context.onEvent?.(full);
    };

    // 1. Neutral input processors (declared order) transform the input text.
    let inputText = request.input;
    for (const binding of this.#activation.processors) {
      inputText = binding.artifact.transform(inputText);
    }

    const profile = this.#activation.profile.profile;
    const tracingPolicy = resolveTracingPolicy(this.#config.tracing);

    // 2. The REAL pinned Mastra stream, memory-scoped by VICT identities.
    const memoryResource = `vict-actor-${request.actorId}`;
    let stream;
    try {
      const memoryThread = await this.#ensureThread(request.threadId, memoryResource);
      stream = await this.#agent.stream(inputText, {
        memory: { thread: memoryThread, resource: memoryResource },
        // Durable milestone discipline: messages flush to the dedicated
        // store at each step finish (not only via the debounced queue), so
        // a turn's content is durable before the terminal event.
        savePerStep: true,
        maxSteps: profile.turnPolicy.maxSteps,
        // Provider retries are a PROFILE-owned bounded option (never a
        // hidden framework default): a missing declaration means zero
        // provider retries, keeping turns deterministic and bounded.
        maxRetries: profile.generation.maxRetries ?? 0,
        ...(context.abortSignal !== undefined ? { abortSignal: context.abortSignal } : {}),
        tracingOptions: {
          hideInput: tracingPolicy.hideInput,
          hideOutput: tracingPolicy.hideOutput,
          metadata: {
            victTurnId: request.turnId,
            victActorId: request.actorId,
            victThread: request.threadId,
            victAgentProfileVersion: this.#metadata.agentProfileVersion,
            ...(context.victRunId !== undefined ? { victRunId: context.victRunId } : {}),
          },
        },
      } as never);
    } catch {
      // Construction-level failures (e.g. provider resolution) are sanitized.
      emit({ kind: 'response.failed', code: 'VICT_AGENT_TURN_FAILED' });
      return {
        status: 'failed',
        events,
        errorCode: 'VICT_AGENT_TURN_FAILED',
      };
    }

    emit({ kind: 'response.started' });

    // 3. Normalize the stream deterministically; sanitize every failure.
    let completedText = '';
    let usage: AgentStreamUsage | undefined;
    let status: AgentTurnOutcome['status'] = 'completed';
    let errorCode: string | undefined;
    const pendingToolCalls = new Map<string, string>();

    try {
      for await (const chunk of stream.fullStream) {
        const type = (chunk as { type?: string }).type;
        const payload = (chunk as { payload?: Record<string, unknown> }).payload ?? {};
        switch (type) {
          case 'tool-call': {
            const toolCallId = String(payload.toolCallId ?? 'unknown');
            const toolName = String(payload.toolName ?? 'unknown');
            pendingToolCalls.set(toolCallId, toolName);
            emit({ kind: 'tool.requested', toolCallId, toolName });
            emit({ kind: 'tool.started', toolCallId, toolName });
            break;
          }
          case 'tool-result': {
            const toolCallId = String(payload.toolCallId ?? 'unknown');
            const toolName = String(
              payload.toolName ?? pendingToolCalls.get(toolCallId) ?? 'unknown',
            );
            const result = payload.result as { victHelperFailure?: string } | undefined;
            const failed = result?.victHelperFailure !== undefined || payload.isError === true;
            if (failed) {
              emit({ kind: 'tool.failed', toolCallId, toolName, code: 'VICT_TOOL_FAILED' });
            } else {
              emit({ kind: 'tool.completed', toolCallId, toolName });
            }
            break;
          }
          case 'text-delta': {
            const delta = typeof payload.text === 'string' ? payload.text : '';
            emit({ kind: 'text.delta', delta });
            completedText += delta;
            break;
          }
          case 'finish': {
            const finishPayload = (
              payload as {
                output?: {
                  usage?: { inputTokens?: unknown; outputTokens?: unknown; totalTokens?: unknown };
                };
              }
            ).output;
            const readCount = (value: unknown): number =>
              typeof value === 'number' && Number.isFinite(value) ? value : 0;
            const inputTokens = readCount(finishPayload?.usage?.inputTokens);
            const outputTokens = readCount(finishPayload?.usage?.outputTokens);
            usage = {
              inputTokens,
              outputTokens,
              totalTokens:
                readCount(finishPayload?.usage?.totalTokens) || inputTokens + outputTokens,
            };
            break;
          }
          case 'error': {
            // Raw provider/Mastra error objects NEVER cross: stable code only.
            status = 'failed';
            errorCode = 'VICT_AGENT_TURN_FAILED';
            break;
          }
          case 'abort':
            status = 'cancelled';
            break;
          default:
            break;
        }
      }
      if (status === 'completed' && context.abortSignal?.aborted === true) {
        status = 'cancelled';
      }
    } catch {
      status = 'failed';
      errorCode = 'VICT_AGENT_TURN_FAILED';
    }

    const traceId =
      typeof (stream as { traceId?: unknown }).traceId === 'string'
        ? (stream as { traceId: string }).traceId
        : undefined;

    // 4. Guardrails (declared order) check the completed text — fail closed.
    if (status === 'completed') {
      for (const binding of this.#activation.guardrails) {
        const verdict = binding.artifact.check(completedText);
        if (!verdict.ok) {
          status = 'failed';
          errorCode = `VICT_GUARDRAIL_${verdict.code}`;
          break;
        }
      }
    }

    // 5. Terminal milestones + usage.
    if (usage !== undefined) {
      emit({ kind: 'usage.updated', usage });
    }
    if (status === 'completed') {
      // Durable-before-terminal ordering: the conversation content is
      // persisted (quiescent) BEFORE the memory/completion milestones are
      // emitted, so the milestones are truthful. Settle failures never fail
      // an otherwise-complete turn.
      this.#knownThreads.add(request.threadId);
      try {
        await this.#memory.settled();
        await this.#awaitMemoryQuiescence();
      } catch {
        // documented: settle failure is not a turn failure
      }
      emit({ kind: 'memory.updated', threadId: request.threadId });
      emit({ kind: 'content.completed', text: completedText });
      emit({ kind: 'response.completed' });
      return {
        status,
        text: completedText,
        events,
        ...(usage !== undefined ? { usage } : {}),
        ...(this.#metadata.providerModelIdentity !== undefined
          ? { providerModelIdentity: this.#metadata.providerModelIdentity }
          : {}),
        ...(traceId !== undefined ? { traceId } : {}),
      };
    }
    if (status === 'cancelled') {
      emit({ kind: 'response.cancelled' });
      return {
        status,
        events,
        ...(usage !== undefined ? { usage } : {}),
        ...(traceId !== undefined ? { traceId } : {}),
      };
    }
    emit({ kind: 'response.failed', code: errorCode ?? 'VICT_AGENT_TURN_FAILED' });
    return {
      status: 'failed',
      events,
      errorCode: errorCode ?? 'VICT_AGENT_TURN_FAILED',
      ...(usage !== undefined ? { usage } : {}),
      ...(traceId !== undefined ? { traceId } : {}),
    };
  }

  /** Ensure the thread exists and is owned by the VICT actor (correlated metadata). */
  async #ensureThread(threadId: string, resourceId: string): Promise<string> {
    if (this.#knownThreads.has(threadId)) {
      return threadId;
    }
    const domain = await this.#config.store.getStore('memory');
    if (domain === undefined) {
      throw new Error('VICT_MASTRA_MEMORY_DOMAIN_UNAVAILABLE');
    }
    const found = await domain.getThreadById({ threadId, resourceId });
    if (found === null || found === undefined) {
      await this.#memory.createThread({
        threadId,
        resourceId,
        title: `vict-conversation-${threadId}`,
        metadata: { victResourceId: resourceId, victThread: threadId },
      });
    }
    this.#knownThreads.add(threadId);
    return threadId;
  }
}
