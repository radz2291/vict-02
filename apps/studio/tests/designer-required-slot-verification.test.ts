import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { UiDocument } from '@victframework/ui';
import { screenIssues } from '../src/lib/designer/application.js';
import { screenStore } from '../src/lib/designer/storage.js';

const invalid = () =>
  JSON.parse(
    readFileSync(
      new URL(
        '../../../docs/studio/verification-2026-10-22/required-slot-saved-source.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as UiDocument;

// Independent acceptance oracle: the implementation handoff explicitly says
// an empty required slot blocks Save/Run until refilled. These are RED at 67a47c3.
it('reports an unfilled catalog Dialog body at the canonical source boundary', () => {
  const issues = screenIssues(invalid());
  expect(issues.length).toBeGreaterThan(0);
});

it('refuses to persist a screen whose required catalog slot is empty', () => {
  const document = invalid();
  const bytes = new Map<string, string>();
  const store = screenStore(
    {
      getItem: (key) => bytes.get(key) ?? null,
      setItem: (key, value) => {
        bytes.set(key, value);
      },
    },
    document.id,
  );
  const result = store.save({
    document,
    expectedStoredRevision: 'r1',
    newStoredRevision: document.revision,
  });
  expect(result.ok).toBe(false);
  expect(bytes.size).toBe(0);
});
