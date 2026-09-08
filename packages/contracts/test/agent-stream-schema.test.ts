import { describe, expect, it } from 'vitest';
import {
  AGENT_STREAM_DURABLE_KINDS,
  AGENT_STREAM_EVENT_KINDS,
  AGENT_STREAM_SCHEMA,
  AGENT_STREAM_TRANSIENT_KINDS,
  assertAgentStreamEvent,
  agentStreamWireEnvelopeFields,
  assertAgentStreamWireEnvelope,
  validateAgentStreamEvent,
  validateAgentStreamWireEnvelope,
  type AgentStreamEvent,
} from '../src/index.js';

/** A valid base event that each case clones and mutates. */
function baseEvent(kind: (typeof AGENT_STREAM_EVENT_KINDS)[number]): AgentStreamEvent {
  const common = {
    streamId: 'stream-1',
    turnId: 'turn-1',
    threadId: 'thread-1',
    actorId: 'actor-1',
    agentProfileVersion: 'v1_abc',
    seq: 1,
  };
  switch (kind) {
    case 'response.started':
    case 'response.completed':
    case 'response.cancelled':
      return { ...common, kind };
    case 'text.delta':
      return { ...common, kind, delta: 'hel' };
    case 'content.completed':
      return { ...common, kind, contentRef: 'conversation:vict-actor-actor-1/thread-1/turn-1' };
    case 'tool.requested':
    case 'tool.started':
    case 'tool.awaiting_approval':
    case 'tool.completed':
      return { ...common, kind, toolCallId: 'call-1', toolName: 'tool.one' };
    case 'tool.failed':
      return {
        ...common,
        kind,
        toolCallId: 'call-1',
        toolName: 'tool.one',
        code: 'VICT_TOOL_FAILED',
      };
    case 'memory.updated':
      return { ...common, kind, threadId: 'thread-1' };
    case 'usage.updated':
      return { ...common, kind, usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } };
    case 'response.failed':
      return { ...common, kind, code: 'VICT_TURN_FAILED' };
  }
}

describe('vict.agent-stream@1 — final field-level schema (OPEN-015)', () => {
  it('the marker is frozen and the vocabulary is closed at 13 kinds', () => {
    expect(AGENT_STREAM_SCHEMA).toBe('vict.agent-stream@1');
    expect(AGENT_STREAM_EVENT_KINDS).toHaveLength(13);
    // text.delta is the ONLY transient kind; every other kind is durable.
    expect(AGENT_STREAM_TRANSIENT_KINDS).toEqual(['text.delta']);
    expect(AGENT_STREAM_DURABLE_KINDS).toHaveLength(12);
  });

  for (const kind of AGENT_STREAM_EVENT_KINDS) {
    it(`accepts a structurally valid '${kind}' event`, () => {
      expect(validateAgentStreamEvent(baseEvent(kind))).toEqual({ ok: true });
      expect(() => assertAgentStreamEvent(baseEvent(kind))).not.toThrow();
    });
  }

  it('rejects unknown event kinds without echoing the value', () => {
    const hostile = { ...baseEvent('response.started'), kind: 'provider.raw.chunk.v9' };
    const result = validateAgentStreamEvent(hostile as unknown);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([{ code: 'AGENT_STREAM_UNKNOWN_KIND', path: 'kind' }]);
    }
  });

  it('rejects unknown fields per kind and in the common envelope, fail closed', () => {
    const smuggled = {
      ...baseEvent('tool.completed'),
      rawProviderChunk: { payload: 'secret' },
    };
    const result = validateAgentStreamEvent(smuggled as unknown);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual({
        code: 'AGENT_STREAM_UNKNOWN_FIELD',
        path: 'tool.completed.rawProviderChunk',
      });
    }
    // An unknown context-level field on a bare response event.
    const hostiled = { ...baseEvent('response.completed'), reasoningDelta: 'hidden' };
    const result2 = validateAgentStreamEvent(hostiled as unknown);
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(result2.issues[0]?.code).toBe('AGENT_STREAM_UNKNOWN_FIELD');
    }
  });

  it('rejects non-plain objects, arrays, null, and primitives', () => {
    for (const input of [null, 42, 'event', [], new Map()]) {
      expect(validateAgentStreamEvent(input).ok).toBe(false);
    }
  });

  it('enforces bounded namespace identifiers on every identity field', () => {
    const tooLong = 'a'.repeat(129);
    const bad = { ...baseEvent('response.started'), streamId: tooLong };
    expect(validateAgentStreamEvent(bad).ok).toBe(false);
    const whitespace = { ...baseEvent('response.started'), actorId: 'actor 1' };
    expect(validateAgentStreamEvent(whitespace).ok).toBe(false);
    const hostile = { ...baseEvent('response.started'), threadId: '../escape' };
    expect(validateAgentStreamEvent(hostile).ok).toBe(false);
    // Acceptable identifiers include dots, dashes, colons, and @.
    const ok = { ...baseEvent('response.started'), streamId: 'stream:1@rev-a.b' };
    expect(validateAgentStreamEvent(ok).ok).toBe(true);
  });

  it('enforces positive safe-integer sequences', () => {
    for (const seq of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1']) {
      const event = { ...baseEvent('response.started'), seq };
      expect(validateAgentStreamEvent(event as unknown).ok).toBe(false);
    }
  });

  it('validates sanitized failure codes and rejects raw error content shapes', () => {
    expect(validateAgentStreamEvent(baseEvent('tool.failed')).ok).toBe(true);
    const raw = { ...baseEvent('tool.failed'), code: 'SQLITE_BUSY: canary-secret' };
    expect(validateAgentStreamEvent(raw).ok).toBe(false);
    const emptyCode = { ...baseEvent('response.failed'), code: '' };
    expect(validateAgentStreamEvent(emptyCode).ok).toBe(false);
  });

  it('validates the usage aggregate and rejects inconsistent counts', () => {
    const bad = {
      ...baseEvent('usage.updated'),
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 99 },
    };
    expect(validateAgentStreamEvent(bad).ok).toBe(false);
    const negative = {
      ...baseEvent('usage.updated'),
      usage: { inputTokens: -1, outputTokens: 0, totalTokens: -1 },
    };
    expect(validateAgentStreamEvent(negative).ok).toBe(false);
  });

  it('rejects empty text.delta and empty completed-content references', () => {
    expect(validateAgentStreamEvent({ ...baseEvent('text.delta'), delta: '' }).ok).toBe(false);
    expect(validateAgentStreamEvent({ ...baseEvent('content.completed'), contentRef: '' }).ok).toBe(
      false,
    );
    // The durable content milestone carries a REFERENCE, never the content.
    const withText = baseEvent('content.completed') as unknown as Record<string, unknown>;
    expect(withText['text']).toBeUndefined();
    const hostileRef = { ...baseEvent('content.completed'), contentRef: '../escape' };
    expect(validateAgentStreamEvent(hostileRef).ok).toBe(false);
  });

  it('accepts the closed optional correlation identities', () => {
    const correlated = {
      ...baseEvent('tool.started'),
      activationVersion: 'activation-1',
      mastraRunId: 'mastra-run-1',
      victInvocationId: 'invocation-1',
      victAttemptId: 'attempt-1',
      traceId: 'trace-1',
      victRunId: 'run-1',
    };
    expect(validateAgentStreamEvent(correlated).ok).toBe(true);
    const bad = { ...correlated, mastraRunId: 'has space' };
    expect(validateAgentStreamEvent(bad).ok).toBe(false);
  });

  it('assertAgentStreamEvent throws a stable non-echoing structural error', () => {
    try {
      assertAgentStreamEvent({ ...baseEvent('response.started'), kind: 'unknown.kind' });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).name).toBe('AgentStreamSchemaError');
      expect((error as { code?: string }).code).toBe('AGENT_STREAM_EVENT_INVALID');
      expect((error as Error).message).not.toContain('unknown.kind');
    }
  });
});

