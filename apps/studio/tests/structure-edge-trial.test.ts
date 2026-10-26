import {expect,it} from 'vitest';
import type {UiDocument} from '@victframework/ui';
import {canonicalUiDocument} from '@victframework/ui';
import {newScreen,compileScreen} from '../src/lib/designer/application.js';
import {projectStructure,compactStructure,structureNodePresentation,structureId} from '../src/lib/designer/structure.js';
import {structureConnectionEdges} from '../src/lib/designer/structure-connections.js';
function fixture():UiDocument{return {...newScreen('Edge trial','edge-trial'),nodes:{
 screen:{id:'screen',kind:'element',tag:'main',children:['select','field','different','dynamic']},
 select:{id:'select',kind:'element',tag:'select',children:['option']},
 option:{id:'option',kind:'element',tag:'option',attributes:{value:'marketing'},children:['copy']},
 copy:{id:'copy',kind:'text',content:{type:'literal',value:'Marketing'}},
 different:{id:'different',kind:'element',tag:'button',attributes:{'aria-label':'Accessible name'},children:['different-copy']},
 'different-copy':{id:'different-copy',kind:'text',content:{type:'literal',value:'Visible wording'}},
 dynamic:{id:'dynamic',kind:'element',tag:'p',children:['dynamic-copy']},
 'dynamic-copy':{id:'dynamic-copy',kind:'text',content:{type:'expression',expression:{type:'ref',path:'state.message'}}},
 field:{id:'field',kind:'element',tag:'input',attributes:{value:{type:'ref',path:'state.message'}},children:[],interactions:[{on:'change',action:'setState',key:'message',value:{type:'ref',path:'state.message'}}]},
}};}
it('removes generated type prefixes, retaining literal wording, source identities and values',()=>{
 const source=fixture(),before=canonicalUiDocument(source).contentDigest,graph=projectStructure(source);
 expect(compileScreen(source).ok).toBe(true);
 for(const key of ['option','copy']){const node=graph.nodes.find(n=>n.data.sourceId===key)!;expect(structureNodePresentation(source,node.data).label).toBe('Marketing');}
 const authored={...source,nodes:{...source.nodes,copy:{id:'copy',kind:'text' as const,content:{type:'literal' as const,value:'Text · Intentional wording'}}}};
 const node=projectStructure(authored).nodes.find(n=>n.data.sourceId==='copy')!;expect(structureNodePresentation(authored,node.data).label).toBe('Text · Intentional wording');
 expect(canonicalUiDocument(source).contentDigest).toBe(before);
});
it('compacts only duplicated literal content, keeping distinct accessible/visible wording and bound text',()=>{
 const source=fixture(),graph=projectStructure(source),compact=compactStructure(graph,source);
 expect(compact.nodes.some(n=>n.data.sourceId==='copy')).toBe(false);
 for(const key of ['different-copy','dynamic-copy'])expect(compact.nodes.some(n=>n.data.sourceId===key),key).toBe(true);
 expect(graph.nodes.some(n=>n.data.sourceId==='copy')).toBe(true);
});
it('labels parallel reference locations once without removing edges or declared source paths',()=>{
 const source=fixture(),graph=projectStructure(source),edges=structureConnectionEdges(graph);
 expect(edges.map(e=>[e.id,e.source,e.target,e.data])).toEqual(graph.edges.map(e=>[e.id,e.source,e.target,e.data]));
 const reads=edges.filter(e=>e.source===structureId(source.id,'node','field')&&String(e.label??'').startsWith('Reads'));
 expect(reads).toHaveLength(1);expect(reads[0]?.label).toBe('Reads · 2');
 expect(edges.some(e=>e.label==='Updates')).toBe(true);expect(edges.every(e=>!!e.markerEnd)).toBe(true);
});
