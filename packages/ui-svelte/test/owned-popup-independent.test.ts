import {afterEach,describe,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import Harness from './OwnedPopupIndependentHarness.svelte';
import {mountDoc,teardownAll} from './probe-kit.js';
import type {UiNode} from '@victframework/ui';
import {createOwnedDialogBehavior} from '../src/owned-dialog.js';
import {registerOwnedPopupLayer,resolveOwnedPopupOwner,observeOwnedPopupSource} from '../src/owned-popup.js';
import {createOwnedMenuBehavior,createOwnedMenuContext} from '../src/owned-menu.js';

const cleanup:(()=>void)[]=[];
const mounts:ReturnType<typeof mount>[]=[];
afterEach(async()=>{teardownAll();for(const instance of mounts.splice(0))await unmount(instance);for(const dispose of cleanup.reverse())dispose();cleanup.length=0;vi.restoreAllMocks();document.body.innerHTML='';});
function key(target:HTMLElement,value:string){const event=new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true});target.dispatchEvent(event);return event;}
function owner(){const root=document.createElement('main');root.dataset.uiApplicationViewport='';document.body.append(root);return root;}
function dialog(){
  const root=owner(),trigger=document.createElement('button'),panel=document.createElement('section');panel.tabIndex=-1;
  panel.innerHTML='<button>First</button><button>Last</button>';
  root.append(trigger,panel);trigger.focus();
  cleanup.push(createOwnedDialogBehavior({owner:root,panel,getTrigger:()=>trigger,onDismiss:()=>{}}));
  return{root,trigger,panel,first:panel.firstElementChild as HTMLButtonElement,last:panel.lastElementChild as HTMLButtonElement};
}
function popup(root:HTMLElement,trigger:HTMLElement,role:'menu'|'tooltip'){
  const panel=document.createElement('div');panel.role=role;panel.id=`independent-${role}`;panel.tabIndex=-1;
  trigger.dataset.uiOwner=panel.dataset.uiOwner='independent-doc';trigger.dataset.uiOcc=panel.dataset.uiOcc=`independent-${role}`;
  panel.dataset.uiPart='content';
  if(role==='menu'){trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-haspopup','menu');}
  else trigger.setAttribute('aria-describedby',panel.id);
  root.append(panel);return panel;
}

describe('independent shared owned-popup challenge',()=>{
  it('admits the exact sibling outlet popup without admitting another canonical document root',()=>{
    const root=owner(),source=document.createElement('section'),foreign=document.createElement('section'),outlet=document.createElement('div');
    source.dataset.uiOwnerRoot='doc-a';foreign.dataset.uiOwnerRoot='doc-b';
    const trigger=document.createElement('button'),other=document.createElement('input');source.append(trigger);foreign.append(other);root.append(source,foreign,outlet);
    const panel=popup(outlet,trigger,'menu');trigger.dataset.uiOwner=panel.dataset.uiOwner='doc-a';panel.innerHTML='<button role="menuitem">Own popup</button>';
    const handle=vi.fn((event:KeyboardEvent)=>event.preventDefault());
    const layer=registerOwnedPopupLayer({owner:root,panel,kind:'menu',getTrigger:()=>trigger,onKeydown:handle});cleanup.push(()=>layer.dispose());
    expect(resolveOwnedPopupOwner(trigger)).toBe(root);
    const choice=panel.firstElementChild as HTMLButtonElement;choice.focus();expect(key(choice,'Escape').defaultPrevented).toBe(true);
    handle.mockClear();other.focus();expect(key(other,'Escape').defaultPrevented).toBe(false);expect(handle).not.toHaveBeenCalled();
  });
  it('resolves a standalone canonical owner and excludes another nested canonical application',()=>{
    const root=document.createElement('section');root.dataset.uiOwnerRoot='standalone-a';
    const trigger=document.createElement('button'),panel=document.createElement('div'),nested=document.createElement('section'),other=document.createElement('input');
    nested.dataset.uiOwnerRoot='standalone-b';nested.append(other);root.append(trigger,panel,nested);document.body.append(root);
    expect(resolveOwnedPopupOwner(trigger)).toBe(root);
    const handler=vi.fn((event:KeyboardEvent)=>event.preventDefault());
    const layer=registerOwnedPopupLayer({owner:root,panel,kind:'tooltip',getTrigger:()=>trigger,onKeydown:handler});cleanup.push(()=>layer.dispose());
    other.focus();expect(key(other,'Escape').defaultPrevented).toBe(false);expect(handler).not.toHaveBeenCalled();
  });
  it('keeps the underlying dialog focus boundary active under a nonmodal tooltip',()=>{
    const d=dialog(),tip=popup(d.root,d.last,'tooltip');tip.textContent='Description';
    const layer=registerOwnedPopupLayer({owner:d.root,panel:tip,kind:'tooltip',getTrigger:()=>d.last});cleanup.push(()=>layer.dispose());
    d.first.focus();const outside=document.createElement('button');d.root.append(outside);outside.focus();
    expect(document.activeElement).not.toBe(outside);
    expect(d.panel.contains(document.activeElement)).toBe(true);
  });
  it('keeps an already-open dialog operable when its launcher becomes disabled',()=>{
    const d=dialog();d.trigger.disabled=true;d.first.focus();
    expect(key(d.first,'Escape').defaultPrevented).toBe(true);
  });
  it('keeps dialog focus containment under an open menu while admitting that exact child popup',()=>{
    const d=dialog(),menu=popup(d.root,d.last,'menu');menu.innerHTML='<button role="menuitem">Choice</button>';
    const context=createOwnedMenuContext({trigger:()=>d.last,panel:()=>menu,owner:()=>d.root,requestClose:()=>{}});
    cleanup.push(createOwnedMenuBehavior({owner:d.root,panel:menu,context}));
    const choice=menu.firstElementChild as HTMLButtonElement;choice.focus();expect(document.activeElement).toBe(choice);
    const outside=document.createElement('button');d.root.append(outside);outside.focus();
    expect(document.activeElement).not.toBe(outside);
    expect(d.panel.contains(document.activeElement)||menu.contains(document.activeElement)).toBe(true);
  });
  it('continues menu Tab dismissal into the newly exposed parent dialog boundary',()=>{
    const d=dialog(),menu=popup(d.root,d.last,'menu');menu.innerHTML='<button role="menuitem">Choice</button>';
    let release=()=>{};
    const context=createOwnedMenuContext({trigger:()=>d.last,panel:()=>menu,owner:()=>d.root,requestClose:()=>{release();menu.remove();d.last.setAttribute('aria-expanded','false');}});
    release=createOwnedMenuBehavior({owner:d.root,panel:menu,context});cleanup.push(release);
    const choice=menu.firstElementChild as HTMLButtonElement;choice.focus();
    const event=key(choice,'Tab');
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(d.first);
  });
  it('does not consume ArrowLeft in a different editable surface merely because a submenu remains open',()=>{
    const root=owner(),trigger=document.createElement('button'),panel=document.createElement('div'),input=document.createElement('input');panel.role='menu';panel.innerHTML='<button role="menuitem">Choice</button>';root.append(trigger,panel,input);
    const closed=vi.fn(),parent=createOwnedMenuContext({trigger:()=>trigger,panel:()=>panel,owner:()=>root,requestClose:()=>{}});
    const context=createOwnedMenuContext({trigger:()=>trigger,panel:()=>panel,owner:()=>root,parent,requestClose:closed});
    cleanup.push(createOwnedMenuBehavior({owner:root,panel,context}));input.focus();
    const event=key(input,'ArrowLeft');
    expect(event.defaultPrevented).toBe(false);expect(closed).not.toHaveBeenCalled();expect(document.activeElement).toBe(input);
  });
  it('excludes a hidden source immediately even if its controlled host ignores the close request',async()=>{
    const root=owner(),trigger=document.createElement('button'),panel=document.createElement('div'),input=document.createElement('input');panel.role='menu';root.append(trigger,panel,input);
    const keyboard=vi.fn((event:KeyboardEvent)=>event.preventDefault()),hidden=vi.fn();
    const layer=registerOwnedPopupLayer({owner:root,panel,kind:'menu',getTrigger:()=>trigger,onKeydown:keyboard,onSourceHidden:hidden});cleanup.push(()=>layer.dispose());
    trigger.hidden=true;input.focus();const event=key(input,'Escape');
    expect(event.defaultPrevented).toBe(false);expect(keyboard).not.toHaveBeenCalled();
    await new Promise(resolve=>setTimeout(resolve,0));expect(hidden).toHaveBeenCalled();
  });
  it('reconciles source visibility when responsive CSS changes on resize without an attribute mutation',async()=>{
    const root=owner(),trigger=document.createElement('button');root.append(trigger);
    const original=window.getComputedStyle.bind(window),hiddenStyle=document.createElement('div').style;
    hiddenStyle.display='none';hiddenStyle.visibility='visible';let responsiveHidden=false;
    vi.spyOn(window,'getComputedStyle').mockImplementation((element,pseudo)=>element===trigger&&responsiveHidden?hiddenStyle:original(element,pseudo));
    const hidden=vi.fn(),visibility=vi.fn();cleanup.push(observeOwnedPopupSource(root,trigger,hidden,visibility));
    expect(visibility).toHaveBeenLastCalledWith(true);responsiveHidden=true;
    window.dispatchEvent(new Event('resize'));await new Promise(resolve=>setTimeout(resolve,0));
    expect(hidden).toHaveBeenCalledOnce();expect(visibility).toHaveBeenLastCalledWith(false);
  });
  it('closes only the affected submenu when that submenu trigger is hidden',async()=>{
    mounts.push(mount(Harness,{target:document.body}));flushSync();await new Promise(resolve=>setTimeout(resolve,20));flushSync();
    expect(document.getElementById('independent-child-menu')).not.toBeNull();
    document.querySelector<HTMLElement>('[data-independent-child-trigger]')!.hidden=true;
    await new Promise(resolve=>setTimeout(resolve,20));flushSync();
    expect(document.getElementById('independent-child-menu')).toBeNull();
    expect(document.getElementById('independent-parent-menu')).not.toBeNull();
    expect(document.querySelector('[data-child-requests]')?.textContent).toBe('1');
    expect(document.querySelector('[data-parent-requests]')?.textContent).toBe('0');
  });
  it('does not restore focus out of a nested canonical application during imperative menu close',()=>{
    const root=owner(),source=document.createElement('section'),trigger=document.createElement('button'),panel=document.createElement('div'),foreign=document.createElement('section'),input=document.createElement('input');
    source.dataset.uiOwnerRoot='imperative-a';trigger.dataset.uiOwner='imperative-a';panel.dataset.uiOwner='imperative-a';foreign.dataset.uiOwnerRoot='imperative-b';
    source.append(trigger);foreign.append(input);panel.append(foreign);root.append(source,panel);
    const closed=vi.fn();const context=createOwnedMenuContext({trigger:()=>trigger,panel:()=>panel,owner:()=>root,requestClose:closed});
    input.focus();context.close('programmatic');
    expect(closed).toHaveBeenCalledOnce();expect(document.activeElement).toBe(input);
  });
  it('skips a retained hidden menubar trigger and repairs the visible roving Tab stop',async()=>{
    const text=(value:string)=>({type:'literal' as const,value});
    const nodes:Record<string,UiNode>={root:{kind:'element',id:'root',tag:'main',children:['bar']},bar:{kind:'component',id:'bar',definitionId:'vict.catalog.menubar',props:{value:{type:'ref',path:'state.bar'}},slots:{menus:{name:'menus',children:['one','two','three']}},outputs:{valueChange:{setState:{key:'bar',value:{type:'ref',path:'$output'}}}}}};
    for(const id of ['one','two','three']){
      nodes[id]={kind:'component',id,definitionId:'vict.catalog.menubar.menu',props:{value:text(id),label:text(id)},slots:{items:{name:'items',children:[`${id}-item`]}}};
      nodes[`${id}-item`]={kind:'component',id:`${id}-item`,definitionId:'vict.catalog.menubar.item',props:{label:text('Action'),value:text(id)}};
    }
    const host=mountDoc({root:'root',nodes},{bar:{key:'bar',type:'string',initial:''}});flushSync();await new Promise(resolve=>setTimeout(resolve,15));flushSync();
    const triggers=[...host.querySelectorAll<HTMLButtonElement>('[data-owned-menubar-trigger]')];expect(triggers).toHaveLength(3);
    triggers[1]!.hidden=true;await new Promise(resolve=>setTimeout(resolve,0));
    triggers[0]!.focus();key(triggers[0]!,'ArrowRight');expect(document.activeElement).toBe(triggers[2]);
    triggers[0]!.hidden=true;await new Promise(resolve=>setTimeout(resolve,0));
    expect(triggers[2]!.tabIndex).toBe(0);
  });
});
