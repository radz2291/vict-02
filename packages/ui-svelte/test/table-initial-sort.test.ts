import { describe, expect, it, vi } from 'vitest';
import { renderVictApplication } from '@victframework/ui-svelte';
import { deriveUiPlan } from '@victframework/ui';
import { probeApp, testRegistry } from './fixtures.js';

/**
 * QA FINDING-1 closure (ui-convergence-r2): on a fresh mount, a declared-query
 * table must use the BOUND VIEW's declared initial sort (@2) for search and
 * pagination — until the user selects another sort. Before the fix the table
 * dispatched `sort` only after a user sort, so the data adapter's own list
 * order answered the query; when that order differed from the declared view
 * sort the initial page and dispatched pages diverged and paging REPEATED a
 * row across pages while HIDING others.
 *
 * The dispatch mock below is faithful to the real generated-host contract
 * (`dispatchQuery` in the scaffolder template): the payload's `sort` is
 * applied when present; WITHOUT it, rows come back in raw store order.
 */

type Row = Record<string, unknown>;

/** Store order = insertion order (the data adapter's own default list order). */
const STORE_ROWS: Row[] = [
  { id: 't-1', title: 'alpha', qty: 4 },
  { id: 't-2', title: 'bravo', qty: 2 },
  { id: 't-3', title: 'charlie', qty: 7 },
  { id: 't-4', title: 'delta', qty: 1 },
  { id: 't-5', title: 'echo', qty: 6 },
  { id: 't-6', title: 'foxtrot', qty: 3 },
  { id: 't-7', title: 'golf', qty: 5 },
];

