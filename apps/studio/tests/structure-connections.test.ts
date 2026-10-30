import {expect,it} from 'vitest';
import type {UiDocument} from '@victframework/ui';
import {newScreen} from '../src/lib/designer/application.js';
import {connectedStructure,projectStructure,structureId} from '../src/lib/designer/structure.js';
function fixture():UiDocument{return {...newScreen('Connections','connections'),nodes:{
 screen:{id:'screen',kind:'element',tag:'main',children:['section','other','unrelated']},
 section:{id:'section',kind:'element',tag:'section',children:['input','submit']},
 input:{id:'input',kind:'element',tag:'input',children:[],attributes:{value:{type:'ref',path:'state.message'}}},
 other:{id:'other',kind:'element',tag:'input',children:[],attributes:{value:{type:'ref',path:'state.message'}}},
 unrelated:{id:'unrelated',kind:'element',tag:'p',children:[]},
 submit:{id:'submit',kind:'component',definitionId:'vict.catalog.button',revision:'1',props:{label:{type:'literal',value:'Submit'}},slots:{},outputs:{press:{invokeAction:{actionId:'demo.submit',input:{message:{type:'ref',path:'state.message'},accepted:{type:'literal',value:true}}}}}},
}};}
it('shows direct input data without automatically adding other consumers',()=>{
 const source=fixture(),before=JSON.stringify(source),graph=projectStructure(source);
 const view=connectedStructure(graph,structureId(source.id,'node','input'));
 expect(view.nodes.some(node=>node.data.sourceId==='input')).toBe(true);
 expect(view.nodes.some(node=>node.data.kind==='state')).toBe(true);
 expect(view.nodes.some(node=>node.data.sourceId==='other')).toBe(false);
 expect(connectedStructure(graph,structureId(source.id,'node','input'),{related:true}).nodes.some(node=>node.data.sourceId==='other')).toBe(true);
 expect(view.nodes.some(node=>node.data.sourceId==='unrelated')).toBe(false);
 expect(view.edges.some(edge=>edge.data?.kind==='binding')).toBe(true);
 expect(JSON.stringify(source)).toBe(before);
});
it('shows direct container children without expanding their actions or unrelated siblings',()=>{
 const source=fixture(),view=connectedStructure(projectStructure(source),structureId(source.id,'node','section'));
 expect(view.nodes.some(node=>node.data.sourceId==='section')).toBe(true);
 expect(view.nodes.some(node=>node.data.sourceId==='submit')).toBe(true);
 expect(view.nodes.some(node=>node.data.kind==='action')).toBe(false);
 expect(view.nodes.some(node=>node.data.sourceId==='unrelated')).toBe(false);
 expect(view.edges.every(edge=>view.nodes.some(node=>node.id===edge.source)&&view.nodes.some(node=>node.id===edge.target))).toBe(true);
});
it('keeps a static item connected to its declared parent and rejects an unknown selection',()=>{
 const source=fixture(),graph=projectStructure(source),id=structureId(source.id,'node','unrelated');
 const view=connectedStructure(graph,id);expect(view.nodes.some(node=>node.id===id)).toBe(true);expect(view.edges).toHaveLength(1);expect(view.edges[0]?.data?.kind).toBe('containment');
 expect(connectedStructure(graph,'missing')).toEqual({nodes:[],edges:[]});
});
