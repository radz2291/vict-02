import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import DetailPage from '../src/routes/inspection/[id]/+page.svelte';
import {
  InspectionDataAdapter,
  createInspectionServer,
  grantsForRole,
  seedDomain,
} from '../src/lib/product/domain.js';

/**
 * U1-05 regression (kept current for U3): the AUTHORED document Approve
 * button (the component-declared interaction) must dispatch through the REAL
 * adapter boundary — the same server dispatch path as the native controls —
 * never a silent stub — and surface the same success/denial behavior.
 *
 * The page now POSTs to `/api/inspection/...`; this test stubs fetch and
 * proxies into a REAL in-process inspection server, so the full page →
 * boundary → adapter path is exercised.
 */

const supervisor = { role: 'supervisor', actorId: 's.hart' };
const technician = { role: 'technician', actorId: 't.nguyen' };
// A FRESH server per test (the domain must not leak between tests).
let server: ReturnType<typeof createInspectionServer>;

type Actors = 'supervisor' | 'technician';
const actorFor = (role: Actors) => (role === 'supervisor' ? supervisor : technician);

beforeEach(() => {
  server = createInspectionServer(new InspectionDataAdapter(seedDomain()));
  const fetchStub = async (
    input: RequestInfo | URL,
    init?: { readonly body?: string },
  ): Promise<{ json: () => Promise<unknown> }> => {
    const url = String(input);
    const match = /\/api\/inspection\/([a-z-]+)\?as=(\w+)/.exec(url);
    if (match === null) throw new Error(`unexpected fetch ${url}`);
    const [, route, role] = match;
    const actionId = route.replaceAll('-', '.');
    let body: unknown = {};
    if (init?.body !== undefined) {
      body = JSON.parse(init.body) as unknown;
    }
    const result = await server.dispatch(actionId, body, actorFor(role as Actors));
    return { json: async () => result };
  };
  vi.stubGlobal('fetch', fetchStub);
});

async function loadRecord(role: Actors): Promise<{
  record: Record<string, unknown>;
  activity: ReturnType<typeof server.adapter.activityFor>;
}> {
  const list = await server.dispatch('inspection.list', {}, actorFor(role));
  const rows = (list.value as { rows: Record<string, unknown>[] }).rows;
  const record = rows.find((candidate) => candidate['id'] === 'i-101');
  if (record === undefined) throw new Error('missing record');
  return { record, activity: server.adapter.activityFor('i-101') };
}

describe('U1-05: the authored Approve button dispatches through the real boundary', () => {
  it('clicking the authored button label approves through the adapter (supervisor)', async () => {
    const { record, activity } = await loadRecord('supervisor');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(DetailPage, {
      target,
      props: { data: { id: 'i-101', actorRole: 'supervisor', record, activity } },
    });
    try {
      flushSync();
      const authoredButton = target.querySelector('[data-ui-node="n.approveLabel"]') as HTMLElement;
      expect(authoredButton).not.toBeNull();
      authoredButton.click();
      await new Promise((r) => setTimeout(r, 100));
      flushSync();
      const status = target.querySelector('[data-ui-node="n.status"]');
      expect(status?.textContent).toBe('approved');
      const activityNodes = [...target.querySelectorAll('[data-ui-node="n.activityItem"]')].map(
        (e) => e.textContent ?? '',
      );
      expect(activityNodes.some((entry) => entry.includes('approved'))).toBe(true);
      const feedback = target.querySelector('[data-ui-node="n.feedback"]');
      expect(feedback?.textContent).toContain('Inspection approved.');
      expect(target.querySelector('[data-ui-node="n.approveButton"]')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
      unmount(instance);
      target.remove();
    }
  });

  it('hides approval for technician and direct boundary dispatch still denies it (state unchanged)', async () => {
    const { record, activity } = await loadRecord('technician');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(DetailPage, {
      target,
      props: { data: { id: 'i-101', actorRole: 'technician', record, activity } },
    });
    try {
      flushSync();
      expect(target.querySelector('[data-ui-node="n.approveButton"]')).toBeNull();
      const denied = await server.dispatch(
        'inspection.approve',
        { id: 'i-101', expectedDomainRevision: record['domainRevision'] },
        technician,
      );
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.code).toBe('DATA_UNAUTHORIZED');
      const status = target.querySelector('[data-ui-node="n.status"]');
      expect(status?.textContent).toBe('submitted'); // unchanged
      expect(grantsForRole('technician')).not.toContain('qlt.inspection.approve');
    } finally {
      unmount(instance);
      target.remove();
    }
  });

  it('terminal approved records offer no approve or return action', async () => {
    const { record } = await loadRecord('supervisor');
    const decision = await server.dispatch(
      'inspection.approve',
      { id: 'i-101', expectedDomainRevision: record['domainRevision'] },
      supervisor,
    );
    expect(decision.ok).toBe(true);
    const approved = await loadRecord('supervisor');
    const target = document.createElement('div');
    const instance = mount(DetailPage, {
      target,
      props: { data: { id: 'i-101', actorRole: 'supervisor', ...approved } },
    });
    try {
      flushSync();
      expect(target.querySelector('[data-ui-node="n.approveButton"]')).toBeNull();
      expect(target.querySelector('[data-ui-node="n.rejectForm"]')).toBeNull();
      expect(target.querySelector('[data-ui-node="n.nextAction"]')?.textContent).toContain(
        'review is complete',
      );
    } finally {
      unmount(instance);
      target.remove();
    }
  });
});
