// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick, flushSync } from 'svelte';
vi.mock('$app/navigation', () => ({ beforeNavigate: () => {} }));
import Designer from '../../src/lib/designer/Designer.svelte';
import { newScreen, compileScreen } from '../../src/lib/designer/application.js';
import { screenStore } from '../../src/lib/designer/storage.js';
import type { UiDocument } from '@victframework/ui';
import { openStudioMenu } from './studio-menu.js';
import { structureId } from '../../src/lib/designer/structure.js';
let editor: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (editor) await unmount(editor);
  document.body.innerHTML = '';
  localStorage.clear();
});
const button = (name: string) => {
  const item = [...document.querySelectorAll<HTMLElement>('button,[role="menuitem"]')].find(
    (item) => item.getAttribute('aria-label') === name || item.textContent?.trim() === name,
  );
  expect(item, name).toBeDefined();
  if(!(['Layers','Data','Actions','Source'].includes(name) && item!.getAttribute('aria-expanded')==='true'))item!.click();
  flushSync();
  return item!;
};

it('preserves the canvas, runtime input, scroll and graph context through Structure drawer transitions', async () => {
  const seed = newScreen('Drawer continuity', 'drawer-continuity');
  const source: UiDocument = { ...seed, revision: 'r1.r1', nodes: {
    screen: { id:'screen', kind:'element', tag:'main', children:['group'] },
    group: { id:'group', kind:'element', tag:'section', attributes:{'aria-label':'Customer'}, children:['field'] },
    field: { id:'field', kind:'element', tag:'input', attributes:{type:'text','aria-label':'Customer name',value:{type:'ref',path:'state.message'}}, children:[], interactions:[{on:'change',action:'setState',key:'message',value:{type:'ref',path:'state.message'}}] },
  } };
  const store = screenStore(localStorage, source.id);
  expect(store.save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);
  editor = mount(Designer, {target:document.body}); await tick(); await tick();
  const frame = document.querySelector('.design-frame')!;
  const scroll = document.querySelector<HTMLElement>('.canvas-scroll')!;
  const identity = document.querySelector('.design-status > span:last-child')!.getAttribute('title');
  expect([...document.querySelectorAll('.canvas-modes button')].map(node=>node.textContent)).toEqual(['Design','Interact']);
  button('Interact'); await tick();
  const input = document.querySelector<HTMLInputElement>('.design-frame [aria-label="Customer name"]')!;
  input.value='Runtime stays here'; input.dispatchEvent(new Event('change',{bubbles:true})); await tick(); await tick();
  scroll.scrollTop=70; scroll.scrollLeft=15;
  button('Document'); await tick(); button('Structure'); await tick(); await tick();
  const graph = document.querySelector('.structure-view')!;
  expect(document.querySelector('.design-frame')).toBe(frame);
  expect(scroll.style.display).not.toBe('none'); expect(input.value).toBe('Runtime stays here');
  const search = document.querySelector<HTMLInputElement>('[aria-label="Search structure"]')!;
  search.value='Customer'; search.dispatchEvent(new Event('input',{bubbles:true})); await tick(); await tick();
  const node = [...document.querySelectorAll<HTMLElement>('.svelte-flow__node')].find(node=>node.dataset.id===structureId(source.id,'node','group'))!;
  expect(node).toBeDefined(); node.focus(); node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})); await tick(); await tick();
  expect(document.querySelector('[aria-label="Composition navigation"]')).toBeNull();
  expect(scroll.scrollTop).toBe(70); expect(scroll.scrollLeft).toBe(15);
  expect(document.querySelector('[aria-label="Floating selection tools"]')).toBeNull();
  button('Expand Structure'); await tick(); button('Restore Structure'); await tick();
  button('Data'); await tick(); button('Structure'); await tick();
  expect(document.querySelector('.structure-view')).toBe(graph); expect(search.value).toBe('Customer');
  button('Close document'); await tick();
  expect(document.querySelector<HTMLElement>('#document-drawer')!.hidden).toBe(true);
  button('Document'); await tick();
  expect(document.querySelector('.structure-view')).toBe(graph); expect(search.value).toBe('Customer');
  expect(document.querySelector('.design-frame')).toBe(frame); expect(input.value).toBe('Runtime stays here');
  expect(document.querySelector('.design-status > span:last-child')!.getAttribute('title')).toBe(identity);
  expect(store.rawLoad()).toMatchObject({document:source});
});

