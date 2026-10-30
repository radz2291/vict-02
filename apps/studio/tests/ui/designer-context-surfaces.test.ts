// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { expect, it, vi } from 'vitest';
import { applyUiEdit } from '@victframework/ui';
import { Composer, EditorBridge, Layers, detachSlotContent, insertRecipe, type TransactionDraft } from '@victframework/ui-editor';
import { catalogDescriptors, compileScreen, designerCatalogs, newScreen } from '../../src/lib/designer/application.js';
import { screenPlacementIssues } from '../../src/lib/designer/placement.js';
import { screenRecipes } from '../../src/lib/designer/recipes.js';

function setup() {
  const source = newScreen('Surface refusal', 'surface-refusal');
  const draft = insertRecipe('seed', screenRecipes.find(recipe => recipe.id === 'select-multiple')!, source, 'select', { nodeId: 'screen' });
  const result = applyUiEdit({ document: source, revision: 'r1' }, { ...draft, expectedDocumentRevision: 'r1' }, designerCatalogs);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  const bridge = new EditorBridge({ catalogs: designerCatalogs, validateDocument: screenPlacementIssues,
    initial: { document: result.document, storedRevision: 'r1' },
    store: { load: () => ({ status: 'empty' }), save: () => ({ ok: false, reason: 'not used' }) } });
  const receipts: ReturnType<EditorBridge['apply']>[] = [];
  const onApply = (draft: TransactionDraft) => { const result = bridge.apply(draft); receipts.push(result); return result.ok; };
  const target = document.createElement('div'); document.body.append(target);
  return { bridge, receipts, onApply, target };
}
function choose(target: Element, label: string, value: string) {
  const select = target.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  expect(select).toBeTruthy(); select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); flushSync();
}

it('actual Composer reuse control refuses root placement and allows the original item slot', async () => {
  const { bridge, receipts, onApply, target } = setup();
  expect(bridge.apply(detachSlotContent('detach', bridge.document, 'select-items-1')!).ok).toBe(true);
  const before = bridge.document, snapshot = bridge.getSnapshot();
  const instance = mount(Composer, { target, props: { document: before, selectedNodeId: 'screen', recipes: screenRecipes, descriptors: catalogDescriptors, compact: true, onApply } });
  try {
    flushSync();
    const reuseTab = [...target.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(e => e.textContent?.startsWith('Reuse'))!;
    reuseTab.click(); flushSync();
    choose(target, 'Kept content', 'select-items-1');
    choose(target, 'Insertion destination', JSON.stringify(['screen', '']));
    const place = [...target.querySelectorAll<HTMLButtonElement>('button')].find(e => e.textContent === 'Place content')!;
    place.click(); flushSync();
    expect(receipts.at(-1)).toMatchObject({ ok: false, issues: [{ hostCode: 'STUDIO_COMPONENT_CONTEXT' }] });
    expect(bridge.document).toEqual(before); expect(bridge.getSnapshot()).toEqual(snapshot);
    choose(target, 'Insertion destination', JSON.stringify(['select', 'items']));
    place.click(); flushSync();
    expect(receipts.at(-1)).toMatchObject({ ok: true });
    expect(screenPlacementIssues(bridge.document)).toEqual([]);
  } finally { await unmount(instance); target.remove(); }
});

it.each(['mounted', 'unmounted'] as const)('actual Layers refuses contextual part dragging and commits a supported whole-provider move (%s during focus)', async (lifetime) => {
  const { bridge, receipts, onApply, target } = setup();
  expect(bridge.apply({ requestId: 'outer-container', commands: [{ op: 'insert', parentId: 'screen', node: { kind: 'element', id: 'outer', tag: 'section', children: [] } }] }).ok).toBe(true);
  const compiled = compileScreen(bridge.document);
  if (!compiled.ok) throw new Error('fixture compilation');
  const plan = compiled.plan.documentPlans?.[`${bridge.document.id}@${bridge.document.revision}`];
  if (!plan) throw new Error('fixture plan missing');
  const before = bridge.document, snapshot = bridge.getSnapshot();
  let selections = 0;
  const instance = mount(Layers, { target, props: { plan, document: before, onApply, componentDescriptors: catalogDescriptors, onSelect: () => { selections++; } } });
  let mounted = true;
  try {
    flushSync();
    for (let i = 0; i < 5 && !target.querySelector('[data-key^="surface-refusal|select-items-1|"]'); i++) {
      target.querySelector<HTMLButtonElement>('button.disclosure[aria-label^="Expand"]')?.click(); flushSync();
    }
    const part = target.querySelector<HTMLButtonElement>('[data-key^="surface-refusal|select-items-1|"]')!;
    const root = target.querySelector<HTMLButtonElement>('[data-key="surface-refusal|screen"]')!;
    expect(part, target.innerHTML).not.toBeNull();
    // The compiled occurrence carries its catalog ancestor. Layers already
    // refuses dragging that non-direct occurrence, even with onApply supplied.
    expect(part.getAttribute('draggable')).toBe('false');
    // happy-dom has no layout. Supply only the row rectangle; canonical data and
    // event handlers are real, and the actual browser probe remains separate evidence.
    root.getBoundingClientRect = () => new DOMRect(0, 0, 200, 40);
    const refusedStart = new Event('dragstart', { bubbles: true, cancelable: true });
    part.dispatchEvent(refusedStart); flushSync();
    expect(refusedStart.defaultPrevented).toBe(true);
    root.dispatchEvent(new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 20 })); flushSync();
    root.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true })); flushSync();
    expect(receipts).toHaveLength(0);
    expect(bridge.document).toEqual(before); expect(bridge.getSnapshot()).toEqual(snapshot); expect(selections).toBe(0);
    const provider = target.querySelector<HTMLButtonElement>('[data-key="surface-refusal|select"]')!;
    const outer = target.querySelector<HTMLButtonElement>('[data-key="surface-refusal|outer"]')!;
    expect(provider.getAttribute('draggable')).toBe('true');
    outer.getBoundingClientRect = () => new DOMRect(0, 0, 200, 40);
    provider.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true })); flushSync();
    outer.dispatchEvent(new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 20 })); flushSync();
    outer.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true })); flushSync();
    if (lifetime === 'mounted') {
      // Check actual asynchronous focus restoration while the surface remains.
      await vi.waitFor(() => expect(document.activeElement).toBe(provider));
    } else {
      // Navigation may destroy the surface before its queued focus work runs.
      // The unguarded implementation produced a Vitest unhandled rejection here.
      mounted = false;
      await unmount(instance);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    expect(receipts).toHaveLength(1); expect(receipts[0]).toMatchObject({ ok: true });
    expect(bridge.document.nodes.outer).toMatchObject({ children: ['select'] });
    expect(screenPlacementIssues(bridge.document)).toEqual([]); expect(selections).toBe(1);
  } finally { if (mounted) await unmount(instance); target.remove(); }
});
