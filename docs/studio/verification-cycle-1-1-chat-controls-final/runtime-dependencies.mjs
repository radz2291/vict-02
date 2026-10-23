import {readFile,readdir,realpath,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire,isBuiltin} from 'node:module';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../..');
const destination='C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1/260831-VCT-02';
async function files(dir){let a=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,e.name);if(e.isDirectory())a.push(...await files(p));else if(p.endsWith('.js'))a.push(p)}return a}
const dependencies=[],seen=new Set();
for(const file of await files(resolve(root,'apps/studio/build'))){const text=await readFile(file,'utf8'),specifiers=[];
const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
function visit(n){if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier))specifiers.push(n.moduleSpecifier.text);if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0]))specifiers.push(n.arguments[0].text);ts.forEachChild(n,visit)}visit(tree);
for(const specifier of specifiers){
if(specifier.startsWith('.')||isBuiltin(specifier)||seen.has(specifier))continue;seen.add(specifier);
const from=fileURLToPath(import.meta.resolve(specifier,pathToFileURL(file).href));
const target=fileURLToPath(import.meta.resolve(specifier,pathToFileURL(resolve(destination,relative(root,file))).href));
const physical=await realpath(from),targetPhysical=await realpath(target),bytes=await readFile(physical);
dependencies.push({specifier,resolved:from,physical,destinationResolved:target,destinationPhysical:targetPhysical,samePhysicalFile:physical===targetPhysical,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}}
const require=createRequire(resolve(root,'apps/studio/package.json')),conversation=resolve(root,'packages/ui-svelte/src/Conversation.svelte');
const source={resolvedPackageEntry:require.resolve('@victframework/ui-svelte'),physicalPackageEntry:await realpath(require.resolve('@victframework/ui-svelte')),conversation,conversationSha256:createHash('sha256').update(await readFile(conversation)).digest('hex')};
const selected=[];
for(const specifier of ['mdast-util-from-markdown','@libsql/win32-x64-msvc']){
const own=await realpath(fileURLToPath(import.meta.resolve(specifier,pathToFileURL(resolve(root,'apps/studio/build/index.js')).href))),target=await realpath(fileURLToPath(import.meta.resolve(specifier,pathToFileURL(resolve(destination,'apps/studio/build/index.js')).href))),bytes=await readFile(own);
selected.push({specifier,physical:own,destinationPhysical:target,samePhysicalFile:own===target,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...(specifier==='mdast-util-from-markdown'?{version:'2.0.3',bundledInArtifact:!seen.has(specifier)}:{})});
}
const result={producingCommit:'402dec75c7593fe23e41f3d3c0659ca61a8edc27',destination,source,dependencies,selected,allSamePhysicalFiles:[...dependencies,...selected].every(e=>e.samePhysicalFile)};
await writeFile(resolve(out,'runtime-dependencies.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({source,dependencies:dependencies.length,allSamePhysicalFiles:result.allSamePhysicalFiles}));if(!result.allSamePhysicalFiles)process.exitCode=1;