describe('vict.agent-stream@1 — the closed WIRE envelope (server-emitted frames)', () => {
  it('accepts the exact wire envelope: schema marker + valid event fields', () => {
    const frame = { schema: AGENT_STREAM_SCHEMA, ...baseEvent('response.completed') };
    expect(validateAgentStreamWireEnvelope(frame)).toEqual({ ok: true });
    expect(() => assertAgentStreamWireEnvelope(frame)).not.toThrow();
  });

  it('rejects a schema mismatch (missing, wrong version, or wrong marker)', () => {
    const missing = baseEvent('response.completed');
    expect(validateAgentStreamWireEnvelope(missing).ok).toBe(false);
    const wrong = { schema: 'vict.agent-stream@2', ...baseEvent('response.completed') };
    const result = validateAgentStreamWireEnvelope(wrong);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('AGENT_STREAM_SCHEMA_MISMATCH');
    }
  });

  it('rejects undeclared event kinds and unknown wire fields (fail closed)', () => {
    const undeclared = {
      schema: AGENT_STREAM_SCHEMA,
      ...baseEvent('response.started'),
      kind: 'replay.bounded',
      note: 'cursor-older-than-buffer',
    };
    expect(validateAgentStreamWireEnvelope(undeclared).ok).toBe(false);
    const unknownField = {
      schema: AGENT_STREAM_SCHEMA,
      ...baseEvent('response.completed'),
      newestSeq: 99,
    };
    expect(validateAgentStreamWireEnvelope(unknownField).ok).toBe(false);
  });

  it('exposes the closed per-kind wire field set', () => {
    const fields = agentStreamWireEnvelopeFields('content.completed');
    expect(fields.has('schema')).toBe(true);
    expect(fields.has('contentRef')).toBe(true);
    expect(fields.has('streamId')).toBe(true);
    expect(fields.has('seq')).toBe(true);
    expect(fields.has('text')).toBe(false);
  });

  it('validates wire envelopes built from plain JavaScript at runtime', () => {
    const fromJs = JSON.parse(
      JSON.stringify({ schema: AGENT_STREAM_SCHEMA, ...baseEvent('tool.failed') }),
    );
    expect(validateAgentStreamWireEnvelope(fromJs).ok).toBe(true);
    const hostile = JSON.parse(
      JSON.stringify({
        schema: AGENT_STREAM_SCHEMA,
        ...baseEvent('tool.failed'),
        code: 'raw error text',
      }),
    );
    expect(validateAgentStreamWireEnvelope(hostile).ok).toBe(false);
  });
});