it('retains Source drafts and refuses drawer/mode transitions until the draft is discarded', async () => {
  const source={...newScreen('Drawer draft','drawer-draft'),revision:'r1.r1'};
  expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);
  editor=mount(Designer,{target:document.body}); await tick(); await tick();
  button('Document'); await tick(); button('Source'); await tick();
  const draft=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;
  draft.value+=' '; draft.dispatchEvent(new Event('input',{bubbles:true})); await tick();
  const dataRow=document.querySelector<HTMLButtonElement>('.data-row')!;
  expect(dataRow.disabled).toBe(true); button('Interact'); await tick();
  expect(document.querySelector('.canvas-modes button')!.getAttribute('aria-pressed')).toBe('true');
  button('Close document'); await tick();
  expect(document.querySelector<HTMLElement>('#document-drawer')!.hidden).toBe(false); expect(draft.value.endsWith(' ')).toBe(true);
  button('Discard draft'); await tick(); button('Close document');await tick();button('Structure'); await tick();
  const search=document.querySelector<HTMLInputElement>('[aria-label="Search structure"]')!;
  search.focus(); search.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); await tick();
  expect(document.querySelector<HTMLElement>('#document-drawer')!.hidden).toBe(true);
  expect(document.querySelector<HTMLElement>('.dock-panel')!.hidden).toBe(true);
  expect(document.activeElement).toBe(document.querySelector('.structure-toggle'));
});

