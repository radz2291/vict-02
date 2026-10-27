import { randomUUID } from 'node:crypto';
import { TOOL_ARCHIVE_SCHEMA, type EvidenceTool, type ToolArchiveReference } from '$lib/designer/tool-evidence.js';
import { safeToolPayload } from './tool-evidence.js';
export { TOOL_ARCHIVE_SCHEMA };
export const TOOL_ARCHIVE_TTL_MS = 30 * 60_000;
/** Ephemeral sanitized originals, bounded globally and per run. Raw values are never retained. */
export function createToolArchive(now: () => number = Date.now) {
  type Entry = { owner: string; reference: ToolArchiveReference; text: string; bytes: number };
  const entries = new Map<string, Entry>();
  const prune = () => { for (const [id, entry] of entries) if (entry.reference.expiresAt <= now()) entries.delete(id); };
  return {
    retain(owner: string, runId: string, tool: EvidenceTool, callId: string, phase: 'input' | 'result', value: unknown, secrets: readonly string[]): ToolArchiveReference | undefined {
      prune(); const payload = safeToolPayload(value, secrets, 256_000); const bytes = new TextEncoder().encode(payload.text).byteLength;
      if ([...entries.values()].filter(item => item.reference.runId === runId).reduce((sum, item) => sum + item.bytes, 0) + bytes > 4_000_000) return;
      while (entries.size >= 512 || [...entries.values()].reduce((sum, item) => sum + item.bytes, 0) + bytes > 32_000_000) entries.delete(entries.keys().next().value!);
      const reference: ToolArchiveReference = { type: 'tool-evidence-archive', schema: TOOL_ARCHIVE_SCHEMA, runId, callId, tool, phase, id: randomUUID(), expiresAt: now() + TOOL_ARCHIVE_TTL_MS, totalCharacters: payload.text.length, redacted: payload.redacted, truncated: payload.truncated };
      entries.set(reference.id, { owner, reference, text: payload.text, bytes }); return reference;
    },
    page(owner: string, id: string, offset = 0, limit = 6000) {
      prune(); const entry = entries.get(id);
      if (!entry || entry.owner !== owner || !Number.isSafeInteger(offset) || offset < 0 || offset > entry.text.length || !Number.isSafeInteger(limit) || limit < 1 || limit > 6000) return undefined;
      const text = entry.text.slice(offset, offset + limit);
      return { ...entry.reference, text, offset, nextOffset: offset + text.length < entry.text.length ? offset + text.length : null,
        retention: 'Sanitized original exchange; bounded and ephemeral. Expiry, restart or capacity eviction removes access. Tools are never rerun to redisplay evidence.' };
    },
  };
}
export const toolEvidenceArchive = createToolArchive();
