import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { renderVictApplication } from '@victframework/ui-svelte';
import { probeApp, surfaceForRole, testRegistry } from './fixtures.js';

function conversation(
  dispatch: (actionId: string, input?: unknown) => Promise<{ ok: boolean; code?: string }>,
  onInvalidate = vi.fn(),
) {
  const mounted = renderVictApplication({
    plan: probeApp(surfaceForRole('conversation')),
    registry: testRegistry(),
    dispatch,
    onInvalidate,
    viewData: { 'v.items': { rows: [] } },
  });
  const input = mounted.output.querySelector<HTMLInputElement>(
    '[data-testid="conversation-input"]',
  )!;
  const form = input.closest('form')!;
  const submit = () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    flushSync();
  };
  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
  };
  return { mounted, input, form, submit, type, onInvalidate };
}

describe('P4 presentation boundary', () => {
  it('normalizes read-only view, list, and detail data without raw plan props in UI', () => {
    for (const role of ['view', 'list', 'detail'] as const) {
      const mounted = renderVictApplication({
        plan: probeApp(surfaceForRole(role)),
        registry: testRegistry(),
        dispatch: async () => ({ ok: true }),
        viewData: {
          'v.items': {
            rows: [{ id: 'a', title: 'a'.repeat(200), status: 'active', qty: 1 }],
            record: { id: 'a', title: 'a'.repeat(200) },
          },
        },
      });
      try {
        if (role === 'view') {
          expect(mounted.output.querySelector('.vict-data-view th[scope="col"]')?.textContent).toBe(
            'id',
          );
          expect(mounted.output.querySelector('.vict-data-view td')?.textContent).toBe('a');
        } else if (role === 'list') {
          expect(mounted.output.querySelector('.vict-list-item')?.textContent).toContain('active');
        } else {
          expect(mounted.output.querySelector('.vict-detail dt')?.textContent).toBe('id');
          expect(mounted.output.querySelector('.vict-detail dd')?.textContent).toBe('a');
        }
      } finally {
        mounted.unmount();
      }
    }
  });

  it('trims sends, blocks duplicate submits, clears only after success, invalidates, and retains focus', async () => {
    let resolve!: (value: { ok: boolean }) => void;
    const dispatch = vi.fn(
      () =>
        new Promise<{ ok: boolean }>((done) => {
          resolve = done;
        }),
    );
    const app = conversation(dispatch);
    try {
      app.type('   ');
      app.submit();
      expect(dispatch).not.toHaveBeenCalled();
      app.type('  Hello world  ');
      app.input.focus();
      app.submit();
      app.submit();
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith('act.create', {
        text: 'Hello world',
        author: 'You',
        participant: 'user',
      });
      expect(app.input.value).toBe('  Hello world  ');
      expect(app.form.getAttribute('aria-busy')).toBe('true');
      resolve({ ok: true });
      await vi.waitFor(() => expect(app.input.value).toBe(''));
      expect(app.onInvalidate).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(app.input);
      expect(app.form.getAttribute('aria-busy')).toBe('false');
    } finally {
      app.mounted.unmount();
    }
  });

  it('keeps the draft and surfaces boundary denial without invalidating', async () => {
    const app = conversation(async () => ({ ok: false, code: 'DATA_UNAUTHORIZED' }));
    try {
      app.type('  Keep me  ');
      app.submit();
      await vi.waitFor(() =>
        expect(app.mounted.output.querySelector('.vict-send-error')?.textContent).toContain(
          'permission',
        ),
      );
      expect(app.input.value).toBe('  Keep me  ');
      expect(app.onInvalidate).not.toHaveBeenCalled();
    } finally {
      app.mounted.unmount();
    }
  });

  it('maps rejected sends to the safe host failure without leaking raw errors', async () => {
    const app = conversation(async () => {
      throw new Error('PRIVATE-CANARY');
    });
    try {
      app.type('Retry');
      app.submit();
      await vi.waitFor(() =>
        expect(app.mounted.output.querySelector('.vict-send-error')?.textContent).toContain(
          'could not be completed',
        ),
      );
      expect(app.input.value).toBe('Retry');
      expect(app.mounted.output.innerHTML).not.toContain('PRIVATE-CANARY');
      expect(app.onInvalidate).not.toHaveBeenCalled();
    } finally {
      app.mounted.unmount();
    }
  });
});
