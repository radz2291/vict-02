import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const builder=process.cwd();
const [checkout,candidate,sealHash]=process.argv.slice(2);
if(!checkout||!candidate||!sealHash)throw Error('Supply exact detached checkout, candidate and independent seal digest');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const sealPath='docs/studio/cycle-1-4/structure-view/production-seal.json';
const bytes=readFileSync(resolve(builder,sealPath));
const seal=JSON.parse(bytes);
if(seal.candidate!==candidate||sha(bytes)!==sealHash)throw Error('Wrong candidate or manifest digest');
if(git(checkout,'rev-parse','HEAD')!==candidate||git(checkout,'status','--porcelain'))throw Error('Verifier checkout differs or dirty');
const payload=execFileSync('git',['cat-file','--batch'],{cwd:checkout,input:seal.inputs.map(file=>`${candidate}:${file.path}\n`).join(''),maxBuffer:128*1024*1024});
let offset=0;
for(const file of seal.inputs){
 const newline=payload.indexOf(10,offset),header=payload.subarray(offset,newline).toString('utf8').split(' '),size=Number(header[2]);
 if(header[1]!=='blob'||!Number.isSafeInteger(size))throw Error('Missing committed input '+file.path);
 const committed=payload.subarray(newline+1,newline+1+size);
 if(sha(committed)!==file.sha256)throw Error('Committed input mismatch '+file.path);
 if(sha(readFileSync(resolve(builder,file.path)))!==file.sha256)throw Error('Builder input mismatch '+file.path);
 offset=newline+1+size+1;
}
for(const file of seal.outputs)if(sha(readFileSync(resolve(builder,file.path)))!==file.sha256)throw Error('Output mismatch '+file.path);
const product=['apps/studio','packages','package.json','package-lock.json'];
if(git(builder,'diff','--name-only',candidate,'--',...product)||git(builder,'ls-files','--others','--exclude-standard','--',...product))throw Error('Product source differs');
console.log(JSON.stringify({verified:true,candidate,sealSha256:sha(bytes),committedInputs:seal.inputs.length,builderInputs:seal.inputs.length,outputs:seal.outputs.length,verifierCheckoutClean:true}));
