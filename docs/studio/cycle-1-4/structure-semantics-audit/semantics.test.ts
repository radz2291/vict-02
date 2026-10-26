import {expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {compileUiDocument,defaultSemanticElementCatalog,canonicalUiDocument,type UiDocument,type UiExtensionDescriptor} from '@victframework/ui';
import {newScreen,compileScreen,screenActionState} from '../../../../apps/studio/src/lib/designer/application.js';
import {projectStructure,structureId,filterStructure} from '../../../../apps/studio/src/lib/designer/structure.js';
import {structureConnectionEdges,groupStructureRelationships} from '../../../../apps/studio/src/lib/designer/structure-connections.js';
import {structureBehavior} from '../../../../apps/studio/src/lib/designer/structure-behavior.js';
import {clarityFixture} from '../../../../apps/studio/tests/fixtures/structure-clarity.js';

// Characterization probes assert observed gaps, NOT acceptance criteria or repairs.
const findings:Record<string,unknown>={};
function record(id:string,value:unknown){findings[id]=value;writeFileSync(fileURLToPath(new URL('./observations.json',import.meta.url)),JSON.stringify(findings,null,2)+'\n');}
function compiled(source:UiDocument,extensions:readonly UiExtensionDescriptor[]=[],catalogs:Parameters<typeof compileUiDocument>[3]={},extraAttributes:string[]=[]){
 const semantic=defaultSemanticElementCatalog();
 const result=compileUiDocument(source,{...semantic,globalAttributes:[...semantic.globalAttributes,...extraAttributes]},extensions,catalogs);
 expect(result.ok,JSON.stringify(result.issues)).toBe(true);return result;
}
const base=()=>newScreen('Semantic audit','semantic-audit');

it('SA01: read and write arrowheads both follow declaration source, while Reads2 includes fallback',()=>{
 const seed=base(),source:UiDocument={...seed,nodes:{screen:{id:'screen',kind:'element',tag:'input',children:[],attributes:{value:{type:'ref',path:'state.message'}},interactions:[{on:'change',action:'setState',key:'message',value:{type:'ref',path:'state.message'}}]}}};
 compiled(source);const graph=projectStructure(source),edges=structureConnectionEdges(graph);
 expect(edges).toHaveLength(3);expect(edges.every(e=>e.source===structureId(source.id,'node','screen')&&e.target===structureId(source.id,'state','message'))).toBe(true);
 record('SA01',{edges:edges.map(e=>({label:e.label,from:e.source,to:e.target,path:e.data?.path})),behaviour:structureBehavior(source,'screen')});
});
it('SA02: different definition prop scopes merge into one generic prop reference',()=>{
 const seed=base(),source:UiDocument={...seed,nodes:{screen:{id:'screen',kind:'element',tag:'main',children:['a','b']},a:{id:'a',kind:'component',definitionId:'a',props:{title:{type:'literal',value:'Alpha'}}},b:{id:'b',kind:'component',definitionId:'b',props:{title:{type:'literal',value:'Beta'}}},ta:{id:'ta',kind:'text',content:{type:'expression',expression:{type:'ref',path:'prop.title'}}},tb:{id:'tb',kind:'text',content:{type:'expression',expression:{type:'ref',path:'prop.title'}}}},componentDefinitions:{a:{id:'a',revision:'1',root:'ta',props:[{name:'title',type:'string'}],slots:{}},b:{id:'b',revision:'1',root:'tb',props:[{name:'title',type:'string'}],slots:{}}}};
 compiled(source);const graph=projectStructure(source),refs=graph.nodes.filter(n=>n.data.kind==='reference');expect(refs).toHaveLength(1);expect(graph.edges.filter(e=>e.target===refs[0]!.id)).toHaveLength(2);record('SA02',{reference:refs[0],consumers:graph.edges.filter(e=>e.target===refs[0]!.id)});
});
it('SA03: separate repeat scopes with the same item name merge item references',()=>{
 const seed=base(),source:UiDocument={...seed,nodes:{screen:{id:'screen',kind:'element',tag:'main',children:['a','b']},a:{id:'a',kind:'repeat',collection:{type:'ref',path:'view.products'},key:{type:'ref',path:'repeat.row.id'},itemName:'row',templateRoot:'ta'},b:{id:'b',kind:'repeat',collection:{type:'ref',path:'view.orders'},key:{type:'ref',path:'repeat.row.id'},itemName:'row',templateRoot:'tb'},ta:{id:'ta',kind:'text',content:{type:'expression',expression:{type:'ref',path:'repeat.row.name'}}},tb:{id:'tb',kind:'text',content:{type:'expression',expression:{type:'ref',path:'repeat.row.name'}}}}};
 compiled(source,[],{viewFields:{products:'array','products.id':'string','products.name':'string',orders:'array','orders.id':'string','orders.name':'string'}});
 const graph=projectStructure(source),target=structureId(source.id,'reference','repeat.row.name');expect(graph.edges.filter(e=>e.target===target)).toHaveLength(2);record('SA03',graph.edges.filter(e=>e.target===target));
});
it('SA04: separate component output payloads merge into one generic output reference',()=>{
 const seed=base(),descriptor:UiExtensionDescriptor={id:'probe.toggle',revision:'1',props:[],abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],outputs:[{name:'change',payload:'boolean'}],rendererImplementationId:'probe@1'};
 const source:UiDocument={...seed,nodes:{screen:{id:'screen',kind:'element',tag:'main',children:['a','b']},a:{id:'a',kind:'component',definitionId:descriptor.id,outputs:{change:{setState:{key:'accepted',value:{type:'ref',path:'$output'}}}}},b:{id:'b',kind:'component',definitionId:descriptor.id,outputs:{change:{setState:{key:'dialogOpen',value:{type:'ref',path:'$output'}}}}}}};
 compiled(source,[descriptor]);const graph=projectStructure(source),target=structureId(source.id,'reference','$output');expect(graph.edges.filter(e=>e.target===target)).toHaveLength(2);record('SA04',graph.edges.filter(e=>e.target===target));
});
it('SA05: attached styles, tokens and their state/condition dependencies have no graph representation',()=>{
 const seed=base(),source:UiDocument={...seed,localState:{...seed.localState,tint:{key:'tint',type:'string',initial:'#223344'}},tokens:{accent:{id:'accent',value:'#102030'}},conditions:{compact:{id:'compact',kind:'media',query:'(max-width: 600px)'}},styleSources:{shared:{id:'shared',conditionId:'compact',declarations:[{property:'color',value:{type:'binding',expression:{type:'ref',path:'state.tint'}}},{property:'background-color',value:{type:'token',id:'accent'}}]}},nodes:{screen:{id:'screen',kind:'element',tag:'main',children:[],styleSources:['shared']}}};
 compiled(source);const graph=projectStructure(source);expect(graph.edges).toHaveLength(0);record('SA05',{declaredStyle:source.styleSources.shared,graphKinds:graph.nodes.map(n=>n.data.kind),stateIsolated:!graph.edges.some(e=>e.target===structureId(source.id,'state','tint'))});
});
it('SA06: host action-state return wiring is outside this document-only graph',()=>{
 const seed=base(),source:UiDocument={...seed,nodes:{screen:{id:'screen',kind:'element',tag:'button',children:[],interactions:[{on:'click',action:'invokeAction',actionId:'demo.submit',input:{message:{type:'ref',path:'state.message'},accepted:{type:'ref',path:'state.accepted'}}}]}}};
 expect(compileScreen(source).ok).toBe(true);const graph=projectStructure(source),action=structureId(source.id,'action','demo.submit');expect(graph.edges.filter(e=>e.source===action)).toHaveLength(0);record('SA06',{hostWiring:screenActionState['demo.submit'],outgoingActionEdges:graph.edges.filter(e=>e.source===action)});
});
it('SA07: valid host-registered inert attributes can be mistaken for an action invocation',()=>{
 const seed=base(),source:UiDocument={...seed,nodes:{screen:{id:'screen',kind:'element',tag:'div',children:[],attributes:{actionId:'decorative-name'}}}};
 compiled(source,[],{},['actionId']);const graph=projectStructure(source);expect(graph.edges.some(e=>e.label==='invokes action')).toBe(true);record('SA07',{interactions:source.nodes.screen!.interactions??[],edges:graph.edges});
});
it('SA08: flattened containment paths are display strings, not exact document property paths',()=>{
 const source=clarityFixture(),before=canonicalUiDocument(source).contentDigest;expect(compileScreen(source).ok).toBe(true);const graph=projectStructure(source),branches=graph.edges.filter(e=>e.source===structureId(source.id,'node','conditional')&&e.data?.kind==='containment');
 expect(branches[0]!.data!.path).not.toBe('nodes.conditional.branches.0.children.0');record('SA08',{branchEdges:branches,definitionEdges:graph.edges.filter(e=>e.source===structureId(source.id,'definition','local.card')),sourceUnchanged:canonicalUiDocument(source).contentDigest===before});
});
it('SA09: category switches omit isolated declarations even when state/action visibility is on',()=>{
 const source=base(),graph=projectStructure(source),view=filterStructure(graph,{bindings:true,definitions:true});compiled(source);expect(graph.nodes.some(n=>n.data.kind==='state')).toBe(true);expect(view.nodes.some(n=>n.data.kind==='state')).toBe(false);record('SA09',{all:graph.nodes.length,visible:view.nodes.length,hiddenStates:graph.nodes.filter(n=>n.data.kind==='state').map(n=>n.data.label)});
});
it('SA10: branch/template/slot/portal declarations retain logical ownership and disclaim unsupported rendering',()=>{
 const source=clarityFixture();expect(compileScreen(source).ok).toBe(true);const graph=projectStructure(source),relations=groupStructureRelationships(graph,structureId(source.id,'node','conditional'));
 expect(relations.flatMap(g=>g.relations.map(r=>r.label))).toContain('Otherwise');expect(structureBehavior(source,'portal').some(f=>f.value.includes('not supported'))).toBe(true);record('SA10',{kinds:[...new Set(Object.values(source.nodes).map(n=>n.kind))],branchRelations:relations,repeat:structureBehavior(source,'repeat'),slot:structureBehavior(source,'slot'),portal:structureBehavior(source,'portal')});
});
