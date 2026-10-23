/** Real isolated HTTP admission proof. Invalid start fields prevent all provider execution. */
import { writeFileSync } from 'node:fs';
const origin='http://127.0.0.3:5596';
const login=await fetch(`${origin}/login`,{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({label:'operator',secret:'studio-local-pass'})});
const cookie=login.headers.getSetCookie().find(value=>value.startsWith('vict_studio_session='))?.split(';')[0];
if(login.status!==303||!cookie)throw Error('Isolated development login failed');
const config=await(await fetch(`${origin}/api/designer-agent`,{headers:{cookie}})).json();
const cases=[];
async function probe(name,body,status,code,csrf=config.csrf){
  const response=await fetch(`${origin}/api/designer-agent`,{method:'POST',headers:{origin,cookie,'content-type':'application/json','x-vict-csrf':csrf},body});
  const result=await response.json();cases.push({name,requestBytes:Buffer.byteLength(body),status:response.status,code:result.code,pass:response.status===status&&result.code===code});
}
const unicode=JSON.stringify({prompt:'',document:{padding:'界'.repeat(185000)}});
await probe('UTF-8 body exceeds adapter default 512KiB; application parses and returns structured start refusal',unicode,400,'STUDIO_AGENT_REQUEST');
const prefix='{"prompt":"","document":{"padding":"',suffix='"}}';
await probe('exact aggregate application byte boundary is admitted to field validation',prefix+'x'.repeat(1_200_000-prefix.length-suffix.length)+suffix,400,'STUDIO_AGENT_REQUEST');
await probe('one byte beyond aggregate admission is an explicit structured size refusal',prefix+'x'.repeat(1_200_001-prefix.length-suffix.length)+suffix,413,'STUDIO_AGENT_REQUEST_LIMIT');
await probe('CSRF guard precedes reading large request',unicode,403,'VICT_STUDIO_CSRF','invalid');
const report={kind:'actual authenticated HTTP admission, not a provider or document-validation test',origin,model:config.model,cases};
writeFileSync('docs/studio/cycle-1-3/completion-http-boundaries.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(cases.some(item=>!item.pass))process.exitCode=1;
