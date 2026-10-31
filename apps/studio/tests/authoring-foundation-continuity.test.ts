import { describe, expect, it } from 'vitest';
import { createTaskContextStore } from '../src/lib/server/agent-task-context.js';
import { createToolArchive, TOOL_ARCHIVE_TTL_MS } from '../src/lib/server/tool-evidence-archive.js';
import { safeToolPayload, createToolEvidenceProducer } from '../src/lib/server/tool-evidence.js';
import {
  retainTurn,
  TURN_RECORD_TTL_MS,
  type RetainedTurn,
} from '../src/lib/designer/turn-records.js';
import type { AgentCursor } from '../src/lib/designer/agent-edits.js';
const cursor: AgentCursor = {
  documentId: 'screen',
  revision: 'r1#3',
  digest: 'exact-source',
  epoch: 'e963cf58-4be9-4b97-adcb-beb12a6ceec6',
};

describe('revision-bound task facts', () => {
  it('reuses actual bounded source pages for a correction, isolating actor, revision, digest and epoch', () => {
    const store = createTaskContextStore();
    const result = {
      expectedRevision: 'r1#3',
      sourceJson: '{"id":"nav"}',
      offset: 0,
      nextOffset: null,
    };
    store.retain('owner', cursor, 'Fix footer gap', { section: 'source', nodeId: 'nav' }, result);
    expect(store.snapshot('owner', cursor)).toMatchObject({
      previousRequest: 'Fix footer gap',
      facts: [{ result }],
    });
    expect(store.snapshot('other', cursor)).toBeUndefined();
    expect(store.snapshot('owner', cursor, 'changed-authoring-registry')).toBeUndefined();
    for (const changed of [
      { revision: 'r2#0' },
      { digest: 'changed' },
      { epoch: crypto.randomUUID() },
      { documentId: 'other' },
    ])
      expect(store.snapshot('owner', { ...cursor, ...changed })).toBeUndefined();
    result.sourceJson = 'changed outside store';
    expect(store.snapshot('owner', cursor)?.facts[0]?.result).toMatchObject({
      sourceJson: '{"id":"nav"}',
    });
    store.retain(
      'owner',
      cursor,
      'Header, not footer',
      { section: 'source', nodeId: 'nav' },
      { sourceJson: 'current-page' },
    );
    expect(store.snapshot('owner', cursor)).toMatchObject({
      previousRequest: 'Header, not footer',
      facts: [{ result: { sourceJson: 'current-page' } }],
    });
  });
  it('excludes refused, prose and knowledge-as-source records without source-fact quotas', () => {
    const store = createTaskContextStore();
    for (const [query, result] of [
      [{ section: 'source' }, { ok: false }],
      [{ section: 'contracts' }, { text: 'host-only knowledge' }],
      [{ section: 'assistant' }, { text: 'Done' }],
    ])
      store.retain('owner', cursor, 'task', query, result);
    expect(store.snapshot('owner', cursor)).toBeUndefined();
    for (let index = 0; index < 40; index++)
      store.retain(
        'owner',
        cursor,
        'task',
        { section: 'source', nodeId: `n${index}` },
        { sourceJson: 'x'.repeat(13_000), offset: 0, nextOffset: null },
      );
    for (let index = 0; index < 40; index++)
      store.retain(
        'owner',
        { ...cursor, documentId: `other${index}` },
        'task',
        { section: 'source', nodeId: 'n' },
        { sourceJson: 'other' },
      );
    expect(store.snapshot('owner', cursor)?.facts).toHaveLength(40);
    expect(store.snapshot('owner', cursor)?.facts[0]?.result).toMatchObject({
      sourceJson: 'x'.repeat(13_000),
    });
    expect(store.snapshot('owner', cursor)?.schema).toBe('vict.studio-task-facts@2');
    expect(store.snapshot('another-owner', cursor)).toBeUndefined();
  });
});

