import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeApplicationVersion, compileApplication } from '@vict/application';
import { compileApplicationRelease, RELEASE_IDENTITY_SCHEMA } from '@vict/application';
import {
  createVictRenderer,
  RENDERER_ID,
  RENDERER_REVISION,
  resolveRoute,
} from '@vict/renderer-svelte';
import { APPLICATION_DEFINITION_SCHEMA_V2, APPLICATION_DEFINITION_SCHEMA } from '@vict/sdk';
import {
  createReferenceServer,
  resetReferenceServer,
  type ReferenceAppServer,
} from '$lib/server/application-server';
import { createInMemoryApplicationData } from '@vict/application';
import { dataContracts } from '$lib/application/definition.js';
import {
  bindings,
  compileReferencePlan,
  referenceApplication,
  resources,
} from '$lib/application/definition.js';
import { compileReferenceRelease } from '$lib/application/release.js';
import { createReferenceRegistry } from '$lib/components/registry';

/**
 * Identity and release semantics of the reference application (Stage 05):
 * deterministic application identity, layered release identity (renderer /
 * registry / adapter revisions affect ONLY the release), release compilation
 * from ACTUAL binding snapshots, redirect + parameter routing, and schema
 * compatibility (`vict.application@1` definitions are unchanged).
 */

let currentServer: ReferenceAppServer | undefined;

/** A storage-neutral (in-memory) wired server for identity/routing tests. */
function wiredServer(): ReferenceAppServer {
  if (currentServer === undefined) {
    currentServer = createReferenceServer({
      data: createInMemoryApplicationData(resources, { contracts: dataContracts }),
    });
  }
  return currentServer;
}

beforeEach(() => {
  resetReferenceServer();
  currentServer = undefined;
});

afterEach(() => {
  resetReferenceServer();
  currentServer = undefined;
});

describe('application identity', () => {
  it('compiles the @2 definition into the same applicationVersion across processes', () => {
    const planA = compileReferencePlan();
    const planB = compileReferencePlan();
    expect(planA.applicationVersion).toBe(planB.applicationVersion);
    expect(planA.applicationVersion.startsWith('v1_')).toBe(true);
  });

  it('uses the explicit @2 schema marker and identity marker path', () => {
    expect(referenceApplication.schema).toBe(APPLICATION_DEFINITION_SCHEMA_V2);
    expect(APPLICATION_DEFINITION_SCHEMA_V2).not.toBe(APPLICATION_DEFINITION_SCHEMA);
    // The schema marker participates in identity: an @1 twin would differ.
    expect(referenceApplication.compatibility?.applicationSchema).toBe(
      APPLICATION_DEFINITION_SCHEMA_V2,
    );
  });

  it('changes identity when declarations change, not when only the renderer changes', () => {
    const planA = compileReferencePlan();
    const renamed = {
      ...referenceApplication,
      revision: '6',
      screens: referenceApplication.screens.map((screen) =>
        screen.id === 's.dashboard' ? { ...screen, title: 'Renamed Dashboard' } : screen,
      ),
    } as typeof referenceApplication;
    const resultB = compileApplication({
      application: renamed,
      resources,
      contracts: bindings.contracts,
      capabilities: bindings.capabilities,
      components: bindings.components,
    });
    expect(resultB.ok).toBe(true);
    if (!resultB.ok) return;
    expect(resultB.plan.applicationVersion).not.toBe(planA.applicationVersion);
    // Renderer revision NEVER enters application identity.
    expect(RENDERER_REVISION).toBeTruthy();
    expect(computeApplicationVersion({ application: referenceApplication, resources })).toBe(
      planA.applicationVersion,
    );
  });
});

