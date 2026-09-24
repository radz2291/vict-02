import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createInMemoryApplicationData,
  type ApplicationDataAdapter,
} from '@victframework/application';
import { renderVictApplication } from '@victframework/renderer-svelte';
import type { MountedVictApplication } from '@victframework/renderer-svelte';
import {
  compileReferencePlan,
  dataContracts,
  noteReadingTimeInputContract,
  noteReadingTimeOutputContract,
  referenceApplication,
  resources,
} from '$lib/application/definition.js';
import { createReferenceRegistry } from '$lib/components/registry';
import {
  createReferenceServer,
  resetReferenceServer,
  type ReferenceAppServer,
} from '$lib/server/application-server';

/**
 * Permanent renderer-level evidence for the reading-time region on the
 * notes screen: the region exists ONLY through the Application Definition
 * (declared screen structure, view binding, and capability action — no
 * ad-hoc markup), renders through the generic Vict host, and the estimate
 * is computed by a real Vict capability run across the server boundary.
 */

const SEED_PROJECTS: Record<string, unknown>[] = [
  { id: 'alpha-1', name: 'Alpha', status: 'active', budget: 100, owner: 'Ada', notes: 'first' },
  {
    id: 'beta-2',
    name: 'Beta',
    status: 'planning',
    budget: 50,
    owner: 'Ben',
    notes: 'word '.repeat(250).trim(),
  },
  { id: 'gamma-3', name: 'Gamma', status: 'active', budget: 75, owner: 'Ada', notes: '' },
];

function makeServer(): { server: ReferenceAppServer; data: ApplicationDataAdapter } {
  const data = createInMemoryApplicationData(resources, {
    contracts: dataContracts,
    seeds: { projects: SEED_PROJECTS },
  });
  const server = createReferenceServer({ data });
  return { server, data };
}

const mounted: MountedVictApplication[] = [];

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  for (const instance of mounted.splice(0)) {
    instance.unmount();
  }
});

async function mountNotesScreen() {
  const { server } = makeServer();
  const route = await server.loadRoute('/projects/alpha-1');
  if (route === null) {
    throw new Error('route not found');
  }
  const instance = renderVictApplication({
    plan: route.plan,
    registry: createReferenceRegistry(),
    dispatch: server.dispatch,
    path: '/projects/alpha-1',
    viewData: route.viewData as never,
    record: route.record,
  });
  mounted.push(instance);
  return { instance, server };
}

describe('reading-time region declared through the Application Definition', () => {
  it('extends the notes screen structure with an intro, action, and list region', () => {
    const screen = referenceApplication.screens.find((entry) => entry.id === 's.project-detail');
    expect(screen).toBeDefined();
    const overview = screen?.layout
      .flatMap((region) => region.surfaces)
      .find((surface) => surface.role === 'tabs');
    const overviewSurfaces = (
      overview as { tabs?: { name: string; surfaces: { id: string }[] }[] } | undefined
    )?.tabs?.find((tab) => tab.name === 'overview')?.surfaces;
    expect(overviewSurfaces?.map((surface) => surface.id)).toContain('t.readingTime-intro');
    expect(overviewSurfaces?.map((surface) => surface.id)).toContain('act.readingTime-btn');
    expect(overviewSurfaces?.map((surface) => surface.id)).toContain('ls.noteReadingTime');

    // The declared action is a real capability action with declared contracts.
    const action = referenceApplication.actions.find((entry) => entry.id === 'act.noteReadingTime');
    expect(action?.kind).toBe('capability');
    expect(action).toMatchObject({
      capabilityId: 'refapp.noteReadingTime',
      inputContractId: 'refapp.noteReadingTime.input',
      outputContractId: 'refapp.noteReadingTime.output',
    });

    // The region's list is bound through a declared view over the metrics resource.
    const view = referenceApplication.views.find((entry) => entry.viewId === 'v.noteReadingTime');
    expect(view).toMatchObject({ resourceId: 'metrics', resourceRevision: '1' });
  });

  it('the compiled plan keeps the region, its view, and its bindings', () => {
    const plan = compileReferencePlan();
    expect(plan.views['v.noteReadingTime']).toBeDefined();
    const action = plan.actions['act.noteReadingTime'];
    expect(action?.kind).toBe('capability');
    expect(plan.actions['act.noteReadingTime']).toBeDefined();
  });
});

describe('reading-time region rendering (generic Vict host)', () => {
  it('renders the declared region with its empty state before the first estimate', async () => {
    const { instance } = await mountNotesScreen();
    const region = instance.output.querySelector('[data-surface="ls.noteReadingTime"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('data-state')).toBe('empty');
    expect(instance.output.innerHTML).toContain('No reading-time estimate yet');
    expect(
      instance.output.querySelector('[data-surface="act.readingTime-btn"]')?.textContent,
    ).toContain('Estimate reading time');
  });

  it('computes estimates through a real Vict run and renders them in the region', async () => {
    const { instance, server } = await mountNotesScreen();
    const button = instance.output.querySelector<HTMLButtonElement>(
      '[data-surface="act.readingTime-btn"]',
    );
    expect(button).not.toBeNull();
    button!.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The action upserted one metric per note-bearing record (empty notes
    // contribute nothing): Alpha (1 word → 1 min) and Beta (250 words → 2 min).
    const route = await server.loadRoute('/projects/alpha-1');
    instance.update({ viewData: route?.viewData as never });
    flushSync();
    const region = instance.output.querySelector('[data-surface="ls.noteReadingTime"]');
    expect(region?.getAttribute('data-state')).toBeNull();
    const html = instance.output.innerHTML;
    expect(html).toContain('Reading time — Alpha');
    expect(html).toContain('1 min (1 words)');
    expect(html).toContain('Reading time — Beta');
    expect(html).toContain('2 min (250 words)');
    expect(html).not.toContain('Reading time — Gamma');
  });
});

describe('reading-time contracts (declared, fail-closed)', () => {
  it('rejects malformed input and malformed output documents', () => {
    expect(noteReadingTimeInputContract.parse({ note: 42 }).ok).toBe(false);
    expect(noteReadingTimeInputContract.parse(null).ok).toBe(false);
    expect(noteReadingTimeInputContract.parse({}).ok).toBe(false);
    expect(noteReadingTimeOutputContract.parse({ minutes: -1, words: 0 }).ok).toBe(false);
    expect(noteReadingTimeOutputContract.parse({ minutes: 1 }).ok).toBe(false);
    expect(noteReadingTimeOutputContract.parse({ minutes: '2', words: 10 }).ok).toBe(false);
  });

  it('accepts the exact shape the capability produces', () => {
    expect(noteReadingTimeInputContract.parse({ note: 'some content' })).toEqual({
      ok: true,
      value: { note: 'some content' },
    });
    expect(noteReadingTimeOutputContract.parse({ minutes: 2, words: 250 })).toEqual({
      ok: true,
      value: { minutes: 2, words: 250 },
    });
  });
});
