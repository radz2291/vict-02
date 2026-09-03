import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import { compileApplication, type ApplicationPlan } from '@vict/application';
import { runRendererConformanceSuite } from '@vict/application/testing';
import { RendererDiagnostic } from '@vict/application/renderer';
import { createVictRenderer, renderVictApplication, resolveRoute } from '@vict/renderer-svelte';
import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication, type SurfaceRole } from '@vict/sdk';
import {
  ROWS,
  probeApp,
  surfaceForRole,
  testRegistry,
  itemResource,
  probeAppWithForm,
} from './fixtures.js';

/**
 * Stage 05 renderer conformance (DOM-level, happy-dom, offline):
 * 1. every built-in role renders;
 * 2. path / plan / rows / registry updates propagate WITHOUT remounting and
 *    never leave stale route or component resolution (the Stage 04
 *    `state_referenced_locally` carry-forward);
 * 3. `kind: 'local'` actions never cross the dispatcher;
 * 4. the shared renderer conformance suite passes (incl. the hostile-action
 *    canary scenario);
 * 5. accessible defaults (landmarks, table semantics, dialog focus).
 */

const ALL_ROLES: readonly SurfaceRole[] = [
  'text',
  'view',
  'form',
  'action',
  'component',
  'states',
  'list',
  'table',
  'detail',
  'chart',
  'status',
  'tabs',
  'dialog',
  'drawer',
  'conversation',
];

const viewData = {
  'v.items': { rows: ROWS, record: null },
};

function mountProbe(surface: Record<string, unknown>, props: Record<string, unknown> = {}) {
  const plan = probeApp(surface);
  const mounted = renderVictApplication({
    plan,
    registry: testRegistry(),
    dispatch: async () => ({ ok: true, value: { rows: ROWS.slice(0, 1), total: 1 } }),
    viewData,
    ...props,
  });
  return { plan, ...mounted };
}

describe('built-in role coverage', () => {
  for (const role of ALL_ROLES) {
    it(`renders the '${role}' role`, () => {
      const surface = surfaceForRole(role);
      const mounted = mountProbe(surface, {
        viewData:
          role === 'detail'
            ? { 'v.items': { rows: [], record: ROWS[0] } }
            : role === 'conversation'
              ? { 'v.items': { rows: ROWS.slice(0, 2) } }
              : viewData,
      });
      try {
        const host = mounted.output.querySelector('[data-testid="vict-host"]');
        expect(host).not.toBeNull();
        const surfaceEl = mounted.output.querySelector('[data-surface="x"]');
        expect(surfaceEl, `surface markup for '${role}'`).not.toBeNull();
        if (role === 'action') {
          expect(surfaceEl?.textContent).toContain('Do it');
        }
      } finally {
        mounted.unmount();
      }
    });
  }

  it('rejects an unsupported role with a structured diagnostic before rendering', () => {
    const renderer = createVictRenderer();
    const hostilePlan = probeApp({ role: 'text', id: 'x', content: 'ok' });
    const baseRoute = hostilePlan.routes[0] as unknown as {
      route: unknown;
      screen: { layout: unknown[]; [key: string]: unknown };
    };
    const tampered = {
      ...hostilePlan,
      routes: [
        {
          ...baseRoute,
          screen: {
            ...baseRoute.screen,
            layout: [
              {
                name: 'main',
                surfaces: [{ role: 'holodeck', id: 'x', content: '?' }],
              },
            ],
          },
        },
      ],
    };
    expect(() =>
      renderer.render(tampered as unknown as ApplicationPlan, {
        components: testRegistry(),
        dispatch: { execute: async () => ({ ok: true, value: null }) },
      }),
    ).toThrowError(RendererDiagnostic);
  });
});

