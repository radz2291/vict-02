import { defineContract } from '@vict/sdk';
import type { KernelEvent } from '@vict/sdk';

/**
 * Contracts for the Stage 03 orchestration proof. All parse functions are
 * pure and side-effect free; validation is fail-closed.
 */

export const StringContract = defineContract({
  id: 'proof-string',
  revision: '1',
  expected: 'a string',
  parse: (input: unknown) =>
    typeof input === 'string'
      ? { ok: true as const, value: input, issues: [] }
      : { ok: false as const, issues: [{ code: 'TYPE', path: '$', message: 'expected a string' }] },
});

export const DecisionResultContract = defineContract({
  id: 'proof-decision-result',
  revision: '1',
  expected: 'a DecisionResult with a declared route and a string value',
  parse: (input: unknown) => {
    if (
      typeof input === 'object' &&
      input !== null &&
      typeof (input as { route?: unknown }).route === 'string' &&
      typeof (input as { value?: unknown }).value === 'string'
    ) {
      return { ok: true as const, value: input, issues: [] };
    }
    return {
      ok: false as const,
      issues: [{ code: 'SHAPE', path: '$', message: 'expected { route: string, value: string }' }],
    };
  },
});

export const JoinResultContract = defineContract({
  id: 'proof-join-result',
  revision: '1',
  expected: 'a canonical branch-result object with string values under keys alpha and beta',
  parse: (input: unknown) => {
    if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
      const record = input as Record<string, unknown>;
      if (typeof record.alpha === 'string' && typeof record.beta === 'string') {
        return { ok: true as const, value: input, issues: [] };
      }
    }
    return {
      ok: false as const,
      issues: [
        { code: 'SHAPE', path: '$', message: 'expected { alpha: string, beta: string }' },
      ],
    };
  },
});

export type ProofEvent = KernelEvent;