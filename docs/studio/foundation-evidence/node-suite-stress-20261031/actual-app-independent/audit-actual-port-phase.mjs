import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const [mode,beforePath,afterPath,outputPath]=process.argv.slice(2);
assert.ok(['baseline','ports'].includes(mode),'Choose baseline or ports; no migration verdict is implemented.');
assert.ok(beforePath&&afterPath&&outputPath,'Explicit before/after/output paths required.');
const hash=value=>createHash('sha256').update(value).digest('hex');
const beforeBytes=readFileSync(beforePath),afterBytes=readFileSync(afterPath);
const before=JSON.parse(beforeBytes),after=JSON.parse(afterBytes);
assert.equal(before.id,after.id,'Application identity changed');
assert.deepEqual(before.localState,after.localState,'Port-only phase changed canonical localState (including graph source strings)');
if(mode==='baseline')assert.deepEqual(before,after,'Activated document differs from exact saved baseline');

function graphSources(document){
 const result=[];
 const workspaces=Object.values(document.nodes).filter(node=>node.kind==='component'&&node.definitionId==='vict.flow.workspace');
 function collect(raw,path,workspace,depth=0){
  assert.ok(depth<=32,'Diagnostic graph nesting exceeds inspected scope');
  let graph;try{graph=JSON.parse(raw);}catch{return;}
  if(!['vict.flow-graph@2','vict.flow-graph@3'].includes(graph?.schema))return;
  result.push({path,workspace:workspace?.id,sourceSha256:hash(raw),graph});
  for(const member of graph.nodes){
   const family=graph.nodeTypes.find(type=>type.id===member.type);assert.ok(family,'Unknown family');
   for(const [key,declaration] of Object.entries(family.parameters??{}))if(declaration.type==='string'){
    const nested=workspaces.filter(node=>node.props?.graph?.type==='ref'&&node.props.graph.path===`state.${key}`);
    const value=member.values[key]??declaration.default;
    if(typeof value==='string')collect(value,`${path}/node:${member.id}/parameter:${key}`,nested.length===1?nested[0]:undefined,depth+1);
   }
  }
 }
 for(const workspace of workspaces){
  const binding=workspace.props?.graph;
  if(binding?.type!=='ref'||!binding.path.startsWith('state.'))continue;
  const key=binding.path.slice(6),declaration=document.localState[key];
  if(declaration?.type==='string')collect(declaration.initial,`state:${key}`,workspace);
 }
 return result;
}
const originals=graphSources(before),current=graphSources(after);
assert.deepEqual(current.map(({path,sourceSha256,graph})=>({path,sourceSha256,graph})),originals.map(({path,sourceSha256,graph})=>({path,sourceSha256,graph})),'Graph strings/revisions/topology/values changed');