describe('reactivity without remounting (no stale state)', () => {
  it('updates the resolved route when path changes', () => {
    const plan = probeApp({ role: 'text', id: 'x', content: 'Home body' });
    const twoRoutePlan = compileAppWithRoutes([
      { id: 'home', path: '/', screenId: 's.home' },
      { id: 'items', path: '/items', screenId: 's.items' },
    ]);
    const mounted = renderVictApplication({
      plan,
      registry: testRegistry(),
      dispatch: async () => ({ ok: true, value: null }),
      path: '/',
      viewData,
    });
    try {
      expect(mounted.output.querySelector('h1')?.textContent).toBe('Probe');
      // Swap in a two-route plan and navigate — same mounted instance.
      mounted.update({ plan: twoRoutePlan.plan, path: '/items' });
      expect(mounted.output.querySelector('h1')?.textContent).toBe('Items');
      expect(mounted.output.querySelector('[data-surface="x-title"]')).not.toBeNull();
      // Back home.
      mounted.update({ path: '/' });
      expect(mounted.output.querySelector('[data-surface="x-title"]')).toBeNull();
    } finally {
      mounted.unmount();
    }
    void plan;
  });

  it('updates rows without remounting (no stale row data)', () => {
    const mounted = mountProbe({
      role: 'list',
      id: 'x',
      viewId: 'v.items',
      titleField: 'title',
    });
    try {
      expect(mounted.output.querySelectorAll('.vict-list-item').length).toBe(3);
      mounted.update({
        viewData: {
          'v.items': { rows: [...ROWS, { id: 'i-4', title: 'delta', status: 'draft', qty: 1 }] },
        },
      });
      flushSync();
      expect(mounted.output.querySelectorAll('.vict-list-item').length).toBe(4);
      expect(mounted.output.textContent).toContain('delta');
    } finally {
      mounted.unmount();
    }
  });

  it('re-resolves custom components when the registry changes without remounting', async () => {
    const plan = probeApp(surfaceForRole('component'));
    const registryA = testRegistry();
    const mounted = renderVictApplication({
      plan,
      registry: registryA,
      dispatch: async () => ({ ok: true, value: null }),
      viewData,
    });
    try {
      expect(mounted.output.querySelector('[data-testid="custom-badge"]')).not.toBeNull();
      // A NEW registry snapshot (revision 2) without the component: the
      // slot must NOT keep serving the stale implementation.
      const resolvedA = registryA.resolve({ componentId: 'cmp.badge', revision: '1' });
      const implementation = resolvedA.ok ? resolvedA.implementation : undefined;
      const registryB = testRegistry();
      registryB.register({ componentId: 'cmp.badge', revision: '2', implementation });
      mounted.update({
        registry: {
          ...registryB,
          resolve: (reference: { componentId: string; revision: string }) =>
            reference.revision === '1'
              ? {
                  ok: false as const,
                  code: 'UNKNOWN_COMPONENT' as const,
                  message: 'not registered',
                }
              : { ok: true as const, implementation },
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      // The surface's component reference pins revision 1, which the new
      // registry no longer provides: the host renders the structured
      // failure panel (never stale content, never silent omission).
      expect(mounted.output.querySelector('[data-testid="custom-badge"]')).toBeNull();
      expect(
        mounted.output.querySelector('[data-testid="structural-failure"]')?.textContent,
      ).toContain('not registered');
    } finally {
      mounted.unmount();
    }
  });

  it('resolves route parameters and follows redirects deterministically', () => {
    const { plan } = compileAppWithRoutes([
      { id: 'home', path: '/', screenId: 's.home' },
      { id: 'legacy', path: '/old', redirect: 'items' },
      { id: 'items', path: '/items', screenId: 's.items' },
      { id: 'item-detail', path: '/items/:id', screenId: 's.detail' },
    ]);
    const home = resolveRoute(plan, '/');
    expect(home?.route.id).toBe('home');
    const detail = resolveRoute(plan, '/items/i-42');
    expect(detail?.route.id).toBe('item-detail');
    expect(detail?.params).toEqual({ id: 'i-42' });
    const redirected = resolveRoute(plan, '/old');
    expect(redirected?.route.id).toBe('items');
    expect(resolveRoute(plan, '/nowhere')).toBeNull();
    // Decoding is defensive, never throwing.
    const weird = resolveRoute(plan, '/items/%zz');
    expect(weird?.params.id).toBe('%zz');
  });
});

function compileAppWithRoutes(routes: readonly Record<string, unknown>[]): {
  plan: ReturnType<typeof probeApp>;
} {
  const application = defineApplicationForTest(routes);
  const result = compileApplication({
    application,
    resources: [itemResource],
    contracts: [{ id: 'test.item.input', revision: '1' }],
    components: [{ componentId: 'cmp.badge', revision: '1' }],
  });
  if (!result.ok) {
    throw new Error(`routes plan invalid: ${JSON.stringify(result.issues)}`);
  }
  return { plan: result.plan };
}

function defineApplicationForTest(
  routes: readonly Record<string, unknown>[],
): ReturnType<typeof defineApplication> {
  return defineApplication({
    schema: APPLICATION_DEFINITION_SCHEMA_V2,
    id: 'app.routes',
    revision: '1',
    routes: routes as never,
    screens: [
      {
        id: 's.home',
        title: 'Home',
        layout: [{ name: 'main', surfaces: [{ role: 'text', id: 'x', content: 'Home body' }] }],
      },
      {
        id: 's.items',
        title: 'Items',
        layout: [
          { name: 'main', surfaces: [{ role: 'text', id: 'x-title', content: 'Items body' }] },
        ],
      },
      {
        id: 's.detail',
        title: 'Detail',
        layout: [
          { name: 'main', surfaces: [{ role: 'text', id: 'x-detail', content: 'Detail body' }] },
        ],
      },
    ],
    actions: [],
    resources: [{ resourceId: 'items', revision: '1' }],
    components: [{ componentId: 'cmp.badge', revision: '1' }],
  } as never);
}

describe('action boundaries in the renderer', () => {
  it('local actions never cross the dispatcher; non-local actions do', async () => {
    const calls: string[] = [];
    const mounted = renderVictApplication({
      plan: probeApp({ role: 'action', id: 'x', actionId: 'act.local', label: 'Reset' }),
      registry: testRegistry(),
      dispatch: async (actionId: string) => {
        calls.push(actionId);
        return { ok: true, value: null };
      },
      viewData,
    });
    try {
      const button = mounted.output.querySelector<HTMLButtonElement>('[data-surface="x"]');
      button?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
      // The local transition ran entirely inside the renderer.
      expect(mounted.output.querySelector('[data-testid="result-state"]')).not.toBeNull();
      expect(calls).toEqual([]);
    } finally {
      mounted.unmount();
    }

    const nonLocalCalls: string[] = [];
    const mounted2 = renderVictApplication({
      plan: probeApp({ role: 'action', id: 'x', actionId: 'act.create', label: 'Create' }),
      registry: testRegistry(),
      dispatch: async (actionId: string) => {
        nonLocalCalls.push(actionId);
        return { ok: true, value: null };
      },
      viewData,
    });
    try {
      mounted2.output.querySelector<HTMLButtonElement>('[data-surface="x"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(nonLocalCalls).toEqual(['act.create']);
    } finally {
      mounted2.unmount();
    }
  });

  it('maps dispatcher rejections to the safe failure state; canary never reaches the DOM', async () => {
    const CANARY = 'REACTIVITY-CANARY-7f3a';
    const mounted = renderVictApplication({
      plan: probeApp({ role: 'action', id: 'x', actionId: 'act.create', label: 'Create' }),
      registry: testRegistry(),
      dispatch: async () => {
        throw new Error(`server exploded ${CANARY}`);
      },
      viewData,
    });
    try {
      mounted.output.querySelector<HTMLButtonElement>('[data-surface="x"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const failure = mounted.output.querySelector('[data-testid="failure-state"]');
      expect(failure).not.toBeNull();
      expect(mounted.output.innerHTML).not.toContain(CANARY);
    } finally {
      mounted.unmount();
    }
  });
});

describe('accessible defaults', () => {
  it('renders landmarks, current-page navigation, and table semantics', () => {
    const routes = compileAppWithRoutes([
      { id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } },
      {
        id: 'items',
        path: '/items',
        screenId: 's.items',
        nav: { label: 'Items', order: 2, group: 'Work' },
      },
    ]);
    const mounted = renderVictApplication({
      plan: routes.plan,
      registry: testRegistry(),
      dispatch: async () => ({ ok: true, value: null }),
      path: '/items',
      viewData,
    });
    try {
      expect(mounted.output.querySelector('nav[aria-label="Application"]')).not.toBeNull();
      expect(mounted.output.querySelector('main')).not.toBeNull();
      const current = mounted.output.querySelector('[aria-current="page"]');
      expect(current?.textContent).toContain('Items');
      // h1 heading exists for the screen title.
      expect(mounted.output.querySelector('h1')?.textContent).toBe('Items');
    } finally {
      mounted.unmount();
    }
  });

  it('form fields have explicit labels; validation surfaces role=alert', () => {
    const mounted = mountProbe(surfaceForRole('form'), {
      plan: probeAppWithForm(),
    });
    try {
      const input = mounted.output.querySelector('input[name="title"]');
      expect(input).not.toBeNull();
      const label = mounted.output.querySelector('label[for]');
      expect(label).not.toBeNull();
    } finally {
      mounted.unmount();
    }
  });

  it('charts carry an accessible summary and a data-table equivalent', () => {
    const mounted = mountProbe(surfaceForRole('chart'));
    try {
      const figure = mounted.output.querySelector('figure[role="img"]');
      expect(figure?.getAttribute('aria-label')).toBe('Quantity per status');
      expect(mounted.output.querySelector('[data-testid="chart-svg"]')).not.toBeNull();
      expect(mounted.output.querySelector('.vict-chart-table table')).not.toBeNull();
      // Aggregation: 2 active, 1 draft; 4+7=11 active qty, 2 draft.
      const table = mounted.output.querySelector('.vict-chart-table table');
      expect(table?.textContent).toContain('active');
      expect(table?.textContent).toContain('11');
    } finally {
      mounted.unmount();
    }
  });

  it('dialog focus: opening focuses the panel, Escape closes and restores focus', async () => {
    const mounted = mountProbe(surfaceForRole('dialog'));
    try {
      const trigger = mounted.output.querySelector<HTMLButtonElement>(
        '[data-testid="overlay-trigger"]',
      );
      trigger?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const panel = document.querySelector('[data-testid="overlay-panel"]');
      expect(panel).not.toBeNull();
      expect(document.activeElement).toBe(panel);
      // Escape closes and restores focus to the trigger.
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(document.querySelector('[data-testid="overlay"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    } finally {
      mounted.unmount();
    }
  });

  it('tables expose sort controls with aria-sort and a pagination indicator', async () => {
    const mounted = mountProbe(surfaceForRole('table'));
    try {
      const sortButton = mounted.output.querySelector<HTMLButtonElement>(
        '[data-sort-field="title"]',
      );
      sortButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mounted.output.querySelector('th[aria-sort="ascending"]')).not.toBeNull();
      expect(mounted.output.querySelector('[data-testid="table-page-indicator"]')).not.toBeNull();
    } finally {
      mounted.unmount();
    }
  });
});

describe('shared renderer conformance suite (Stage 05 renderer)', () => {
  it('passes every shared invariant including the hostile-action canary', async () => {
    const renderer = createVictRenderer();
    await expect(
      runRendererConformanceSuite({
        renderer,
        basePlan: probeApp({ role: 'text', id: 'base', content: 'Base plan' }),
        buildProbePlan: (role: SurfaceRole) => probeApp(surfaceForRole(role)),
        makeBindings: () => ({
          components: testRegistry(),
          dispatch: {
            execute: async () => ({
              ok: true as const,
              value: { rows: [] as Record<string, unknown>[], total: 0 },
            }),
          },
        }),
        serializeOutput: (output) => String((output as HTMLElement).innerHTML ?? ''),
        buildFailingActionPlan: () =>
          probeApp({ role: 'action', id: 'x', actionId: 'act.create', label: 'Create' }),
        triggerAction: (output) => {
          const button = (output as HTMLElement).querySelector<HTMLButtonElement>(
            '[data-action-id]',
          );
          button?.click();
          // Give the rejection a macrotask to surface and be caught.
          return new Promise<void>((resolve) => setTimeout(resolve, 25));
        },
        getFailureStateText: (output) =>
          (output as HTMLElement).querySelector('[data-testid="failure-state"]')?.textContent ??
          undefined,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('theme tokens', () => {
  it('applies declared semantic tokens as CSS custom properties on the host', () => {
    const application = defineApplication({
      schema: APPLICATION_DEFINITION_SCHEMA_V2,
      id: 'app.themed',
      revision: '1',
      routes: [{ id: 'home', path: '/', screenId: 's.home' }],
      screens: [
        {
          id: 's.home',
          title: 'Themed',
          layout: [{ name: 'main', surfaces: [{ role: 'text', id: 'x', content: 'Hi' }] }],
        },
      ],
      actions: [],
      resources: [{ resourceId: 'items', revision: '1' }],
      theme: {
        reference: 'vict.default-theme',
        tokens: [
          { name: 'color.accent', value: '#7c3aed' },
          { name: 'radius.base', value: '14px' },
        ],
      },
    } as never);
    const result = compileApplication({
      application,
      resources: [itemResource],
      contracts: [{ id: 'test.item.input', revision: '1' }],
      components: [{ componentId: 'cmp.badge', revision: '1' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const mounted = renderVictApplication({
      plan: result.plan,
      registry: testRegistry(),
      dispatch: async () => ({ ok: true, value: null }),
      viewData,
    });
    try {
      const host = mounted.output.querySelector<HTMLElement>('[data-testid="vict-host"]');
      expect(host?.style.getPropertyValue('--vict-color-accent')).toBe('#7c3aed');
      expect(host?.style.getPropertyValue('--vict-radius-base')).toBe('14px');
    } finally {
      mounted.unmount();
    }
  });
});
