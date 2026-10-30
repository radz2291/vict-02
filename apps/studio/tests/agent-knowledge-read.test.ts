import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import { authoringContractBody, authoringDataContracts } from '@victframework/ui';
import { capturePresentationSchema } from '@victframework/mastra';
import {
  agentContext,
  agentReadPresentation,
  agentReadSchema,
  contractBodyIdentity,
} from '../src/lib/designer/agent-reads.js';
import {
  projectComponentContract,
  readKnowledgePage,
  KNOWLEDGE_PAGE_CHARACTERS,
} from '../src/lib/designer/agent-knowledge-read.js';
import { installedAuthoringRegistry } from '../src/lib/designer/authoring.js';
import { newScreen } from '../src/lib/designer/application.js';
import { documentCursor } from '../src/lib/designer/agent-edits.js';
import { createContractKnowledge, readCategory } from '../src/lib/designer/agent-progress.js';

const ajvOptions: NonNullable<ConstructorParameters<typeof Ajv>[0]> & { strict: boolean } = {
  strict: false,
  allErrors: true,
};
const presented = new Ajv(ajvOptions).compile(agentReadPresentation);
const source = newScreen('Scalar knowledge', 'scalar-knowledge');
const cursor = documentCursor(source, 'r1', 'scalar-knowledge');
const read = (query: unknown) => agentContext(source, cursor, undefined, query);
type Item = {
  id: string;
  revision: string;
  digest: string;
  bodyIdentity: string;
  contractJson: string;
  offset: number;
  totalCharacters: number;
  bodyComplete: boolean;
};
const item = (result: ReturnType<typeof read>) => (result.items as Item[])[0]!;
function componentBody(key: string, projection: 'guidance' | 'examples') {
  let result = read({ section: 'knowledge', kind: 'component', key, projection }),
    json = '',
    pages = 0;
  const knowledge = createContractKnowledge();
  while (true) {
    expect(result.ok).toBe(true);
    const body = item(result);
    expect(body.contractJson.length).toBeLessThanOrEqual(KNOWLEDGE_PAGE_CHARACTERS);
    expect(body.offset).toBe(json.length);
    json += body.contractJson;
    knowledge.retain(result);
    if (result.nextCursor === null) return { json, result, knowledge, pages: pages + 1 };
    expect(typeof result.nextCursor).toBe('string');
    expect(result).not.toHaveProperty('nextOffset');
    if (++pages > 100) throw Error('Knowledge paging did not terminate');
    result = read({ section: 'knowledge', cursor: result.nextCursor });
  }
}

