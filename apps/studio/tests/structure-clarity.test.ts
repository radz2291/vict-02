import {expect,it} from 'vitest';
import {canonicalUiDocument} from '@victframework/ui';
import {compileScreen} from '../src/lib/designer/application.js';
import {projectStructure,filterStructure,connectedStructure,structureId,structureNodePresentation,structureMove} from '../src/lib/designer/structure.js';
import {groupStructureRelationships} from '../src/lib/designer/structure-connections.js';
import {conditionDescription,structureBehavior,branchDescription} from '../src/lib/designer/structure-behavior.js';
import {clarityFixture} from './fixtures/structure-clarity.js';
import type {UiDocument} from '@victframework/ui';

it('shows logical branches/templates without granting occurrence editing and keeps definition bodies optional',()=>{
  const source=clarityFixture(),before=canonicalUiDocument(source).contentDigest,graph=projectStructure(source),view=filterStructure(graph);
  expect(compileScreen(source).ok).toBe(true);
  for(const sourceId of ['yes','no','template','portal-text'])expect(view.nodes.some(node=>node.data.sourceId===sourceId),sourceId).toBe(true);
  for(const sourceId of ['definition','slot','fallback'])expect(view.nodes.some(node=>node.data.sourceId===sourceId),sourceId).toBe(false);
  expect(filterStructure(graph,{definitions:true}).nodes.some(node=>node.data.sourceId==='fallback')).toBe(true);
  expect(graph.nodes.find(node=>node.data.sourceId==='yes')?.data.occurrence).toBeUndefined();
  expect(structureMove(source,'r1',{documentId:source.id,revision:'r1',source:structureId(source.id,'node','yes'),target:structureId(source.id,'node','screen')},false,[]).ok).toBe(false);
  expect(canonicalUiDocument(source).contentDigest).toBe(before);
});
it('applies visibility and collapsed ownership before a direct neighbourhood without dangling edges',()=>{
  const source=clarityFixture(),graph=projectStructure(source),id=(kind:string,key:string)=>structureId(source.id,kind,key);
  const on=connectedStructure(filterStructure(graph,{bindings:true}),id('node','field-0'));
  expect(on.nodes.some(node=>node.id===id('state','message'))).toBe(true);
  const off=connectedStructure(filterStructure(graph,{bindings:false}),id('node','field-0'));
  expect(off.nodes.some(node=>node.data.kind==='state')).toBe(false);
  const collapsed=connectedStructure(filterStructure(graph,{bindings:true,collapsed:new Set([id('node','screen')])}),id('node','screen'));
  expect(collapsed.nodes).toHaveLength(1);expect(collapsed.edges).toHaveLength(0);
  expect(on.edges.every(edge=>on.nodes.some(node=>node.id===edge.source)&&on.nodes.some(node=>node.id===edge.target))).toBe(true);
  const expanded=connectedStructure(filterStructure(graph,{bindings:true}),id('node','screen'),{expanded:new Set([id('node','conditional')])});
  expect(expanded.nodes.some(node=>node.data.sourceId==='yes')).toBe(true);expect(expanded.nodes.some(node=>node.id===id('condition','show'))).toBe(true);
});
it('maps a conditional to its declared controlling data without evaluating the condition',()=>{
  const source=clarityFixture(),graph=projectStructure(source),id=structureId(source.id,'node','conditional');
  expect(conditionDescription(source,'show')).toBe('Accepted is on');
  expect(graph.edges.some(edge=>edge.source===structureId(source.id,'condition','show')&&edge.target===id&&edge.data?.path==='/nodes/conditional/branches/0/when')).toBe(true);
  const groups=groupStructureRelationships(graph,id);
  expect(groups.flatMap(group=>group.relations.map(relation=>relation.label))).toEqual(expect.arrayContaining(['Branch','Otherwise']));
  expect(structureBehavior(source,'conditional').map(fact=>fact.value)).toContain('Shown when Accepted is on · 1 item');
  expect(structureBehavior(source,'repeat').map(fact=>fact.value)).toContain('One template for each item in Items');
  expect(structureBehavior(source,'portal').map(fact=>fact.value)).toContain('Logical ownership only; native portal rendering is not supported');
  expect(source.localState.accepted?.initial).toBe(false);
  expect(branchDescription(source,'show',1)).toBe('Otherwise, when Accepted is on');
});
it('searches displayed semantic types and retains full identities after concise card presentation',()=>{
  const source=clarityFixture(),graph=projectStructure(source),node=graph.nodes.find(node=>node.data.sourceId==='title')!,presentation=structureNodePresentation(source,node.data);
  expect(filterStructure(graph,{search:'Heading'}).nodes.some(match=>match.id===node.id)).toBe(true);
  expect(filterStructure(graph,{search:'tooltips'}).nodes.some(node=>node.data.sourceId==='title')).toBe(true);
  expect(presentation.fullLabel?.length).toBeGreaterThan(presentation.label.length);
  expect(node.ariaLabel).toContain(presentation.fullLabel);
  expect(node.ariaLabel).toMatch(/^Heading:/);
});
it('describes native events and viewport conditions as declarations, without inventing outcomes',()=>{
  const seed=clarityFixture();
  const source:UiDocument={...seed,conditions:{...seed.conditions,compact:{id:'compact',kind:'media',query:'(max-width: 600px)'}},nodes:{...seed.nodes,screen:{id:'screen',kind:'element',tag:'main',children:['submit']},submit:{id:'submit',kind:'element',tag:'button',children:[],interactions:[{on:'click',action:'invokeAction',actionId:'demo.submit',input:{message:{type:'ref',path:'state.message'},accepted:{type:'ref',path:'state.accepted'}}}]}}};
  expect(compileScreen(source).ok).toBe(true);
  expect(structureBehavior(source,'submit')).toContainEqual({name:'When clicked',value:'Requests Submit (simulated)'});
  expect(conditionDescription(source,'compact')).toBe('screen is 600 px wide or smaller');
});
it('bounds shared-state fanout, reveals other users only on demand, and preserves source across paging',()=>{
  const source=clarityFixture(140),before=canonicalUiDocument(source).contentDigest,graph=filterStructure(projectStructure(source),{bindings:true}),field=structureId(source.id,'node','field-0'),state=structureId(source.id,'state','message');
  expect(compileScreen(source).ok).toBe(true);
  const direct=connectedStructure(graph,field);
  expect(direct.nodes.map(node=>node.data.sourceId).filter(Boolean)).toEqual(['screen','field-0']);
  const related=connectedStructure(graph,field,{related:true}),more=connectedStructure(graph,field,{related:true,limit:49});
  expect(related.nodes).toHaveLength(25);expect(more.nodes).toHaveLength(49);
  expect(related.nodes.some(node=>node.id===state)).toBe(true);
  expect(related.nodes.every(node=>more.nodes.some(other=>node.id===other.id))).toBe(true);
  expect(connectedStructure(graph,state).nodes).toHaveLength(25);
  const complete=connectedStructure(graph,state,{limit:Infinity});expect(complete.nodes).toHaveLength(141);expect(complete.edges).toHaveLength(140);
  expect(canonicalUiDocument(source).contentDigest).toBe(before);
});
