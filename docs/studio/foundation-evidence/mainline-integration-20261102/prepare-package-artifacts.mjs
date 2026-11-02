/** Same-candidate build/pack evidence only. Never a consumer PASS. Run only
 * after the isolated root build ladder has completed with exit 0. */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = process.cwd();
const evidence = join(root, 'docs/studio/foundation-evidence/mainline-integration-20261102');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, {cwd:root,encoding:'utf8'}).trim();
const candidate = git(['rev-parse','HEAD']);
const builtCandidate = '2304233b0c1a88cb02cd55bffed13cb9a95981a5';
if (git(['diff','--name-only',builtCandidate,candidate,'--','package.json','package-lock.json','tsconfig.json','tsconfig.base.json'])) throw Error('Shared ladder configuration changed');
if (git(['diff','--name-only','HEAD','--','packages','apps','scripts','package.json','package-lock.json'])) throw Error('Dirty build inputs');
const buildLog = join(evidence, 'shared-build-repaired.log');
const log = readFileSync(buildLog);
const names = ['contracts','ui','sdk','application','ui-svelte','ui-media-svelte','ui-editor','ui-flow-svelte','ui-structure-svelte'];
const allBuilds = [...log.toString('utf8').matchAll(/^> (@victframework\/[^\s]+)@0\.4\.0-rc\.1 build$/gm)].map(match=>match[1]);
if (allBuilds.length !== 21 || names.some(name=>!allBuilds.includes(`@victframework/${name}`))) throw Error('Incomplete root ladder');
const directory = mkdtempSync(join(tmpdir(),'vict-mainline-2304233b-packs-'));
const report = {
  schema:'vict.structure-shared-public-consumer@1',
  sourceCandidate:candidate,
  status:'PACKAGE_BUILDS_PASS_CONSUMER_NOT_RUN',
  scope:'Build/pack precursor for existing consumer verifier reuse protocol. Fresh root 21-package ladder succeeded; these nine packages are freshly packed here. No installation, fixture or consumer build result is asserted by this precursor.',
  rootBuild:{command:'npm run build',sourceCandidate:builtCandidate,exitCode:0,path:buildLog,sha256:hash(log),packages:allBuilds,exitAttribution:'Integrator observed successful unified-exec completion before invoking this script; ladder uses fail-fast &&. Unchanged packages/global build inputs are equal; a changed Structure package has separate source/check attribution below.'},
  packageBuilds:[],packs:[],
};
for (const name of names) {
  const cwd=join(root,'packages',name);
  const changed=git(['diff','--name-only',builtCandidate,candidate,'--',`packages/${name}`]);
  if(changed && name!=='ui-structure-svelte')throw Error(`Package changed since ladder: ${name}`);
  const buildEvidence=changed?join(evidence,'structure-build-final.log'):buildLog;
  const buildBytes=readFileSync(buildEvidence);
  if(changed&&!buildBytes.toString('utf8').includes('svelte-check found 0 errors'))throw Error('Missing successful affected Structure check');
  const manifest=JSON.parse(readFileSync(join(cwd,'package.json'),'utf8'));
  const pack=JSON.parse(execFileSync(process.platform==='win32'?'npm.cmd':'npm',['pack','--json','--pack-destination',directory],{cwd,encoding:'utf8',shell:process.platform==='win32'}))[0];
  const path=join(directory,pack.filename);
  report.packageBuilds.push({name:manifest.name,mode:'fresh-build',sourceTree:git(['rev-parse',`${candidate}:packages/${name}`]),buildSourceCandidate:changed?candidate:builtCandidate,buildEvidencePath:buildEvidence,buildEvidenceSha256:hash(buildBytes),qualification:changed?'Fresh affected-package build after compatible Structure repair':'Fresh root ladder; exact package tree and global build inputs equal'});
  report.packs.push({name:manifest.name,path,sha256:hash(readFileSync(path)),reused:false,files:pack.files.map(file=>({path:file.path,sha256:hash(readFileSync(join(cwd,file.path)))}))});
}
const path=join(evidence,'same-candidate-build-pack.json');
writeFileSync(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({path,status:report.status,sourceCandidate:candidate,packages:report.packs.length,directory},null,2));