describe('strict scalar authoring knowledge', () => {
  it('matches presentation/admission, refuses irrelevant legacy fields and keeps parsing idempotent', () => {
    const valid = [
      { section: 'knowledge', kind: 'component', key: 'vict.flow.workspace@2' },
      { section: 'knowledge', kind: 'data', key: 'vict.flow-graph@2', projection: 'examples' },
      { section: 'knowledge', cursor: 'opaque-token-is-validated-at-invocation' },
    ];
    for (const value of valid) {
      expect(presented(value), JSON.stringify(presented.errors)).toBe(true);
      const parsed = agentReadSchema.parse(value);
      expect(agentReadSchema.parse(parsed)).toEqual(parsed);
      expect(parsed).not.toHaveProperty('offset');
      expect(parsed).not.toHaveProperty('limit');
    }
    for (const value of [
      { section: 'knowledge' },
      { section: 'knowledge', kind: 'component' },
      { section: 'knowledge', kind: 'component', key: 'vict.flow.workspace@2', offset: 0 },
      { section: 'knowledge', kind: 'component', key: 'vict.flow.workspace@2', limit: 12 },
      {
        section: 'knowledge',
        kind: 'component',
        key: 'vict.flow.workspace@2',
        includeExamples: true,
      },
      { section: 'knowledge', kind: 'component', key: 'vict.flow.workspace@2', components: [] },
      { section: 'knowledge', kind: 'component', key: 'vict.flow.workspace@2', projection: true },
      { section: 'knowledge', cursor: null },
    ]) {
      expect(agentReadSchema.safeParse(value).success).toBe(false);
      expect(presented(value)).toBe(false);
    }
    expect(agentReadSchema.parse({})).toEqual({ section: 'overview', offset: 0, limit: 12 });
    const rejected = agentReadSchema.safeParse({
      section: 'contracts',
      components: '[]',
      includeExamples: 'true',
    });
    expect(rejected.success).toBe(false);
    if (!rejected.success)
      expect(rejected.error.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining(['components', 'includeExamples']),
      );
    expect(() => capturePresentationSchema(agentReadPresentation, 'read')).not.toThrow();
  });

  it('selects exact public revision2 without reinterpreting legacy component recipe defaults', () => {
    const result = read({ section: 'knowledge', kind: 'component', key: 'vict.flow.workspace@2' });
    expect(result).toMatchObject({
      ok: true,
      kind: 'component',
      key: 'vict.flow.workspace@2',
      dependencyBodiesIncluded: false,
    });
    expect(item(result)).toMatchObject({ id: 'vict.flow.workspace', revision: '2', offset: 0 });
    expect(read({ section: 'component', recipe: 'vict.flow.workspace' })).toMatchObject({
      id: 'vict.flow.workspace',
      revision: '1',
    });
    expect(read({ section: 'component', recipe: 'vict.flow.workspace@2' })).toMatchObject({
      ok: false,
      code: 'STUDIO_AGENT_COMPONENT_NOT_FOUND',
    });
    expect(
      read({ section: 'knowledge', kind: 'component', key: 'vict.flow.workspace' }),
    ).toMatchObject({ ok: false, code: 'STUDIO_AGENT_KNOWLEDGE_NOT_FOUND' });
    expect(readCategory('knowledge')).toBe('knowledge');
  });

  it('reassembles exact guidance/examples bodies and records only delivered complete component ranges', () => {
    const contract = installedAuthoringRegistry.contracts.find(
      (value) => value.descriptor.id === 'vict.flow.workspace' && value.descriptor.revision === '2',
    )!;
    for (const projection of ['guidance', 'examples'] as const) {
      const first = read({
          section: 'knowledge',
          kind: 'component',
          key: 'vict.flow.workspace@2',
          projection,
        }),
        firstItem = item(first);
      expect(firstItem.bodyIdentity).toBe(
        contractBodyIdentity(contract.digest, projection === 'examples'),
      );
      const partial = createContractKnowledge();
      partial.retain(first);
      if (first.nextCursor !== null)
        expect(partial.reusable({ 'vict.flow.workspace@2': contract.digest })).toEqual({});
      const assembled = componentBody('vict.flow.workspace@2', projection);
      expect(JSON.parse(assembled.json)).toEqual(
        projectComponentContract(authoringContractBody(contract), projection === 'examples'),
      );
      expect(assembled.knowledge.reusable({ 'vict.flow.workspace@2': contract.digest })).toEqual({
        'vict.flow.workspace@2': contract.digest,
      });
      expect(assembled.result).not.toHaveProperty('complete');
    }
  });

  it('uses the identical projection bytes as the retained strict batched contracts surface', () => {
    const scalar = componentBody('vict.flow.workspace@2', 'guidance');
    let offset: number | null = 0,
      text = '',
      identity = '';
    while (offset !== null) {
      const result = read({
        section: 'contracts',
        components: [{ id: 'vict.flow.workspace', revision: '2' }],
        offset,
        limit: 20,
        ...(offset ? { expectedBodyIdentities: { 'vict.flow.workspace@2': identity } } : {}),
      });
      const body = (result.items as (Item & { nextOffset: number | null })[]).find(
        (value) => value.id === 'vict.flow.workspace',
      )!;
      text += body.contractJson;
      identity = body.bodyIdentity;
      offset = body.nextOffset;
    }
    expect(text).toBe(scalar.json);
  });

  it('refuses malformed, cross-key, cross-kind, cross-projection and stale registered-body cursors', () => {
    const first = read({ section: 'knowledge', kind: 'component', key: 'vict.flow.workspace@2' });
    expect(first.nextCursor).toBeTypeOf('string');
    const token = first.nextCursor as string;
    expect(read({ section: 'knowledge', cursor: 'not-a-cursor' })).toMatchObject({
      ok: false,
      code: 'STUDIO_AGENT_KNOWLEDGE_CURSOR_INVALID',
    });
    for (const extra of [{ key: 'vict.flow.port@2' }, { kind: 'data' }, { projection: 'examples' }])
      expect(read({ section: 'knowledge', cursor: token, ...extra })).toMatchObject({
        ok: false,
        code: 'STUDIO_AGENT_KNOWLEDGE_CURSOR_MISMATCH',
      });
    const changed = {
      ...installedAuthoringRegistry,
      contracts: installedAuthoringRegistry.contracts.map((contract) =>
        contract.descriptor.id === 'vict.flow.workspace' && contract.descriptor.revision === '2'
          ? { ...contract, digest: 'changed-digest' }
          : contract,
      ),
    };
    expect(readKnowledgePage(changed, { cursor: token })).toMatchObject({
      ok: false,
      code: 'STUDIO_AGENT_KNOWLEDGE_BODY_INVALIDATED',
      items: [{ id: 'vict.flow.workspace', revision: '2', invalidated: true }],
    });
    expect(read({ section: 'knowledge', cursor: token + '=' })).toMatchObject({
      ok: false,
      code: 'STUDIO_AGENT_KNOWLEDGE_CURSOR_INVALID',
    });
  });

  it('pages exact package data grammar without contaminating component knowledge or preloading app source', () => {
    const data = authoringDataContracts(installedAuthoringRegistry).find(
      (value) => value.id === 'vict.flow-graph' && value.revision === '2',
    )!;
    for (const projection of ['guidance', 'examples'] as const) {
      let result = read({
          section: 'knowledge',
          kind: 'data',
          key: 'vict.flow-graph@2',
          projection,
        }),
        text = '',
        pages = 0;
      const knowledge = createContractKnowledge();
      while (true) {
        expect(result.ok).toBe(true);
        expect(result).not.toHaveProperty('items');
        expect(result).not.toHaveProperty('contractJson');
        text += result.sourceJson as string;
        knowledge.retain(result);
        if (result.nextCursor === null) break;
        if (++pages > 100) throw Error('Data pages did not terminate');
        result = read({ section: 'knowledge', cursor: result.nextCursor });
      }
      const { digest: _digest, ...expected } = data,
        { examples: _examples, ...guidance } = expected;
      expect(JSON.parse(text)).toEqual(projection === 'examples' ? expected : guidance);
      expect(knowledge.snapshot().complete).toEqual([]);
    }
    expect(read({ section: 'knowledge', kind: 'data', key: 'missing.contract@2' })).toMatchObject({
      ok: false,
      code: 'STUDIO_AGENT_KNOWLEDGE_NOT_FOUND',
    });
  });
});
