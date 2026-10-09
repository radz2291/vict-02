/**
 * VERIFICATION PROBE (round 3) — disclosed defect B: TimeField locale/hour-cycle.
 * Reproduces 12-hour en-GB (a) directly in the public primitive (bits-ui
 * re-export) and (b) through the authored catalog adapter, comparing en-US and
 * 24-hour behavior. Locates the defect at the primitive, adapter or
 * configuration boundary. Assertions are additive — never weaken them.
 */
import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import TimePrimitiveFixture from './TimePrimitiveFixture.svelte';
import type { UiDocument } from '@victframework/ui';
import DocumentHost from '../src/document/DocumentHost.svelte';
import { compileUiDocument, defaultSemanticElementCatalog } from '@victframework/ui';
import { catalogDescriptors, catalogImplementations } from '../src/catalog/components/catalog.js';
import type { UiSvelteComponentImplementation } from '../src/document/extensions.js';
import { catalogDescriptors } from '../src/catalog/components/catalog.js';

const cleanups: (() => void | Promise<void>)[] = [];

function host(): HTMLElement {
  const target = document.createElement('div');
  document.body.append(target);
  return target;
}

type Seg = { text: string; now: string | null; vt: string | null; label: string | null };

function segmentDump(target: HTMLElement): Seg[] {
  flushSync();
  return [...target.querySelectorAll('[role="spinbutton"]')].map(e => ({
    text: (e.textContent ?? '').trim(),
    now: e.getAttribute('aria-valuenow'),
    vt: e.getAttribute('aria-valuetext'),
    label: e.getAttribute('aria-label'),
  }));
}

function hourOf(segs: Seg[]): Seg | undefined {
  return segs.find(s => (s.label ?? '').toLowerCase().includes('hour'));
}

function periodText(target: HTMLElement): string {
  return ((target.querySelector('[data-testid="day-period"], [role="spinbutton"][aria-label*="period" i], [aria-label*="AM" i], [aria-label*="PM" i]')?.textContent ?? target.textContent ?? '').match(/AM|PM/i) ?? [''])[0];
}

