// @vitest-environment happy-dom
// Regression coverage for the owner-approved consistency repairs.
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
vi.mock('$app/navigation',()=>({beforeNavigate:()=>{}}));
import Designer from '../../src/lib/designer/Designer.svelte';
import Details from '../../src/lib/designer/WorkspaceSelectionDetails.svelte';
import {newScreen,compileScreen} from '../../src/lib/designer/application.js';
import {screenStore} from '../../src/lib/designer/storage.js';
import {projectStructure,structureId} from '../../src/lib/designer/structure.js';
import {selectionIdentity} from '../../src/lib/designer/selection-presentation.js';
import {nodeItem,changeSelection,pruneSelection} from '../../src/lib/designer/workspace-selection.js';
import {clarityFixture} from '../fixtures/structure-clarity.js';
import {definitionsFixture,bindingFixture,repeatFixture,outputFixture,styleFixture,outputDescriptor} from '../fixtures/structure-semantics.js';
import {workspaceControl} from './studio-menu.js';
import type {UiDocument} from '@victframework/ui';
let app:ReturnType<typeof mount>|undefined;
async function settle(){flushSync();await tick();await tick();}
async function clear(){if(app)await unmount(app);app=undefined;document.body.innerHTML='';localStorage.clear();}
afterEach(clear);
function props(source:UiDocument,items:any[],page:'properties'|'relationships'|'technical'='properties',context={}){return {document:source,selection:{documentId:source.id,items},page,context,onClose:vi.fn(),onSelect:vi.fn(),onNavigate:vi.fn(),onInspect:vi.fn(),onRemove:vi.fn()};}
async function panel(source:UiDocument,items:any[],page:'properties'|'relationships'|'technical'='properties',context={}){await clear();app=mount(Details,{target:document.body,props:props(source,items,page,context)});await settle();}
async function start(source:UiDocument){const compiled=compileScreen(source);expect(compiled.ok,JSON.stringify(compiled)).toBe(true);expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);app=mount(Designer,{target:document.body});await settle();}
function control(name:string){const button=workspaceControl(name);expect(button,name).toBeDefined();return button!;}
async function layers(){control('Document').click();await settle();document.querySelector<HTMLElement>('[data-context=document]')?.click();await settle();}
async function pointer(node:Element,ctrl=false){node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,ctrlKey:ctrl}));await settle();}
it('all projected single entity categories and connection roles retain inspection structure without changing source',async()=>{
 const extra=bindingFixture();const complete:UiDocument={...extra,assets:{logo:{id:'logo',kind:'external',href:'https://example.invalid/logo.svg'}},nodes:{...extra.nodes,field:{...extra.nodes.field,attributes:{value:{type:'ref',path:'view.message'},title:{type:'ref',path:'record.name'},placeholder:{type:'ref',path:'opaque.value'}},interactions:[{on:'click',action:'invokeAction',actionId:'demo.submit',input:{message:{type:'ref',path:'state.message'}}},{on:'change',action:'navigate',routeId:'screen'}]} as UiDocument['nodes'][string]}};
 const clarity=clarityFixture();const filled:UiDocument={...clarity,nodes:{...clarity.nodes,card:{id:'card',kind:'component',definitionId:'local.card',slots:{content:{name:'content',children:['fill']}}},fill:{id:'fill',kind:'text',content:{type:'literal',value:'Custom slot fill'}}}};
 const fixtures=[filled,definitionsFixture(),bindingFixture(),repeatFixture(),outputFixture(),styleFixture(),complete];
 const kinds=new Map<string,{source:UiDocument;node:any}>(),roles=new Map<string,{source:UiDocument;edge:any}>();
 const context={descriptors:[outputDescriptor],actionIds:['demo.submit'],routeIds:['screen'],actionState:{'demo.submit':{pending:'busy',error:'actionError',result:'actionResult',successValues:{accepted:true}}}};
 for(const source of fixtures){const graph=projectStructure(source,context);for(const node of graph.nodes){const sourceNode=node.data.sourceId?source.nodes[node.data.sourceId]:undefined;const category=sourceNode?`${node.data.kind}/${sourceNode.kind}/${node.data.kindLabel}`:node.data.kind;if(!kinds.has(category))kinds.set(category,{source,node});}for(const edge of graph.edges)if(edge.data?.role&&!roles.has(edge.data.role))roles.set(edge.data.role,{source,edge});}
 const inspected=[];
 for(const [kind,{source,node}]of kinds){const before=JSON.stringify(source);await panel(source,[{kind:'node',id:node.id}], 'properties',context);const header=document.querySelector('.source-details header')?.textContent;expect(header).toBeTruthy();expect(header).not.toContain('No selection');const sections=[...document.querySelectorAll('.selection-sections .studio-section-header')].map(el=>el.getAttribute('aria-label'));expect(sections).toContain('Relationships');expect(sections).toContain('Technical information');expect(sections.length).toBeGreaterThanOrEqual(2);expect(sections.length).toBeLessThanOrEqual(3);expect(JSON.stringify(source)).toBe(before);inspected.push({kind,header,overview:document.querySelector('.useful-facts')?.textContent});}
 for(const [role,{source,edge}]of roles){await panel(source,[{kind:'edge',id:edge.id}], 'properties',context);expect(document.querySelector('.workspace-selection-details .relationship-story .connection-role')?.getAttribute('title')).toContain(edge.data.path);expect(document.querySelectorAll('.workspace-selection-details .selection-heading [data-source-icon]')).toHaveLength(2);expect(document.querySelector('.workspace-selection-details [aria-label="Selection overview"] .relationship-story')).toBeNull();}

});
it('distinguishes same-name scoped properties in a multiple selection list',async()=>{
 const source=definitionsFixture(),graph=projectStructure(source),nodes=graph.nodes.filter(node=>node.data.kind==='prop');expect(nodes).toHaveLength(2);
 await panel(source,nodes.map(node=>({kind:'node',id:node.id})));
 const labels=[...document.querySelectorAll('.inspect-item')].map(node=>node.textContent?.trim());expect(labels[0]).not.toBe(labels[1]);expect(document.querySelector('.selection-items')?.textContent).toContain('Definition a');expect(document.querySelector('.selection-items')?.textContent).toContain('Definition b');

});
it('single and multiple inspection share section structure and relationship navigation',async()=>{
 const source=bindingFixture(),graph=projectStructure(source),node=graph.nodes.find(node=>node.data.sourceId==='field')!,edge=graph.edges.find(edge=>edge.source===node.id||edge.target===node.id)!;
 await panel(source,[{kind:'node',id:node.id}], 'relationships');const single={expandedSections:document.querySelectorAll('.source-details section.expanded').length,navigationButtons:document.querySelectorAll('.details-relationships button').length};
 await panel(source,[{kind:'node',id:node.id},{kind:'edge',id:edge.id}], 'relationships');const multiple={navigationButtons:document.querySelectorAll('.relationship-story button').length,cards:document.querySelectorAll('.relationship-story').length};
 expect(single.navigationButtons).toBeGreaterThan(0);expect(multiple.cards).toBeGreaterThan(0);expect(multiple.navigationButtons).toBeGreaterThan(0);expect(document.querySelector('.selection-sections')).not.toBeNull();
});
it('Layers follows an exact rendered repeat row with the same scope as Design',async()=>{
 const seed=newScreen('Repeat review','repeat-review');const source:UiDocument={...seed,revision:'r1.r1',localState:{...seed.localState,items:{key:'items',type:'stringList',initial:['A','B']}},nodes:{screen:{id:'screen',kind:'element',tag:'main',children:['repeat']},repeat:{id:'repeat',kind:'repeat',itemName:'item',collection:{type:'ref',path:'state.items'},key:{type:'literal',value:'stable'},templateRoot:'field'},field:{id:'field',kind:'element',tag:'input',attributes:{'aria-label':'Row field'},children:[]}}};
 await start(source);const fields=[...document.querySelectorAll('.design-frame input')];expect(fields).toHaveLength(2);await pointer(fields[0]!);const canvasKeys=fields.map(node=>node.getAttribute('data-ui-occ'));await layers();const layerKeys=[...document.querySelectorAll('[role=treeitem]')].map(node=>node.getAttribute('data-key'));expect(document.querySelectorAll('[role=treeitem][aria-selected=true]')).toHaveLength(1);expect(layerKeys).toContain(canvasKeys[0]);expect(layerKeys).toContain(canvasKeys[1]);expect(layerKeys).not.toContain('repeat-review|field');expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('a stale runtime row identity survives source-only pruning',()=>{
 const source=repeatFixture(),graph=projectStructure(source),item=nodeItem(source,`${source.id}|ta|no-longer-rendered-row`)!;expect(item).toBeDefined();const selected=changeSelection({documentId:source.id,items:[]},[item],'replace');expect(pruneSelection(selected,source,graph).items).toEqual([item]);expect(selectionIdentity(source,graph,item,[]).availability).toBe('Not currently rendered');
});
it('multiple node selection is shown in the chat selection cue',async()=>{
 const seed=newScreen('Chat review','chat-review');const source:UiDocument={...seed,revision:'r1.r1',nodes:{screen:{id:'screen',kind:'element',tag:'main',children:['a','b']},a:{id:'a',kind:'element',tag:'input',attributes:{'aria-label':'First'},children:[]},b:{id:'b',kind:'element',tag:'input',attributes:{'aria-label':'Second'},children:[]}}};
 await start(source);const fields=[...document.querySelectorAll('.design-frame input')];await pointer(fields[0]!);await pointer(fields[1]!,true);control('Chat').click();await settle();expect(document.querySelectorAll('.design-frame [data-ui-selected]')).toHaveLength(2);expect(document.querySelector('.agent-panel')?.textContent).toContain('Selected: 2 selected items');
});
it('Shift-arrow starts a range from the focused row without a preceding click',async()=>{
 const seed=newScreen('Keyboard review','keyboard-review');const source:UiDocument={...seed,revision:'r1.r1',nodes:{screen:{id:'screen',kind:'element',tag:'main',children:['a','b']},a:{id:'a',kind:'element',tag:'input',attributes:{'aria-label':'First'},children:[]},b:{id:'b',kind:'element',tag:'input',attributes:{'aria-label':'Second'},children:[]}}};
 await start(source);await layers();const first=document.querySelector<HTMLElement>('[data-key="keyboard-review|a"]')!;first.focus();first.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',shiftKey:true,bubbles:true,cancelable:true}));await settle();
 const selected=[...document.querySelectorAll('[role=treeitem][aria-selected=true]')].map(node=>node.getAttribute('data-key'));expect(selected).toEqual(['keyboard-review|a','keyboard-review|b']);
});
it('uses modifier-aware node and relationship controls in both single and mixed inspection',async()=>{
 const source=bindingFixture(),graph=projectStructure(source),field=nodeItem(source,`${source.id}|field`)!;const intent=vi.fn();
 app=mount(Details,{target:document.body,props:{...props(source,[field],'relationships'),onSelectionIntent:intent}});await settle();
 document.querySelector<HTMLButtonElement>('.endpoint')!.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));await settle();expect(intent.mock.calls.at(-1)).toMatchObject([[{kind:'node'}],'toggle']);
 document.querySelector<HTMLButtonElement>('.connection-role')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true}));await settle();expect(intent.mock.calls.at(-1)).toMatchObject([[{kind:'edge'}],'toggle']);
 expect(document.querySelector('.connection-role')?.getAttribute('title')).toContain(graph.edges[0]!.data?.path);
});
it('exposes partial point selection as mixed and adds only the missing visible reference',async()=>{
 const seed=bindingFixture();const source:UiDocument={...seed,revision:'r1.r1',nodes:{...seed.nodes,field:{id:'field',kind:'element',tag:'input',attributes:{'aria-label':'Name'},children:[],styleSources:['a','b']}},styleSources:{a:{id:'a',declarations:[{property:'color',value:{type:'text',value:'red'}}]},b:{id:'b',declarations:[{property:'color',value:{type:'text',value:'blue'}}]}}};
 await start(source);await pointer(document.querySelector('.design-frame input')!);control('Structure').click();await settle();
 control('Select outgoing Styles connections for A').click();await settle();const point=control('Select incoming Styles connections for Name');expect(point.getAttribute('aria-pressed')).toBe('mixed');expect(point.closest('.connection-row')?.textContent).toContain('1/2');
 point.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));await settle();expect(point.getAttribute('aria-pressed')).toBe('true');expect(document.querySelector('.structure-tools')?.textContent).toContain('2 selected');
 expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
