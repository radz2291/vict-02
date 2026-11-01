/** Read-only actual-source review. No source rewriting or migration is performed. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {join} from 'node:path';
const folder=join(process.cwd(),'docs/studio/foundation-evidence/structure-shared-completion-20261101');
const beforePath=join(folder,'01-before-source.json'),afterPath=join(folder,'06-agent-adopted-unsaved-source.json');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const before=JSON.parse(readFileSync(beforePath,'utf8')),after=JSON.parse(readFileSync(afterPath,'utf8'));
const row=node=>node?.kind==='component'&&node.definitionId==='vict.flow.port-row';
const column=node=>node?.kind==='component'&&node.definitionId==='vict.flow.port-columns';
function lists(node){
 if(['element','portal'].includes(node?.kind))return [['children',node.children]];
 if(node?.kind==='component')return Object.entries(node.slots??{}).map(([key,slot])=>[`slots/${key}`,slot.children??[]]);
 if(node?.kind==='conditional')return node.branches.map((branch,index)=>[`branches/${index}`,branch.children]);
 if(node?.kind==='repeat')return [['templateRoot',[node.templateRoot]]];
 if(node?.kind==='slot')return [['fallback',node.fallback??[]]];return [];
}
function index(document){const result=new Map();for(const node of Object.values(document.nodes))for(const [slot,children] of lists(node))for(const [i,id] of children.entries()){const owners=result.get(id)??[];owners.push({id:node.id,slot,preceding:children.slice(0,i)});result.set(id,owners);}return result;}
function layoutOnly(node){
 if(node.interactions?.length)return false;
 if(node.kind==='component'&&(Object.keys(node.props??{}).length||Object.keys(node.outputs??{}).length||Object.values(node.slots??{}).some(slot=>slot.scope)))return false;
 if(node.kind==='element'&&Object.entries(node.attributes??{}).some(([name,value])=>/^on/i.test(name)||(value&&typeof value==='object')))return false;return true;
}
function presentation(document){const result=new Set(),active=new Set();const visit=id=>{if(result.has(id))return true;if(active.has(id))return false;const node=document.nodes[id];if(!node)return false;if(row(node)){result.add(id);return true;}if(!(column(node)||(node.kind==='element'&&node.tag==='div'))||!layoutOnly(node))return false;const children=lists(node).flatMap(([,ids])=>ids);if(!children.length&&!column(node))return false;active.add(id);const answer=children.every(visit);active.delete(id);if(answer)result.add(id);return answer;};for(const id of Object.keys(document.nodes))visit(id);return result;}
const beforeParents=index(before),afterParents=index(after),beforePresentation=presentation(before),afterPresentation=presentation(after);
function anchor(id,parents,presentation){const seen=new Set();while(!seen.has(id)){seen.add(id);const owners=parents.get(id);if(owners?.length!==1)return undefined;const owner=owners[0];if(!presentation.has(owner.id))return {id:owner.id,slot:owner.slot,precedingOrdinary:owner.preceding.filter(id=>!presentation.has(id)).length};id=owner.id;}}
function shape(node){const copy=structuredClone(node);delete copy.id;delete copy.revision;if(copy.props){delete copy.props.showType;if(!Object.keys(copy.props).length)delete copy.props;}return copy;}
const oldRows=Object.values(before.nodes).filter(row),newRows=Object.values(after.nodes).filter(row),mapping=[],errors=[],used=new Set();
for(const original of oldRows){
 const body=anchor(original.id,beforeParents,beforePresentation);
 const candidates=newRows.filter(next=>isDeepStrictEqual(shape(original),shape(next))&&isDeepStrictEqual(body,anchor(next.id,afterParents,afterPresentation)));
 if(candidates.length!==1){errors.push(`No unique exact row/body equivalent for ${original.id}: ${candidates.length}`);continue;}
 const next=candidates[0];if(used.has(next.id))errors.push(`Replacement reused: ${next.id}`);used.add(next.id);
 if(next.revision!=='2')errors.push(`Replacement not pinned @2: ${next.id}`);
 if(next.props?.showType&&!isDeepStrictEqual(next.props.showType,{type:'literal',value:false}))errors.push(`Replacement not names-only: ${next.id}`);
 mapping.push({before:original.id,after:next.id,semanticPortId:next.props.id.value,bodyAnchor:body,sourceFieldsExceptIdRevisionShowTypeExact:true});
}
if(oldRows.length!==27||newRows.length!==27||mapping.length!==27||used.size!==27)errors.push('Expected complete 27-row bijection');
const oldIds=new Set(oldRows.map(node=>node.id)),outsideReferencesBefore=[],referencesAfter=[],substringMentionsAfter=[];
function scan(value,path,output,allowOriginalOwnership){
 if(typeof value==='string'){
  if(oldIds.has(value)){
   const ownerField=path.length===3&&path[0]==='nodes'&&oldIds.has(path[1])&&path[2]==='id';
   const containment=(path[0]==='nodes'&&path.length>=4&&['children','templateRoot','fallback'].some(key=>path.includes(key)));
   if(!(allowOriginalOwnership&&(ownerField||containment)))output.push({path,value});
  }
  if(!allowOriginalOwnership)for(const id of oldIds)if(value!==id&&value.includes(id))substringMentionsAfter.push({path,oldId:id,value});
 }else if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){if(oldIds.has(key)&&!(allowOriginalOwnership&&path.length===1&&path[0]==='nodes'))output.push({path:[...path,key],keyReference:true});scan(child,[...path,key],output,allowOriginalOwnership);}
}
scan(before,[],outsideReferencesBefore,true);scan(after,[],referencesAfter,false);
if(outsideReferencesBefore.length||referencesAfter.length)errors.push('Old row IDs have references outside their original identity/containment or remain after adoption');
const addedStyles=Object.fromEntries(Object.entries(after.styleSources??{}).filter(([id])=>!before.styleSources?.[id]));
const report={schema:'vict.independent-actual-row-adoption@1',status:errors.length?'FAIL':'PASS',scope:'Read-only unique source-leaf bijection and old-reference audit; graph semantic IDs are not renamed. No application source edited by this checker.',before:{path:beforePath,sha256:hash(beforePath),revision:before.revision},after:{path:afterPath,sha256:hash(afterPath),revision:after.revision},sourceRowsBefore:oldRows.length,sourceRowsAfter:newRows.length,mapping,outsideReferencesBefore,referencesAfter,substringMentionsAfter,addedStyles,errors};
writeFileSync(join(folder,'independent-actual-row-adoption.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
