// @vitest-environment happy-dom
//
// S9-04 confirmation journey UI render evidence — component ISOLATION per
// the slice contract: the test imports only the trusted component and its
// fixture types (NOT the parallel-built G2 core/transport code), mounting
// it with canned fixture data shaped from the frozen proposal §4.1/§5.
// Covers truthful prepare summary display, truthful statuses, failure
// banner tones, and the no-fabrication empty state.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ConfirmationReview from '$lib/components/ConfirmationReview.svelte';
import type { ConfirmationPrepareSummary, ConfirmationStatusResult } from '$lib/confirmation/confirmation.js';

const mounted: unknown[] = [];

const SUMMARY: ConfirmationPrepareSummary = {
  receiptId: 'rcpt-demo-01',
  command: 'run.cancel',
  payloadDigest: 'sha256:8f7501f…digest-hex',
  expectedRevision: '7',
  expiryAt: '2026-09-29T19:35:00Z',
  createdBy: 'actor-studio-operator',
  createdAt: '2026-09-29T19:25:00Z',
};

function mountReview(props: Record<string, unknown>): HTMLElement {
  const target = document.createElement('div');
  document.body.appendChild(target);
  mounted.push(
    mount(ConfirmationReview as never, { target, props }),
  );
  flushSync();
  return target;
}

afterEach(() => {
  for (const instance of mounted.splice(0)) {
    unmount(instance as never);
  }
  document.body.innerHTML = '';
});

describe('ConfirmationReview (S9-04 confirmation journey island)', () => {
  it('renders the full human-reviewable prepare summary verbatim', () => {
    const target = mountReview({ summary: SUMMARY });
    const html = target.innerHTML;
    expect(html).toContain('run.cancel');
    expect(html).toContain('rcpt-demo-01');
    expect(html).toContain(SUMMARY.payloadDigest);
    expect(html).toContain('7');
    expect(html).toContain('2026-09-29T19:35:00Z');
    expect(html).toContain('Expected revision');
    // Live-region semantics like the G1 component islands.
    expect(target.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  });

  it('renders truthful statuses without inventing intermediate state', () => {
    const cases: [ConfirmationStatusResult, string][] = [
      [{ name: 'prepared' }, 'awaiting human confirmation'],
      [{ name: 'consumed' }, 'the target effect was created'],
      [{ name: 'expired' }, 'expired without effect'],
      [{ name: 'spent' }, 'already consumed by a different request'],
      [{ name: 'unavailable' }, 'no matching receipt is visible (non-echoing)'],
    ];
    for (const [status, expected] of cases) {
      const target = mountReview({ status, summary: null });
      expect(target.innerHTML).toContain(expected);
    }
  });

  it('renders truthful banner text for failure codes with tone styling', () => {
    const target = mountReview({
      bannerText:
        'The target refused the call: no confirmation receipt was attached (VICT_CONFIRMATION_REQUIRED). Nothing was changed.',
      bannerTone: 'warning',
    });
    expect(target.innerHTML).toContain('VICT_CONFIRMATION_REQUIRED');
    expect(target.innerHTML).toContain('Nothing was changed.');
    expect(target.querySelector('.banner-warning')).not.toBeNull();
    expect(target.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('renders the error tone for settled failures (e.g. replay/spent)', () => {
    const target = mountReview({
      bannerText:
        'This receipt was already consumed by a different request (VICT_CONFIRMATION_SPENT). No second effect was created. Prepare again for a new intent.',
      bannerTone: 'danger',
    });
    expect(target.querySelector('.banner-error')).not.toBeNull();
    expect(target.innerHTML).toContain('VICT_CONFIRMATION_SPENT');
  });

  it('fabricates NOTHING when there is no data: only the truthful empty note', () => {
    const target = mountReview({});
    const html = target.innerHTML;
    expect(html).toContain('Nothing is shown that was not issued by the target.');
    expect(html).not.toContain('consumed');
    expect(html).not.toContain('prepared — awaiting');
    expect(html).not.toContain('rcpt-demo-01');
  });
});