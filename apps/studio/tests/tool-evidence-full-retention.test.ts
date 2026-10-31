import {afterEach,expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createToolArchive} from '../src/lib/server/tool-evidence-archive.js';
import {sanitizeToolOriginal,safeToolPayload,createToolEvidenceProducer} from '../src/lib/server/tool-evidence.js';
import {isToolArchiveReference,TOOL_ARCHIVE_SCHEMA,LEGACY_TOOL_ARCHIVE_SCHEMA,type StudioToolEvidence} from '../src/lib/designer/tool-evidence.js';

const directories:string[]=[];
async function directory(){const path=await mkdtemp(join(tmpdir(),'vict-evidence-test-'));directories.push(path);return path;}
afterEach(async()=>{for(const path of directories.splice(0)){if(!path.startsWith(join(tmpdir(),'vict-evidence-test-')))throw Error('Unexpected cleanup path');await rm(path,{recursive:true,force:true});}});

it('sanitizes deep/wide/large Unicode originals without policy loss or executing getters, proxies or toJSON',()=>{
  let calls=0;const secret='protected-original-canary';const shared={value:'SHARED'};
  const root:Record<string,unknown>={large:'🧭界'.repeat(100_000)+'TAIL '+secret,rows:Array.from({length:5000},(_,index)=>index),wide:Object.fromEntries(Array.from({length:5000},(_,index)=>['field'+index,index])),left:shared,right:shared,authorization:'private'};
  let current=root;for(let index=0;index<16000;index++){const next:Record<string,unknown>={};current.child=next;current=next;}current.value='DEEPEST';
  Object.defineProperty(root,'getter',{get(){calls++;throw Error('Do not run');}});
  root.toJSON=()=>{calls++;throw Error('Do not run');};root.cycle=root;
  root.proxy=new Proxy({},{ownKeys(){calls++;throw Error('Do not inspect proxy');},getPrototypeOf(){calls++;throw Error('Do not inspect proxy');}});
  const full=sanitizeToolOriginal(root,[secret]);expect(calls).toBe(0);expect(full.redacted).toBe(true);expect(full.text).not.toContain(secret);expect(full.text).not.toContain('private');
  const parsed=JSON.parse(full.text);expect(parsed.large).toContain('TAIL [redacted]');expect(parsed.rows).toHaveLength(5000);expect(parsed.wide.field4999).toBe(4999);expect(parsed.left).toEqual(parsed.right);expect(parsed.cycle).toBe('[circular reference]');expect(parsed.proxy).toBe('[unavailable proxy]');
  let leaf=parsed;for(let index=0;index<16000;index++)leaf=leaf.child;expect(leaf.value).toBe('DEEPEST');
  const preview=safeToolPayload({text:'🧭界'.repeat(5000)},[],7999);expect(Buffer.byteLength(preview.text)).toBeLessThanOrEqual(7999);expect(preview.text).not.toContain('�');
});

it('retains more than 512 exchanges and 32 MB without expiring or evicting the first owning-session original',async()=>{
  let clock=0;const archive=createToolArchive(()=>clock,await directory()),refs=[];
  for(let index=0;index<530;index++)refs.push(await archive.retain('owner','same-run','studio_screen_read',`call-${index}`,'result',{text:'x'.repeat(70_000),index},[]));
  expect(refs).toHaveLength(530);expect(refs[0]).toMatchObject({schema:TOOL_ARCHIVE_SCHEMA,expiresAt:null,truncated:false});clock=Date.now()+365*24*60*60_000;
  expect(await archive.page('owner',refs[0]!.id)).toBeDefined();expect(await archive.page('owner',refs.at(-1)!.id)).toBeDefined();expect(await archive.page('other',refs[0]!.id)).toBeUndefined();
},60000);

it('pages the complete >4 MB original and Unicode across arbitrary code-unit page boundaries',async()=>{
  const archive=createToolArchive(Date.now,await directory()),raw={text:'x'.repeat(4_200_000)+'🧭界TAIL',password:'not-public'};
  const ref=await archive.retain('owner','run','studio_screen_read','call','result',raw,[]);expect(ref.totalCharacters).toBeGreaterThan(4_200_000);expect(ref.truncated).toBe(false);
  let offset:number|null=0;const pages:string[]=[];
  while(offset!==null){const page:NonNullable<Awaited<ReturnType<typeof archive.page>>>=(await archive.page('owner',ref.id,offset))!;expect(page.offset).toBe(offset);expect(page.text.length).toBeLessThanOrEqual(6000);pages.push(page.text);offset=page.nextOffset;}
  expect(JSON.parse(pages.join(''))).toEqual({text:raw.text,password:'[redacted]'});
  const source=sanitizeToolOriginal(raw).text,pair=source.indexOf('🧭');const a=(await archive.page('owner',ref.id,pair,1))!,b=(await archive.page('owner',ref.id,pair+1,1))!;expect(a.text+b.text).toBe('🧭');
  for(const invalid of [-1,Number.NaN,Number.MAX_SAFE_INTEGER+1])expect(await archive.page('owner',ref.id,invalid)).toBeUndefined();
  expect(await archive.page('owner','../other')).toBeUndefined();
},30000);

it('keeps legacy expiry types distinct from new nonexpiring references',()=>{
  const identity={type:'tool-evidence-archive',runId:'run',callId:'call',tool:'studio_screen_read',phase:'result',id:crypto.randomUUID(),totalCharacters:3_000_000,redacted:false,truncated:false};
  expect(isToolArchiveReference({...identity,schema:TOOL_ARCHIVE_SCHEMA,expiresAt:null})).toBe(true);
  expect(isToolArchiveReference({...identity,schema:LEGACY_TOOL_ARCHIVE_SCHEMA,expiresAt:Date.now()})).toBe(true);
  expect(isToolArchiveReference({...identity,schema:LEGACY_TOOL_ARCHIVE_SCHEMA,expiresAt:null})).toBe(false);
  expect(isToolArchiveReference({...identity,schema:TOOL_ARCHIVE_SCHEMA,expiresAt:Date.now()})).toBe(false);
});

it('awaits storage/delivery, fences concurrent duplicates and reports actual storage failure explicitly',async()=>{
  const frames:StudioToolEvidence[]=[];let finish!:()=>void,stored=0,delivered=false;
  const producer=createToolEvidenceProducer('run',true,async event=>{frames.push(event);await new Promise<void>(done=>finish=done);delivered=true;},[],async()=>{stored++;});
  const pending=producer.send('studio_screen_read','call','input',{text:'window'});await producer.send('studio_screen_read','call','input',{});await Promise.resolve();expect(stored).toBe(1);expect(delivered).toBe(false);finish();await pending;expect(delivered).toBe(true);expect(frames).toHaveLength(1);
  const broken=createToolArchive(Date.now,join(await directory(),'missing'));
  const failures:StudioToolEvidence[]=[];const failing=createToolEvidenceProducer('run',true,event=>failures.push(event),[],async(tool,call,phase,value)=>{await broken.retain('owner','run',tool,call,phase,value,[]);});
  await failing.send('studio_screen_read','failure','input',{});expect(failures[0]).toMatchObject({availability:'unavailable',unavailableReason:'storage-error'});
  failing.close();await failing.send('studio_screen_read','late','input',{});expect(failures).toHaveLength(1);
});
