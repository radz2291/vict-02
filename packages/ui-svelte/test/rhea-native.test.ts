import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { authoringDigest, compileUiDocument, defaultSemanticElementCatalog, type UiDocument } from '@victframework/ui';
import { rheaNativePatterns } from '../src/rhea.js';
import { catalogDescriptors } from '../src/catalog/components/catalog.js';
import DocumentHost from '../src/document/DocumentHost.svelte';
import compatibility from '../src/catalog/components/authoring-compatibility.json' with {type: 'json'};

function source(id: string): UiDocument {
  const pattern = rheaNativePatterns.find(item => item.id === id)!;
  const seed = pattern.create('pattern');
  return {schema: 'vict.ui-document@1', id: `rhea-${id}`, revision: '1', root: seed.root,
    nodes: Object.fromEntries(seed.nodes.map(node => [node.id, node])), localState: seed.localState ?? {},
    componentDefinitions: {}, styleSources: {}, tokens: {}, conditions: {}, assets: {}};
}

describe('Rhea canonical native compositions', () => {
  it('pins exact shipped local source and license bytes, including LF policy', () => {
    const manifest = JSON.parse(readFileSync('packages/ui-svelte/rhea-upstream-manifest.json', 'utf8'));
    for (const file of manifest.localFiles) {
      const bytes = readFileSync(`packages/ui-svelte/${file.path}`);
      expect(bytes.includes(Buffer.from('\r\n')), file.path).toBe(false);
      expect(createHash('sha256').update(bytes).digest('hex'), file.path).toBe(file.sha256);
    }
  });
  for (const pattern of rheaNativePatterns) {
    it(`${pattern.id} compiles and renders through the same DocumentHost`, async () => {
      const doc = source(pattern.id), before = JSON.stringify(doc);
      const result = compileUiDocument(doc, defaultSemanticElementCatalog());
      expect(result.ok, JSON.stringify(result)).toBe(true);
      if (!result.ok) return;
      const target = document.createElement('div');
      document.body.append(target);
      const diagnostics: unknown[] = [];
      const instance = mount(DocumentHost, {target, props: {plan: result.plan, localState: doc.localState,
        dispatch: async () => undefined, navigate: () => undefined,
        onRenderDiagnostic: diagnostic => diagnostics.push(diagnostic)}});
      try {
        flushSync();
        expect(target.querySelector('.vict-rhea')).not.toBeNull();
        expect(diagnostics).toEqual([]);
        expect(JSON.stringify(doc)).toBe(before);
        if (pattern.id === 'table') {
          expect(target.querySelector('table caption')?.textContent).toBe('Example records');
          expect(target.querySelectorAll('th[scope="col"]')).toHaveLength(2);
        }
        if (pattern.id === 'kbd') expect(target.querySelector('kbd')?.textContent).toBe('Esc');
        if (pattern.id === 'skeleton') expect(target.querySelector('[aria-hidden="true"]')).not.toBeNull();
      } finally { await unmount(instance); target.remove(); }
    });
  }

  for (const id of ['field', 'input', 'textarea', 'native-select']) {
    it(`${id} connects its native label and edits only declared local state`, async () => {
      const doc = source(id), result = compileUiDocument(doc, defaultSemanticElementCatalog());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const target = document.createElement('div'); document.body.append(target);
      const changes: [string, unknown][] = [];
      const instance = mount(DocumentHost, {target, props: {plan: result.plan, localState: doc.localState,
        dispatch: async () => { throw new Error('Native local field must not dispatch an effect.'); }, navigate: () => undefined,
        onStateChange: (key, value) => changes.push([key, value])}});
      try {
        flushSync();
        const control = target.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')!;
        expect(target.querySelector('label')?.htmlFor).toBe(control.id);
        expect(control.getAttribute('aria-describedby')).toBe('pattern-help');
        control.value = id === 'native-select' ? 'second' : 'Edited locally';
        control.dispatchEvent(new Event('change', {bubbles: true})); flushSync();
        expect(changes.at(-1)).toEqual(['rhea_pattern_value', control.value]);
      } finally { await unmount(instance); target.remove(); }
    });
  }

  it('preserves all existing descriptor contracts and their exact revisions', () => {
    expect(catalogDescriptors).toHaveLength(80);
    for (const descriptor of catalogDescriptors) {
      const pin = compatibility.find(item => item.id === descriptor.id && item.revision === descriptor.revision);
      expect(pin?.descriptorDigest, descriptor.id).toBe(authoringDigest(descriptor));
    }
  });

  it('accounts for all63pinned families without counting native patterns as components', () => {
    const matrix = JSON.parse(readFileSync('docs/studio/CYCLE-1-4-CATALOG-MIGRATION.json', 'utf8'));
    expect(matrix.families).toHaveLength(63);
    expect(new Set(matrix.families.map((item: {family: string}) => item.family)).size).toBe(63);
    expect(matrix.totals.additionalRegisteredComponents).toBe(0);
    expect(matrix.totals.newNativePatterns).toBe(rheaNativePatterns.length);
    for (const row of matrix.families) {
      expect(row.upstreamSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(row.compatibility).toBeTruthy();
      expect(row.omittedFunctionality).toBeTruthy();
    }
  });

  it('keeps theme selectors scoped and leaves context-trigger geometry untouched', () => {
    const css = postcss.parse(readFileSync('packages/ui-svelte/src/rhea.css', 'utf8'));
    css.walkRules(rule => {
      if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
      for (const selector of rule.selectors) expect(selector.startsWith('.vict-rhea'), selector).toBe(true);
      if (rule.selector.includes('[data-context-menu-trigger]')) {
        expect(rule.nodes.filter(node => node.type === 'decl' && ['display', 'width', 'height', 'min-height', 'padding'].includes(node.prop))).toEqual([]);
      }
    });
  });
});
