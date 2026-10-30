import { expect, it, vi } from 'vitest';
import { readKnowledgePage } from '../src/lib/designer/agent-knowledge-read.js';
import { installedAuthoringRegistry } from '../src/lib/designer/authoring.js';
import { createContractKnowledge } from '../src/lib/designer/agent-progress.js';
import { studioInputShape } from '../src/lib/server/designer-input-shape.js';

function next(page: ReturnType<typeof readKnowledgePage>): string | null {
  if (!page.ok || !('nextCursor' in page)) throw Error('Expected successful page');
  return page.nextCursor;
}

const first = () =>
  readKnowledgePage(installedAuthoringRegistry, {
    kind: 'component',
    key: 'vict.flow.workspace@2',
  });
function forge(token: string, patch: Record<string, unknown>) {
  const prefix = 'studio-knowledge-page@1:';
  const body = JSON.parse(Buffer.from(token.slice(prefix.length), 'base64url').toString());
  return prefix + Buffer.from(JSON.stringify({ ...body, ...patch })).toString('base64url');
}

it('independently rejects forged cursor bounds, body identity and projection swaps', () => {
  const page = first();
  expect(page.ok).toBe(true);
  const token = next(page) as string;
  for (const offset of [-1, 0, 0.5, 200001, '6000', null]) {
    expect(
      readKnowledgePage(installedAuthoringRegistry, { cursor: forge(token, { offset }) }).ok,
    ).toBe(false);
  }
  for (const patch of [
    { bodyIdentity: 'forged' },
    { projection: 'examples' },
    { key: 'vict.flow.port@2' },
    { kind: 'data' },
    { unknown: true },
  ]) {
    expect(readKnowledgePage(installedAuthoringRegistry, { cursor: forge(token, patch) }).ok).toBe(
      false,
    );
  }
});

it('independently refuses to mark missing, repeated, or projection-mixed ranges complete', () => {
  const initial = first();
  const token = next(initial) as string;
  const knowledge = createContractKnowledge();
  let tail = readKnowledgePage(installedAuthoringRegistry, { cursor: token });
  for (;;) {
    knowledge.retain(tail);
    knowledge.retain(tail);
    if (next(tail) === null) break;
    tail = readKnowledgePage(installedAuthoringRegistry, { cursor: next(tail) as string });
  }
  expect(knowledge.snapshot().complete).toEqual([]);
  knowledge.retain(
    readKnowledgePage(installedAuthoringRegistry, {
      kind: 'component',
      key: 'vict.flow.workspace@2',
      projection: 'examples',
    }),
  );
  expect(knowledge.snapshot().complete).toEqual([]);
  knowledge.retain(initial);
  expect(knowledge.snapshot().complete).toEqual([]);
});

it('independently permits unsigned public range reads without manufacturing cache coverage', () => {
  const initial = first();
  const result = readKnowledgePage(installedAuthoringRegistry, {
    cursor: forge(next(initial) as string, { offset: 1 }),
  });
  expect(result.ok).toBe(true);
  const knowledge = createContractKnowledge();
  knowledge.retain(result);
  expect(knowledge.snapshot().complete).toEqual([]);
});

it('independently keeps nested proxies and hostile issue descriptors inert', () => {
  const trap = vi.fn(() => {
    throw Error('PRIVATE_CANARY');
  });
  const proxy = new Proxy(
    {},
    { get: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap },
  );
  const safe = [{ path: ['components', 0, 'id'], rule: 'invalid_type' as const }];
  expect(studioInputShape({ components: [proxy] }, safe).fields[0]?.observedType).toBe(
    'uninspectable',
  );
  const issue = Object.defineProperty({}, 'path', { get: trap, enumerable: true });
  Object.defineProperty(issue, 'rule', { value: 'invalid_type', enumerable: true });
  expect(studioInputShape({}, [issue] as never).fields).toEqual([]);
  expect(studioInputShape({}, proxy as never).fields).toEqual([]);
  expect(trap).not.toHaveBeenCalled();
});
