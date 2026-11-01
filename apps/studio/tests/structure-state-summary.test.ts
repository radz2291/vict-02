import {expect,it} from 'vitest';
import {canonicalUiDocument,type UiDocument,type UiValue,type UiValueType} from '@victframework/ui';
import {projectStructure,structureFacts,structureId,structureNodePresentation} from '@victframework/ui-structure-svelte/projection';
import {newScreen} from '../src/lib/designer/application.js';
import {readFileSync} from 'node:fs';
import {sourceOverview} from '../src/lib/designer/selection-presentation.js';
import {clarityFixture} from './fixtures/structure-clarity.js';

function fixture(initial:UiValue,type:UiValueType='string'):UiDocument {
  const base=newScreen('State summaries','state-summaries');
  return {...base,localState:{...base.localState,payload:{key:'payload',type,initial}}};
}
function inspect(source:UiDocument){const node=projectStructure(source).nodes.find(node=>node.id===structureId(source.id,'state','payload'))!;return {node,summary:structureNodePresentation(source,node.data).summary,facts:structureFacts(source,node)};}

it.each([1,2,3])('summarizes validated graph@%s without interpreting its state as live execution',version=>{
  const initial=JSON.stringify({schema:`vict.flow-graph@${version}`,revision:0,nodeTypes:[],nodes:[],edges:[]});
  const source=fixture(initial),before=canonicalUiDocument(source).contentDigest;
  const result=inspect(source);expect(result.summary).toBe('Graph configuration · 0 nodes · 0 connections');
  expect(result.facts).toContainEqual({path:'initial',value:initial});expect(source.localState.payload!.type).toBe('string');
  expect(canonicalUiDocument(source).contentDigest).toBe(before);
});

it('summarizes the real Evidence desk graph and preserves its complete stored JSON',()=>{
  const saved=JSON.parse(readFileSync(new URL('../../../docs/studio/foundation-evidence/structure-test-repair-20261101/current-source-after.json',import.meta.url),'utf8')) as UiDocument;
  const initial=saved.localState['evidence-graph']!.initial;
  const result=inspect(fixture(initial));expect(result.summary).toBe('Graph configuration · 3 nodes · 2 connections');
  expect(result.facts).toContainEqual({path:'initial',value:initial});
  const source=fixture(initial),graph=projectStructure(source);
  expect(sourceOverview(source,graph,result.node.id)).toContainEqual({name:'Starting value',value:initial});
});

it.each([
  ['{ "name": "A", "nested": {"secret":"complete detail"} }','JSON object · 2 fields'],
  ['[]','JSON array · 0 items'],['[1,{"name":"two"},3]','JSON array · 3 items'],
  ['{"schema":"vict.flow-graph@99","nodes":[],"edges":[]}','JSON object · 3 fields'],
  ['{"schema":"vict.flow-graph@2","nodes":[null],"edges":[]}','JSON object · 3 fields'],
  ['{"broken":','Text · JSON-like text'],['  \n  ','Text · whitespace only'],
  ['Hello\n\tworld','Text · starts with “Hello world”'],
])('summarizes structured or multiline content without leaking raw fragments: %s',(initial,expected)=>{
  const source=fixture(initial),before=canonicalUiDocument(source).contentDigest,result=inspect(source);
  expect(result.summary).toBe(expected);expect(result.facts).toContainEqual({path:'initial',value:initial});
  expect(canonicalUiDocument(source).contentDigest).toBe(before);
});

it.each([
  ['string','', 'Text · starts empty'],['boolean',false,'Boolean · initially off'],['number',7,'Number · starts at 7'],
  ['stringList',['one'],'Text list · 1 initial item'],['numberList',[1,2],'Number list · 2 initial items'],
  ['isoDate','2026-11-01','Date · starts with “2026-11-01”'],['isoTime','09:00','Time · starts with “09:00”'],
] satisfies [UiValueType,UiValue,string][])('keeps primitive/list/date summaries readable (%s)',(type,initial,expected)=>{
  expect(inspect(fixture(initial,type)).summary).toBe(expected);
});

it('bounds only the ordinary-text card preview, without splitting emoji or truncating inspection data',()=>{
  const initial='🙂'.repeat(40),result=inspect(fixture(initial));
  expect(result.summary).toBe(`Text · starts with “${'🙂'.repeat(31)}…”`);
  expect(result.facts).toContainEqual({path:'initial',value:initial});
});

it('retains other node captions, literal wording, token values and source facts',()=>{
  const base=clarityFixture();
  const screen=base.nodes.screen;if(screen.kind!=='element')throw Error('Expected screen container');
  const source:UiDocument={...base,tokens:{accent:{id:'accent',value:'#3355aa'}},nodes:{...base.nodes,screen:{...screen,localStyle:[{property:'color',value:{type:'token',id:'accent'}}]}}};
  const before=canonicalUiDocument(source).contentDigest,graph=projectStructure(source);
  const nonState=graph.nodes.filter(node=>node.data.kind!=='state').map(node=>[node.id,structureNodePresentation(source,node.data)]);
  const changed={...source,localState:{...source.localState,message:{key:'message',type:'string' as const,initial:'{"a":1}'}}};
  expect(projectStructure(changed).nodes.filter(node=>node.data.kind!=='state').map(node=>[node.id,structureNodePresentation(changed,node.data)])).toEqual(nonState);
  expect(graph.nodes.find(node=>node.id===structureId(source.id,'token','accent'))?.data.summary).toBe('#3355aa');
  expect(graph.nodes.find(node=>node.data.kind==='definition')?.data.summary).toBe('Revision 1');
  expect(canonicalUiDocument(source).contentDigest).toBe(before);
});
