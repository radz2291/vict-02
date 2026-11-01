/** Reads captured actual source/export files only; no browser or source mutations. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const root=process.cwd(),folder=join(root,'docs/studio/foundation-evidence/structure-shared-completion-20261101');
const read=name=>JSON.parse(readFileSync(join(folder,name),'utf8')),hash=name=>createHash('sha256').update(readFileSync(join(folder,name))).digest('hex');
const unsaved=read('06-agent-adopted-unsaved-source.json'),saved=read('07-saved-r18-source.json'),exported=read('07-supported-export.json'),moved=read('08-structure-moved-source.json'),undo=read('08-structure-one-undo-source.json');
const prior=JSON.parse(readFileSync(join(root,'docs/studio/foundation-evidence/node-suite-stress-20261031/37-final-supported-export.json'),'utf8'));
function differences(before,after,path=[],out=[],descendArrays=false){if(isDeepStrictEqual(before,after))return out;if(before&&after&&typeof before==='object'&&typeof after==='object'&&Array.isArray(before)===Array.isArray(after)&&(descendArrays||!Array.isArray(before)))for(const key of new Set([...Object.keys(before),...Object.keys(after)]))differences(before[key],after[key],[...path,key],out,descendArrays);else out.push({path,before,after});return out;}
const errors=[],check=(condition,label)=>{if(!condition)errors.push(label);};
check(saved.revision==='r1.r18'&&isDeepStrictEqual({...saved,revision:unsaved.revision},unsaved),'Save changed source beyond its normal revision');
check(exported.uiDocuments?.length===1&&isDeepStrictEqual(exported.uiDocuments[0].document,saved),'Supported export document differs from saved source');
check(isDeepStrictEqual(exported.mediaArchive,prior.mediaArchive),'Media attachment changed');
const applicationDiffs=differences(prior.application,exported.application,[],[],true);
check(applicationDiffs.length===1&&JSON.stringify(applicationDiffs[0].path)===JSON.stringify(['screens','0','uiDocument','revision'])&&applicationDiffs[0].before==='r1.r17'&&applicationDiffs[0].after==='r1.r18','Application definition changed beyond normal UI revision reference');
const movedDiffs=differences(saved,moved),paths=movedDiffs.map(diff=>JSON.stringify(diff.path)).sort();
check(JSON.stringify(paths)===JSON.stringify([['nodes','screen','children'],['nodes','cf-header','children']].map(path=>JSON.stringify(path)).sort()),'Structure move changed unrelated source');
check(isDeepStrictEqual(moved.nodes.screen.children,['cf-header','ws-main','cf-title'])&&isDeepStrictEqual(moved.nodes['cf-header'].children,['cf-sub','cf-meta']),'Structure move does not match intended source reparent');
check(isDeepStrictEqual(undo,saved),'Single shared Undo did not restore exact saved source');
const report={schema:'vict.independent-actual-save-and-structure-move@1',status:errors.length?'FAIL':'PASS',sourceCandidate:'3dfdde4ecb5567bc03130426482076d5344e3530',savedRevision:saved.revision,savedEqualsActualAgentSourceExceptNormalRevision:true,exportDocumentExactlySaved:true,applicationDiffs,mediaArchiveExactlyPrior:true,movedDiffs,oneUndoExactlySaved:true,files:Object.fromEntries(['06-agent-adopted-unsaved-source.json','07-saved-r18-source.json','07-supported-export.json','08-structure-moved-source.json','08-structure-one-undo-source.json'].map(name=>[name,hash(name)])),errors,scope:'Independent source recomputation associates integrator-captured native Structure move and Undo with exact saved source. It does not independently perform the native action or claim full reload until a separate reopen source receipt is reviewed.'};
writeFileSync(join(folder,'independent-actual-save-and-structure-move.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
