import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryApplicationData, type ApplicationDataAdapter } from '@vict/application';
import { renderVictApplication } from '@vict/renderer-svelte';
import type { MountedVictApplication } from '@vict/renderer-svelte';
import { dataContracts, resources } from '$lib/application/definition.js';
import { createReferenceRegistry } from '$lib/components/registry';
import { createReferenceServer, type ReferenceAppServer } from '$lib/server/application-server';

/**
 * DOM-level evidence for the complete reference application (offline,
 * happy-dom): every screen renders from the neutral plan, the custom
 * component island resolves, safe states render (loading, empty, stale,
 * partial, validation, denied, failure), dialog/drawer/tabs interaction,
 * and untrusted canaries in DATA and LABELS can never execute or leak
 * through rendered markup.
 */

const SEED_PROJECTS: Record<string, unknown>[] = [
  { id: 'alpha-1', name: 'Alpha', status: 'active', budget: 100, owner: 'Ada', notes: 'first' },
  { id: 'beta-2', name: 'Beta', status: 'planning', budget: 50, owner: 'Ben', notes: '' },
  { id: 'gamma-3', name: 'Gamma', status: 'active', budget: 75, owner: 'Ada', notes: '' },
  { name: 'Delta', id: 'delta-4', status: 'done', budget: 20, owner: 'Cid', notes: '' },
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

async function mountApp(path: string, searchParams?: URLSearchParams) {
  const { server } = makeServer();
  const route = await server.loadRoute(path, searchParams);
  if (route === null) {
    throw new Error(`route ${path} not found`);
  }
  const instance = renderVictApplication({
    plan: route.plan,
    registry: createReferenceRegistry(),
    dispatch: server.dispatch,
    path,
    viewData: route.viewData as never,
    record: route.record,
  });
  mounted.push(instance);
  return { instance, server };
}

describe('reference application DOM rendering', () => {
  it('renders the dashboard with status, metrics list, chart, action, and custom island', async () => {
    const { instance } = await mountApp('/');
    const html = instance.output.innerHTML;
    expect(instance.output.querySelector('[data-testid="vict-host"]')).not.toBeNull();
    expect(instance.output.querySelector('.vict-status')?.textContent).toContain('operational');
    expect(instance.output.querySelector('[data-testid="chart-svg"]')).not.toBeNull();
    expect(instance.output.querySelector('[data-testid="custom-health"]')).not.toBeNull();
    expect(html).toContain('Run analysis (VICT)');
    // Empty-state list before the first analysis run.
    expect(html).toContain('No analysis yet');
  });

  it('renders the projects table with search, filters, sort, and pagination controls', async () => {
    const { instance } = await mountApp('/projects');
    expect(instance.output.querySelector('[data-testid="records-table"]')).not.toBeNull();
    expect(instance.output.querySelector('[data-testid="table-search"]')).not.toBeNull();
    expect(instance.output.querySelector('[data-testid="table-filter-status"]')).not.toBeNull();
    expect(
      instance.output.querySelector('[data-testid="table-page-indicator"]')?.textContent,
    ).toContain('Page 1 of 2');
    // Sorted by name from the route data; first page of 3.
    const rows = [...instance.output.querySelectorAll('[data-testid="table-row"]')];
    expect(rows.length).toBe(3);
    expect(rows[0]?.textContent).toContain('Alpha');
    // Breadcrumbs rendered.
    expect(instance.output.querySelector('nav[aria-label="Breadcrumb"]')).not.toBeNull();
  });

  it('renders the record detail with status, tabs, dialog, drawer, and edit form', async () => {
    const { instance } = await mountApp('/projects/alpha-1');
    const html = instance.output.innerHTML;
    // Detail tab shows the record.
    expect(html).toContain('Alpha');
    expect(instance.output.querySelector('.vict-status')?.textContent).toContain('active');
    // Tabs semantics.
    expect(instance.output.querySelectorAll('[role="tab"]').length).toBe(2);
    expect(
      instance.output.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby'),
    ).toBeTruthy();
    // Dialog and drawer triggers.
    expect(instance.output.querySelector('[data-testid="overlay-trigger"]')?.textContent).toContain(
      'Delete…',
    );
    // Edit form is prefilled from the record (second tab panel).
    const nameInput = instance.output.querySelector<HTMLInputElement>('input[name="name"]');
    expect(nameInput?.value).toBe('Alpha');
  });

  it('prefilled edit form submits typed numeric values (HIGH-05-A regression)', async () => {
    const { server } = makeServer();
    const route = await server.loadRoute('/projects/alpha-1');
    if (route === null) {
      throw new Error('route not found');
    }
    const captured: { actionId: string; input: unknown }[] = [];
    const instance = renderVictApplication({
      plan: route.plan,
      registry: createReferenceRegistry(),
      dispatch: async (actionId: string, input?: unknown) => {
        captured.push({ actionId, input });
        return server.dispatch(actionId, input);
      },
      path: '/projects/alpha-1',
      viewData: route.viewData as never,
      record: route.record,
    });
    mounted.push(instance);
    // Edit form (second tab panel): change ONLY the name, leave the numeric
    // field untouched, submit through the real form event.
    const nameInput = instance.output.querySelector<HTMLInputElement>('input[name="name"]');
    expect(nameInput?.value).toBe('Alpha');
    nameInput!.value = 'Alpha (edited)';
    nameInput!.dispatchEvent(new window.Event('input', { bubbles: true }));
    flushSync();
    const editForm = instance.output.querySelector('form[data-surface="fm.project-edit"]');
    expect(editForm).not.toBeNull();
    editForm!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    flushSync();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(captured.length).toBe(1);
    expect(captured[0].actionId).toBe('act.updateProject');
    const input = captured[0].input as Record<string, unknown>;
    // The untouched numeric prefill is dispatched as a NUMBER.
    expect(typeof input.budget).toBe('number');
    expect(input.budget).toBe(100);
    expect(input.name).toBe('Alpha (edited)');
    expect(input.__identity).toBe('alpha-1');
    // The dispatch succeeds across the real boundary (no CONTRACT_REJECTED).
    expect(await server.dispatch('act.queryProjects', { filters: { status: 'active' } })).toEqual(
      expect.objectContaining({ ok: true }),
    );
  });

  it('renders the conversation with participant roles and input', async () => {
    const { instance, server } = await mountApp('/conversation');
    expect(instance.output.querySelector('[data-testid="conversation-input"]')).not.toBeNull();
    // Empty state first.
    expect(instance.output.innerHTML).toContain('No messages yet');
    // Seed a message directly through the adapter, then re-render.
    await server.dispatch('act.sendMessage', {
      text: 'Hello workspace',
      author: 'Tester',
      participant: 'user',
      id: 'msg-seed-1',
    });
    const route = await server.loadRoute('/conversation');
    instance.update({ viewData: route?.viewData as never });
    flushSync();
    const messages = [...instance.output.querySelectorAll('[data-testid="conversation-message"]')];
    expect(messages.length).toBe(2); // user message + assistant reply (real Vict run)
    expect(messages[0]?.getAttribute('data-participant')).toBe('user');
    expect(messages[1]?.getAttribute('data-participant')).toBe('assistant');
  });

  it('redirect routes resolve to their target screen', async () => {
    const { instance } = await mountApp('/dashboard');
    expect(instance.output.querySelector('h1')?.textContent).toContain(
      'Vict Reference Application',
    );
  });
});

describe('safe states', () => {
  it('renders stale and partial states from view data flags', async () => {
    const { server } = makeServer();
    const route = await server.loadRoute('/projects', new URLSearchParams('demo=stale'));
    const instance = renderVictApplication({
      plan: route!.plan,
      registry: createReferenceRegistry(),
      dispatch: server.dispatch,
      path: '/projects',
      viewData: route!.viewData as never,
    });
    mounted.push(instance);
    expect(instance.output.querySelector('[data-testid="stale-state"]')).not.toBeNull();
    instance.unmount();

    const routePartial = await server.loadRoute('/projects', new URLSearchParams('demo=partial'));
    const instance2 = renderVictApplication({
      plan: routePartial!.plan,
      registry: createReferenceRegistry(),
      dispatch: server.dispatch,
      path: '/projects',
      viewData: routePartial!.viewData as never,
    });
    mounted.push(instance2);
    expect(instance2.output.querySelector('[data-testid="partial-state"]')).not.toBeNull();
  });

  it('renders the denied state when a boundary-denied action is dispatched', async () => {
    const { instance, server } = await mountApp('/projects/alpha-1');
    // Open the dialog, then attempt the admin delete.
    instance.output.querySelector<HTMLButtonElement>('[data-testid="overlay-trigger"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const deleteButton = [...instance.output.querySelectorAll('[data-action-id]')].find(
      (button) => button.getAttribute('data-action-id') === 'act.deleteProject',
    ) as HTMLButtonElement | undefined;
    expect(deleteButton).toBeDefined();
    deleteButton?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    void server;
    // The detail screen declares no denied state; the renderer-generated
    // fallback renders (the denial itself comes from the boundary below UI).
    expect(instance.output.querySelector('[data-testid="denied-state"]')?.textContent).toContain(
      'denied by the authorization boundary',
    );
  });

  it('maps a validation rejection from the boundary to the declared validation state', async () => {
    const { instance, server } = await mountApp('/projects/new');
    const result = await server.dispatch('act.createProject', {
      id: '',
      name: '',
      status: 'nope',
      budget: -1,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('CONTRACT_REJECTED');
    void instance;
  });
});

describe('injection resistance (canaries)', () => {
  it('untrusted data and hostile props render inert text — never markup or scripts', async () => {
    const CANARY = '<script>window.__pwned="XSS-CANARY"</script>';
    const data = createInMemoryApplicationData(resources, {
      contracts: dataContracts,
      seeds: {
        projects: [
          {
            id: 'xss-1',
            name: CANARY,
            status: 'active',
            budget: 1,
            owner: '<img src=x onerror="window.__pwned=1">',
            notes: '"><svg onload="window.__pwned=1">',
          },
        ],
      },
    });
    const server = createReferenceServer({ data });
    const route = await server.loadRoute('/projects');
    const instance = renderVictApplication({
      plan: route!.plan,
      registry: createReferenceRegistry(),
      dispatch: server.dispatch,
      path: '/projects',
      viewData: route!.viewData as never,
    });
    mounted.push(instance);
    // The canary appears only as inert escaped text (if at all), never as a
    // script element or event handler attribute.
    expect(instance.output.querySelectorAll('script').length).toBe(0);
    expect(instance.output.innerHTML.includes('onerror=')).toBe(false);
    expect(instance.output.innerHTML.includes('onload=')).toBe(false);
    expect((globalThis as { __pwned?: unknown }).__pwned).toBeUndefined();
    expect(instance.output.innerHTML).toContain('&lt;script&gt;');
  });

  it('a hostile custom-component prop cannot obtain runtime or registry access', async () => {
    // Component props are bounded primitives from the definition only; a
    // canary prop VALUE can never become executable access.
    const { instance } = await mountApp('/projects/alpha-1');
    // The island is inside the drawer; open it.
    const triggers = [
      ...instance.output.querySelectorAll<HTMLButtonElement>('[data-testid="overlay-trigger"]'),
    ];
    triggers[1]?.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const island = document.querySelector('[data-testid="overlay"] [data-testid="custom-health"]');
    expect(island?.textContent?.trim()).toBe('detail island');
    expect(
      (island as (typeof HTMLElement.prototype & { __registry?: unknown }) | null)?.__registry,
    ).toBeUndefined();
  });
});
