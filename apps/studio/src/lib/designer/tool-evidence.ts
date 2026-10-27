/** Optional Studio presentation projection, never a vict.agent-stream@1 frame. */
export const STUDIO_TOOL_EVIDENCE_SCHEMA = 'vict.studio-tool-evidence@1' as const;
export const TOOL_EVIDENCE_PAYLOAD_BYTES = 8_000;
export const TOOL_EVIDENCE_RUN_BYTES = 160_000;
export const TOOL_ARCHIVE_SCHEMA = 'vict.studio-tool-archive@1' as const;
export interface ToolArchiveReference { type: 'tool-evidence-archive'; schema: typeof TOOL_ARCHIVE_SCHEMA; runId: string; callId: string; tool: EvidenceTool; phase: 'input' | 'result'; id: string; expiresAt: number; totalCharacters: number; redacted: boolean; truncated: boolean }
const archiveFields = new Set(['type','schema','runId','callId','tool','phase','id','expiresAt','totalCharacters','redacted','truncated']);
export function isToolArchiveReference(value: unknown): value is ToolArchiveReference {
  if (!plain(value) || Object.keys(value).some(key=>!archiveFields.has(key))) return false;
  const v = value as unknown as ToolArchiveReference;
  return v.type === 'tool-evidence-archive' && v.schema === TOOL_ARCHIVE_SCHEMA && typeof v.id === 'string' && /^[0-9a-f-]{36}$/.test(v.id) && typeof v.runId === 'string' && id.test(v.runId) && typeof v.callId === 'string' && id.test(v.callId) && ['studio_screen_read', 'studio_screen_edit', 'studio_screen_observe'].includes(v.tool) && ['input', 'result'].includes(v.phase) && Number.isSafeInteger(v.expiresAt) && Number.isSafeInteger(v.totalCharacters) && v.totalCharacters >= 0 && v.totalCharacters <= 256_000 && typeof v.redacted === 'boolean' && typeof v.truncated === 'boolean';
}
export type EvidenceTool = 'studio_screen_read' | 'studio_screen_edit' | 'studio_screen_observe';
export interface StudioToolEvidence {
  readonly type: 'tool-evidence';
  readonly schema: typeof STUDIO_TOOL_EVIDENCE_SCHEMA;
  readonly runId: string;
  readonly sequence: number;
  readonly tool: EvidenceTool;
  readonly callId: string;
  readonly phase: 'input' | 'result';
  readonly availability: 'available' | 'unavailable';
  readonly payload?: { readonly text: string; readonly redacted: boolean; readonly truncated: boolean };
  readonly unavailableReason?: 'before-invocation' | 'not-returned' | 'budget';
  readonly status?: 'completed' | 'refused' | 'failed';
}
const id = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;
const tools: readonly string[] = ['studio_screen_read', 'studio_screen_edit', 'studio_screen_observe'];
const fields = new Set(['type', 'schema', 'runId', 'sequence', 'tool', 'callId', 'phase', 'availability', 'payload', 'unavailableReason', 'status']);
function plain(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
export function isStudioToolEvidence(value: unknown): value is StudioToolEvidence {
  if (!plain(value) || Object.keys(value).some(key => !fields.has(key))) return false;
  if (value.type !== 'tool-evidence' || value.schema !== STUDIO_TOOL_EVIDENCE_SCHEMA ||
    typeof value.runId !== 'string' || !id.test(value.runId) || typeof value.callId !== 'string' || !id.test(value.callId) ||
    typeof value.sequence !== 'number' || !Number.isSafeInteger(value.sequence) || value.sequence < 1 ||
    typeof value.tool !== 'string' || !tools.includes(value.tool) || !['input', 'result'].includes(value.phase as string)) return false;
  if (value.phase === 'input' && value.status !== undefined || value.phase === 'result' && !['completed', 'refused', 'failed'].includes(value.status as string)) return false;
  if (value.availability === 'unavailable') return value.payload === undefined && ['before-invocation', 'not-returned', 'budget'].includes(value.unavailableReason as string);
  const payload = value.payload;
  return value.availability === 'available' && value.unavailableReason === undefined && plain(payload) &&
    Object.keys(payload).length === 3 && typeof payload.text === 'string' && new TextEncoder().encode(payload.text).byteLength <= TOOL_EVIDENCE_PAYLOAD_BYTES &&
    typeof payload.redacted === 'boolean' && typeof payload.truncated === 'boolean';
}
/** Local run fence. Call close() on done/Stop/disconnect, before admitting another run. */
export function createToolEvidenceConsumer(runId: string) {
  let sequence = 0;
  let closed = false;
  const phases = new Set<string>();
  return {
    accept(value: unknown): StudioToolEvidence | undefined {
      if (closed || !isStudioToolEvidence(value) || value.runId !== runId || value.sequence <= sequence) return;
      const key = `${value.tool}:${value.callId}:${value.phase}`;
      if (phases.has(key)) return;
      sequence = value.sequence;
      phases.add(key);
      return value;
    },
    close() { closed = true; },
  };
}
