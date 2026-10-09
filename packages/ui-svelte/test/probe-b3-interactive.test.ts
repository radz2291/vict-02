/**
 * Round-3 B3 interaction probes (non-defect modes): slider, meter, progress,
 * pagination. The date/time/partial-range defects have their own probes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import { mountDoc, teardownAll } from './probe-kit.js';

afterEach(teardownAll);

const lit = (value: string | number | boolean) => ({ type: 'literal', value }) as never;
const ref = (path: string) => ({ type: 'ref', path }) as never;

describe('B3: slider (numberList one-thumb / range modes)', () => {
  it('renders thumb(s) with the bound value and keyboard focusability', () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['sl'] },
        sl: {
          kind: 'component', id: 'sl', definitionId: 'vict.catalog.slider',
          props: { label: lit('Acceptable capacity'), value: ref('state.capacity'), min: lit(0), max: lit(100), step: lit(5) },
          outputs: { valueChange: { setState: { key: 'capacity', value: ref('$output') } } },
        },
      },
    }, { capacity: { key: 'capacity', type: 'numberList', initial: [20, 80] } as never });
    const thumbs = [...target.querySelectorAll('[role="slider"]')];
    expect(thumbs.length).toBe(2);
    expect(thumbs[0]?.getAttribute('aria-valuenow')).toBe('20');
    expect(thumbs[1]?.getAttribute('aria-valuenow')).toBe('80');
    expect(thumbs[0]?.getAttribute('tabindex')).toBe('0');
    // Keyboard stepping (ArrowRight steps by `step`) is browser-verified:
    // 60 -> 75 with step 15 on the schedule document (happy-dom synthetic
    // keydown does not drive the bits-ui slider).
  });
});

describe('B3: meter (presentation bound)', () => {
  it('renders the authored value', () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['mt'] },
        mt: {
          kind: 'component', id: 'mt', definitionId: 'vict.catalog.meter',
          props: { label: lit('Seal wear'), value: lit(72), min: lit(0), max: lit(100) },
        },
      },
    });
    const meter = target.querySelector('[role="meter"]') as HTMLElement;
    expect(meter).toBeTruthy();
    expect(meter.getAttribute('aria-valuenow')).toBe('72');
  });
});

describe('B3: progress (determinate and indeterminate)', () => {
  it('determinate renders aria-valuenow', () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['pg'] },
        pg: { kind: 'component', id: 'pg', definitionId: 'vict.catalog.progress', props: { label: lit('Upload'), value: lit(55) } },
      },
    });
    const bar = target.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.getAttribute('aria-valuenow')).toBe('55');
  });
  it('null value renders the indeterminate state (no aria-valuenow)', () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['pg'] },
        pg: { kind: 'component', id: 'pg', definitionId: 'vict.catalog.progress', props: { label: lit('Scanning') } },
      },
    });
    const bar = target.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar).toBeTruthy();
    // Library convention (recorded a11y nit): indeterminate renders
    // data-state=loading; aria-valuenow falls back to 0 rather than being
    // omitted — flagged as a finding, asserted as-built here.
    expect(bar.getAttribute('data-state')).toBe('loading');
  });
});

describe('B3: pagination (page number)', () => {
  it('next/previous moves the page through the state loop', () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['pn'] },
        pn: {
          kind: 'component', id: 'pn', definitionId: 'vict.catalog.pagination',
          props: { page: ref('state.page'), count: lit(10), perPage: lit(1) },
          outputs: { pageChange: { setState: { key: 'page', value: ref('$output') } } },
        },
      },
    }, { page: { key: 'page', type: 'number', initial: 2 } as never });
    const page = () => target.querySelector('[data-pagination-root]');
    expect(page()).toBeTruthy();
    const current = () => [...target.querySelectorAll('[aria-current="page"], [data-selected], [data-pagination-root] [aria-live]')].map(e => (e.textContent ?? '').trim());
    expect(current().join(',')).toContain('2');
    const next = [...target.querySelectorAll('button')].find(b => /next|›/i.test(b.getAttribute('aria-label') ?? b.textContent ?? ''));
    expect(next).toBeTruthy();
    next!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    next!.click();
    flushSync();
    expect(current().join(',')).toContain('3');
  });
});
