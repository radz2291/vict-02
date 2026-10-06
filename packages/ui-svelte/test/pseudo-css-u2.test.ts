/**
 * U2-03 regression (independent-verification finding F1): pseudo-state
 * style sources must emit MATCHABLE CSS — the selector carries the pseudo
 * suffix (`.class:hover`), not an un-interpolated template.
 */
import { describe, expect, it } from 'vitest';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
} from '@victframework/ui';
import { styleRulesToCss } from '../src/document/logic.js';

function pseudoDocument(pseudo: 'hover' | 'focus' | 'active' | 'disabled'): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'doc.pseudo',
    revision: '1',
    root: 'n.root',
    nodes: {
      'n.root': {
        kind: 'element',
        id: 'n.root',
        tag: 'section',
        styleSources: ['src.pseudo'],
        children: [],
      },
    },
    componentDefinitions: {},
    styleSources: {
      'src.pseudo': {
        id: 'src.pseudo',
        declarations: [{ property: 'background', value: { type: 'text', value: 'navy' } }],
        pseudo,
      },
    },
    tokens: {},
    conditions: {},
    assets: {},
    localState: {},
  };
}

describe('U2-03 pseudo-state CSS emission (F1 regression)', () => {
  for (const pseudo of ['hover', 'focus', 'active', 'disabled'] as const) {
    it(`emits a matchable .class:${pseudo} rule`, () => {
      const compiled = compileUiDocument(pseudoDocument(pseudo), defaultSemanticElementCatalog());
      expect(compiled.ok).toBe(true);
      if (!compiled.ok) return;
      const rule = compiled.plan.style.rules.find((candidate) => candidate.pseudo === pseudo);
      expect(rule).toBeDefined();
      // selector = generated class + pseudo suffix (interpolated, no template junk)
      expect(rule?.selector).toMatch(/^\.uv-[0-9a-f]+-n_root$/);
      const css = styleRulesToCss(compiled.plan, 'uv-root-doc_pseudo-1');
      expect(css).toContain(`.uv-root-doc_pseudo-1 .uv-f95fe7ba-n_root:${pseudo} {`);
      expect(css).not.toContain('${');
    });
  }
});
