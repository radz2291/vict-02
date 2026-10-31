import json,hashlib,pathlib,subprocess,tarfile,re,os
R=pathlib.Path('C:/Users/RZ1/.codex/worktrees/vict-architecture-realignment-20261030'); W=pathlib.Path.cwd(); E=pathlib.Path('docs/studio/foundation-evidence/node-suite-stress-20261031'); OLD=pathlib.Path('C:/Users/RZ1/.codex/worktrees/vict-edge-adapter-factory-recheck-20261031'); SOURCE='3e62f75d8337db767c8de6e7d214d520abcdce41'
def j(p):return json.loads(pathlib.Path(p).read_text(encoding='utf-8-sig'))
def h(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def git(*args,cwd=R):return subprocess.check_output(['git',*args],cwd=cwd).decode('utf8').strip()
def inv(p):return sorted(f.relative_to(p).as_posix() for f in p.rglob('*') if f.is_file())
errors=[]
def check(ok,msg):
 if not ok:errors.append(msg)
sealpath=R/E/'nested-final-production-seal.json'; seal=j(sealpath); stage=pathlib.Path(seal['stageRoot']); ip=stage/'studio-build-inputs.json'; inputs=j(ip)
check(seal['sourceCandidate']==SOURCE,'source identity');check(h(ip)==seal['sourceInputsSha256'],'input manifest identity');check(inputs['SourceCommit']==SOURCE and inputs['InputWorkingTreeClean'] and inputs['WorkspaceWorkingTreeClean'],'frozen input status')
check(h(R/'package-lock.json')==h(W/'package-lock.json')==seal['packageLockSha256'],'lock identity')
eol=[]; current=[]
for item in inputs['Inputs']:
 p=item['Path'];check(h(stage/p)==item['SHA256'],'stage input '+p)
 if h(W/p)!=item['SHA256']:
  normal=lambda b:b.replace(b'\r\n',b'\n')
  canonical=subprocess.check_output(['git','show',SOURCE+':'+p],cwd=W)
  check(normal((W/p).read_bytes())==normal((stage/p).read_bytes())==normal(canonical),'independent source '+p);eol.append(p)
 if h(R/p)!=item['SHA256']:current.append(p)
check(not current,'current input drift')
paths=['apps/studio/src','apps/studio/scripts','apps/studio/package.json','apps/studio/svelte.config.js','apps/studio/vite.config.ts','packages','package.json','package-lock.json','tsconfig.base.json']
drift=git('diff','--name-only',SOURCE,'--',*paths);untracked=git('ls-files','--others','--exclude-standard','--',*paths);check(not drift and not untracked,'production source drift/untracked')
links=[]
for item in inputs['DependencyLinks']:
 target=(stage/item['Path']).resolve();expected=(R/item['Path']).resolve();check(target==expected,'dependency link '+item['Path']);links.append({'path':item['Path'],'target':str(target),'expected':str(expected)})
new=seal['coreFiles']+seal['historicalProofFiles']+seal['addedPublicProofFiles'];old=seal['previousCoreFiles']+seal['historicalProofFiles']
check((len(seal['coreFiles']),len(seal['historicalProofFiles']),len(seal['addedPublicProofFiles']))==(305,90,3),'seal partition');check(seal['totalFiles']==398,'seal count')
for root,entries,n,label in [(pathlib.Path(seal['buildRoot']),new,398,'staged'),(R/'apps/studio/build',old,395,'previous live')]:
 expected=sorted(e['path'] for e in entries);check(len(entries)==n and len(set(expected))==n and inv(root)==expected,label+' complete membership')
 for item in entries:check(h(root/item['path'])==item['sha256'],label+' byte '+item['path'])
oldrecord=j(R/E/'graph3-port-row-activation.json');check(oldrecord['sourceCandidate']==seal['previousServingSource']=='bac786840d7519c041638e1b9d239d54efdf56f5','previous source');check(oldrecord['coreFiles']==seal['previousCoreFiles'] and oldrecord['historicalProofFiles']+oldrecord['addedPublicProofFiles']==seal['historicalProofFiles'],'prior seal chain')
compiled=[];summaries=[]
for name in ['contracts','ui','sdk','kernel','runtime','mastra','application']:
 own=OLD/'packages'/name/'dist';other=R/'packages'/name/'dist';ownfiles=inv(own);otherfiles=inv(other)
 check(ownfiles==otherfiles,'compiled membership '+name)
 # Unchanged package source supplies independent reuse provenance, not a fresh build claim.
 check(not git('diff','--name-only','272bab9a4196def110509d3bf4efac65edb948e1',SOURCE,'--','packages/'+name),'reused compiled source '+name)
 for p in otherfiles:
  check(h(own/p)==h(other/p),'independent compiled bytes '+name+'/'+p);compiled.append({'path':'packages/'+name+'/dist/'+p,'sha256':h(other/p)})
 summaries.append({'name':name,'filesMatched':len(otherfiles)})
cp=R/'docs/studio/foundation-evidence/architecture-realignment-20261030/vict-realignment-consumer-UjqZZp.json';c=j(cp);check(h(cp)==seal['consumerReportSha256'],'consumer report seal');check(c['sourceCandidate']==SOURCE and c['domTest']['passed'] and c['status'].startswith('PASS:'),'consumer status')
names=['contracts','ui','sdk','application','ui-svelte','ui-media-svelte','ui-flow-svelte'];check(sorted(p['name'] for p in c['packs'])==sorted('@victframework/'+n for n in names),'exact seven packs')
installed=0;packed=0;manifests=[]
for p in c['packs']:
 check(h(p['path'])==p['sha256'],'tarball '+p['name']);where=pathlib.Path(next(x['installed'] for x in c['installedByteComparison'] if x['name']==p['name']));package=p['name'].split('/')[-1]
 with tarfile.open(p['path'],'r:gz') as t:
  members={m.name.removeprefix('package/'):m for m in t.getmembers() if m.isfile()};check(sorted(members)==sorted(x['path'] for x in p['files']),'tar membership '+package)
  for item in p['files']:
   path=item['path'];data=t.extractfile(members[path]).read();check(hashlib.sha256(data).hexdigest()==item['sha256'],'packed bytes '+package+'/'+path);packed+=1
   check(h(R/'packages'/package/path)==item['sha256'],'workspace pack bytes '+package+'/'+path)
   if not path.startswith('dist/'):
    check((W/'packages'/package/path).read_bytes().replace(b'\r\n',b'\n')==data.replace(b'\r\n',b'\n'),'independent packed source '+package+'/'+path)
   if path!='package.json':check(h(where/path)==item['sha256'],'installed bytes '+package+'/'+path);installed+=1
  manifests.append({'name':p['name'],'tarballSha256':p['sha256'],'files':len(members)})
check(h(c['domTest']['log'])==c['domTest']['sha256'],'DOM proof log');output=pathlib.Path(c['consumer'])/'dist';prefix='client/foundation-owned-ports-UjqZZp/'
check(inv(output)==sorted(x['path'].removeprefix(prefix) for x in seal['addedPublicProofFiles']),'consumer complete output membership')
for x in seal['addedPublicProofFiles']:check(x['path'].startswith(prefix) and h(output/x['path'].removeprefix(prefix))==x['sha256'],'consumer output '+x['path'])
for x in c['outputFiles']:check(h(output/'assets'/x['name'])==x['sha256'],'consumer asset '+x['name'])
external=[]
for p in (pathlib.Path(seal['buildRoot'])/'server').rglob('*.js'):
 for m in re.finditer(r'''(?:from\s*|import\s*\()\s*['"](@victframework/[^'"]+)''',p.read_text(encoding='utf8')):external.append({'path':str(p),'module':m[1]})
check(not external,'external VICT server imports');check(seal['activationPerformed'] is False and seal['actualUiVerification']=='pending','seal activation state')
reviews=[]
for sha in seal['independentSourceReviews']:
 files=git('diff-tree','--no-commit-id','--name-only','-r',sha).splitlines(); reports=[p for p in files if p.endswith('REPORT.md') or p.endswith('INDEPENDENT.md')];check(bool(reports),'source review report '+sha);reviews.append({'commit':sha,'reportPaths':reports})
helperinfo=[]
for name in ['nested-final-production-seal-builder.ps1','nested-final-activation-helper.ps1']:
 p=R/E/name;s=p.read_text(encoding='utf-8-sig');check(SOURCE in s and '3e62f75d-stage' in s and '--others --exclude-standard' in s,'helper freeze guard '+name);helperinfo.append({'path':str(E/name),'sha256':h(p)})
check(seal['independentSourceReview']=='e4a4ec62eed78b608bcf9695ed9e599833f1aaa7' and seal['independentSourceReview'] in seal['independentSourceReviews'],'primary source review association')
activation=(R/E/'nested-final-activation-helper.ps1').read_text(encoding='utf-8-sig')
for fragment in ['Parameter(Mandatory=$true)', '$CampaignCheckpoint', 'vict-pre-nested-final-bac78684-20261031-build', '$artifactReview.sealSha256', '$artifactReview.actualUiVerified -ne $false', '127.0.0.25', 'Stop-Process', 'Move-Item -LiteralPath $build -Destination $backup']:
 check(fragment in activation,'activation guard '+fragment)
report={'schema':'vict.node-suite-independent-artifact-review@1','status':'FAIL' if errors else 'PASS','technicalActivationSupported':not errors,'actualUiVerified':False,'sourceCandidate':SOURCE,'sealSha256':h(sealpath),'sourceInputsSha256':h(ip),'packageLockSha256':h(R/'package-lock.json'),'inputsVerified':len(inputs['Inputs']),'currentInputMismatches':current,'checkoutLineEndingOnly':eol,'productionSourceDrift':drift,'untrackedProductionInputs':untracked,'dependencyLinks':links,'compiledWorkspaceFiles':compiled,'compiledDependencyComparison':summaries,'compiledComparisonBasis':str(OLD)+' owned prior artifacts; unchanged package source checked; no fresh compilation claimed','externalVictImports':external,'stagedFilesVerified':398,'oldFilesVerified':395,'historicalProofFilesVerified':90,'newConsumerProofFilesVerified':3,'installedPublicFilesVerified':installed,'packedPublicFilesVerified':packed,'sevenPackInventories':manifests,'consumerReportSha256':h(cp),'sourceReviewAssociations':reviews,'helperGuards':helperinfo,'activationPerformed':False,'actualUiVerification':'pending; owner native gate separate','scope':'Artifact association only. No independent source/package semantics verdict, actual app/native/browser verification, activation or Stage9 closure.','errors':errors}
(W/E/'nested-final-independent-artifact-association.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps({k:report[k] for k in ['status','sealSha256','inputsVerified','stagedFilesVerified','oldFilesVerified','installedPublicFilesVerified','packedPublicFilesVerified','errors']},indent=2));raise SystemExit(bool(errors))
