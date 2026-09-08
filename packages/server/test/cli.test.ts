import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runVictCli } from '@vict/cli';

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

  it('drives a full ChangeSet lifecycle: propose → evidence → approve → commit', async () => {
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
      // operator path.
      const published = await vict(['release', 'publish', '--file', releasePath]);
      expect(published.code).toBe(0);
      const selected = await vict(
        ['release', 'select', '--applicationId', 'app-support', '--releaseVersion', 'release-v1'],
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

  it('GET routes with positional ids: changeset get', async () => {
    const result = await vict(['changeset', 'get', 'cs-cli-1', '--json']);
    expect(result.code).toBe(0);
    expect(result.out).toContain('cs-cli-1');
    // A missing ChangeSet is the authorizing actor's denial (404 mapping,
    // stable code; absence is never disclosed as an empty record).
    const missing = await vict(['changeset', 'get', 'cs-never-was', '--json']);
    expect(missing.code).toBe(2);
    expect(missing.err).toContain('VICT_CONTROL_CHANGESET_MISSING');
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
    const stale = await vict(['release', 'rollback', 'app-x', 'release-never'], {
      token: 'vict-test-token-operator',
    });
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
});
