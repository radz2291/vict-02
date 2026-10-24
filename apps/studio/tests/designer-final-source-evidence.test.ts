/** Retained real-provider artifact audit. This does not simulate a browser. */
import { it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { UiDocument } from '@victframework/ui';
import { EditorBridge } from '@victframework/ui-editor';
import { designerCatalogs } from '../src/lib/designer/application.js';
import { screenStore } from '../src/lib/designer/storage.js';
import { screenRecipes } from '../src/lib/designer/recipes.js';
import { agentCoverage,documentCursor,prepareAgentEdit } from '../src/lib/designer/agent-edits.js';
const prefix=resolve('../../docs/studio/cycle-1-3/completion-evidence/authoring-final-1792791183630');
const document=JSON.parse(readFileSync(prefix+'-document.json','utf8')) as UiDocument;
it('preserves the historical intentional all-83 source and history while explicitly reporting specialists added since that run',()=>{
 // The retained provider run predates specialist seeds. Its old manifest remains
 // exactly83 recipes; extending today's catalogue must not rewrite that evidence.
 const laterSpecialists=['vict.ai.conversation','vict.ai.message','vict.ai.prompt-input','vict.flow.canvas'];
 const requested=screenRecipes.filter(recipe=>!laterSpecialists.includes(recipe.id)).map(recipe=>recipe.id);
 expect(requested).toHaveLength(83);
 expect(agentCoverage(document,requested)).toMatchObject({authored:83,catalogAuthored:78,missing:[]});
 const currentRequested=screenRecipes.map(recipe=>recipe.id);
 expect(agentCoverage(document,currentRequested)).toMatchObject({authored:83,catalogAuthored:78,requested:87,missing:laterSpecialists});
 expect(Object.keys(document.nodes).filter(id=>id.startsWith('retained-'))).toEqual([]);
 const headings=Object.values(document.nodes).filter(node=>node.kind==='element'&&node.tag==='h1');expect(headings).toHaveLength(1);
 for(const phrase of ['Add your details here','Your content','Add your own content','First option','Second option'])expect(JSON.stringify(document)).not.toContain(phrase);
 const values=new Map<string,string>();
 const bridge=new EditorBridge({catalogs:designerCatalogs,store:screenStore({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},document.id),initial:{document,storedRevision:document.revision}});
 const originalDigest=bridge.getSnapshot().contentDigest;const epoch=crypto.randomUUID();
 const cursor=documentCursor(bridge.document,bridge.getSnapshot().revision,epoch);
 const prepared=prepareAgentEdit(bridge.document,cursor,{expectedRevision:cursor.revision,reason:'Retained source Undo/Redo evidence',operations:[{op:'modify',nodeId:'existing-0',props:{label:'Undo/Redo audit'}}]},crypto.randomUUID());
 expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error(prepared.message);
 expect(bridge.apply(prepared.draft).ok).toBe(true);
 const changedDigest=bridge.getSnapshot().contentDigest;expect(changedDigest).not.toBe(originalDigest);
 expect(bridge.undo().ok).toBe(true);expect(bridge.getSnapshot().contentDigest).toBe(originalDigest);
 expect(bridge.redo().ok).toBe(true);expect(bridge.getSnapshot().contentDigest).toBe(changedDigest);
 expect(bridge.undo().ok).toBe(true);
 const {revision:oldRevision,...originalBody}=bridge.document;
 expect(bridge.save().ok).toBe(true);expect(bridge.save().ok).toBe(true);
 const savedDigest=bridge.getSnapshot().contentDigest;expect(bridge.reopen().ok).toBe(true);
 expect(bridge.getSnapshot().contentDigest).toBe(savedDigest);
 const {revision:savedRevision,...savedBody}=bridge.document;expect(savedBody).toEqual(originalBody);
 expect(agentCoverage(bridge.document,requested).missing).toEqual([]);
 expect(agentCoverage(bridge.document,currentRequested).missing).toEqual(laterSpecialists);
});
it('keeps the real run failure honest and scopes the expected visual source delta explicitly',()=>{
 const result=JSON.parse(readFileSync(prefix+'-result.json','utf8'));
 expect(result.head).toBe('3794c4a4dc75012c436df982f0532b6bbf68ee12');
 const changed=Object.keys(result.beforeHashes).filter(path=>result.beforeHashes[path]!==result.afterHashes[path]);
 expect(changed).toEqual(['apps/studio/src/lib/server/designer-visual.ts']);
 expect(result.events.at(-1)).toMatchObject({type:'done',status:'failed',code:'STUDIO_AGENT_TOOL_FAILED',termination:{status:'completed'},applied:26,unresolvedTools:['studio_screen_observe']});
 expect(result.events.some((event:any)=>event.type==='tool-event'&&event.kind==='validation-refused'&&event.details?.includes('operations.0.expression')&&event.details.includes('literal'))).toBe(true);
 expect(result.events.some((event:any)=>event.type==='tool-event'&&event.kind==='observation'&&event.tool==='studio_screen_read'&&event.details?.includes('lastValidation'))).toBe(true);
 expect(result.events.some((event:any)=>event.type==='tool-event'&&event.kind==='committed'&&event.callId)).toBe(true);
});
