import {test,expect} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {compileUiDocument,defaultSemanticElementCatalog} from '@victframework/ui';
import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
import {catalogDescriptors,catalogImplementations} from '../../ui-svelte/src/catalog/components/catalog.js';
import {flowAuthoringDescriptors} from '../src/authoring/descriptors.js';
import {flowAuthoringImplementations} from '../src/authoring/implementations.js';
import {compositionGraph} from './composition-fixtures.js';
import {nestedCompositionDocument} from './composition-nested-fixture.js';
const settle=async()=>{flushSync();await new Promise(r=>setTimeout(r,60));flushSync();};
async function open(mode: "workspace" | "editor" | "canvas" = "workspace", authoredGuards = true){
 const source=nestedCompositionDocument();
 const card=source.nodes['outer-card'];if(card.kind!=='element')throw Error('fixture');card.classes=authoredGuards?['nodrag','nopan','nowheel']:[];
 if(mode==='editor'){
  const outerGraph=JSON.parse(String(source.localState.graph.initial));outerGraph.nodeTypes[0].parameters.innerGraph.default=JSON.stringify(compositionGraph('research'));source.localState.graph.initial=JSON.stringify(outerGraph);
  source.nodes['inner-workspace']={kind:'component',id:'inner-workspace',definitionId:'vict.flow.editor',revision:'2',props:{graph:{type:'ref',path:'state.innerGraph'}},outputs:{graphChange:{setState:{key:'innerGraph'}}}};
 }else if(mode==='canvas')source.nodes['inner-workspace']={kind:'component',id:'inner-workspace',definitionId:'vict.flow.canvas',revision:'1',props:{controls:{type:'literal',value:false}}};
 const graph=JSON.parse(String(source.localState.graph.initial));graph.nodes.push({...graph.nodes[0],id:'outer-two',position:{x:900,y:60}});source.localState.graph.initial=JSON.stringify(graph);
 const descriptors=[...catalogDescriptors,...flowAuthoringDescriptors];const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),descriptors);expect(compiled.ok,JSON.stringify(compiled)).toBe(true);if(!compiled.ok)throw Error('compile');
 const target=document.createElement('div');document.body.append(target);const writes:unknown[]=[];
 const app=mount(DocumentHost,{target,props:{plan:compiled.plan,localState:source.localState,extensionDescriptors:descriptors,extensionImplementations:[...catalogImplementations,...flowAuthoringImplementations],dispatch:async()=>undefined,navigate:()=>{},onStateChange:(...args:unknown[])=>writes.push(args)}});await settle();
 return {target,writes,close:async()=>{await unmount(app);target.remove();}};
}
function camera(viewport:Element){const value=viewport.querySelector<HTMLElement>('.svelte-flow__viewport')!.style.transform;expect(value).not.toMatch(/NaN|Infinity/);return value;}
function innerPanes(target:Element){return [...target.querySelectorAll('.graph-viewport')].slice(1).map(root=>({root,pane:root.querySelector('.svelte-flow__pane')!}));}
function wheel(target:Element){const event=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-120});Object.defineProperties(event,{clientX:{value:100},clientY:{value:100}});target.dispatchEvent(event);}
function pan(target:Element){target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0,clientX:100,clientY:100,view:window}));window.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,buttons:1,clientX:160,clientY:130,view:window}));window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,clientX:160,clientY:130,view:window}));}
test('repeated nested empty-pane wheel owns only its camera despite outer control guards',async()=>{const v=await open();try{const outer=v.target.querySelector('.graph-viewport')!;const inners=innerPanes(v.target);expect(inners).toHaveLength(2);const before=[camera(outer),...inners.map(x=>camera(x.root))];wheel(inners[0].pane);await settle();expect(camera(inners[0].root)).not.toBe(before[1]);expect(camera(outer)).toBe(before[0]);expect(camera(inners[1].root)).toBe(before[2]);expect(v.writes).toEqual([]);}finally{await v.close();}});
test('nested empty-pane pan ignores mandatory outer-node nopan and keeps sibling/source',async()=>{const v=await open();try{const outer=v.target.querySelector('.graph-viewport')!;const inners=innerPanes(v.target);const before=[camera(outer),...inners.map(x=>camera(x.root))];pan(inners[0].pane);await settle();expect(camera(inners[0].root)).not.toBe(before[1]);expect(camera(outer)).toBe(before[0]);expect(camera(inners[1].root)).toBe(before[2]);expect(v.writes).toEqual([]);}finally{await v.close();}});
test('ordinary local controls keep pan/wheel guards; next empty gesture clears guard',async()=>{const v=await open();try{
 const outer=v.target.querySelector('.graph-viewport')!,inners=innerPanes(v.target),input=inners[0].root.querySelector('input')!;expect(input).toBeTruthy();const before=[camera(outer),...inners.map(x=>camera(x.root))];
 wheel(input);pan(input);await settle();expect([camera(outer),...inners.map(x=>camera(x.root))]).toEqual(before);
 wheel(inners[0].pane);await settle();expect(camera(inners[0].root)).not.toBe(before[1]);expect(camera(outer)).toBe(before[0]);expect(camera(inners[1].root)).toBe(before[2]);expect(v.writes).toEqual([]);
 }finally{await v.close();}});
for(const mode of ['editor','canvas'] as const)test(`nested retained ${mode} owns empty-pane wheel and pan`,async()=>{const v=await open(mode);try{
 const outer=v.target.querySelector('.graph-viewport')!,inner=v.target.querySelector(mode==='editor'?'.vict-graph-editor':'.vict-authored-flow-surface')!,pane=inner.querySelector('.svelte-flow__pane')!;
 const before=camera(inner),outerBefore=camera(outer);wheel(pane);await settle();expect(camera(inner)).not.toBe(before);const zoomed=camera(inner);pan(pane);await settle();expect(camera(inner)).not.toBe(zoomed);expect(camera(outer)).toBe(outerBefore);expect(v.writes).toEqual([]);
 }finally{await v.close();}});
test('mandatory outer XYFlow node nopan alone cannot block nested background pan',async()=>{const v=await open('workspace',false);try{const outer=v.target.querySelector('.graph-viewport')!,inner=innerPanes(v.target)[0];expect(inner.root.closest('.svelte-flow__node')!.classList.contains('nopan')).toBe(true);const before=camera(inner.root),outerBefore=camera(outer);pan(inner.pane);await settle();expect(camera(inner.root)).not.toBe(before);expect(camera(outer)).toBe(outerBefore);expect(v.writes).toEqual([]);}finally{await v.close();}});
test('outer empty pane stays usable after inner gestures without changing inner cameras',async()=>{const v=await open();try{const outer=v.target.querySelector('.graph-viewport')!,inners=innerPanes(v.target);wheel(inners[0].pane);await settle();const before=inners.map(x=>camera(x.root)),outerBefore=camera(outer);wheel(outer.querySelector('.svelte-flow__pane')!);await settle();expect(camera(outer)).not.toBe(outerBefore);const zoomed=camera(outer);pan(outer.querySelector('.svelte-flow__pane')!);await settle();expect(camera(outer)).not.toBe(zoomed);expect(inners.map(x=>camera(x.root))).toEqual(before);expect(v.writes).toEqual([]);}finally{await v.close();}});
