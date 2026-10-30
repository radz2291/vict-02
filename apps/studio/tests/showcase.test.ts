import { describe, expect, it } from 'vitest';
import { canonicalUiDocument } from '@victframework/ui';
import { EditorBridge, authoredOccurrence, canInsertRecipe, insertRecipe, setStateInitial } from '@victframework/ui-editor';
import { compileScreen, designerCatalogs, catalogDescriptors } from '../src/lib/designer/application.js';
import { screenPlacementIssues } from '../src/lib/designer/placement.js';
import { screenRecipes } from '../src/lib/designer/recipes.js';
import { screenStore } from '../src/lib/designer/storage.js';
import { createShowcaseFixture, showcaseCatalog } from '../src/lib/designer/showcase.js';
import { projectStructure, structureMove } from '../src/lib/designer/structure.js';
import { readFileSync, writeFileSync } from 'node:fs';

function session(id: string) {
  const fixture = createShowcaseFixture(id);
  const data = new Map<string, string>();
  const bridge = new EditorBridge({
    catalogs: designerCatalogs,
    validateDocument: screenPlacementIssues,
    initial: { document: fixture.document, storedRevision: 'r1' },
    store: screenStore({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } }, fixture.document.id),
  });
  return { ...fixture, bridge, data };
}

describe('Cycle 1.3 complete showcase fixtures', () => {
  it('indexes and compiles every current package-backed example in valid ancestor contexts', () => {
    expect(showcaseCatalog).toHaveLength(screenRecipes.length);
    expect(showcaseCatalog.map(entry => entry.id)).toEqual(screenRecipes.map(recipe => recipe.id));
    expect(new Set(showcaseCatalog.map(entry => entry.id)).size).toBe(screenRecipes.length);
    expect(showcaseCatalog.map(entry => entry.id)).toEqual(expect.arrayContaining(['vict.ai.conversation','vict.ai.message','vict.ai.prompt-input','vict.flow.canvas']));
    for (const entry of showcaseCatalog) {
      const fixture = createShowcaseFixture(entry.id);
      const compiled = compileScreen(fixture.document);
      expect(compiled, entry.id).toMatchObject({ ok: true });
      if (compiled.ok) expect(Object.values(compiled.plan.documentPlans ?? {}).flatMap(plan => plan.diagnostics.filter(issue => issue.severity === 'error')), entry.id).toEqual([]);
      expect(screenPlacementIssues(fixture.document), entry.id).toEqual([]);
      expect(authoredOccurrence(fixture.document, fixture.targetNodeId), entry.id).toBeTruthy();
      expect(createShowcaseFixture(entry.id)).toEqual(fixture);
      if (entry.placements.length) {
        expect(fixture.parentFocus).toBeDefined();
        const recipe = screenRecipes.find(recipe => recipe.id === entry.id)!;
        expect(canInsertRecipe(recipe, fixture.document, { nodeId: fixture.document.root })).toBe(false);
        expect(canInsertRecipe(recipe, fixture.document, fixture.parentFocus!)).toBe(true);
      }
    }
    expect(() => createShowcaseFixture('not-a-recipe')).toThrow('Unknown showcase recipe');
  });

  it('keeps standalone catalog metadata identical to the actual recipe index', () => {
    const path = new URL('../../../examples/studio-ui-consumer/src/cycle13-catalog.json', import.meta.url);
    // Explicit regeneration mode is used by the maintainer after changing recipes.
    if (process.env.VICT_REGENERATE_SHOWCASE_CATALOG === '1') writeFileSync(path, `${JSON.stringify(showcaseCatalog, null, 2)}\n`);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(showcaseCatalog);
  });

  it('edits typed lists with real undo/redo and save/reopen in a private memory store', () => {
    const { bridge, data, targetNodeId } = session('slider');
    const control = bridge.document.nodes[targetNodeId];
    expect(control).toMatchObject({ kind: 'component' });
    if(control.kind !== 'component')throw Error('Slider is not a component');
    const reference=control.props?.value;
    expect(reference).toMatchObject({type:'ref',path:expect.stringMatching(/^state\./)});
    if(reference?.type!=='ref'||!reference.path.startsWith('state.'))throw Error('Slider value is not state-bound');
    const key = reference.path.slice('state.'.length);
    expect(control.outputs?.valueChange).toMatchObject({setState:{key}});
    expect(bridge.document.localState[key]?.type).toBe('numberList');
    expect(bridge.apply(setStateInitial({ requestId: 'list-edit', document: bridge.document, key, value: [20, 40] })).ok).toBe(true);
    const changed = canonicalUiDocument(bridge.document).contentDigest;
    expect(bridge.undo().ok).toBe(true);
    expect(bridge.document.localState[key]?.initial).toEqual([25]);
    expect(bridge.redo().ok).toBe(true);
    expect(canonicalUiDocument(bridge.document).contentDigest).toBe(changed);
    expect(bridge.save().ok).toBe(true);
    expect(data.size).toBe(1);
    expect(bridge.apply(setStateInitial({ requestId: 'later', document: bridge.document, key, value: [70] })).ok).toBe(true);
    expect(bridge.reopen().ok).toBe(true);
    expect(bridge.document.localState[key]?.initial).toEqual([20, 40]);
    expect(bridge.getSnapshot().canUndo).toBe(false);
    const fresh = session('slider');
    expect(fresh.data.size).toBe(0);
    expect(fresh.bridge.document.localState[key]?.initial).toEqual([25]);
  });

  it('uses the real guarded Structure move and refuses stale, draft, and contextual moves', () => {
    const { bridge, targetNodeId } = session('button');
    const section = screenRecipes.find(recipe => recipe.id === 'section')!;
    expect(bridge.apply(insertRecipe('container', section, bridge.document, 'destination', { nodeId: bridge.document.root })).ok).toBe(true);
    const graph = projectStructure(bridge.document);
    const source = graph.nodes.find(node => node.data.sourceId === targetNodeId)!.id;
    const target = graph.nodes.find(node => node.data.sourceId === 'destination')!.id;
    const request = { documentId: bridge.document.id, revision: bridge.getSnapshot().revision, source, target };
    expect(structureMove(bridge.document, request.revision, request, true, catalogDescriptors, screenRecipes).ok).toBe(false);
    expect(structureMove(bridge.document, 'changed', request, false, catalogDescriptors, screenRecipes).ok).toBe(false);
    const prepared = structureMove(bridge.document, request.revision, request, false, catalogDescriptors, screenRecipes);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) expect(bridge.apply(prepared.draft).ok).toBe(true);
    expect(bridge.document.nodes.destination).toMatchObject({ children: [targetNodeId] });
    const contextual = session('select-item');
    const contextualGraph = projectStructure(contextual.bridge.document);
    const contextualRequest = {
      documentId: contextual.bridge.document.id, revision: contextual.bridge.getSnapshot().revision,
      source: contextualGraph.nodes.find(node => node.data.sourceId === contextual.targetNodeId)!.id,
      target: contextualGraph.nodes.find(node => node.data.sourceId === contextual.bridge.document.root)!.id,
    };
    expect(structureMove(contextual.bridge.document, contextualRequest.revision, contextualRequest, false, catalogDescriptors, screenRecipes).ok).toBe(false);
  });
});
