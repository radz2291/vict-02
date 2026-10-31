import assert from 'node:assert/strict';
import{readFileSync,writeFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{isDeepStrictEqual}from'node:util';
const here='docs/studio/foundation-evidence/node-suite-stress-20261031/actual-app-independent/graph3-phase';
const beforeBytes=readFileSync(here+'/baseline-r14-source.json'),afterBytes=readFileSync(here+'/saved-r15-source.json'),exportBytes=readFileSync(here+'/supported-r15-export.json');
const before=JSON.parse(beforeBytes),after=JSON.parse(afterBytes),bundle=JSON.parse(exportBytes),hash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(before.revision,'r1.r14');assert.equal(after.revision,'r1.r15');assert.equal(before.id,after.id);assert.deepEqual(bundle.uiDocuments[0].document,after);
for(const key of ['componentDefinitions','styleSources','assets','tokens','conditions','theme'])assert.deepEqual(after[key],before[key],'Unrelated registry/theme changed: '+key);
assert.deepEqual(Object.keys(after.localState),Object.keys(before.localState));
for(const key of Object.keys(before.localState))if(key!=='campaignGraph')assert.deepEqual(after.localState[key],before.localState[key],'Unrelated local state changed: '+key);
const defaults={route:'bezier',pattern:'solid',color:'#94a3b8',width:1.5,startArrow:'none',endArrow:'arrow'};
const override={route:'straight',pattern:'dash',color:'#f59e0b',width:3,startArrow:'none',endArrow:'closed'};
const graphs=[],factories=[];
function compareGraph(oldGraph,newGraph,path){
 assert.equal(oldGraph.schema,'vict.flow-graph@2');assert.equal(newGraph.schema,'vict.flow-graph@3');assert.ok(newGraph.revision>=oldGraph.revision);
 assert.deepEqual(newGraph.edgeDefaults,defaults,'Unexpected appearance defaults at '+path);
 const left=structuredClone(oldGraph),right=structuredClone(newGraph);
 delete left.schema;delete right.schema;delete left.revision;delete right.revision;delete right.edgeDefaults;
 for(const [index,edge]of right.edges.entries()){
  if(path==='state.campaignGraph'&&edge.id==='e18')assert.deepEqual(edge.appearance,override);else assert.equal(edge.appearance,undefined,'Unexpected edge override at '+path+'/'+edge.id);
  delete edge.appearance;assert.deepEqual(edge,left.edges[index],'Topology/endpoint changed');
 }
 for(const [index,type]of right.nodeTypes.entries()){
  const original=left.nodeTypes[index];assert.equal(type.id,original.id);
  for(const [key,parameter]of Object.entries(type.parameters??{}))if(!isDeepStrictEqual(parameter.default,original.parameters[key]?.default)){
   assert.equal(path,'state.campaignGraph');assert.equal(type.id,'finish');assert.equal(key,'subgraph');assert.equal(original.parameters[key].default,'');
   const factory=JSON.parse(parameter.default);assert.equal(factory.schema,'vict.flow-graph@3');assert.equal(factory.nodes.length,3);assert.equal(factory.edges.length,2);
   factories.push({family:type.id,key,sourceSha256:hash(parameter.default),graph:factory});parameter.default='<explicit intended graph3 factory>';original.parameters[key].default=parameter.default;
  }
 }
 for(const [index,node]of right.nodes.entries()){
  const original=left.nodes[index];assert.equal(node.id,original.id);
  for(const [key,value]of Object.entries(node.values))if(value!==original.values[key]&&typeof value==='string'){
   assert.equal(key,'subgraph');compareGraph(JSON.parse(original.values[key]),JSON.parse(value),path+'/node:'+node.id+'/parameter:'+key);node.values[key]='<explicit migrated occurrence>';original.values[key]=node.values[key];
  }
 }
 assert.deepEqual(right,left,'Nonappearance configuration changed at '+path);
 graphs.push({path,beforeRevision:oldGraph.revision,afterRevision:newGraph.revision,nodes:newGraph.nodes.length,edges:newGraph.edges.length,allPositionsLabelsValuesPortsAndLinksPreserved:true,sourceSha256:hash(JSON.stringify(newGraph))});
}
const oldRoot=JSON.parse(before.localState.campaignGraph.initial),newRoot=JSON.parse(after.localState.campaignGraph.initial);
assert.equal(oldRoot.revision,42);assert.equal(JSON.parse(oldRoot.nodes.find(node=>node.id==='finS').values.subgraph).revision,5);assert.equal(JSON.parse(oldRoot.nodes.find(node=>node.id==='finP').values.subgraph).revision,8);
compareGraph(oldRoot,newRoot,'state.campaignGraph');assert.equal(graphs.length,3);assert.equal(factories.length,1);
for(const id of ['ws-main','cf-vp','fin-ws','fin-vp']){assert.equal(before.nodes[id].revision,'2');assert.equal(after.nodes[id].revision,'3');assert.equal(after.nodes[id].definitionId,before.nodes[id].definitionId);}
for(const id of ['ws-main','fin-ws'])for(const name of ['content','body'])assert.deepEqual(after.nodes[id].slots[name].scope,before.nodes[id].slots[name].scope,'Existing owner declaration changed');
const ordinary=Object.values(before.nodes).filter(node=>node.kind==='element'&&['input','textarea','select','button'].includes(node.tag));
for(const node of ordinary)for(const key of ['kind','tag','attributes','interactions'])assert.deepEqual(after.nodes[node.id]?.[key],node[key],'Old ordinary control changed: '+node.id+'/'+key);
const rows=Object.values(before.nodes).filter(node=>node.kind==='component'&&node.definitionId==='vict.flow.port-row');assert.equal(rows.length,27);
for(const node of rows)for(const key of ['definitionId','revision','props'])assert.deepEqual(after.nodes[node.id]?.[key],node[key],'Port row semantics changed');
assert.equal(Object.values(after.nodes).filter(node=>node.definitionId==='vict.flow.port').length,0);
assert.equal(Object.values(after.nodes).filter(node=>node.attributes?.id!==undefined||node.attributes?.for!==undefined).length,0,'Literal HTML id/for collision risk requires review');

const fields=['route','pattern','color','width','startArrow','endArrow'],panels=[],findings=[];
function descendants(ids,result=[]){for(const id of ids){const node=after.nodes[id];assert.ok(node);result.push(node);if(node.kind==='component')for(const slot of Object.values(node.slots??{}))descendants(slot.children,result);else descendants(node.children??[],result);}return result;}
for(const node of Object.values(after.nodes).filter(node=>node.definitionId==='vict.flow.edge-settings')){
 assert.equal(node.revision,'1');const scope=node.slots.content.scope,target=node.props.target.value;
 for(const key of fields)assert.deepEqual(scope.state[key],{key,type:key==='width'?'number':'string',initial:defaults[key],controlled:true});
 assert.ok(scope.outputs.some(output=>output.name==='reset'&&output.payload==='void'));
 const content=descendants(node.slots.content.children),controls=content.filter(item=>item.kind==='element'&&['input','select'].includes(item.tag));assert.equal(controls.length,6);
 for(const control of controls){const key=control.attributes.value.path.slice(6);assert.ok(fields.includes(key));assert.deepEqual(control.attributes.value,{type:'ref',path:'state.'+key});assert.ok(control.interactions.some(action=>action.on==='change'&&action.action==='setState'&&action.key===key&&action.value.type==='ref'&&action.value.path==='state.'+key));}
 const reset=content.filter(item=>item.kind==='component'&&item.outputs?.press?.emit?.output==='reset');assert.equal(reset.length,1);
 const declaresReadOnly=scope.props.some(prop=>prop.name==='readOnly'&&prop.type==='boolean');
 const disabled=controls.every(control=>control.attributes.disabled?.type==='ref'&&control.attributes.disabled.path==='prop.readOnly')&&reset.every(button=>button.props.disabled?.type==='ref'&&button.props.disabled.path==='prop.readOnly');
 if(!declaresReadOnly||!disabled)findings.push({id:'C1',panel:node.id,target,problem:'App-owned controls/reset do not consume the public readOnly state; source guard remains separate.'});
 panels.push({id:node.id,target,controls:controls.map(control=>control.id),reset:reset[0].id,controlledStateExact:true,declaresReadOnly,allFieldsAndResetDisabled:disabled});
}
assert.equal(panels.length,4);assert.equal(panels.filter(panel=>panel.target==='canvas').length,2);assert.equal(panels.filter(panel=>panel.target==='selection').length,2);
const report={status:findings.length?'PARTIAL: migration/preservation/panel structure pass; readOnly composition correction requires disposition':'PASS: bounded actual graph3 source audit; native proof separate',baseline:{id:before.id,revision:before.revision,sha256:hash(beforeBytes),rootRevision:42,socialRevision:5,posterRevision:8},saved:{id:after.id,revision:after.revision,sha256:hash(afterBytes)},export:{sha256:hash(exportBytes),documentExact:true},graphs,factories,ordinaryControlsExact:ordinary.length,rowsPreserved:rows.length,literalHtmlIdOrFor:0,panels,findings,limits:['No native overlap, pixel appearance, readonly interaction, inheritance/reset/history or persistence replay proof.','Eight acknowledgements remain parent/agent-reported until original receipts are separately supplied.','Baseline35/37 observations are not substituted for owner-confirmed latest42/5/8.']};
writeFileSync(here+'/independent-source-audit-r15.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,graphs,panels:panels.map(({id,target,declaresReadOnly,allFieldsAndResetDisabled})=>({id,target,declaresReadOnly,allFieldsAndResetDisabled})),findings,ordinaryControls:ordinary.length}));
