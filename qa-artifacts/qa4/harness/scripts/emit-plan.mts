/** Compile the QA harness definitions through the real SDK compiler → src/plan.json + src/plan-invalid.json */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileQaPlans } from '../qa.definition.ts';

const here = dirname(fileURLToPath(import.meta.url));
const plans = compileQaPlans();
writeFileSync(join(here, '..', 'src', 'plan.json'), JSON.stringify(plans.plan, null, 2));
writeFileSync(join(here, '..', 'src', 'plan-invalid.json'), JSON.stringify(plans.planInvalid, null, 2));
console.log(
  `plans written: routes=${plans.plan.routes.length}, screens=${Object.keys(plans.plan.screens ?? {}).length}; invalid routes=${plans.planInvalid.routes.length}`,
);
