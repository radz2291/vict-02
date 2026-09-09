import { describe, expect, it } from 'vitest';
import { compileApplication, type ApplicationPlan } from '@victframework/application';
import { renderVictApplication } from '@victframework/renderer-svelte';
import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@victframework/sdk';
import { itemResource, testRegistry } from './fixtures.js';

/**
 * Navigation-group ordering (public renderer behavior).
 *
 * The governing route contract is ORDERED navigation semantics
 * (`ApplicationRoute` — "The routes array is ORDERED navigation semantics";
 * the compiled plan carries "Resolved routes in NAVIGATION order", and
 * route order is meaningful identity semantics). The renderer MUST
 * therefore present navigation groups in the order of their FIRST
 * OCCURRENCE in the ordered route list — never re-sorted by group name.
 * Within a group, the existing contract is unchanged: routes sort by the
 * declared `nav.order` hint, then by path (deterministic tie-break).
 *
 * These tests assert the public DOM behavior through the REAL compiler —
 * not a snapshot of the implementation.
 */

/** One declared nav route shorthand for the fixtures below. */
interface NavRouteSpec {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly group?: string;
  readonly order?: number;
  readonly redirect?: string;
}

export function compileNavApp(
  routes: readonly NavRouteSpec[],
  extra?: {
    readonly id?: string;
    readonly revision?: string;
  },
): ApplicationPlan {
  const screenIds = new Set<string>();
  for (const route of routes) {
    if (route.redirect === undefined) screenIds.add(`s.${route.id}`);
  }
  const application = defineApplication({
    schema: APPLICATION_DEFINITION_SCHEMA_V2,
    id: extra?.id ?? 'app.nav-order',
    revision: extra?.revision ?? '1',
    routes: routes.map((route) =>
      route.redirect !== undefined
        ? { id: route.id, path: route.path, redirect: route.redirect }
        : {
            id: route.id,
            path: route.path,
            screenId: `s.${route.id}`,
            nav: {
              label: route.label,
              ...(route.group !== undefined ? { group: route.group } : {}),
              ...(route.order !== undefined ? { order: route.order } : {}),
            },
          },
    ),
    screens: [...screenIds].map((screenId) => ({
      id: screenId,
      title: screenId,
      layout: [
        { name: 'main', surfaces: [{ role: 'text', id: `x.${screenId}`, content: screenId }] },
      ],
    })),
    actions: [],
    resources: [{ resourceId: 'items', revision: '1' }],
  } as never);
  const result = compileApplication({
    application,
    resources: [itemResource],
    contracts: [],
    components: [],
  });
  if (!result.ok) {
    throw new Error(`nav plan invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}

/** The rendered navigation sequence in DOM order: group labels and links. */
function navSequence(output: HTMLElement): readonly string[] {
  const nav = output.querySelector('#vict-nav');
  if (nav === null) return [];
  const out: string[] = [];
  for (const node of nav.querySelectorAll('.vict-nav-group-label, .vict-nav-link')) {
    out.push(
      node.classList.contains('vict-nav-group-label')
        ? `#${node.textContent?.trim()}`
        : String(node.textContent?.trim()),
    );
  }
  return out;
}

function mountPlan(plan: ApplicationPlan, path?: string) {
  return renderVictApplication({
    plan,
    registry: testRegistry(),
    dispatch: async () => ({ ok: true, value: null }),
    // Default to the first declared route so the host resolves a screen.
    path: path ?? plan.routes[0]?.route.path ?? '/',
  });
}

