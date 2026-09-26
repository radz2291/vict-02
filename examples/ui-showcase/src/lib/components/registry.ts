import { createComponentRegistry } from '@victframework/application/renderer';
import type { ComponentRegistration, ComponentRegistry } from '@victframework/application/renderer';
import ShowcaseIsland from './ShowcaseIsland.svelte';
import ScheduleIsland from './ScheduleIsland.svelte';
import AgentSurface from './agent/AgentSurface.svelte';

/**
 * The trusted local component registry of this deployment (code islands
 * live OUTSIDE the serializable manifest). The plan carries only
 * component identities; the same factory is shared by the client page,
 * the tests, and the server so the deployed component identity always
 * comes from the SAME actual registry.
 *
 * Agent product surfaces register the LAZY wrapper by default (the
 * shared catch-all bundle never carries the islands). A caller may pass
 * explicit implementations instead (the eager test registry), which must
 * resolve the SAME component ids and revisions.
 */
export function createShowcaseRegistry(
  includePlanner = false,
  includeAgent = false,
  agentComponents?: readonly ComponentRegistration[],
): ComponentRegistry {
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
  if (agentComponents !== undefined) {
    for (const entry of agentComponents) registry.register(entry);
  } else if (includeAgent) {
    for (const componentId of ['cmp.session-picker', 'cmp.session-console', 'cmp.output-log']) {
      registry.register({
        componentId,
        revision: '1',
        implementation: AgentSurface,
      });
    }
  }
  return registry;
}
