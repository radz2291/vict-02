#!/usr/bin/env node
/**
 * verify:builder-kit — the Builder Kit freshness/identity/completeness gate
 * (Stage 08, architecture §3.9/§4.3; handoff WP-4).
 *
 * Thin wrapper: the gate logic lives in @victframework/builder-kit
 * (src/verify) and runs from source through tsx, exactly like the other
 * repository tooling (`example`, `bench`). Regenerates and compares both
 * pack layers, recomputes identities with the §3.3 exclusions, recomputes
 * the capability catalog from typed declarations (fail-closed,
 * credential-free isolated child process), validates schemas, plants
 * canary credentials and proves absence, and — when a task pack is
 * present — compares the working tree against the pinned baseline
 * (committed, renamed, untracked; ignore-manifest-filtered).
 *
 * Exits non-zero with stable per-class reasons on any failure. Part of the
 * Stage 8 ladder; no existing gate is weakened, reordered, or bypassed.
 *
 * Usage: node scripts/verify-builder-kit.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const cliPath = resolve(repoRoot, 'packages', 'builder-kit', 'src', 'cli.ts');

if (!existsSync(cliPath)) {
  console.error('verify:builder-kit: kit CLI not found (packages/builder-kit/src/cli.ts missing)');
  process.exit(1);
}

// The tsx loader URL is resolved absolutely (cwd-independent).
const tsxImportUrl = import.meta.resolve('tsx');
const result = spawnSync(
  process.execPath,
  ['--import', tsxImportUrl, cliPath, 'verify', '--repo-root', repoRoot],
  {
    cwd: repoRoot,
    stdio: 'inherit',
  },
);
if (result.error !== undefined) {
  console.error(`verify:builder-kit: failed to start the gate: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
