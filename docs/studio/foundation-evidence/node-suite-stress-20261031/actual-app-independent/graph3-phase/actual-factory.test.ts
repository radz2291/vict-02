import {expect,it} from 'vitest';
import{readFileSync,writeFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{resolve}from'node:path';
import{parseGraphV3,applyGraphOperationsV3}from'@victframework/ui-flow-svelte';
import source from './actual-r15-source.json';

it('adds a Finishing only to an offline actual-graph copy and inherits the explicit valid graph3 factory',()=>{
 const original=JSON.stringify(source),raw=source.localState.campaignGraph.initial;
 const parsed=parseGraphV3(raw);expect(parsed.ok,JSON.stringify(parsed)).toBe(true);if(!parsed.ok)throw Error('Actual outer graph invalid');
 const family=parsed.graph.nodeTypes.find(type=>type.id==='finish')!;
 const rawFactory=family.parameters.subgraph.default as string,factory=parseGraphV3(rawFactory);expect(factory.ok,JSON.stringify(factory)).toBe(true);if(!factory.ok)throw Error('Actual factory invalid');
 const before=JSON.stringify(parsed.graph);
 const result=applyGraphOperationsV3(parsed.graph,[{type:'addNode',nodeType:'finish',id:'independent-future-finishing',position:{x:3000,y:1000}}],parsed.graph.revision);
 expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error('Public addNode refused');
 expect(JSON.stringify(parsed.graph)).toBe(before);expect(JSON.stringify(source)).toBe(original);
 const added=result.graph.nodes.find(node=>node.id==='independent-future-finishing')!;expect(added.values).toEqual({});
 const nextFamily=result.graph.nodeTypes.find(type=>type.id===added.type)!;
 const inherited=(added.values.subgraph??nextFamily.parameters.subgraph.default) as string;expect(inherited).toBe(rawFactory);
 const next=parseGraphV3(inherited);expect(next.ok,JSON.stringify(next)).toBe(true);if(!next.ok)throw Error('Inherited factory invalid');
 expect(next.graph).toEqual(factory.graph);expect(next.graph.nodes.map(node=>node.type)).toEqual(['crop','grade','caption']);
 expect(next.graph.nodes.map(node=>node.values)).toEqual([{aspect:'1:1'},{amount:20},{caption:''}]);
 expect(next.graph.edges.map(edge=>[edge.id,edge.source,edge.sourcePort,edge.target,edge.targetPort])).toEqual([['g1','f-crop','o','f-grade','i'],['g2','f-grade','o','f-caption','i']]);
 expect(result.graph.nodes.filter(node=>node.id!==added.id)).toEqual(parsed.graph.nodes);expect(result.graph.edges).toEqual(parsed.graph.edges);
 const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
 const report={status:'PASS',scope:'Offline copied actual graph through installed public afa8 packages; not native Add, Studio/history/persistence or owner acceptance.',actualSourceSha256:hash(readFileSync(resolve('src/actual-r15-source.json'),'utf8')),actualOuterGraphSha256:hash(raw),actualFactorySha256:hash(rawFactory),originalSourceUnchanged:true,originalGraphUnchanged:true,originalNodesLinksPreserved:true,addedId:added.id,addedValues:added.values,inheritedFactorySchema:next.graph.schema,inheritedFactoryRevision:next.graph.revision,inheritedNodes:next.graph.nodes,inheritedEdges:next.graph.edges};
 writeFileSync(resolve('src/actual-factory-report.json'),JSON.stringify(report,null,2)+'\n');
});
