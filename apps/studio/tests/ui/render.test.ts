// @vitest-environment happy-dom
//
// UI render evidence for the G1 Studio operator surface: the compiled plan
// + canned viewData mounted through the generic host (VitApp) with the REAL
// component registry. Covers the four truthful target connection states,
// the FT-1 no-row-link guard on the runs list, and keyboard reachability.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { VitApp } from '@victframework/ui-svelte';
import type { ComponentRegistry } from '@victframework/application/renderer';
import type { TargetStatusRow } from '$lib/shared/contract.js';
import { compileStudioPlan } from '$lib/application/index.js';
import { createStudioRegistry } from '$lib/components/registry.js';

const plan = compileStudioPlan() as never;

const registry: ComponentRegistry = createStudioRegistry();

function noopDispatch(): Promise<{ ok: false; code: string; message: string }> {
  return Promise.resolve({ ok: false, code: 'UNSUPPORTED_ACTION', message: 'read-only' });
}

const CANNED_TARGET_ROWS: TargetStatusRow[] = [
  {
    id: 'tgt-main',
    label: 'Main target',
    endpoint: 'http://127.0.0.1:8081',
    state: 'connected',
    actorId: 'operator-7',
    scopes: ['runs.read', 'audit.read'],
    selected: { 'graph.demo': 'v3' },
    detail: 'ok',
  },
  {
    id: 'tgt-rejected',
    label: 'Rejected target',
    endpoint: 'http://127.0.0.1:8082',
    state: 'rejected',
    actorId: null,
    scopes: [],
    selected: null,
    detail: 'credential refused',
  },
  {
    id: 'tgt-down',
    label: 'Down target',
    endpoint: 'http://127.0.0.1:8083',
    state: 'unreachable',
    actorId: null,
    scopes: [],
    selected: null,
    detail: 'connection refused',
  },
  {
    id: 'tgt-ghost',
    label: 'Ghost target',
    endpoint: 'http://127.0.0.1:8084',
    state: 'absent',
    actorId: null,
    scopes: [],
    selected: null,
    detail: '',
  },
];

function dashboardData(): Record<string, unknown> {
  return {
    'v.targetStatus': { rows: CANNED_TARGET_ROWS, loading: false },
    'v.selectedActivations': { rows: [], loading: false },
    'v.releases': { rows: [], loading: false },
  };
}

const mounted: Record<string, unknown>[] = [];

function mountHost(path: string, viewData: Record<string, unknown>, record: unknown = null) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const instance = mount(VitApp as never, {
    target,
    props: {
      plan,
      registry,
      dispatch: noopDispatch,
      path,
      viewData,
      record,
    },
  });
  mounted.push(instance);
  flushSync();
  return target;
}

afterEach(() => {
  for (const instance of mounted.splice(0)) {
    unmount(instance as never);
  }
  document.body.innerHTML = '';
});

describe('studio UI rendering (G1 read-only)', () => {
  it('renders all four truthful target connection states distinctly on the dashboard', () => {
    const target = mountHost('/', dashboardData());
    const html = target.innerHTML;
    expect(html).toContain('Connected');
    expect(html).toContain(
      'Target rejected the Studio credential (401/403) — check the deployment provisioning.',
    );
    expect(html).toContain('Target unreachable at http://127.0.0.1:8083.');
    expect(html).toContain('No provisioned target with this id.');
    // Per-state tones are distinct.
    expect(target.querySelectorAll('.tone-success').length).toBe(1);
    expect(target.querySelectorAll('.tone-danger').length).toBe(1);
    expect(target.querySelectorAll('.tone-warning').length).toBe(1);
    expect(target.querySelectorAll('.tone-neutral').length).toBe(1);
    // Live-region semantics.
    expect(target.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  });

  it('shows actorId and scopes ONLY on the connected row', () => {
    const target = mountHost('/', dashboardData());
    const items = [...target.querySelectorAll('.target-item')];
    expect(items.length).toBe(4);
    const withActor = items.filter((item) => item.textContent?.includes('operator-7'));
    expect(withActor).toHaveLength(1);
    expect(withActor[0]!.classList.contains('tone-success')).toBe(true);
    expect(withActor[0]!.textContent).toContain('runs.read');
    for (const item of items) {
      if (item.classList.contains('tone-success')) continue;
      expect(item.textContent).not.toContain('operator-7');
      expect(item.textContent).not.toContain('runs.read');
    }
  });

  it('never renders a token-like string', () => {
    const target = mountHost('/', dashboardData());
    const html = target.innerHTML;
    expect(html).not.toMatch(/credentialRef/);
    expect(html).not.toMatch(/Bearer\s/i);
    expect(html).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // JWT-shaped
    expect(html).not.toMatch(/sk-[A-Za-z0-9]{10,}/); // API-key-shaped
  });

  it('reaches every per-target <summary> by keyboard and discloses details', () => {
    const target = mountHost('/', dashboardData());
    const summaries = [...target.querySelectorAll('summary')];
    expect(summaries.length).toBe(4);
    for (const summary of summaries) {
      summary.focus();
      expect(document.activeElement).toBe(summary);
    }
    // Native <details> is keyboard-operable; the connected row discloses actor/scopes.
    const connected = summaries[0]!.closest('details')!;
    connected.open = true;
    expect(connected.textContent).toContain('operator-7');
  });

  it('renders the runs list with a GENUINE FT-1 row link to the run-detail route', () => {
    const target = mountHost('/runs', {
      'v.runs': {
        rows: [
          {
            runId: 'run-1',
            graphId: 'graph.demo',
            status: 'running',
            createdAt: '2026-09-29T00:00:00Z',
          },
        ],
        loading: false,
      },
    });
    const html = target.innerHTML;
    // FT-1 (G3-A): the definition declares the row→detail binding, so each
    // row renders ONE genuine navigation link (anchor href) to the run
    // detail route, resolved from the row's own identity field. Shell nav
    // links (aria-label="Application") are the generic host's own and are
    // not row navigation.
    const rowLinks = target.querySelectorAll('[data-surface] tr a[href]');
    expect(rowLinks).toHaveLength(1);
    expect(rowLinks[0]!.getAttribute('href')).toBe('/runs/run-1');
    expect(rowLinks[0]!.getAttribute('aria-label')).toContain('run-1');
    expect(rowLinks[0]!.textContent?.trim()).toBe('Open run');
    // Truthful FT-1 text is present (HTML-escaped in innerHTML; read text).
    const text = target.textContent ?? '';
    expect(text).toContain('Open a run from its row link');
  });

  it('renders surfaces WITHOUT a rowDetail binding with no links (FT-1 negative)', () => {
    const target = mountHost('/activations', {
      'v.activations': {
        rows: [
          {
            activationId: 'act-1',
            graphId: 'graph.demo',
            status: 'active',
            createdAt: '2026-09-29T00:00:00Z',
          },
        ],
        loading: false,
      },
    });
    expect(target.querySelectorAll('[data-surface] tr a[href]')).toHaveLength(0);
  });

  it('renders the run detail surfaces with truthful empty states', () => {
    const target = mountHost(
      '/runs/run-1',
      {
        'v.runDetail': { rows: [], loading: false },
        'v.runEvents': { rows: [], loading: false },
        'v.runWaits': { rows: [], loading: false },
      },
      null,
    );
    const html = target.innerHTML;
    expect(html).toContain('This run does not exist.');
    expect(html).toContain('No events recorded.');
    expect(html).toContain('No durable waits.');
    expect(target.querySelectorAll('[data-surface] a[href]')).toHaveLength(0);
  });
});
