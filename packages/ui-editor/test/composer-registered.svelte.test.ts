import { describe, expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { createUiAuthoringRegistry, authoringSemanticIssues, defaultSemanticElementCatalog, type UiAuthoringRegistration, type UiDocument } from '@victframework/ui';
import Composer from '../src/Composer.svelte';
import { EditorBridge } from '../src/bridge.js';
import type { TransactionDraft } from '../src/commands.js';
import { authoringRecipe } from '../src/registered-authoring.js';
import { canInsertRecipe, insertRecipe } from '../src/composition.js';

const base = { abi: 'vict.ui-component-abi@1', events: ['vict.ui-component-abi@1'], rendererImplementationId: 'test.manual', styleTargets: ['root'] } as const;
const registration = (id: string, revision = '1', extra: Partial<UiAuthoringRegistration> = {}): UiAuthoringRegistration => ({
  descriptor: { ...base, id, revision, props: [], slots: [], outputs: [] }, label: id, family: 'test', category: 'primitive', purpose: `Public ${id} capability`, eligibility: { kind: 'standalone' }, ...extra,
});
const owner = registration('test.owner');
const registrations: UiAuthoringRegistration[] = [
  { ...owner, descriptor: { ...owner.descriptor, slots: ['body'] } }, registration('test.control', '1'), registration('test.control', '2'),
  registration('test.owner', '2', { descriptor: { ...owner.descriptor, revision: '2', slots: ['body'] } }),
  registration('test.excluded', '1', { eligibility: { kind: 'excluded', reason: 'Retained compatibility only.' } }),
  registration('test.host', '1', { rules: [{ kind: 'hostRequirement', capability: 'test.host-capability', reason: 'Requires the declared test host.' }] }),
  registration('test.part', '1', { eligibility: { kind: 'part' }, dependencies: [{ id: 'test.owner', revision: '1' }], rules: [{ kind: 'ancestorSlot', placements: [{ definitionId: 'test.owner', revision: '1', slotName: 'body' }] }] }),
  registration('test.part', '2', { eligibility: { kind: 'part' }, dependencies: [{ id: 'test.owner', revision: '2' }], rules: [{ kind: 'ancestorSlot', placements: [{ definitionId: 'test.owner', revision: '2', slotName: 'body' }] }] }),
  registration('test.seeded', '1', { seed: { root: 'seed', nodes: [{ kind: 'component', id: 'seed', definitionId: 'test.seeded', revision: '1' }] } }),
];
const registry = createUiAuthoringRegistry([{ schema: 'vict.ui-authoring@1', packageName: 'test.manual', packageVersion: '1', registrations, exportDispositions: [] }], registrations.map(entry => ({ ...base, extensionId: entry.descriptor.id, revision: entry.descriptor.revision, slots: entry.descriptor.slots })));
const source = (withOwner = false): UiDocument => ({
  schema: 'vict.ui-document@1', id: 'registered-manual', revision: '1', root: 'root',
  nodes: withOwner ? { root: { kind: 'element', id: 'root', tag: 'main', children: ['owner'] }, owner: { kind: 'component', id: 'owner', definitionId: 'test.owner', revision: '1', slots: { body: { name: 'body', children: ['wrapper'] } } }, wrapper: { kind: 'element', id: 'wrapper', tag: 'div', children: [] } } : { root: { kind: 'element', id: 'root', tag: 'main', children: [] } },
  componentDefinitions: {}, tokens: {}, assets: {}, localState: {}, conditions: {}, styleSources: {},
});
const recipes = [{ id: 'prepared-text', label: 'Prepared text', description: 'A prepared source fragment', create: (id: string) => [{ kind: 'text' as const, id, content: { type: 'literal' as const, value: 'Prepared text' } }] }];
function bridgeFor(document: UiDocument, hostCapabilities: readonly string[] = []) {
  return new EditorBridge({ initial: { document, storedRevision: '1' },
    store: { load: () => ({ status: 'loaded', document, storedRevision: '1' }), save: ({ newStoredRevision }) => ({ ok: true, storedRevision: newStoredRevision }) },
    catalogs: { elements: defaultSemanticElementCatalog(), extensions: registry.descriptors },
    validateDocument: (current, previous) => authoringSemanticIssues(current, registry, { previous, hostCapabilities }),
  });
}
const find = (target: Element, id: string, revision = '1') => target.querySelector<HTMLButtonElement>(`button[data-definition-id="${id}"][data-definition-revision="${revision}"]`);

describe('manual seedless registered component insertion', () => {
  it('lists exact eligible revisions separately from recipes and inserts one canonical undoable component', async () => {
    expect(registry.ok, JSON.stringify(registry.issues)).toBe(true);
    const initial = source(), before = JSON.stringify(initial), bridge = bridgeFor(initial), target = document.createElement('div'); document.body.append(target);
    let inserted = '', applies = 0;
    const app = mount(Composer, { target, props: { document: initial, selectedNodeId: 'root', recipes, authoringRegistry: registry, compact: true, showArrange: false,
      onApply: draft => { applies++; return bridge.apply(draft).ok; }, onInserted: id => { inserted = id; },
    } });
    try {
      flushSync();
      expect(target.querySelector('[aria-label="Registered components"]')).not.toBeNull();
      expect(find(target, 'test.control', '1')?.textContent).toContain('test.control@1');
      expect(find(target, 'test.control', '2')?.textContent).toContain('test.control@2');
      expect(find(target, 'test.seeded')).toBeNull(); expect(find(target, 'test.excluded')).toBeNull();
      expect(find(target, 'test.part')).toBeNull(); expect(find(target, 'test.host')).toBeNull();
      expect([...target.querySelectorAll('button.recipe')].some(button => button.textContent?.includes('Prepared text'))).toBe(true);
      find(target, 'test.control', '2')!.click(); flushSync();
      expect(applies).toBe(1); expect(inserted).toMatch(/^component-/);
      expect(bridge.document.nodes[inserted]).toEqual({ kind: 'component', id: inserted, definitionId: 'test.control', revision: '2', slots: {} });
      expect(bridge.document.nodes.root).toMatchObject({ children: [inserted] });
      expect(bridge.undo().ok).toBe(true); expect(bridge.document.nodes).toEqual(initial.nodes);
      expect(bridge.redo().ok).toBe(true); expect(bridge.document.nodes[inserted]).toMatchObject({ revision: '2' });
      expect(JSON.stringify(initial)).toBe(before);
    } finally { await unmount(app); target.remove(); }
  });

  it('honors actual ancestor-slot context through wrappers and declared host capabilities', async () => {
    const initial = source(true), hostCapabilities = ['test.host-capability'], bridge = bridgeFor(initial, hostCapabilities), target = document.createElement('div'); document.body.append(target);
    const inserted: string[] = [];
    const app = mount(Composer, { target, props: { document: initial, selectedNodeId: 'wrapper', recipes: [], authoringRegistry: registry, hostCapabilities, compact: true, showArrange: false,
      onApply: draft => bridge.apply(draft).ok, onInserted: id => inserted.push(id),
    } });
    try {
      flushSync();
      expect(find(target, 'test.part')).not.toBeNull(); expect(find(target, 'test.host')).not.toBeNull();
      find(target, 'test.part')!.click(); find(target, 'test.host')!.click(); flushSync();
      expect(inserted).toHaveLength(2);
      expect(bridge.document.nodes.wrapper).toMatchObject({ children: inserted });
      expect(authoringSemanticIssues(bridge.document, registry, { hostCapabilities }).filter(issue => issue.severity === 'error')).toEqual([]);
      expect(bridge.document.nodes[inserted[0]!]).toMatchObject({ definitionId: 'test.part', revision: '1' });
      expect(bridge.document.nodes[inserted[1]!]).toMatchObject({ definitionId: 'test.host', revision: '1' });
    } finally { await unmount(app); target.remove(); }
  });

  it('keeps rejected insertion atomic and does not report a node as inserted', async () => {
    const initial = source(), before = JSON.stringify(initial), target = document.createElement('div'); document.body.append(target);
    const drafts: TransactionDraft[] = [], inserted: string[] = [];
    const app = mount(Composer, { target, props: { document: initial, selectedNodeId: 'root', recipes: [], authoringRegistry: registry, compact: true, showArrange: false,
      onApply: draft => { drafts.push(draft); return false; }, onInserted: id => inserted.push(id),
    } });
    try {
      flushSync(); find(target, 'test.control')!.click(); flushSync();
      expect(drafts).toHaveLength(1); expect(inserted).toEqual([]);
      expect(JSON.stringify(initial)).toBe(before);
      expect(target.querySelector('[role="alert"]')?.textContent).toContain('not inserted');
    } finally { await unmount(app); target.remove(); }
  });

  it('retains the existing recipe-only UI when no authoring registry is supplied', async () => {
    const target = document.createElement('div'); document.body.append(target);
    const app = mount(Composer, { target, props: { document: source(), selectedNodeId: 'root', recipes, compact: true, showArrange: false, onApply: () => true } });
    try {
      flushSync(); expect(target.querySelector('[aria-label="Registered components"]')).toBeNull();
      expect(target.querySelectorAll('button.recipe')).toHaveLength(1);
      expect(target.textContent).toContain('Prepared text');
    } finally { await unmount(app); target.remove(); }
  });

  it('offers exact-version parts only in the nearest compatible provider, including unpinned effective revisions', async () => {
    for (const scenario of [
      { revision: '1', outerRevision: undefined, expected: false },
      { revision: '2', outerRevision: undefined, expected: true },
      { revision: undefined, outerRevision: undefined, expected: true },
      { revision: '1', outerRevision: '2', expected: false },
      { revision: '2', outerRevision: '1', expected: true },
    ]) {
      const original = source(true), nodes = { ...original.nodes };
      const { revision: _pin, ...unpinned } = nodes.owner as Extract<UiDocument['nodes'][string], { kind: 'component' }>;
      nodes.owner = { ...unpinned, ...(scenario.revision ? { revision: scenario.revision } : {}) };
      if (scenario.outerRevision) {
        nodes.root = { kind: 'element', id: 'root', tag: 'main', children: ['outer'] };
        nodes.outer = { kind: 'component', id: 'outer', definitionId: 'test.owner', revision: scenario.outerRevision, slots: { body: { name: 'body', children: ['owner'] } } };
      }
      const initial = { ...original, nodes }, bridge = bridgeFor(initial), target = document.createElement('div'); document.body.append(target);
      let inserted = '';
      const app = mount(Composer, { target, props: { document: initial, selectedNodeId: 'wrapper', recipes: [], authoringRegistry: registry, compact: true, showArrange: false,
        onApply: draft => bridge.apply(draft).ok, onInserted: id => { inserted = id; },
      } });
      try {
        flushSync(); const button = find(target, 'test.part', '2');
        expect(!!button, JSON.stringify(scenario)).toBe(scenario.expected);
        if (button) {
          button.click(); flushSync(); expect(inserted).toBeTruthy();
          expect(bridge.document.nodes[inserted]).toMatchObject({ definitionId: 'test.part', revision: '2' });
        }
      } finally { await unmount(app); target.remove(); }
    }
  });

  it('preserves exact placement revisions in generated recipes without changing legacy revisionless guards', () => {
    const part = registrations.find(entry => entry.descriptor.id === 'test.part' && entry.descriptor.revision === '2')!;
    const recipe = authoringRecipe({ ...part, seed: { root: 'seed', nodes: [{ kind: 'component', id: 'seed', definitionId: 'test.part', revision: '2' }] } })!;
    expect(recipe.placements).toEqual([{ definitionId: 'test.owner', revision: '2', slotName: 'body' }]);
    const original = source(true), nodes = { ...original.nodes };
    const { revision: _pin, ...unpinned } = nodes.owner as Extract<UiDocument['nodes'][string], { kind: 'component' }>;
    nodes.owner = unpinned; const current = { ...original, nodes };
    expect(canInsertRecipe(recipe, current, { nodeId: 'wrapper' }, registry.descriptors)).toBe(true);
    const reversed = [...registry.descriptors.filter(descriptor => descriptor.id !== 'test.owner'), ...registry.descriptors.filter(descriptor => descriptor.id === 'test.owner').reverse()];
    expect(canInsertRecipe(recipe, current, { nodeId: 'wrapper' }, reversed)).toBe(false);
    const legacy = { ...recipe, placements: [{ definitionId: 'test.owner', slotName: 'body' }] };
    expect(canInsertRecipe(legacy, current, { nodeId: 'wrapper' })).toBe(true);
    const bridge = bridgeFor(current);
    expect(bridge.apply(insertRecipe('versioned-recipe', recipe, current, 'inserted-part', { nodeId: 'wrapper' }, registry.descriptors)).ok).toBe(true);
    expect(bridge.document.nodes['inserted-part']).toMatchObject({ definitionId: 'test.part', revision: '2' });
  });
});
