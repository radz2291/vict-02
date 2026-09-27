/**
 * Authoring-tools slice — the PACKAGED bin flow for `vict check`.
 *
 * Proves the shipped entry point (`bin/vict.mjs` + built `dist/`) loads a
 * TypeScript definition through Node's built-in type stripping (re-exec on
 * Node 22.x) and reports a valid/invalid verdict with the documented exit
 * codes. This is the exact flow an external consumer exercises.
 *
 * Requires a prior `npm run build` (the root gate always builds first).
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// This file lives at packages/cli/test/bin.test.ts; the bin is ../bin/vict.mjs.
const cliRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bin = join(cliRoot, 'bin', 'vict.mjs');

describe('vict bin check (packaged flow)', () => {
  it.skipIf(!existsSync(join(cliRoot, 'dist', 'cli.js')))(
    'checks a TypeScript definition end-to-end via the bin re-exec',
    () => {
      const fixture = join(cliRoot, 'test', 'fixtures', 'check', 'valid.ts');
      const stdout = execFileSync(process.execPath, [bin, 'check', fixture, '--json'], {
        encoding: 'utf8',
      });
      const payload = JSON.parse(stdout);
      expect(payload.ok).toBe(true);
      expect(payload.applicationVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    },
  );

  it.skipIf(!existsSync(join(cliRoot, 'dist', 'cli.js')))(
    'reports invalid definitions with exit code 4 through the bin',
    () => {
      const fixture = join(cliRoot, 'test', 'fixtures', 'check', 'broken.ts');
      let failed: { status: number; stderr: string; stdout: string } | undefined;
      try {
        execFileSync(process.execPath, [bin, 'check', fixture, '--json'], { encoding: 'utf8' });
      } catch (error) {
        failed = error as { status: number; stderr: string; stdout: string };
      }
      if (!failed) throw new Error('expected the bin to exit non-zero on the broken fixture');
      expect(failed.status).toBe(4);
      const payload = JSON.parse(failed.stdout) as { ok: boolean; issueCount: number };
      expect(payload.ok).toBe(false);
      expect(payload.issueCount).toBeGreaterThan(0);
    },
  );
});
