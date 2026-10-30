import { STUDIO_TOOL_EVIDENCE_SCHEMA, TOOL_EVIDENCE_PAYLOAD_BYTES, TOOL_EVIDENCE_RUN_BYTES, isStudioToolEvidence, type EvidenceTool, type StudioToolEvidence } from '$lib/designer/tool-evidence.js';

/** Server-only bounded projection. Payload values are untrusted display data. */
export function safeToolPayload(value: unknown, secrets: readonly string[] = [], requestedBytes = TOOL_EVIDENCE_PAYLOAD_BYTES) {
  const maxBytes = Math.max(1, Math.min(256_000, requestedBytes));
  let redacted = false;
  let truncated = false;
  let visited = 0;
  const seen = new WeakSet<object>();
  const protect = (text: string) => {
    let safe = text.replace(/\bBearer\s+[^\s"']+|\bsk-[A-Za-z0-9_-]{8,}/gi, () => { redacted = true; return '[redacted]'; });
    for (const secret of secrets) if (secret.length >= 8 && safe.includes(secret)) { safe = safe.split(secret).join('[redacted]'); redacted = true; }
    if (safe.length > Math.max(12_000, maxBytes)) { safe = safe.slice(0, Math.max(12_000, maxBytes)); truncated = true; }
    return safe;
  };
  const project = (input: unknown, depth: number): unknown => {
    if (++visited > (maxBytes > TOOL_EVIDENCE_PAYLOAD_BYTES ? 20_000 : 2_000) || depth > 12) { truncated = true; return '[truncated]'; }
    if (typeof input === 'string') return protect(input);
    if (input === null || typeof input === 'boolean' || typeof input === 'number') return input;
    if (typeof input !== 'object') { truncated = true; return '[unavailable value]'; }
    if (seen.has(input)) { truncated = true; return '[repeated reference]'; }
    seen.add(input);
    if (Array.isArray(input)) {
      if (input.length > 100) truncated = true;
      return Array.from({ length: Math.min(input.length, 100) }, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
        if (!descriptor || !('value' in descriptor)) { truncated = true; return '[unavailable accessor]'; }
        return project(descriptor.value, depth + 1);
      });
    }
    const result: Record<string, unknown> = Object.create(null);
    const entries = Object.entries(Object.getOwnPropertyDescriptors(input));
    if (entries.length > 100) truncated = true;
    for (const [key, descriptor] of entries.slice(0, 100)) {
      const safeKey = protect(key);
      if (/authorization|api.?key|secret|password|credential|cookie|access.?token|refresh.?token/i.test(key)) { result[safeKey] = '[redacted]'; redacted = true; }
      else if (!('value' in descriptor)) { result[safeKey] = '[unavailable accessor]'; truncated = true; }
      else result[safeKey] = project(descriptor.value, depth + 1);
    }
    return result;
  };
  let text: string;
  try { text = JSON.stringify(project(value, 0), null, 2); }
  catch { text = '[unavailable payload]'; truncated = true; }
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > maxBytes) {
    // fatal:false can replace a partial UTF-8 character; trim until the encoded bound holds.
    text = new TextDecoder().decode(bytes.slice(0, maxBytes));
    while (new TextEncoder().encode(text).byteLength > maxBytes) text = text.slice(0, -1);
    truncated = true;
  }
  return { text, redacted, truncated };
}

export function createToolEvidenceProducer(runId: string, enabled: boolean, deliver: (event: StudioToolEvidence) => void, secrets: readonly string[], retainOriginal?: (tool: EvidenceTool, callId: string, phase: 'input' | 'result', value: unknown) => void) {
  let sequence = 0;
  let bytes = 0;
  let closed = false;
  const phases = new Set<string>();
  return {
    send(tool: EvidenceTool, callId: string | undefined, phase: 'input' | 'result', value: unknown, status?: StudioToolEvidence['status'], unavailableReason?: StudioToolEvidence['unavailableReason']) {
      if (!enabled || closed || !callId) return;
      const key = `${tool}:${callId}:${phase}`;
      if (phases.has(key)) return;
      if (!unavailableReason) retainOriginal?.(tool, callId, phase, value);
      const payload = unavailableReason ? undefined : safeToolPayload(value, secrets);
      const nextBytes = payload ? new TextEncoder().encode(payload.text).byteLength : 0;
      if (bytes + nextBytes > TOOL_EVIDENCE_RUN_BYTES) unavailableReason = 'budget';
      const event: StudioToolEvidence = {
        type: 'tool-evidence', schema: STUDIO_TOOL_EVIDENCE_SCHEMA, runId, sequence: sequence + 1, tool, callId, phase,
        availability: unavailableReason ? 'unavailable' : 'available',
        ...(unavailableReason ? { unavailableReason } : { payload }), ...(status ? { status } : {}),
      };
      if (!isStudioToolEvidence(event)) return;
      phases.add(key);
      sequence++;
      if (!unavailableReason) bytes += nextBytes;
      deliver(event);
    },
    close() { closed = true; },
  };
}