describe('sanitized original exchange retention', () => {
  it('pages beyond compact preview without rerunning a tool, excluding secrets and another owner', async () => {
    const archive = createToolArchive();
    const raw = {
      source: 'a'.repeat(18_000) + 'TAIL-EVIDENCE',
      authorization: 'Bearer must-not-leak',
      credential: 'private',
      comment: 'secret-canary-value',
    };
    expect(safeToolPayload(raw).truncated).toBe(true);
    const reference = await archive.retain(
      'owner',
      'run',
      'studio_screen_read',
      'call',
      'result',
      raw,
      ['secret-canary-value'],
    )!;
    expect(reference.truncated).toBe(false);
    let offset: number | null = 0;
    let assembled = '';
    while (offset !== null) {
      const page: NonNullable<Awaited<ReturnType<typeof archive.page>>> = (await archive.page(
        'owner',
        reference.id,
        offset,
      ))!;
      assembled += page.text;
      offset = page.nextOffset;
    }
    expect(assembled).toContain('TAIL-EVIDENCE');
    expect(assembled).not.toContain('must-not-leak');
    expect(assembled).not.toContain('secret-canary-value');
    expect(JSON.parse(assembled).credential).toBe('[redacted]');
    expect(await archive.page('different-owner', reference.id)).toBeUndefined();
    expect(await archive.page('owner', reference.id, -1)).toBeUndefined();
    expect(await archive.page('owner', reference.id, 0, 6001)).toBeUndefined();
  });
  it('retains full originals without policy expiry and never invokes untrusted getters', async () => {
    let clock = 1;
    const archive = createToolArchive(() => clock);
    let getterCalls = 0;
    const value = {
      source: 'x'.repeat(300_000),
      get hidden() {
        getterCalls++;
        return 'secret';
      },
    };
    const reference = await archive.retain(
      'owner',
      'run',
      'studio_screen_read',
      'call',
      'input',
      value,
      [],
    )!;
    expect(getterCalls).toBe(0);
    expect(reference.truncated).toBe(true);
    expect(reference.totalCharacters).toBeGreaterThan(300_000);
    clock += 10 * TOOL_ARCHIVE_TTL_MS;
    expect(await archive.page('owner', reference.id)).toBeDefined();
    expect(reference.expiresAt).toBeNull();
  });
  it('retains every original but not unavailable, duplicate or late phases', async () => {
    const originals: unknown[] = [];
    const producer = createToolEvidenceProducer(
      'run',
      true,
      () => {},
      [],
      (_tool, _call, _phase, value) => originals.push(value),
    );
    for (let i = 0; i < 25; i++)
      await producer.send(
        'studio_screen_read',
        `call-${i}`,
        'result',
        { text: 'x'.repeat(9000) },
        'completed',
      );
    expect(originals).toHaveLength(25);
    await producer.send('studio_screen_read', 'call-0', 'result', {}, 'completed');
    await producer.send(
      'studio_screen_read',
      'unavailable',
      'result',
      undefined,
      'failed',
      'not-returned',
    );
    producer.close();
    await producer.send('studio_screen_read', 'late', 'result', {}, 'completed');
    expect(originals).toHaveLength(25);
  });
});

describe('retained terminal turn evidence', () => {
  const record = (id: string): RetainedTurn => ({
    id,
    runId: `run-${id}`,
    task: 'Correct header',
    startedAt: 0,
    endedAt: 10,
    expiresAt: null,
    status: 'failed',
    source: cursor,
    applied: 2,
    regions: [],
    progress: ['Visibility refused'],
    diagnostics: { capture: 'covered' },
    receipts: {},
    evidence: 'original-turn',
    archives: [],
  });
  it('keeps all previous failures immutable beyond 24 turns and 30 minutes', () => {
    const previous = record('previous');
    let records = retainTurn([], previous, 11);
    previous.progress.push('must not affect history');
    records = retainTurn(records, { ...record('next'), status: 'cancelled' }, 12);
    expect(records[0]?.progress).toEqual(['Visibility refused']);
    expect(records.map((item) => item.status)).toEqual(['failed', 'cancelled']);
    for (let i = 0; i < 30; i++) records = retainTurn(records, record(String(i)), 20);
    expect(records).toHaveLength(32);
    records = retainTurn(
      records,
      { ...record('new'), expiresAt: 2 * TURN_RECORD_TTL_MS },
      TURN_RECORD_TTL_MS,
    );
    expect(records).toHaveLength(33);
    expect(records[0]?.id).toBe('previous');
  });
});
