import { createComponentRegistry } from '@vict/application/renderer';
import type { ComponentRegistry } from '@vict/application/renderer';
import HealthBadge from './HealthBadge.svelte';

/**
 * The trusted local component registry of this deployment (code islands
 * live OUTSIDE the serializable manifest). The same factory is shared by
 * the client page, the DOM tests, and the server-side release compilation,
 * so the deployed component identity always comes from the SAME actual
 * registry — never re-declared text.
 */
export function createReferenceRegistry(): ComponentRegistry {
  const registry = createComponentRegistry('registry.reference', '1');
  registry.register({
    componentId: 'cmp.health',
    revision: '1',
    implementation: HealthBadge,
  });
  return registry;
}
