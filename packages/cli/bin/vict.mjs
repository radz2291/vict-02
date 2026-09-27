#!/usr/bin/env node
/**
 * Stage 06B — `vict` CLI binary. Delegates to the testable core.
 *
 * TypeScript loading for `vict check`: when the running Node cannot strip
 * types (Node 22.x needs --experimental-strip-types) and the invocation is
 * a check over a TypeScript file, re-exec once with the flag. Erasable TS
 * only; the inner process skips this branch (type stripping is enabled).
 */
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const features = process.features;
const typeStrippingEnabled = Boolean(features.typescript);
const looksLikeTsCheck =
  argv[0] === 'check' && argv.slice(1).some((arg) => /\.(ts|mts|cts)$/i.test(arg));

if (looksLikeTsCheck && !typeStrippingEnabled) {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', process.argv[1], ...argv],
    { stdio: 'inherit', windowsHide: true },
  );
  process.exitCode = result.status ?? 1;
} else {
  const { runVictCli } = await import('../dist/cli.js');
  const exit = await runVictCli(argv, {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  });
  process.exitCode = exit;
}