it('opens another saved screen through File and guards the cascading menu during a source draft', async () => {
  const first = { ...newScreen('First screen', 'first-screen'), revision: 'r1.r1' };
  const second = { ...newScreen('Second screen', 'second-screen'), revision: 'r1.r1' };
  for (const source of [first, second]) {
    expect(screenStore(localStorage, source.id).save({
      document: source, expectedStoredRevision: 'r1', newStoredRevision: 'r1.r1',
    }).ok).toBe(true);
  }
  localStorage.setItem('vict.studio.active-screen', first.id);
  editor = mount(Designer, { target: document.body });
  await tick();
  await tick();
  expect(document.querySelector('#screen-picker')).toBeNull();
  expect(document.querySelector('.current-screen')?.textContent).toBe('First screen');
  expect([...document.querySelectorAll('.studio-menus > button')].map(item => item.textContent))
    .toEqual(['File', 'Edit', 'View', 'Preview']);
  await openStudioMenu('File');
  document.querySelector<HTMLElement>('.workspace-menu [role="menuitem"][aria-haspopup="menu"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  await tick();
  await tick();
  const screens = [...document.querySelectorAll<HTMLElement>('.open-screen-menu [role="menuitemradio"]')];
  expect(screens.find(item => item.textContent?.includes('First screen'))?.getAttribute('aria-checked')).toBe('true');
  screens.find(item => item.textContent?.includes('Second screen'))!.click();
  await tick();
  expect(document.querySelector('.current-screen')?.textContent).toBe('Second screen');
  expect(screenStore(localStorage, second.id).rawLoad()).toMatchObject({ document: second });
  button('Document');
  await tick();
  button('Source');
  await tick();
  document.querySelector<HTMLTextAreaElement>('#canonical-source')!
    .dispatchEvent(new Event('input', { bubbles: true }));
  await tick();
  await openStudioMenu('File');
  expect(document.querySelector('.workspace-menu [role="menuitem"][aria-haspopup="menu"]')!.getAttribute('aria-disabled')).toBe('true');
  expect(document.querySelector('.current-screen')?.textContent).toBe('Second screen');
});

it('opens a closed composition without authored or runtime changes, guards drafts, and saves the same edited source for replay', async () => {
  const seed = newScreen('Composition trial', 'composition-trial');
  const source: UiDocument = {
    ...seed,
    revision: 'r1.r1',
    nodes: {
      ...seed.nodes,
      screen: { ...seed.nodes.screen!, children: ['dialog'] } as UiDocument['nodes'][string],
      dialog: {
        id: 'dialog',
        kind: 'component',
        definitionId: 'vict.catalog.dialog',
        props: {
          title: { type: 'literal', value: 'Details' },
          open: { type: 'literal', value: false },
        },
        slots: { body: { name: 'body', children: ['paragraph'] } },
      },
      paragraph: { id: 'paragraph', kind: 'element', tag: 'p', children: ['copy'] },
      copy: { id: 'copy', kind: 'text', content: { type: 'literal', value: 'Original body' } },
    },
  };
  const store = screenStore(localStorage, source.id);
  expect(
    store.save({ document: source, expectedStoredRevision: 'r1', newStoredRevision: 'r1.r1' }).ok,
  ).toBe(true);
  editor = mount(Designer, { target: document.body });
  await tick();
  await tick();
  const scroll = document.querySelector<HTMLElement>('.canvas-scroll')!;
  scroll.scrollTop = 100;
  const trigger = document.querySelector<HTMLElement>('[data-testid=dialog-trigger]')!;
  trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  trigger.click();
  await tick();
  const entry = document.querySelector<HTMLButtonElement>(
    '[aria-label="Open Details composition"]',
  );
  expect(entry?.closest('.palette-header')).not.toBeNull();
  expect(document.querySelector('.composition-entry')).toBeNull();
  entry!.click();
  await tick();
  expect(document.querySelector('[aria-label="Composition navigation"]')).not.toBeNull();
  await tick();
  expect(scroll.scrollTop).toBe(0);
  expect(document.querySelector('.design-frame')?.textContent).toContain('Original body');
  expect(
    document.querySelector('[data-testid=dialog-panel][data-ui-composition-surface=body]'),
  ).not.toBeNull();
  expect(document.querySelector('.save-state')?.textContent).toContain('Saved');
  await openStudioMenu('Edit');
  expect(document.querySelector('[title="Undo · Ctrl+Z"]')?.getAttribute('aria-disabled')).toBe('true');
  document.querySelector('[role="menu"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles:true, cancelable: true }));
  const paragraph = document.querySelector<HTMLElement>('[data-ui-node=paragraph]')!;
  paragraph.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  await tick();
  const field = document.querySelector<HTMLTextAreaElement>('[aria-label="Text content"]')!;
  expect(field).not.toBeNull();
  field.value = 'Edited composition body';
  field.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
  expect(
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '[aria-label="Composition navigation"] button',
      ),
    ].every((item) => item.disabled),
  ).toBe(true);
  field.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }),
  );
  await tick();
  expect(document.querySelector('.design-frame')?.textContent).toContain('Edited composition body');
  button('← Back');
  await tick();
  expect(document.querySelector('[aria-label="Composition navigation"]')).toBeNull();
  expect(document.querySelector('.design-frame')?.textContent).not.toContain(
    'Edited composition body',
  );
  button('Document');await tick();button('Layers');
  await tick();
  const collapsedDetails=document.querySelector<HTMLButtonElement>('[aria-label="Expand Details"]');
  if(collapsedDetails){collapsedDetails.click();await tick();}
  expect(document.querySelector('[role="treeitem"][data-key$="|dialog"]')?.getAttribute('aria-expanded')).toBe('true');
  document.querySelector<HTMLButtonElement>('[role="treeitem"][data-key$="slot:body"]')!.click();
  await tick();
  await tick();
  expect(document.querySelector('[aria-label="Composition navigation"]')).not.toBeNull();
  expect(document.querySelector('#document-drawer')).not.toBeNull();
  expect(document.querySelector('[aria-label="Floating selection tools"]')).toBeNull();
  button('← Back');
  await tick();
  expect(document.querySelector('#document-drawer')).not.toBeNull();
  await openStudioMenu('File');
  button('Save');
  await tick();
  const loaded = store.rawLoad();
  expect(loaded.status).toBe('loaded');
  if (loaded.status !== 'loaded') throw Error('Save failed');
  expect(loaded.document.nodes.copy).toMatchObject({
    content: { value: 'Edited composition body' },
  });
  expect(loaded.document.nodes.dialog).toEqual(source.nodes.dialog);
  const original = compileScreen(source),
    saved = compileScreen(loaded.document);
  expect(
    original.ok && saved.ok && original.plan.applicationVersion !== saved.plan.applicationVersion,
  ).toBe(true);
  await openStudioMenu('File');
  button('Reload saved version');
  await tick();
  expect(document.querySelector('[aria-label="Composition navigation"]')).toBeNull();
});