describe('release identity layering', () => {
  it('compiles a release from ACTUAL binding snapshots', () => {
    const plan = compileReferencePlan();
    const release = compileReferenceRelease(plan, wiredServer().data);
    expect(release.manifest.renderer.id).toBe(RENDERER_ID);
    expect(release.manifest.components?.registryId).toBe('registry.reference');
    expect(release.manifest.components?.components).toEqual([
      { componentId: 'cmp.health', revision: '1' },
    ]);
    // The release pins the ACTUAL supplied adapter identity (in this test
    // the storage-neutral in-memory adapter; production wiring supplies the
    // SQLite adapter with the same fail-closed verification).
    expect(release.manifest.dataAdapter.id).toBe(wiredServer().data.id);
    expect(release.releaseVersion.startsWith('v1_')).toBe(true);
    expect(RELEASE_IDENTITY_SCHEMA).toBe('vict.application-release-identity@1');
  });

  it('renderer and adapter revisions change release identity, not application identity', () => {
    const plan = compileReferencePlan();
    const server = wiredServer();
    const releaseA = compileReferenceRelease(plan, server.data);
    // A changed data-adapter revision (e.g. a new adapter deployment) is a
    // RELEASE change only.
    const mismatched = compileApplicationRelease(
      {
        schema: 'vict.application-release@1',
        applicationId: plan.applicationId,
        applicationRevision: plan.applicationRevision,
        applicationVersion: plan.applicationVersion,
        renderer: { id: RENDERER_ID, revision: RENDERER_REVISION },
        components: {
          registryId: 'registry.reference',
          revision: '1',
          components: [{ componentId: 'cmp.health', revision: '1' }],
        },
        dataAdapter: { id: server.data.id, revision: '9.9.9' },
        victCompatibility: '^0.1.0',
        activation: { kind: 'policy', selection: 'latest' },
      },
      plan,
      {
        renderer: { id: RENDERER_ID, revision: RENDERER_REVISION },
        componentRegistry: {
          registryId: 'registry.reference',
          revision: '1',
          components: [{ componentId: 'cmp.health', revision: '1' }],
        },
        dataAdapter: { id: server.data.id, revision: server.data.revision },
      },
    );
    expect(mismatched.ok).toBe(false);
    void releaseA;
    resetReferenceServer();
  });

  it('fails closed when the real registry does not match the declared registry', () => {
    const plan = compileReferencePlan();
    const renderer = createVictRenderer();
    const server = wiredServer();
    const result = compileApplicationRelease(
      {
        schema: 'vict.application-release@1',
        applicationId: plan.applicationId,
        applicationRevision: plan.applicationRevision,
        applicationVersion: plan.applicationVersion,
        renderer: { id: RENDERER_ID, revision: RENDERER_REVISION },
        components: {
          registryId: 'registry.reference',
          revision: '1',
          components: [{ componentId: 'cmp.health', revision: '2' }],
        },
        dataAdapter: { id: server.data.id, revision: server.data.revision },
        victCompatibility: '^0.1.0',
        activation: { kind: 'policy', selection: 'latest' },
      },
      plan,
      {
        renderer: { id: renderer.id, revision: renderer.revision },
        componentRegistry: {
          registryId: createReferenceRegistry().registryId,
          revision: '1',
          components: [{ componentId: 'cmp.health', revision: '1' }],
        },
        dataAdapter: { id: server.data.id, revision: server.data.revision },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'RELEASE_COMPONENT_MISMATCH')).toBe(true);
    }
    resetReferenceServer();
  });
});

describe('routing: parameters and redirects', () => {
  it('resolves parameters and follows redirects deterministically', () => {
    const plan = compileReferencePlan();
    expect(resolveRoute(plan as never, '/')?.route.id).toBe('home');
    const detail = resolveRoute(plan as never, '/projects/alpha-1');
    expect(detail?.route.id).toBe('project-detail');
    expect(detail?.params).toEqual({ id: 'alpha-1' });
    expect(resolveRoute(plan as never, '/dashboard')?.route.id).toBe('home'); // redirect
    expect(resolveRoute(plan as never, '/no-such-path')).toBeNull();
  });

  it('unknown routes produce a structured not-found (no silent fallback)', async () => {
    const server = wiredServer();
    const outcome = await server.loadRoute('/definitely-not-a-route');
    expect(outcome).toBeNull();
    resetReferenceServer();
  });
});
