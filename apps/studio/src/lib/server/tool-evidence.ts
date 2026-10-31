import { types } from 'node:util';
import { STUDIO_TOOL_EVIDENCE_SCHEMA, TOOL_EVIDENCE_PAYLOAD_BYTES, isStudioToolEvidence, type EvidenceTool, type StudioToolEvidence } from '$lib/designer/tool-evidence.js';

/** Full data-only JSON, without invoking getters, proxies or custom toJSON. */
export function sanitizeToolOriginal(value: unknown, secrets: readonly string[] = []) {
  let redacted = false, truncated = false;
  const protect = (text: string) => {
    let safe = text.replace(/\bBearer\s+[^\s"']+|\bsk-[A-Za-z0-9_-]{8,}/gi, () => { redacted = true; return '[redacted]'; });
    for (const secret of secrets) if (secret.length >= 8 && safe.includes(secret)) { safe = safe.split(secret).join('[redacted]'); redacted = true; }
    return safe;
  };
  type Work = { kind: 'value'; value: unknown } | { kind: 'text'; text: string } | { kind: 'leave'; value: object };
  const work: Work[] = [{ kind: 'value', value }], ancestors = new WeakSet<object>(), chunks: string[] = [];
  const unavailable = (text: string) => { truncated = true; chunks.push(JSON.stringify(text)); };
  while (work.length) {
    const item = work.pop()!;
    if (item.kind === 'text') { chunks.push(item.text); continue; }
    if (item.kind === 'leave') { ancestors.delete(item.value); continue; }
    const input = item.value;
    if (typeof input === 'string') { chunks.push(JSON.stringify(protect(input))); continue; }
    if (input === null || typeof input === 'boolean' || typeof input === 'number' && Number.isFinite(input)) { chunks.push(JSON.stringify(input)); continue; }
    if (typeof input !== 'object') { unavailable(`[unavailable ${typeof input}]`); continue; }
    if (types.isProxy(input)) { unavailable('[unavailable proxy]'); continue; }
    if (ancestors.has(input)) { unavailable('[circular reference]'); continue; }
    ancestors.add(input); work.push({ kind: 'leave', value: input });
    if (Array.isArray(input)) {
      chunks.push('['); work.push({ kind: 'text', text: ']' });
      for (let index = input.length - 1; index >= 0; index--) {
        const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
        if (!descriptor || !('value' in descriptor)) { truncated = true; work.push({ kind: 'text', text: JSON.stringify(descriptor ? '[unavailable accessor]' : '[empty slot]') }); }
        else work.push({ kind: 'value', value: descriptor.value });
        if (index) work.push({ kind: 'text', text: ',' });
      }
    } else {
      chunks.push('{'); work.push({ kind: 'text', text: '}' });
      const entries = Object.entries(Object.getOwnPropertyDescriptors(input));
      for (let index = entries.length - 1; index >= 0; index--) {
        const [key, descriptor] = entries[index]!;
        if (/authorization|api.?key|secret|password|credential|cookie|access.?token|refresh.?token/i.test(key)) { redacted = true; work.push({ kind: 'text', text: '"[redacted]"' }); }
        else if (!('value' in descriptor)) { truncated = true; work.push({ kind: 'text', text: '"[unavailable accessor]"' }); }
        else work.push({ kind: 'value', value: descriptor.value });
        work.push({ kind: 'text', text: JSON.stringify(protect(key)) + ':' });
        if (index) work.push({ kind: 'text', text: ',' });
      }
    }
  }
  return { text: chunks.join(''), redacted, truncated };
}

/** A display window only; originals are sanitized without a size policy. */
export function safeToolPayload(value: unknown, secrets: readonly string[] = [], requestedBytes = TOOL_EVIDENCE_PAYLOAD_BYTES) {
  const payload = sanitizeToolOriginal(value, secrets);
  if (!Number.isSafeInteger(requestedBytes) || requestedBytes < 1) throw Error('Invalid evidence preview window.');
  const bytes = new TextEncoder().encode(payload.text);
  if (bytes.byteLength <= requestedBytes) return payload;
  let end = requestedBytes;
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
  return { ...payload, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, end)), truncated: true };
}

export function createToolEvidenceProducer(runId: string, enabled: boolean, deliver: (event: StudioToolEvidence) => unknown, secrets: readonly string[], retainOriginal?: (tool: EvidenceTool, callId: string, phase: 'input' | 'result', value: unknown) => unknown) {
  let sequence = 0, closed = false;
  const phases = new Set<string>();
  return {
    async send(tool: EvidenceTool, callId: string | undefined, phase: 'input' | 'result', value: unknown, status?: StudioToolEvidence['status'], unavailableReason?: StudioToolEvidence['unavailableReason']) {
      if (!enabled || closed || !callId) return;
      const key = `${tool}:${callId}:${phase}`;
      if (phases.has(key)) return;
      phases.add(key);
      if (!unavailableReason && retainOriginal) {
        try { await retainOriginal(tool, callId, phase, value); }
        catch { unavailableReason = 'storage-error'; }
      }
      if (closed) return;
      const payload = unavailableReason ? undefined : retainOriginal ? safeToolPayload(value, secrets) : sanitizeToolOriginal(value, secrets);
      const event: StudioToolEvidence = {
        type: 'tool-evidence', schema: STUDIO_TOOL_EVIDENCE_SCHEMA, runId, sequence: ++sequence, tool, callId, phase,
        availability: unavailableReason ? 'unavailable' : 'available',
        ...(unavailableReason ? { unavailableReason } : { payload }), ...(status ? { status } : {}),
      };
      if (isStudioToolEvidence(event)) await deliver(event);
    },
    close() { closed = true; },
  };
}
