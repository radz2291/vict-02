// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
vi.mock('$app/navigation',()=>({beforeNavigate:()=>{}}));
import Designer from '../../src/lib/designer/Designer.svelte';
import {screenStore} from '../../src/lib/designer/storage.js';
import {newScreen} from '../../src/lib/designer/application.js';
import {projectStructure,connectedSelectionStructure,structureId} from '../../src/lib/designer/structure.js';
import {studioDisplayName,studioStyleName,studioStateLabels} from '../../src/lib/designer/presentation.js';
import {compatiblePreviewValues} from '../../src/lib/designer/preview-state.js';
import {exclusiveWorkspacePanels} from '../../src/lib/designer/workspace-panels.js';
import {workspaceControl,openStudioMenu} from './studio-menu.js';
import type {UiDocument} from '@victframework/ui';
let app:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(app)await unmount(app);app=undefined;document.body.innerHTML='';localStorage.clear();});
async function settle(){flushSync();await tick();await tick();}
function control(name:string){const b=workspaceControl(name)??[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===name||b.getAttribute('aria-label')===name);expect(b,name).toBeDefined();return b!;}
function fixture():UiDocument{return {...newScreen('Consistency','consistency'),revision:'r1.r1',nodes:{screen:{id:'screen',kind:'element',tag:'main',children:['section']},section:{id:'section',kind:'element',tag:'section',children:['field','other']},field:{id:'field',kind:'element',tag:'input',attributes:{'aria-label':'Name',value:{type:'ref',path:'state.message'}},children:[],interactions:[{on:'change',action:'setState',key:'message',value:{type:'ref',path:'state.message'}}]},other:{id:'other',kind:'element',tag:'input',attributes:{'aria-label':'Other',value:{type:'ref',path:'state.message'}},children:[]}}};}
async function start(){const source=fixture();expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);app=mount(Designer,{target:document.body});await settle();return source;}
it('focuses every selected node and edge endpoint without replacing the mixed selection or selecting context',async()=>{
 const source=await start();control('Document').click();await settle();document.querySelector<HTMLButtonElement>('[data-context=document]')!.click();await settle();
 document.querySelector<HTMLElement>('[data-key="consistency|section"]')!.click();await settle();document.querySelector<HTMLElement>('[data-key="consistency|field"]')!.dispatchEvent(new MouseEvent('click',{ctrlKey:true,bubbles:true}));await settle();
 control('Selection').click();await settle();control('Relationships').click();await settle();
 document.querySelector<HTMLButtonElement>('[aria-label="Inspect Value connection from State · Message to Input · Name"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true}));await settle();
 control('Structure').click();await settle();const before=document.querySelector('.workspace-selection-details header')!.textContent;expect(before).toContain('2 nodes');expect(before).toContain('1 connection');
 control('Focus on selection').click();await settle();await settle();expect(document.querySelector('.workspace-selection-details header')!.textContent).toBe(before);
 expect(document.querySelectorAll('.svelte-flow__node.selected')).toHaveLength(2);expect(document.querySelectorAll('.port-control[aria-pressed=true],.port-control[aria-pressed=mixed]')).toHaveLength(2);
 const state=structureId(source.id,'state','message');expect(document.querySelector(`[data-id="${state}"]`)).not.toBeNull();expect(document.querySelector(`[data-id="${state}"].selected`)).toBeNull();expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('preserves temporary input values through Design/Interact/Structure and resets only when asked',async()=>{
 await start();control('Interact').click();await settle();const input=document.querySelector<HTMLInputElement>('.design-frame input')!;input.value='Keep this trial';input.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 control('Design').click();await settle();control('Structure').click();await settle();control('Interact').click();await settle();expect(document.querySelector<HTMLInputElement>('.design-frame input')!.value).toBe('Keep this trial');
 await openStudioMenu('Preview');control('Reset test').click();await settle();expect(document.querySelector<HTMLInputElement>('.design-frame input')!.value).not.toBe('Keep this trial');
});
it('retains all focus roots beyond the neighbour bound while preserving exact edges',()=>{
 const source=fixture(),graph=projectStructure(source),roots=[structureId(source.id,'node','field'),structureId(source.id,'state','message')];const focused=connectedSelectionStructure(graph,roots,{limit:1});expect(focused.nodes.map(n=>n.id).sort()).toEqual([...roots].sort());expect(focused.edges.map(e=>e.id)).toEqual(graph.edges.filter(e=>roots.includes(e.source)&&roots.includes(e.target)).map(e=>e.id));
});
it('uses the same names for host state/actions and derives generated styles from source ownership',()=>{
 const base=fixture(),style='src.opaque.name',source={...base,styleSources:{[style]:{id:style,pseudo:'focus' as const,declarations:[{property:'color',value:{type:'text' as const,value:'red'}}]}},nodes:{...base.nodes,field:{...base.nodes.field!,styleSources:[style]}}};
 expect(studioDisplayName('state','busy')).toBe(studioStateLabels.busy);expect(studioDisplayName('action','demo.submit')).toBe('Submit');expect(studioDisplayName('state','customValue')).toBe('Custom Value');expect(studioStyleName(source,style)).toBe('Name · Focus style');
 const graph=projectStructure(source);expect(graph.nodes.find(n=>n.data.kind==='style')?.data.label).toBe('Name · Focus style');
});
it('uses remaining canvas space to choose exclusive panels at desktop widths',()=>{
 expect(exclusiveWorkspacePanels(1010,280,315)).toBe(true);expect(exclusiveWorkspacePanels(1300,280,315)).toBe(false);expect(exclusiveWorkspacePanels(1400,400,460)).toBe(true);expect(exclusiveWorkspacePanels(800,240,280)).toBe(true);expect(exclusiveWorkspacePanels(0,280,315)).toBe(false);
});
it('shows shared identity icons in multiple Overview and keeps technical version information out of the footer',async()=>{
 await start();const inputs=[...document.querySelectorAll('.design-frame input')];inputs[0]!.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));await settle();inputs[1]!.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,ctrlKey:true}));await settle();control('Document').click();await settle();control('Selection').click();await settle();
 expect(document.querySelectorAll('.inspect-item .source-identity [data-source-icon]')).toHaveLength(2);expect(document.querySelector('.workspace-status')!.textContent).not.toContain('@3');
});

