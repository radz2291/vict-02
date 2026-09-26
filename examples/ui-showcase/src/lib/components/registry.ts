import { createComponentRegistry } from '@victframework/application/renderer';
import type { ComponentRegistry } from '@victframework/application/renderer';
import ShowcaseIsland from './ShowcaseIsland.svelte';
import ScheduleIsland from './ScheduleIsland.svelte';

/**
 * The trusted local component registry of this deployment (code islands
 * live OUTSIDE the serializable manifest). The plan carries only
 * cmp.island@1; the same factory is shared by the client page, the tests,
 * and the server so the deployed component identity always comes from the
 * SAME actual registry.
 */
export function createShowcaseRegistry(includePlanner = false): ComponentRegistry {
  const registry = createComponentRegistry('registry.showcase', '1');
  registry.register({
    componentId: 'cmp.island',
    revision: '1',
    implementation: ShowcaseIsland,
  });
  if (includePlanner)
    registry.register({
      componentId: 'cmp.request-planner',
      revision: '1',
      implementation: ScheduleIsland,
    });
  return registry;
}