describe('disclosed defect B: TimeField hour cycle — primitive vs adapter (en-GB 12h)', () => {
  it('primitive en-GB + hourCycle 12: hour shows 12-hour text with a day period', () => {
    const target = host();
    const instance = mount(TimePrimitiveFixture, { target, props: { locale: 'en-GB', hourCycle: 12, value: '13:30' } });
    cleanups.push(() => unmount(instance));
    const segs = segmentDump(target);
    const hour = hourOf(segs);
    const period = periodText(target);
    // 13:30 in 12-hour display is 01 with PM. If the primitive shows "13"
    // (24-hour) or no AM/PM, the defect lives at the PRIMITIVE/configuration
    // boundary, before any adapter code runs.
    expect(
      { hourText: hour?.text, hourNow: hour?.now, period, all: segs },
      JSON.stringify(segs),
    ).toEqual({ hourText: '01', hourNow: '1', period: 'PM', all: segs });
  });

  it('primitive en-GB + hourCycle 24: hour shows 24-hour text, no day period', () => {
    const target = host();
    const instance = mount(TimePrimitiveFixture, { target, props: { locale: 'en-GB', hourCycle: 24, value: '13:30' } });
    cleanups.push(() => unmount(instance));
    const segs = segmentDump(target);
    const hour = hourOf(segs);
    const period = periodText(target);
    expect({ hourText: hour?.text, period }, JSON.stringify(segs)).toEqual({ hourText: '13', period: '' });
  });

  it('primitive en-US + hourCycle 12 (control): hour shows 12-hour text with PM', () => {
    const target = host();
    const instance = mount(TimePrimitiveFixture, { target, props: { locale: 'en-US', hourCycle: 12, value: '13:30' } });
    cleanups.push(() => unmount(instance));
    const segs = segmentDump(target);
    const hour = hourOf(segs);
    const period = periodText(target);
    expect({ hourText: hour?.text, period }, JSON.stringify(segs)).toEqual({ hourText: '01', period: 'PM' });
  });

  it('adapter en-GB + hourCycle 12: authored time-field agrees with the primitive', () => {
    const target = host();
    const doc = {
      schema: 'vict.ui-document@1',
      id: 'probe.time.gb12',
      revision: '1',
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['tf'] },
        tf: {
          kind: 'component',
          id: 'tf',
          definitionId: 'vict.catalog.time-field',
          props: {
            value: { type: 'literal', value: '13:30' },
            locale: { type: 'literal', value: 'en-GB' },
            hourCycle: { type: 'literal', value: 12 },
            label: { type: 'literal', value: 'Handover window' },
            granularity: { type: 'literal', value: 'minute' },
          },
        },
      },
      componentDefinitions: {},
      styleSources: {},
      tokens: {},
      conditions: {},
      assets: {},
      localState: {},
    } as unknown as UiDocument;
    const compiled = compileUiDocument(doc, defaultSemanticElementCatalog(), catalogDescriptors);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues));
    const instance = mount(DocumentHost, {
      target,
      props: {
        plan: compiled.plan,
        extensionDescriptors: catalogDescriptors,
        extensionImplementations: catalogImplementations as readonly UiSvelteComponentImplementation[],
        localState: {},
        view: {},
        dispatch: async () => ({ ok: true }),
        navigate: () => {},
      },
    });
    cleanups.push(() => unmount(instance));
    if (target.querySelectorAll('[role="spinbutton"]').length === 0) {
      throw new Error('no spinbuttons rendered; HTML: ' + target.innerHTML.slice(0, 1200));
    }
    const segs = segmentDump(target);
    const hour = hourOf(segs);
    const period = periodText(target);
    expect(
      { hourText: hour?.text, hourNow: hour?.now, hourVt: hour?.vt, period, all: segs },
      JSON.stringify(segs),
    ).toEqual({ hourText: '01', hourNow: '1', hourVt: '01 PM', period: 'PM', all: segs });
  });

  it('adapter en-GB + hourCycle 12: the dayPeriod spinner flips 13:30 to 01:30 and back', () => {
    const target = host();
    const doc = {
      schema: 'vict.ui-document@1',
      id: 'probe.time.gb12.toggle',
      revision: '1',
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['tf'] },
        tf: {
          kind: 'component',
          id: 'tf',
          definitionId: 'vict.catalog.time-field',
          props: {
            value: { type: 'literal', value: '13:30' },
            locale: { type: 'literal', value: 'en-GB' },
            hourCycle: { type: 'literal', value: 12 },
            label: { type: 'literal', value: 'Handover window' },
            granularity: { type: 'literal', value: 'minute' },
          },
        },
      },
      componentDefinitions: {},
      styleSources: {},
      tokens: {},
      conditions: {},
      assets: {},
      localState: {},
    } as unknown as UiDocument;
    const compiled = compileUiDocument(doc, defaultSemanticElementCatalog(), catalogDescriptors);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues));
    const instance = mount(DocumentHost, {
      target,
      props: {
        plan: compiled.plan,
        extensionDescriptors: catalogDescriptors,
        extensionImplementations: catalogImplementations as readonly UiSvelteComponentImplementation[],
        localState: {},
        view: {},
        dispatch: async () => ({ ok: true }),
        navigate: () => {},
      },
    });
    cleanups.push(() => unmount(instance));
    const periodSeg = [...target.querySelectorAll('[role="spinbutton"]')].find(e =>
      (e.getAttribute('aria-label') ?? '').includes('AM/PM'),
    ) as HTMLElement | undefined;
    expect(periodSeg, 'dayPeriod segment must exist for 12-hour en-GB').toBeTruthy();
    // 13:30 is PM; the visible segment must say PM before any interaction.
    expect((periodSeg!.textContent ?? '').trim()).toBe('PM');
    // Toggling the spinner down (PM -> AM) must move the value to 01:30.
    periodSeg!.focus();
    periodSeg!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    flushSync();
    expect((periodSeg!.textContent ?? '').trim()).toBe('AM');
    const hourAfter = hourOf(segmentDump(target));
    expect({ hourText: hourAfter?.text, hourNow: hourAfter?.now }, 'after PM→AM toggle').toEqual({ hourText: '01', hourNow: '1' });
    // The underlying ISO value must be 01:30, not 13:30.
    const vt = hourAfter?.vt ?? '';
    expect(vt).toContain('AM');
  });
});
