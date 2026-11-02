// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
vi.mock('$app/navigation',()=>({beforeNavigate:()=>{}}));
import Designer from '../../src/lib/designer/Designer.svelte';
import {DocumentHost} from '@victframework/ui-svelte';
import CatalogDialog from '../../../../packages/ui-svelte/src/catalog/components/CatalogDialog.svelte';
import {newScreen,compileScreen,catalogDescriptors,catalogImplementations} from '../../src/lib/designer/application.js';
import {documentCursor,prepareAgentEdit} from '../../src/lib/designer/agent-edits.js';
import {screenStore} from '../../src/lib/designer/storage.js';
import {workspaceControl} from './studio-menu.js';
let mounted:ReturnType<typeof mount>|undefined;
let restoreFrameLink:(()=>void)|undefined;
afterEach(async()=>{if(mounted)await unmount(mounted);mounted=undefined;restoreFrameLink?.();restoreFrameLink=undefined;vi.restoreAllMocks();document.body.innerHTML='';document.body.style.pointerEvents='';localStorage.clear();});
async function settle(){flushSync();await tick();await tick();}
async function click(name:string){const node=workspaceControl(name);expect(node,name).toBeDefined();node!.click();await settle();}
function fixture(){const seed=newScreen('Owned dialog','owned-dialog');const prepared=prepareAgentEdit(seed,documentCursor(seed,'r1','portal-fixture'),{expectedRevision:'r1',reason:'Add owned dialog',operations:[{op:'add',recipe:'dialog',nodeId:'dialog',parentId:seed.root,props:{title:'Owned modal'}}]},seed.id);expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error(prepared.message);return prepared.document;}
it('does not let a source edit open a modal over Structure, releases locks and restores its open state in Interact',async()=>{
 const source={...fixture(),revision:'r1.r1'};const dialog=source.nodes.dialog!;if(dialog.kind!=='component'||dialog.props?.open?.type!=='ref')throw Error('Expected bound dialog');const key=dialog.props.open.path.slice(6);
 expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);mounted=mount(Designer,{target:document.body});await settle();
 const frame=document.querySelector<HTMLIFrameElement>('iframe[data-application-viewport="isolated"]')!;
 await vi.waitFor(()=>expect(frame.contentDocument?.querySelector('[data-ui-owner-root]')).not.toBeNull());const app=frame.contentDocument!;
 // Happy DOM omits the browser's same-origin frameElement relationship.
 // Model only that platform link; visibility, modal DOM and locks stay real.
 const view=app.defaultView!,oldFrame=Object.getOwnPropertyDescriptor(view,'frameElement');Object.defineProperty(view,'frameElement',{configurable:true,get:()=>frame});restoreFrameLink=()=>{if(oldFrame)Object.defineProperty(view,'frameElement',oldFrame);else Reflect.deleteProperty(view,'frameElement');};
 await click('Interact');await click('Structure');await click('Document');await click('Source');
 const draft=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;const next=JSON.parse(draft.value);next.localState[key].initial=true;draft.value=JSON.stringify(next);draft.dispatchEvent(new Event('input',{bubbles:true}));await settle();await click('Apply source');
 try{await vi.waitFor(()=>{for(const doc of [document,app]){expect(doc.querySelector('[data-testid="dialog-panel"]'),doc===document?'Studio modal while Structure':'Application modal while Structure').toBeNull();expect(doc.body.style.pointerEvents,doc===document?'Studio lock while Structure':'Application lock while Structure').not.toBe('none');}});}catch(error){console.log(JSON.stringify({portalOwnershipFailure:{frameHidden:!!frame.closest('[hidden],[inert]'),documents:[document,app].map(doc=>({owner:doc===document?'Studio':'Application',pointerEvents:doc.body.style.pointerEvents,modals:[...doc.querySelectorAll('[role="dialog"],[role="menu"],[data-testid="dialog-panel"]')].map(node=>({role:node.getAttribute('role'),testId:node.getAttribute('data-testid'),text:node.textContent?.slice(0,120)}))}))}}));throw error;}
 expect(workspaceControl('Structure')!.getAttribute('aria-pressed')).toBe('true');const canonical=document.querySelector<HTMLTextAreaElement>('#canonical-source')!.value;expect(JSON.parse(canonical).localState[key].initial,document.querySelector('.design-status')?.textContent??'status').toBe(true);
 await click('Interact');await vi.waitFor(()=>expect(app.querySelector('[data-testid="dialog-panel"]')).not.toBeNull());expect(document.querySelector('[data-testid="dialog-panel"]')).toBeNull();expect(document.body.style.pointerEvents,'Studio remains usable while application modal is open').not.toBe('none');expect(app.body.style.pointerEvents).not.toBe('none');const viewport=app.querySelector<HTMLElement>('[data-ui-application-viewport]')!;expect(viewport.style.overflow,'Application viewport owns its lock').toBe('hidden');
 const panel=app.querySelector<HTMLElement>('[data-testid="dialog-panel"]')!,close=app.querySelector<HTMLButtonElement>('[data-testid="dialog-close"]')!;
 await vi.waitFor(()=>expect(panel.contains(app.activeElement)).toBe(true));close.focus();
 for(const shiftKey of [false,true]){const tab=new KeyboardEvent('keydown',{key:'Tab',shiftKey,bubbles:true,cancelable:true});close.dispatchEvent(tab);await settle();expect(tab.defaultPrevented).toBe(true);expect(app.activeElement).toBe(close);}
 close.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(app.querySelector('[data-testid="dialog-panel"]')).toBeNull());expect(viewport.style.overflow).not.toBe('hidden');
 app.querySelector<HTMLButtonElement>('[data-testid="dialog-trigger"]')!.click();await vi.waitFor(()=>expect(app.querySelector('[data-testid="dialog-panel"]')).not.toBeNull());expect(viewport.style.overflow).toBe('hidden');
 app.querySelector<HTMLButtonElement>('[data-testid="dialog-close"]')!.click();await settle();await click('Structure');await click('Interact');
 for(const doc of [document,app]){expect(doc.querySelector('[data-testid="dialog-panel"]')).toBeNull();expect(doc.body.style.pointerEvents).not.toBe('none');}expect(viewport.style.overflow).not.toBe('hidden');expect(document.querySelector<HTMLTextAreaElement>('#canonical-source')!.value).toBe(canonical);
 expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('follows its exact connected owner through hidden, inert, style and removal without changing the declared open state',async()=>{
 const seed=fixture(),dialog=seed.nodes.dialog!;if(dialog.kind!=='component'||dialog.props?.open?.type!=='ref')throw Error('Expected bound dialog');const key=dialog.props.open.path.slice(6),source={...seed,localState:{...seed.localState,[key]:{...seed.localState[key]!,initial:true}}};
 const compiled=compileScreen(source);if(!compiled.ok)throw Error('compile');const host=document.createElement('div');host.hidden=true;document.body.append(host);
 mounted=mount(DocumentHost,{target:host,props:{plan:Object.values(compiled.plan.documentPlans??{})[0]!,localState:source.localState,extensionDescriptors:catalogDescriptors,extensionImplementations:catalogImplementations,dispatch:async()=>({ok:true}),navigate:()=>{}}});await settle();
 expect(document.querySelector('[data-testid="dialog-panel"]')).toBeNull();host.hidden=false;await vi.waitFor(()=>expect(document.querySelector('[data-testid="dialog-panel"]')).not.toBeNull());
 host.inert=true;await vi.waitFor(()=>{expect(document.querySelector('[data-testid="dialog-panel"]')).toBeNull();expect(document.body.style.pointerEvents).not.toBe('none');});host.inert=false;await vi.waitFor(()=>expect(document.querySelector('[data-testid="dialog-panel"]')).not.toBeNull());
 host.style.display='none';await vi.waitFor(()=>expect(document.querySelector('[data-testid="dialog-panel"]')).toBeNull());host.style.display='';await vi.waitFor(()=>expect(document.querySelector('[data-testid="dialog-panel"]')).not.toBeNull());
 host.remove();await vi.waitFor(()=>expect(document.querySelector('[data-testid="dialog-panel"]')).toBeNull());document.body.append(host);await vi.waitFor(()=>expect(document.querySelector('[data-testid="dialog-panel"]')).not.toBeNull());
});
it('preserves standalone dialog behavior when no DocumentHost owner is declared',async()=>{
 mounted=mount(CatalogDialog,{target:document.body,props:{props:{open:true,title:'Standalone modal'}}});await vi.waitFor(()=>expect(document.querySelector('[data-testid="dialog-panel"]')).not.toBeNull());expect(document.body.style.pointerEvents).toBe('none');
});