describe('navigation group order (first occurrence in the ordered route list)', () => {
  it('renders groups in the order of their first route occurrence when that order is non-alphabetical', () => {
    // Declared sequence: Reports → Alpha → Metrics (deliberately NOT the
    // alphabetical Alpha → Metrics → Reports).
    const plan = compileNavApp([
      { id: 'r1', path: '/reports', label: 'Reports', group: 'Reports', order: 1 },
      { id: 'r2', path: '/overview', label: 'Overview', group: 'Reports', order: 2 },
      { id: 'a1', path: '/ledger', label: 'Ledger', group: 'Alpha', order: 1 },
      { id: 'm1', path: '/charts', label: 'Charts', group: 'Metrics', order: 1 },
    ]);
    const mounted = mountPlan(plan);
    try {
      expect(navSequence(mounted.output)).toEqual([
        '#Reports',
        'Reports',
        'Overview',
        '#Alpha',
        'Ledger',
        '#Metrics',
        'Charts',
      ]);
    } finally {
      mounted.unmount();
    }
  });

  it('keeps alphabetically declared groups in alphabetical order (stable input)', () => {
    const plan = compileNavApp([
      { id: 'a1', path: '/accounts', label: 'Accounts', group: 'Alpha', order: 1 },
      { id: 'm1', path: '/metrics', label: 'Metrics', group: 'Metrics', order: 1 },
      { id: 'z1', path: '/zenith', label: 'Zenith', group: 'Zenith', order: 1 },
    ]);
    const mounted = mountPlan(plan);
    try {
      expect(navSequence(mounted.output)).toEqual([
        '#Alpha',
        'Accounts',
        '#Metrics',
        'Metrics',
        '#Zenith',
        'Zenith',
      ]);
    } finally {
      mounted.unmount();
    }
  });

  it('still orders routes within a group by the declared nav.order hint', () => {
    const plan = compileNavApp([
      // Declared deliberately REVERSED relative to the order hints.
      { id: 'b', path: '/b', label: 'Second', group: 'Work', order: 2 },
      { id: 'a', path: '/a', label: 'First', group: 'Work', order: 1 },
      { id: 'z', path: '/z', label: 'Third', group: 'Work', order: 3 },
    ]);
    const mounted = mountPlan(plan);
    try {
      expect(navSequence(mounted.output)).toEqual(['#Work', 'First', 'Second', 'Third']);
    } finally {
      mounted.unmount();
    }
  });

  it('keeps the deterministic path tie-break when nav.order is equal or absent', () => {
    const plan = compileNavApp([
      { id: 'late', path: '/zeta', label: 'Zeta', group: 'Work' },
      { id: 'mid', path: '/mu', label: 'Mu', group: 'Work', order: 5 },
      { id: 'early', path: '/alpha', label: 'Alpha', group: 'Work' },
      { id: 'tied', path: '/beta', label: 'Beta', group: 'Work', order: 5 },
    ]);
    const mounted = mountPlan(plan);
    try {
      // order 5 group members (mu, beta) sort by path; order-0 members
      // (alpha, zeta) precede them, also by path.
      expect(navSequence(mounted.output)).toEqual(['#Work', 'Alpha', 'Zeta', 'Beta', 'Mu']);
    } finally {
      mounted.unmount();
    }
  });

  it('anchors repeated and interleaved groups at their first occurrence and collects every member', () => {
    const plan = compileNavApp([
      { id: 'a1', path: '/a1', label: 'A1', group: 'Aurora', order: 2 },
      { id: 'b1', path: '/b1', label: 'B1', group: 'Borealis', order: 1 },
      { id: 'a2', path: '/a2', label: 'A2', group: 'Aurora', order: 1 },
      { id: 'b2', path: '/b2', label: 'B2', group: 'Borealis', order: 2 },
      { id: 'a3', path: '/a3', label: 'A3', group: 'Aurora', order: 3 },
    ]);
    const mounted = mountPlan(plan);
    try {
      // Aurora anchors at route 1; ALL Aurora routes render together in
      // nav.order order (A2, A1, A3); Borealis anchors at its first
      // occurrence position (after Aurora's anchor, before Aurora's
      // later members re-declare it — interleaving never splits a group).
      expect(navSequence(mounted.output)).toEqual([
        '#Aurora',
        'A2',
        'A1',
        'A3',
        '#Borealis',
        'B1',
        'B2',
      ]);
    } finally {
      mounted.unmount();
    }
  });

  it('keeps ungrouped nav routes unlabeled and anchored at their first occurrence', () => {
    const plan = compileNavApp([
      { id: 'g1', path: '/g1', label: 'Grouped', group: 'Zulu', order: 1 },
      { id: 'u1', path: '/u1', label: 'Solo', order: 2 },
      { id: 'u2', path: '/u2', label: 'Duet', order: 1 },
      { id: 'g2', path: '/g2', label: 'Also Grouped', group: 'Zulu', order: 2 },
    ]);
    const mounted = mountPlan(plan);
    try {
      // The ungrouped collection renders as its own (unlabeled) section at
      // the position of its first member; members sort by nav.order
      // (Duet declares order 1, Solo order 2).
      expect(navSequence(mounted.output)).toEqual([
        '#Zulu',
        'Grouped',
        'Also Grouped',
        'Duet',
        'Solo',
      ]);
      // Ungrouped routes never introduce a label.
      const labels = [...mounted.output.querySelectorAll('.vict-nav-group-label')].map((node) =>
        node.textContent?.trim(),
      );
      expect(labels).toEqual(['Zulu']);
    } finally {
      mounted.unmount();
    }
  });

  it('uses the same semantic order for desktop and mobile presentation and preserves keyboard policy', async () => {
    const plan = compileNavApp([
      { id: 'w1', path: '/w1', label: 'One', group: 'Zebra', order: 1 },
      { id: 'y1', path: '/y1', label: 'Two', group: 'Yak', order: 1 },
      { id: 'w2', path: '/w2', label: 'Three', group: 'Zebra', order: 2 },
    ]);
    const mounted = mountPlan(plan, '/y1');
    try {
      // ONE landmark serves both form factors (the mobile presentation is
      // the same nav shown as an in-flow panel below the 720px breakpoint).
      const navs = mounted.output.querySelectorAll('nav[aria-label="Application"]');
      expect(navs.length).toBe(1);
      expect(navSequence(mounted.output)).toEqual(['#Zebra', 'One', 'Three', '#Yak', 'Two']);
      // Current-page semantics remain intact with grouped navigation.
      const current = mounted.output.querySelector('[aria-current="page"]');
      expect(current?.textContent?.trim()).toBe('Two');

      // Mobile toggle: aria-expanded flips, the in-flow panel opens, and
      // the link sequence is unchanged (no re-ordering between form
      // factors or menu states).
      const toggle = mounted.output.querySelector<HTMLButtonElement>('.vict-nav-toggle');
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
      toggle?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(toggle?.getAttribute('aria-expanded')).toBe('true');
      expect(mounted.output.querySelector('#vict-nav')?.classList.contains('vict-nav-open')).toBe(
        true,
      );
      expect(navSequence(mounted.output)).toEqual(['#Zebra', 'One', 'Three', '#Yak', 'Two']);
      // Escape inside the open nav closes it and restores focus to the
      // control (declared keyboard policy).
      const link = mounted.output.querySelector<HTMLElement>('#vict-nav .vict-nav-link');
      link?.focus();
      link?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement?.classList.contains('vict-nav-toggle')).toBe(true);
    } finally {
      mounted.unmount();
    }
  });

  it('recalculates group order reactively when the application plan is replaced', () => {
    const first = compileNavApp(
      [
        { id: 'a1', path: '/a1', label: 'A1', group: 'Alpha', order: 1 },
        { id: 'b1', path: '/b1', label: 'B1', group: 'Beta', order: 1 },
      ],
      { id: 'app.nav-order', revision: '1' },
    );
    const second = compileNavApp(
      [
        { id: 'b1', path: '/b1', label: 'B1', group: 'Beta', order: 1 },
        { id: 'a1', path: '/a1', label: 'A1', group: 'Alpha', order: 1 },
      ],
      { id: 'app.nav-order', revision: '2' },
    );
    const mounted = mountPlan(first);
    try {
      expect(navSequence(mounted.output)).toEqual(['#Alpha', 'A1', '#Beta', 'B1']);
      // Same mounted instance, new plan: the declared order of the NEW
      // plan's routes drives the presentation — no remount, no stale nav.
      mounted.update({ plan: second });
      expect(navSequence(mounted.output)).toEqual(['#Beta', 'B1', '#Alpha', 'A1']);
      // And back.
      mounted.update({ plan: first });
      expect(navSequence(mounted.output)).toEqual(['#Alpha', 'A1', '#Beta', 'B1']);
    } finally {
      mounted.unmount();
    }
  });

  it('leaves compiled-plan and application-identity behavior unchanged', () => {
    const routes: readonly NavRouteSpec[] = [
      { id: 'n1', path: '/one', label: 'One', group: 'Zulu', order: 1 },
      { id: 'n2', path: '/two', label: 'Two', group: 'Alpha', order: 1 },
      { id: 'n3', path: '/legacy', label: 'Legacy', redirect: 'n1' },
    ];
    const plan = compileNavApp(routes);
    // The compiled plan preserves the DECLARED route order (the renderer's
    // ordering input) — including redirect routes, in position.
    expect(plan.routes.map((entry) => entry.route.id)).toEqual(['n1', 'n2', 'n3']);

    // Rendering never mutates the plan (immutability contract).
    const before = JSON.stringify(plan.toJSON());
    const mounted = mountPlan(plan);
    try {
      expect(navSequence(mounted.output)).toEqual(['#Zulu', 'One', '#Alpha', 'Two']);
    } finally {
      mounted.unmount();
    }
    expect(JSON.stringify(plan.toJSON())).toBe(before);

    // Route order is meaningful IDENTITY semantics (the governing
    // contract that carries group-order intent): the same declarations in
    // a different route order produce a DIFFERENT applicationVersion,
    // while recompiling the same declaration is deterministic.
    const reordered = compileNavApp(
      [
        { id: 'n2', path: '/two', label: 'Two', group: 'Alpha', order: 1 },
        { id: 'n1', path: '/one', label: 'One', group: 'Zulu', order: 1 },
        { id: 'n3', path: '/legacy', label: 'Legacy', redirect: 'n1' },
      ],
      { id: 'app.nav-order', revision: '1' },
    );
    expect(reordered.applicationVersion).not.toBe(plan.applicationVersion);
    expect(compileNavApp(routes).applicationVersion).toBe(plan.applicationVersion);
  });
});
