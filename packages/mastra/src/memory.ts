import type {
  AgentConversationExport,
  AgentConversationMemoryExportPort,
  AgentMemoryDeletionPort,
} from '@vict/runtime';
import type { LibSQLStore } from '@mastra/libsql';
import { MAX_RETENTION_AGE_MS } from './storage.js';

/**
 * Mastra memory lifecycle ports (MSTR-011): governed thread deletion,
 * policy-scoped export, and an actually-executed pruning operation with an
 * injectable clock.
 *
 * Thread-ownership convention: Mastra threads are owned by an immutable
 * `resourceId` derived ONLY from the authenticated VICT actor
 * (`vict-actor-<actorId>`, amendment §8) and the thread id is bound to the
 * VICT conversation id (`vict-conv-<conversationId>`). Cross-user memory
 * access is structurally prevented: no API here accepts a thread without
 * its conversation, and ownership checks run against the derived resource.
 */

/** Derive the Mastra thread id bound to a VICT conversation id. */
export function mastraThreadIdForConversation(conversationId: string): string {
  return `vict-conv-${conversationId}`;
}

/** Derive the Mastra resource id from a VICT actor id. */
export function mastraResourceIdForActor(actorId: string): string {
  return `vict-actor-${actorId}`;
}

/** Reverse derivation (used for ownership verification on export). */
export function conversationIdForThreadId(threadId: string): string | undefined {
  return threadId.startsWith('vict-conv-') ? threadId.slice('vict-conv-'.length) : undefined;
}

/** Options for the memory lifecycle implementation. */
export interface MastraMemoryLifecycleOptions {
  readonly store: LibSQLStore;
  /** Injected clock (epoch ms) — pruning never guesses by sleeping. */
  readonly clock?: () => number;
  /** Actor id that owns this composition (single-actor envelope). */
  readonly actorId: string;
  /**
   * The process-local thread coordinator shared with the adapter. When
   * wired, governed deletion fences the thread and waits for in-flight
   * turns to fully settle BEFORE touching the store, so a completed
   * deletion can never be partially undone by a still-running turn.
   */
  readonly threadCoordinator?: MastraThreadCoordinator;
}

/**
 * Structured, non-echoing thread-coordination failure.
 *
 * - `VICT_AGENT_THREAD_FENCED`: the thread was fenced by governed deletion
 *   (deleted conversations never accept new turns in this process);
 * - `VICT_AGENT_THREAD_ACTOR_MISMATCH`: the thread is already associated
 *   with a different actor.
 */
export class MastraThreadFenceError extends Error {
  readonly code: 'VICT_AGENT_THREAD_FENCED' | 'VICT_AGENT_THREAD_ACTOR_MISMATCH';

  constructor(code: 'VICT_AGENT_THREAD_FENCED' | 'VICT_AGENT_THREAD_ACTOR_MISMATCH') {
    super(
      code === 'VICT_AGENT_THREAD_FENCED'
        ? 'The conversation thread is fenced by governed deletion; new turns are refused in this process.'
        : 'The conversation thread is associated with a different actor; cross-actor thread use is refused.',
    );
    this.name =
      code === 'VICT_AGENT_THREAD_FENCED'
        ? 'MastraThreadFenceError'
        : 'MastraThreadActorMismatchError';
    this.code = code;
  }
}

interface ThreadFenceState {
  /** The actor currently (or most recently) using the thread. */
  owner: string | undefined;
  /** In-flight turns holding the thread. */
  active: number;
  /** Set by governed deletion; fenced threads refuse new turns. */
  fenced: boolean;
  /** Waiters resolved when the active count reaches zero. */
  waiters: Array<() => void>;
}

/**
 * Process-local thread coordination between turns and governed deletion
 * (the local single-process envelope's fencing mechanism).
 *
 * Causal rule: a turn HOLDS its thread from start until its final
 * persistence barrier; deletion FENCES the thread first and waits until no
 * turn holds it, then deletes. Therefore no pending save of an in-flight
 * turn can recreate messages after a completed deletion, and a turn that
 * starts after fencing is refused (deleted conversations stay deleted).
 * Barriers are promise-based — no timing sleeps — and concurrency-safe
 * within the documented single-process envelope.
 */
