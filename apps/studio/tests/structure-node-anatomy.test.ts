import {expect,it} from 'vitest';
import {canonicalUiDocument} from '@victframework/ui';
import {newScreen} from '../src/lib/designer/application.js';
import {projectStructure,structureId,structureNodePresentation} from '../src/lib/designer/structure.js';
import {structurePorts,structureConnectionEdges,groupStructureRelationships} from '../src/lib/designer/structure-connections.js';

function fixture(){const base=newScreen('Connections','connections');return {...base,localState:{...base.localState,name:{key:'name',type:'string' as const,initial:''}},nodes:{...base.nodes,screen:{id:'screen',kind:'element' as const,tag:'main',children:['name']},name:{id:'name',kind:'element' as const,tag:'input',children:[],attributes:{'aria-label':'Full name',value:{type:'ref' as const,path:'state.name'}},interactions:[{on:'change' as const,action:'setState' as const,key:'name',value:{type:'ref' as const,path:'state.name'}}]}}};}
it('keeps each declared edge identity/path and gives both ends a matching read-only presentation port',()=>{
 const source=fixture(),digest=canonicalUiDocument(source).contentDigest,graph=projectStructure(source),edges=structureConnectionEdges(graph);
 expect(edges.map(edge=>[edge.id,edge.source,edge.target,edge.data])).toEqual(graph.edges.map(edge=>[edge.id,edge.source,edge.target,edge.data]));
 for(const edge of edges){expect(structurePorts(graph,edge.source).some(port=>port.id===edge.sourceHandle&&port.side==='out')).toBe(true);expect(structurePorts(graph,edge.target).some(port=>port.id===edge.targetHandle&&port.side==='in')).toBe(true);}
 expect(canonicalUiDocument(source).contentDigest).toBe(digest);
});
it('groups repeated reads and updates to one target without dropping any distinct source path',()=>{
 const source=fixture(),graph=projectStructure(source),id=structureId(source.id,'state','name'),groups=groupStructureRelationships(graph,id);
 expect(groups).toHaveLength(1);expect(groups[0]?.count).toBe(3);
 expect(groups[0]?.relations.map(relation=>[relation.label,relation.count])).toEqual([['Read by',2],['Updated by',1]]);
 expect(groups[0]?.relations.flatMap(relation=>relation.paths).sort()).toEqual(graph.edges.filter(edge=>edge.target===id).map(edge=>edge.data!.path).sort());
 const ports=structurePorts(graph,id);expect(ports.map(port=>[port.id,port.count])).toEqual([['in-read',2],['in-write',1]]);
});
it('uses semantic native labels without renaming source ids or making up data values',()=>{
 const source=fixture(),graph=projectStructure(source),node=graph.nodes.find(node=>node.data.sourceId==='name')!;
 expect(structureNodePresentation(source,node.data)).toMatchObject({label:'Full name',kindLabel:'Input',sourceId:'name',occurrence:node.data.occurrence});
 expect(structurePorts({nodes:graph.nodes,edges:[]},node.id)).toEqual([]);
 expect(groupStructureRelationships(graph,'missing')).toEqual([]);
});
