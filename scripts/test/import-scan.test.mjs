import { describe, expect, it } from 'vitest';
import {
  findForbiddenSpecifierSegments,
  importSpecifiers,
  specifierPathSegments,
  stripComments,
} from '../lib/import-scan.mjs';

/**
 * Permanent regression coverage for the forbidden-path matching semantics
 * of the verifier path gates (Phase F4 repair of F3 finding MD-2: the raw
 * `ee/` substring scan in scripts/verify-stage6a.mjs false-positived on
 * ordinary words such as `free/` or `thenable-free/` in a comment).
 *
 * A forbidden path must be matched as an actual path segment of a REAL
 * module reference; comments and unrelated words can never fail, while
 * real forbidden imports still must.
 */

describe('stripComments', () => {
  it('removes block comments and whole-line // comments', () => {
    const source = [
      'const a = 1;',
      '/* block comment with ee/ inside */',
      'const b = 2;',
      '// line comment with ee/ inside',
      'const c = 3;',
    ].join('\n');
    const stripped = stripComments(source);
    expect(stripped).not.toContain('ee/');
    expect(stripped).toContain('const a = 1;');
    expect(stripped).toContain('const c = 3;');
  });
});

describe('importSpecifiers extracts real module references', () => {
  it('extracts static import, export-from, side-effect, dynamic import(), and require() specifiers', () => {
    const source = [
      `import { tool } from '@mastra/core/tools';`,
      `export { helper } from './helper-tools.js';`,
      `import '@mastra/core/ee';`,
      `const m = await import('@mastra/core/ee');`,
      `const r = require('@mastra/core/ee');`,
    ].join('\n');
    const specifiers = importSpecifiers(stripComments(source)).map((entry) => entry.specifier);
    expect(specifiers).toEqual([
      '@mastra/core/tools',
      './helper-tools.js',
      '@mastra/core/ee',
      '@mastra/core/ee',
      '@mastra/core/ee',
    ]);
  });
});

describe('specifierPathSegments governs subpath segments only', () => {
  it('returns subpath segments after the package root for scoped packages', () => {
    expect(specifierPathSegments('@mastra/core/ee')).toEqual(['ee']);
    expect(specifierPathSegments('@mastra/core/ee/wrapped')).toEqual(['ee', 'wrapped']);
    expect(specifierPathSegments('@mastra/core')).toEqual([]);
  });

  it('returns every segment for relative specifiers', () => {
    expect(specifierPathSegments('./free/x')).toEqual(['.', 'free', 'x']);
    expect(specifierPathSegments('../ee/y')).toEqual(['..', 'ee', 'y']);
    expect(specifierPathSegments('./ee')).toEqual(['.', 'ee']);
  });

  it('returns subpath segments after the root package for unscoped bare specifiers', () => {
    expect(specifierPathSegments('zod')).toEqual([]);
    expect(specifierPathSegments('zod/v4')).toEqual(['v4']);
  });
});

describe('findForbiddenSpecifierSegments — comments and unrelated words never fail', () => {
  it('does not flag the historically false-positiving comment', () => {
    // The exact Stage 06 source line (packages/mastra/src/helper-tools.ts)
    // that the raw 'ee/' substring scan mistook for a forbidden path.
    const source = `const rebuilt = rebuild(input); // trap-free/thenable-free rebuild; a spill chutes errors\nexport const x = 1;`;
    expect(findForbiddenSpecifierSegments(source, ['ee'])).toEqual([]);
  });

  it('does not flag ordinary words containing the characters ee/ in code or strings', () => {
    const source = [
      `import { rebuild } from './free/rebuild.js';`,
      `const label = 'thenable-free/adapter';`,
      `const words = 'free/ thenable-free/ three/employee-free/';`,
      `import zod from 'zod';`,
    ].join('\n');
    expect(findForbiddenSpecifierSegments(source, ['ee'])).toEqual([]);
  });

  it('does not flag a comment that quotes a forbidden import verbatim', () => {
    const source = [
      `import { tool } from '@mastra/core/tools';`,
      `// NOTE: importing { x } from '@mastra/core/ee' is forbidden here.`,
      `/* from '@mastra/core/ee' — documentation example only */`,
      `export const y = 2;`,
    ].join('\n');
    expect(findForbiddenSpecifierSegments(source, ['ee'])).toEqual([]);
  });

  it('does not flag a segment that merely ends with the forbidden characters', () => {
    const source = `import { x } from './libree/asset.js';`;
    expect(findForbiddenSpecifierSegments(source, ['ee'])).toEqual([]);
  });
});

describe('findForbiddenSpecifierSegments — real forbidden references still fail', () => {
  const cases = [
    ['static import', `import { ee } from '@mastra/core/ee';`],
    ['deep subpath import', `import { wrapped } from '@mastra/core/ee/wrapped';`],
    ['side-effect import', `import '@mastra/core/ee';`],
    ['dynamic import()', `const m = await import('@mastra/core/ee');`],
    ['require()', `const m = require('@mastra/core/ee');`],
    ['export-from', `export { eeTool } from '@mastra/core/ee';`],
    ['relative ee/ path', `import { x } from './ee/index.js';`],
    ['parent ee path', `import { x } from '../ee';`],
  ];

  for (const [label, source] of cases) {
    it(`flags a real forbidden reference: ${label}`, () => {
      const findings = findForbiddenSpecifierSegments(source, ['ee']);
      expect(findings.length).toBe(1);
      expect(findings[0]?.segment).toBe('ee');
      expect(findings[0]?.specifier).toContain('ee');
    });
  }

  it('reports each offending reference once, with its specifier, for stable diagnostics', () => {
    const source = [
      `import { a } from '@mastra/core/ee';`,
      `import { b } from './ee/tools.js';`,
      `import { ok } from '@mastra/core/tools';`,
    ].join('\n');
    const findings = findForbiddenSpecifierSegments(source, ['ee']);
    expect(findings).toEqual([
      { specifier: '@mastra/core/ee', segment: 'ee' },
      { specifier: './ee/tools.js', segment: 'ee' },
    ]);
  });
});
