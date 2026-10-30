import { describe, it, expect } from 'vitest';
import { createDeterministicOfflineModel, OFFLINE_MODEL_IDENTITY } from '@victframework/mastra';
import { newScreen } from '../src/lib/designer/application.js';
import { agentContext, documentCursor } from '../src/lib/designer/agent-edits.js';
import { STUDIO_TOOL_EVIDENCE_SCHEMA, TOOL_EVIDENCE_PAYLOAD_BYTES, TOOL_EVIDENCE_RUN_BYTES, isStudioToolEvidence, createToolEvidenceConsumer, type StudioToolEvidence } from '../src/lib/designer/tool-evidence.js';
import { safeToolPayload, createToolEvidenceProducer } from '../src/lib/server/tool-evidence.js';
import { validateAgentStart, openAgentRun, cancelAgentRun, type StudioAgentEvent } from '../src/lib/server/designer-agent.js';

function setup(enabled = true) {
  const document = newScreen('Evidence fixture', 'evidence-fixture');
  const cursor = documentCursor(document, 'r1#0', crypto.randomUUID());
  const parsed = validateAgentStart({ document, cursor, prompt: 'Inspect existing source only', history: [], ...(enabled ? { toolEvidenceSchema: STUDIO_TOOL_EVIDENCE_SCHEMA } : {}) });
  if (!parsed.ok) throw new Error(parsed.message);
  const input = JSON.stringify({ request: parsed.value.prompt, untrusted_history: [], untrusted_screen: agentContext(document, cursor) });
  return { start: parsed.value, input };
}

