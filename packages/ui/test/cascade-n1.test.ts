/**
 * U2-01 cascade regression (round-2 independent finding N1, reclassified as
 * a U2-01 failure): an INSTANCE's localStyle must survive a later SHARED
 * definition-body localStyle edit of the same property. Frozen cascade:
 * shared component presentation (definition-body sources AND localStyle)
 * compiles as componentBase; instance localStyle is the innermost 'local'
 * layer — never competing by CSS order.
 */
import { describe, expect, it } from 'vitest';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
} from '@victframework/ui';

function doc(): UiDocument {
  return JSON.parse(
    JSON.stringify({
      schema: 'vict.ui-document@1',
      id: 'doc.n1',
      revision: '1',
      root: 'n.root',
      nodes: {
        'n.root': { kind: 'element', id: 'n.root', tag: 'main', children: ['n.pink', 'n.later'] },
        'def.card': { kind: 'element', id: 'def.card', tag: 'article', children: [] },
        'n.pink': {
          kind: 'component',
          id: 'n.pink',
          definitionId: 'def.card',
          localStyle: [{ property: 'background-color', value: { type: 'text', value: 'pink' } }],
        },
        'n.later': { kind: 'component', id: 'n.later', definitionId: 'def.card' },
      },
      componentDefinitions: {
        'def.card': { id: 'def.card', revision: '1', root: 'def.card', props: [], slots: {} },
      },
      styleSources: {},
      tokens: {},
      conditions: {},
      assets: {},
      localState: {},
    }),
  ) as unknown as UiDocument;
}

describe('frozen cascade: shared presentation never overrides instance overrides', () => {
  it('a shared-body localStyle edit lands in componentBase; the instance pink stays innermost', () => {
    const document = doc();
    // the owner's repro: AFTER the instance override exists, the shared card
    // background changes to blue via a definition-body localStyle edit.
    (document.nodes['def.card'] as { localStyle?: unknown }).localStyle = [
      { property: 'background-color', value: { type: 'text', value: 'blue' } },
    ];
    const compiled = compileUiDocument(document, defaultSemanticElementCatalog());
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const localRules = compiled.plan.style.rules.filter((rule) => rule.layer === 'local');
    const baseRules = compiled.plan.style.rules.filter((rule) => rule.layer === 'componentBase');
    // the shared blue lives in componentBase (never in local)
    expect(localRules.some((rule) => JSON.stringify(rule.declarations).includes('blue'))).toBe(
      false,
    );
    expect(baseRules.some((rule) => JSON.stringify(rule.declarations).includes('"blue"'))).toBe(
      true,
    );
    // the instance pink is the innermost local rule -> wins by the frozen cascade
    expect(
      localRules.some(
        (rule) =>
          rule.selector.includes('n_pink') && JSON.stringify(rule.declarations).includes('"pink"'),
      ),
    ).toBe(true);
    // and the plan declares the layer order that makes componentBase lose to local
    const layers = compiled.plan.style.layers;
    expect(layers.indexOf('local')).toBeGreaterThan(layers.indexOf('componentBase'));
  });

  it('order independence: the shared edit still cannot win when the styled instance compiles FIRST', () => {
    const document = doc();
    (document.nodes['n.root'] as unknown as { children: string[] }).children = ['n.later', 'n.pink'];
    (document.nodes['def.card'] as { localStyle?: unknown }).localStyle = [
      { property: 'background-color', value: { type: 'text', value: 'blue' } },
    ];
    const compiled = compileUiDocument(document, defaultSemanticElementCatalog());
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const localRules = compiled.plan.style.rules.filter((rule) => rule.layer === 'local');
    expect(localRules.map((rule) => rule.selector)).toEqual(['.uv-a017549e-n_pink']);
  });
});
