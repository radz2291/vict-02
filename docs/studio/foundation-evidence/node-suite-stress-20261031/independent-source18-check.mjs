import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as equal} from 'node:util';
import {Window} from 'happy-dom';
const root='C:/Users/RZ1/.codex/worktrees/vict-architecture-realignment-20261030',directory='docs/studio/foundation-evidence/node-suite-stress-20261031';
const names=['17-nested-finishing-saved-source.json','18-layout-repaired-saved-source.json','18-layout-repaired-supported-export.json'];
const bytes=names.map(name=>readFileSync(join(root,directory,name))),[before,after,exported]=bytes.map(value=>JSON.parse(value.toString('utf8')));
const old=JSON.parse(before.localState.campaignGraph.initial),outer=JSON.parse(after.localState.campaignGraph.initial),errors=[];
const check=(pass,label)=>{if(!pass)errors.push(label);};
const stripCapacity=types=>types.map(type=>({...type,ports:type.ports.map(({maxConnections,...port})=>port)}));
check(equal(after,exported.uiDocuments[0].document),'Export exact attachment');check(outer.nodes.length===14&&outer.edges.length===20,'Outer counts');check(equal(old.edges,outer.edges),'Outer edges');check(equal(stripCapacity(old.nodeTypes),stripCapacity(outer.nodeTypes)),'Noncapacity family metadata');
const positionChanges=[];
for(const node of outer.nodes){const previous=old.nodes.find(item=>item.id===node.id);if(!equal(previous.position,node.position))positionChanges.push({id:node.id,before:previous.position,after:node.position});for(const [key,value]of Object.entries(previous.values))if(key!=='subgraph')check(equal(node.values[key],value),'Outer value '+node.id+'/'+key);}
const nested=outer.nodes.filter(node=>node.type==='finish').map(node=>{
 const previous=JSON.parse(old.nodes.find(item=>item.id===node.id).values.subgraph),graph=JSON.parse(node.values.subgraph);
 check(equal(graph.nodes,previous.nodes)&&equal(graph.edges,previous.edges),'Nested nodes/values/positions/links '+node.id);
 check(equal(stripCapacity(graph.nodeTypes),stripCapacity(previous.nodeTypes)),'Nested noncapacity metadata '+node.id);
 return {owner:node.id,revisions:[previous.revision,graph.revision],nodes:graph.nodes.length,edges:graph.edges.length,valuesAndGeometryPreserved:true,graph};
});
const capacities=[{owner:'outer',graph:outer},...nested].map(({owner,graph})=>{
 const inputs=graph.nodeTypes.flatMap(type=>type.ports.filter(port=>port.direction==='input').map(port=>({family:type.id,...port})));
 check(inputs.every(port=>port.maxConnections===1),'Input capacity declaration '+owner);
 const violations=[];for(const node of graph.nodes){const type=graph.nodeTypes.find(type=>type.id===node.type);for(const port of type.ports){const count=graph.edges.filter(edge=>port.direction==='input'?edge.target===node.id&&edge.targetPort===port.id:edge.source===node.id&&edge.sourcePort===port.id).length;if(port.maxConnections!==undefined&&count>port.maxConnections)violations.push({node:node.id,port:port.id,count});}}
 check(!violations.length,'Existing over-capacity edge '+owner);return {owner,inputDeclarations:inputs,violations};
});
const labels=Object.values(after.nodes).filter(node=>node.tag==='label').map(node=>({id:node.id,for:node.attributes?.for,children:node.children}));
const window=new Window();window.document.body.innerHTML='<label for="duplicate"><input type="checkbox" id="duplicate">First</label><label for="duplicate"><input type="checkbox" id="duplicate">Second</label>';
const syntheticLabels=window.document.querySelectorAll('label'),controls=window.document.querySelectorAll('input');
const explicitForTargetsFirst=syntheticLabels[1].control===controls[0];syntheticLabels[1].removeAttribute('for');const implicitTargetsContained=syntheticLabels[1].control===controls[1];
const style=(id,key)=>after.nodes[id]?.localStyle?.find(item=>item.property===key)?.value?.value;
const report={schema:'vict.actual-checkpoint-source-review@1',checkpoint:18,sourceExportReviewOnly:true,files:names.map((name,index)=>({name,sha256:createHash('sha256').update(bytes[index]).digest('hex'),characters:bytes[index].toString('utf8').length})),revisions:[before.revision,after.revision],sourceNodeCounts:[Object.keys(before.nodes).length,Object.keys(after.nodes).length],graphRevisions:[old.revision,outer.revision],outerNodes:14,outerEdges:20,positionChanges,nested:nested.map(({graph,...summary})=>summary),capacities,labels,syntheticLabelAssociation:{explicitForTargetsFirst,implicitTargetsContained,nativeBrowserProof:false},repeatedLiteralIDs:[{id:'c-help-p',occurrences:['pos','neg']},{id:'c-help-d',occurrences:['soc','pst']}],layout:{finWorkspaceWidth:style('fin-ws','width'),finViewportHeight:after.nodes['fin-vp'].props.height.value,finFieldWidth:style('bf-fin','width'),finCardRootWidth:style('br-fin','width'),innerCardWidths:['fc-crop','fc-grade','fc-caption'].map(id=>({id,width:style(id,'width')})),nonoverlapVerified:false},findings:[{code:'SOURCE18_DUPLICATE_EXPLICIT_LABEL_FOR',severity:'medium',status:'OPEN pending native second-occurrence label click',message:'Repeated prompt/draft bodies render duplicate literal IDs with explicit for; contained wrapping does not make that explicit association occurrence-local.'},{code:'SOURCE18_PAINT_BOUNDS_REQUIRE_NATIVE_CHECK',severity:'qualification',status:'OPEN',message:'Finishing card root width300px differs from760px fields; source positions alone cannot prove painted nonoverlap.'}],nativeBehaviorVerified:false,actualSuiteVerified:false,errors,status:errors.length?'FAIL':'QUALIFIED: preservation/capacity PASS; label association OPEN'};
writeFileSync(join(process.cwd(),directory,'independent-source18-review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,errors,positionChanges:positionChanges.map(item=>item.id),capacities:capacities.map(item=>({owner:item.owner,inputs:item.inputDeclarations.length,violations:item.violations.length})),syntheticLabelAssociation:report.syntheticLabelAssociation},null,2));if(errors.length)process.exitCode=1;
