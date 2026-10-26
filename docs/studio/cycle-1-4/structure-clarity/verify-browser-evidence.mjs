import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=name=>JSON.parse(readFileSync(new URL(`${name}.json`,import.meta.url),'utf8'));
const results=[];
function check(name,test){test();results.push({name,pass:true});}
check('group expansion and collapse',()=>{
  assert.equal(read('final-owner-default').nodes.length,2);
  assert.equal(read('final-owner-expanded').nodes.length,17);
  assert.equal(read('final-owner-collapsed').nodes.length,2);
});
check('inspection keeps scope; explicit focus changes it',()=>{
  assert.equal(read('inspect-without-refocus').scope,'Focus: Screen');
  assert.equal(read('inspect-without-refocus').nodes.length,17);
  assert.equal(read('explicit-input-focus').scope,'Focus: Full name');
  assert.equal(read('explicit-input-focus').nodes.length,3);
});
check('binding visibility',()=>{
  assert.equal(read('bindings-off').nodes.length,2);assert.equal(read('bindings-off').edges.length,1);
  assert.equal(read('bindings-on').nodes.length,3);assert.equal(read('bindings-on').edges.length,4);
});
check('camera-only framing and stable zoom',()=>{
  const before=read('bindings-on'),after=read('menu-frame-camera-only');
  assert.deepEqual(before.nodes.map(n=>[n.id,n.world]),after.nodes.map(n=>[n.id,n.world]));
  assert.deepEqual(before.edges,after.edges);assert.equal(read('zoom-regression').unchanged,true);
});
check('semantic search',()=>assert.equal(read('final-owner-semantic-search').nodes.length,3));
check('bounded large-state paging',()=>{
  const first=read('large-state-first-batch'),second=read('large-state-second-batch');
  assert.equal(first.count,'25 of 141 items');assert.equal(second.count,'49 of 141 items');
  assert(first.nodes.every(n=>second.nodes.some(next=>next.id===n.id)));
});
check('other users are opt-in and reversible',()=>{
  assert.equal(read('large-field-direct').nodes.length,3);
  assert.equal(read('large-field-other-users').count,'25 of 142 items');
  assert.equal(read('large-field-other-users-hidden').nodes.length,3);
});
check('declared behaviour and definition visibility',()=>{
  assert(read('conditional-relationships').selection.includes('Shown when Agreement is on'));
  assert(read('conditional-relationships').selection.includes('Otherwise'));
  assert(read('repeat-overview').selection.includes('One template for each item in Items'));
  assert(read('slot-overview').selection.includes('used when no content is supplied'));
  assert.equal(read('component-definitions-off').nodes.length,2);assert.equal(read('component-definitions-restored').nodes.length,3);
});
check('authored styles and saved owner state',()=>{
  const styles=read('authored-style-comparison');assert.equal(styles.equal,true);assert.equal(styles.before.length,8);
  assert.equal(read('final-owner-review').saved,'✓ Saved');
});
for(const name of ['explicit-input-focus','bindings-off','bindings-on','large-state-first-batch','large-state-second-batch','large-field-other-users','conditional-focus','component-definitions-restored']){
  check(`edge endpoint closure: ${name}`,()=>{const snapshot=read(name),ids=new Set(snapshot.nodes.map(n=>n.id));for(const edge of snapshot.edges){const [source,target]=JSON.parse(decodeURIComponent(edge.id));assert(ids.has(source)&&ids.has(target));}});
}
const report={kind:'Assertions over saved CUA observations; not independent live-browser verification',product:'f161cc0e31c703d817cd08ab7afbac9820303cb4',results};
writeFileSync(new URL('browser-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:results.length,product:report.product}));
