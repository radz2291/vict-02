import { expect, it } from 'vitest';
import { canonicalUiDocument, type UiDocument } from '@victframework/ui';
import nestedSource from './fixtures/scoped-graph-source.json';
import { screenIssues, screenApplication } from '../src/lib/designer/application.js';
import { prepareSourceImport } from '../src/lib/designer/source-import.js';

it('imports a canonical-valid nested graph beyond64 ordinary wrappers without inventing dynamic media dependencies', async () => {
  const base = JSON.parse(JSON.stringify(nestedSource)) as UiDocument,
    nodes = { ...base.nodes };
  for (let index = 0; index < 66; index++)
    nodes[`deep-${index}`] = {
      kind: 'element',
      id: `deep-${index}`,
      tag: 'div',
      children: [index === 65 ? base.root : `deep-${index + 1}`],
    };
  const source: UiDocument = { ...base, root: 'deep-0', nodes },
    before = canonicalUiDocument(source).contentDigest;
  expect(screenIssues(source)).toEqual([]);
  const imported = await prepareSourceImport(
    JSON.stringify({ application: screenApplication(source), uiDocuments: [{ document: source }] }),
  );
  expect(imported.ok, JSON.stringify(imported)).toBe(true);
  if (!imported.ok) return;
  expect(imported.assets).toEqual([]);
  expect(imported.document).toEqual(source);
  expect(canonicalUiDocument(imported.document).contentDigest).toBe(before);
  expect(canonicalUiDocument(source).contentDigest).toBe(before);
});
