import { describe, expect, it } from 'vitest';
import { compileShowcasePlan } from '../src/lib/application/definition.js';
import { seeds, resourceList } from '../src/lib/application/data.js';
import { createShowcaseServer } from '../src/lib/server/application-server.js';
import type { ViewDatum, VictPlanView } from '@victframework/ui-svelte';

/**
 * Showcase structural sanity (P6D): the neutral definition compiles, the
 * route inventory covers the eight scenarios, identity is deterministic,
 * the deterministic seeds load, and the server resolves routes/data and
 * dispatches the demo-state actions with the documented codes.
 */

describe('showcase definition (P6D)', () => {
  it('compiles and carries the full scenario inventory', () => {
    const plan = compileShowcasePlan();
    expect(plan.applicationId).toBe('app.ui-showcase');
    // 33 routes across the eight scenarios + review; 30 screens.
    expect(plan.routes.length).toBe(33);
    expect(Object.keys(plan.screens).length).toBe(30);
    // Every scenario group is present in the navigation order.
    const groups = new Set(
      plan.routes
        .map((entry) => entry.route.nav?.group)
        .filter((group): group is string => typeof group === 'string'),
    );
    for (const group of [
      'Showcase',
      'Operations',
      'Trading',
      'Agent',
      'Quellight',
      'Governance',
      'Analytics',
      'Reference',
      'Stress nav',
    ]) {
      expect(groups.has(group)).toBe(true);
    }
    // The closed renderer vocabulary is exercised end to end.
    expect(Object.keys(plan.views).length).toBe(34);
    expect(Object.keys(plan.forms).length).toBe(5);
    expect(Object.keys(plan.actions).length).toBe(38);
    expect(plan.components).toEqual([{ componentId: 'cmp.island', revision: '1' }]);
  });

  it('produces a deterministic application identity', () => {
    const first = compileShowcasePlan();
    const second = compileShowcasePlan();
    expect(first.applicationVersion).toBe(second.applicationVersion);
    expect(first.applicationVersion.startsWith('v1_')).toBe(true);
  });

  it('seeds are deterministic and complete for every resource', () => {
    for (const resource of resourceList) {
      expect(seeds[resource.id], `seeds for ${resource.id}`).toBeDefined();
    }
    const tickets = seeds['tickets'] as Record<string, unknown>[];
    expect(tickets.length).toBe(13);
    // OPS-1042 is the canonical BM record; OPS-1057 is the zero-amount demo.
    expect(tickets.some((row) => row.id === 'OPS-1042')).toBe(true);
    expect(tickets.some((row) => row.id === 'OPS-1057' && row.amount === 0)).toBe(true);
    expect((seeds['signals'] as unknown[]).length).toBe(48);
    expect((seeds['stressRows'] as unknown[]).length).toBe(110);
    expect((seeds['stressMessages'] as unknown[]).length).toBe(55);
    expect((seeds['emptyInbox'] as unknown[]).length).toBe(0);
    // Long unbroken identifiers exist on purpose.
    expect((seeds['stressRows'] as Record<string, unknown>[])[0]?.['id']).toBe(
      'STRESS-9F2A7C61E4B0D3A8-LONG-UNBROKEN-ID-000001',
    );
  });
});

