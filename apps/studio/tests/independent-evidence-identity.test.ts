import {expect,it} from 'vitest';
import {mkdtemp,readdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createToolArchive} from '../src/lib/server/tool-evidence-archive.js';

it('independent: exact run/call/phase identity survives unlimited lifecycle and damaged originals fail explicitly',async()=>{
  const root=await mkdtemp(join(tmpdir(),'vict-independent-archive-'));
  let now=1;
  const archive=createToolArchive(()=>now,root);
  try {
    const secret='independent-canary-credential';
    const input=await archive.retain('session-a','run-a','studio_screen_read','same-call','input',{query:'🧭'.repeat(10000),credential:secret},[secret]);
    const result=await archive.retain('session-a','run-a','studio_screen_read','same-call','result',{answer:'complete'},[]);
    const otherRun=await archive.retain('session-a','run-b','studio_screen_read','same-call','result',{answer:'other'},[]);
    now=Number.MAX_SAFE_INTEGER;
    const page=await archive.page('session-a',input.id);
    expect(page).toMatchObject({runId:'run-a',callId:'same-call',phase:'input',expiresAt:null,redacted:true,truncated:false});
    expect(await archive.page('session-b',input.id)).toBeUndefined();
    expect(await archive.page('session-a',result.id)).toMatchObject({runId:'run-a',phase:'result'});
    expect(await archive.page('session-a',otherRun.id)).toMatchObject({runId:'run-b',phase:'result'});
    const [subdirectory]=await readdir(root);
    await writeFile(join(root,subdirectory!,input.id+'.text'),'');
    await expect(archive.page('session-a',input.id)).rejects.toThrow('Incomplete evidence archive storage');
    expect(await archive.page('session-b',input.id)).toBeUndefined();
  } finally {
    if(!resolve(root).startsWith(resolve(tmpdir())+'\\vict-independent-archive-'))throw Error('Unexpected evidence cleanup path');
    await rm(root,{recursive:true,force:true});
  }
});
