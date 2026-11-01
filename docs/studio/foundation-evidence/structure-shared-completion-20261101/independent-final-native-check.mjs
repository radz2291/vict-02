import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const base=join(process.cwd(),'docs/studio/foundation-evidence/structure-shared-completion-20261101');
const candidate='20e26253f0ec6aab20f480c1b3e537e2282938d8';
const digest=file=>createHash('sha256').update(readFileSync(join(base,file))).digest('hex');
const json=file=>JSON.parse(readFileSync(join(base,file),'utf8').replace(/^\uFEFF/,''));
const errors=[],check=(value,label)=>{if(!value)errors.push(label);};
const receipts=[];
for(const file of ['17-fresh-load-geometry.json','18-fresh-load-geometry.json','19-after-native-zoom-geometry.json']){
 const doc=json(file);check(doc.sourceCandidate===candidate,`${file}: wrong candidate`);
 const startup=!file.startsWith('19-');
 if(startup)check(doc.beforeCanvasInteraction===true,`${file}: startup provenance missing`);
 check(doc.edges.length===24,`${file}: expected 24 edges`);
 const ids=doc.edges.map(e=>`${e.owner}/${e.id}`);
 check(new Set(ids).size===24,`${file}: duplicate edge occurrence`);
 const counts=Object.fromEntries(['root','finS','finP'].map(owner=>[owner,doc.edges.filter(e=>e.owner===owner).length]));
 check(counts.root===20&&counts.finS===2&&counts.finP===2,`${file}: wrong owner counts`);
 const distances=[];
 for(const edge of doc.edges){
  for(const [tip,boundary,recorded] of [['start','source','sourceError'],['end','target','targetError']]){
   const x=edge[tip].x-edge[boundary].x,y=edge[tip].y-edge[boundary].y;
   check(Number.isFinite(x)&&Number.isFinite(y),`${file}: invalid coordinate`);
   check(Math.abs(x-edge[recorded].x)<1e-10&&Math.abs(y-edge[recorded].y)<1e-10,`${file}: inconsistent recorded error ${edge.owner}/${edge.id}/${tip}`);
   distances.push({owner:edge.owner,id:edge.id,tip,x,y,euclidean:Math.hypot(x,y)});
  }
 }
 const maxAxis=Math.max(...distances.flatMap(d=>[Math.abs(d.x),Math.abs(d.y)]));
 const maxEuclidean=Math.max(...distances.map(d=>d.euclidean));
 check(maxAxis<.01,`${file}: endpoint exceeds 0.01 screen CSS px`);
 if(startup){
  check(doc.frames.length===3&&new Set(doc.frames.map(f=>f.owner)).size===3,`${file}: missing owned frame`);
  for(const frame of doc.frames){check(frame.inert===false&&frame.alert.length===0,`${file}: unsupported frame ${frame.owner}`);check(Number(frame.scale)>0&&Number.isFinite(Number(frame.scale)),`${file}: invalid scale`);}
 }
 if(file.startsWith('18-'))check(doc.labels.length===44&&doc.labels.every(label=>label.font==='12px'),`${file}: typography mismatch`);
 receipts.push({file,sha256:digest(file),beforeCanvasInteraction:startup?true:false,edgeCount:doc.edges.length,ownerCounts:counts,maxAxisError:maxAxis,maxEuclideanError:maxEuclidean,frames:doc.frames??null,labelCount:doc.labels?.length??null});
}
const report={schema:'vict.structure-independent-final-native-recomputation@1',sourceCandidate:candidate,status:errors.length?'FAIL':'PASS',receipts,errors,scope:'Independent numeric and identity review of integrator native captures; reviewer did not operate the browser. Two fresh-load captures before canvas interaction supersede, and do not erase, retained adverse geometry14/15. Source/export and containment are separately checked.'};
writeFileSync(join(base,'independent-final-native-recomputation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
