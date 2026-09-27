import { describe, expect, it, vi } from 'vitest';
import { renderVictApplication } from '@victframework/ui-svelte';
import { probeApp, testRegistry } from './fixtures.js';

/**
 * Action-transition coherence (shared renderer contract):
 * - an action's visible completion (success feedback, control release)
 *   waits for the host refresh to settle, so success is never rendered
 *   beside the STALE record;
 * - a failed refresh never misreports the mutation as failed — the
 *   success message stays and a DISTINCT stale-data note appears;
 * - declared query actions still never invalidate (loop guard).
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mountMutation(onInvalidate: () => unknown, dispatch?: () => Promise<unknown>) {
  return renderVictApplication({
    plan: probeApp({
      role: 'action',
      id: 'x',
      actionId: 'act.create',
      label: 'Create item',
    }),
    registry: testRegistry(),
    dispatch: dispatch ?? (async () => ({ ok: true })),
    onInvalidate,
    path: '/',
  });
}

describe('action transition coherence (refresh-aware completion)', () => {
  it('keeps the loading control and hides feedback until the refresh settles', async () => {
    const gate = deferred<void>();
    const onInvalidate = vi.fn(() => gate.promise);
    const mounted = mountMutation(onInvalidate);
    try {
      const button = mounted.output.querySelector('button') as HTMLButtonElement;
      button.click();
      // The dispatch has resolved and the refresh has been REQUESTED…
      await vi.waitFor(() => expect(onInvalidate).toHaveBeenCalledTimes(1));
      // …but the refresh has NOT settled yet: the control must still be in
      // its loading state and NO success feedback may be visible beside the
      // (still stale) record.
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain('Working…');
      expect(mounted.output.querySelector('[data-testid="action-success"]')?.textContent).toBe('');
      // Refresh settles → the transition completes: control released,
      // feedback rendered (now coherent with refreshed data).
      gate.resolve();
      await vi.waitFor(() => expect(button.disabled).toBe(false));
      expect(mounted.output.querySelector('[data-testid="action-success"]')?.textContent).toContain(
        'Action completed.',
      );
      expect(mounted.output.querySelector('[data-testid="action-stale"]')).toBeNull();
    } finally {
      mounted.unmount();
    }
  });

  it('reports a failed refresh as success + distinct stale state, never as action failure', async () => {
    const onInvalidate = vi.fn(async () => {
      throw new Error('reload failed');
    });
    const mounted = mountMutation(onInvalidate);
    try {
      const button = mounted.output.querySelector('button') as HTMLButtonElement;
      button.click();
      await vi.waitFor(() => {
        // Wait for the REAL completion signal (the feedback text), not for
        // the control release — the button starts out enabled.
        expect(
          mounted.output.querySelector('[data-testid="action-success"]')?.textContent,
        ).not.toBe('');
      });
      // The ACTION succeeded and is still reported as successful …
      expect(mounted.output.querySelector('[data-testid="action-success"]')?.textContent).toContain(
        'Action completed.',
      );
      expect(mounted.output.querySelector('.vict-action-feedback')?.getAttribute('data-kind')).toBe(
        'success',
      );
      // … the failure text is NOT the action's (no misreported failure, no
      // unsafe re-run invitation) …
      expect(mounted.output.querySelector('[data-testid="action-error"]')?.textContent).toBe('');
      // … and the out-of-date view is named by a DISTINCT stale note.
      expect(mounted.output.querySelector('[data-testid="action-stale"]')?.textContent).toContain(
        'may be out of date',
      );
    } finally {
      mounted.unmount();
    }
  });

  it('works with a sync (non-promise) host hook: no stale note on success', async () => {
    const onInvalidate = vi.fn();
    const mounted = mountMutation(onInvalidate);
    try {
      const button = mounted.output.querySelector('button') as HTMLButtonElement;
      button.click();
      await vi.waitFor(() => expect(onInvalidate).toHaveBeenCalled());
      await vi.waitFor(() => expect(button.disabled).toBe(false));
      expect(mounted.output.querySelector('[data-testid="action-success"]')?.textContent).toContain(
        'Action completed.',
      );
      expect(mounted.output.querySelector('[data-testid="action-stale"]')).toBeNull();
    } finally {
      mounted.unmount();
    }
  });

  it('a failed refresh is surfaced through the conversation send path too', async () => {
    const onInvalidate = vi.fn(async () => {
      throw new Error('reload failed');
    });
    const mounted = renderVictApplication({
      plan: probeApp({
        role: 'conversation',
        id: 'conv',
        viewId: 'v.items',
        messageField: 'title',
        authorField: 'status',
        participantField: 'status',
        sendActionId: 'act.create',
        inputLabel: 'Message',
      }),
      registry: testRegistry(),
      dispatch: async () => ({ ok: true }),
      onInvalidate,
      path: '/',
      viewData: { 'v.items': { rows: [] } },
    });
    try {
      const input = mounted.output.querySelector(
        '[data-testid="conversation-input"]',
      ) as HTMLInputElement;
      input.value = 'hello';
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      // happy-dom does not propagate a button click to the form submit.
      const form = mounted.output.querySelector('form') as HTMLFormElement;
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
      await vi.waitFor(() => {
        expect(
          mounted.output.querySelector('[data-testid="conversation-stale"]')?.textContent,
        ).toContain('may be out of date');
      });
      // The send itself is treated as delivered (success), the refresh
      // failure is the separate stale note.
      expect(mounted.output.querySelector('.vict-send-error')?.textContent ?? '').toBe('');
      expect(
        (
          mounted.output.querySelector(
            '[data-testid="conversation-input"]',
          ) as HTMLInputElement | null
        )?.value,
      ).toBe('');
    } finally {
      mounted.unmount();
    }
  });
});
