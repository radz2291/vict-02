import {readFileSync,writeFileSync} from 'node:fs';
import {compileUiDocument,canonicalUiDocument,defaultSemanticElementCatalog} from '../../../packages/ui/dist/index.js';
const document=JSON.parse(readFileSync('docs/studio/cycle-1-4/independent-browser-fixture.json','utf8'));
const result=compileUiDocument(document,defaultSemanticElementCatalog());
if(!result.ok)throw Error(JSON.stringify(result));
const canonical=canonicalUiDocument(document);
const evidence={candidate:'0c3cee81fb02345f07b26e92acb2d2eb5463b203',fixtureId:document.id,fixtureNodes:Object.keys(document.nodes).length,contentDigest:canonical.contentDigest,compiled:true,evidence:'Canonical compile/source only. Apply through visible Source UI; no browser/store injection.'};
writeFileSync('docs/studio/cycle-1-4/independent-browser-fixture-compile.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence));
