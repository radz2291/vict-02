import { createRuntime, installCapabilityPack } from '@vict/runtime';
import { runCapabilityPackConformanceSuite } from '@vict/runtime/testing';
import {
  defineCapabilityPack,
  defineGraph,
  VICT_AUTHORING_COMPAT_VERSION,
  validateCapabilityPack,
  neutralJsonContract,
} from '@vict/sdk';
import { describe, expect, it } from 'vitest';
import {
  ledgerPack,
  ledgerPackConformance,
  ledgerPackPure,
  ledgerRealInvocationCount,
  LEDGER_SECRET_CANARY,
  resetLedgerProbe,
} from '../src/index.js';

const install = installCapabilityPack;

/**
 * The write pack passes the SAME shared conformance suite as the pure pack,
 * plus write-specific adversarial checks: simulation doubles instead of the
 * real write, permission gating, undeclared secret/config unavailability,
 * and secret-canary non-leakage.
 */
describe('capability pack conformance: vict.example.ledger (write)', () => {
  it('passes the shared conformance suite with explicit grants + authority', async () => {
    resetLedgerProbe();
    await expect(
      runCapabilityPackConformanceSuite(
        {
          name: 'vict.example.ledger',
          pack: ledgerPack,
          pureCapabilityId: ledgerPackPure.pureCapabilityId,
          pureInput: ledgerPackPure.pureInput,
          pureExpectedOutput: ledgerPackPure.pureExpectedOutput,
          writeCapabilityId: ledgerPackConformance.writeCapabilityId,
          writeInput: ledgerPackConformance.writeInput,
          writeDoubleOutput: ledgerPackConformance.writeDoubleOutput,
          writeInvocationCount: ledgerRealInvocationCount,
          secretCanary: LEDGER_SECRET_CANARY,
        },
        {
          grants: ['ledger.write'],
          configuration: { 'ledger.currency': 'EUR' },
          secrets: { 'ledger.apiKey': LEDGER_SECRET_CANARY },
        },
      ),
    ).resolves.toBeUndefined();
  });

  it('an undeclared secret/config name is unavailable to the handler', async () => {
    resetLedgerProbe();
    // The declared reader throws for undeclared names; probe via a
    // tampered handler is unnecessary — call the gate-scoped reader shape
    // through a runtime probe capability that declares NOTHING.
    const runtime = createRuntime({
      authority: {
        grants: ['ledger.write'],
        configuration: { 'ledger.currency': 'EUR' },
        secrets: { 'ledger.apiKey': LEDGER_SECRET_CANARY },
      },
    });
    install(runtime, ledgerPack);
    await runtime.registerCapability({
      id: 'probe.undeclared',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: async (_input: unknown, context) => {
        // Declared NOTHING: readers must be absent entirely.
        expect(context.config).toBeUndefined();
        expect(context.secrets).toBeUndefined();
        return 'done';
      },
    });
    await runtime.activate(
      defineGraph({
        id: 'g.undeclared',
        entry: 'only',
        nodes: [{ id: 'only', capability: 'probe.undeclared' }],
        edges: [],
      }),
    );
    const result = await runtime.run('x', { mode: 'normal' });
    expect(result.status).toBe('completed');
  });

  it('compatibility and validation happen before any registration', () => {
    const invalid = validateCapabilityPack(
      defineCapabilityPack(
        {
          ...ledgerPack.manifest,
          victCompatibility: `>=${VICT_AUTHORING_COMPAT_VERSION.split('.')[0]}.999.0`,
        },
        ledgerPack.bindings,
      ),
    );
    expect(invalid.ok).toBe(false);

    expect(() =>
      install(
        createRuntime(),
        defineCapabilityPack(
          {
            ...ledgerPack.manifest,
            victCompatibility: '>=9.0.0',
          },
          ledgerPack.bindings,
        ),
      ),
    ).toThrowError(/not installable/);
  });

  it('the ledger manifest declares names and never carries the secret value', () => {
    const serialized = JSON.stringify(ledgerPack.manifest);
    expect(serialized).toContain('ledger.apiKey');
    expect(serialized).not.toContain(LEDGER_SECRET_CANARY);
  });
});