interface QueryPayload {
  search?: { text: string; fields: readonly string[] };
  sort?: readonly { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
}

/** Real-host semantics: explicit payload sort/search applied; store order is not. */
function makeHostQuery(store: readonly Row[], seen: QueryPayload[]) {
  return async (actionId: string, input?: unknown): Promise<unknown> => {
    if (actionId !== 'act.query') return { ok: true };
    const payload = (input ?? {}) as QueryPayload;
    seen.push(payload);
    let rows = [...store];
    if (payload.search !== undefined) {
      const needle = payload.search.text.toLowerCase();
      rows = rows.filter((row) =>
        payload.search!.fields.some((field) =>
          String(row[field] ?? '')
            .toLowerCase()
            .includes(needle),
        ),
      );
    }
    for (const entry of [...(payload.sort ?? [])].reverse()) {
      rows = [...rows].sort((a, b) => {
        const cmp = String(a[entry.field]).localeCompare(String(b[entry.field]));
        return entry.direction === 'desc' ? -cmp : cmp;
      });
    }
    const total = rows.length;
    const offset = payload.offset ?? 0;
    const limit = payload.limit ?? rows.length;
    return { ok: true, value: { rows: rows.slice(offset, offset + limit), total } };
  };
}

/** The server's `loadRoute` applies the declared view sort to the initial page. */
function serverSorted(store: readonly Row[], sort: { field: string; direction: 'asc' | 'desc' }) {
  return [...store].sort((a, b) => {
    const cmp = String(a[sort.field]).localeCompare(String(b[sort.field]));
    return sort.direction === 'desc' ? -cmp : cmp;
  });
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

const DECLARED_DESC = [{ field: 'title', direction: 'desc' as const }];

function mountDeclaredTable(dispatch: (actionId: string, input?: unknown) => Promise<unknown>) {
  return renderVictApplication({
    plan: probeApp(
      {
        role: 'table',
        id: 'x',
        viewId: 'v.items',
        queryActionId: 'act.query',
        pageSize: 3,
        columns: [
          { field: 'title', label: 'Title', sortable: true },
          { field: 'qty', label: 'Qty', sortable: true },
        ],
      },
      {
        views: [
          {
            viewId: 'v.items',
            resourceId: 'items',
            resourceRevision: '1',
            fields: ['id', 'title', 'qty'],
            sort: DECLARED_DESC,
          },
        ],
      },
    ),
    registry: testRegistry(),
    dispatch,
    // Server load (`loadRoute`) returns ALL declared-order view rows; the
    // table takes its first page and its pre-query total from them.
    viewData: {
      'v.items': { rows: serverSorted(STORE_ROWS, DECLARED_DESC[0]!), total: STORE_ROWS.length },
    },
    path: '/',
  });
}

const visibleTitles = (mounted: { output: Element }): string[] =>
  [...mounted.output.querySelectorAll('[data-testid="table-row"]')].map(
    (row) => row.querySelector('td')?.textContent ?? '',
  );

describe('declared initial sort on a fresh mount (QA FINDING-1)', () => {
  it('derives the intent initialSort from the bound view declaration', () => {
    const plan = probeApp(
      { role: 'table', id: 'x', viewId: 'v.items', queryActionId: 'act.query', pageSize: 3 },
      {
        views: [
          {
            viewId: 'v.items',
            resourceId: 'items',
            resourceRevision: '1',
            fields: ['id', 'title'],
            sort: [{ field: 'title', direction: 'desc' }],
          },
        ],
      },
    );
    const intent = deriveUiPlan(plan as never).tables['x'];
    expect(intent?.initialSort).toEqual([{ field: 'title', direction: 'desc' }]);
  });

  it('shows the declared sort as the active fresh-mount sort state', () => {
    const mounted = mountDeclaredTable(makeHostQuery(STORE_ROWS, []));
    try {
      expect(mounted.output.querySelector('th[aria-sort="descending"]')).not.toBeNull();
      const indicator = mounted.output
        .querySelector('[data-sort-field="title"]')
        ?.textContent?.trim();
      expect(indicator?.endsWith('▼')).toBe(true);
    } finally {
      mounted.unmount();
    }
  });

  it('fresh-mount pagination carries the declared sort: zero repeated and zero hidden rows across ALL page boundaries', async () => {
    const seen: QueryPayload[] = [];
    const mounted = mountDeclaredTable(makeHostQuery(STORE_ROWS, seen));
    try {
      // Fresh mount: page 1 is the server-loaded declared-order page.
      expect(visibleTitles(mounted)).toEqual(['golf', 'foxtrot', 'echo']);
      const visited: string[] = [...visibleTitles(mounted)];
      // Walk every page boundary to the end.
      for (let guard = 0; guard < 5; guard++) {
        const next = mounted.output.querySelector<HTMLButtonElement>('[data-testid="table-next"]');
        if (next === null || next.disabled) break;
        next.click();
        await flush();
        visited.push(...visibleTitles(mounted));
      }
      // Every dispatched page request carried the declared view sort.
      expect(seen.length).toBeGreaterThanOrEqual(2);
      for (const payload of seen) {
        expect(payload.sort).toEqual([{ field: 'title', direction: 'desc' }]);
      }
      // NO repeated rows and NO hidden rows: the union of visited pages is
      // exactly the whole store, each record exactly once.
      expect(visited).toHaveLength(STORE_ROWS.length);
      expect(new Set(visited).size).toBe(STORE_ROWS.length);
      expect([...visited].sort()).toEqual([...STORE_ROWS].map((row) => String(row.title)).sort());
    } finally {
      mounted.unmount();
    }
  });

  it('fresh-mount search carries the declared sort and its results page consistently', async () => {
    const seen: QueryPayload[] = [];
    const mounted = mountDeclaredTable(makeHostQuery(STORE_ROWS, seen));
    try {
      const search = mounted.output.querySelector<HTMLInputElement>('[data-testid="table-search"]');
      search!.value = 'o'; // matches bravo, echo, foxtrot, golf
      search!.dispatchEvent(new Event('input', { bubbles: true }));
      await vi.waitFor(
        () => {
          if (visibleTitles(mounted).join(',') !== 'golf,foxtrot,echo') {
            throw new Error(`rows not applied yet: ${visibleTitles(mounted).join(',')}`);
          }
        },
        { timeout: 5000 },
      );
      expect(seen).toHaveLength(1);
      expect(seen[0]!.search).toEqual({ text: 'o', fields: ['title'] });
      expect(seen[0]!.sort).toEqual([{ field: 'title', direction: 'desc' }]);
      expect(seen[0]!.offset).toBe(0);
      // Results arrive in the DECLARED order (golf, foxtrot, echo) — store
      // order for the same matches would be (bravo, echo, foxtrot): the
      // pre-fix divergence for search, now closed.
      expect(visibleTitles(mounted)).toEqual(['golf', 'foxtrot', 'echo']);
    } finally {
      mounted.unmount();
    }
  });

  it('a user sort change replaces the declared sort and paging stays zero-overlap under the new order', async () => {
    const seen: QueryPayload[] = [];
    const mounted = mountDeclaredTable(makeHostQuery(STORE_ROWS, seen));
    try {
      // User sorts by qty: the dispatch now carries the USER sort.
      mounted.output.querySelector<HTMLButtonElement>('[data-sort-field="qty"]')!.click();
      await flush();
      expect(seen).toHaveLength(1);
      expect(seen[0]!.sort).toEqual([{ field: 'qty', direction: 'asc' }]);
      const visited: string[] = [...visibleTitles(mounted)];
      for (let guard = 0; guard < 5; guard++) {
        const next = mounted.output.querySelector<HTMLButtonElement>('[data-testid="table-next"]');
        if (next === null || next.disabled) break;
        next.click();
        await flush();
        visited.push(...visibleTitles(mounted));
      }
      // Post-sort-change pages keep the USER sort (never fall back silently).
      for (const payload of seen.slice(1)) {
        expect(payload.sort).toEqual([{ field: 'qty', direction: 'asc' }]);
      }
      // Zero overlap / zero omissions under the new order too.
      expect(visited).toHaveLength(STORE_ROWS.length);
      expect(new Set(visited).size).toBe(STORE_ROWS.length);
    } finally {
      mounted.unmount();
    }
  });

  it('regression (pre-fix behaviour): a table WITHOUT a declared view sort dispatches no sort and store order stays coherent', async () => {
    const seen: QueryPayload[] = [];
    const dispatch = vi.fn(makeHostQuery(STORE_ROWS, seen));
    const mounted = renderVictApplication({
      plan: probeApp({
        role: 'table',
        id: 'x',
        viewId: 'v.items',
        queryActionId: 'act.query',
        pageSize: 3,
        columns: [{ field: 'title', label: 'Title', sortable: true }],
      }),
      registry: testRegistry(),
      dispatch,
      viewData: { 'v.items': { rows: STORE_ROWS, total: STORE_ROWS.length } },
      path: '/',
    });
    try {
      // No declared sort → no sort indicator, no sort in the payload.
      expect(mounted.output.querySelector('th[aria-sort]')).toBeNull();
      mounted.output.querySelector<HTMLButtonElement>('[data-testid="table-next"]')!.click();
      await flush();
      expect(seen).toHaveLength(1);
      expect(seen[0]!.sort).toBeUndefined();
      // Store order on both sides of the boundary: still zero overlap.
      expect(visibleTitles(mounted)).toEqual(['delta', 'echo', 'foxtrot']);
    } finally {
      mounted.unmount();
    }
  });
});
