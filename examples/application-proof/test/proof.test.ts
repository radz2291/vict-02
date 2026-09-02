import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { createComponentRegistry } from '@vict/application/renderer';
import Badge from '$lib/host/components/Badge.svelte';
import ApplicationHost from '$lib/host/ApplicationHost.svelte';
import {
  compileProofPlan,
  noteInputContract,
  summaryOutputContract,
} from '$lib/application/definition';
import { getProofServer } from '$lib/application/server';
import { defineCapability } from '@vict/sdk';
import { createRuntime } from '@vict/runtime';
import * as pageServer from '../src/routes/[...vict]/+page.server';

/**
 * Stage 04 SvelteKit vertical proof — DOM-level, fully offline (happy-dom).
 *
 * Evidence produced here:
 * 1. the route is DERIVED from the definition (no manual page shell exists);
 * 2. the generic host renders the compiled plan (text, typed view, form,
 *    actions, custom component);
 * 3. the form validates through the declared neutral contract;
 * 4. the local presentation action never becomes a graph node;
 * 5. the VICT capability action crosses the real runtime boundary;
 * 6. the custom component resolves by exact id/revision from a registry
 *    that lives OUTSIDE the manifest, and an unknown id/revision fails
 *    with a structured diagnostic BEFORE unsafe rendering;
 * 7. UI visibility is not authorization: the denied action is attempted
 *    through the boundary and refused server-side;
 * 8. base SDK and Application declarations contain no Svelte.
 */

const proof = getProofServer();
const registry = createComponentRegistry('registry.proof', '1');
registry.register({ componentId: 'cmp.badge', revision: '1', implementation: Badge });

function renderHost(rows: Record<string, unknown>[] = []) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const instance = mount(ApplicationHost, {
    target,
    props: {
      plan: compileProofPlan(),
      registry,
      dispatch: proof.dispatch,
      rows,
    },
  });
  flushSync();
  return {
    target,
    unmount: () => {
      unmount(instance);
      target.remove();
    },
  };
}

describe('Stage 04 proof: route derived from the definition', () => {
  it('no manual page shell exists for the declared screen — only the catch-all', () => {
    const routesDir = join(process.cwd(), 'src', 'routes');
    expect(existsSync(join(routesDir, '[...vict]', '+page.svelte'))).toBe(true);
    // The ONLY page component in the whole app is the generic catch-all host.
    const pagePaths: string[] = [];
    const findPages = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          findPages(full);
        } else if (entry.name === '+page.svelte') {
          pagePaths.push(full);
        }
      }
    };
    findPages(routesDir);
    expect(pagePaths.length).toBe(1);
    expect(pagePaths[0]).toContain('[...vict]');
  });
});

describe('Stage 04 proof: generic host renders the compiled plan', () => {
  it('renders the screen, typed view, form fields in declared order, and the custom component', () => {
    const { target, unmount: teardown } = renderHost([
      { id: 'n1', title: 'alpha' },
      { id: 'n2', title: 'beta' },
    ]);
    try {
      // Screen title from the definition.
      expect(target.querySelector('h1')?.textContent).toBe('Stage 04 Proof');
      // Text surface from the header region.
      expect(target.textContent).toContain('VICT Application Proof');
      // Typed view: declared projection columns and row order.
      const headers = [...target.querySelectorAll('th')].map((th) => th.textContent);
      expect(headers).toEqual(['id', 'title']);
      const rowsRendered = [...target.querySelectorAll('tbody tr')].map((tr) =>
        [...tr.querySelectorAll('td')].map((td) => td.textContent),
      );
      expect(rowsRendered).toEqual([
        ['n1', 'alpha'],
        ['n2', 'beta'],
      ]);
      // Form fields in DECLARED order with labels.
      const fields = [...target.querySelectorAll('input')].map((input) => ({
        name: input.getAttribute('data-field'),
        label: input.closest('label')?.textContent?.trim() ?? '',
      }));
      expect(fields.map((field) => field.name)).toEqual(['id', 'title']);
      expect(fields[0]?.label).toContain('Id');
      // Action surfaces render their declared labels.
      const buttons = [...target.querySelectorAll('button[data-surface]')].map((button) =>
        button.textContent?.trim(),
      );
      expect(buttons).toContain('Clear form');
      expect(buttons).toContain('Summarize (VICT capability)');
      // Custom component resolved from the registry, not the manifest.
      expect(target.querySelector('[data-testid="custom-badge"]')?.textContent).toContain(
        'custom component',
      );
    } finally {
      teardown();
    }
  });

  it('renders the declared empty state when the view has no rows', () => {
    const { target, unmount: teardown } = renderHost([]);
    try {
      expect(target.querySelector('[data-state="empty"]')?.textContent).toContain('No notes yet.');
    } finally {
      teardown();
    }
  });
});

