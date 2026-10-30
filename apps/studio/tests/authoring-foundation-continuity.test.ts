import { describe, expect, it } from 'vitest';
import { createTaskContextStore, TASK_CONTEXT_TTL_MS } from '../src/lib/server/agent-task-context.js';
import { createToolArchive, TOOL_ARCHIVE_TTL_MS } from '../src/lib/server/tool-evidence-archive.js';
import { safeToolPayload, createToolEvidenceProducer } from '../src/lib/server/tool-evidence.js';
import { retainTurn, TURN_RECORD_TTL_MS, type RetainedTurn } from '../src/lib/designer/turn-records.js';
import type { AgentCursor } from '../src/lib/designer/agent-edits.js';
const cursor: AgentCursor = { documentId:'screen',revision:'r1#3',digest:'exact-source',epoch:'e963cf58-4be9-4b97-adcb-beb12a6ceec6' };

describe('revision-bound task facts',()=>{
  it('reuses actual bounded source pages for a correction, isolating actor, revision, digest and epoch',()=>{
    const store=createTaskContextStore();const result={expectedRevision:'r1#3',sourceJson:'{"id":"nav"}',offset:0,nextOffset:null};
    store.retain('owner',cursor,'Fix footer gap',{section:'source',nodeId:'nav'},result);
    expect(store.snapshot('owner',cursor)).toMatchObject({previousRequest:'Fix footer gap',facts:[{result}]});
    expect(store.snapshot('other',cursor)).toBeUndefined();
    expect(store.snapshot('owner',cursor,'changed-authoring-registry')).toBeUndefined();
    for(const changed of [{revision:'r2#0'},{digest:'changed'},{epoch:crypto.randomUUID()},{documentId:'other'}])expect(store.snapshot('owner',{...cursor,...changed})).toBeUndefined();
    result.sourceJson='changed outside store';expect(store.snapshot('owner',cursor)?.facts[0]?.result).toMatchObject({sourceJson:'{"id":"nav"}'});
    store.retain('owner',cursor,'Header, not footer',{section:'source',nodeId:'nav'},{sourceJson:'current-page'});
    expect(store.snapshot('owner',cursor)).toMatchObject({previousRequest:'Header, not footer',facts:[{result:{sourceJson:'current-page'}}]});
  });
  it('expires facts and excludes refused, oversized, prose and knowledge-as-source records',()=>{
    let clock=1;const store=createTaskContextStore(()=>clock);
    for(const [query,result] of [[{section:'source'},{ok:false}],[{section:'source'},{sourceJson:'x'.repeat(13_000)}],[{section:'contracts'},{text:'host-only knowledge'}],[{section:'assistant'},{text:'Done'}]])store.retain('owner',cursor,'task',query,result);
    expect(store.snapshot('owner',cursor)).toBeUndefined();
    store.retain('owner',cursor,'task',{section:'nodes',nodeId:'nav'},{items:[{id:'nav'}],nextOffset:3});
    expect(store.snapshot('owner',cursor)?.facts).toHaveLength(1);clock+=TASK_CONTEXT_TTL_MS;
    expect(store.snapshot('owner',cursor)).toBeUndefined();
  });
});

describe('sanitized original exchange retention',()=>{
  it('pages beyond compact preview without rerunning a tool, excluding secrets and another owner',()=>{
    const archive=createToolArchive();const raw={source:'a'.repeat(18_000)+'TAIL-EVIDENCE',authorization:'Bearer must-not-leak',credential:'private',comment:'secret-canary-value'};
    expect(safeToolPayload(raw).truncated).toBe(true);
    const reference=archive.retain('owner','run','studio_screen_read','call','result',raw,['secret-canary-value'])!;
    expect(reference.truncated).toBe(false);let offset:number|null=0;let assembled='';
    while(offset!==null){const page:NonNullable<ReturnType<typeof archive.page>>=archive.page('owner',reference.id,offset)!;assembled+=page.text;offset=page.nextOffset;}
    expect(assembled).toContain('TAIL-EVIDENCE');expect(assembled).not.toContain('must-not-leak');expect(assembled).not.toContain('secret-canary-value');expect(JSON.parse(assembled).credential).toBe('[redacted]');
    expect(archive.page('different-owner',reference.id)).toBeUndefined();expect(archive.page('owner',reference.id,-1)).toBeUndefined();expect(archive.page('owner',reference.id,0,6001)).toBeUndefined();
  });
  it('has honest expiry and size bounds and never invokes untrusted getters',()=>{
    let clock=1;const archive=createToolArchive(()=>clock);let getterCalls=0;
    const value={source:'x'.repeat(300_000),get hidden(){getterCalls++;return 'secret';}};
    const reference=archive.retain('owner','run','studio_screen_read','call','input',value,[])!;
    expect(getterCalls).toBe(0);expect(reference.truncated).toBe(true);expect(reference.totalCharacters).toBeLessThanOrEqual(256_000);
    clock+=TOOL_ARCHIVE_TTL_MS;expect(archive.page('owner',reference.id)).toBeUndefined();
  });
  it('retains originals even after preview budget, but not unavailable, duplicate or late phases',()=>{
    const originals:unknown[]=[];const producer=createToolEvidenceProducer('run',true,()=>{},[],(_tool,_call,_phase,value)=>originals.push(value));
    for(let i=0;i<25;i++)producer.send('studio_screen_read',`call-${i}`,'result',{text:'x'.repeat(9000)},'completed');
    expect(originals).toHaveLength(25);producer.send('studio_screen_read','call-0','result',{},'completed');
    producer.send('studio_screen_read','unavailable','result',undefined,'failed','not-returned');producer.close();producer.send('studio_screen_read','late','result',{},'completed');expect(originals).toHaveLength(25);
  });
});

describe('retained terminal turn evidence',()=>{
  const record=(id:string):RetainedTurn=>({id,runId:`run-${id}`,task:'Correct header',startedAt:0,endedAt:10,expiresAt:TURN_RECORD_TTL_MS,status:'failed',source:cursor,applied:2,regions:[],progress:['Visibility refused'],diagnostics:{capture:'covered'},receipts:{},evidence:'original-turn',archives:[]});
  it('keeps a previous failure immutable while newer turns arrive, with bounded retention',()=>{
    const previous=record('previous');let records=retainTurn([],previous,11);previous.progress.push('must not affect history');
    records=retainTurn(records,{...record('next'),status:'cancelled'},12);expect(records[0]?.progress).toEqual(['Visibility refused']);expect(records.map(item=>item.status)).toEqual(['failed','cancelled']);
    for(let i=0;i<30;i++)records=retainTurn(records,record(String(i)),20);expect(records).toHaveLength(24);
    records=retainTurn(records,{...record('new'),expiresAt:2*TURN_RECORD_TTL_MS},TURN_RECORD_TTL_MS);expect(records.map(item=>item.id)).toEqual(['new']);
  });
});
