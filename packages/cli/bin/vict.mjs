#!/usr/bin/env node
/** Stage 06B — `vict` CLI binary. Delegates to the testable core. */
import { runVictCli } from '../dist/cli.js';

const exit = await runVictCli(process.argv.slice(2), {
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
});
process.exitCode = exit;
