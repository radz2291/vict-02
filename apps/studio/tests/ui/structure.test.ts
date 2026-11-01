// @vitest-environment happy-dom
import {wholeHierarchy} from './studio-menu.js';
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick, flushSync } from 'svelte';
import { canonicalUiDocument } from '@victframework/ui';
import StructureView from '../../src/lib/designer/StructureView.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { structureId } from '../../src/lib/designer/structure.js';

let mounted: ReturnType<typeof mount> | undefined;
afterEach(async () => { if (mounted) await unmount(mounted); mounted = undefined; document.body.innerHTML = ''; });
const button = (name: string) => {
  const found = [...document.querySelectorAll<HTMLElement>('button,[role="menuitem"]')].find(item => item.getAttribute('aria-label') === name || item.textContent?.trim() === name);
  expect(found, name).toBeDefined(); return found!;
};
async function settle(){flushSync();await tick();await tick();}
function key(target:HTMLElement,name:string){target.focus();target.dispatchEvent(new KeyboardEvent('keydown',{key:name,code:name,bubbles:true,cancelable:true}));}
function node(id:string){const found=document.querySelector<HTMLElement>(`.svelte-flow__node[data-id="${id}"]`);expect(found,id).not.toBeNull();return found!;}
async function inspect(){await menu('Object');button('Inspect').click();await settle();}
async function menu(name: string) {
  const trigger = [...document.querySelectorAll<HTMLElement>('.structure-tools [role="menubar"] > button')].find(item => item.textContent === name)!;
  expect(trigger).toBeDefined();
  trigger.focus();
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await tick(); await tick();
}
async function find(id: string) {
  await menu('View'); button('Find source item').click(); await tick();
  const field = document.querySelector<HTMLSelectElement>('[aria-label="Structure source selection"]')!;
  field.value = id; field.dispatchEvent(new Event('change', { bubbles: true })); await tick();
}

it('keeps inspection closed and the camera/search stable during ordinary source selection', async () => {
  const source = newScreen('Flow render', 'flow-render');
  const digest = canonicalUiDocument(source).contentDigest;
  const onSelect = vi.fn(); const onMove = vi.fn(() => false);
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', onSelect, onMove, onNotice: vi.fn() } });
  await tick(); await tick();
  expect(document.querySelector('.svelte-flow')).not.toBeNull();
  expect([...document.querySelectorAll('button')].filter(item=>item.getAttribute('aria-label')==='Fit all')).toHaveLength(1);
  expect(document.querySelector('.svelte-flow__controls-fitview')).toBeNull();
  expect(document.querySelector('.structure-details')).toBeNull();
  const search = document.querySelector<HTMLInputElement>('[aria-label="Search structure"]')!;
  search.value = 'screen'; search.dispatchEvent(new Event('input', { bubbles: true })); await tick();
  const viewport = document.querySelector<HTMLElement>('.svelte-flow__viewport')!;
  const transform = viewport.style.transform;
  document.querySelector<HTMLElement>('.svelte-flow__node')!.click(); await tick(); await tick();
  expect(onSelect).toHaveBeenCalledWith(`${source.id}|${source.root}`);
  expect(viewport.style.transform).toBe(transform);
  expect(search.value).toBe('screen');
  expect(document.querySelector('.structure-details')).toBeNull();
  expect(onMove).not.toHaveBeenCalled();
  expect(canonicalUiDocument(source).contentDigest).toBe(digest);
});

it('opens inspection deliberately and Escape closes it with focus restored, preserving shared selection', async () => {
  const source = newScreen('Disclosure', 'disclosure'); const onSelect = vi.fn();
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', onSelect, onMove: vi.fn(() => false), onNotice: vi.fn() } });
  await tick(); await tick();
  key(node(structureId(source.id,'node',source.root)),'Enter');await settle();onSelect.mockClear();
  await inspect();
  expect(document.querySelector('.structure-details')).not.toBeNull();
  key(button('Details'),'Escape');await settle();
  expect(document.querySelector('.structure-details')).toBeNull();
  expect(document.activeElement).toBe(button('Object'));
  expect(document.querySelector('.svelte-flow__node.selected')?.getAttribute('data-id')).toBe(structureId(source.id,'node',source.root));
  expect(onSelect).not.toHaveBeenCalled();
});

