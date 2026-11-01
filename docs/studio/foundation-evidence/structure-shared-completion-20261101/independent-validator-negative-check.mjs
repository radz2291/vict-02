/** In-memory counterexamples only. Never writes or injects application source. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {SourceTextModule,SyntheticModule,createContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {join} from 'node:path';
const root=process.cwd(),folder=join(root,'docs/studio/foundation-evidence/structure-shared-completion-20261101');
const validatorPath=join(root,'scripts/verify-node-port-presentation.mjs'),script=readFileSync(validatorPath,'utf8');
const before=JSON.parse(readFileSync(join(folder,'01-before-source.json'),'utf8'));
const directions=new Map();
function scan(value){
 if(typeof value==='string'){try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object')scan(parsed);}catch{}}
 else if(value&&typeof value==='object'){
  if(/^vict\.flow-graph@\d+$/.test(value.schema??''))for(const family of value.nodeTypes??[])for(const port of family.ports??[]){const set=directions.get(port.id)??new Set();set.add(port.direction);directions.set(port.id,set);}
  for(const child of Object.values(value))scan(child);
 }
}scan(before);
const isRow=node=>node?.kind==='component'&&node.definitionId==='vict.flow.port-row';
const ownership=source=>{
 const result=new Map();for(const node of Object.values(source.nodes)){
  if(node.kind==='element')for(const id of node.children)result.set(id,{node,list:node.children});
  if(node.kind==='component')for(const slot of Object.values(node.slots??{}))for(const id of slot.children??[])result.set(id,{node,list:slot.children});
 }return result;
};
function converted(){
 const after=structuredClone(before),parents=ownership(after),groups=new Map();
 for(const node of Object.values(after.nodes).filter(isRow)){
  node.revision='2';const parent=parents.get(node.id);if(!parent)throw Error(`Missing fixture parent ${node.id}`);
  if(!groups.has(parent.node.id))groups.set(parent.node.id,{parent,rows:[]});groups.get(parent.node.id).rows.push(node.id);
 }
 let index=0;for(const {parent,rows} of groups.values()){
  for(const id of rows)parent.list.splice(parent.list.indexOf(id),1);
  const id=`independent-probe-columns-${index++}`;parent.list.push(id);
  const outputs=rows.filter(id=>{const set=directions.get(after.nodes[id].props?.id?.value);return set?.size===1&&set.has('output');});
  after.nodes[id]={id,kind:'component',definitionId:'vict.flow.port-columns',revision:'1',props:{},slots:{inputs:{children:rows.filter(id=>!outputs.includes(id))},outputs:{children:outputs}}};
 }return after;
}
async function run(after){
 let report;const context=createContext({process:{argv:['node','validator','before','after','report']},structuredClone,console:{log:()=>{}},Buffer});
 const modules={
  'node:fs':{readFileSync:path=>Buffer.from(JSON.stringify(path==='before'?before:after)),writeFileSync:(_path,value)=>{report=JSON.parse(value);}},
  'node:crypto':{createHash},'node:util':{isDeepStrictEqual}
 };
 const module=new SourceTextModule(script,{context});await module.link(name=>{const values=modules[name];if(!values)throw Error(`Unexpected import: ${name}`);return new SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});});await module.evaluate();return report;
}
function replaceLeafIds(after){
 const rows=Object.values(after.nodes).filter(isRow),names=new Map(rows.map((node,index)=>[node.id,`adopted-row-${index}`]));
 for(const {list} of ownership(after).values())for(let index=0;index<list.length;index++)if(names.has(list[index]))list[index]=names.get(list[index]);
 for(const node of rows){const old=node.id;node.id=names.get(old);delete after.nodes[old];after.nodes[node.id]=node;}
 return after;
}
const cases=[];
{
 const report=await run(converted());cases.push({name:'positive conversion preserving ordinary source',validatorStatus:report.status,reportedNonstructuralChanges:report.otherNonstructuralChanges,errors:report.errors,expected:'PASS',matchedExpected:report.status==='PASS'});
}
{
 const report=await run(replaceLeafIds(converted()));cases.push({name:'positive explicit bijective UI leaf replacement preserving semantic ports',validatorStatus:report.status,reportedNonstructuralChanges:report.otherNonstructuralChanges,errors:report.errors,expected:'PASS',matchedExpected:report.status==='PASS'});
}
{
 const after=converted(),parents=ownership(after),controls=Object.values(after.nodes).filter(node=>node.kind==='element'&&['input','textarea','select'].includes(node.tag)&&parents.has(node.id));
 const first=controls[0],second=controls.find(node=>parents.get(node.id).node.id!==parents.get(first.id).node.id);if(!second)throw Error('Need distinct control containers');
 const from=parents.get(first.id),to=parents.get(second.id);from.list.splice(from.list.indexOf(first.id),1);to.list.push(first.id);
 const report=await run(after);cases.push({name:'ordinary control moved between source containers',control:first.id,from:from.node.id,to:to.node.id,validatorStatus:report.status,reportedNonstructuralChanges:report.otherNonstructuralChanges,errors:report.errors,falsePass:report.status==='PASS'});
}
{
 const after=converted(),workspace=Object.values(after.nodes).find(node=>node.kind==='component'&&node.definitionId==='vict.flow.workspace'&&node.props?.graph?.type==='ref');if(!workspace)throw Error('Need source-bound workspace');
 workspace.props.graph={type:'literal',value:before.localState.campaignGraph.initial};const report=await run(after);cases.push({name:'source-bound workspace changed to a literal graph',workspace:workspace.id,validatorStatus:report.status,reportedNonstructuralChanges:report.otherNonstructuralChanges,errors:report.errors,falsePass:report.status==='PASS'});
}
{
 const after=converted(),row=Object.values(after.nodes).find(isRow);row.props.showType={type:'literal',value:true};const report=await run(after);cases.push({name:'explicitly re-enable redundant type badge',row:row.id,validatorStatus:report.status,reportedNonstructuralChanges:report.otherNonstructuralChanges,errors:report.errors,falsePass:report.status==='PASS'});
}
{
 const after=converted(),column=Object.values(after.nodes).find(node=>node.kind==='component'&&node.definitionId==='vict.flow.port-columns'),parent=ownership(after).get(column.id),id='independent-behavior-wrapper';
 parent.list.splice(parent.list.indexOf(column.id),1,id);after.nodes[id]={id,kind:'element',tag:'div',children:[column.id],interactions:[{on:'click',action:'setState',key:'campaignGraph',value:{type:'literal',value:'unexpected'}}]};
 const report=await run(after);cases.push({name:'new port-only wrapper adds source state-changing interaction',wrapper:id,validatorStatus:report.status,reportedNonstructuralChanges:report.otherNonstructuralChanges,errors:report.errors,falsePass:report.status==='PASS'});
}
{
 const after=replaceLeafIds(converted()),old=Object.values(before.nodes).find(isRow).id,column=Object.values(after.nodes).find(node=>node.kind==='component'&&node.definitionId==='vict.flow.port-columns'),parent=ownership(after).get(column.id),id='independent-stale-reference-wrapper';
 parent.list.splice(parent.list.indexOf(column.id),1,id);after.nodes[id]={id,kind:'element',tag:'div',attributes:{'aria-controls':old},children:[column.id]};
 const report=await run(after);cases.push({name:'replaced UI leaf retains an outside stale reference',validatorStatus:report.status,reportedNonstructuralChanges:report.otherNonstructuralChanges,errors:report.errors,falsePass:report.status==='PASS'});
}
const result={schema:'vict.independent-port-validator-negative-probes@1',validatorPath,validatorSha256:createHash('sha256').update(script).digest('hex'),scope:'Coding-authored in-memory comparison counterexamples; no actual application source files, browser state, provider or agent edits.',baseline:before.id,cases};
const resultName=process.argv[2]??'independent-validator-negative-probes.json';if(!/^[\w-]+\.json$/.test(resultName))throw Error('Use a fresh local JSON evidence name');
const resultPath=join(folder,resultName);if(existsSync(resultPath))throw Error('Refusing to overwrite prior observations; pass a new JSON evidence name');
writeFileSync(resultPath,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
