import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const app=await import(pathToFileURL(resolve('apps/studio/build/server/chunks/application-l9MwEml9.js')));
const observed=JSON.parse(readFileSync('docs/studio/cycle-1-3/agent-stress-review/dom-observations.json','utf8').replace(/^\uFEFF/,''));
const available=[...new Set(app.s.flatMap(r=>r.create('inventory-example')).filter(n=>n.kind==='component').map(n=>n.definitionId))].sort();
const missing=available.filter(id=>!observed.definitionIds.includes(id));
const result={mode:'Canonical definition-ID coverage only; not counting visible controls as an interaction test',product:observed.product,registeredRecipes:app.s.length,availableDefinitionCount:available.length,observedDefinitionCount:observed.definitionIds.length,observedUnknown:observed.definitionIds.filter(id=>!available.includes(id)),missingCount:missing.length,missing};
writeFileSync('docs/studio/cycle-1-3/agent-stress-review/coverage-inventory.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
