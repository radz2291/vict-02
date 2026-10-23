import { describe, expect, it } from 'vitest';
import { applyUiEdit, canonicalUiDocument } from '@victframework/ui';
import { canInsertRecipe, insertRecipe, EditorBridge } from '@victframework/ui-editor';
import { screenRecipes } from '../src/lib/designer/recipes.js';
import { newScreen, designerCatalogs, compileScreen, catalogDescriptors } from '../src/lib/designer/application.js';
import { prepareAgentEdit, documentCursor, applyAgentProposal, agentContext, type AgentEdit } from '../src/lib/designer/agent-edits.js';
import { screenStore } from '../src/lib/designer/storage.js';

const recipe = (id: string) => screenRecipes.find(recipe => recipe.id === id)!;
function add(document: ReturnType<typeof newScreen>, id: string, parentId = document.root, slotName?: string) {
  const draft = insertRecipe('insert', recipe(id), document, `added-${id}`, { nodeId: parentId, slotName });
  const result = applyUiEdit({ document, revision: 'working' }, { ...draft, expectedDocumentRevision: 'working' }, designerCatalogs);
  expect(result, id).toMatchObject({ ok: true });
  if (!result.ok) throw Error(id);
  const compiled = compileScreen(result.document);
  expect(compiled, id).toMatchObject({ ok: true });
  if (compiled.ok) expect(Object.values(compiled.plan.documentPlans ?? {}).flatMap(plan => plan.diagnostics.filter(issue => issue.severity === 'error')), id).toEqual([]);
  return result.document;
}
describe('Cycle 1.3 actual Designer coverage', () => {
  it('compiles every standalone recipe through canonical edits and finished application validation', () => {
    for (const entry of screenRecipes.filter(entry => !entry.placements)) add(newScreen('Coverage', 'coverage'), entry.id);
    expect(screenRecipes.length).toBe(83); // 78 catalog registrations + five semantic recipes.
    expect(new Set(screenRecipes.map(entry => entry.id)).size).toBe(screenRecipes.length);
    const slider = add(newScreen('Typed source', 'typed-source'), 'slider');
    expect(slider.nodes['added-slider']).toMatchObject({ props: { value: { type: 'ref', path: 'state.catalog_added-slider_value' } }, outputs: { valueChange: { setState: { key: 'catalog_added-slider_value' } } } });
    expect(slider.localState['catalog_added-slider_value']).toEqual({ key: 'catalog_added-slider_value', type: 'numberList', initial: [25] });
  });
  it('compiles every context-owned part in its declared parent slot and refuses standalone placement', () => {
    for (const entry of screenRecipes.filter(entry => entry.placements)) {
      const placement = entry.placements![0]!;
      // Compose a parent in its own valid ancestors before inserting the child.
      const chain: { recipe: string; slot: string }[] = [];
      let parent = placement.definitionId.replace('vict.catalog.', '');
      let slot = placement.slotName;
      while (true) {
        chain.unshift({ recipe: parent, slot });
        const ancestor = recipe(parent).placements?.[0];
        if (!ancestor) break;
        parent = ancestor.definitionId.replace('vict.catalog.', ''); slot = ancestor.slotName;
      }
      let document = newScreen('Parts', 'parts');
      let parentId = document.root;
      let parentSlot: string | undefined;
      for (const step of chain) {
        document = add(document, step.recipe, parentId, parentSlot);
        parentId = `added-${step.recipe}`; parentSlot = step.slot;
      }
      expect(canInsertRecipe(entry, document, { nodeId: document.root }), entry.id).toBe(false);
      expect(canInsertRecipe(entry, document, { nodeId: parentId, slotName: parentSlot }), entry.id).toBe(true);
      add(document, entry.id, parentId, parentSlot);
    }
  });
  it('advertises the same recipes and descriptors to tools and applies typed props, bindings and outputs in one undoable batch', () => {
    const data = new Map<string, string>();
    const document = newScreen('Agent coverage', 'agent-coverage');
    const bridge = new EditorBridge({ catalogs: designerCatalogs, initial: { document, storedRevision: 'r1' }, store: screenStore({ getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }, document.id) });
    const cursor = documentCursor(document, bridge.getSnapshot().revision, 'epoch');
    const context = agentContext(document, cursor);
    expect(context.palette.map(entry => entry.id)).toEqual(screenRecipes.map(entry => entry.id));
    expect(context.components).toHaveLength(catalogDescriptors.length - 2);
    const edit: AgentEdit = { expectedRevision: cursor.revision, reason: 'Reusable catalog', operations: [
      { op: 'add', recipe: 'slider', nodeId: 'slider', parentId: 'screen', props: { value: [20, 40] } },
      { op: 'add', recipe: 'toggle', nodeId: 'toggle', parentId: 'screen' },
      { op: 'bind', nodeId: 'toggle', prop: 'pressed', expression: { type: 'ref', path: 'state.accepted' } },
      { op: 'connect', nodeId: 'toggle', output: 'pressedChange', binding: { setState: { key: 'accepted' } } },
    ] };
    const prepared = prepareAgentEdit(document, cursor, edit, 'coverage-proposal');
    expect(prepared).toMatchObject({ ok: true }); if (!prepared.ok) return;
    expect(applyAgentProposal(bridge, { proposalId: 'coverage-proposal', cursor, edit, resultDigest: prepared.digest }, 'epoch', false).ok).toBe(true);
    expect(bridge.save().ok).toBe(true); const digest = canonicalUiDocument(bridge.document).contentDigest; const savedNodes = bridge.document.nodes;
    expect(bridge.undo().ok).toBe(true); expect(bridge.document.nodes.slider).toBeUndefined();
    expect(bridge.redo().ok).toBe(true); expect(bridge.document.nodes).toEqual(savedNodes);
    expect(bridge.reopen().ok).toBe(true); expect(canonicalUiDocument(bridge.document).contentDigest).toBe(digest);
  });
  it('rejects context, output and type errors with no partial mutation', () => {
    const document = newScreen('Refusals', 'refusals');
    const cursor = documentCursor(document, 'working', 'epoch');
    for (const operations of [
      [{ op: 'add', recipe: 'select-item', nodeId: 'orphan', parentId: 'screen' }],
      [{ op: 'add', recipe: 'slider', nodeId: 's', parentId: 'screen', props: { value: ['wrong'] } }],
      [{ op: 'add', recipe: 'toggle', nodeId: 't', parentId: 'screen' }, { op: 'connect', nodeId: 't', output: 'pressedChange', binding: { setState: { key: 'message' } } }],
      [{ op: 'add', recipe: 'toggle', nodeId: 't', parentId: 'screen' }, { op: 'connect', nodeId: 't', output: 'invented', binding: { invokeAction: { actionId: 'backend.create' } } }],
    ]) {
      expect(prepareAgentEdit(document, cursor, { expectedRevision: 'working', reason: 'invalid', operations }, 'refused'), JSON.stringify(operations)).toMatchObject({ ok: false });
      expect(Object.keys(document.nodes)).toEqual(['screen']);
    }
  });
});
