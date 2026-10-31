import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TOOL_ARCHIVE_SCHEMA, isToolArchiveReference, type EvidenceTool, type ToolArchiveReference } from '$lib/designer/tool-evidence.js';
import { sanitizeToolOriginal } from './tool-evidence.js';
export { TOOL_ARCHIVE_SCHEMA };
/** Legacy @1 expiry only. Newly retained @2 originals have no policy expiry. */
export const TOOL_ARCHIVE_TTL_MS = 30 * 60_000;

/** Disk-backed per-process/session sanitized originals. No raw payload or owner
 * token is stored. Only a page is loaded for reads; no capacity/TTL eviction. */
export function createToolArchive(now: () => number = Date.now, directoryRoot = tmpdir()) {
  const salt = randomUUID();
  const ownerKey = (owner: string) => createHash('sha256').update(salt).update(owner).digest('hex');
  let directory: Promise<string> | undefined;
  const storage = () => directory ??= mkdtemp(join(directoryRoot, 'vict-tool-evidence-'));
  return {
    async retain(owner: string, runId: string, tool: EvidenceTool, callId: string, phase: 'input' | 'result', value: unknown, secrets: readonly string[]): Promise<ToolArchiveReference> {
      const payload = sanitizeToolOriginal(value, secrets);
      const reference: ToolArchiveReference = { type: 'tool-evidence-archive', schema: TOOL_ARCHIVE_SCHEMA, runId, callId, tool, phase, id: randomUUID(), expiresAt: null, totalCharacters: payload.text.length, redacted: payload.redacted, truncated: payload.truncated };
      const root = await storage();
      // UTF-16 code units preserve the existing character offsets, including
      // page boundaries inside surrogate pairs, with exact bounded random reads.
      await writeFile(join(root, reference.id + '.text'), Buffer.from(payload.text, 'utf16le'), { mode: 0o600, flag: 'wx' });
      await writeFile(join(root, reference.id + '.json'), JSON.stringify({ owner: ownerKey(owner), reference }), { mode: 0o600, flag: 'wx' });
      return reference;
    },
    async page(owner: string, id: string, offset = 0, limit = 6000) {
      if (!/^[0-9a-f-]{36}$/.test(id) || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 6000 || !directory) return undefined;
      const root = await directory;
      let entry: { owner: string; reference: ToolArchiveReference };
      try { entry = JSON.parse(await readFile(join(root, id + '.json'), 'utf8')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
      if (entry.owner !== ownerKey(owner) || !isToolArchiveReference(entry.reference) || entry.reference.id !== id || entry.reference.expiresAt !== null && entry.reference.expiresAt <= now() || offset > entry.reference.totalCharacters) return undefined;
      const count = Math.min(limit, entry.reference.totalCharacters - offset), bytes = Buffer.alloc(count * 2);
      const file = await open(join(root, id + '.text'), 'r');
      try {
        let read = 0;
        while (read < bytes.length) { const result = await file.read(bytes, read, bytes.length - read, offset * 2 + read); if (!result.bytesRead) throw Error('Incomplete evidence archive storage.'); read += result.bytesRead; }
      } finally { await file.close(); }
      const text = bytes.toString('utf16le');
      return { ...entry.reference, text, offset, nextOffset: offset + text.length < entry.reference.totalCharacters ? offset + text.length : null,
        retention: entry.reference.expiresAt === null ? 'Complete sanitized exchange retained on disk for this server process and owning session, without policy expiry or capacity eviction. Restart or actual storage failure can remove access. Tools are never rerun.' : 'Legacy sanitized exchange; original expiry still applies. Tools are never rerun.' };
    },
  };
}
export const toolEvidenceArchive = createToolArchive();
