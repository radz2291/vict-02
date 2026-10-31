import assert from'node:assert/strict';
import{readFileSync,writeFileSync}from'node:fs';
import{createHash}from'node:crypto';
const base='docs/studio/foundation-evidence/node-suite-stress-20261031/actual-app-independent',here=base+'/final-r17';
const read=path=>JSON.parse(readFileSync(path));
const old=read(base+'/graph3-phase/saved-r15-source.json'),layout=read(here+'/layout-corrected-source.json'),after=read(here+'/saved-source.json'),bundle=read(here+'/supported-export.json');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
assert.deepEqual(bundle.uiDocuments[0].document,after);assert.equal(after.revision,'r1.r17');
const expectedLayout=structuredClone(old),graph=JSON.parse(expectedLayout.localState.campaignGraph.initial);
assert.equal(graph.revision,48);const neg=graph.nodes.find(node=>node.id==='neg');assert.equal(neg.position.x,446.83595102709694);
neg.position.x=378.5910038381814;graph.revision=49;
assert.deepEqual(JSON.parse(layout.localState.campaignGraph.initial),graph,'Native layout correction changed more than exact Negative x and root revision');
expectedLayout.localState.campaignGraph.initial=layout.localState.campaignGraph.initial;expectedLayout.revision=layout.revision;
assert.deepEqual(layout,expectedLayout,'Unrelated UI/source change accompanied layout correction');
assert.deepEqual(after.localState,layout.localState,'Actual UI repair changed any graph/source data');
const expected=structuredClone(layout);expected.revision=after.revision;
const fields=['route','pattern','color','width','sa','ea'];
for(const [panel,prefix]of [['es-canvas-o','oc'],['es-canvas-n','fc']]){
 assert.deepEqual(expected.nodes[panel].slots.content.scope.props,[]);
 expected.nodes[panel].slots.content.scope.props=[{name:'readOnly',type:'boolean'}];
 for(const field of fields)expected.nodes[prefix+'-'+field].attributes.disabled={type:'ref',path:'prop.readOnly'};
 expected.nodes[prefix+'-reset'].props.disabled={type:'ref',path:'prop.readOnly'};
}
const border=expected.theme.roles.border;assert.equal(border,'#2b3b52');
const display={type:'conditionalValue',when:{type:'compare',op:'eq',left:{type:'ref',path:'state.color'},right:{type:'literal',value:'token:border'}},then:{type:'literal',value:border},otherwise:{type:'ref',path:'state.color'}};
for(const prefix of ['oc','sc','fc','fs'])expected.nodes[prefix+'-color'].attributes.value=display;
assert.deepEqual(after,expected,'Actual final UI changed more than C1 and four display-only color bindings');
const panels=Object.values(after.nodes).filter(node=>node.definitionId==='vict.flow.edge-settings');
assert.equal(panels.length,4);
for(const panel of panels){assert.ok(panel.slots.content.scope.props.some(prop=>prop.name==='readOnly'&&prop.type==='boolean'));}
const htmlIds=Object.values(after.nodes).filter(node=>node.attributes?.id!==undefined||node.attributes?.for!==undefined);assert.equal(htmlIds.length,0);
const report={status:'PASS: exact authorized layout delta, C1 readOnly repair and token display binding only; native behavior separate',id:after.id,revision:after.revision,savedSourceSha256:hash(here+'/saved-source.json'),exportSha256:hash(here+'/supported-export.json'),exportDocumentExact:true,graphDataExactAfterUiRepair:true,rootRevision:49,socialRevision:JSON.parse(graph.nodes.find(node=>node.id==='finS').values.subgraph).revision,posterRevision:JSON.parse(graph.nodes.find(node=>node.id==='finP').values.subgraph).revision,authorizedLayoutDelta:{nodeId:'neg',xBefore:446.83595102709694,xAfter:378.5910038381814,yPreserved:true,rootBefore:48,rootAfter:49,allOtherGraphFieldsExact:true},c1Resolved:{canvasScopes:2,disabledFields:12,disabledResetButtons:2,allFourPanelsConsumeReadOnly:true},colorDisplay:{fields:4,canonicalToken:'token:border',currentThemeBorder:border,displayOnly:true,canonicalResetSemanticsUnchanged:true,otherHexColorsPassThrough:true,arbitraryTokenDisplay:'Not claimed by this current-theme mapping.'},literalHtmlIdOrFor:0,sourceChangesOtherwiseExact:true,limits:['Native Reset/choice/readonly/focus/history/persistence and pointer behavior need separate receipts.','Public EdgeSettings duplicate native-event history and nested connect/drag defects remain separate runtime repair gates.']};
writeFileSync(here+'/independent-final-source.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
