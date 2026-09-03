import {
  compileApplicationRelease,
  type ApplicationDataAdapter,
  type FrozenApplicationRelease,
} from '@vict/application';
import type { ApplicationPlan } from '@vict/application';
import { createVictRenderer, RENDERER_ID, RENDERER_REVISION } from '@vict/renderer-svelte';
import { createReferenceRegistry } from '$lib/components/registry';

/**
 * Application Release compilation from ACTUAL deployment objects.
 *
 * Release declarations are CLAIMS, not proof: the verification context is
 * sourced from the real renderer instance, the real component-registry
 * identity snapshot, and the real application-data adapter — never by
 * copying values back out of a manifest. The activation binding uses the
 * explicit `latest` selection policy (deferred selection requires no exact
 * activation reference).
 *
 * The application-data adapter is supplied by the caller: production wiring
 * passes the SQLite adapter (`application-server.sqlite.ts`), tests may pass
 * any conforming adapter — the release always verifies against the ACTUAL
 * adapter identities.
 */
export function compileReferenceRelease(
  plan: ApplicationPlan,
  data: ApplicationDataAdapter,
): FrozenApplicationRelease {
  const renderer = createVictRenderer();
  const registry = createReferenceRegistry();
  const result = compileApplicationRelease(
    {
      schema: 'vict.application-release@1',
      applicationId: plan.applicationId,
      applicationRevision: plan.applicationRevision,
      applicationVersion: plan.applicationVersion,
      renderer: { id: RENDERER_ID, revision: RENDERER_REVISION },
      components: {
        registryId: registry.registryId,
        revision: registry.revision,
        components: [...registry.identity().components],
      },
      dataAdapter: { id: data.id, revision: data.revision },
      victCompatibility: '^0.1.0',
      activation: { kind: 'policy', selection: 'latest' },
      provenance: { author: 'vict-reference-app', source: 'workspace' },
    },
    plan,
    {
      renderer: { id: renderer.id, revision: renderer.revision },
      componentRegistry: {
        registryId: registry.registryId,
        revision: registry.revision,
        components: [...registry.identity().components],
      },
      dataAdapter: { id: data.id, revision: data.revision },
    },
  );
  if (!result.ok) {
    throw new Error(`release compilation failed: ${JSON.stringify(result.issues)}`);
  }
  return result.release;
}
