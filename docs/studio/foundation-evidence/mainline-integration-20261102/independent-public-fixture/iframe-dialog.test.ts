import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
import {canonicalUiDocument,type UiDocument,type UiValue} from '@victframework/ui';
import Fixture from './Fixture.svelte';

let mounted:ReturnType<typeof mount>|undefined;
const restoreLinks:(()=>void)[]=[];
afterEach(async()=>{if(mounted)await unmount(mounted);mounted=undefined;for(const restore of restoreLinks.splice(0).reverse())restore();await new Promise(resolve=>setTimeout(resolve,50));document.body.replaceChildren();});
async function settle(){flushSync();await tick();await tick();}
function source(both=false):UiDocument{return {schema:'vict.ui-document@1',id:'independent-public-iframe',revision:'1',root:'root',nodes:{
 root:{kind:'element',id:'root',tag:'main',children:['alpha','beta']},
 alpha:{kind:'component',id:'alpha',definitionId:'vict.catalog.dialog',revision:'1',props:{title:{type:'literal',value:'Alpha'},open:{type:'ref',path:'state.alpha'}},outputs:{openChange:{setState:{key:'alpha'}}},slots:{body:{name:'body',children:['alpha-text']}}},
 beta:{kind:'component',id:'beta',definitionId:'vict.catalog.dialog',revision:'1',props:{title:{type:'literal',value:'Beta'},open:{type:'ref',path:'state.beta'}},outputs:{openChange:{setState:{key:'beta'}}},slots:{body:{name:'body',children:['beta-text']}}},
 'alpha-text':{kind:'text',id:'alpha-text',content:{type:'literal',value:'Canonical Alpha body'}},
 'beta-text':{kind:'text',id:'beta-text',content:{type:'literal',value:'Canonical Beta body'}},
 },componentDefinitions:{},localState:{alpha:{key:'alpha',type:'boolean',initial:true},beta:{key:'beta',type:'boolean',initial:both}},styleSources:{},tokens:{},conditions:{},assets:{}};}
function modelFrameLink(frame:HTMLIFrameElement){const view=frame.contentWindow!;if(view.frameElement===frame)return;const old=Object.getOwnPropertyDescriptor(view,'frameElement');Object.defineProperty(view,'frameElement',{configurable:true,get:()=>frame});restoreLinks.push(()=>{if(old)Object.defineProperty(view,'frameElement',old);else Reflect.deleteProperty(view,'frameElement');});}
async function start(both=false){const doc=source(both),before=canonicalUiDocument(doc).contentDigest,changes:[string,UiValue][]=[];mounted=mount(Fixture,{target:document.body,props:{source:doc,onStateChange:(key,value)=>changes.push([key,value])}});await settle();const frames=[...document.querySelectorAll<HTMLIFrameElement>('iframe')];expect(frames).toHaveLength(2);for(const frame of frames)modelFrameLink(frame);const frame=frames[0]!,app=frame.contentDocument!,sibling=frames[1]!.contentDocument!;await vi.waitFor(()=>expect(app.querySelectorAll('[data-testid="dialog-panel"]')).toHaveLength(both?2:1));return {doc,before,changes,frame,app,sibling,host:document.querySelector<HTMLElement>('[data-frame-host]')!,viewport:app.querySelector<HTMLElement>('[data-ui-application-viewport]')!};}
const panel=(app:Document,title:string)=>[...app.querySelectorAll<HTMLElement>('[data-testid="dialog-panel"]')].find(item=>item.textContent?.includes(title))!;
function unchanged(f:Awaited<ReturnType<typeof start>>){expect(canonicalUiDocument(f.doc).contentDigest).toBe(f.before);}

it('ends portal lifetime for hidden, inert and detached embedding ancestors, restoring the declared modal without source mutation',async()=>{
 const f=await start();
 for(const kind of ['hidden','inert','removed']){
  if(kind==='hidden')f.host.hidden=true;else if(kind==='inert')f.host.inert=true;else f.host.remove();await settle();
  await vi.waitFor(()=>expect(f.app.querySelector('[data-testid="dialog-panel"]'),kind).toBeNull());
  expect(f.viewport.style.overflow,kind).not.toBe('hidden');expect(document.body.style.pointerEvents,kind).not.toBe('none');
  if(kind==='hidden')f.host.hidden=false;else if(kind==='inert')f.host.inert=false;else document.body.append(f.host);await settle();modelFrameLink(f.frame);
  // Reattaching an iframe may create a new browser Document. Canonical source,
  // rather than an obsolete browsing-context identity, owns this declaration.
  await vi.waitFor(()=>expect(f.frame.contentDocument?.querySelector('[data-testid="dialog-panel"]'),kind).not.toBeNull());unchanged(f);
 }
});

