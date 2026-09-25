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
  referenceApplication,
  resources,
} from '$lib/application/definition.js';
import {
  buildRuntime,
  createReferenceServer,
  type ReferenceAppServer,
} from '$lib/server/application-server';
import { notesPack } from '@victframework/notes-pack';
import { createReferenceRegistry } from '$lib/components/registry';

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

    // The declared action is a real capability action bound to the
    // capability pack's declared `notes.readingTime@1` and its declared
    // contracts — NOT to an app-local duplicate capability.
    const action = referenceApplication.actions.find((entry) => entry.id === 'act.noteReadingTime');
    expect(action?.kind).toBe('capability');
    expect(action).toMatchObject({
      capabilityId: 'notes.readingTime',
      inputContractId: 'notes.text',
      outputContractId: 'notes.readingTime',
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

describe("reading-time contracts (the pack's declared contracts, fail-closed)", () => {
  const binding = notesPack.bindings.capabilities.find((entry) => entry.id === 'notes.readingTime');
  it('rejects malformed input and malformed output documents', () => {
    expect(binding?.input?.parse({ title: 42 }).ok).toBe(false);
    expect(binding?.input?.parse(null).ok).toBe(false);
    expect(binding?.input?.parse({}).ok).toBe(false);
    // The pack's declared output contract is a strict type/shape check
    // (numbers for minutes and words, both present); type violations and
    // missing fields fail closed.
    expect(binding?.output?.parse({ minutes: '2', words: 10 }).ok).toBe(false);
    expect(binding?.output?.parse({ minutes: true, words: 10 }).ok).toBe(false);
    expect(binding?.output?.parse({ minutes: 1 }).ok).toBe(false);
    expect(binding?.output?.parse({ minutes: 2, words: '250' }).ok).toBe(false);
    expect(binding?.output?.parse(null).ok).toBe(false);
  });

  it('accepts the exact shape the pack capability produces', () => {
    expect(binding?.input?.parse({ title: 'some content' })).toEqual({
      ok: true,
      value: { title: 'some content' },
    });
    expect(binding?.output?.parse({ minutes: 2, words: 250 })).toEqual({
      ok: true,
      value: { minutes: 2, words: 250 },
    });
  });
});

describe('capability identity and execution path (pack-installed, not duplicated)', () => {
  /**
   * These tests pin WHICH capability executes: the capability pack's own
   * `notes.readingTime@1`, installed through `installCapabilityPack` (the
   * Stage 04 supported registration path). A second app-local calculation
   * with matching output CANNOT satisfy this suite: pack installation is
   * an atomic all-or-nothing batch, so the pack's sibling capabilities and
   * contracts must be registered too; the duplicate app-local id must be
   * absent; the declared action must reference the pack's ids; and the
   * input contract must be the pack's `notes.text@1` shape ({ title }),
   * which rejects the old app-local { note } shape.
   */
  it("activates a probe graph on notes.readingTime over the pack's notes.text contract", async () => {
    const runtime = buildRuntime();
    const activation = await runtime.activate({
      id: 'g.probe.readingTime',
      entry: 'only',
      nodes: [{ id: 'only', capability: 'notes.readingTime', input: 'notes.text' }],
      edges: [],
    });
    expect(activation.ok).toBe(true);
    if (!activation.ok) return;
    const run = await runtime.run({ title: 'word '.repeat(250).trim() }, { mode: 'normal' });
    expect(run.status).toBe('completed');
    expect(run.output).toEqual({ minutes: 2, words: 250 });
  });

  it('the whole pack is installed atomically: sibling capabilities and contracts resolve', async () => {
    const runtime = buildRuntime();
    const formatActivation = await runtime.activate({
      id: 'g.probe.format',
      entry: 'only',
      nodes: [{ id: 'only', capability: 'notes.format', input: 'notes.text' }],
      edges: [],
    });
    expect(formatActivation.ok).toBe(true);
    if (formatActivation.ok) {
      const run = await runtime.run({ title: 'hello vict' }, { mode: 'normal' });
      expect(run.status).toBe('completed');
      expect(run.output).toEqual({ formatted: 'HELLO VICT', length: 10 });
    }
    const statsActivation = await runtime.activate({
      id: 'g.probe.stats',
      entry: 'only',
      nodes: [{ id: 'only', capability: 'notes.stats', input: 'notes.text' }],
      edges: [],
    });
    expect(statsActivation.ok).toBe(true);
  });

  it('the app-local duplicate id refapp.noteReadingTime is NOT registered', async () => {
    const runtime = buildRuntime();
    const activation = await runtime.activate({
      id: 'g.probe.duplicate',
      entry: 'only',
      nodes: [
        { id: 'only', capability: 'refapp.noteReadingTime', input: 'refapp.noteReadingTime.input' },
      ],
      edges: [],
    });
    expect(activation.ok).toBe(false);
  });

  it("the pack's frozen binding invoke produces exactly what the server dispatch upserts", async () => {
    const binding = notesPack.bindings.capabilities.find(
      (entry) => entry.id === 'notes.readingTime',
    );
    expect(Object.isFrozen(notesPack.bindings.capabilities)).toBe(true);
    const { server } = makeServer();
    const result = await server.dispatch('act.noteReadingTime');
    expect(result.ok).toBe(true);
    const metrics = (result.value as { metrics: { id: string; value: string }[] }).metrics;
    // Alpha: 'first' (1 word) and Beta: 250 words — the pack binding's own
    // invoke decides the values; the server adds no calculation of its own.
    const packOutput = (content: string) => {
      const parsedInput = binding?.input?.parse({ title: content });
      expect(parsedInput?.ok).toBe(true);
      const raw = binding?.invoke(parsedInput?.value);
      const parsedOutput = binding?.output?.parse(raw);
      expect(parsedOutput?.ok).toBe(true);
      return parsedOutput?.value as { minutes: number; words: number };
    };
    const alpha = packOutput('first');
    const beta = packOutput('word '.repeat(250).trim());
    expect(metrics).toContainEqual({
      id: 'rt-alpha-1',
      label: 'Reading time — Alpha',
      value: `${alpha.minutes} min (${alpha.words} words)`,
    });
    expect(metrics).toContainEqual({
      id: 'rt-beta-2',
      label: 'Reading time — Beta',
      value: `${beta.minutes} min (${beta.words} words)`,
    });
    expect(metrics).toHaveLength(2);
  });

  it("the pack's notes.text contract rejects the old app-local { note } input shape", () => {
    const binding = notesPack.bindings.capabilities.find(
      (entry) => entry.id === 'notes.readingTime',
    );
    // The pre-correction app defined its own { note: string } input
    // contract. The pack contract is the ONLY registered input contract for
    // the reading-time capability, and it rejects that shape.
    expect(binding?.input?.parse({ note: 'legacy shape' }).ok).toBe(false);
    expect(binding?.input?.parse({ title: 'pack shape' }).ok).toBe(true);
  });
});
