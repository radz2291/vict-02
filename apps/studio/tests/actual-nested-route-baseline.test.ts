import {expect,it} from 'vitest';
import type {UiDocument} from '@victframework/ui';
import partial from './fixtures/nested-route-actual-partial-source.json';
import {documentCursor,prepareAgentEdit,type AgentEdit} from '../src/lib/designer/agent-edits.js';
import {graphSourceOwnership,patchAuthoredGraph} from '../src/lib/designer/graph-authoring.js';
import {screenApplication} from '../src/lib/designer/application.js';
import {prepareSourceImport} from '../src/lib/designer/source-import.js';
const source=()=>JSON.parse(JSON.stringify(partial)) as UiDocument;
const outer=(document:UiDocument)=>JSON.parse(String(document.localState.graph.initial));
const inner=(document:UiDocument,id:string)=>JSON.parse(outer(document).nodes.find((node:{id:string})=>node.id===id).values.graph);
const changes=(title:string)=>[
  {type:'defineNodeType',definition:{id:'task',label:'Task',parameters:{title:{type:'string',default:title},status:{type:'string',default:'todo'}},ports:[]}},
  {type:'addNode',nodeType:'task',id:'task-1',position:{x:20,y:20}},
];
const edit=(revision:string,id:string,parentRevision:number,title:string):AgentEdit=>({expectedRevision:revision,reason:'Diagnose actual nested route through public edit validation',operations:[{op:'editGraph',nodeId:'project-task-workspace',expectedGraphRevision:0,occurrenceRoute:[{workspaceNodeId:'flow-workspace',graphNodeId:id,expectedGraphRevision:parentRevision}],changes:changes(title)}]});
it('accepts exact p1 and p2 routes on the preserved actual same-name graph source without sibling or source mutation',()=>{
  const original=source(),before=JSON.stringify(original);
  expect(outer(original).revision).toBe(1);expect(inner(original,'p1').revision).toBe(0);expect(inner(original,'p2').revision).toBe(0);
  expect(graphSourceOwnership(original,'project-task-workspace')).toEqual({kind:'slot',ownerNodeId:'flow-workspace',slotName:'body',key:'graph',controlled:true});
  const cursor=documentCursor(original,'r1.r2#0','actual-nested-probe'),p1Edit=edit(cursor.revision,'p1',1,'Draft launch checklist');
  const p1=prepareAgentEdit(original,cursor,p1Edit,'actual-p1');expect(p1.ok,JSON.stringify(p1)).toBe(true);if(!p1.ok)throw Error(p1.message);
  const direct=patchAuthoredGraph(original,'project-task-workspace',changes('Draft launch checklist'),0,[{workspaceNodeId:'flow-workspace',graphNodeId:'p1',expectedGraphRevision:1}]);expect(direct.ok).toBe(true);if(!direct.ok)throw Error(direct.message);
  expect(direct.document).toEqual(p1.document);expect(JSON.stringify(original)).toBe(before);
  expect(outer(p1.document).revision).toBe(2);expect(inner(p1.document,'p1')).toMatchObject({revision:1,nodes:[{id:'task-1',type:'task'}]});expect(inner(p1.document,'p2')).toEqual(inner(original,'p2'));
  const p1Bytes=outer(p1.document).nodes.find((node:{id:string})=>node.id==='p1').values.graph;
  const nextCursor=documentCursor(p1.document,'r1.r2#1','actual-nested-probe'),p2=prepareAgentEdit(p1.document,nextCursor,edit(nextCursor.revision,'p2',2,'Design onboarding flow'),'actual-p2');
  expect(p2.ok,JSON.stringify(p2)).toBe(true);if(!p2.ok)throw Error(p2.message);
  expect(outer(p2.document).revision).toBe(3);expect(inner(p2.document,'p2')).toMatchObject({revision:1,nodes:[{id:'task-1',type:'task'}]});expect(inner(p2.document,'p2').nodeTypes[0].parameters.title.default).toBe('Design onboarding flow');
  expect(outer(p2.document).nodes.find((node:{id:string})=>node.id==='p1').values.graph).toBe(p1Bytes);
  expect(JSON.stringify(original)).toBe(before);
  console.log(JSON.stringify({sourceOwner:graphSourceOwnership(original,'project-task-workspace'),p1:{parentBefore:1,parentAfter:outer(p1.document).revision,innerAfter:inner(p1.document,'p1').revision,p2Unchanged:true},p2:{parentBefore:2,parentAfter:outer(p2.document).revision,innerAfter:inner(p2.document,'p2').revision,p1Unchanged:true}}));
});
it('refuses stale parent revision and a route ending at the target workspace instead of its containing owner',()=>{
  const original=source(),cursor=documentCursor(original,'r1.r2#0','actual-nested-probe'),before=JSON.stringify(original);
  const stale=prepareAgentEdit(original,cursor,edit(cursor.revision,'p1',0,'No stale change'),'stale-route');expect(stale.ok).toBe(false);
  const wrong=edit(cursor.revision,'p1',1,'No wrong-owner change');const operation=wrong.operations[0];if(operation.op!=='editGraph')throw Error('fixture');
  const result=prepareAgentEdit(original,cursor,{...wrong,operations:[{...operation,occurrenceRoute:[{workspaceNodeId:'project-task-workspace',graphNodeId:'p1',expectedGraphRevision:1}]}]},'wrong-owner');expect(result.ok).toBe(false);
  expect(JSON.stringify(original)).toBe(before);
});
it('compares portable import admission before and after both correctly routed task additions',async()=>{
  const original=source(),before=JSON.stringify(original),cursor=documentCursor(original,'r1.r2#0','actual-nested-import-probe');
  const p1=prepareAgentEdit(original,cursor,edit(cursor.revision,'p1',1,'Draft launch checklist'),'import-p1');
  expect(p1.ok,JSON.stringify(p1)).toBe(true);if(!p1.ok)throw Error(p1.message);
  const next=documentCursor(p1.document,'r1.r2#1','actual-nested-import-probe');
  const p2=prepareAgentEdit(p1.document,next,edit(next.revision,'p2',2,'Design onboarding flow'),'import-p2');
  expect(p2.ok,JSON.stringify(p2)).toBe(true);if(!p2.ok)throw Error(p2.message);
  const envelope=(document:UiDocument)=>JSON.stringify({application:screenApplication(document),uiDocuments:[{document}]});
  const initial=await prepareSourceImport(envelope(original)),routed=await prepareSourceImport(envelope(p2.document));
  const admission=(result:Awaited<ReturnType<typeof prepareSourceImport>>)=>result.ok?{ok:true,assets:result.assets.length}:result;
  console.log(JSON.stringify({importAdmission:{partial:admission(initial),twoTasks:admission(routed)}}));
  expect(initial.ok,JSON.stringify(initial)).toBe(true);expect(routed.ok,JSON.stringify(routed)).toBe(true);
  if(initial.ok)expect(initial.document).toEqual(original);if(routed.ok)expect(routed.document).toEqual(p2.document);
  expect(JSON.stringify(original)).toBe(before);
});
