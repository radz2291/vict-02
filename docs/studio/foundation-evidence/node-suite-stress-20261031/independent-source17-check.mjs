import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as equal} from 'node:util';
const root='C:/Users/RZ1/.codex/worktrees/vict-architecture-realignment-20261030',path='docs/studio/foundation-evidence/node-suite-stress-20261031';
const names=['16-export-model-saved-source.json','17-nested-finishing-saved-source.json','17-nested-finishing-supported-export.json'];
const bytes=names.map(name=>readFileSync(join(root,path,name))),[before,after,exported]=bytes.map(value=>JSON.parse(value.toString('utf8')));
const prior=JSON.parse(before.localState.campaignGraph.initial),outer=JSON.parse(after.localState.campaignGraph.initial),errors=[];
const check=(pass,label)=>{if(!pass)errors.push(label);};
check(equal(exported.uiDocuments[0].document,after),'Exact export attachment');check(prior.nodes.length===14&&outer.nodes.length===14&&outer.edges.length===20,'Outer counts');
check(equal(prior.edges,outer.edges)&&equal(prior.nodeTypes,outer.nodeTypes),'Outer topology/families');
for(const old of prior.nodes){const next=outer.nodes.find(node=>node.id===old.id);check(equal({...old,values:undefined},{...next,values:undefined}),'Outer identity/geometry '+old.id);for(const [key,value]of Object.entries(old.values))if(key!=='subgraph')check(equal(next.values[key],value),'Existing outer value '+old.id+'/'+key);}
const ws=after.nodes['ws-main'],inner=after.nodes['fin-ws'];
check(ws.props.graph.path==='state.campaignGraph'&&ws.outputs.graphChange.setState.key==='campaignGraph','Outer graph source binding');
check(ws.slots.body.scope.state.subgraph.controlled===true&&ws.slots.body.scope.state.subgraph.type==='string','Controlled parent graph declaration');
check(inner.definitionId==='vict.flow.workspace'&&inner.revision==='2'&&inner.props.graph.path==='state.subgraph'&&inner.outputs.graphChange.setState.key==='subgraph','Nested graph binding');
const graphs=['finS','finP'].map(id=>{const owner=outer.nodes.find(node=>node.id===id),graph=JSON.parse(owner.values.subgraph);check(graph.nodes.length===3&&graph.edges.length===2,'Nested count '+id);return {id,graph};});
check(equal(graphs[0].graph.nodes.map(node=>node.id),graphs[1].graph.nodes.map(node=>node.id))&&equal(graphs[0].graph.edges,graphs[1].graph.edges),'Deliberate repeated inner IDs/edges');
const bindings=[['fc-crop-sel','aspect','string'],['fc-grade-in','amount','number'],['fc-caption-in','caption','string']].map(([id,key,type])=>{
 const node=after.nodes[id],state=inner.slots.body.scope.state[key];check(state.controlled===true&&state.type===type&&node.attributes.value.path==='state.'+key&&node.interactions.some(event=>event.on==='change'&&event.action==='setState'&&event.key===key),'Inner controlled field '+id);return {id,key,type,controlled:true};
});
const roundtrip=JSON.parse(readFileSync(join(root,path,'17-exact-roundtrip-report.json'),'utf8'));
check(roundtrip.status==='PASS'&&roundtrip.input.sha256===createHash('sha256').update(bytes[2]).digest('hex')&&roundtrip.canonicalSource.sha256===createHash('sha256').update(bytes[1]).digest('hex'),'Retained roundtrip association');
const changedSourceIDs=Object.keys(before.nodes).filter(id=>!equal(before.nodes[id],after.nodes[id]));
const report={schema:'vict.actual-checkpoint-source-review@1',checkpoint:17,sourceExportReviewOnly:true,files:names.map((name,index)=>({name,sha256:createHash('sha256').update(bytes[index]).digest('hex'),bytes:bytes[index].length,characters:bytes[index].toString('utf8').length})),sourceRevisions:[before.revision,after.revision],sourceNodeCounts:[Object.keys(before.nodes).length,Object.keys(after.nodes).length],addedSourceNodes:Object.keys(after.nodes).filter(id=>!before.nodes[id]).length,changedSourceIDs,graphRevisions:[prior.revision,outer.revision],outerNodes:outer.nodes.length,outerEdges:outer.edges.length,outerGeometryAndPriorValuesPreserved:true,changedOuterParameters:['finS.subgraph','finP.subgraph'],sharedNestedWorkspace:{id:'fin-ws',definitionId:inner.definitionId,revision:inner.revision,graphBinding:inner.props.graph,graphChange:inner.outputs.graphChange},occurrences:graphs.map(({id,graph})=>({owner:id,route:[{workspaceNodeId:'ws-main',graphNodeId:id,expectedGraphRevision:outer.revision}],revision:graph.revision,nodes:graph.nodes,edges:graph.edges})),bindings,roundtripStatus:roundtrip.status,knownNativeLayoutFailure:true,nativeBehaviorVerified:false,actualSuiteVerified:false,errors,status:errors.length?'FAIL':'PASS: saved source/export ownership declarations and preservation only'};
writeFileSync(join(process.cwd(),path,'independent-source17-review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,sourceRevisions:report.sourceRevisions,sourceNodeCounts:report.sourceNodeCounts,addedSourceNodes:report.addedSourceNodes,changedSourceIDs,outerNodes:report.outerNodes,outerEdges:report.outerEdges,errors},null,2));if(errors.length)process.exitCode=1;