function expression(value,context){
 if(value?.type==='literal')return value.value;
 if(value?.type==='ref'){
  const [namespace,...keys]=value.path.split('.');let result=context[namespace];
  for(const key of keys)result=result?.[key];return result;
 }
 if(value?.type==='compare'&&value.op==='eq')return expression(value.left,context)===expression(value.right,context);
 throw Error('Unresolved diagnostic expression: '+JSON.stringify(value));
}
function anchors(document,workspace,graph,member){
 const fill=workspace.slots?.body;assert.ok(fill?.scope,'Workspace body lacks explicit scope');
 const family=graph.nodeTypes.find(type=>type.id===member.type),state={};
 for(const [key,declaration] of Object.entries(fill.scope.state??{}))state[key]=declaration.controlled?(member.values[key]??family.parameters[key]?.default??declaration.initial):declaration.initial;
 const context={prop:{nodeType:member.type,nodeId:member.id,label:member.label,graphRevision:graph.revision,selected:false,readOnly:false},state};
 const found=[];
 function visit(id,active=[]){
  assert.ok(!active.includes(id),'Diagnostic source cycle');const node=document.nodes[id];assert.ok(node,'Missing source node '+id);
  if(node.kind==='component'){
   if(['vict.flow.port','vict.flow.port-row'].includes(node.definitionId)){
    found.push({sourceNodeId:id,definition:node.definitionId,revision:node.revision,portId:expression(node.props?.id,context)});
   }
   // Another workspace establishes a different semantic graph/body owner.
   if(node.definitionId==='vict.flow.workspace')return;
   const definition=document.componentDefinitions[node.definitionId];if(definition)visit(definition.root,[...active,id]);
   for(const slot of Object.values(node.slots??{}))for(const child of slot.children)visit(child,[...active,id]);return;
  }
  if(node.kind==='conditional'){
   for(const branch of node.branches){if(branch.when===undefined||expression(fill.scope.conditions?.[branch.when]??document.conditions[branch.when],context)){for(const child of branch.children)visit(child,[...active,id]);break;}}return;
  }
  assert.ok(node.kind!=='repeat','Repeat requires additional occurrence evaluation; diagnostic refuses to guess.');
  for(const child of node.children??node.fallback??[])visit(child,[...active,id]);
 }
 for(const child of fill.children)visit(child);
 const expected=(family.ports??[]).map(port=>port.id).sort(),actual=found.map(port=>port.portId).sort();
 assert.deepEqual(actual,expected,`Missing/extra/duplicate semantic anchors in ${workspace.id}/${member.id}`);
 return found;
}
const occurrences=[];
for(const item of current){
 const workspace=after.nodes[item.workspace];assert.ok(workspace,`Ambiguous source workspace for ${item.path}`);
 for(const member of item.graph.nodes){const found=anchors(after,workspace,item.graph,member);occurrences.push({graphPath:item.path,workspace:workspace.id,nodeId:member.id,family:member.type,anchors:found});}
}
const rows=Object.values(after.nodes).filter(node=>node.kind==='component'&&node.definitionId==='vict.flow.port-row');
const bare=Object.values(after.nodes).filter(node=>node.kind==='component'&&node.definitionId==='vict.flow.port');
if(mode==='ports'){
 assert.ok(rows.length>0,'Actual port-row phase has no source rows');assert.equal(bare.length,0,'Bare anchors remain alongside requested row-only composition');
 for(const row of rows)assert.equal(row.revision,'1','Port row is not exact public revision1');
 for(const occurrence of occurrences)for(const anchor of occurrence.anchors)assert.equal(anchor.definition,'vict.flow.port-row','A rendered graph occurrence still uses a bare anchor');
}
const report={mode,status:mode==='baseline'?'PASS: saved/activated baseline and semantic anchor inventory only; port/migration gates NOT awarded':'PASS: exact port-only source preservation and declared semantic anchor coverage; native layout NOT awarded',before:{path:beforePath,fileSha256:hash(beforeBytes),id:before.id,revision:before.revision},after:{path:afterPath,fileSha256:hash(afterBytes),id:after.id,revision:after.revision},documentSemanticExact:isDeepStrictEqual(before,after),localStateExact:true,rawGraphStringsExact:true,graphs:current.map(item=>({path:item.path,workspace:item.workspace,sourceSha256:item.sourceSha256,schema:item.graph.schema,revision:item.graph.revision,nodes:item.graph.nodes.length,edges:item.graph.edges.length,families:item.graph.nodeTypes.length})),sourceRows:rows.length,sourceBareAnchors:bare.length,occurrences,limits:['Diagnostic static evaluation of this exact source and its current initial/controlled values; not actual runtime or native endpoint geometry.','Conditional expressions outside the evaluated finite subset and repeat occurrences refuse diagnostic coverage rather than guessing.','No migration/graph3 appearance/history/save/export/public artifact or owner acceptance verdict.']};
writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,graphs:report.graphs,sourceRows:rows.length,sourceBareAnchors:bare.length,occurrences:occurrences.length}));
