import { expect, it } from 'vitest';
import { createLocalStorageDocumentStore, type UiDocument } from '../src/index.js';
const source: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'storage-gate',
  revision: 'r1',
  root: 'root',
  nodes: { root: { kind: 'element', id: 'root', tag: 'p', children: [] } },
  componentDefinitions: {},
  styleSources: {},
  tokens: {},
  conditions: {},
  assets: {},
  localState: {},
};
it('uses the host validator before writes and preserves the last saved bytes and revision on refusal', () => {
  const bytes = new Map<string, string>();
  let reject = false;
  const store = createLocalStorageDocumentStore(
    {
      getItem: (key) => bytes.get(key) ?? null,
      setItem: (key, value) => {
        bytes.set(key, value);
      },
    },
    {
      key: 'source',
      format: 'test@1',
      seedStoredRevision: 'r1',
      validateDocument: () =>
        reject ? [{ code: 'REQUIRED', severity: 'error', message: 'Fill the required slot.' }] : [],
    },
  );
  const save = (expected: string, next: string) =>
    store.save({ document: source, expectedStoredRevision: expected, newStoredRevision: next });
  expect(save('r1', 'r2').ok).toBe(true);
  const before = bytes.get('source');
  reject = true;
  expect(save('r2', 'r3')).toMatchObject({
    ok: false,
    code: 'UI_EDIT_VALIDATION_FAILED',
    reason: expect.stringContaining('REQUIRED'),
  });
  expect(bytes.get('source')).toBe(before);
  reject = false;
  expect(save('r2', 'r3').ok).toBe(true);
});
it('refuses writes when a composed validator throws, without leaking its exception or touching bytes', () => {
  let writes = 0;
  const store = createLocalStorageDocumentStore(
    {
      getItem: () => null,
      setItem: () => {
        writes++;
      },
    },
    {
      key: 'source',
      format: 'test@1',
      seedStoredRevision: 'r1',
      validateDocument: () => {
        throw new Error('private detail');
      },
    },
  );
  expect(
    store.save({ document: source, expectedStoredRevision: 'r1', newStoredRevision: 'r2' }),
  ).toEqual({
    ok: false,
    code: 'UI_EDIT_VALIDATION_FAILED',
    reason: 'Document validation failed.',
  });
  expect(writes).toBe(0);
});
