import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import type {UiDocument} from '@victframework/ui';
import {graphSourceOwnership,inspectAuthoredGraphSource,patchAuthoredGraph} from '../src/lib/designer/graph-authoring.js';
import {graphAuthoringFor} from '../src/lib/designer/graph-history.js';
const path='C:/Users/RZ1/.codex/worktrees/vict-architecture-realignment-20261030/docs/studio/foundation-evidence/node-suite-stress-20261031/17-nested-finishing-saved-source.json';
const source=()=>JSON.parse(readFileSync(path,'utf8')) as UiDocument;
const route=(graphNodeId:string,expectedGraphRevision=23)=>[{workspaceNodeId:'ws-main',graphNodeId,expectedGraphRevision}];
const history={canUndo:()=>true,canRedo:()=>false,undo:()=>{},redo:()=>{}};
it('resolves both actual saved occurrences through the same source owner and distinct structured routes',()=>{
 const document=source(),outer=JSON.parse(String(document.localState.campaignGraph.initial));
 expect(graphSourceOwnership(document,'fin-ws')).toMatchObject({kind:'slot',ownerNodeId:'ws-main',slotName:'body',key:'subgraph',controlled:true});
 for(const id of ['finS','finP']){
  expect(inspectAuthoredGraphSource(document,'fin-ws',route(id))).toEqual({ok:true,source:outer.nodes.find((node:{id:string})=>node.id===id).values.subgraph});
  expect(graphAuthoringFor(document,{nodeId:'fin-ws',occurrenceKey:'opaque-'+id,occurrenceRoute:route(id)},history)).toEqual({kind:'source',history});
 }
});
it('refuses absent/stale/wrong parent routes on the actual saved controlled source',()=>{
 const document=source();
 for(const occurrenceRoute of [[],route('finS',22),route('brief'),[{workspaceNodeId:'fin-ws',graphNodeId:'finS',expectedGraphRevision:23}]]){
  expect(inspectAuthoredGraphSource(document,'fin-ws',occurrenceRoute).ok).toBe(false);
  expect(graphAuthoringFor(document,{nodeId:'fin-ws',occurrenceKey:'opaque',occurrenceRoute},history).kind).toBe('refused');
 }
});
it('changes only the selected same-ID inner node in an in-memory source clone and fences stale inner revision',()=>{
 const document=source(),before=JSON.stringify(document),outer=JSON.parse(String(document.localState.campaignGraph.initial));
 const operations=[{type:'setParameter',nodeId:'f-grade',key:'amount',value:36}];
 expect(patchAuthoredGraph(document,'fin-ws',operations,0,route('finS')).ok).toBe(false);
 const changed=patchAuthoredGraph(document,'fin-ws',operations,1,route('finS'));
 expect(changed.ok).toBe(true);if(!changed.ok)throw Error(changed.message);
 const next=JSON.parse(String(changed.document.localState.campaignGraph.initial));
 expect(next.revision).toBe(24);expect(next.edges).toEqual(outer.edges);
 for(const node of outer.nodes){const after=next.nodes.find((item:{id:string})=>item.id===node.id);if(node.id!=='finS')expect(after).toEqual(node);}
 const social=JSON.parse(next.nodes.find((node:{id:string})=>node.id==='finS').values.subgraph);
 expect(social.revision).toBe(2);expect(social.nodes.find((node:{id:string})=>node.id==='f-grade').values.amount).toBe(36);
 expect(JSON.stringify(document)).toBe(before);
});
