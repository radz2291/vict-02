import type { ApplicationGraphDefinition } from '@vict/sdk';

/**
 * The proof topology (fixed, declared, compiled before activation):
 *
 *   decide ──route:prepare──► fork ──branch:alpha──► alpha ─┐
 *                │             │                            ├─► join ──► gate (signal wait) ──► apply (keyed write)
 *                │             └──branch:beta ──► beta ─────┘
 *                └─route:reject──► rejected
 *
 * - `decide` is a pure decision node returning a typed route key.
 * - `fork` fans out into exactly two statically declared branches.
 * - `join` fires exactly once with a canonical (lexicographically ordered)
 *   branch-result object.
 * - `gate` parks the run behind a durable signal wait with a durable
 *   timeout edge to `timed-out`.
 * - `apply` is a keyed-idempotent write with a bounded retry policy.
 */
export const proofGraph: ApplicationGraphDefinition = {
  id: 'orchestration-proof',
  entry: 'decide',
  nodes: [
    { id: 'decide', kind: 'decision', capability: 'route' },
    { id: 'fork', kind: 'fork', join: 'join', maxConcurrency: 2 },
    { id: 'alpha', capability: 'branch' },
    { id: 'beta', capability: 'branch' },
    { id: 'join', kind: 'join', fork: 'fork', output: 'proof-join-result' },
    {
      id: 'gate',
      kind: 'wait',
      wait: { kind: 'signal', name: 'proof-go', timeoutMs: 60_000 },
    },
    { id: 'timed-out', capability: 'onTimeout', output: 'proof-string' },
    { id: 'rejected', capability: 'onReject', output: 'proof-string' },
    {
      id: 'apply',
      capability: 'apply',
      retry: {
        maxAttempts: 3,
        retryOn: ['VICT_RUNTIME_CAPABILITY_THREW'],
        backoff: { kind: 'fixed', delayMs: 1 },
      },
      output: 'proof-string',
    },
  ],
  edges: [
    { from: 'decide', to: 'fork', kind: 'route', key: 'prepare' },
    { from: 'decide', to: 'rejected', kind: 'route', key: 'reject' },
    { from: 'fork', to: 'alpha', kind: 'branch', key: 'alpha' },
    { from: 'fork', to: 'beta', kind: 'branch', key: 'beta' },
    { from: 'alpha', to: 'join' },
    { from: 'beta', to: 'join' },
    { from: 'join', to: 'gate' },
    { from: 'gate', to: 'apply' },
    { from: 'gate', to: 'timed-out', kind: 'timeout' },
    { from: 'timed-out', to: 'apply' },
  ],
};