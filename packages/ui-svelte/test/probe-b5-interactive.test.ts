/**
 * Round-3 B5 probes: collapsible open loop, alert-dialog, popover, tooltip
 * (controlled-open defect), and the display/composition set.
 *
 * Environment note: happy-dom does not mount portaled overlay CONTENT for the
 * alert-dialog/popover families (trigger state flips, content absent). Those
 * journeys are verified in the real browser (detail document: alert-dialog
 * opens with focus inside and Cancel closes+restores; popover opens with the
 * authored content). The unit assertions below cover what happy-dom renders
 * faithfully; the tooltip controlled-open failure reproduces in BOTH
 * environments and is the repair oracle.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import { mountDoc, teardownAll } from './probe-kit.js';

afterEach(teardownAll);

const lit = (value: string | number | boolean) => ({ type: 'literal', value }) as never;
const ref = (path: string) => ({ type: 'ref', path }) as never;

describe('B5: collapsible (controlled open loop)', () => {
  it('toggles open through the state loop and shows content', async () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['col'] } as never,
        col: {
          kind: 'component', id: 'col', definitionId: 'vict.catalog.collapsible',
          props: { open: ref('state.availOpen'), label: lit('Browse availability') },
          outputs: { openChange: { setState: { key: 'availOpen', value: ref('$output') } } },
          slots: { trigger: { name: 'trigger', children: ['colt'] }, content: { name: 'content', children: ['colc'] } },
        } as never,
        colt: { kind: 'text', id: 'colt', content: { type: 'literal', value: 'Browse availability' } } as never,
        colc: { kind: 'text', id: 'colc', content: { type: 'literal', value: 'October has open slots.' } } as never,
      },
    }, { availOpen: { key: 'availOpen', type: 'boolean', initial: false } as never });
    const trigger = [...target.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('Browse availability'));
    expect(trigger).toBeTruthy();
    expect(trigger!.getAttribute('aria-expanded')).toBe('false');
    trigger!.click();
    await new Promise((r) => setTimeout(r, 60));
    flushSync();
    expect(trigger!.getAttribute('aria-expanded')).toBe('true');
    expect((target.textContent ?? '')).toContain('October has open slots.');
  });
});

describe('B5: alert-dialog (browser-verified overlay)', () => {
  it('renders the trigger with the authored label', () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['ad'] } as never,
        ad: {
          kind: 'component', id: 'ad', definitionId: 'vict.catalog.alert-dialog',
          props: { label: lit('Archive inspection'), title: lit('Archive this inspection?'), open: ref('state.archiveOpen') },
          outputs: { openChange: { setState: { key: 'archiveOpen', value: ref('$output') } } },
          slots: { trigger: { name: 'trigger', children: ['adt'] }, body: { name: 'body', children: ['adc'] } },
        } as never,
        adt: { kind: 'text', id: 'adt', content: { type: 'literal', value: 'Archive inspection' } } as never,
        adc: { kind: 'text', id: 'adc', content: { type: 'literal', value: 'The decision is recorded.' } } as never,
      },
    }, { archiveOpen: { key: 'archiveOpen', type: 'boolean', initial: false } as never });
    const trigger = [...target.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('Archive inspection'));
    expect(trigger, 'trigger rendered with authored label').toBeTruthy();
  });
});

describe('B5: popover (browser-verified overlay)', () => {
  it('renders the trigger with the authored label', () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['po'] } as never,
        po: {
          kind: 'component', id: 'po', definitionId: 'vict.catalog.popover',
          props: { label: lit('Decision guidance'), title: lit('Before you submit'), open: ref('state.guideOpen') },
          outputs: { openChange: { setState: { key: 'guideOpen', value: ref('$output') } } },
          slots: { trigger: { name: 'trigger', children: ['pot'] }, content: { name: 'content', children: ['poc'] } },
        } as never,
        pot: { kind: 'text', id: 'pot', content: { type: 'literal', value: 'Decision guidance' } } as never,
        poc: { kind: 'text', id: 'poc', content: { type: 'literal', value: 'Acknowledge findings first.' } } as never,
      },
    }, { guideOpen: { key: 'guideOpen', type: 'boolean', initial: false } as never });
    const trigger = [...target.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('Decision guidance'));
    expect(trigger, 'trigger rendered with authored label').toBeTruthy();
  });
});

describe('B5: tooltip controlled-open (KNOWN DEFECT probe)', () => {
  it('renders content when the authored open state is true', async () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['tp'] } as never,
        tp: {
          kind: 'component', id: 'tp', definitionId: 'vict.catalog.tooltip',
          props: {
            label: lit('Priority guidance'), title: lit('High priority'),
            description: lit('Safety findings must be acknowledged.'),
            open: ref('state.tipOpen'),
          },
          outputs: { openChange: { setState: { key: 'tipOpen', value: ref('$output') } } },
        },
      },
    }, { tipOpen: { key: 'tipOpen', type: 'boolean', initial: true } as never });
    await new Promise((r) => setTimeout(r, 80));
    flushSync();
    const content = document.querySelector('[role="tooltip"]');
    // DISCLOSED DEFECT (round 3): with tipOpen=true the content never mounts
    // (reproduced in happy-dom AND the packed-capable browser via the preview
    // state panel). This assertion is the repair oracle — Codex must make it
    // pass without weakening the hover path.
    expect(content, 'controlled-open tooltip renders [role=tooltip]').toBeTruthy();
    expect(content?.textContent).toContain('High priority');
  });
});

describe('B5: display composition (avatar, aspect-ratio, separator, label, scroll-area, toolbar)', () => {
  it('renders the display set with authored configuration', () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['av', 'ar', 'sep', 'lab', 'sa', 'tb'] } as never,
        av: { kind: 'component', id: 'av', definitionId: 'vict.catalog.avatar', props: { alt: lit('Ada, lead inspector'), fallback: lit('AD'), src: lit('') } } as never,
        ar: {
          kind: 'component', id: 'ar', definitionId: 'vict.catalog.aspect-ratio', props: { ratio: lit(1.7777777777777777) },
          slots: { content: { name: 'content', children: ['arc'] } },
        } as never,
        arc: { kind: 'element', id: 'arc', tag: 'div', children: [] } as never,
        sep: { kind: 'component', id: 'sep', definitionId: 'vict.catalog.separator', props: {} } as never,
        lab: { kind: 'component', id: 'lab', definitionId: 'vict.catalog.label', props: { label: lit('Inspection reference') } } as never,
        sa: {
          kind: 'component', id: 'sa', definitionId: 'vict.catalog.scroll-area', props: { type: lit('always') },
          slots: { content: { name: 'content', children: ['sac'] } },
        } as never,
        sac: { kind: 'text', id: 'sac', content: { type: 'literal', value: 'Evidence received at Riverside Plant' } } as never,
        tb: {
          kind: 'component', id: 'tb', definitionId: 'vict.catalog.toolbar', props: { label: lit('Inspection tools') },
          slots: { tools: { name: 'tools', children: ['tbb'] } },
        } as never,
        tbb: { kind: 'component', id: 'tbb', definitionId: 'vict.catalog.toolbar-button', props: { label: lit('Refresh queue') } } as never,
      },
    });
    expect(target.querySelector('[data-avatar-root], [data-ui-occ*="av"] img, [data-ui-occ*="av"] span')).toBeTruthy();
    expect(target.querySelector('hr, [role="separator"], [data-separator-root]')).toBeTruthy();
    expect((target.textContent ?? '')).toContain('Inspection reference');
    expect((target.textContent ?? '')).toContain('Evidence received at Riverside Plant');
    expect([...target.querySelectorAll('button')].some(b => (b.textContent ?? '').includes('Refresh queue'))).toBe(true);
  });
});
