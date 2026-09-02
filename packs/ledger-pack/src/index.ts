import { defineCapabilityPack, defineContract } from '@vict/sdk';
import type { CapabilityPack } from '@vict/sdk';

/**
 * `vict.example.ledger` — a WRITE capability pack with the full Stage 04
 * declaration surface:
 *
 * - keyed idempotency for the durable write;
 * - declared ambiguity policy ('block' semantics for the non-keyed probe);
 * - declared permissions, configuration, and secret references;
 * - a declared simulation double (safe test/simulation substitute);
 * - an external-ledger simulation whose REAL handler is observable through
 *   a pack-owned invocation counter (the conformance suite proves the
 *   double runs INSTEAD of it and that ungranted runs never reach it).
 *
 * The manifest stays serializable: names and revisions only. The REAL
 * secret value lives exclusively in the runtime authority port.
 */

const LedgerEntry = defineContract<{ account: string; amount: number }>({
  id: 'ledger.entry',
  revision: '1',
  expected: '{ account: string, amount: number }',
  parse: (input) => {
    const candidate = input as { account?: unknown; amount?: unknown } | null;
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      typeof candidate.account === 'string' &&
      typeof candidate.amount === 'number' &&
      Number.isFinite(candidate.amount)
    ) {
      return { ok: true as const, value: { account: candidate.account, amount: candidate.amount } };
    }
    return {
      ok: false as const,
      issues: [{ code: 'invalid_type', path: '(root)', message: 'ledger entry expected' }],
    };
  },
});

const AuditLine = defineContract<{ line: string }>({
  id: 'ledger.audit-line',
  revision: '1',
  expected: '{ line: string }',
  parse: (input) => {
    const candidate = input as { line?: unknown } | null;
    if (candidate !== null && typeof candidate === 'object' && typeof candidate.line === 'string') {
      return { ok: true as const, value: { line: candidate.line } };
    }
    return {
      ok: false as const,
      issues: [{ code: 'invalid_type', path: '(root)', message: 'audit line expected' }],
    };
  },
});

const LedgerReceipt = defineContract<{
  applied: boolean;
  via: 'real' | 'double';
  account: string;
  currency: string | null;
  apiKeyLength: number | null;
}>({
  id: 'ledger.receipt',
  revision: '1',
  expected: '{ applied, via, account, currency, apiKeyLength }',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      candidate.applied === true &&
      (candidate.via === 'real' || candidate.via === 'double') &&
      typeof candidate.account === 'string'
    ) {
      return {
        ok: true as const,
        value: {
          applied: true,
          via: candidate.via as 'real' | 'double',
          account: candidate.account,
          currency: typeof candidate.currency === 'string' ? candidate.currency : null,
          apiKeyLength: typeof candidate.apiKeyLength === 'number' ? candidate.apiKeyLength : null,
        },
      };
    }
    return {
      ok: false as const,
      issues: [{ code: 'invalid_type', path: '(root)', message: 'ledger receipt expected' }],
    };
  },
});

/** Pack-owned external-ledger probe: counts REAL handler invocations. */
let realInvocations = 0;
export function ledgerRealInvocationCount(): number {
  return realInvocations;
}

export function resetLedgerProbe(): void {
  realInvocations = 0;
}

/** The canary the suite resolves through the runtime authority port. */
export const LEDGER_SECRET_CANARY = 'RA4-LEDGER-SECRET-CANARY-vault9';

export const ledgerPack: CapabilityPack = defineCapabilityPack(
  {
    schema: 'vict.capability-pack@1',
    id: 'vict.example.ledger',
    version: '1.0.0',
    victCompatibility: '^0.1.0',
    capabilities: [
      {
        id: 'ledger.audit',
        revision: '1',
        effect: 'pure',
        input: { contractId: 'ledger.entry', revision: '1' },
        output: { contractId: 'ledger.audit-line', revision: '1' },
      },
      {
        id: 'ledger.apply',
        revision: '1',
        effect: 'write',
        input: { contractId: 'ledger.entry', revision: '1' },
        output: { contractId: 'ledger.receipt', revision: '1' },
        idempotency: 'keyed',
        retry: {
          maxAttempts: 3,
          retryOn: ['timeout'],
          backoff: { kind: 'fixed', delayMs: 10 },
        },
        permissions: ['ledger.write'],
        configuration: ['ledger.currency'],
        requiredConfiguration: ['ledger.currency'],
        secrets: ['ledger.apiKey'],
        requiredSecrets: ['ledger.apiKey'],
        ambiguity: 'keyedRetry',
      },
    ],
    contracts: [
      { id: 'ledger.entry', revision: '1' },
      { id: 'ledger.audit-line', revision: '1' },
      { id: 'ledger.receipt', revision: '1' },
    ],
    permissions: [{ id: 'ledger.write', description: 'Append entries to the simulated ledger.' }],
    configuration: [
      { name: 'ledger.currency', required: true, description: 'Display currency code.' },
    ],
    secrets: [{ name: 'ledger.apiKey', required: true, description: 'Ledger API key reference.' }],
    doubles: [
      {
        capabilityId: 'ledger.apply',
        revision: '1',
        modes: ['test', 'simulate'],
      },
    ],
    evaluations: [
      {
        id: 'eval.ledger.apply.keyed',
        capabilityId: 'ledger.apply',
        description: 'Same idempotency key reconciles to one external mutation.',
      },
    ],
    documentation: {
      summary: 'Keyed-idempotent ledger writes with least-authority declarations.',
    },
    provenance: { author: 'vict examples', license: 'MIT' },
  },
  {
    capabilities: [
      {
        id: 'ledger.audit',
        revision: '1',
        input: LedgerEntry,
        output: AuditLine,
        invoke: (input: { account: string }) => ({ line: `AUDIT ${input.account}` }),
      },
      {
        id: 'ledger.apply',
        revision: '1',
        input: LedgerEntry,
        output: LedgerReceipt,
        invoke: async (input: { account: string; amount: number }, context) => {
          realInvocations += 1;
          // Least-authority readers: declared names only. The secret VALUE
          // never leaves this handler except as its length.
          const currency = context.config?.get('ledger.currency');
          const apiKey = await context.secrets?.get('ledger.apiKey');
          return {
            applied: true,
            via: 'real' as const,
            account: input.account,
            currency: typeof currency === 'string' ? currency : null,
            apiKeyLength: typeof apiKey === 'string' ? apiKey.length : null,
          };
        },
      },
    ],
    doubles: [
      {
        capabilityId: 'ledger.apply',
        revision: '1',
        invoke: (input: unknown) => {
          const entry = input as { account: string };
          return {
            applied: true,
            via: 'double',
            account: entry.account,
            currency: 'SIM',
            apiKeyLength: 0,
          };
        },
      },
    ],
  },
);

export const ledgerPackPure = {
  pureCapabilityId: 'ledger.audit',
  pureInput: { account: 'acc-1', amount: 0 },
  pureExpectedOutput: { line: 'AUDIT acc-1' },
} as const;

export const ledgerPackConformance = {
  writeCapabilityId: 'ledger.apply',
  writeInput: { account: 'acc-1', amount: 42 },
  writeDoubleOutput: {
    applied: true,
    via: 'double',
    account: 'acc-1',
    currency: 'SIM',
    apiKeyLength: 0,
  },
} as const;