it('keeps data drafts safe across document navigation and saves applied starting values', async () => {
  const source = { ...newScreen('Document trial', 'document-trial'), revision: 'r1.r1' };
  const store = screenStore(localStorage, source.id);
  expect(
    store.save({ document: source, expectedStoredRevision: 'r1', newStoredRevision: 'r1.r1' }).ok,
  ).toBe(true);
  editor = mount(Designer, { target: document.body });
  await tick();
  await tick();
  button('Document');
  await tick();
  if(document.querySelector<HTMLElement>('#document-drawer')!.hidden){button('Document');await tick();}
  button('Layers');await tick();
  document.querySelector<HTMLButtonElement>('.uv-layers [role="treeitem"]')!.click();
  await tick();
  expect(document.querySelector('#document-drawer')).not.toBeNull();
  expect(document.querySelector('[aria-label="Floating selection tools"]')).toBeNull();
  const canvasRoot = document.querySelector<HTMLElement>('.design-frame [data-ui-node="screen"]')!;
  canvasRoot.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  canvasRoot.click();
  await tick();
  await tick();
  expect(document.querySelector('[aria-label="Floating selection tools"]')).not.toBeNull();
  if(document.querySelector<HTMLElement>('#document-drawer')!.hidden){button('Document');await tick();}
  button('Layers');await tick();
  document.querySelector<HTMLButtonElement>('.uv-layers [role="treeitem"]')!.click();
  await tick();
  expect(document.querySelector('[aria-label="Floating selection tools"]')).toBeNull();
  button('Data');
  await tick();
  const row = [...document.querySelectorAll<HTMLButtonElement>('.data-row')].find((item) =>
    item.textContent?.includes('Message'),
  )!;
  row.click();
  await tick();
  const field = document.querySelector<HTMLTextAreaElement>('[aria-label="Starting value"]')!;
  field.value = 'Saved from the document data editor';
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await tick();
  await tick();
  expect(document.querySelector<HTMLTextAreaElement>('#canonical-source')!.disabled).toBe(true);
  document.querySelector<HTMLButtonElement>('[aria-label="Close document"]')!.click();
  await tick();
  expect(document.querySelector('#document-drawer')).not.toBeNull();
  button('Cancel');
  await tick();
  expect(field.value).toBe(String(source.localState.message!.initial));
  field.value = 'Saved from the document data editor';
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await tick();
  await tick();
  button('Apply');
  await tick();
  await tick();
  await openStudioMenu('File');
  button('Save');
  await tick();
  const saved = store.rawLoad();
  if (saved.status !== 'loaded') throw Error('Missing saved document');
  expect(saved.document.localState.message!.initial).toBe('Saved from the document data editor');
  button('Source');
  await tick();
  expect(document.querySelector('.document-sections .source-body')).not.toBeNull();
  expect(document.querySelector<HTMLTextAreaElement>('#canonical-source')?.value).toContain(
    'Saved from the document data editor',
  );
});