it('synchronizes keyboard graph selection with shared selection and inspection without opening tools or moving the camera', async () => {
  const base = newScreen('Keyboard selection', 'keyboard-selection');
  const source = { ...base, nodes: { ...base.nodes,
    screen: { id: 'screen', kind: 'element' as const, tag: 'main', children: ['right'] },
    right: { id: 'right', kind: 'element' as const, tag: 'section', attributes: { 'aria-label': 'Right group' }, children: [] },
  } };
  const onSelect = vi.fn(); const onDeselect = vi.fn();
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', onSelect, onDeselect, onMove: vi.fn(() => false), onNotice: vi.fn() } });
  await tick(); await tick();
  const viewport = document.querySelector<HTMLElement>('.svelte-flow__viewport')!;
  await wholeHierarchy();
  const before = viewport.style.transform;
  const node = [...document.querySelectorAll<HTMLElement>('.svelte-flow__node')].find(item => item.dataset.id === structureId(source.id, 'node', 'right'))!;
  node.focus(); node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
  await tick(); await tick();
  expect(onSelect).toHaveBeenCalledWith(`${source.id}|right`);
  expect(viewport.style.transform).toBe(before);
  expect(document.querySelector('.structure-details')).toBeNull();
  await inspect();
  expect(document.querySelector('.inspection-heading strong')?.textContent).toBe('Right group');
  expect(document.querySelector('.inspection-identity code')?.textContent).toBe('right');
  node.focus(); node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  await tick(); await tick();
  expect(document.querySelector('.structure-details')).toBeNull();
  expect(document.querySelector<HTMLElement>('.svelte-flow__node.selected')?.dataset.id).toBe(structureId(source.id, 'node', 'right'));
  expect(onDeselect).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(button('Object'));
  node.focus(); node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  await tick(); await tick();
  expect(onDeselect).toHaveBeenCalledOnce();
  expect(document.querySelector('.svelte-flow__node.selected')).toBeNull();
});

