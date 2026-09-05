import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core';
import { Memory } from '@mastra/memory';
import type { Observability } from '@mastra/observability';
import { Observability as ObservabilityClass, MastraStorageExporter } from '@mastra/observability';
import type { LibSQLStore } from '@mastra/libsql';
import { AsyncLocalStorage } from 'node:async_hooks';
import type {
  AgentProfileActivation,
  AgentTurnExecutionContext,
  AgentTurnOutcome,
  AgentTurnRequest,
  ProductAgentPort,
} from '@vict/runtime';
import type { AgentStreamEvent, AgentStreamUsage } from '@vict/contracts';
import { MASTRA_ADAPTER_COMPATIBILITY, type MastraPinnedPackageName } from './compatibility.js';
import {
  bridgeHelperToolToMastra,
  sanitizeToolName,
  type HelperToolGateVerdict,
} from './helper-tools.js';
import { VictMastraCompositionError, type MastraThreadCoordinator } from './memory.js';

/**
 * The Mastra-backed `ProductAgentPort` implementation (Stage 06A).
 *
 * Construction and turn discipline (AI-004, amendment §6.4):
 * - the adapter is built from ONE immutable `AgentProfileActivation`
 *   snapshot; every Mastra primitive it owns (Agent, Memory, tools,
 *   observability) is DERIVED from that frozen snapshot and the dedicated
 *   store — never from a live registry;
 * - the profile's adapter compatibility marker and every pinned runtime
 *   package version MUST exactly match this adapter build's supported
 *   marker BEFORE any model factory is invoked (fail closed);
 * - `modelFactory` is invoked EXACTLY ONCE; the returned model instance is
 *   the instance that executes every turn, and the observed provider/model
 *   metadata is derived from THAT SAME instance (never from a discarded
 *   model);
 * - all configuration is defensively captured at construction: later
 *   caller mutation of the config object has no effect on any turn;
 * - a turn receives ONLY the snapshot it pins: later registry mutation or
 *   re-activation cannot affect it, and the turn never consults a live
 *   mutable registry, processor list, model profile, or tool map;
 * - results crossing back are sanitized VICT structures: raw Mastra/
 *   provider errors, stack traces, chunk types, author thrown messages,
 *   and arbitrary guardrail codes never cross the neutral boundary;
 * - the per-turn tool budget (`maxToolCalls`) is enforced independently of
 *   the step limit through a turn-scoped async context — counts never leak
 *   between concurrent turns.
 */

/** Stable sanitized adapter-level failure codes (never raw content). */
export type MastraAdapterErrorCode =
  | 'VICT_MASTRA_ADAPTER_COMPATIBILITY_MISMATCH'
  | 'VICT_MASTRA_TOOL_NAME_COLLISION'
  | 'VICT_AGENT_TRACE_POLICY_UNSAFE'
  | 'VICT_AGENT_THREAD_ACTOR_MISMATCH'
  | 'VICT_AGENT_THREAD_FENCED'
  | 'VICT_AGENT_STRUCTURED_OUTPUT_REJECTED'
  | 'VICT_AGENT_STRUCTURED_OUTPUT_FAILED'
  | 'VICT_AGENT_TOOL_LIMIT_EXCEEDED'
  | 'VICT_AGENT_TURN_PERSISTENCE_UNCONFIRMED'
  | 'VICT_AGENT_GUARDRAIL_REJECTED'
  | 'VICT_AGENT_TURN_FAILED';

/** Structured, non-echoing adapter configuration/execution failure. */
export class VictMastraAdapterError extends Error {
  readonly code: MastraAdapterErrorCode;

  constructor(code: MastraAdapterErrorCode, message: string) {
    super(message);
    this.name = 'VictMastraAdapterError';
    this.code = code;
  }
}

/** The single stable framework code for guardrail failures without a declared code. */
export const GUARDRAIL_REJECTED_CODE = 'VICT_GUARDRAIL_REJECTED';

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
   * retention policy in a later, explicitly governed change. The accepted
   * type is `true` only; runtime validation rejects every other value
   * (plain-JavaScript callers included) BEFORE any execution.
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
   * through this adapter. The factory is invoked EXACTLY ONCE per adapter;
   * the returned model is the instance that executes.
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
  /**
   * The process-local thread coordinator shared with the governed deletion
   * port. REQUIRED: an in-flight turn holds its thread against deletion
   * until the turn is fully settled (deletion fences the thread and waits),
   * and a turn starting on a fenced (deleted) thread is refused — so a
   * completed deletion can never be undone by a still-running turn. An
   * unfenced configuration violates the deletion guarantee and is REJECTED
   * at construction (before any execution); the supported composition path
   * (`createGovernedMemoryDeletionPort`) hands the SAME coordinator
   * instance to both sides automatically.
   */
  readonly threadCoordinator: MastraThreadCoordinator;
}

