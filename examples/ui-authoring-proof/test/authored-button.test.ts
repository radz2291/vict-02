import { describe, expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import DetailPage from '../src/routes/inspection/[id]/+page.svelte';

/**
 * BLOCKER-1 regression: the AUTHORED document Approve button (the
 * component-declared interaction) must dispatch through the REAL adapter
 * boundary — never a silent stub — and surface the same success/denial
 * behavior as the native host control.
 */
describe('U1-05: the authored Approve button dispatches through the real boundary', () => {
  function mountDetail(role: 'supervisor' | 'technician') {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(DetailPage, {
      target,
      props: { data: { id: 'i-101', actorRole: role } },
    });
    flushSync();
    return { target, instance };
  }

  it('clicking the authored button approves through the adapter (supervisor)', async () => {
    const { target, instance } = mountDetail('supervisor');
    try {
      // wait for the async record load
      await new Promise((r) => setTimeout(r, 50));
      flushSync();
      const authoredButton = target.querySelector(
        '[data-ui-node="n.approveButton"]',
      ) as HTMLElement;
      expect(authoredButton).not.toBeNull();
      authoredButton.click();
      await new Promise((r) => setTimeout(r, 100));
      flushSync();
      const status = target.querySelector('[data-ui-node="n.status"]');
      expect(status?.textContent).toBe('approved');
      const activity = [...target.querySelectorAll('[data-ui-node="n.activityItem"]')].map(
        (e) => e.textContent ?? '',
      );
      expect(activity.some((entry) => entry.includes('approved'))).toBe(true);
      const feedback = target.querySelector('[role="status"], [role="alert"]');
      expect(feedback?.textContent).toContain('Decision recorded');
    } finally {
      unmount(instance);
      target.remove();
    }
  });

  it('clicking the authored button as technician surfaces the boundary denial (state unchanged)', async () => {
    const { target, instance } = mountDetail('technician');
    try {
      await new Promise((r) => setTimeout(r, 50));
      flushSync();
      const authoredButton = target.querySelector(
        '[data-ui-node="n.approveButton"]',
      ) as HTMLElement;
      authoredButton.click();
      await new Promise((r) => setTimeout(r, 100));
      flushSync();
      const status = target.querySelector('[data-ui-node="n.status"]');
      expect(status?.textContent).toBe('submitted'); // unchanged
      const alert = target.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('DATA_UNAUTHORIZED');
    } finally {
      unmount(instance);
      target.remove();
    }
  });
});