describe('showcase server (P6D)', () => {
  it('resolves routes and loads declared views with deterministic rows', async () => {
    const server = createShowcaseServer();
    try {
      const route = await server.loadRoute('/ops');
      expect(route).not.toBeNull();
      const view = (route!.viewData as Record<string, ViewDatum>)['v.tickets'];
      expect(view).toBeDefined();
      expect((view?.rows ?? []).length).toBe(13);
      expect(view?.stale).toBe(false);

      // Server-side table queries support search/sort/pagination.
      const query = await server.dispatch('act.queryTickets', {
        search: { text: 'e-Filing', fields: ['title', 'customer', 'owner', 'location'] },
        limit: 5,
        offset: 0,
      });
      expect(query.ok).toBe(true);
      expect((query.value as { rows: unknown[] }).rows.length).toBe(1);

      // Record detail via route parameter.
      const detail = await server.loadRoute('/ops/tickets/OPS-1042');
      expect(detail?.record).toMatchObject({ id: 'OPS-1042' });

      // Static demo-record map (no route parameter).
      const prefill = await server.loadRoute('/gallery/forms/prefilled');
      expect(prefill?.record).toMatchObject({ id: 'OPS-1042' });

      // Unknown path → null (the caller renders the structured 404).
      expect(await server.loadRoute('/definitely-not-a-route')).toBeNull();
    } finally {
      (server.data as { close?: () => void }).close?.();
    }
  });

  it('serves the stale and partial demo routes through view datum flags', async () => {
    const server = createShowcaseServer();
    try {
      const stale = await server.loadRoute('/gallery/states/stale');
      expect(Object.values(stale!.viewData).every((datum) => datum.stale === true)).toBe(true);
      const partial = await server.loadRoute('/gallery/states/partial');
      expect(Object.values(partial!.viewData).every((datum) => datum.partial === true)).toBe(true);
      const queryFlag = await server.loadRoute('/ops', new URLSearchParams('demo=stale'));
      expect(Object.values(queryFlag!.viewData).some((datum) => datum.stale === true)).toBe(true);
    } finally {
      (server.data as { close?: () => void }).close?.();
    }
  });

  it('demo-state mutations return the documented structured codes', async () => {
    const server = createShowcaseServer();
    try {
      expect(await server.dispatch('act.demoSucceed', {})).toMatchObject({ ok: true });
      expect(await server.dispatch('act.demoValidation', {})).toMatchObject({
        ok: false,
        code: 'CONTRACT_REJECTED',
      });
      expect(await server.dispatch('act.demoDenied', {})).toMatchObject({
        ok: false,
        code: 'DATA_UNAUTHORIZED',
      });
      expect(await server.dispatch('act.demoFailure', {})).toMatchObject({
        ok: false,
        code: 'ACTION_FAILED',
      });
      // Real authorization denial: the deployment does NOT carry
      // tickets.admin.delete, so the destructive action is denied by the
      // boundary (never by button visibility).
      expect(await server.dispatch('act.deleteTicket', { id: 'OPS-1042' })).toMatchObject({
        ok: false,
        code: 'DATA_UNAUTHORIZED',
      });
    } finally {
      (server.data as { close?: () => void }).close?.();
    }
  });

  it('conversation send composes a real capability reply and the server-side view scoping works', async () => {
    const server = createShowcaseServer();
    try {
      const send = await server.dispatch('act.gallerySend', {
        text: 'Ujian penghantaran sebenar (BM).',
        author: 'You',
        participant: 'user',
      });
      expect(send.ok).toBe(true);
      const planView = server.plan.toJSON() as unknown as VictPlanView;
      const route = await server.loadRoute('/gallery');
      const messages = (route!.viewData['v.galleryMessages'] as ViewDatum).rows ?? [];
      // The user message AND the assistant reply (from the capability run).
      expect(messages.some((row) => String(row['text']).includes('Ujian penghantaran'))).toBe(true);
      expect(messages.some((row) => String(row['text']).includes('Mesej diterima'))).toBe(true);
      expect(planView.applicationId).toBe('app.ui-showcase');

      // Instrument series is scoped to the route's record server-side.
      const xau = await server.loadRoute('/trading/instruments/XAUUSD');
      const series = (xau!.viewData['v.series'] as ViewDatum).rows ?? [];
      expect(series.length).toBe(32);
      expect(series.every((row) => row['instrumentId'] === 'XAUUSD')).toBe(true);
    } finally {
      (server.data as { close?: () => void }).close?.();
    }
  });
});