/**
 * Declared trust policy for model-supplied stream metadata:
 * - a tool NAME is trusted metadata only when it matches a PINNED helper
 *   tool of this activation; anything else (including model-fabricated
 *   names) is normalized to the stable placeholder 'unknown' before it can
 *   appear in normalized events;
 * - a tool-CALL ID is a bounded correlation handle: only bounded safe
 *   identifier characters are accepted; anything else is normalized to
 *   'unknown'. Neither is ever used for authority decisions.
 */
const TOOL_CALL_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const UNTRUSTED_TOOL_METADATA_PLACEHOLDER = 'unknown';

/**
 * The resolved, adapter-owned model metadata (recorded, never hashed). */
export interface MastraAdapterMetadata {
  /** The pinned activation identity the adapter is bound to. */
  readonly agentProfileVersion: string;
  readonly activationVersion: string;
  /** Provider/model identity observed from the EXECUTING model, when supplied. */
  readonly providerModelIdentity?: string;
}

/**
 * Validate and DEEP-FREEZE the tracing policy at the public runtime
 * boundary. Enforced for every caller (plain JavaScript included):
 * - `hideInput`/`hideOutput` may be ABSENT (safe default `true` applies);
 *   when supplied they must be EXACTLY `true` — `false`, strings, numbers,
 *   and hostile values fail configuration;
 * - `sampling` must be a recognized strategy with a finite probability in
 *   [0, 1] for the ratio strategy.
 * A configuration using `hideInput: false` or `hideOutput: false` is
 * rejected before any model or store interaction.
 */
function validateAndFreezeTracingPolicy(
  policy: MastraTracingPolicy | undefined,
): Readonly<Required<MastraTracingPolicy>> {
  try {
    return validateAndFreezeTracingPolicyUnsafe(policy);
  } catch (error) {
    if (error instanceof VictMastraAdapterError) {
      throw error;
    }
    // Hostile getters/proxies (a property access that THROWS) are untrusted
    // configuration: the failure is sanitized to the stable, non-echoing
    // policy code — the raw error (and any canary it carries) never escapes.
    throw new VictMastraAdapterError(
      'VICT_AGENT_TRACE_POLICY_UNSAFE',
      'The tracing policy could not be validated safely; hostile property access is rejected.',
    );
  }
}

