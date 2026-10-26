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
afterEach(async()=>{if(mounted)await unmount(mounted);mounted=undefined;document.body.innerHTML='';document.body.style.pointerEvents='';localStorage.clear();});
async function settle(){flushSync();await tick();await tick();}
async function click(name:string){const node=workspaceControl(name);expect(node,name).toBeDefined();node!.click();await settle();}
function fixture(){const seed=newScreen('Owned dialog','owned-dialog');const prepared=prepareAgentEdit(seed,documentCursor(seed,'r1','portal-fixture'),{expectedRevision:'r1',reason:'Add owned dialog',operations:[{op:'add',recipe:'dialog',nodeId:'dialog',parentId:seed.root,props:{title:'Owned modal'}}]},seed.id);expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error(prepared.message);return prepared.document;}
it('does not let a source edit open a modal over Structure, releases locks and restores its open state in Interact',async()=>{
 const source={...fixture(),revision:'r1.r1'};const dialog=source.nodes.dialog!;if(dialog.kind!=='component'||dialog.props?.open?.type!=='ref')throw Error('Expected bound dialog');const key=dialog.props.open.path.slice(6);
 expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);mounted=mount(Designer,{target:document.body});await settle();
 await click('Interact');await click('Structure');await click('Document');await click('Source');
 const draft=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;const next=JSON.parse(draft.value);next.localState[key].initial=true;draft.value=JSON.stringify(next);draft.dispatchEvent(new Event('input',{bubbles:true}));await settle();await click('Apply source');
 await vi.waitFor(()=>{expect(document.querySelector('[data-testid="dialog-panel"]')).toBeNull();expect(document.body.style.pointerEvents).not.toBe('none');});
 expect(workspaceControl('Structure')!.getAttribute('aria-pressed')).toBe('true');const canonical=document.querySelector<HTMLTextAreaElement>('#canonical-source')!.value;expect(JSON.parse(canonical).localState[key].initial,document.querySelector('.design-status')?.textContent??'status').toBe(true);
 await click('Interact');await vi.waitFor(()=>expect(document.querySelector('[data-testid="dialog-panel"]')).not.toBeNull());expect(document.body.style.pointerEvents).toBe('none');
 document.querySelector<HTMLButtonElement>('[data-testid="dialog-close"]')!.click();await settle();await click('Structure');await click('Interact');
 expect(document.querySelector('[data-testid="dialog-panel"]')).toBeNull();expect(document.querySelector<HTMLTextAreaElement>('#canonical-source')!.value).toBe(canonical);
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
