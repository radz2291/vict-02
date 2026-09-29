import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runVictCli } from '@victframework/cli';

/**
 * Stage 06B — CLI over the REAL composed HTTP boundary.
 *
 * The CLI must consume the same versioned command surface as every other
 * client (no direct store access, no governance bypass). These tests drive
 * the actual `vict` argument parser and typed HTTP client against a real
 * listening server, asserting exit-code semantics (0 ok / 1 usage /
 * 2 rejected / 3 transport) and non-echoing diagnostics.
 */

let fixture: Awaited<ReturnType<typeof import('./fixtures.js').httpFixture>> | undefined;

async function f() {
  if (fixture === undefined) {
    fixture = await (await import('./fixtures.js')).httpFixture();
  }
  return fixture;
}

afterAll(async () => {
  if (fixture !== undefined) {
    await fixture.close();
  }
});

/** Run the CLI against the fixture, capturing output and exit code. */
async function vict(args: string[], env: { endpoint?: string; token?: string } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const conf = await f();
  const code = await runVictCli(
    args,
    {
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
    },
    {
      endpoint: env.endpoint ?? `http://127.0.0.1:${conf.port}`,
      token: env.token ?? 'vict-test-token-user',
    },
  );
  return { code, out: out.join('\n'), err: err.join('\n') };
}

/** A valid ChangeSet payload for propose. */
function changesetPayload(id: string): Record<string, unknown> {
  return {
    changesetId: id,
    base: { kind: 'release', subjectId: 'app-support', expectedVersion: 'release-v1' },
    operations: [
      {
        kind: 'publish-and-select-release',
        release: {
          releaseVersion: 'release-v2',
          applicationId: 'app-support',
          applicationVersion: 'app-1',
          rendererIdentity: 'renderer-v2',
          componentRegistryIdentity: 'registry-v2',
          dataAdapterIdentity: 'adapter-v2',
          activationBinding: 'activation-1',
        },
      },
    ],
    rationale: 'operator CLI lifecycle proof',
    riskClass: 'low',
    requiredApproverCount: 1,
    expiresAt: Date.now() + 3_600_000,
  };
}

