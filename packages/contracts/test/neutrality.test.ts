import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The base contracts API must be schema-library neutral: no source file in
 * the base surface may import zod. (The optional `src/zod/` adapter subpath
 * is the only place zod may appear; emitted-declaration checks run in the
 * isolated consumer verification, after the build.)
 */
describe('base contracts package neutrality', () => {
  it('contains no zod imports outside the optional zod adapter subpath', () => {
    const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
    const baseFiles = [
      'index.ts',
      'types.ts',
      'define-contract.ts',
      'error.ts',
      'errors.ts',
      'issue-mapping.ts',
    ];
    for (const file of baseFiles) {
      const content = readFileSync(join(srcDir, file), 'utf8');
      expect(content.match(/from\s+['"]zod/g), `${file} must not import zod`).toBeNull();
      expect(
        content.match(/from\s+['"][^'"]*\/zod['"]/g),
        `${file} must not import the zod adapter`,
      ).toBeNull();
    }
    // The adapter subpath exists separately and is the only sanctioned zod consumer.
    const adapter = readFileSync(join(srcDir, 'zod', 'define-zod-contract.ts'), 'utf8');
    expect(adapter).toMatch(/from 'zod'/);
  });
});
