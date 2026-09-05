import type {
  AgentConversationExport,
  AgentConversationMemoryExportPort,
  AgentMemoryDeletionPort,
} from '@vict/runtime';
import type { LibSQLStore } from '@mastra/libsql';

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
    const domain = await this.#options.store.getStore('memory');
    if (domain === undefined) {
      throw new Error('VICT_MASTRA_MEMORY_DOMAIN_UNAVAILABLE');
    }
    // Ownership-scoped existence check: the thread is looked up under the
    // composing actor's derived resource id, so an actor can never delete
    // (or appear to have deleted) another actor's thread.
    const thread = await domain.getThreadById({
      threadId,
      resourceId: mastraResourceIdForActor(this.#options.actorId),
    });
    if (thread === null || thread === undefined) {
      // Idempotent: already deleted → truthful receipt with deleted=false.
      return { deleted: false };
    }
    // The pinned store's schema has no foreign keys: thread deletion does
    // not cascade. Governed deletion removes the messages explicitly
    // (children before parent), then the thread row itself.
    const listed = await domain.listMessages({
      threadId,
      resourceId: mastraResourceIdForActor(this.#options.actorId),
    });
    if (listed.messages.length > 0) {
      await domain.deleteMessages(listed.messages.map((message) => message.id));
    }
    await domain.deleteThread({ threadId });
    return { deleted: true };
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