describe('public tool evidence projection', () => {
  it('sanitizes nested secrets, accessors and cycles without executing them, and bounds UTF-8 honestly', () => {
    const secret = 'server-secret-value';
    const value: Record<string, unknown> = { apiKey: 'private', nested: { text: `Bearer abcdefgh ${secret}`, password: 'pw' }, long: '界'.repeat(9_000) };
    Object.defineProperty(value, 'getter', { enumerable: true, get() { throw new Error('must not run'); } });
    value.self = value;
    const payload = safeToolPayload(value, [secret]);
    expect(payload).toMatchObject({ redacted: true, truncated: true });
    expect(payload.text).not.toContain(secret);
    expect(payload.text).not.toContain('abcdefgh');
    expect(payload.text).not.toContain('"private"');
    expect(new TextEncoder().encode(payload.text).byteLength).toBeLessThanOrEqual(TOOL_EVIDENCE_PAYLOAD_BYTES);
    expect(safeToolPayload(Array.from({ length: 101 }, () => 1)).truncated).toBe(true);
  });

  it('has a closed opt-in schema and preserves old request compatibility', () => {
    const { start } = setup();
    expect(validateAgentStart({ ...start, toolEvidenceSchema: 'vict.studio-tool-evidence@2' }).ok).toBe(false);
    const events: StudioToolEvidence[] = [];
    const disabled = createToolEvidenceProducer('run-1', false, event => events.push(event), []);
    disabled.send('studio_screen_read', 'call-1', 'input', {});
    expect(events).toEqual([]);
    const enabled = createToolEvidenceProducer('run-1', true, event => events.push(event), []);
    enabled.send('studio_screen_read', 'call-1', 'input', { section: 'overview' });
    expect(isStudioToolEvidence(events[0])).toBe(true);
    expect(isStudioToolEvidence({ ...events[0], reasoning: 'hidden' })).toBe(false);
    expect(isStudioToolEvidence({ ...events[0], payload: { ...events[0]!.payload, raw: 'hidden' } })).toBe(false);
  });

  it('caps per-run payload traffic, marks missing data and prevents duplicate/late producer or consumer updates', () => {
    const events: StudioToolEvidence[] = [];
    const producer = createToolEvidenceProducer('run-1', true, event => events.push(event), []);
    for (let index = 0; index < 40; index++) producer.send('studio_screen_read', `call-${index}`, 'input', { text: 'x'.repeat(10_000) });
    expect(events.some(event => event.unavailableReason === 'budget')).toBe(true);
    expect(events.reduce((total, event) => total + new TextEncoder().encode(event.payload?.text ?? '').byteLength, 0)).toBeLessThanOrEqual(TOOL_EVIDENCE_RUN_BYTES);
    producer.send('studio_screen_read', 'missing', 'input', undefined, undefined, 'before-invocation');
    producer.send('studio_screen_read', 'missing', 'result', undefined, 'failed', 'not-returned');
    expect(events.at(-2)).toMatchObject({ availability: 'unavailable', unavailableReason: 'before-invocation' });
    expect(events.at(-1)).toMatchObject({ availability: 'unavailable', status: 'failed', unavailableReason: 'not-returned' });
    const consumer = createToolEvidenceConsumer('run-1');
    expect(consumer.accept({ ...events[0], runId: 'other-run' })).toBeUndefined();
    expect(consumer.accept(events[1])).toBeDefined();
    expect(consumer.accept(events[0])).toBeUndefined();
    expect(consumer.accept(events[1])).toBeUndefined();
    consumer.close();
    expect(consumer.accept(events[2])).toBeUndefined();
    const count = events.length;
    producer.close();
    producer.send('studio_screen_read', 'late', 'input', {});
    expect(events).toHaveLength(count);
  });

  it.each([false, true])('keeps actual source-read and refusal results correlated; negotiated=%s (pinned Mastra, offline provider)', async enabled => {
    const { start, input } = setup(enabled);
    const events: StudioAgentEvent[] = [];
    const model = createDeterministicOfflineModel({ script: { [input]: { kind: 'tool-chain', calls: [
      { toolName: 'studio_screen_read', args: { section: 'overview' } },
      { toolName: 'studio_screen_edit', args: { expectedRevision: 'wrong', reason: 'Invalid revision', operations: [{ op: 'remove', nodeId: 'missing' }] } },
    ], thenText: 'Public explanation: the edit was refused.' } } });
    const original = model.doStream.bind(model);
    model.doStream = async options => {
      const response = await original(options);
      return { stream: response.stream.pipeThrough(new TransformStream({
        transform(part, controller) {
          if (part.type === 'text-start') {
            // Adversarial provider-only reasoning must not cross VICT or Studio.
            // Widen only this injection seam: the public offline fixture omits reasoning.
            const injected = controller as TransformStreamDefaultController<unknown>;
            injected.enqueue({ type: 'reasoning-start', id: 'private' });
            injected.enqueue({ type: 'reasoning-delta', id: 'private', delta: 'PRIVATE_REASONING_CANARY' });
            injected.enqueue({ type: 'reasoning-end', id: 'private' });
          }
          controller.enqueue(part);
        },
      })) as typeof response.stream };
    };
    const opened = openAgentRun(`evidence-${enabled}`, start, event => events.push(event), { model: OFFLINE_MODEL_IDENTITY, modelFactory: () => model });
    if (!opened.ok) throw new Error(opened.code);
    await opened.finished;
    const evidence = events.filter((event): event is StudioToolEvidence => event.type === 'tool-evidence');
    expect(events.at(-1)).toMatchObject({ type: 'done', status: 'failed', applied: 0 });
    expect(JSON.stringify(events)).not.toContain('PRIVATE_REASONING_CANARY');
    expect(events.filter(event => event.type === 'text').map(event => event.delta).join('')).toContain('Public explanation');
    if (!enabled) expect(evidence).toEqual([]);
    else {
      expect(evidence).toHaveLength(4);
      expect(evidence.map(event => event.phase)).toEqual(['input', 'result', 'input', 'result']);
      expect(evidence.map(event => event.sequence)).toEqual([1, 2, 3, 4]);
      expect(evidence[0]!.callId).toBe(evidence[1]!.callId);
      expect(evidence[2]!.callId).toBe(evidence[3]!.callId);
      expect(JSON.parse(evidence[0]!.payload!.text)).toMatchObject({ section: 'overview' });
      expect(JSON.parse(evidence[1]!.payload!.text)).toHaveProperty('expectedRevision');
      expect(JSON.parse(evidence[2]!.payload!.text)).toHaveProperty('expectedRevision', 'wrong');
      expect(evidence[3]).toMatchObject({ status: 'refused', availability: 'available' });
      expect(JSON.parse(evidence[3]!.payload!.text)).toMatchObject({ ok: false, code: 'STUDIO_AGENT_REVISION_MISMATCH' });
      expect(events.findIndex(event => event === evidence[3])).toBeLessThan(events.findIndex(event => event.type === 'done'));
    }
  }, 120_000);

  it('fences cancellation and never attaches late evidence to the cancelled turn', async () => {
    const { start, input } = setup();
    const events: StudioAgentEvent[] = [];
    const model = createDeterministicOfflineModel({ script: { [input]: { kind: 'tool-chain', calls: [{ toolName: 'studio_screen_read', args: { section: 'overview' } }], thenText: 'Public.' } } });
    const opened = openAgentRun('cancel-evidence', start, event => {
      events.push(event);
      if (event.type === 'tool-evidence' && event.phase === 'input') cancelAgentRun('cancel-evidence', event.runId);
    }, { model: OFFLINE_MODEL_IDENTITY, modelFactory: () => model });
    if (!opened.ok) throw new Error(opened.code);
    await opened.finished;
    expect(events.at(-1)).toMatchObject({ type: 'done', status: 'cancelled', applied: 0 });
    expect(events.filter(event => event.type === 'tool-evidence').map(event => event.phase)).toEqual(['input']);
    expect(cancelAgentRun('different-owner', opened.runId)).toBe(false);
  }, 120_000);

  it('marks schema-rejected arguments unavailable instead of inventing validated inputs or results', async () => {
    const { start, input } = setup();
    const events: StudioAgentEvent[] = [];
    const model = createDeterministicOfflineModel({ script: { [input]: { kind: 'tool-chain', calls: [
      { toolName: 'studio_screen_edit', args: { operations: [] } },
    ], thenText: 'I could not make that edit.' } } });
    const opened = openAgentRun('invalid-evidence', start, event => events.push(event), { model: OFFLINE_MODEL_IDENTITY, modelFactory: () => model });
    if (!opened.ok) throw new Error(opened.code);
    await opened.finished;
    const evidence = events.filter((event): event is StudioToolEvidence => event.type === 'tool-evidence');
    expect(evidence).toHaveLength(2);
    expect(evidence[0]).toMatchObject({ phase: 'input', availability: 'unavailable', unavailableReason: 'before-invocation' });
    expect(evidence[1]).toMatchObject({ phase: 'result', availability: 'unavailable', unavailableReason: 'not-returned', status: 'failed' });
    expect(evidence[0]!.callId).toBe(evidence[1]!.callId);
    expect(events.some(event => event.type === 'schema-diagnostic')).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'done', status: 'failed', applied: 0 });
  }, 120_000);
});