describe('Stage 04 proof: boundaries below the UI', () => {
  it('form submission validates through the declared neutral contract', async () => {
    // Invalid input is rejected by the contract before any mutation.
    const invalid = await proof.dispatch('act.create', { id: '', title: 42 });
    expect(invalid.ok).toBe(false);
    expect(invalid.code).toBe('CONTRACT_REJECTED');
    const rows = await proof.listNotes();
    expect(rows).toHaveLength(0);

    // Valid input crosses the data-adapter authorization boundary.
    const valid = await proof.dispatch('act.create', { id: 'n1', title: 'alpha' });
    expect(valid.ok).toBe(true);
    const after = await proof.listNotes();
    expect(after).toEqual([{ id: 'n1', title: 'alpha' }]);
  });

  it('the local action has NO server handler at all: the dispatcher refuses it', async () => {
    // MED-04-G remediation: `act.clear` is kind:'local' and is handled
    // entirely INSIDE the renderer boundary. The server dispatcher has no
    // act.clear handler: anything that reaches it (a bug, a direct HTTP
    // call) is refused as UNKNOWN_ACTION.
    const before = await proof.runCount();
    const result = await proof.dispatch('act.clear');
    const after = await proof.runCount();
    expect(result.ok).toBe(false);
    expect(result.code).toBe('UNKNOWN_ACTION');
    expect(after).toBe(before); // zero durable runs created
  });

  it('the VICT capability action crosses the real runtime boundary (a durable run)', async () => {
    const before = await proof.runCount();
    const result = await proof.dispatch('act.summarize', { id: 'n9', title: 'hello' });
    const after = await proof.runCount();
    expect(result.ok).toBe(true);
    expect((result.value as { summary: string }).summary).toBe('hello (5 chars)');
    expect(after).toBe(before + 1); // exactly one real Vict run
  });

  it('UI visibility is NOT authorization: the denied action is refused at the boundary', async () => {
    // The plan RENDERS the admin action (presentation), but the boundary
    // (server authorization profile) denies it — independently of the UI.
    const result = await proof.dispatch('act.adminDelete', { id: 'n1' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('DATA_UNAUTHORIZED');
    // The denied mutation never touched the data.
    const rows = await proof.listNotes();
    expect(rows).toContainEqual({ id: 'n1', title: 'alpha' });
  });

  it('unknown component id/revision fails with a structured diagnostic BEFORE rendering', () => {
    const emptyRegistry = createComponentRegistry('registry.proof', '1');
    // Unknown component id.
    expect(() =>
      mount(ApplicationHost, {
        target: document.body,
        props: { plan: compileProofPlan(), registry: emptyRegistry, dispatch: proof.dispatch, rows: [] },
      }),
    ).toThrowError(/not registered/);
    // Revision mismatch.
    const wrongRevision = createComponentRegistry('registry.proof', '1');
    wrongRevision.register({ componentId: 'cmp.badge', revision: '2', implementation: Badge });
    expect(() =>
      mount(ApplicationHost, {
        target: document.body,
        props: { plan: compileProofPlan(), registry: wrongRevision, dispatch: proof.dispatch, rows: [] },
      }),
    ).toThrowError(/revision/);
  });
});

describe('Stage 04 proof: framework neutrality of the base declarations', () => {
  it('base SDK and Application sources contain no Svelte and no runtime imports', () => {
    const sdkDir = join(process.cwd(), '..', '..', 'packages', 'sdk', 'src');
    const appDir = join(process.cwd(), '..', '..', 'packages', 'application', 'src');
    const scan = (dir: string): string[] => {
      const files: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...scan(full));
        } else if (entry.name.endsWith('.ts')) {
          files.push(full);
        }
      }
      return files;
    };
    for (const file of [...scan(sdkDir), ...scan(appDir)]) {
      const content = readFileSync(file, 'utf8');
      // Structural evidence: no svelte/runtime/kernel MODULE ever enters the
      // base declaration surface. Only import/export statements count as a
      // dependency; prose mentions in doc comments are not dependencies.
      const dependencyLines = content
        .split('\n')
        .filter((line) => /^\s*(import|export)\b/.test(line));
      for (const line of dependencyLines) {
        expect(line, file).not.toMatch(/from\s+['"]svelte|import\s+['"]svelte/i);
        expect(line, `${file}: ${line}`).not.toContain('@vict/runtime');
        expect(line, `${file}: ${line}`).not.toContain('@vict/kernel');
      }
    }
  });
});

describe('Stage 04 audit remediation: genuine local actions (MED-04-G)', () => {
  it('clicking the local clear action produces ZERO dispatch/network/run/data effects', async () => {
    const fetchCalls: unknown[] = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      fetchCalls.push(input);
      throw new Error('NETWORK-CANARY: no network call may happen for a local action');
    });
    const dispatchSpy = vi.fn(async () => {
      throw new Error('DISPATCH-CANARY: a local action must never reach the dispatcher');
    });
    const before = await proof.runCount();
    const rowsBefore = await proof.listNotes();

    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(ApplicationHost, {
      target,
      props: {
        plan: compileProofPlan(),
        registry,
        dispatch: dispatchSpy as unknown as typeof proof.dispatch,
        rows: [],
      },
    });
    flushSync();
    try {
      // Type into the form first: the local clear must reset it.
      const idInput = target.querySelector<HTMLInputElement>('input[data-field="id"]');
      const titleInput = target.querySelector<HTMLInputElement>('input[data-field="title"]');
      expect(idInput && titleInput).toBeTruthy();
      idInput!.value = 'typed-id';
      titleInput!.value = 'typed-title';
      // A REAL DOM click on the local action button.
      const clearButton = target.querySelector<HTMLButtonElement>('button[data-surface="sa.clear"]');
      expect(clearButton).not.toBeNull();
      expect(clearButton!.getAttribute('data-action-kind')).toBe('local');
      clearButton!.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
      flushSync();
      // Zero dispatcher calls, zero network calls, zero VICT runs, zero data ops.
      expect(dispatchSpy).not.toHaveBeenCalled();
      expect(fetchCalls).toHaveLength(0);
      expect(await proof.runCount()).toBe(before);
      expect(await proof.listNotes()).toEqual(rowsBefore);
      // The declared local transition reset the transient form state.
      expect(idInput!.value).toBe('');
      expect(titleInput!.value).toBe('');
    } finally {
      unmount(instance);
      target.remove();
      fetchSpy.mockRestore();
    }
  });
});

