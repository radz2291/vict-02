/** Compile the QA harness definition through the real SDK compiler → src/plan.json */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileQaPlan } from '../qa.definition.ts';

const here = dirname(fileURLToPath(import.meta.url));
const plan = compileQaPlan();
const out = join(here, '..', 'src', 'plan.json');
writeFileSync(out, JSON.stringify(plan, null, 2));
console.log(`plan.json written: routes=${plan.routes.length}, screens=${Object.keys(plan.screens ?? {}).length}`);