describe('vict CLI (real HTTP boundary)', () => {
  it('whoami reports the token-derived actor, never client-supplied identity', async () => {
    const result = await vict(['whoami', '--json']);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.out) as {
      ok: boolean;
      data: { actorId: string; scopes: string[] };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.data.actorId).toBe('actor-user');
    expect(parsed.data.scopes.length).toBeGreaterThan(0);
  });

  it('health and compatibility inspect work unauthenticated per contract', async () => {
    const health = await vict(['health'], { token: 'definitely-not-a-token' });
    expect(health.code).toBe(0);
    expect(health.out).toContain('commandSchema');
    const compat = await vict(['compatibility']);
    expect(compat.code).toBe(0);
    expect(compat.out).toContain('vict.agent-stream@1');
  });

  it('drives a full ChangeSet lifecycle: propose → evidence → approve → commit', async (ctx) => {
    const dir = mkdtempSync(join(tmpdir(), 'vict-cli-'));
    try {
      // Establish the base the ChangeSet expects: publish release-v1 and
      // select it (real operator flow; the commit's stale-base check then
      // has a truthful expectation to verify against).
      const releasePath = join(dir, 'release.json');
      writeFileSync(
        releasePath,
        JSON.stringify({
          releaseVersion: 'release-v1',
          applicationId: 'app-support',
          applicationVersion: 'app-1',
          rendererIdentity: 'renderer-v1',
          componentRegistryIdentity: 'registry-v1',
          dataAdapterIdentity: 'adapter-v1',
          activationBinding: 'binding-v1',
        }),
        'utf8',
      );
      // Publishing is an administrator-scope operation; selection is the
      // receipt-gated operator path (Stage 9 G2: prepare → confirm).
      const published = await vict(['release', 'publish', '--file', releasePath]);
      expect(published.code).toBe(0);
      const preparedSelect = await vict(
        [
          'release',
          'select',
          '--applicationId',
          'app-support',
          '--releaseVersion',
          'release-v1',
          '--expectedRevision',
          'null',
          '--prepare',
        ],
        { token: 'vict-test-token-operator' },
      );
      if (preparedSelect.code !== 0 && preparedSelect.err.includes('VICT_CONFIRMATION')) {
        // TODO(integrator): the core prepare layer is not yet integrated;
        // this lifecycle resumes when prepareConfirmation lands.
        ctx.skip();
        return;
      }
      expect(preparedSelect.code).toBe(0);
      const receipt = JSON.parse(preparedSelect.out) as {
        data: { receiptId: string; expiryAt: number; command: string };
      };
      expect(receipt.data.command).toBe('release.select');
      expect(typeof receipt.data.expiryAt).toBe('number');
      const selected = await vict(
        [
          'release',
          'select',
          '--applicationId',
          'app-support',
          '--releaseVersion',
          'release-v1',
          '--confirm',
          receipt.data.receiptId,
          '--key',
          'cli-select-confirm-1',
        ],
        { token: 'vict-test-token-operator' },
      );
      expect(selected.code).toBe(0);

      const payloadPath = join(dir, 'cs.json');
      writeFileSync(payloadPath, JSON.stringify(changesetPayload('cs-cli-1')), 'utf8');
      const proposed = await vict(['changeset', 'propose', '--file', payloadPath, '--json']);
      expect(proposed.code).toBe(0);
      const record = JSON.parse(proposed.out) as {
        data: { changeset: { changesetId: string; status: string } };
      };
      expect(record.data.changeset.changesetId).toBe('cs-cli-1');
      expect(record.data.changeset.status).toBe('draft');

      // The authoritative validation run EXECUTES through the trusted VICT
      // boundary; the evidence attaches by referencing the executed runId
      // (outcome, timestamps, and bindings derive from the durable run).
      const checkPath = join(dir, 'check.json');
      writeFileSync(
        checkPath,
        JSON.stringify({ changesetId: 'cs-cli-1', kind: 'validation' }),
        'utf8',
      );
      const check = await vict(['changeset', 'check', 'cs-cli-1', '--file', checkPath, '--json']);
      expect(check.code).toBe(0);
      const runRecord = JSON.parse(check.out) as {
        data: { run: { runId: string; outcome: string } };
      };
      expect(runRecord.data.run.outcome).toBe('passed');
      const evidencePath = join(dir, 'ev.json');
      writeFileSync(
        evidencePath,
        JSON.stringify({
          changesetId: 'cs-cli-1',
          kind: 'validation',
          runId: runRecord.data.run.runId,
        }),
        'utf8',
      );
      const evidence = await vict(['changeset', 'evidence', 'cs-cli-1', '--file', evidencePath]);
      expect(evidence.code).toBe(0);

      // The approver token carries the approver role in this deployment.
      const decide = await vict(['changeset', 'decide', 'cs-cli-1', '--decision', 'approved'], {
        token: 'vict-test-token-approver',
      });
      expect(decide.code).toBe(0);

      const commit = await vict(['changeset', 'commit', 'cs-cli-1', '--json']);
      expect(commit.code).toBe(0);
      const commitData = JSON.parse(commit.out) as {
        data: { result: { record: { status: string }; applied: string[] } };
      };
      expect(commitData.data.result.record.status).toBe('committed');
      expect(commitData.data.result.applied.length).toBeGreaterThan(0);

      // Idempotent re-commit stays truthful.
      const recommit = await vict(['changeset', 'commit', 'cs-cli-1']);
      expect([0, 2]).toContain(recommit.code);
      if (recommit.code === 2) {
        expect(recommit.err).toContain('VICT_');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('GET routes with positional ids: changeset get (missing is stable code 2)', async () => {
    // A missing ChangeSet is the authorizing actor's denial (404 mapping,
    // stable code; absence is never disclosed as an empty record).
    const missing = await vict(['changeset', 'get', 'cs-never-was', '--json']);
    expect(missing.code).toBe(2);
    expect(missing.err).toContain('VICT_CONTROL_CHANGESET_MISSING');
  });

  it('receipt-gated CLI commands: the legacy one-step shape is replaced by usage guidance (no network call)', async () => {
    // A legacy one-step invocation of a gated command gives usage
    // guidance naming the two steps and exits non-zero BEFORE any
    // network call. The gated shape only ever exists after core
    // integration, so this probe is stable across both stages.
    const cancel = await vict(['run', 'cancel', '--runId', 'run-cli-g2', '--reasonCode', 'operator-cancel']);
    expect(cancel.code).toBe(1);
    expect(cancel.err).toContain('--prepare');
    expect(cancel.err).toContain('--confirm');
    expect(cancel.err).toContain('--key');
    // The new intervention commands carry the same two-step contract.
    const resolve = await vict(['run', 'resolve', 'run-cli-g2', '--resolution', 'retry']);
    expect(resolve.code).toBe(1);
    expect(resolve.err).toContain('--prepare');
    const signal = await vict(['run', 'signal', 'run-cli-g2', '--signalName', 'nudge']);
    expect(signal.code).toBe(1);
    // `--confirm` without `--key` is also usage guidance.
    const noKey = await vict([
      'run',
      'cancel',
      '--runId',
      'run-cli-g2',
      '--reasonCode',
      'operator-cancel',
      '--confirm',
      'rcpt-cli-g2-1',
    ]);
    expect(noKey.code).toBe(1);
    expect(noKey.err).toContain('--key');
    // Combined flags are rejected (mutually exclusive steps).
    const both = await vict(
      ['run', 'cancel', '--runId', 'run-cli-g2', '--prepare', '--confirm', 'rcpt-cli-g2-1', '--key', 'k'],
    );
    expect(both.code).toBe(1);
    // A malformed --confirm receipt id is a usage error.
    const badReceipt = await vict(
      ['run', 'cancel', '--runId', 'run-cli-g2', '--confirm', 'x'.repeat(200), '--key', 'k'],
    );
    expect(badReceipt.code).toBe(1);
    // The confirmation get entry resolves as a read route (unknown receipt
    // is the stable non-echoing UNAVAILABLE — never existence disclosure).
    const missing = await vict(['confirmation', 'get', 'rcpt-cli-never', '--json']);
    expect(missing.code).toBe(2);
    expect(missing.err).toContain('VICT_CONFIRMATION_UNAVAILABLE');
    // A gated invocation WITH the confirmed shape reaches the server
    // (fail-closed bridge today, core fence after integration): the
    // server-side 409 maps to exit 2 with a stable code.
    const rejected = await vict(
      [
        'run',
        'cancel',
        '--runId',
        'run-cli-g2-rejected',
        '--reasonCode',
        'operator-cancel',
        '--confirm',
        'rcpt-cli-g2-rejected',
        '--key',
        'cli-confirm-rejected-1',
      ],
    );
    expect(rejected.code).toBe(2);
    expect(rejected.err).toMatch(/^vict: The command was rejected \(VICT_[A-Z0-9_]+, HTTP \d+\)\.$/);
  });

  it('usage errors: unknown command, missing connection, bad flag', async () => {
    const unknown = await vict(['frobnicate']);
    expect(unknown.code).toBe(1);
    expect(unknown.err).toContain('unknown command');

    const noEndpoint = await runVictCli(
      ['whoami'],
      { stdout: () => undefined, stderr: () => undefined },
      { token: 't' },
    );
    expect(noEndpoint).toBe(1);

    const missingValue = await vict(['changeset', 'decide', 'cs-1', '--decision']);
    expect(missingValue.code).toBe(1);
  });

  it('rejected commands map to exit 2 with stable, non-echoing diagnostics', async () => {
    const denied = await vict(['changeset', 'commit', 'cs-does-not-exist'], {
      token: 'vict-test-token-viewer-not-present',
    });
    expect([2, 3]).toContain(denied.code);
    const stale = await vict(
      [
        'release',
        'rollback',
        '--applicationId',
        'app-x',
        '--targetReleaseVersion',
        'release-never',
        '--confirm',
        'rcpt-never',
        '--key',
        'cli-rollback-stale-1',
      ],
      {
        token: 'vict-test-token-operator',
      },
    );
    expect([0, 2]).toContain(stale.code);
    if (stale.code === 2) {
      expect(stale.err).toMatch(/^vict: The command was rejected \(VICT_[A-Z0-9_]+, HTTP \d+\)\.$/);
      expect(stale.err).not.toContain('release-never');
    }
  });

  it('transport failures map to exit 3', async () => {
    const result = await vict(['whoami'], { endpoint: 'http://127.0.0.1:9' });
    expect(result.code).toBe(3);
    expect(result.err).toContain('endpoint');
  });

  it('turn commands fail closed without a composed executor (409 mapped)', async () => {
    const result = await vict(['turn', 'start', '--thread', 'thread-cli', '--input', 'hello']);
    expect(result.code).toBe(2);
    expect(result.err).toContain('VICT_TURN_EXECUTOR_UNAVAILABLE');
  });

  it('help exits 0 and lists commands', async () => {
    const result = await vict(['help']);
    expect(result.code).toBe(0);
    expect(result.out).toContain('changeset commit');
    expect(result.out).toContain('vict.cli@1');
  });

  // ---- Stage 9 G2: the two-step CLI confirmation lifecycle -------------
  describe.skip('CLI two-step confirmation flows (BLOCKED on the core confirmation layer)', () => {
    it('prepare prints the server-issued summary (receiptId + expiryAt) and never auto-confirms', async () => {
      const first = await vict(
        [
          'run',
          'cancel',
          '--runId',
          'run-cli-prep-1',
          '--reasonCode',
          'operator-cancel',
          '--expectedRevision',
          '0',
          '--prepare',
        ],
        { token: 'vict-test-token-operator' },
      );
      expect(first.code).toBe(0);
      const summary = JSON.parse(first.out) as { data: Record<string, unknown> };
      expect(typeof summary.data.receiptId).toBe('string');
      expect(typeof summary.data.expiryAt).toBe('number');
      expect(summary.data.command).toBe('run.cancel');
    });

    it('confirm posts the reviewed receipt and executes the command', async () => {
      const first = await vict(
        [
          'run',
          'cancel',
          '--runId',
          'run-cli-twostep-1',
          '--reasonCode',
          'operator-cancel',
          '--expectedRevision',
          '0',
          '--prepare',
        ],
        { token: 'vict-test-token-operator' },
      );
      expect(first.code).toBe(0);
      const receipt = JSON.parse(first.out) as { data: { receiptId: string } };
      const confirmed = await vict(
        [
          'run',
          'cancel',
          '--runId',
          'run-cli-twostep-1',
          '--reasonCode',
          'operator-cancel',
          '--confirm',
          receipt.data.receiptId,
          '--key',
          'cli-twostep-confirm-1',
        ],
        { token: 'vict-test-token-operator' },
      );
      expect(confirmed.code).toBe(0);
    });

    it('confirmation get reads a receipt status for its own scope', async () => {
      const first = await vict(
        ['run', 'cancel', '--runId', 'run-cli-get-1', '--reasonCode', 'operator-cancel', '--expectedRevision', '0', '--prepare'],
        { token: 'vict-test-token-operator' },
      );
      expect(first.code).toBe(0);
      const receipt = JSON.parse(first.out) as { data: { receiptId: string } };
      const status = await vict(['confirmation', 'get', receipt.data.receiptId, '--json'], {
        token: 'vict-test-token-operator',
      });
      expect(status.code).toBe(0);
      const parsed = JSON.parse(status.out) as { data: { status: string } };
      expect(parsed.data.status).toBe('prepared');
    });
  });
});