export class MastraThreadCoordinator {
  readonly #threads = new Map<string, ThreadFenceState>();

  #stateFor(threadId: string): ThreadFenceState {
    let state = this.#threads.get(threadId);
    if (state === undefined) {
      state = { owner: undefined, active: 0, fenced: false, waiters: [] };
      this.#threads.set(threadId, state);
    }
    return state;
  }

  /**
   * Begin one turn on the thread: binds the thread to the actor (a thread
   * already associated with another actor is refused) and holds it against
   * deletion until `release()`. Fenced threads refuse new turns.
   */
  beginTurn(threadId: string, resourceId: string): { release(): void } {
    const state = this.#stateFor(threadId);
    if (state.fenced) {
      throw new MastraThreadFenceError('VICT_AGENT_THREAD_FENCED');
    }
    if (state.owner !== undefined && state.owner !== resourceId) {
      throw new MastraThreadFenceError('VICT_AGENT_THREAD_ACTOR_MISMATCH');
    }
    state.owner = resourceId;
    state.active += 1;
    let released = false;
    return {
      release: () => {
        if (released) {
          return;
        }
        released = true;
        state.active -= 1;
        if (state.active === 0) {
          const waiters = state.waiters.splice(0);
          for (const waiter of waiters) {
            waiter();
          }
        }
      },
    };
  }

  /**
   * Fence the thread for governed deletion: refuse new turns and resolve
   * only when no in-flight turn still holds the thread. Idempotent.
   */
  async fence(threadId: string): Promise<void> {
    const state = this.#stateFor(threadId);
    state.fenced = true;
    while (state.active > 0) {
      await new Promise<void>((resolve) => {
        state.waiters.push(resolve);
      });
    }
  }

  /** Test/observability probe: is the thread currently fenced? */
  isFenced(threadId: string): boolean {
    return this.#threads.get(threadId)?.fenced === true;
  }
}

/**
 * The memory-side deletion port: deletes the Mastra thread bound to the
 * VICT conversation idempotently. Deleting a thread removes its messages
 * and thread-scoped memory state through the pinned store's governed
 * deletion API.
 */
export class MastraMemoryDeletionPort implements AgentMemoryDeletionPort {
  readonly #options: MastraMemoryLifecycleOptions;

  constructor(options: MastraMemoryLifecycleOptions) {
    this.#options = options;
  }

