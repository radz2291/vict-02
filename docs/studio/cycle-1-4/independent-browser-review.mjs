import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='C:/Users/RZ1/.codex/worktrees/studio-cycle-1-4/260831-VCT-02/docs/studio/cycle-1-4/core/browser/';
const read=name=>JSON.parse(readFileSync(root+name,'utf8'));
const fixture=JSON.parse(readFileSync('docs/studio/cycle-1-4/independent-browser-fixture.json','utf8'));
const applied=read('iv14-applied-fixture.json');
fixture.id=applied.id;fixture.revision=applied.revision;
if(JSON.stringify(fixture)!==JSON.stringify(applied))throw Error('Applied fixture differs beyond declared id/revision adaptation');
const duplicate=read('iv14-duplicated-source.json');
if(Object.keys(applied.nodes).length!==16||Object.keys(duplicate.nodes).length!==18)throw Error('Unexpected duplicate source size');
if(JSON.stringify(duplicate.nodes.left)!==JSON.stringify(applied.nodes.left))throw Error('Duplicate affected wrong group');
if(duplicate.nodes.right.children[0]!=='second'||duplicate.nodes.right.children[2]!=='copy')throw Error('Duplicate placement differs');
const cloneId=duplicate.nodes.right.children[1],clone=duplicate.nodes[cloneId];
if(clone.kind!=='element'||clone.tag!=='h2'||duplicate.nodes[clone.children[0]]?.content?.value!=='Second heading')throw Error('Wrong source duplicated');
const history=read('iv14-history-checks.json');
const equal=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
if(!equal(history.undo,applied)||!equal(history.redo,duplicate)||!equal(history.finalUndo,applied))throw Error('Raw source history differs');
const continuity=read('iv14-continuity.json'),zoom=read('iv14-zoom-continuity.json');
for(const state of [continuity.before,continuity.expanded,continuity.restored]){
  if(state.runtime!=='Runtime survives details'||state.search!=='Second'||state.graphTransform!==continuity.before.graphTransform||state.rootPadding!=='40px'||state.groupPadding!=='12px')throw Error('Context/style continuity differs');
}
if(zoom.before.graphTransform!==zoom.after.graphTransform||zoom.before.runtime!==zoom.after.runtime||zoom.before.search!==zoom.after.search)throw Error('Zoom continuity differs');
const cases=['01-initial-source','02-first-right-new-target','03-right-exposed-second','04-empty-canvas','05-native-context','06-runtime-layers-details','07-structure-details-runtime','08-keyboard-structure-menu','09-expanded-details','10-restored-details','11-small-split','12-small-expanded','13-small-restored-focus','14-medium-split','15-interact-edit-handoff','16-interact-arrange-handoff','17-nav-hit-blocked'];
const artifacts=['iv14-applied-fixture.json','iv14-duplicated-source.json','iv14-history-checks.json','iv14-continuity.json','iv14-zoom-continuity.json',...cases.flatMap(name=>['.dom.txt','.geometry.json','.png'].map(suffix=>'iv14-resume-'+name+suffix))];
const output={product:'0c3cee81fb02345f07b26e92acb2d2eb5463b203',method:'Root CUA execution of independent-specified cases; independent raw artifact/source/image review. No child-executed browser claim.',fixtureOnlyAdaptedIdRevision:true,appliedDocumentId:applied.id,duplicateExactSecond:true,clonedHeading:cloneId,rawHistoryEquality:true,runtimeSearchCameraContinuity:true,zoomContinuity:true,initialScrollEvidence:'Only zero scroll was present in these samples; nonzero challenge requested.',selectedIdentityEvidence:'Initial probe selected[] does not establish selected-ID continuity; corrected probe requested.',requiredFinding:'IV14-03: stacked canvas306px exceeds252.8px stage and intercepts Document navigation at1000x700; actual evidence reviewed, repair required.',artifacts:artifacts.filter(name=>existsSync(root+name)).map(name=>({name,sha256:createHash('sha256').update(readFileSync(root+name)).digest('hex')}))};
writeFileSync('docs/studio/cycle-1-4/independent-browser-review.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({appliedDocumentId:applied.id,fixtureOnlyAdaptedIdRevision:true,duplicateExactSecond:true,artifacts:output.artifacts.length}));
