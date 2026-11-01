import assert from 'node:assert/strict';
import {validateGraph,validateGraphV2,validateGraphV3} from '@victframework/ui-flow-svelte/model';
for(const [version,validate] of [[1,validateGraph],[2,validateGraphV2],[3,validateGraphV3]] as const){
 assert.equal(validate({schema:`vict.flow-graph@${version}`,revision:0,nodeTypes:[],nodes:[],edges:[]}).ok,true);
}
assert.equal(typeof document,'undefined');
console.log(JSON.stringify({status:'PASS',versions:[1,2,3],browserDocumentPresent:false}));