it('invalidates incompatible or removed temporary values without coercion or changing authored starting values',()=>{
 const source=fixture(),before=JSON.stringify(source),result=compatiblePreviewValues(source,{message:'Retain me',busy:'Wrong type',removedKey:true});
 expect(result.values).toEqual({message:'Retain me'});expect(result.removed).toEqual(['busy','removedKey']);expect(JSON.stringify(source)).toBe(before);
});

it('retains compatible test values when an authored revision fences the previous simulation',async()=>{
 await start();control('Interact').click();await settle();const input=document.querySelector<HTMLInputElement>('.design-frame input')!;input.value='Keep across edit';input.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 control('Design').click();await settle();control('Document').click();await settle();control('Source').click();await settle();
 const editor=document.querySelector<HTMLTextAreaElement>('#canonical-source')!,next=JSON.parse(editor.value);next.nodes.screen.attributes={'aria-label':'Updated screen'};editor.value=JSON.stringify(next);editor.dispatchEvent(new Event('input',{bubbles:true}));await settle();control('Apply source').click();await settle();
 expect(document.querySelector('.design-frame main')!.getAttribute('aria-label')).toBe('Updated screen');expect(screenStore(localStorage,'consistency').rawLoad()).toMatchObject({document:fixture()});control('Interact').click();await settle();expect(document.querySelector<HTMLInputElement>('.design-frame input')!.value).toBe('Keep across edit');
});
