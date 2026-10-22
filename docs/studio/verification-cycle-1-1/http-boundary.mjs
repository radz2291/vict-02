import {writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const base='http://127.0.0.1:5592',out=dirname(fileURLToPath(import.meta.url)),checks=[];
async function login(){const r=await fetch(base+'/login',{method:'POST',headers:{origin:base,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({label:'operator',secret:'studio-local-pass'}),redirect:'manual'});return(r.headers.get('set-cookie')||'').split(';')[0]}
const cookie=await login();let csrf='';
async function probe(name,path,method,headers,body,expected){const r=await fetch(base+path,{method,headers,body,redirect:'manual'});const raw=await r.text();let result;try{result=JSON.parse(raw)}catch{result={nonJson:true}};if(result.csrf){csrf=result.csrf;delete result.csrf;result.csrfPresent=true}const row={name,status:r.status,expected,ok:r.status===expected,result,cache:r.headers.get('cache-control')};checks.push(row);console.log(JSON.stringify(row));return row}
await probe('unauthenticated bootstrap','/api/designer-agent','GET',{},undefined,401);
const boot=await probe('authenticated bootstrap','/api/designer-agent','GET',{cookie},undefined,200);
if(boot.ok){
for(const [path,method] of [['/api/designer-agent','POST'],['/api/designer-agent','DELETE'],['/api/designer-agent/ack','POST']]){
 await probe('no session '+method+path,path,method,{origin:base,'content-type':'application/json'},'{}',401);
 await probe('missing origin '+method+path,path,method,{cookie,'content-type':'application/json','x-vict-csrf':csrf},'{}',403);
 await probe('foreign origin '+method+path,path,method,{cookie,origin:'https://elsewhere.invalid','content-type':'application/json','x-vict-csrf':csrf},'{}',403);
 await probe('missing CSRF '+method+path,path,method,{cookie,origin:base,'content-type':'application/json'},'{}',403);
 for(const type of ['text/plain','application/x-www-form-urlencoded','application/jsonx'])await probe('wrong content type '+type+' '+method+path,path,method,{cookie,origin:base,'content-type':type,'x-vict-csrf':csrf},'{}',415);
 await probe('malformed JSON '+method+path,path,method,{cookie,origin:base,'content-type':'application/json','x-vict-csrf':csrf},'{',400);
 await probe('oversized '+method+path,path,method,{cookie,origin:base,'content-type':'application/json','x-vict-csrf':csrf},'x'.repeat(256001),413);
 await probe('closed schema '+method+path,path,method,{cookie,origin:base,'content-type':'application/json','x-vict-csrf':csrf},JSON.stringify({actorId:'spoof',apiKey:'credential-canary'}),400);
}
await probe('unknown ack session isolated','/api/designer-agent/ack','POST',{cookie,origin:base,'content-type':'application/json','x-vict-csrf':csrf},JSON.stringify({runId:crypto.randomUUID(),proposalId:crypto.randomUUID(),receipt:{ok:false,code:'STUDIO_AGENT_CANCELLED',message:'test'}}),409);
}
await writeFile(resolve(out,'http-boundary.json'),JSON.stringify(checks,null,2));if(checks.some(c=>!c.ok))process.exitCode=1;
