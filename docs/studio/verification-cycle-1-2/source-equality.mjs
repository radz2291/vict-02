import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../..'),destination='C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1/260831-VCT-02',sha='7874c64158b877c574ceff04e1917773bc03afe6';
const paths=['packages/ui-svelte/src/Conversation.svelte','apps/studio/src/lib/designer/AgentChat.svelte','apps/studio/src/lib/designer/Designer.svelte'];
const rows=[];for(const path of paths){const own=await readFile(resolve(root,path)),other=await readFile(resolve(destination,path)),blob=execFileSync('git',['show',sha+':'+path],{cwd:root,maxBuffer:10*1024*1024});const normalize=b=>b.toString('utf8').replaceAll('\r\n','\n');rows.push({path,sha256:createHash('sha256').update(own).digest('hex'),builderSha256:createHash('sha256').update(other).digest('hex'),sameRawBytes:own.equals(other),bothMatchExactCommitAfterGitLineEndingNormalization:normalize(own)===normalize(blob)&&normalize(other)===normalize(blob)})}
const pass=rows.every(r=>r.bothMatchExactCommitAfterGitLineEndingNormalization);await writeFile(resolve(out,'source-equality.json'),JSON.stringify({producingCommit:sha,destination,observation:'Checkouts differ in CRLF/LF. Both sources independently match exact candidate Git blob after line-ending normalization; no semantic source difference.',rows,pass},null,2));console.log(JSON.stringify({pass,rows}));if(!pass)process.exitCode=1;