  async deleteConversationThread(conversationId: string): Promise<{ readonly deleted: boolean }> {
    const threadId = mastraThreadIdForConversation(conversationId);
    // Fence FIRST and wait for any in-flight turn on this thread to fully
    // settle: after the deletion completes, no pending save of a turn can
    // recreate messages, and new turns on the deleted thread are refused.
    if (this.#options.threadCoordinator !== undefined) {
      await this.#options.threadCoordinator.fence(threadId);
    }
    const domain = await this.#options.store.getStore('memory');
    if (domain === undefined) {
      throw new Error('VICT_MASTRA_MEMORY_DOMAIN_UNAVAILABLE');
    }
    // Ownership-scoped existence check: the thread is looked up under the
    // composing actor's derived resource id, so an actor can never delete
    // (or appear to have deleted) another actor's thread.
    const resourceId = mastraResourceIdForActor(this.#options.actorId);
    //
    // Governed deletion with bounded RECONCILIATION rounds (MSTR-011):
    // the pinned memory save queue is debounced, so after the fenced
    // in-flight turn is done, a finite number of straggler debounced saves
    // may still land. Causality is enforced by the FENCE (the turn cannot
    // be running) plus idempotent verify-and-delete rounds bounded by the
    // documented debounce window — a completed deletion stays complete.
    let deleted = false;
    const RECONCILIATION_ROUNDS = 8;
    const SAVE_DEBOUNCE_BOUND_MS = 150; // > documented 100ms debounce
    for (let round = 0; round < RECONCILIATION_ROUNDS; round += 1) {
      const thread = await domain.getThreadById({ threadId, resourceId });
      const listed = await domain.listMessages({ threadId, resourceId });
      if ((thread === null || thread === undefined) && listed.messages.length === 0) {
        // Stable empty state: the deletion is complete and STAYS complete.
        return { deleted };
      }
      // The pinned store's schema has no foreign keys: thread deletion
      // does not cascade. Governed deletion removes the messages
      // explicitly (children before parent), then the thread row itself.
      if (listed.messages.length > 0) {
        await domain.deleteMessages(listed.messages.map((message) => message.id));
        deleted = true;
      }
      if (thread !== null && thread !== undefined) {
        await domain.deleteThread({ threadId });
        deleted = true;
      }
      // Let the debounce window elapse before verifying stability.
      await new Promise((resolve) => setTimeout(resolve, SAVE_DEBOUNCE_BOUND_MS));
    }
    throw new Error(
      'VICT_MASTRA_MEMORY_DELETION_INCOMPLETE: the conversation thread did not reach a stable empty state within the reconciliation bound.',
    );
  }
}

/**
 * The memory-side export port: produces the classification-policy export
 * for one conversation (message text, roles, ordering, thread creation
 * time). Credentials, registry data, traces, and operational history are
 * structurally absent — this port can only read the memory domain.
 */
export class MastraConversationExportPort implements AgentConversationMemoryExportPort {
  readonly #options: MastraMemoryLifecycleOptions;

  constructor(options: MastraMemoryLifecycleOptions) {
    this.#options = options;
  }

