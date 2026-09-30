import { describe, expect, it } from 'vitest';
import { compileApplication, type ApplicationPlan } from '@victframework/application';
import { renderVictApplication, resolveRowDetailLink } from '@victframework/ui-svelte';
import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@victframework/sdk';
import { deriveUiPlan } from '@victframework/ui';
import { itemResource, testRegistry } from './fixtures.js';

/**
 * FT-1: GENUINE definition-driven row navigation through the REAL compiler
 * and the generic host. A declared rowDetail binding resolves to REAL anchor
 * hrefs (route table: routeId → path; parameters substituted from mapped
 * row fields); WITHOUT the binding the record grid renders no link at all.
 */

type Row = Record<string, unknown>;

/** Shorthand binding: route /items/:id, identity row field `id`. */
const BINDING = { routeId: 'item-detail', label: 'Open item', param: { id: 'id' } };

function compilePlan(surface: Record<string, unknown>): ApplicationPlan {
  const application = defineApplication({
    schema: APPLICATION_DEFINITION_SCHEMA_V2,
    id: 'app.row-detail',
    revision: '1',
    routes: [
      { id: 'list', path: '/', screenId: 's.list' },
      { id: 'item-detail', path: '/items/:id', screenId: 's.item-detail' },
    ],
    screens: [
      {
        id: 's.list',
        title: 'Items',
        layout: [{ name: 'main', surfaces: [surface as never] }],
      },
      {
        id: 's.item-detail',
        title: 'Item',
        layout: [{ name: 'main', surfaces: [{ role: 'text', id: 'x.detail', content: 'detail' }] }],
      },
    ],
    actions: [],
    resources: [{ resourceId: 'items', revision: '1' }],
    views: [
      { viewId: 'v.items', resourceId: 'items', resourceRevision: '1', fields: ['id', 'title'] },
    ],
  } as never);
  const result = compileApplication({
    application,
    resources: [itemResource],
    contracts: [],
    components: [],
  });
  if (!result.ok) throw new Error(`plan invalid: ${JSON.stringify(result.issues)}`);
  return result.plan;
}

const ROWS: readonly Row[] = [
  { id: 'i/1', title: 'one' },
  { id: 'i-2', title: 'two' },
];

function mount(plan: ApplicationPlan, options?: { navigate?: (path: string) => void }) {
  return renderVictApplication({
    plan,
    registry: testRegistry(),
    dispatch: async () => ({ ok: true, value: null }),
    path: '/',
    viewData: { 'v.items': { rows: ROWS, record: null } },
    navigate: options?.navigate,
  });
}

describe('FT-1 definition-driven row navigation (renderer)', () => {
  describe('resolveRowDetailLink (pure route resolution)', () => {
    it('resolves the binding to the route path with encoded whole-segment parameter substitution', () => {
      const link = resolveRowDetailLink(
        { routeId: 'item-detail', label: 'Open item', param: { id: 'id' } },
        [{ route: { id: 'item-detail', path: '/items/:id' }, screen: null }],
        { id: 'i/1' },
      );
      expect(link?.href).toBe(`/items/${encodeURIComponent('i/1')}`);
      expect(link?.label).toBe('Open item: i/1');
    });

    it('yields NOTHING for an unknown routeId (no broken link, honest absence)', () => {
      expect(
        resolveRowDetailLink({ routeId: 'missing', label: 'Open', param: {} }, [], { id: 'i' }),
      ).toBeUndefined();
    });

    it('yields NOTHING when a mapped row field is absent (unresolved target)', () => {
      expect(
        resolveRowDetailLink(
          { routeId: 'item-detail', label: 'Open', param: { id: 'id' } },
          [{ route: { id: 'item-detail', path: '/items/:id' }, screen: null }],
          {},
        ),
      ).toBeUndefined();
    });
  });

  describe('view record surface (DataView)', () => {
    it('renders one genuine link per row with the declared target; click navigates via the host', () => {
      const plan = compilePlan({ role: 'view', id: 'vw', viewId: 'v.items', rowDetail: BINDING });
      const navigated: string[] = [];
      const mounted = mount(plan, {
        navigate: (path) => {
          navigated.push(path);
        },
      });
      // One link per row; a real anchor href (genuine navigation semantics).
      const links = mounted.output.querySelectorAll('a[data-testid="view-row-link"]');
      expect(links.length).toBe(2);
      expect(links[0]!.getAttribute('href')).toBe(`/items/${encodeURIComponent('i/1')}`);
      expect(links[1]!.getAttribute('href')).toBe('/items/i-2');
      expect(links[0]!.getAttribute('aria-label')).toBe('Open item: i/1');
      expect(links[0]!.textContent?.trim()).toBe('Open item');
      // Mouse click is SPA navigation through the host (default prevented).
      links[0]!.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
      );
      expect(navigated).toEqual([`/items/${encodeURIComponent('i/1')}`]);
      mounted.unmount();
    });

    it('renders NO link when the binding is absent (negative criterion; baseline grid unchanged)', () => {
      const plan = compilePlan({ role: 'view', id: 'vw', viewId: 'v.items' });
      const mounted = mount(plan);
      expect(mounted.output.querySelectorAll('a[data-testid="view-row-link"]')).toHaveLength(0);
      expect(mounted.output.querySelectorAll('.vict-data-view td')).toHaveLength(2 * ROWS.length);
      // The derived intent itself carries nothing.
      expect(deriveUiPlan(plan as never).views['vw']?.rowDetail).toBeUndefined();
      mounted.unmount();
    });
  });

  describe('table surface (RecordsTable)', () => {
    it('renders a genuine row link column when the binding is declared', () => {
      const plan = compilePlan({ role: 'table', id: 't', viewId: 'v.items', rowDetail: BINDING });
      const navigated: string[] = [];
      const mounted = mount(plan, { navigate: (path) => navigated.push(path) });
      const links = mounted.output.querySelectorAll('a[data-testid="table-row-link"]');
      expect(links.length).toBe(2);
      expect(links[1]!.getAttribute('href')).toBe('/items/i-2');
      links[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(navigated).toEqual(['/items/i-2']);
      mounted.unmount();
    });

    it('renders no link column when the binding is absent (table negative)', () => {
      const plan = compilePlan({ role: 'table', id: 't', viewId: 'v.items' });
      const mounted = mount(plan);
      expect(mounted.output.querySelectorAll('a[data-testid="table-row-link"]')).toHaveLength(0);
      mounted.unmount();
    });
  });
});
