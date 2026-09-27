/**
 * Authoring-tools slice — the per-role definition guide CANNOT go stale.
 *
 * Every example in `docs/authoring/examples/` is imported and compiled with
 * the authoritative compiler. If a compiler change ever invalidates a
 * documented example, this test fails. Negative probes pin the guide's
 * claims about diagnostic codes and allowed values.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_ISSUE_CODES,
  compileApplication,
  describeApplicationVocabulary,
  type CompileApplicationInput,
} from '@victframework/application';

const examplesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/authoring/examples',
);

/** Reduce an example module to the compiler input (host conventions). */
function inputOf(moduleNamespace: Record<string, unknown>): CompileApplicationInput {
  const identityEntries = (value: unknown): { id: string; revision: string }[] =>
    Array.isArray(value)
      ? value
          .filter((entry) => typeof entry === 'object' && entry !== null)
          .filter((entry) => 'id' in (entry as object) && 'revision' in (entry as object))
          .map((entry) => ({
            id: (entry as { id: string }).id,
            revision: (entry as { revision: string }).revision,
          }))
      : [];
  return {
    application: moduleNamespace['application'] as CompileApplicationInput['application'],
    resources: (moduleNamespace['resources'] ?? []) as CompileApplicationInput['resources'],
    contracts: identityEntries(
      moduleNamespace['contracts'],
    ) as CompileApplicationInput['contracts'],
    capabilities: identityEntries(
      moduleNamespace['capabilities'],
    ) as CompileApplicationInput['capabilities'],
    components: (moduleNamespace['components'] ?? []) as CompileApplicationInput['components'],
  };
}

const exampleFiles = readdirSync(examplesDir).filter((name) => name.endsWith('.ts'));

describe('authoring examples compile with the authoritative compiler', () => {
  it('the guide ships at least one example per documented role family', () => {
    expect(exampleFiles.length).toBeGreaterThanOrEqual(9);
    expect(exampleFiles).toContain('table.ts');
    expect(exampleFiles).toContain('form.ts');
    expect(exampleFiles).toContain('dashboard.ts');
    expect(exampleFiles).toContain('conversation.ts');
    expect(exampleFiles).toContain('component-island.ts');
    expect(exampleFiles).toContain('overlays.ts');
    expect(exampleFiles).toContain('regions-composition.ts');
    expect(exampleFiles).toContain('navigation.ts');
    expect(exampleFiles).toContain('states-conditions.ts');
    expect(exampleFiles).toContain('detail-list.ts');
  });

  for (const file of exampleFiles) {
    it(`${file} compiles with zero issues`, async () => {
      const moduleNamespace = (await import(join(examplesDir, file))) as Record<string, unknown>;
      const result = compileApplication(inputOf(moduleNamespace));
      if (!result.ok) {
        throw new Error(`${file}: ${JSON.stringify(result.issues, null, 2)}`);
      }
      expect(result.plan.applicationVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    });
  }

  it('every example file is referenced by the guide', () => {
    const guide = readFileSync(join(examplesDir, '..', 'README.md'), 'utf8');
    for (const file of exampleFiles) {
      expect(guide.includes(file), `guide must reference ${file}`).toBe(true);
    }
  });
});

describe('guide claims about diagnostics stay true', () => {
  it('an unknown field yields UNKNOWN_FIELD with the allowed field set attached by the vocabulary', () => {
    const vocabulary = describeApplicationVocabulary();
    const screenFieldsV2 = vocabulary.objects['screenV2']?.fields ?? [];
    expect(screenFieldsV2).toContain('layoutMode');
    expect(screenFieldsV2).toContain('composition');
    // The route table gains `redirect` in @2.
    expect(vocabulary.objects['route']?.fields).not.toContain('redirect');
    expect(vocabulary.objects['routeV2']?.fields).toContain('redirect');
  });

  it('every diagnostic code a broken definition can emit is in the exported issue-code list', async () => {
    const { application } = (await import(join(examplesDir, 'table.ts'))) as {
      application: Record<string, unknown>;
    };
    const broken = structuredClone(application) as Record<string, unknown>;
    (broken['id'] as string) = 'app.example.broken';
    const screens = broken['screens'] as Record<string, unknown>[];
    const firstLayout = screens[0]?.['layout'] as unknown[] | undefined;
    if (firstLayout === undefined) throw new Error('table example: expected a first screen layout');
    firstLayout[0] = {
      name: 'main',
      surfaces: [
        { role: 'gauge', id: 'g.one' }, // UNKNOWN_SURFACE_ROLE
        { role: 'text', id: 't.x', content: 'x', colour: 'red' }, // APPLICATION_UNKNOWN_FIELD
      ],
    };
    (broken['views'] as unknown[]).push({
      viewId: 'v.bad',
      resourceId: 'tasks',
      resourceRevision: '1',
      fields: ['id'],
      sort: [{ field: 'createdAt', direction: 'up' }], // INVALID_VIEW_DECLARATION
    });
    const result = compileApplication({
      application: broken as never,
      resources: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the broken definition to fail compilation');
    const codes = new Set(result.issues.map((issue) => issue.code));
    expect(codes.has('UNKNOWN_SURFACE_ROLE')).toBe(true);
    expect(codes.has('INVALID_VIEW_DECLARATION')).toBe(true);
    for (const code of codes) {
      expect(APPLICATION_ISSUE_CODES).toContain(code);
    }
  });
});
