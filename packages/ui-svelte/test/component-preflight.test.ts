import { expect, it } from 'vitest';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
} from '@victframework/ui';
import { validateSvelteComponentPlan } from '../src/document/extensions.js';
import { catalogDescriptors, catalogImplementations } from '../src/catalog/components/catalog.js';

function document(): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'preflight',
    revision: 'r1',
    root: 'root',
    nodes: {
      root: { kind: 'element', id: 'root', tag: 'main', children: ['outer'] },
      outer: {
        kind: 'component',
        id: 'outer',
        definitionId: 'vict.catalog.dialog',
        props: { open: { type: 'literal', value: false } },
        slots: { body: { name: 'body', children: ['branches'] } },
      },
      branches: { kind: 'conditional', id: 'branches', branches: [{ children: ['inner'] }] },
      inner: {
        kind: 'component',
        id: 'inner',
        definitionId: 'vict.catalog.dialog',
        slots: { body: { name: 'body', children: [] } },
      },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {},
  };
}
it('finds a required slot inside a closed dialog and conditional branch without evaluating runtime state', () => {
  const compiled = compileUiDocument(
    document(),
    defaultSemanticElementCatalog(),
    catalogDescriptors,
  );
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) return;
  const issues = validateSvelteComponentPlan(
    compiled.plan,
    catalogDescriptors,
    catalogImplementations,
  );
  expect(issues).toEqual([
    expect.objectContaining({
      code: 'UI_COMPONENT_SLOT_REQUIRED',
      detail: expect.objectContaining({ nodeId: 'inner', occurrenceKey: expect.any(String) }),
    }),
  ]);
});
it('uses the same registration resolver, so missing renderer registrations cannot pass preflight', () => {
  const compiled = compileUiDocument(
    document(),
    defaultSemanticElementCatalog(),
    catalogDescriptors,
  );
  if (!compiled.ok) throw new Error('Invalid test source');
  const issues = validateSvelteComponentPlan(compiled.plan, catalogDescriptors, []);
  expect(issues.map((issue) => issue.code)).toEqual([
    'UI_COMPONENT_UNAVAILABLE',
    'UI_COMPONENT_UNAVAILABLE',
  ]);
});
