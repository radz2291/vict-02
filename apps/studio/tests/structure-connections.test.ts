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
it('shows selected input data and other consumers without the unrelated hierarchy',()=>{
 const source=fixture(),before=JSON.stringify(source),graph=projectStructure(source);
 const view=connectedStructure(graph,structureId(source.id,'node','input'));
 expect(view.nodes.some(node=>node.data.sourceId==='input')).toBe(true);
 expect(view.nodes.some(node=>node.data.kind==='state')).toBe(true);
 expect(view.nodes.some(node=>node.data.sourceId==='other')).toBe(true);
 expect(view.nodes.some(node=>node.data.sourceId==='unrelated')).toBe(false);
 expect(view.edges.some(edge=>edge.data?.kind==='binding')).toBe(true);
 expect(JSON.stringify(source)).toBe(before);
});
it('includes container descendant connections and declared actions without unrelated siblings',()=>{
 const source=fixture(),view=connectedStructure(projectStructure(source),structureId(source.id,'node','section'));
 expect(view.nodes.some(node=>node.data.sourceId==='section')).toBe(true);
 expect(view.nodes.some(node=>node.data.kind==='action')).toBe(true);
 expect(view.nodes.some(node=>node.data.sourceId==='unrelated')).toBe(false);
 expect(view.edges.every(edge=>view.nodes.some(node=>node.id===edge.source)&&view.nodes.some(node=>node.id===edge.target))).toBe(true);
});
it('keeps an unconnected selection truthful and rejects an unknown selection',()=>{
 const source=fixture(),graph=projectStructure(source),id=structureId(source.id,'node','unrelated');
 expect(connectedStructure(graph,id)).toMatchObject({nodes:[{id}],edges:[]});
 expect(connectedStructure(graph,'missing')).toEqual({nodes:[],edges:[]});
});
