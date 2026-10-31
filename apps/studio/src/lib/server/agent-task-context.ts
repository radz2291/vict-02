import type { AgentCursor } from '$lib/designer/agent-edits.js';
const sameSource = (a: AgentCursor, b: AgentCursor) =>
  a.documentId === b.documentId &&
  a.revision === b.revision &&
  a.digest === b.digest &&
  a.epoch === b.epoch;
/** Server-owned successful source facts. Public prose cannot populate this store. */
export function createTaskContextStore() {
  type Entry = {
    cursor: AgentCursor;
    contextIdentity: string;
    request: string;
    facts: { query: unknown; result: unknown }[];
  };
  const entries = new Map<string, Entry>();
  const key = (owner: string, cursor: AgentCursor) => `${owner}\n${cursor.documentId}`;
  return {
    snapshot(owner: string, cursor: AgentCursor, contextIdentity = 'source-only') {
      const entry = entries.get(key(owner, cursor));
      if (
        !entry ||
        !sameSource(entry.cursor, cursor) ||
        entry.contextIdentity !== contextIdentity ||
        !entry.facts.length
      )
        return undefined;
      return {
        schema: 'vict.studio-task-facts@2',
        cursor: { ...entry.cursor },
        contextIdentity,
        previousRequest: entry.request,
        facts: JSON.parse(JSON.stringify(entry.facts)) as Entry['facts'],
        scope:
          'Host-retained source reads at this exact session and source cursor. Current request supersedes earlier target wording. Paged facts retain their original coverage; they do not prove appearance, interaction or completion. Never replay edits.',
      };
    },
    retain(
      owner: string,
      cursor: AgentCursor,
      request: string,
      query: unknown,
      result: unknown,
      contextIdentity = 'source-only',
    ) {
      if (
        !query ||
        typeof query !== 'object' ||
        !['nodes', 'source', 'sources', 'state', 'registry', 'capabilities'].includes(
          String((query as { section?: unknown }).section),
        )
      )
        return;
      if (!result || typeof result !== 'object' || (result as { ok?: unknown }).ok === false)
        return;
      const encoded = JSON.stringify({ query, result });
      const id = key(owner, cursor);
      let entry = entries.get(id);
      if (!entry || !sameSource(entry.cursor, cursor) || entry.contextIdentity !== contextIdentity)
        entry = { cursor: { ...cursor }, contextIdentity, request, facts: [] };
      entry.facts = entry.facts.filter(
        (fact) => JSON.stringify(fact.query) !== JSON.stringify(query),
      );
      entry.facts.push(JSON.parse(encoded));
      entry.request = request;
      entries.set(id, entry);
    },
  };
}
export const agentTaskContexts = createTaskContextStore();
