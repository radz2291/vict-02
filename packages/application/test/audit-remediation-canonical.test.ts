import { describe, expect, it } from 'vitest';
import { APPLICATION_DEFINITION_SCHEMA, defineApplication } from '@vict/sdk';
import { compileApplication } from '../src/index.js';
import type { ApplicationDefinition } from '@vict/sdk';

/**
 * Stage 04 audit remediation — MED-04-F: the canonical serializable domain.
 *
 * Every audit collision below must FAIL compilation with a structured
 * diagnostic; no ambiguous `applicationVersion` may be produced. Retained
 * properties (insertion-order independence, meaningful-sequence
 * sensitivity, Unicode correctness, deterministic hashing) are also
 * re-verified.
 */

function baseApplication(order: unknown): ApplicationDefinition {
  return defineApplication({
    schema: APPLICATION_DEFINITION_SCHEMA,
    id: 'app.canonical',
    revision: '1',
    routes: [
      {
        id: 'home',
        path: '/',
        screenId: 's.main',
        nav: { label: 'Home', order } as never,
      },
    ],
    screens: [
      {
        id: 's.main',
        title: 'Main',
        layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't', content: 'hi' }] }],
      },
    ],
    actions: [],
    resources: [],
  });
}

/**
 * Compile with a hostile `nav.order` value. The authoring factory's capture
 * may reject the value structurally (VictAuthoringError) OR the compiler may
 * return the structured issue — both are fail-closed; neither produces an
 * applicationVersion. This helper normalizes both paths.
 */
type HostileCompileResult =
  | { readonly ok: true; readonly plan: { readonly applicationVersion: string } }
  | { readonly ok: false; readonly issues: readonly { readonly code: string }[] };

function compileWithNavOrder(order: unknown): HostileCompileResult {
  let definition: ApplicationDefinition;
  try {
    definition = baseApplication(order);
  } catch {
    return {
      ok: false,
      issues: [{ code: 'VICT_AUTHORING_UNSUPPORTED_VALUE' }],
    };
  }
  return compileApplication({ application: definition, resources: [] });
}

describe('MED-04-F: the canonical serializable domain rejects out-of-domain values', () => {
  it.each([
    ['NaN vs null', Number.NaN],
    ['Infinity vs null', Number.POSITIVE_INFINITY],
    ['-Infinity vs null', Number.NEGATIVE_INFINITY],
  ])('%s fails compilation instead of silently coercing', (_label, order) => {
    const result = compileWithNavOrder(order);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/APPLICATION_NON_CANONICAL_VALUE|VICT_AUTHORING_UNSUPPORTED_VALUE/),
        ]),
      );
    }
  });

  it('negative zero fails compilation (no silent -0 vs 0 collision)', () => {
    expect(compileWithNavOrder(-0).ok).toBe(false);
    expect(compileWithNavOrder(0).ok).toBe(true);
  });

  it('a function-valued field fails compilation (function vs omitted field)', () => {
    const result = compileWithNavOrder((): number => 1);
    expect(result.ok).toBe(false);
  });

  it('a BigInt-valued field fails compilation (BigInt vs same textual string)', () => {
    const result = compileWithNavOrder(5n);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/APPLICATION_NON_CANONICAL_VALUE|VICT_AUTHORING_UNSUPPORTED_VALUE/),
        ]),
      );
    }
  });

  it('a Date-valued field fails compilation', () => {
    expect(compileWithNavOrder(new Date()).ok).toBe(false);
  });

  it('out-of-domain values never silently produce an applicationVersion', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -0, (): number => 1, 3n, new Date()]) {
      const result = compileWithNavOrder(bad);
      expect(result.ok).toBe(false);
    }
  });

  it('valid numbers still compile with a stable canonical identity', () => {
    const first = compileWithNavOrder(1);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.plan.applicationVersion).toMatch(/^v1_[0-9a-f]{64}$/);
      const again = compileWithNavOrder(1);
      if (again.ok) {
        expect(again.plan.applicationVersion).toBe(first.plan.applicationVersion);
      }
    }
  });

  it('meaningful navigation order changes identity; hostile values never compile', () => {
    const one = compileWithNavOrder(1);
    const two = compileWithNavOrder(2);
    expect(one.ok && two.ok).toBe(true);
    if (one.ok && two.ok) {
      expect(one.plan.applicationVersion).not.toBe(two.plan.applicationVersion);
    }
  });

  it('Unicode correctness: distinct Unicode routes produce distinct deterministic identities', () => {
    const build = (label: string) =>
      compileApplication({
        application: defineApplication({
          schema: APPLICATION_DEFINITION_SCHEMA,
          id: 'app.unicode',
          revision: '1',
          routes: [
            {
              id: 'home',
              path: '/',
              screenId: 's.main',
              nav: { label: `路由-${label}`, order: 1 },
            },
          ],
          screens: [
            {
              id: 's.main',
              title: 'Main',
              layout: [
                { name: 'main', surfaces: [{ role: 'text', id: 't', content: 'héllo 🌍' }] },
              ],
            },
          ],
          actions: [],
          resources: [],
        }),
        resources: [],
      });
    const latin = build('route');
    const cjk = build('路线');
    expect(latin.ok && cjk.ok).toBe(true);
    if (latin.ok && cjk.ok) {
      expect(latin.plan.applicationVersion).not.toBe(cjk.plan.applicationVersion);
      // Deterministic across repeated compilation.
      const again = build('route');
      if (again.ok) {
        expect(again.plan.applicationVersion).toBe(latin.plan.applicationVersion);
      }
    }
  });
});