  async exportConversationThread(
    conversationId: string,
  ): Promise<AgentConversationExport | undefined> {
    const domain = await this.#options.store.getStore('memory');
    if (domain === undefined) {
      throw new Error('VICT_MASTRA_MEMORY_DOMAIN_UNAVAILABLE');
    }
    const threadId = mastraThreadIdForConversation(conversationId);
    const thread = await domain.getThreadById({
      threadId,
      resourceId: mastraResourceIdForActor(this.#options.actorId),
    });
    if (thread === null || thread === undefined) {
      return undefined;
    }
    const listed = await domain.listMessages({
      threadId,
      resourceId: mastraResourceIdForActor(this.#options.actorId),
    });
    const messages = listed.messages.map((message, index) => ({
      seq: index + 1,
      role: (message.role === 'assistant' || message.role === 'system' || message.role === 'user'
        ? message.role
        : 'assistant') as 'user' | 'assistant' | 'system',
      createdAt: Date.parse(String(message.createdAt)),
      text: extractText(message.content),
    }));
    return {
      conversationId,
      actorId: this.#options.actorId,
      threadCreatedAt: Date.parse(String(thread.createdAt)),
      messages,
    };
  }
}

function extractText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (typeof content === 'object' && content !== null) {
    // MastraMessageContentV2: { format: 2, parts: [{ type: 'text', text }] }.
    const parts = (content as { parts?: ReadonlyArray<{ type?: string; text?: string }> }).parts;
    if (Array.isArray(parts)) {
      return parts
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text as string)
        .join('');
    }
    // Legacy: { content: [...] } or plain text content.
    const legacy = (content as { content?: unknown }).content;
    if (typeof legacy === 'string') {
      return legacy;
    }
    if (Array.isArray(legacy)) {
      return legacy
        .filter(
          (part) =>
            (part as { type?: string }).type === 'text' &&
            typeof (part as { text?: string }).text === 'string',
        )
        .map((part) => (part as { text: string }).text)
        .join('');
    }
  }
  return '';
}

/** The result of one pruning execution. */
export interface MastraMemoryPruneResult {
  /** Prune results per pruned table (domain, table, deleted count). */
  readonly tables: ReadonlyArray<{
    readonly domain: string;
    readonly table: string;
    readonly deleted: number;
  }>;
  /** The "as of" instant used for the age computation (epoch ms). */
  readonly prunedAsOf: number;
}

/**
 * Actually execute retention pruning against the dedicated Mastra store
 * (MSTR-011: an executed mechanism, not configuration).
 *
 * Injectable-clock discipline: the pinned store compares anchors against
 * `Date.now()` with a `maxAge` duration. To prune "as of" an arbitrary
 * injectable instant `asOf`, the lifecycle computes an equivalent policy
 * age `Date.now() - (asOf - retentionAgeMs)` so the SAME boundary is
 * evaluated regardless of wall-clock skew. `asOf` in the future is
 * rejected (fail closed) rather than silently clamped.
 */
export async function executeMemoryPrune(options: {
  readonly store: LibSQLStore;
  readonly retention: {
    readonly messagesMaxAgeMs?: number;
    readonly threadsMaxAgeMs?: number;
    readonly spansMaxAgeMs?: number;
  };
  /** Injected "as of" instant (epoch ms). */
  readonly now?: () => number;
}): Promise<MastraMemoryPruneResult> {
  // Pruning inputs are validated like retention bounds: positive finite
  // integers within the documented limit.
  for (const [key, value] of Object.entries(options.retention)) {
    if (
      value !== undefined &&
      (typeof value !== 'number' ||
        !Number.isFinite(value) ||
        !Number.isInteger(value) ||
        value <= 0 ||
        value > MAX_RETENTION_AGE_MS)
    ) {
      throw new Error(
        `VICT_MASTRA_PRUNE_INPUT_INVALID: the ${key} retention input must be a positive finite integer of at most ${MAX_RETENTION_AGE_MS} ms.`,
      );
    }
  }
  const now = options.now ?? (() => Date.now());
  const wallNow = Date.now();
  const asOf = now();
  if (asOf > wallNow + 60_000) {
    throw new Error(
      'VICT_MASTRA_PRUNE_ASOF_INVALID: the injected as-of instant may not lie in the future.',
    );
  }

  const policies: Record<string, { maxAge: string }> = {};
  const effectiveAgeMs = (retentionAgeMs: number): number =>
    Math.max(1, wallNow - (asOf - retentionAgeMs));
  if (options.retention.messagesMaxAgeMs !== undefined) {
    policies.messages = { maxAge: `${effectiveAgeMs(options.retention.messagesMaxAgeMs)}ms` };
  }
  if (options.retention.threadsMaxAgeMs !== undefined) {
    policies.threads = { maxAge: `${effectiveAgeMs(options.retention.threadsMaxAgeMs)}ms` };
  }
  if (options.retention.spansMaxAgeMs !== undefined) {
    policies.spans = { maxAge: `${effectiveAgeMs(options.retention.spansMaxAgeMs)}ms` };
  }

  const results: Array<{ domain: string; table: string; deleted: number }> = [];
  if (Object.keys(policies).length === 0) {
    return { tables: results, prunedAsOf: asOf };
  }

  // Prune per-domain so table keys map to their owning domain deterministically.
  const memoryPolicies: Record<string, { maxAge: string }> = {};
  for (const key of ['messages', 'threads'] as const) {
    if (policies[key] !== undefined) {
      memoryPolicies[key] = policies[key]!;
    }
  }
  if (Object.keys(memoryPolicies).length > 0) {
    const memoryDomain = await options.store.getStore('memory');
    if (memoryDomain !== undefined) {
      const pruned = await memoryDomain.prune(memoryPolicies as never);
      for (const entry of pruned) {
        results.push({ domain: entry.domain, table: entry.table, deleted: entry.deleted });
      }
    }
  }
  if (policies.spans !== undefined) {
    const observabilityDomain = await options.store.getStore('observability');
    if (observabilityDomain !== undefined) {
      const pruned = await observabilityDomain.prune({ spans: policies.spans } as never);
      for (const entry of pruned) {
        results.push({ domain: entry.domain, table: entry.table, deleted: entry.deleted });
      }
    }
  }

  return { tables: results, prunedAsOf: asOf };
}