describe('Stage 04 audit remediation: unknown routes and output contracts', () => {
  it('unknown application routes return a structured not-found (HTTP 404)', async () => {
    // The SvelteKit host returns a proper structured not-found outcome
    // instead of silently rendering the first declared route (LOW-04-J).
    // The declared route renders; ANY undeclared path is a structured 404.
    await expect(
      pageServer.load({ url: new URL('https://proof.local/') } as never),
    ).resolves.toBeTruthy();
    await expect(
      pageServer.load({ url: new URL('https://proof.local/nonexistent-page') } as never),
    ).rejects.toMatchObject({ status: expect.any(Number), body: expect.objectContaining({}) });
    try {
      await pageServer.load({ url: new URL('https://proof.local/attacker-path') } as never);
      throw new Error('expected a 404 failure');
    } catch (thrown) {
      const httpError = thrown as { status?: number; body?: { message?: string } };
      expect(httpError.status).toBe(404);
      // The safe diagnostic does not echo the attacker-controlled path.
      expect(httpError.body?.message ?? '').not.toContain('attacker-path');
      expect(httpError.body?.message ?? '').toContain('404');
    }
  });

  it('the proof capability action declares and enforces an OUTPUT contract (CONT-001)', () => {
    // Structural evidence at the plan boundary: the capability action binds
    // an output contract, and the capability declares both contracts.
    const plan = compileProofPlan();
    const action = plan.actions['act.summarize'];
    expect(action).toBeDefined();
    expect((action as { outputContractId?: string }).outputContractId).toBe(
      'proof.summary.output',
    );
    // The runtime validates BOTH contracts: a hostile capability output
    // fails the run safely before reaching HTTP or the DOM.
    const hostile = defineCapability({
      id: 'proof.hostile.output',
      revision: '1',
      effect: 'pure',
      input: noteInputContract,
      output: summaryOutputContract,
      invoke: () => ({ summary: 12345 }) as unknown as { summary: string },
    });
    const runtime = createRuntime();
    runtime.registerCapability(hostile);
    runtime.registerContract(noteInputContract);
    const activated = runtime.activate({
      id: 'g.hostile',
      entry: 'only',
      nodes: [{ id: 'only', capability: 'proof.hostile.output', output: 'proof.summary.output' }],
      edges: [],
    });
    return activated.then(async (activation) => {
      expect(activation.ok).toBe(true);
      if (!activation.ok) return;
      const run = await runtime.run({ id: 'n1', title: 'hello' }, { mode: 'normal' });
      expect(run.status).toBe('failed');
      expect(String(run.error?.code)).toMatch(/CONTRACT/);
    });
  });
});
