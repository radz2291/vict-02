import { describe, expect, it } from 'vitest';
import { renderVictApplication } from '@victframework/ui-svelte';
import type { VictPlanView } from '@victframework/ui-svelte';
import { createShowcaseServer } from '../src/lib/server/application-server.js';
import { createShowcaseRegistry } from '../src/lib/components/registry.js';

/**
 * DOM-level route rendering (P6D): key routes mount through the REAL
 * renderer against the REAL compiled plan, adapter-fed data, and the
 * trusted registry, without a page error and with the expected visible
 * capability on each route.
 */

function mountInto(
  body: HTMLElement,
  plan: VictPlanView,
  path: string,
  viewData: Record<string, unknown>,
  record: Record<string, unknown> | null,
): void {
  const registry = createShowcaseRegistry();
  renderVictApplication({
    plan,
    registry,
    dispatch: async () => ({ ok: true, value: null }),
    path,
    viewData,
    record,
    target: body,
  });
}

const SHOWCASE_ROUTES = [
  { route: '/', heading: 'VICT UI Showcase' },
  { route: '/ops', heading: 'Pusat Operasi' },
  { route: '/ops/tickets/OPS-1042', heading: 'Rekod tiket' },
  { route: '/trading', heading: 'Market Overview' },
  { route: '/trading/instruments/XAUUSD', heading: 'Instrumen' },
  { route: '/trading/rotation', heading: 'Rotation / Breakout Study' },
  { route: '/agent', heading: 'Agent Sessions' },
  { route: '/agent/sessions/AGT-2201', heading: 'Ruang Kerja Ejen' },
  { route: '/quellight', heading: 'Quellight' },
  { route: '/quellight/world', heading: 'Dunia Bersama' },
  { route: '/workflow', heading: 'Workflow / Governance' },
  { route: '/workflow/instances/WF-1042', heading: 'Instans aliran kerja' },
  { route: '/analytics', heading: 'Executive Analytics' },
  { route: '/gallery', heading: 'Component Gallery' },
  { route: '/stress', heading: 'Stress Lab' },
  { route: '/review', heading: 'Owner Review' },
] as const;

describe('showcase DOM rendering (P6D)', () => {
  it('mounts every key route through the real renderer with the expected screen title', async () => {
    const server = createShowcaseServer();
    try {
      for (const scenario of SHOWCASE_ROUTES) {
        const route = await server.loadRoute(scenario.route);
        expect(route, scenario.route).not.toBeNull();
        const host = document.createElement('div');
        document.body.replaceChildren(host);
        mountInto(
          host,
          route!.plan as unknown as VictPlanView,
          scenario.route,
          route!.viewData,
          route!.record,
        );
        const text = host.textContent ?? '';
        expect(text, scenario.route).toContain(scenario.heading);
        // The shell is present on every mounted route.
        expect(host.querySelector('[data-testid="vict-host"]')).not.toBeNull();
      }
    } finally {
      (server.data as { close?: () => void }).close?.();
    }
  });

  it('the gallery mounts the custom island and the stress table renders 25 rows of the 30-column table', async () => {
    const server = createShowcaseServer();
    try {
      const gallery = await server.loadRoute('/gallery');
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      mountInto(
        host,
        gallery!.plan as unknown as VictPlanView,
        '/gallery',
        gallery!.viewData,
        gallery!.record,
      );
      expect(host.querySelector('[data-component="cmp.island"]')).not.toBeNull();
      expect(host.querySelector('[data-testid="custom-island"]')).not.toBeNull();

      const stress = await server.loadRoute('/stress');
      const stressHost = document.createElement('div');
      document.body.replaceChildren(stressHost);
      mountInto(
        stressHost,
        stress!.plan as unknown as VictPlanView,
        '/stress',
        stress!.viewData,
        stress!.record,
      );
      const rows = stressHost.querySelectorAll('[data-testid="table-row"]').length;
      expect(rows).toBe(25); // pageSize 25 of the 110-row stress table
      const columns = stressHost.querySelectorAll('[data-testid="records-table"] th').length;
      expect(columns).toBe(30); // id + 29 stress columns
      // 12 long-named stress tabs render (tab buttons carry the surface id).
      const tabs = stressHost.querySelectorAll(
        '[data-surface="ts.stress-tabs"] [role="tab"]',
      ).length;
      expect(tabs).toBe(12);
    } finally {
      (server.data as { close?: () => void }).close?.();
    }
  });
});
