import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const base='docs/studio/foundation-evidence/node-suite-stress-20261031',here=base+'/actual-app-independent/port-phase';
const before=JSON.parse(readFileSync(base+'/28-activated-exact-source.json','utf8')),afterBytes=readFileSync(here+'/saved-source.json'),after=JSON.parse(afterBytes),bundleBytes=readFileSync(here+'/supported-export.json'),bundle=JSON.parse(bundleBytes),conversationBytes=gunzipSync(readFileSync(here+'/completed-conversation.txt.gz')),text=conversationBytes.toString('utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
const beforeSaveBytes=readFileSync(here+'/before-save-source.json'),beforeSave=JSON.parse(beforeSaveBytes);
assert.deepEqual({...beforeSave,revision:after.revision},after,'Save changed source beyond document revision');
assert.deepEqual(bundle.uiDocuments[0].document,after,'Supported export does not contain exact saved source');
assert.equal(after.revision,'r1.r13');
const controls=Object.values(before.nodes).filter(node=>node.kind==='element'&&['input','textarea','select','button'].includes(node.tag));
for(const original of controls){
 const current=after.nodes[original.id];assert.ok(current,'A baseline ordinary control was removed: '+original.id);
 for(const field of ['kind','tag','attributes','interactions'])assert.deepEqual(current[field],original[field],`Ordinary control ${original.id}/${field} changed`);
}
const scoped=[];
for(const node of Object.values(before.nodes))if(node.kind==='component')for(const [name,slot] of Object.entries(node.slots??{}))if(slot.scope){assert.deepEqual(after.nodes[node.id]?.slots?.[name]?.scope,slot.scope,'Controlled/private scope changed: '+node.id+'/'+name);scoped.push(node.id+'/'+name);}
const records=[];
for(const match of text.matchAll(/Result\s+(?=\{)/g)){
 const start=text.indexOf('{',match.index+match[0].length);let depth=0,quoted=false,escape=false;
 for(let i=start;i<text.length;i++){
  const c=text[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;}
  else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{records.push(JSON.parse(text.slice(start,i+1)));}catch{}break;}
 }
}
const acknowledgements=records.filter(value=>value.ok===true&&Number.isInteger(value.applied)&&value.applied>0&&/^r1\.r12#[1-4]$/.test(value.revision));
assert.deepEqual(acknowledgements.map(value=>value.revision),['r1.r12#1','r1.r12#2','r1.r12#3','r1.r12#4']);
const breakouts=Object.values(after.nodes).flatMap(node=>(node.localStyle??[]).filter(item=>item.property.startsWith('margin')&&item.value?.type==='text'&&/-(?:\d|\.)/.test(item.value.value)).map(item=>({nodeId:node.id,property:item.property,value:item.value.value})));
const comparison=JSON.parse(readFileSync(here+'/independent-source-comparison.json'));
const typeColors={};let renderedAnchors=0;
for(const occurrence of comparison.occurrences){
 const path=occurrence.graphPath.split('/');let graph=JSON.parse(after.localState[path.shift().slice(6)].initial);
 while(path.length){const nodeId=path.shift().slice(5),key=path.shift().slice(10),member=graph.nodes.find(node=>node.id===nodeId),family=graph.nodeTypes.find(item=>item.id===member.type);graph=JSON.parse(member.values[key]??family.parameters[key].default);}
 const family=graph.nodeTypes.find(item=>item.id===occurrence.family);
 for(const anchor of occurrence.anchors){const row=after.nodes[anchor.sourceNodeId],port=family.ports.find(item=>item.id===anchor.portId);assert.notEqual(row.props.showType?.value,false,'A row explicitly hides its type');assert.ok(row.props.color===undefined||row.props.color.type==='literal','Dynamic color needs additional evaluation');(typeColors[port.type]??=new Set()).add(row.props.color?.value??'token:accent');renderedAnchors++;}
}
for(const [type,colors] of Object.entries(typeColors))assert.equal(colors.size,1,'Semantic type has inconsistent colors: '+type);
const report={status:'PASS: actual acknowledged port transactions, exact saved/export source, ordinary bindings and scope declarations preserved; native behavior/layout not awarded',turn:'e3ec3c90-25ba-4a3f-b2f2-2720c73cbe7c',beforeSave:{revision:beforeSave.revision,sha256:hash(beforeSaveBytes),onlySavedRevisionChanged:true},savedSource:{id:after.id,revision:after.revision,bytes:afterBytes.length,sha256:hash(afterBytes)},supportedExport:{bytes:bundleBytes.length,sha256:hash(bundleBytes),documentExact:true},conversation:{bytes:conversationBytes.length,sha256:hash(conversationBytes),completeResultObjects:records.length,limit:'Rendered public conversation is not a complete raw original archive; incomplete trailing observation JSON is not reconstructed or counted.'},acknowledgements:acknowledgements.map(value=>({ok:value.ok,applied:value.applied,revision:value.revision,digest:value.digest,verification:value.verification,turnProgress:value.turnProgress})),ordinaryControlsUnchanged:controls.map(node=>node.id),scopeDeclarationsUnchanged:scoped,negativeMarginPresentation:breakouts,renderedAnchors,semanticTypeColors:Object.fromEntries(Object.entries(typeColors).map(([key,values])=>[key,[...values]])),limits:['Negative margin source declarations do not prove native card-boundary socket positions or hit targets.','Image/final model prose remains model interpretation; no pointer/interaction proof inferred.','No migration, history/reload/import/public artifact or whole-phase/owner acceptance verdict.']};
writeFileSync(here+'/independent-receipts-controls.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,acks:acknowledgements.length,ordinaryControls:controls.length,scopes:scoped,negativeMarginDeclarations:breakouts.length,sourceSha256:report.savedSource.sha256,exportSha256:report.supportedExport.sha256}));
