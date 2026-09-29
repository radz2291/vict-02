//
// DIRECT TEST — confirmation target selection fails CLOSED (node env).
//
// Proves, against the real server-side transport module (the only fetch
// path of the confirmation journey), that submitting an UNKNOWN target id
// while a local target exists is a closed failure: NO network call is
// attempted (a fetch spy is installed and asserted never called), and no
// state is invented — the result is the truthful 'unreachable' kind that
// the journey page maps to a non-echoing banner. A control case proves the
// explicitly provisioned local target still resolves and attempts its
// fetch against THAT target's endpoint only.
//
// Mirrors tests/targets.test.ts discipline: provisioning is supplied
// through the deployment environment (VICT_STUDIO_TARGETS /
// VICT_STUDIO_CREDENTIALS) BEFORE the server module is imported.
import { afterEach, describe, expect, it, vi } from 'vitest';

const LOCAL_ENDPOINT = 'http://127.0.0.1:4310';

process.env['VICT_STUDIO_TARGETS'] = JSON.stringify([
  {
    id: 'local',
    label: 'Local VICT target',
    endpoint: LOCAL_ENDPOINT,
    credentialRef: 'studio-operator',
  },
]);
process.env['VICT_STUDIO_CREDENTIALS'] = JSON.stringify({
  'studio-operator': {
    token: 'target-selection-test-token',
    actorLabel: 'studio-operator',
    scopes: ['run.read', 'activation.read', 'audit.read', 'agent.stream.read'],
  },
});

const { prepareConfirmation, readConfirmationStatus, confirmCommand } = await import(
  '../src/lib/server/confirmation-transport.js'
);
const { getTarget } = await import('../src/lib/server/targets.js');

afterEach(() => {
  vi.restoreAllMocks();
});

function installFetchSpy(): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async () => {
    throw new Error('fetch must never be attempted for an unknown target');
  }) as unknown as ReturnType<typeof vi.fn>;
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('confirmation target selection fails closed (unknown target, local present)', () => {
  it('control: the locally provisioned target still resolves as the registry entry', () => {
    // While 'local' exists in the registry, the unknown id must remain
    // truthfully absent — never guessed, never another entry.
    expect(getTarget('local')).toBeDefined();
    expect(getTarget('unknown-target-x')).toBeUndefined();
    expect(getTarget('')).toBeUndefined();
  });

  it('prepare with an UNKNOWN target id fails closed with NO fetch and no echo', async () => {
    const spy = installFetchSpy();
    const result = await prepareConfirmation(
      { command: 'run.cancel', payload: { runId: 'run-x' }, expectedRevision: 7 },
      'ik-unknown-target-1',
      'unknown-target-x',
    );
    expect(spy).not.toHaveBeenCalled();
    // The closed result kind the journey page maps to the truthful
    // non-echoing banner ("The target is unreachable. No receipt was
    // issued; nothing was changed."): no receipt, no invented state.
    expect(result).toEqual({ kind: 'unreachable' });
    const bannerEcho = JSON.stringify(result);
    expect(bannerEcho).not.toContain('unknown-target-x');
  });

  it('status with an UNKNOWN target id fails closed with NO fetch', async () => {
    const spy = installFetchSpy();
    const result = await readConfirmationStatus('rcpt-valid-id', 'unknown-target-x');
    expect(spy).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'unreachable' });
  });

  it('confirm with an UNKNOWN target id fails closed with NO fetch', async () => {
    const spy = installFetchSpy();
    const result = await confirmCommand(
      '/vict/v1/runs/cancel',
      { payload: { runId: 'run-x' }, confirmation: { receiptId: 'rcpt-valid-id' } },
      'ik-unknown-target-2',
      'unknown-target-x',
    );
    expect(spy).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'unreachable' });
  });

  it('an ABSENT target id falls closed too (never silently to the local target)', async () => {
    const spy = installFetchSpy();
    const result = await prepareConfirmation(
      { command: 'run.cancel', payload: { runId: 'run-x' }, expectedRevision: 7 },
      'ik-absent-target-1',
      undefined,
    );
    expect(spy).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'unreachable' });
  });

  it('control: the EXPLICIT local target still resolves and fetches ONLY its endpoint', async () => {
    const spy = vi.fn(async () => ({
      status: 500,
      ok: false,
      json: async () => {
        throw new Error('body not read');
      },
    }));
    vi.stubGlobal('fetch', spy as unknown as typeof fetch);
    const result = await prepareConfirmation(
      { command: 'run.cancel', payload: { runId: 'run-x' }, expectedRevision: 7 },
      'ik-local-target-1',
      'local',
    );
    // The local target path still ATTEMPTS exactly one fetch, addressed to
    // the provisioned local endpoint (the selection resolved truthfully).
    expect(spy).toHaveBeenCalledTimes(1);
    const [calledUrl] = spy.mock.calls[0] as unknown as string[];
    expect(calledUrl).toBe(`${LOCAL_ENDPOINT}/vict/v1/confirmations`);
    expect(result).toEqual({ kind: 'http-error', status: 500 });
  });
});