it('refuses source navigation and contextual moves while the host has an unapplied draft', async () => {
  const source = newScreen('Draft refusal', 'draft-refusal');
  const onSelect = vi.fn(); const onMove = vi.fn(() => false); const onNotice = vi.fn();
  const digest=canonicalUiDocument(source).contentDigest;
  const selected=structureId(source.id,'node',source.root);
  const onNavigate=vi.fn();
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', blocked: true, selection:{documentId:source.id,items:[{kind:'node',id:selected,occurrence:`${source.id}|${source.root}`}]}, onSelect, onMove, onNotice,onNavigate } });
  await tick(); await tick();
  await find(structureId(source.id, 'node', source.root));
  expect(onSelect).not.toHaveBeenCalled(); expect(onMove).not.toHaveBeenCalled();
  expect(document.querySelector<HTMLSelectElement>('[aria-label="Structure source selection"]')!.disabled).toBe(true);
  button('Close source tool').click();await settle();
  await menu('Object');
  for(const name of ['Inspect','Move inside…','Reveal in Layers'])expect(button(name).getAttribute('aria-disabled')).toBe('true');
  button('Move inside…').click();await settle();
  expect(document.querySelector<HTMLDialogElement>('.structure-utility')!.open).toBe(false);
  document.querySelector<HTMLElement>('[role="menu"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
  key(node(selected),'Enter');await settle();
  expect(onNotice).toHaveBeenCalledWith('Apply or cancel your draft before changing selection.');
  expect(onSelect).not.toHaveBeenCalled();expect(onMove).not.toHaveBeenCalled();expect(onNavigate).not.toHaveBeenCalled();
  expect(canonicalUiDocument(source).contentDigest).toBe(digest);
  expect(document.querySelector('.svelte-flow__node.selected')?.getAttribute('data-id')).toBe(selected);
});

it('closes connection inspection before clearing its selected relationship group',async()=>{
  const base=newScreen('Connection Escape','connection-escape');
  const source={...base,nodes:{screen:{id:'screen',kind:'element' as const,tag:'main',children:['first','second']},first:{id:'first',kind:'element' as const,tag:'p',children:[]},second:{id:'second',kind:'element' as const,tag:'p',children:[]}}};
  const before=canonicalUiDocument(source).contentDigest;
  const onSelect=vi.fn(),onMove=vi.fn(()=>false);
  mounted=mount(StructureView,{target:document.body,props:{document:source,revision:'working',onSelect,onMove,onNotice:vi.fn()}});await settle();
  const port=[...document.querySelectorAll<HTMLButtonElement>('.port-control')].find(item=>item.getAttribute('aria-label')?.startsWith('Select outgoing Contains'))!;
  expect(port).toBeDefined();port.click();await settle();
  // happy-dom has no measured canvas geometry, so SVG edges need not mount.
  // The counted port exposes whether every declared group member is selected.
  const selected=()=>port.getAttribute('aria-pressed');
  expect(selected()).toBe('true');expect(document.querySelector('.structure-count')!.textContent).toContain('2 selected');
  await inspect();key(button('Details'),'Escape');await settle();
  expect(document.querySelector('.structure-details')).toBeNull();expect(selected()).toBe('true');
  expect(document.querySelector('.structure-count')!.textContent).toContain('2 selected');
  key(port,'Escape');await settle();expect(selected()).toBe('false');
  expect(document.querySelector('.structure-count')!.textContent).not.toContain('selected');
  expect(onSelect).not.toHaveBeenCalled();expect(onMove).not.toHaveBeenCalled();expect(canonicalUiDocument(source).contentDigest).toBe(before);
});

it('hands declared state to Data and shows source facts without inventing runtime values', async () => {
  const source = newScreen('State navigation', 'state-navigation'); const onSelect = vi.fn(); const onNavigate = vi.fn();
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', onSelect, onMove: vi.fn(() => false), onNotice: vi.fn(), onNavigate } });
  await tick(); await tick();
  await find(structureId(source.id, 'state', 'accepted'));
  await inspect();
  button('Details').click(); await tick(); button('Edit in Data').click(); await tick();
  expect(onSelect).not.toHaveBeenCalled();
  expect(onNavigate).toHaveBeenCalledWith({ destination: 'data', sourceId: undefined, occurrence: undefined, key: 'accepted' });
  expect(document.querySelector('.structure-facts')?.textContent).toContain('initial');
});

it('scopes drawer Escape to its own page and dismisses the host only after inspection is closed', async () => {
  const source=newScreen('Drawer escape','drawer-escape');
  const onDismiss=vi.fn();
  mounted=mount(StructureView,{target:document.body,props:{document:source,revision:'working',presentation:'drawer',onSelect:vi.fn(),onMove:vi.fn(()=>false),onNotice:vi.fn(),onDismiss}});
  await tick();await tick();
  key(node(structureId(source.id,'node',source.root)),'Enter');await settle();await inspect();
  const outside=document.createElement('input');document.body.append(outside);outside.focus();
  outside.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await tick();
  expect(document.querySelector('[aria-label="Structure inspection"]')).not.toBeNull();
  expect(onDismiss).not.toHaveBeenCalled();
  const otherCanvasNode=document.createElement('div');otherCanvasNode.className='svelte-flow__node';otherCanvasNode.tabIndex=0;document.body.append(otherCanvasNode);
  const outsideEscape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});otherCanvasNode.dispatchEvent(outsideEscape);await settle();
  expect(outsideEscape.defaultPrevented).toBe(false);
  expect(document.querySelector('[aria-label="Structure inspection"]')).not.toBeNull();
  expect(document.querySelectorAll('[data-vict-structure] .svelte-flow__node.selected')).toHaveLength(1);
  const properties=button('Details');properties.focus();
  properties.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await tick();
  expect(document.querySelector('[aria-label="Structure inspection"]')).toBeNull();
  expect(onDismiss).not.toHaveBeenCalled();
  const search=document.querySelector<HTMLInputElement>('[aria-label="Search structure"]')!;
  expect(document.activeElement).toBe(button('Object'));
  key(search,'Escape');await settle();
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('offers guarded contextual moves through named keyboard controls and exits move mode on acknowledgement', async () => {
  const base = newScreen('Keyboard move', 'keyboard-move');
  const source = { ...base, nodes: {
    screen: { id: 'screen', kind: 'element' as const, tag: 'main', children: ['left', 'right'] },
    left: { id: 'left', kind: 'element' as const, tag: 'section', children: ['item'] },
    right: { id: 'right', kind: 'element' as const, tag: 'section', children: [] },
    item: { id: 'item', kind: 'text' as const, content: { type: 'literal' as const, value: 'Move this' } },
  } };
  const onMove = vi.fn(() => true).mockReturnValueOnce(false);
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', onSelect: vi.fn(), onMove, onNotice: vi.fn() } });
  await tick(); await tick(); await find(structureId(source.id, 'node', 'item'));
  await menu('Object'); button('Move inside…').click(); await tick();
  const content = document.querySelector<HTMLSelectElement>('[aria-label="Content to move"]')!;
  expect(content.value).toBe(structureId(source.id, 'node', 'item'));
  const target = document.querySelector<HTMLSelectElement>('[aria-label="Move destination"]')!;
  expect([...target.options].some(option => option.value === structureId(source.id, 'node', 'item'))).toBe(false);
  expect([...target.options].map(option => option.value)).toContain(structureId(source.id, 'node', 'right'));
  target.value = structureId(source.id, 'node', 'right'); target.dispatchEvent(new Event('change', { bubbles: true })); await tick();
  expect((button('Move') as HTMLButtonElement).disabled).toBe(false);
  const dialog=target.closest('dialog')!;expect(dialog.open).toBe(true);
  button('Move').click(); await settle();
  expect(onMove).toHaveBeenCalledWith({ documentId: source.id, revision: 'working', source: structureId(source.id, 'node', 'item'), target: structureId(source.id, 'node', 'right') });
  expect(dialog.open).toBe(true);expect(target.value).toBe(structureId(source.id,'node','right'));
  button('Move').click();await settle();expect(onMove).toHaveBeenCalledTimes(2);
  expect(dialog.open).toBe(false);
  expect(document.querySelector('.structure-scope-actions')).toBeNull();
  expect(target.value).toBe('');
});
