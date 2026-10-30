import type { AgentCursor } from '$lib/designer/agent-edits.js';
const sameSource = (a: AgentCursor, b: AgentCursor) => a.documentId === b.documentId && a.revision === b.revision && a.digest === b.digest && a.epoch === b.epoch;
export const TASK_CONTEXT_TTL_MS = 30 * 60_000;
/** Server-owned successful source facts. Public prose cannot populate this store. */
export function createTaskContextStore(now: () => number = Date.now) {
  type Entry = { cursor: AgentCursor; contextIdentity: string; request: string; touched: number; facts: { query: unknown; result: unknown }[] };
  const entries = new Map<string, Entry>();
  const key = (owner: string, cursor: AgentCursor) => `${owner}\n${cursor.documentId}`;
  const prune = () => { for (const [id, entry] of entries) if (now() - entry.touched >= TASK_CONTEXT_TTL_MS) entries.delete(id); while (entries.size > 32) entries.delete(entries.keys().next().value!); };
  return {
    snapshot(owner: string, cursor: AgentCursor, contextIdentity = 'source-only') {
      prune(); const entry = entries.get(key(owner, cursor));
      if (!entry || !sameSource(entry.cursor, cursor) || entry.contextIdentity !== contextIdentity || !entry.facts.length) return undefined;
      return { schema: 'vict.studio-task-facts@1', cursor: { ...entry.cursor }, contextIdentity, previousRequest: entry.request, facts: JSON.parse(JSON.stringify(entry.facts)) as Entry['facts'],
        scope: 'Host-retained source reads at this exact session and source cursor. Current request supersedes earlier target wording. Paged facts retain their original coverage; they do not prove appearance, interaction or completion. Never replay edits.' };
    },
    retain(owner: string, cursor: AgentCursor, request: string, query: unknown, result: unknown, contextIdentity = 'source-only') {
      prune();
      if (!query || typeof query !== 'object' || !['nodes', 'source', 'sources', 'state', 'registry', 'capabilities'].includes(String((query as { section?: unknown }).section))) return;
      if (!result || typeof result !== 'object' || (result as { ok?: unknown }).ok === false) return;
      const encoded = JSON.stringify({ query, result }); if (encoded.length > 12_000) return;
      const id = key(owner, cursor); let entry = entries.get(id);
      if (!entry || !sameSource(entry.cursor, cursor) || entry.contextIdentity !== contextIdentity) entry = { cursor: { ...cursor }, contextIdentity, request, touched: now(), facts: [] };
      entry.facts = entry.facts.filter(fact => JSON.stringify(fact.query) !== JSON.stringify(query)); entry.facts.push(JSON.parse(encoded));
      while (entry.facts.length > 6 || JSON.stringify(entry.facts).length > 36_000) entry.facts.shift();
      entry.touched = now(); entry.request = request; entries.set(id, entry); prune();
    },
  };
}
export const agentTaskContexts = createTaskContextStore();
