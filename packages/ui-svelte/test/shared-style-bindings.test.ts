import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import { compileUiDocument, defaultSemanticElementCatalog, type UiDocument } from '@victframework/ui';
import DocumentHost from '../src/document/DocumentHost.svelte';

function source(mode: 'body-prop' | 'base-state' | 'base-outer-prop'): UiDocument {
  const base = mode !== 'body-prop';
  const outer = mode === 'base-outer-prop';
  return {
    schema: 'vict.ui-document@1', id: 'style-scope', revision: '1', root: outer ? 'outer' : 'card',
    nodes: {
      card: { kind: 'component', id: 'card', definitionId: 'card', props: { alpha: { type: 'literal', value: 0.4 } } },
      body: { kind: 'element', id: 'body', tag: 'article', children: [], ...(!base ? { styleSources: ['shared'] } : {}) },
      ...(outer ? { outer: { kind: 'component' as const, id: 'outer', definitionId: 'outer', props: { alpha: { type: 'literal' as const, value: 0.6 } } } } : {}),
    },
    componentDefinitions: {
      card: { id: 'card', revision: '1', root: 'body', props: [{ name: 'alpha', type: 'number' }], slots: {}, ...(base ? { baseStyle: 'shared' } : {}) },
      ...(outer ? { outer: { id: 'outer', revision: '1', root: 'card', props: [{ name: 'alpha', type: 'number' as const }], slots: {} } } : {}),
    },
    styleSources: { shared: { id: 'shared', declarations: [{ property: 'opacity', value: { type: 'binding', expression: { type: 'ref', path: mode === 'base-state' ? 'state.alpha' : 'prop.alpha' } } }] } },
    localState: { alpha: { key: 'alpha', type: 'number', initial: 0.75 } }, tokens: {}, conditions: {}, assets: {},
  };
}

describe('shared bindings retain actual renderer lexical scope (PV-05)', () => {
  for (const [mode, expected] of [['body-prop', '0.4'], ['base-state', '0.75'], ['base-outer-prop', '0.6']] as const) {
    it(`renders ${mode} from its existing scope`, async () => {
      const documentSource = source(mode);
      const compiled = compileUiDocument(documentSource, defaultSemanticElementCatalog());
      expect(compiled.ok).toBe(true);
      if (!compiled.ok) return;
      const target = document.createElement('div');
      document.body.append(target);
      const diagnostics: unknown[] = [];
      const instance = mount(DocumentHost, { target, props: { plan: compiled.plan, localState: documentSource.localState, dispatch: async () => undefined, navigate: () => undefined, onRenderDiagnostic: (diagnostic: unknown) => diagnostics.push(diagnostic) } });
      try {
        flushSync();
        const article = target.querySelector('article');
        expect(article).not.toBeNull();
        const style = article?.getAttribute('style') ?? '';
        expect(style).toMatch(new RegExp(`--ui-binding-[^:]+: ${expected.replace('.', '\\.')}\\s*;`));
        expect(diagnostics).toEqual([]);
      } finally {
        await unmount(instance);
        target.remove();
      }
    });
  }
});