it('locks the actual application viewport while parent and sibling controls remain usable',async()=>{
 const f=await start();expect(f.viewport.style.overflow).toBe('hidden');for(const doc of [document,f.app,f.sibling])expect(doc.body.style.pointerEvents).not.toBe('none');
 expect(f.app.querySelector('[data-testid="dialog-overlay"]')).not.toBeNull();expect(document.querySelector('[data-testid="dialog-panel"]')).toBeNull();
 const parent=document.querySelector<HTMLButtonElement>('[data-parent-control]')!;parent.focus();parent.click();await settle();expect(document.activeElement).toBe(parent);expect(parent.textContent).toBe('Parent action 1');
 const sibling=f.sibling.querySelector<HTMLInputElement>('input')!;sibling.focus();sibling.value='Sibling remains interactive';sibling.dispatchEvent(new Event('input',{bubbles:true}));expect(f.sibling.activeElement).toBe(sibling);expect(sibling.value).toBe('Sibling remains interactive');
 expect(f.app.querySelector('[data-testid="dialog-panel"]')).not.toBeNull();unchanged(f);
});

it('retains a refcounted local lock until both authored modals close, without changing canonical initial data',async()=>{
 const f=await start(true);expect(f.viewport.style.overflow).toBe('hidden');panel(f.app,'Beta').querySelector<HTMLButtonElement>('[data-testid="dialog-close"]')!.click();await settle();
 await vi.waitFor(()=>expect(f.app.querySelectorAll('[data-testid="dialog-panel"]')).toHaveLength(1));expect(f.viewport.style.overflow).toBe('hidden');expect(f.changes).toContainEqual(['beta',false]);
 panel(f.app,'Alpha').querySelector<HTMLButtonElement>('[data-testid="dialog-close"]')!.click();await settle();await vi.waitFor(()=>expect(f.app.querySelector('[data-testid="dialog-panel"]')).toBeNull());
 expect(f.viewport.style.overflow).not.toBe('hidden');expect(f.changes).toContainEqual(['alpha',false]);expect(document.body.style.pointerEvents).not.toBe('none');unchanged(f);
});

it('retains Bits focus looping, Escape, reopen and controlled close within the application document',async()=>{
 const f=await start(),close=panel(f.app,'Alpha').querySelector<HTMLButtonElement>('[data-testid="dialog-close"]')!;
 await vi.waitFor(()=>expect(panel(f.app,'Alpha').contains(f.app.activeElement)).toBe(true));close.focus();
 for(const shiftKey of [false,true]){const event=new KeyboardEvent('keydown',{key:'Tab',shiftKey,bubbles:true,cancelable:true});close.dispatchEvent(event);await settle();expect(event.defaultPrevented).toBe(true);expect(f.app.activeElement).toBe(close);}
 close.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(f.app.querySelector('[data-testid="dialog-panel"]')).toBeNull());expect(f.viewport.style.overflow).not.toBe('hidden');expect(f.changes).toContainEqual(['alpha',false]);
 const trigger=[...f.app.querySelectorAll<HTMLButtonElement>('[data-testid="dialog-trigger"]')].find(button=>button.textContent?.includes('Alpha'))!;trigger.click();await vi.waitFor(()=>expect(f.app.querySelector('[data-testid="dialog-panel"]')).not.toBeNull());expect(f.changes).toContainEqual(['alpha',true]);expect(f.viewport.style.overflow).toBe('hidden');
 panel(f.app,'Alpha').querySelector<HTMLButtonElement>('[data-testid="dialog-close"]')!.click();await vi.waitFor(()=>expect(f.app.querySelector('[data-testid="dialog-panel"]')).toBeNull());expect(f.viewport.style.overflow).not.toBe('hidden');unchanged(f);
});
