import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import type {UiDocument} from '@victframework/ui';
import {inspectAuthoredGraphSource,patchAuthoredGraph} from '../src/lib/designer/graph-authoring.js';
import {graphAuthoringFor} from '../src/lib/designer/graph-history.js';
const path='C:/Users/RZ1/.codex/worktrees/vict-architecture-realignment-20261030/docs/studio/foundation-evidence/node-suite-stress-20261031/18-layout-repaired-saved-source.json';
const source=()=>JSON.parse(readFileSync(path,'utf8')) as UiDocument;
const route=(graphNodeId:string,expectedGraphRevision=27)=>[{workspaceNodeId:'ws-main',graphNodeId,expectedGraphRevision}];
const history={canUndo:()=>true,canRedo:()=>false,undo:()=>{},redo:()=>{}};
it('preserves exact controlled source routes after authored capacity/geometry repair',()=>{
 const document=source(),outer=JSON.parse(String(document.localState.campaignGraph.initial));
 for(const id of ['finS','finP']){
  expect(inspectAuthoredGraphSource(document,'fin-ws',route(id))).toEqual({ok:true,source:outer.nodes.find((node:{id:string})=>node.id===id).values.subgraph});
  expect(graphAuthoringFor(document,{nodeId:'fin-ws',occurrenceKey:'opaque-'+id,occurrenceRoute:route(id)},history)).toEqual({kind:'source',history});
 }
 for(const occurrenceRoute of [[],route('finS',26),route('brief')])expect(inspectAuthoredGraphSource(document,'fin-ws',occurrenceRoute).ok).toBe(false);
});
it('authored capacities do not break isolated same-ID parameter writes in a disposable clone',()=>{
 const document=source(),before=JSON.stringify(document),outer=JSON.parse(String(document.localState.campaignGraph.initial));
 const operations=[{type:'setParameter',nodeId:'f-grade',key:'amount',value:36}];
 expect(patchAuthoredGraph(document,'fin-ws',operations,1,route('finS')).ok).toBe(false);
 const changed=patchAuthoredGraph(document,'fin-ws',operations,2,route('finS'));
 expect(changed.ok).toBe(true);if(!changed.ok)throw Error(changed.message);
 const next=JSON.parse(String(changed.document.localState.campaignGraph.initial));
 expect(next.revision).toBe(28);expect(next.edges).toEqual(outer.edges);
 for(const node of outer.nodes)if(node.id!=='finS')expect(next.nodes.find((item:{id:string})=>item.id===node.id)).toEqual(node);
 const social=JSON.parse(next.nodes.find((node:{id:string})=>node.id==='finS').values.subgraph);
 expect(social.revision).toBe(3);expect(social.nodes.find((node:{id:string})=>node.id==='f-grade').values.amount).toBe(36);
 expect(JSON.stringify(document)).toBe(before);
});
