import { expect, it } from 'vitest';
import { canonicalUiDocument, type UiDocument } from '@victframework/ui';
import { newScreen } from '../src/lib/designer/application.js';
import { compactStructure, filterStructure, projectStructure, structureNodePresentation } from '../src/lib/designer/structure.js';

function fixture(): UiDocument {
  const base = newScreen('Presentation', 'structure-presentation');
  return { ...base, nodes: {
    screen: { id: 'screen', kind: 'element', tag: 'main', children: ['title', 'live', 'standalone'] },
    title: { id: 'title', kind: 'element', tag: 'h2', children: ['title-text'] },
    'title-text': { id: 'title-text', kind: 'text', content: { type: 'literal', value: 'Customer settings' } },
    live: { id: 'live', kind: 'element', tag: 'p', children: ['live-text'] },
    'live-text': { id: 'live-text', kind: 'text', content: { type: 'expression', expression: { type: 'ref', path: 'state.message' } } },
    standalone: { id: 'standalone', kind: 'text', content: { type: 'literal', value: 'Standalone copy' } },
  } };
}

it('simplifies only redundant literal leaves, keeping dynamic bindings, standalone copy and source identity', () => {
  const source = fixture(); const before = canonicalUiDocument(source).contentDigest;
  const full = filterStructure(projectStructure(source), { bindings: true });
  const simple = compactStructure(full, source);
  expect(simple.nodes.some(node => node.data.sourceId === 'title-text')).toBe(false);
  expect(simple.nodes.some(node => node.data.sourceId === 'title')).toBe(true);
  expect(simple.nodes.some(node => node.data.sourceId === 'live-text')).toBe(true);
  expect(simple.nodes.some(node => node.data.sourceId === 'standalone')).toBe(true);
  expect(simple.edges.some(edge => edge.data?.path === 'live-text.content.expression')).toBe(true);
  expect(full.nodes.some(node => node.data.sourceId === 'title-text')).toBe(true);
  expect(canonicalUiDocument(source).contentDigest).toBe(before);
});

it('keeps source facts intact while presenting concise meaningful names without duplicate literal summaries', () => {
  const source = fixture(); const graph = projectStructure(source);
  const title = graph.nodes.find(node => node.data.sourceId === 'title')!;
  const label = structureNodePresentation(source, title.data);
  expect(label).toMatchObject({ label: 'Customer settings', kindLabel: 'Heading', sourceId: 'title', occurrence: title.data.occurrence });
  expect(label.summary).toBeUndefined();
  const text = graph.nodes.find(node => node.data.sourceId === 'standalone')!;
  expect(structureNodePresentation(source, text.data).summary).toBeUndefined();
  expect(source.nodes['title-text']).toMatchObject({ content: { value: 'Customer settings' } });
});
