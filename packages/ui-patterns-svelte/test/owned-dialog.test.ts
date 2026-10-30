import {afterEach,describe,expect,it,vi} from 'vitest';
import {createOwnedDialogBehavior,ownedDialogBranches} from '@victframework/ui-svelte';

let releases:(()=>void)[]=[];
afterEach(()=>{for(const release of releases.reverse())release();releases=[];vi.restoreAllMocks();document.body.innerHTML='';});
function fixture(doc:Document=document){
  const owner=doc.createElement('main');owner.setAttribute('data-ui-application-viewport','');owner.style.overflow='auto';
  const trigger=doc.createElement('button');trigger.textContent='Open';
  const panel=doc.createElement('div');panel.tabIndex=-1;panel.setAttribute('role','dialog');
  panel.innerHTML='<button>First</button><input aria-label="Last"/>';
  owner.append(trigger,panel);doc.body.append(owner);
  return{owner,panel,trigger,first:panel.querySelector('button')!,last:panel.querySelector('input')!};
}
function key(target:HTMLElement,value:string,shiftKey=false){const event=new target.ownerDocument.defaultView!.KeyboardEvent('keydown',{key:value,shiftKey,bubbles:true,cancelable:true});target.dispatchEvent(event);return event;}
function register(parts:ReturnType<typeof fixture>,onDismiss:()=>void=()=>{},options={}){
  const release=createOwnedDialogBehavior({...parts,getTrigger:()=>parts.trigger,onDismiss,...options});releases.push(release);return release;
}
describe('shared owned-dialog behavior',()=>{
  it('keeps independent open applications active without a document-global stack',()=>{
    const a=fixture(),b=fixture(),closeA=vi.fn(),closeB=vi.fn();
    a.trigger.focus();register(a,closeA);b.trigger.focus();register(b,closeB);
    a.last.focus();expect(document.activeElement).toBe(a.last);
    expect(key(a.last,'Escape').defaultPrevented).toBe(true);expect(closeA).toHaveBeenCalledOnce();expect(closeB).not.toHaveBeenCalled();
    b.last.focus();expect(document.activeElement).toBe(b.last);
    key(b.last,'Escape');expect(closeB).toHaveBeenCalledOnce();
  });
  it('handles only the top nested layer and restores the previous owned layer',()=>{
    const outer=fixture(),closeOuter=vi.fn();outer.trigger.focus();register(outer,closeOuter,{lockScroll:true});
    const innerTrigger=document.createElement('button');innerTrigger.textContent='Inner';outer.panel.append(innerTrigger);
    const panel=document.createElement('div');panel.tabIndex=-1;panel.innerHTML='<button>Nested action</button>';outer.panel.append(panel);
    innerTrigger.focus();const closeInner=vi.fn();let releaseInner=()=>{};
    releaseInner=register({...outer,panel,trigger:innerTrigger},()=>{closeInner();releaseInner();},{lockScroll:true});
    key(panel,'Escape');expect(closeInner).toHaveBeenCalledOnce();expect(closeOuter).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(innerTrigger);expect(outer.owner.style.overflow).toBe('hidden');
    key(innerTrigger,'Escape');expect(closeOuter).toHaveBeenCalledOnce();
  });
  it('does not claim nested application focus during open, events or return focus',()=>{
    const outer=fixture(),nested=document.createElement('section');nested.setAttribute('data-ui-application-viewport','');
    const input=document.createElement('input');nested.append(input);outer.panel.append(nested);input.focus();
    const close=vi.fn(),release=register(outer,close);
    expect(document.activeElement).toBe(input);expect(key(input,'Escape').defaultPrevented).toBe(false);expect(close).not.toHaveBeenCalled();
    release();expect(document.activeElement).toBe(input);
    // A previous nested-app target is also ineligible for return focus after deliberate owner interaction.
    input.focus();const releaseAgain=register(outer);outer.last.focus();releaseAgain();expect(document.activeElement).toBe(outer.trigger);
  });
  it('never admits explicit or matching-ID popup branches across a nested application boundary',()=>{
    const outer=fixture(),nested=document.createElement('section');nested.setAttribute('data-ui-application-viewport','');
    const popup=document.createElement('div');popup.id='nested-popup';popup.setAttribute('role','listbox');popup.dataset.uiOwner='same-doc';popup.dataset.uiOcc='same-occ';popup.dataset.uiPart='content';nested.append(popup);outer.owner.append(nested);
    outer.first.dataset.uiOwner='same-doc';outer.first.dataset.uiOcc='same-occ';outer.first.setAttribute('aria-controls',popup.id);
    expect(ownedDialogBranches(outer.owner,outer.panel,[popup])).toEqual([]);
  });
  it('admits only a live exact control/owned-popup pair and defers its Escape',()=>{
    const outer=fixture(),popup=document.createElement('div');popup.id='approved-popup';popup.setAttribute('role','listbox');popup.dataset.uiOwner='doc-a';popup.dataset.uiOcc='select-a';popup.dataset.uiPart='content';popup.innerHTML='<button>Choice</button>';outer.owner.append(popup);
    outer.first.dataset.uiOwner='doc-a';outer.first.dataset.uiOcc='select-a';outer.first.setAttribute('aria-controls',popup.id);
    const unrelated=popup.cloneNode(true) as HTMLElement;unrelated.id='unrelated-popup';unrelated.dataset.uiOcc='different-select';outer.owner.append(unrelated);
    expect(ownedDialogBranches(outer.owner,outer.panel)).toEqual([popup]);
    outer.first.removeAttribute('aria-controls');outer.first.setAttribute('aria-expanded','true');outer.first.setAttribute('aria-haspopup','listbox');
    expect(ownedDialogBranches(outer.owner,outer.panel)).toEqual([popup]);
    const ambiguous=popup.cloneNode(true) as HTMLElement;ambiguous.id='ambiguous-popup';outer.owner.append(ambiguous);
    expect(ownedDialogBranches(outer.owner,outer.panel)).toEqual([]);ambiguous.remove();
    outer.first.setAttribute('aria-expanded','false');expect(ownedDialogBranches(outer.owner,outer.panel)).toEqual([]);outer.first.setAttribute('aria-expanded','true');
    outer.trigger.focus();const close=vi.fn();register(outer,close);const choice=popup.querySelector('button')!;choice.focus();expect(document.activeElement).toBe(choice);
    expect(key(choice,'Escape').defaultPrevented).toBe(false);expect(close).not.toHaveBeenCalled();
    popup.remove();outer.last.focus();key(outer.last,'Escape');expect(close).toHaveBeenCalledOnce();
  });
  it('uses the application frame realm and leaves parent-document focus and styles untouched',()=>{
    const frame=document.createElement('iframe'),external=document.createElement('input');document.body.append(frame,external);
    const doc=frame.contentDocument!,parts=fixture(doc),close=vi.fn();doc.body.style.userSelect='all';
    // Happy DOM omits native frameElement focus-chain bookkeeping; model the
    // browser's standard embedding relation explicitly, without changing production guards.
    Object.defineProperty(doc.defaultView!,'frameElement',{configurable:true,value:frame});
    frame.focus();parts.trigger.focus();
    const release=register(parts,close,{lockScroll:true});expect(doc.activeElement).toBe(parts.panel);
    parts.last.focus();key(parts.last,'Tab');expect(doc.activeElement).toBe(parts.first);
    external.focus();expect(document.activeElement).toBe(external);expect(key(external,'Escape').defaultPrevented).toBe(false);expect(close).not.toHaveBeenCalled();
    const returnFocus=vi.spyOn(parts.trigger,'focus');
    // Child activeElement may remain stale when focus moves to parent chrome.
    vi.spyOn(doc,'activeElement','get').mockReturnValue(parts.last);
    release();expect(returnFocus).not.toHaveBeenCalled();expect(document.activeElement).toBe(external);expect(doc.body.style.userSelect).toBe('all');expect(parts.owner.style.overflow).toBe('auto');
  });
  it('does not autofocus an inactive frame or an embedding chain it cannot verify',()=>{
    const frame=document.createElement('iframe'),external=document.createElement('button');document.body.append(frame,external);
    const parts=fixture(frame.contentDocument!);Object.defineProperty(parts.panel.ownerDocument.defaultView!,'frameElement',{configurable:true,value:frame});
    external.focus();const focus=vi.spyOn(parts.panel,'focus');register(parts);expect(focus).not.toHaveBeenCalled();
  });
  it('rejects a foreign-document owner before registering any behavior',()=>{
    const frame=document.createElement('iframe');document.body.append(frame);const a=fixture(),b=fixture(frame.contentDocument!);
    expect(()=>createOwnedDialogBehavior({owner:a.owner,panel:b.panel,onDismiss:()=>{}})).toThrow('actual owner and document');
    const nested=fixture();a.owner.append(nested.owner);
    expect(()=>createOwnedDialogBehavior({owner:a.owner,panel:nested.panel,onDismiss:()=>{}})).toThrow('actual owner and document');
  });
  it('loops native tab order without hidden, negative-tabindex or nested-application controls',()=>{
    const outer=fixture();outer.panel.innerHTML='<button tabindex="2">Second</button><button tabindex="1">First</button><input type="hidden"/><button tabindex="-1">Not in Tab order</button><details><summary>Details</summary><input aria-label="Closed detail"/></details><section data-ui-application-viewport><button>Nested app</button></section><input aria-label="Last"/>';
    outer.trigger.focus();register(outer);
    const last=outer.panel.querySelector<HTMLInputElement>('[aria-label="Last"]')!,first=outer.panel.querySelector<HTMLButtonElement>('[tabindex="1"]')!;
    last.focus();key(last,'Tab');expect(document.activeElement).toBe(first);
    key(first,'Tab',true);expect(document.activeElement).toBe(last);
  });
});
