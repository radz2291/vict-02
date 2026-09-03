import { describe, expect, it } from 'vitest';
import { compileApplication, type ApplicationPlan } from '@vict/application';
import { renderVictApplication, type MountedVictApplication } from '@vict/renderer-svelte';
import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@vict/sdk';
import { headingTagForLevel } from '../src/logic.js';
import { itemResource, testRegistry } from './fixtures.js';

/**
 * Permanent LOW-05-C regression: the `text` role emits the DECLARED heading
 * level. The tag name originates ONLY from the compiler-validated closed
 * vocabulary (h1–h6); unleveled text keeps its documented non-heading
 * rendering; the emitted document outline is meaningful.
 */

function compileTextProbe(surfaces: readonly Record<string, unknown>[]): ApplicationPlan {
  const application = defineApplication({
    schema: APPLICATION_DEFINITION_SCHEMA_V2,
    id: 'app.probe',
    revision: '1',
    routes: [{ id: 'home', path: '/', screenId: 's.text' }],
    screens: [
      {
        id: 's.text',
        title: 'Text probe',
        layout: [{ name: 'main', surfaces: surfaces as never }],
      },
    ],
    views: [
      {
        viewId: 'v.items',
        resourceId: 'items',
        resourceRevision: '1',
        fields: ['id', 'title', 'status', 'qty'],
      },
    ],
    actions: [{ kind: 'local', id: 'act.local', revision: '1' }],
    resources: [{ resourceId: 'items', revision: '1' }],
    components: [{ componentId: 'cmp.badge', revision: '1' }],
  });
  const result = compileApplication({
    application,
    resources: [itemResource],
    contracts: [],
    components: [{ componentId: 'cmp.badge', revision: '1' }],
  });
  if (!result.ok) {
    throw new Error(`probe plan invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}

function mount(plan: ApplicationPlan): MountedVictApplication {
  return renderVictApplication({
    plan,
    registry: testRegistry(),
    dispatch: async () => ({ ok: true, value: null }),
    path: '/',
    viewData: {},
  });
}

function textSurface(level: number | undefined, content: string): Record<string, unknown> {
  return level === undefined
    ? { role: 'text', id: `x-${content}`, content }
    : { role: 'text', id: `x-${content}`, level, content };
}

describe('declared heading levels (LOW-05-C)', () => {
  it('levels 1–6 map to the closed h1–h6 vocabulary', () => {
    expect(headingTagForLevel(1)).toBe('h1');
    expect(headingTagForLevel(2)).toBe('h2');
    expect(headingTagForLevel(3)).toBe('h3');
    expect(headingTagForLevel(4)).toBe('h4');
    expect(headingTagForLevel(5)).toBe('h5');
    expect(headingTagForLevel(6)).toBe('h6');
    // Out-of-vocabulary levels and unleveled text produce NO heading.
    expect(headingTagForLevel(0)).toBeNull();
    expect(headingTagForLevel(7)).toBeNull();
    expect(headingTagForLevel(-1)).toBeNull();
    expect(headingTagForLevel(1.5)).toBeNull();
    expect(headingTagForLevel('2')).toBeNull();
    expect(headingTagForLevel(undefined)).toBeNull();
    expect(headingTagForLevel(NaN)).toBeNull();
  });

  it('emits the declared heading element for every level', () => {
    const plan = compileTextProbe([
      textSurface(1, '1'),
      textSurface(2, '2'),
      textSurface(3, '3'),
      textSurface(4, '4'),
      textSurface(5, '5'),
      textSurface(6, '6'),
    ]);
    const mounted = mount(plan);
    try {
      for (const level of [1, 2, 3, 4, 5, 6] as const) {
        const element = mounted.output.querySelector(`h${level}[data-surface="x-${level}"]`);
        expect(element, `h${level}`).not.toBeNull();
        expect(element?.tagName.toLowerCase()).toBe(`h${level}`);
        expect(element?.textContent).toBe(String(level));
      }
    } finally {
      mounted.unmount();
    }
  });

  it('unleveled text keeps its documented non-heading rendering', () => {
    const plan = compileTextProbe([textSurface(undefined, 'plain')]);
    const mounted = mount(plan);
    try {
      const paragraph = mounted.output.querySelector('p[data-surface="x-plain"]');
      expect(paragraph).not.toBeNull();
      expect(paragraph?.textContent).toBe('plain');
      // No SURFACE heading is emitted (the screen title heading is the
      // header's own element, not a text surface).
      expect(mounted.output.querySelectorAll('[data-surface]')[0]?.tagName).toBe('P');
    } finally {
      mounted.unmount();
    }
  });

  it('produces a meaningful document outline (nested levels in document order)', () => {
    const plan = compileTextProbe([
      textSurface(1, 'root'),
      textSurface(2, 'section-a'),
      textSurface(3, 'subsection-a1'),
      textSurface(2, 'section-b'),
    ]);
    const mounted = mount(plan);
    try {
      const headings = [...mounted.output.querySelectorAll('[data-surface]')].filter((element) =>
        /^H[1-6]$/.test(element.tagName),
      );
      expect(headings.map((heading) => `${heading.tagName}:${heading.textContent}`)).toEqual([
        'H1:root',
        'H2:section-a',
        'H3:subsection-a1',
        'H2:section-b',
      ]);
    } finally {
      mounted.unmount();
    }
  });
});
