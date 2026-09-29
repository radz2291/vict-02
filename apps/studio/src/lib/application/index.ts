export {
  studioApplication,
  compileStudioDefinitionPlan,
  resources,
  runsResource,
  runEventsResource,
  runWaitsResource,
  activationsResource,
  selectedActivationsResource,
  releasesResource,
  releaseSelectionsResource,
  auditEntriesResource,
  targetStatusResource,
} from './definition.js';
import type { ApplicationPlan } from '@victframework/application';
import { compileStudioDefinitionPlan } from './definition.js';

/**
 * REQUIRED EXPORT (interface signature — do not change):
 * the compiled, immutable Studio Application Plan.
 */
export function compileStudioPlan(): ApplicationPlan {
  return compileStudioDefinitionPlan();
}
