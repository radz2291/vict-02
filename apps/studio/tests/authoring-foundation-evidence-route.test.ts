import { describe, expect, it, vi } from 'vitest';
import { GET } from '../src/routes/api/designer-agent/evidence/+server.js';
import { toolEvidenceArchive } from '../src/lib/server/tool-evidence-archive.js';
const request = (sessionId:string|undefined, query:string) => GET({locals:{session:sessionId?{sessionId,csrfToken:'nonce',actorLabel:'owner'}:null},url:new URL(`http://localhost/api/designer-agent/evidence?${query}`)} as never);
describe('authenticated retained evidence reads',()=>{
  it('denies anonymous/cross-session reads and gives bounded original pages only to the owning session',async()=>{
    const ref=await toolEvidenceArchive.retain('archive-owner','run-route','studio_screen_read','call-route','result',{source:'x'.repeat(10_000)+'LAST-PAGE'},[])!;
    expect((await request(undefined,`id=${ref.id}`)).status).toBe(401);expect((await request('other',`id=${ref.id}`)).status).toBe(404);
    const response=await request('archive-owner',`id=${ref.id}&offset=9000&limit=3000`);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({runId:'run-route',callId:'call-route',phase:'result',offset:9000,nextOffset:null,text:expect.stringContaining('LAST-PAGE')});
    for(const query of [`id=${ref.id}&limit=6001`,`id=${ref.id}&offset=-1`,`id=${ref.id}&private=true`,`id=${ref.id}&id=another`])expect((await request('archive-owner',query)).status).toBe(400);
    expect((await request('archive-owner',`id=${ref.id}&offset=1000000000`)).status).toBe(404);
    expect((await request('archive-owner',`id=${ref.id}&offset=9007199254740992`)).status).toBe(400);
  });
  it('reports actual storage read failures explicitly without rerunning tools',async()=>{
    const page=vi.spyOn(toolEvidenceArchive,'page').mockRejectedValueOnce(Error('Simulated disk failure'));
    try{const response=await request('archive-owner',`id=${crypto.randomUUID()}`);expect(response.status).toBe(500);expect(await response.json()).toMatchObject({code:'STUDIO_EVIDENCE_STORAGE_FAILED',message:expect.stringContaining('storage')});}finally{page.mockRestore();}
  });
});
