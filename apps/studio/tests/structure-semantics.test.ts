import { expect, it } from 'vitest';
import {
  canonicalUiDocument,
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
} from '@victframework/ui';
import {
  projectStructure,
  structureId,
  filterStructure,
  connectedStructure,
  compactStructure,
  structureFacts,
} from '../src/lib/designer/structure.js';
import {
  groupStructureRelationships,
  structureConnectionEdges,
} from '../src/lib/designer/structure-connections.js';
import { structureBehavior } from '../src/lib/designer/structure-behavior.js';
import {
  bindingFixture,
  definitionsFixture,
  repeatFixture,
  repeatFields,
  outputFixture,
  outputDescriptor,
  styleFixture,
  compileFixture,
} from './fixtures/structure-semantics.js';
import { clarityFixture } from './fixtures/structure-clarity.js';
const id = (source: UiDocument, kind: string, key: string) => structureId(source.id, kind, key);
it('shows Value and Fallback from state to input, Updates in reverse, with no merged read count', () => {
  const source = bindingFixture();
  expect(compileFixture(source).ok).toBe(true);
  const graph = projectStructure(source),
    field = id(source, 'node', 'field'),
    state = id(source, 'state', 'message');
  expect(
    graph.edges.some((e) => e.source === state && e.target === field && e.data?.role === 'value'),
  ).toBe(true);
  expect(
    graph.edges.some(
      (e) => e.source === state && e.target === field && e.data?.role === 'fallback',
    ),
  ).toBe(true);
  expect(
    graph.edges.some((e) => e.source === field && e.target === state && e.data?.role === 'updates'),
  ).toBe(true);
  expect(structureConnectionEdges(graph).filter((e) => e.label === 'Value')).toHaveLength(2);
  const relations = groupStructureRelationships(graph, field).flatMap((g) => g.relations);
  expect(relations.some((r) => r.label === 'Value' && r.direction === 'incoming')).toBe(true);
  expect(relations.some((r) => r.label === 'Updates' && r.direction === 'outgoing')).toBe(true);
  expect(structureBehavior(source, 'field')[0]?.value).toContain('entered value; fallback');
});
it('keeps an associated input name free of artificial numbering from its label', () => {
  const seed = bindingFixture(),
    source: UiDocument = {
      ...seed,
      nodes: {
        ...seed.nodes,
        screen: { id: 'screen', kind: 'element', tag: 'main', children: ['label', 'field'] },
        label: {
          id: 'label',
          kind: 'element',
          tag: 'label',
          attributes: { for: 'field' },
          children: ['copy'],
        },
        copy: { id: 'copy', kind: 'text', content: { type: 'literal', value: 'Full name' } },
      },
    };
  expect(compileFixture(source).ok).toBe(true);
  expect(
    projectStructure(source).nodes.find((node) => node.data.sourceId === 'field')?.data.fullLabel,
  ).toBe('Full name');
});
it('never interprets inert host-registered attributes as action declarations', () => {
  const seed = bindingFixture(),
    source: UiDocument = {
      ...seed,
      nodes: {
        screen: {
          id: 'screen',
          kind: 'element',
          tag: 'div',
          children: [],
          attributes: { actionId: 'decorative' },
        },
      },
    };
  const catalog = defaultSemanticElementCatalog();
  expect(
    compileUiDocument(source, {
      ...catalog,
      globalAttributes: [...catalog.globalAttributes, 'actionId'],
    }).ok,
  ).toBe(true);
  expect(projectStructure(source).edges.some((e) => e.data?.role === 'invokes')).toBe(false);
});
it('keeps different definitions props and per-instance assignments distinct', () => {
  const source = definitionsFixture();
  expect(compileFixture(source).ok).toBe(true);
  const graph = projectStructure(source),
    props = graph.nodes.filter((n) => n.data.kind === 'prop');
  expect(props).toHaveLength(2);
  expect(new Set(props.map((n) => n.data.scope)).size).toBe(2);
  for (const key of ['a', 'b'])
    expect(
      graph.edges.some(
        (e) =>
          e.source === id(source, 'node', key) &&
          props.some((p) => p.id === e.target) &&
          e.data?.role === 'value',
      ),
    ).toBe(true);
});
it('keeps separate repeat item/key references separate and does not infer shared users', () => {
  const source = repeatFixture();
  expect(compileFixture(source, [], { viewFields: repeatFields }).ok).toBe(true);
  const graph = projectStructure(source),
    items = graph.nodes.filter((n) => n.data.kind === 'item');
  expect(items).toHaveLength(4);
  expect(new Set(items.map((n) => n.data.scope)).size).toBe(2);
  const focused = connectedStructure(
    filterStructure(graph, { bindings: true }),
    id(source, 'node', 'ta'),
    { related: true },
  );
  expect(focused.nodes.some((n) => n.data.sourceId === 'tb')).toBe(false);
});
it('keeps emitted output channels separate and preserves output-to-state destinations', () => {
  const source = outputFixture();
  expect(compileFixture(source, [outputDescriptor]).ok).toBe(true);
  const graph = projectStructure(source, { descriptors: [outputDescriptor] }),
    outputs = graph.nodes.filter((n) => n.data.kind === 'output');
  expect(outputs).toHaveLength(2);
  expect(new Set(outputs.map((n) => n.data.scope)).size).toBe(2);
  expect(graph.edges.filter((e) => e.data?.role === 'updates')).toHaveLength(2);
  expect(graph.edges.filter((e) => e.data?.role === 'emits')).toHaveLength(2);
});
it('exposes reusable style, token and condition dependencies without changing canonical bytes', () => {
  const source = styleFixture(),
    before = canonicalUiDocument(source).contentDigest;
  expect(compileFixture(source).ok).toBe(true);
  const graph = projectStructure(source);
  for (const kind of ['style', 'condition', 'token'])
    expect(graph.nodes.some((n) => n.data.kind === kind)).toBe(true);
  expect(
    graph.edges.some(
      (e) => e.source === id(source, 'state', 'tint') && e.target === id(source, 'style', 'shared'),
    ),
  ).toBe(true);
  expect(
    graph.edges.some(
      (e) =>
        e.source === id(source, 'style', 'shared') &&
        e.target === id(source, 'node', 'screen') &&
        e.data?.role === 'styles',
    ),
  ).toBe(true);
  expect(canonicalUiDocument(source).contentDigest).toBe(before);
});
it('keeps a reusable style prop binding scoped to each owning definition', () => {
  const seed = definitionsFixture(),
    source: UiDocument = {
      ...seed,
      styleSources: {
        shared: {
          id: 'shared',
          declarations: [
            {
              property: 'color',
              value: { type: 'binding', expression: { type: 'ref', path: 'prop.title' } },
            },
          ],
        },
      },
      nodes: {
        ...seed.nodes,
        ta: { id: 'ta', kind: 'element', tag: 'div', children: [], styleSources: ['shared'] },
        tb: { id: 'tb', kind: 'element', tag: 'div', children: [], styleSources: ['shared'] },
      },
    };
  expect(compileFixture(source).ok).toBe(true);
  const graph = projectStructure(source),
    styles = graph.nodes.filter((node) => node.data.registryId === 'shared');
  expect(styles).toHaveLength(2);
  const providers = styles.map(
    (style) =>
      graph.edges.find((edge) => edge.target === style.id && edge.data?.role === 'value')?.source,
  );
  expect(new Set(providers).size).toBe(2);
  expect(providers.every(Boolean)).toBe(true);
});
it('projects only supplied host return wiring and marks external actions honestly', () => {
  const source = bindingFixture(),
    graph = projectStructure(source, {
      actionState: { operation: { pending: 'busy', error: 'actionError', result: 'actionResult' } },
    }),
    action = id(source, 'action', 'operation');
  expect(
    graph.edges.filter((e) => e.source === action && e.data?.origin === 'host').map((e) => e.label),
  ).toEqual(['Pending', 'Error', 'Result']);
  expect(projectStructure(source).nodes.some((n) => n.id === action)).toBe(false);
  expect(graph.nodes.find((n) => n.id === action)?.data.support).toBe('External');
});
it('retains exact escaped source pointers for branches, definitions and unusual source ids', () => {
  const source = clarityFixture(),
    graph = projectStructure(source);
  const resolve = (pointer: string) =>
    pointer
      .split('/')
      .slice(1)
      .reduce(
        (value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')],
        source as any,
      );
  for (const edge of graph.edges)
    expect(resolve(edge.data!.path), edge.data!.path).not.toBeUndefined();
  const special: UiDocument = {
    ...bindingFixture(),
    root: 'a/b~c',
    nodes: {
      'a/b~c': {
        id: 'a/b~c',
        kind: 'element',
        tag: 'input',
        children: [],
        attributes: { value: { type: 'ref', path: 'state.message' } },
      },
    },
  };
  expect(projectStructure(special).edges[0]?.data?.path).toBe('/nodes/a~1b~0c/attributes/value');
});
it('uses framework plan diagnostics for unsupported conditioned styles', () => {
  const seed = styleFixture(),
    source: UiDocument = {
      ...seed,
      conditions: {
        compact: {
          id: 'compact',
          kind: 'localState',
          when: { type: 'ref', path: 'state.accepted' },
        },
      },
    },
    compiled = compileFixture(source);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) throw Error('compile');
  const graph = projectStructure(source, { plan: compiled.plan }),
    style = graph.nodes.find((n) => n.id === id(source, 'style', 'shared'))!;
  expect(style.data.support).toBe('Unsupported');
  expect(style.data.issues?.join(' ')).toContain('UI_DOC_UNSUPPORTED_FEATURE');
  expect(
    structureFacts(source, style).some((f) => f.path === 'conditionId' && f.value === 'compact'),
  ).toBe(true);
});
it('All declarations includes unused registries while Used keeps them quiet', () => {
  const source = bindingFixture(),
    graph = projectStructure(source),
    used = filterStructure(graph, { bindings: true }),
    all = filterStructure(graph, { bindings: true, definitions: true, inventory: true });
  expect(used.nodes.some((n) => n.id === id(source, 'state', 'busy'))).toBe(false);
  expect(all.nodes.some((n) => n.id === id(source, 'state', 'busy'))).toBe(true);
  expect(
    compactStructure(graph, source).edges.every((e) =>
      graph.edges.some((original) => original.id === e.id),
    ),
  ).toBe(true);
});
