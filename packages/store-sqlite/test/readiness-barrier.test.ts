import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnUntilReady } from './helpers/readiness-child.js';
import { READY_SENTINEL_PREFIX, isReadyLine } from './fixtures/readiness.js';

/**
 * Permanent harness-level proof that the Stage 03 crash fixtures decide the
 * kill by READINESS, not by elapsed time (final snapshot-correction pass,
 * closing the captured LOW-05-B occurrence).
 *
 * The baseline coordination killed the child when a FIXED 3000 ms deadline
 * elapsed — under load the child could still be booting and the kill landed
 * before the durable checkpoint existed. These tests demonstrate, with real
 * child processes and SHORT SYNTHETIC timings (no long sleeps), that:
 *
 * 1. a delayed child is NOT killed merely because wall-clock windows elapse
 *    before readiness — it is killed only after the exact sentinel;
 * 2. the parent can never kill before readiness: readiness resolves only
 *    after the child's durable checkpoint, and the kill call is causally
 *    after `await ready`;
 * 3. a missing readiness signal fails with a clear, bounded fixture error
 *    (the timeout is a failure guard, never coordination);
 * 4. malformed readiness signals (lookalike prefixes, wrong stage, extra
 *    whitespace) never substitute for readiness and never trigger a kill;
 * 5. the sentinel matcher is exact.
 *
 * All probe children are synthetic `node -e` processes; no production
 * runtime source is involved.
 */

/** Probe: durable checkpoint at 120 ms, still alive at 250 ms, exact
 * readiness sentinel at 380 ms, then hang forever until killed. */
const DELAYED_CHECKPOINT_PROBE = `
const fs = require('node:fs');
const marker = process.argv[1];
setTimeout(() => { fs.writeFileSync(marker + '.checkpoint', 'written'); }, 120);
setTimeout(() => { fs.writeFileSync(marker + '.alive250', 'alive'); }, 250);
setTimeout(() => { fs.writeSync(1, ${JSON.stringify(READY_SENTINEL_PREFIX)} + ' probe\\n'); }, 380);
setInterval(() => {}, 1000);
`;

/** Probe: never emits the sentinel and never exits (readiness never reached). */
const NEVER_READY_PROBE = `
setInterval(() => {}, 1000);
`;

/** Probe: emits four malformed readiness lookalikes, then exits 0 cleanly
 * without ever emitting the exact sentinel. */
const MALFORMED_READY_PROBE = `
const p = ${JSON.stringify(READY_SENTINEL_PREFIX)};
setTimeout(() => { require('node:fs').writeSync(1, p + ' wrong-stage\\n'); }, 60);
setTimeout(() => { require('node:fs').writeSync(1, p + '-probe\\n'); }, 110);
setTimeout(() => { require('node:fs').writeSync(1, p.toUpperCase() + ' probe\\n'); }, 160);
setTimeout(() => { require('node:fs').writeSync(1, p + '  probe\\n'); }, 210);
setTimeout(() => { process.exit(0); }, 300);
`;

describe('readiness barrier: the kill decision is readiness-based, never elapsed-time', () => {
  it('an intentionally delayed child is not killed by elapsed wall-clock; the kill follows readiness', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-ready-barrier-'));
    try {
      const marker = join(dir, 'probe');
      const child = spawnUntilReady(
        ['-e', DELAYED_CHECKPOINT_PROBE, marker],
        'probe',
        // Generous failure guard only — far beyond the synthetic delays.
        { timeoutMs: 30_000 },
      );
      await child.ready;
      // The child lived through 120 ms and 250 ms synthetic boot windows and
      // emitted readiness at 380 ms: no elapsed-time kill fired meanwhile
      // (the baseline coordination would have killed it mid-boot).
      expect(existsSync(`${marker}.checkpoint`)).toBe(true);
      expect(existsSync(`${marker}.alive250`)).toBe(true);
      // Readiness is causally after the durable checkpoint: the sentinel was
      // only observed after the checkpoint file existed on disk.
      expect(readFileSync(`${marker}.checkpoint`, 'utf8')).toBe('written');
      // The kill happens strictly after readiness.
      child.child.kill('SIGKILL');
      const killed = await child.result;
      expect(killed.signal).toBe('SIGKILL');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('a missing readiness signal fails with a clear bounded fixture error (failure guard)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-ready-missing-'));
    try {
      const child = spawnUntilReady(['-e', NEVER_READY_PROBE], 'never-ready', {
        timeoutMs: 700,
      });
      await expect(child.ready).rejects.toThrow(
        /readiness for 'never-ready' was NOT observed within 700 ms.*bounded failure guard/s,
      );
      // The guard itself performed the kill.
      const result = await child.result;
      expect(result.signal).toBe('SIGKILL');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('a malformed readiness signal never triggers the kill', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-ready-malformed-'));
    try {
      const child = spawnUntilReady(['-e', MALFORMED_READY_PROBE], 'probe', {
        timeoutMs: 30_000,
      });
      // The probe exits 0 on its own; readiness was never (validly) observed.
      await expect(child.ready).rejects.toThrow(
        /exited before emitting the exact readiness sentinel/,
      );
      const result = await child.result;
      // The parent did NOT kill it: clean exit, no signal.
      expect(result.status).toBe(0);
      expect(result.signal).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('the sentinel matcher is exact: prefix, stage, case, and whitespace all matter', () => {
    expect(isReadyLine(`${READY_SENTINEL_PREFIX} probe`, 'probe')).toBe(true);
    expect(isReadyLine(`${READY_SENTINEL_PREFIX} probe`, 'other')).toBe(false);
    expect(isReadyLine(`${READY_SENTINEL_PREFIX} probe extra`, 'probe')).toBe(false);
    expect(isReadyLine(`${READY_SENTINEL_PREFIX}  probe`, 'probe')).toBe(false);
    expect(isReadyLine(`${READY_SENTINEL_PREFIX}-probe`, 'probe')).toBe(false);
    expect(isReadyLine(`${READY_SENTINEL_PREFIX.toUpperCase()} probe`, 'probe')).toBe(false);
    expect(isReadyLine(READY_SENTINEL_PREFIX, 'probe')).toBe(false);
    expect(isReadyLine(`  ${READY_SENTINEL_PREFIX} probe`, 'probe')).toBe(false);
  });
});