function validateAndFreezeTracingPolicyUnsafe(
  policy: MastraTracingPolicy | undefined,
): Readonly<Required<MastraTracingPolicy>> {
  const resolved: {
    sampling: MastraTracingPolicy['sampling'];
    hideInput: true;
    hideOutput: true;
  } = {
    sampling: { type: 'always' },
    hideInput: true,
    hideOutput: true,
  };
  if (policy !== undefined) {
    if (typeof policy !== 'object' || policy === null || Array.isArray(policy)) {
      throw new VictMastraAdapterError(
        'VICT_AGENT_TRACE_POLICY_UNSAFE',
        'The tracing policy must be a plain object.',
      );
    }
    for (const key of Object.keys(policy)) {
      if (!['sampling', 'hideInput', 'hideOutput'].includes(key)) {
        throw new VictMastraAdapterError(
          'VICT_AGENT_TRACE_POLICY_UNSAFE',
          `The tracing policy declares unknown field '${key}'; the policy schema is closed.`,
        );
      }
    }
    if (policy.hideInput !== undefined && policy.hideInput !== true) {
      throw new VictMastraAdapterError(
        'VICT_AGENT_TRACE_POLICY_UNSAFE',
        "The tracing policy 'hideInput' may be absent (safe default true) or exactly true; every other value — including false — is rejected.",
      );
    }
    if (policy.hideOutput !== undefined && policy.hideOutput !== true) {
      throw new VictMastraAdapterError(
        'VICT_AGENT_TRACE_POLICY_UNSAFE',
        "The tracing policy 'hideOutput' may be absent (safe default true) or exactly true; every other value — including false — is rejected.",
      );
    }
    if (policy.sampling !== undefined) {
      const sampling = policy.sampling as Record<string, unknown>;
      if (typeof sampling !== 'object' || sampling === null) {
        throw new VictMastraAdapterError(
          'VICT_AGENT_TRACE_POLICY_UNSAFE',
          'The tracing sampling strategy must be a plain object.',
        );
      }
      if (sampling['type'] === 'always' || sampling['type'] === 'never') {
        resolved.sampling =
          sampling['type'] === 'always'
            ? ({ type: 'always' } as const)
            : ({ type: 'never' } as const);
      } else if (sampling['type'] === 'ratio') {
        const probability = sampling['probability'];
        if (
          typeof probability !== 'number' ||
          !Number.isFinite(probability) ||
          probability < 0 ||
          probability > 1
        ) {
          throw new VictMastraAdapterError(
            'VICT_AGENT_TRACE_POLICY_UNSAFE',
            'The ratio sampling probability must be a finite number within [0, 1].',
          );
        }
        resolved.sampling = { type: 'ratio', probability };
      } else {
        throw new VictMastraAdapterError(
          'VICT_AGENT_TRACE_POLICY_UNSAFE',
          "The tracing sampling strategy must be 'always', 'never', or a bounded 'ratio'.",
        );
      }
    }
  }
  return deepFreeze(resolved);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
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
function composeObservability(policy: Readonly<Required<MastraTracingPolicy>>): Observability {
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

/**
 * Prove the activation's adapter compatibility marker EXACTLY matches this
 * adapter build's supported marker (id, revision, and every pinned runtime
 * package version). Any mismatch refuses construction — an activation
 * resolved under a different adapter/runtime combination never executes.
 */
function assertAdapterCompatibility(activation: AgentProfileActivation): void {
  const declared = activation.profile.profile.adapter;
  if (declared.id !== MASTRA_ADAPTER_COMPATIBILITY.id) {
    throw new VictMastraAdapterError(
      'VICT_MASTRA_ADAPTER_COMPATIBILITY_MISMATCH',
      `The activation declares adapter id '${declared.id}' but this adapter is '${MASTRA_ADAPTER_COMPATIBILITY.id}'; refusing to execute.`,
    );
  }
  if (declared.revision !== MASTRA_ADAPTER_COMPATIBILITY.revision) {
    throw new VictMastraAdapterError(
      'VICT_MASTRA_ADAPTER_COMPATIBILITY_MISMATCH',
      `The activation declares adapter revision '${declared.revision}' but this adapter is revision '${MASTRA_ADAPTER_COMPATIBILITY.revision}'; refusing to execute.`,
    );
  }
  const declaredPackages = Object.entries(declared.runtimePackages ?? {}) as Array<
    [MastraPinnedPackageName | string, string]
  >;
  const supportedPackages = Object.entries(MASTRA_ADAPTER_COMPATIBILITY.runtimePackages);
  if (declaredPackages.length !== supportedPackages.length) {
    throw new VictMastraAdapterError(
      'VICT_MASTRA_ADAPTER_COMPATIBILITY_MISMATCH',
      'The activation pins a different set of runtime packages than this adapter supports; refusing to execute.',
    );
  }
  for (const [name, version] of declaredPackages) {
    const supported = (MASTRA_ADAPTER_COMPATIBILITY.runtimePackages as Record<string, string>)[
      name
    ];
    if (supported === undefined || supported !== version) {
      throw new VictMastraAdapterError(
        'VICT_MASTRA_ADAPTER_COMPATIBILITY_MISMATCH',
        `The activation pins runtime package '${name}' at '${version}' but this adapter supports '${String(supported ?? 'nothing')}'; refusing to execute.`,
      );
    }
  }
}

/** Adapter implementation of the neutral ProductAgentPort. */
export class MastraProductAgent implements ProductAgentPort {
  readonly #activation: AgentProfileActivation;
  /** Defensively captured configuration — caller mutation is invisible. */
  readonly #store: LibSQLStore;
  readonly #threadCoordinator: MastraThreadCoordinator;
  readonly #tracing: Readonly<Required<MastraTracingPolicy>>;
  readonly #agent: Agent;
  readonly #memory: Memory;
  readonly #observability: Observability | undefined;
  readonly #metadata: Readonly<MastraAdapterMetadata>;
  /** Threads known for quiescence bookkeeping (ids only, never ownership). */
  readonly #knownThreads = new Set<string>();
  /** The PINNED helper-tool names: the only trusted tool-name metadata. */
  readonly #pinnedToolNames: ReadonlySet<string>;
  /**
   * Actor-aware ownership cache: threadId → the ONLY actor that may use it
   * (the resource binding). A thread bound to actor A is never usable by
   * actor B — neither through this cache nor through the store.
   */
  readonly #threadOwners = new Map<string, string>();
  /** Per-turn tool-budget scope: counts never leak between turns. The
   * `budgetDenied` flag is the AUTHORITATIVE denial record — it is set at
   * the gate itself and does not depend on any denial envelope surviving
   * the helper's application output contract. */
  readonly #turnScope = new AsyncLocalStorage<{
    remainingToolCalls: number;
    budgetDenied: boolean;
  }>();

  private constructor(
    activation: AgentProfileActivation,
    config: MastraProductAgentConfig,
    model: unknown,
    metadata: MastraAdapterMetadata,
  ) {
    this.#activation = activation;
    // Unfenced compositions are rejected BEFORE anything is constructed:
    // without the shared coordinator an in-flight turn could persist
    // messages after a completed deletion, silently violating the deletion
    // guarantee.
    if (config.threadCoordinator === undefined) {
      throw new VictMastraCompositionError(
        'The Mastra adapter requires the process-local thread coordinator shared with the governed deletion port; unfenced compositions are rejected before execution.',
      );
    }
    this.#store = config.store;
    this.#threadCoordinator = config.threadCoordinator;
    this.#tracing = validateAndFreezeTracingPolicy(config.tracing);
    this.#metadata = deepFreeze(metadata);
    const profile = activation.profile.profile;

    // Memory from the pinned policy (exact revision, resolved at activation).
    const memoryConfig = activation.memoryPolicy.artifact.config;
    this.#memory = new Memory({
      storage: this.#store,
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

    // Helper tools: bridged from the FROZEN snapshot bindings only. Mastra
    // tool names derived from helper ids must never alias — a collision is
    // detected and rejected BEFORE the agent is created (never silently
    // overwritten). The original stable VICT helper id stays on the tool
    // binding; the sanitized name is only the model-facing alias.
    const tools: Record<string, unknown> = {};
    const toolNameOwner = new Map<string, string>();
    for (const binding of activation.helperTools) {
      const toolName = sanitizeToolName(binding.artifact.id);
      const previous = toolNameOwner.get(toolName);
      if (previous !== undefined) {
        throw new VictMastraAdapterError(
          'VICT_MASTRA_TOOL_NAME_COLLISION',
          `Helper tools '${previous}' and '${binding.artifact.id}' both map to the Mastra tool name '${toolName}'; refusing to alias (the original VICT helper ids and revisions stay authoritative in the activation).`,
        );
      }
      toolNameOwner.set(toolName, binding.artifact.id);
      tools[toolName] = bridgeHelperToolToMastra(binding, () => this.#toolBudgetGate());
    }
    this.#pinnedToolNames = new Set(Object.keys(tools));

    // The REAL pinned Mastra Agent, derived from the frozen snapshot, bound
    // to the ONE model instance the factory produced.
    this.#agent = new Agent({
      id: `vict-agent-${profile.id}`,
      name: profile.id,
      instructions: activation.instructions.artifact.text,
      model: model as never,
      ...(Object.keys(tools).length > 0 ? { tools: tools as never } : {}),
      memory: this.#memory,
    });

    if (this.#tracing.sampling.type !== 'never') {
      // Registering on a Mastra instance binds the storage exporter so
      // traces are persisted into the DEDICATED observability domain.
      const observability = composeObservability(this.#tracing);
      this.#observability = observability;
      const mastra = new Mastra({
        agents: { [profile.id]: this.#agent },
        storage: this.#store,
        observability,
      });
      void mastra;
    }
  }

  /**
   * Build one adapter bound to one activation snapshot. Every construction
   * input is either the frozen snapshot or composition-owned dedicated
   * infrastructure — a live registry never reaches this boundary.
   *
   * Failure ordering (all BEFORE any model or store interaction):
   * 1. the tracing policy is validated (unsafe configurations rejected);
   * 2. the adapter compatibility marker is proven exact;
   * 3. `modelFactory` is invoked EXACTLY ONCE — its returned model is the
   *    instance that executes and the only source of observed metadata.
   */
  static create(
    activation: AgentProfileActivation,
    config: MastraProductAgentConfig,
  ): MastraProductAgent {
    // 0. Deletion fencing is UNAVOIDABLE in supported composition: a
    // configuration without the shared thread coordinator is rejected
    // before any validation, factory call, or store interaction.
    if (config.threadCoordinator === undefined) {
      throw new VictMastraCompositionError(
        'The Mastra adapter requires the process-local thread coordinator shared with the governed deletion port; unfenced compositions are rejected before execution.',
      );
    }
    // 1. Tracing safety first: an unsafe configuration never executes.
    validateAndFreezeTracingPolicy(config.tracing);
    // 2. Exact adapter-marker validation before anything is constructed.
    assertAdapterCompatibility(activation);
    // 3. ONE factory invocation; metadata derives from the SAME returned
    // model instance that will execute every turn.
    const modelProfile = activation.profile.profile.modelProfile;
    const model = config.modelFactory({
      id: modelProfile.id,
      revision: modelProfile.revision,
      routerModel: modelProfile.routerModel,
      provider: modelProfile.provider,
      ...(modelProfile.providerCredentialVar !== undefined
        ? { providerCredentialVar: modelProfile.providerCredentialVar }
        : {}),
    }) as { providerModelIdentity?: string; provider?: unknown; modelId?: unknown };
    const observedIdentity =
      typeof model?.providerModelIdentity === 'string'
        ? model.providerModelIdentity
        : typeof model?.provider === 'string' && typeof model?.modelId === 'string'
          ? `${model.provider}/${model.modelId}`
          : undefined;
    return new MastraProductAgent(activation, config, model, {
      agentProfileVersion: activation.agentProfileVersion,
      activationVersion: activation.activationVersion,
      ...(observedIdentity !== undefined ? { providerModelIdentity: observedIdentity } : {}),
    });
  }

  /** The adapter's immutable binding metadata (defensive frozen capture). */
  get metadata(): Readonly<MastraAdapterMetadata> {
    return this.#metadata;
  }

  /**
   * The per-turn tool budget gate, evaluated inside the turn's async
   * context. Every helper-tool invocation consumes one call BEFORE any
   * contract or implementation work; `maxToolCalls: 0` denies every
   * invocation, and higher limits stop before invocation number
   * `limit + 1`. A tool reached outside any turn scope is denied. Every
   * denial is recorded in the AUTHORITATIVE per-turn state (the turn's
   * scope) at the gate itself — the turn fails closed with the stable
   * limit code even if the denial envelope never survives the helper's
   * application output contract. A tool reached outside any turn scope is
   * denied.
   */
  #toolBudgetGate(): HelperToolGateVerdict {
    const scope = this.#turnScope.getStore();
    if (scope === undefined) {
      return 'outside-turn';
    }
    if (scope.remainingToolCalls <= 0) {
      scope.budgetDenied = true;
      return 'denied';
    }
    scope.remainingToolCalls -= 1;
    return 'allowed';
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
    const domain = await this.#store.getStore('memory');
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

  /**
   * Durable message count for one thread (best-effort). Returns -1 when the
   * count cannot be read (the barrier then falls back to requiring durable
   * presence of at least one message; the deletion reconciliation rounds
   * remain the backstop for straggler debounced saves).
   */
  async #durableMessageCount(threadId: string, resourceId: string): Promise<number> {
    try {
      const domain = await this.#store.getStore('memory');
      if (domain === undefined) {
        return -1;
      }
      const listed = await domain.listMessages({ threadId, resourceId });
      return listed.messages.length;
    } catch {
      return -1;
    }
  }

  /**
   * Durable-presence barrier: poll the dedicated store until THIS turn's
   * content is durably persisted — the thread exists AND at least one NEW
   * message beyond the turn's baseline is present. Completion therefore
   * depends on an actual persistence acknowledgement from the store, never
   * on an arbitrary delay or on the presence of any historical message.
   * The pinned save queue is debounced with a documented staleness flush,
   * so queue-idle checks can race the enqueue; durable NEW presence is the
   * property the deletion fence relies on. Bounded; never unbounded
   * waiting. Returns `true` only when durable new presence was PROVEN.
   */
  async #awaitDurableTurnPersistence(
    threadId: string,
    resourceId: string,
    baselineMessages: number,
  ): Promise<boolean> {
    const domain = await this.#store.getStore('memory');
    if (domain === undefined) {
      return false;
    }
    // Unknown baseline (read failure at turn start): require durable
    // presence of at least one message.
    const requiredCount = baselineMessages >= 0 ? baselineMessages : 0;
    for (let attempt = 0; attempt < 150; attempt += 1) {
      try {
        const thread = await domain.getThreadById({ threadId, resourceId });
        const listed = await domain.listMessages({ threadId, resourceId });
        if (thread !== null && thread !== undefined && listed.messages.length > requiredCount) {
          return true;
        }
      } catch {
        // transient read failure: keep polling within the bound
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // Bounded: persistence could NOT be proven; the caller fails the turn
    // with VICT_AGENT_TURN_PERSISTENCE_UNCONFIRMED instead of emitting
    // misleading success milestones.
    return false;
  }

  get agentProfileVersion(): string {
    return this.#metadata.agentProfileVersion;
  }

  /** Run one turn against the pinned snapshot (see module docs). */
  async runTurn(
    request: AgentTurnRequest,
    context: AgentTurnExecutionContext,
  ): Promise<AgentTurnOutcome> {
    // The whole turn runs inside its own tool-budget scope: counts are
    // turn-local and can never leak between concurrent turns; the
    // authoritative denial flag lives in the same scope.
    return this.#turnScope.run(
      {
        remainingToolCalls: this.#activation.profile.profile.turnPolicy.maxToolCalls,
        budgetDenied: false,
      },
      () => this.#runTurnScoped(request, context),
    );
  }

  async #runTurnScoped(
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

    const turnFailure = (code: string): AgentTurnOutcome => {
      emit({ kind: 'response.failed', code });
      return {
        status: 'failed',
        events,
        errorCode: code,
      };
    };

    // Deletion fencing: hold this thread against governed deletion for the
    // whole turn (release only after the final persistence barrier), so a
    // completed deletion can never be partially undone by this turn's
    // still-pending saves. A turn starting on an already-fenced (deleted)
    // thread is refused; a thread owned by another actor is refused.
    let releaseThread: (() => void) | undefined;
    if (this.#threadCoordinator !== undefined) {
      try {
        const handle = this.#threadCoordinator.beginTurn(
          request.threadId,
          `vict-actor-${request.actorId}`,
        );
        releaseThread = () => handle.release();
      } catch (error) {
        const code =
          error instanceof Error && error.name === 'MastraThreadFenceError'
            ? 'VICT_AGENT_THREAD_FENCED'
            : 'VICT_AGENT_THREAD_ACTOR_MISMATCH';
        return turnFailure(code);
      }
    }

    try {
      // 1. Neutral input processors (declared order) transform the input
      // text. They are untrusted author code: any throw — and any non-string
      // transform result — is a sanitized, deterministic turn failure;
      // runTurn never rejects with a raw author message.
      let inputText = request.input;
      try {
        for (const binding of this.#activation.processors) {
          inputText = binding.artifact.transform(inputText);
          if (typeof inputText !== 'string') {
            return turnFailure('VICT_AGENT_TURN_FAILED');
          }
        }
      } catch {
        return turnFailure('VICT_AGENT_TURN_FAILED');
      }

      const profile = this.#activation.profile.profile;
      const generation = profile.generation;
      const tracingPolicy = this.#tracing;

      // 2. The REAL pinned Mastra stream, memory-scoped by VICT identities.
      const memoryResource = `vict-actor-${request.actorId}`;
      let stream;
      // Baseline durable message count for THIS turn's persistence barrier:
      // completion must be proven by NEW durable content of this turn, never
      // by the presence of any historical message. -1 = unknown (read
      // failure); the barrier then requires durable presence of at least one
      // message and the deletion reconciliation remains the backstop.
      let baselineMessages = -1;
      try {
        const memoryThread = await this.#ensureThread(request.threadId, memoryResource);
        baselineMessages = await this.#durableMessageCount(request.threadId, memoryResource);
        stream = await this.#agent.stream(inputText, {
          memory: { thread: memoryThread, resource: memoryResource },
          // Durable milestone discipline: messages flush to the dedicated
          // store at each step finish (not only via the debounced queue), so
          // a turn's content is durable before the terminal event.
          savePerStep: true,
          maxSteps: profile.turnPolicy.maxSteps,
          // Declared generation behavior is passed through the pinned
          // invocation boundary EXACTLY as declared (absent stays absent).
          modelSettings: {
            ...(generation.temperature !== undefined
              ? { temperature: generation.temperature }
              : {}),
            ...(generation.topP !== undefined ? { topP: generation.topP } : {}),
            ...(generation.maxOutputTokens !== undefined
              ? { maxOutputTokens: generation.maxOutputTokens }
              : {}),
            ...(generation.maxRetries !== undefined ? { maxRetries: generation.maxRetries } : {}),
          },
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
      } catch (error) {
        // Construction-level failures (actor mismatch, fenced thread,
        // provider resolution) are sanitized — never a raw error.
        if (error instanceof VictMastraAdapterError) {
          return turnFailure(error.code);
        }
        if (error instanceof Error && error.name === 'MastraThreadFenceError') {
          return turnFailure('VICT_AGENT_THREAD_FENCED');
        }
        if (error instanceof Error && error.name === 'MastraThreadActorMismatchError') {
          return turnFailure('VICT_AGENT_THREAD_ACTOR_MISMATCH');
        }
        return turnFailure('VICT_AGENT_TURN_FAILED');
      }

      emit({ kind: 'response.started' });

      // 3. Normalize the stream deterministically; sanitize every failure.
      let completedText = '';
      let usage: AgentStreamUsage | undefined;
      let status: AgentTurnOutcome['status'] = 'completed';
      let errorCode: string | undefined;
      let toolLimitExceeded = false;
      const pendingToolCalls = new Map<string, string>();

      try {
        for await (const chunk of stream.fullStream) {
          const type = (chunk as { type?: string }).type;
          const payload = (chunk as { payload?: Record<string, unknown> }).payload ?? {};
          // Declared trust policy for model-supplied metadata: a tool NAME
          // is trusted only when it matches a PINNED helper tool; a tool
          // CALL ID must be a bounded safe identifier. Anything else is
          // normalized to the stable placeholder before it can appear in
          // normalized events (never forwarded as trusted metadata).
          const trustToolName = (value: unknown): string => {
            const raw = typeof value === 'string' ? value : '';
            return this.#pinnedToolNames.has(raw) ? raw : UNTRUSTED_TOOL_METADATA_PLACEHOLDER;
          };
          const trustToolCallId = (value: unknown): string => {
            const raw = typeof value === 'string' ? value : '';
            return TOOL_CALL_ID_PATTERN.test(raw) ? raw : UNTRUSTED_TOOL_METADATA_PLACEHOLDER;
          };
          switch (type) {
            case 'tool-call': {
              const toolCallId = trustToolCallId(payload.toolCallId);
              const toolName = trustToolName(payload.toolName);
              pendingToolCalls.set(toolCallId, toolName);
              emit({ kind: 'tool.requested', toolCallId, toolName });
              emit({ kind: 'tool.started', toolCallId, toolName });
              break;
            }
            case 'tool-result': {
              const toolCallId = trustToolCallId(payload.toolCallId);
              const toolName =
                trustToolName(payload.toolName) === UNTRUSTED_TOOL_METADATA_PLACEHOLDER
                  ? (pendingToolCalls.get(toolCallId) ?? UNTRUSTED_TOOL_METADATA_PLACEHOLDER)
                  : (payload.toolName as string);
              const result = payload.result as
                { victHelperFailure?: string; error?: unknown } | undefined;
              // Mastra reports a schema-rejected tool input as a tool
              // result carrying `{ error: true }` (with the sanitized
              // message from our Standard-Schema wrapper).
              const failed =
                result?.victHelperFailure !== undefined ||
                result?.error === true ||
                payload.isError === true;
              if (result?.victHelperFailure === 'VICT_HELPER_TOOL_LIMIT_EXCEEDED') {
                toolLimitExceeded = true;
              }
              if (failed) {
                emit({ kind: 'tool.failed', toolCallId, toolName, code: 'VICT_TOOL_FAILED' });
              } else {
                emit({ kind: 'tool.completed', toolCallId, toolName });
              }
              break;
            }
            case 'tool-error': {
              // A FAILED tool execution arrives as a tool-error chunk (for
              // example, a contract-invalid input, or a budget denial whose
              // envelope could not survive the helper's output contract):
              // the raw error payload is never forwarded — only the stable
              // sanitized event.
              const toolCallId = trustToolCallId(payload.toolCallId);
              const toolName =
                trustToolName(payload.toolName) === UNTRUSTED_TOOL_METADATA_PLACEHOLDER
                  ? (pendingToolCalls.get(toolCallId) ?? UNTRUSTED_TOOL_METADATA_PLACEHOLDER)
                  : (payload.toolName as string);
              emit({ kind: 'tool.failed', toolCallId, toolName, code: 'VICT_TOOL_FAILED' });
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
                    usage?: {
                      inputTokens?: unknown;
                      outputTokens?: unknown;
                      totalTokens?: unknown;
                    };
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

      // 4. Structured-output contract (declared, exact revision): its
      // ACTUAL parser semantics — captured by reference at activation —
      // run on the completed text. Failures are sanitized and stable. The
      // returned verdict object is UNTRUSTED author data: its property
      // access happens inside the protected boundary, and a hostile getter
      // collapses to the same sanitized failure instead of rejecting
      // runTurn with a raw error.
      if (status === 'completed' && this.#activation.structuredOutput !== undefined) {
        try {
          const verdict = this.#activation.structuredOutput.artifact.parse(completedText) as {
            ok?: unknown;
          };
          if (verdict?.ok !== true) {
            status = 'failed';
            errorCode = 'VICT_AGENT_STRUCTURED_OUTPUT_REJECTED';
          }
        } catch {
          status = 'failed';
          errorCode = 'VICT_AGENT_STRUCTURED_OUTPUT_FAILED';
        }
      }

      // 5. Guardrails (declared order) check the completed text — fail
      // closed. Guardrails are untrusted: a THROWING guardrail, a THROWING
      // property access on its returned verdict, and any code not declared
      // in the artifact's closed failure-code set all map to the single
      // stable framework code. Arbitrary author strings and raw canaries
      // are never embedded into public VICT error codes.
      if (status === 'completed') {
        for (const binding of this.#activation.guardrails) {
          try {
            const verdict = binding.artifact.check(completedText) as {
              ok?: unknown;
              code?: unknown;
            };
            if (verdict?.ok !== true) {
              status = 'failed';
              const returnedCode = typeof verdict?.code === 'string' ? verdict.code : undefined;
              const declared = binding.artifact.failureCodes;
              errorCode =
                returnedCode !== undefined &&
                declared !== undefined &&
                declared.includes(returnedCode)
                  ? `VICT_GUARDRAIL_${returnedCode}`
                  : GUARDRAIL_REJECTED_CODE;
              break;
            }
          } catch {
            status = 'failed';
            errorCode = GUARDRAIL_REJECTED_CODE;
            break;
          }
        }
      }

      // 6. The per-turn tool budget is enforced independently of the step
      // limit: the turn fails closed with a stable sanitized code when the
      // budget blocked an invocation. The AUTHORITATIVE denial record is
      // the turn scope's flag — set at the gate itself — so the failure
      // does not depend on any denial envelope surviving the helper's
      // application output contract.
      if (status === 'completed') {
        const scope = this.#turnScope.getStore();
        if (toolLimitExceeded || scope?.budgetDenied === true) {
          status = 'failed';
          errorCode = 'VICT_AGENT_TOOL_LIMIT_EXCEEDED';
        }
      }

      // 7. Terminal milestones + usage.
      if (usage !== undefined) {
        emit({ kind: 'usage.updated', usage });
      }
      if (status === 'completed') {
        // Durable-before-terminal ordering: the conversation content of
        // THIS turn must be durably present in the dedicated store (a NEW
        // message beyond this turn's baseline — never merely queue-idle,
        // never merely any historical message) BEFORE the memory/completion
        // milestones are emitted, so the milestones are truthful and the
        // deletion fence cannot be released ahead of the data. A persistence
        // failure is NEVER swallowed into a success milestone: the turn
        // fails with the stable persistence code instead.
        this.#knownThreads.add(request.threadId);
        let settled = true;
        try {
          await this.#memory.settled();
          await this.#awaitMemoryQuiescence();
          settled = false;
          const durable = await this.#awaitDurableTurnPersistence(
            request.threadId,
            memoryResource,
            baselineMessages,
          );
          settled = durable;
        } catch {
          settled = false;
        }
        if (!settled) {
          return turnFailure('VICT_AGENT_TURN_PERSISTENCE_UNCONFIRMED');
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
        this.#knownThreads.add(request.threadId);
        emit({ kind: 'response.cancelled' });
        return {
          status,
          events,
          ...(usage !== undefined ? { usage } : {}),
          ...(traceId !== undefined ? { traceId } : {}),
        };
      }
      return turnFailure(errorCode ?? 'VICT_AGENT_TURN_FAILED');
    } finally {
      releaseThread?.();
    }
  }

  /**
   * Ensure the thread exists and is owned by the VICT actor. Ownership is
   * an ACTOR/RESOURCE binding, never a bare thread-presence cache:
   * - the process-local cache stores the owning actor per thread;
   * - a cache hit under a DIFFERENT actor is refused;
   * - the store's thread record is checked for its immutable resource
   *   binding, so a thread already associated with actor A is never usable
   *   by actor B across close/reopen either.
   */
  async #ensureThread(threadId: string, resourceId: string): Promise<string> {
    const cachedOwner = this.#threadOwners.get(threadId);
    if (cachedOwner !== undefined) {
      if (cachedOwner !== resourceId) {
        throw new VictMastraAdapterError(
          'VICT_AGENT_THREAD_ACTOR_MISMATCH',
          'The thread is already associated with a different actor; cross-actor thread use is refused.',
        );
      }
      return threadId;
    }
    const domain = await this.#store.getStore('memory');
    if (domain === undefined) {
      throw new VictMastraAdapterError(
        'VICT_AGENT_TURN_FAILED',
        'VICT_MASTRA_MEMORY_DOMAIN_UNAVAILABLE',
      );
    }
    // Unscoped existence check first: a thread that exists under ANOTHER
    // resource is refused (never re-created or hijacked under this actor).
    const unscoped = await domain.getThreadById({ threadId });
    if (unscoped !== null && unscoped !== undefined) {
      if (unscoped.resourceId !== resourceId) {
        throw new VictMastraAdapterError(
          'VICT_AGENT_THREAD_ACTOR_MISMATCH',
          'The thread is already associated with a different actor; cross-actor thread use is refused.',
        );
      }
      this.#threadOwners.set(threadId, resourceId);
      return threadId;
    }
    await this.#memory.createThread({
      threadId,
      resourceId,
      title: `vict-conversation-${threadId}`,
      metadata: { victResourceId: resourceId, victThread: threadId },
    });
    this.#threadOwners.set(threadId, resourceId);
    return threadId;
  }
}
