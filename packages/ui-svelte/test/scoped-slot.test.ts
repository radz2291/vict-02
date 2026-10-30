import {describe,it,expect} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {compileUiDocument,defaultSemanticElementCatalog,type UiDocument,type UiExtensionDescriptor} from '@victframework/ui';
import DocumentHost from '../src/document/DocumentHost.svelte';
import type {UiSvelteComponentImplementation} from '../src/document/extensions.js';
import Host from './ScopedHostFixture.svelte';
import Checkbox from './CatalogCheckboxFixture.svelte';
import Press from './ScopedPressFixture.svelte';
import {scopedProbeCallbacks} from './scoped-slot-probes.js';
const base={abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],rendererImplementationId:'test.scoped'} as const;
const descriptors:UiExtensionDescriptor[]=[
 {...base,id:'test.scoper',revision:'1',props:[],slots:['body'],scopedSlots:['body'],outputs:[]},
 {...base,id:'test.check',revision:'1',props:[{name:'checked',type:'boolean'},{name:'label',type:'string'}],outputs:[{name:'checkedChange',payload:'boolean'}]},
 {...base,id:'test.press',revision:'1',props:[{name:'label',type:'string'}],outputs:[{name:'press',payload:'void'}]},
];
const implementations:UiSvelteComponentImplementation[]=descriptors.map((d,index)=>({...base,extensionId:d.id,revision:d.revision,slots:d.slots??[],scopedSlots:d.scopedSlots,component:[Host,Checkbox,Press][index]!}));
function doc():UiDocument{return {schema:'vict.ui-document@1',id:'scope-test',revision:'1',root:'root',nodes:{
 root:{kind:'component',id:'root',definitionId:'test.scoper',revision:'1',slots:{body:{name:'body',children:['body'],scope:{schema:'vict.ui-slot-scope@1',props:[{name:'id',type:'string'},{name:'rows',type:'array'}],conditions:{isA:{type:'compare',op:'eq',left:{type:'ref',path:'prop.id'},right:{type:'literal',value:'a'}}},state:{checked:{key:'checked',type:'boolean',initial:false,controlled:true},local:{key:'local',type:'boolean',initial:false}},outputs:[{name:'choose',payload:'string'}]}}}},
 body:{kind:'element',id:'body',tag:'div',children:['id','row','local','press','family']},
 family:{kind:'conditional',id:'family',branches:[{when:'isA',children:['familyA']},{children:['familyB']}]},
 familyA:{kind:'text',id:'familyA',content:{type:'literal',value:'Prompt form'}},
 familyB:{kind:'text',id:'familyB',content:{type:'literal',value:'Settings form'}},
 row:{kind:'repeat',id:'row',collection:{type:'ref',path:'prop.rows'},key:{type:'ref',path:'prop.id'},itemName:'row',templateRoot:'controlled'},
 id:{kind:'text',id:'id',content:{type:'expression',expression:{type:'ref',path:'prop.id'}}},
 controlled:{kind:'component',id:'controlled',definitionId:'test.check',revision:'1',props:{checked:{type:'ref',path:'state.checked'},label:{type:'literal',value:'Controlled'}},outputs:{checkedChange:{setState:{key:'checked'}}}},
 local:{kind:'component',id:'local',definitionId:'test.check',revision:'1',props:{checked:{type:'ref',path:'state.local'},label:{type:'literal',value:'Local'}},outputs:{checkedChange:{setState:{key:'local'}}}},
 press:{kind:'component',id:'press',definitionId:'test.press',revision:'1',props:{label:{type:'ref',path:'prop.id'}},outputs:{press:{emit:{output:'choose',value:{type:'ref',path:'prop.id'}}}}},
},componentDefinitions:{},styleSources:{},tokens:{},conditions:{},assets:{},localState:{checked:{key:'checked',type:'boolean',initial:false}}};}
const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,10));flushSync();};
describe('versioned generic scoped slots',()=>{
 it('keeps node scopes isolated, retains local state, routes declared meaningful output and expires removed callbacks',async()=>{
  const source=doc(),compiled=compileUiDocument(source,defaultSemanticElementCatalog(),descriptors);expect(compiled.ok,JSON.stringify(compiled)).toBe(true);if(!compiled.ok)return;
  const target=document.createElement('div');document.body.append(target);const diagnostics:unknown[]=[],rootWrites:unknown[]=[];
  const app=mount(DocumentHost,{target,props:{plan:compiled.plan,localState:source.localState,extensionDescriptors:descriptors,extensionImplementations:implementations,dispatch:async()=>undefined,navigate:()=>{},onStateChange:(...args)=>rootWrites.push(args),onRenderDiagnostic:(issue)=>diagnostics.push(issue)}});
  await settle();
  expect(target.querySelector('[data-frame=a]')?.textContent).toContain('Prompt form');expect(target.querySelector('[data-frame=a]')?.textContent).not.toContain('Settings form');expect(target.querySelector('[data-frame=b]')?.textContent).toContain('Settings form');
  const checks=(id:string)=>[...target.querySelectorAll<HTMLInputElement>(`[data-frame=${id}] input[type=checkbox]`)];
  checks('a')[0]!.checked=true;checks('a')[0]!.dispatchEvent(new Event('change',{bubbles:true}));await settle();
  expect(checks('a')[0]!.checked).toBe(true);expect(checks('b')[0]!.checked).toBe(false);expect(rootWrites).toEqual([]);
  checks('a')[1]!.checked=true;checks('a')[1]!.dispatchEvent(new Event('change',{bubbles:true}));await settle();
  [...target.querySelectorAll('button')].find(e=>e.textContent==='Rerender 0')!.click();await settle();expect(checks('a')[1]!.checked).toBe(true);expect(checks('b')[1]!.checked).toBe(false);
  [...target.querySelectorAll<HTMLButtonElement>('[data-frame=b] button')].find(button=>button.textContent==='b')!.click();await settle();expect(target.querySelector('output')?.textContent).toBe('b:choose:b');
  const occurrences=[...target.querySelectorAll('[data-frame] [data-ui-occ]')].map(e=>e.getAttribute('data-ui-occ'));expect(occurrences.some(key=>key?.includes('scope:a'))).toBe(true);expect(occurrences.some(key=>key?.includes('scope:b'))).toBe(true);
  const old=scopedProbeCallbacks.get('a')!;[...target.querySelectorAll('button')].find(e=>e.textContent==='Remove a')!.click();await settle();old();await settle();expect(target.querySelector('output')?.textContent).toBe('b:choose:b');expect(diagnostics.some(d=>(d as {code:string}).code==='UI_COMPONENT_OUTPUT_STALE')).toBe(true);
  await unmount(app);target.remove();
 });
 it('rejects malformed new scope metadata and nested conditions with diagnostics rather than throwing',()=>{
   for(const bad of [{schema:'vict.ui-slot-scope@1',props:[],unknown:true},{schema:'vict.ui-slot-scope@1',props:[],conditions:{broken:{type:'compare',op:'eq'}}},{schema:'vict.ui-slot-scope@1',props:[null]}]){
     const source=doc();(source.nodes.root as Extract<UiDocument['nodes'][string],{kind:'component'}>).slots!.body!.scope=bad as never;
     expect(()=>compileUiDocument(source,defaultSemanticElementCatalog(),descriptors)).not.toThrow();
     expect(compileUiDocument(source,defaultSemanticElementCatalog(),descriptors).ok).toBe(false);
   }
 });
 it('rejects undeclared lexical state/output and scoped slots without capability while retaining old ABI',()=>{
   const source=doc();(source.nodes.press as Extract<UiDocument['nodes'][string],{kind:'component'}>).outputs={press:{emit:{output:'unknown'}}};
   const result=compileUiDocument(source,defaultSemanticElementCatalog(),descriptors);expect(JSON.stringify(result)).toContain('UI_COMPONENT_OUTPUT_UNKNOWN');
   const unsupported=compileUiDocument(doc(),defaultSemanticElementCatalog(),descriptors.map(d=>d.id==='test.scoper'?{...d,scopedSlots:[]}:d));expect(JSON.stringify(unsupported)).toContain('This slot does not declare scoped rendering capability');
   const invalid=doc();(invalid.nodes.controlled as Extract<UiDocument['nodes'][string],{kind:'component'}>).outputs={checkedChange:{setState:{key:'missing'}}};expect(JSON.stringify(compileUiDocument(invalid,defaultSemanticElementCatalog(),descriptors))).toContain('Output binding targets undeclared state');
 });
});
