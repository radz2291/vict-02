# Vict

An agent-native application operating layer. Important application behaviour is
represented as an explicit, inspectable graph that can eventually be versioned
and safely changed by humans and agents together.

This repository is the greenfield kernel with durable identity, stores, and
(Stage 03) durable orchestration:

- `packages/contracts` — executable input/output promises
- `packages/kernel` — pure graph compilation and execution semantics
- `packages/runtime` — capabilities, policy, semantic store ports, durable
  run lifecycle, in-memory store, capability-pack installation
- `packages/store-sqlite` — SQLite adapter for the store ports (built-in
  `node:sqlite` driver, forward migrations)
- `packages/application` — framework-neutral Application Definition
  compiler, canonical identity, release manifests, renderer and
  application-data contracts with shared conformance fixtures
- `packages/sdk` — the stable authoring ABI (contracts, capabilities,
  graphs, packs, applications, resources, releases; no runtime dependency)
- `packs/notes-pack`, `packs/ledger-pack` — offline capability packs
  passing the shared pack-conformance suite
- `examples/ara-proof` — deterministic, offline ARA conversation proof
- `examples/orchestration-proof` — deterministic, offline Stage 03
  orchestration proof (decision route, fork/join, durable signal wait,
  keyed-write retry/reconciliation across a restart boundary)
- `examples/application-proof` — Stage 04 SvelteKit vertical proof:
  one neutral Application Definition rendered by a generic catch-all host
  with a typed view, contract-validated form, local action, real VICT
  capability action, and a custom component resolved by id/revision

Stages 1–3 are independently verified. Stage 4 — the capability and
application authoring foundation — is implemented and awaiting independent
audit: the SDK is now a lightweight authoring ABI below the kernel and
runtime (`@vict/contracts → @vict/sdk → @vict/kernel → @vict/runtime`),
capability packs install explicitly with least-authority permissions,
configuration and secret resolution, and a framework-neutral
Application Definition compiles into an immutable plan with canonical
`applicationVersion` and Application Release manifests. A minimal
SvelteKit vertical proof renders one neutral definition through a generic
catch-all host. See
`docs/architecture/STAGE-04-CAPABILITY-APPLICATION-AUTHORING.md` and
`docs/report/VICT-STAGE-04-REPORT.md`.

## Quick start

```bash
npm install
npm test             # deterministic, offline tests (unit + integration)
npm run example      # run the ARA proof
npm run bench        # in-memory and SQLite-backed benchmarks
npm run verify:stage2  # Stage 02 aggregate verification
npm run verify:stage3  # Stage 03 aggregate verification (conformance,
                       # crash/restart fixtures, offline proof, packed
                       # orchestration consumer)
npm run verify:stage4  # Stage 04 aggregate verification (authoring ABI,
                       # packs, application model, isolated packed
                       # consumers, SvelteKit proof)
npm run example:application  # build + DOM-level tests for the SvelteKit
                             # application proof
```

## Durable local store quick start

```ts
import { createRuntime, defineCapability, defineGraph } from '@vict/sdk';
import { createSqliteStores } from '@vict/store-sqlite';

const stores = createSqliteStores({ path: 'vict.db' }); // or ':memory:'
const runtime = createRuntime({ stores });

runtime.registerCapability({
  id: 'app.echo',
  revision: '1',
  effect: 'pure',
  invoke: (input: { text: string }) => input,
});

const activation = await runtime.activate(
  defineGraph({
    id: 'app-graph',
    entry: 'only',
    nodes: [{ id: 'only', capability: 'app.echo' }],
    edges: [],
  }),
);
if (!activation.ok) {
  throw new Error(`activation failed: ${JSON.stringify(activation.issues)}`);
}

const result = await runtime.run({ text: 'hello' }); // run + events are durable
const record = await runtime.getRun(result.runId);

await stores.dispose();
```

After a process restart, in a fresh process:

```ts
const restored = await runtime.restoreActivation(graphDefinition);
// exact match required: current code must reproduce the stored activation
// exactly, or restoration fails without executing anything

await runtime.recoverInterruptedRuns();
// runs left nonterminal by a previous process become 'blocked';
// nothing is replayed; recovery is idempotent
```

Notes:

- Payload retention defaults to `'summary'`. The complete output is stored
  only under explicit `'full'` retention — which makes the caller/operator
  responsible for the sensitivity, access control, minimization, and
  lifecycle of the persisted content.
- Inputs are never stored, including under `'full'` retention.
- One local runtime owner per database file. To discard a disposable local
  development database, delete its file (`vict.db`, plus `-wal`/`-shm`
  sidecars when present); Vict never deletes databases automatically.
- Requires Node `>=22.13.0` (built-in `node:sqlite`).

## Durable orchestration (Stage 03)

Graphs can branch, wait, retry, and survive process loss:

```ts
const activation = await runtime.activate(
  defineGraph({
    id: 'pipeline',
    entry: 'decide',
    nodes: [
      { id: 'decide', kind: 'decision', capability: 'app.route' },
      { id: 'f', kind: 'fork', join: 'j' },
      { id: 'a', capability: 'app.prepare' },
      { id: 'b', capability: 'app.prepare' },
      { id: 'j', kind: 'join', fork: 'f' },
      { id: 'gate', kind: 'wait', wait: { kind: 'signal', name: 'approve' } },
      {
        id: 'apply',
        capability: 'app.apply',              // effect: 'write', idempotency: 'keyed'
        retry: { maxAttempts: 3, retryOn: ['timeout'], backoff: { kind: 'fixed', delayMs: 100 } },
      },
    ],
    edges: [
      { from: 'decide', to: 'f', kind: 'route', key: 'go' },
      { from: 'f', to: 'a', kind: 'branch', key: 'a' },
      { from: 'f', to: 'b', kind: 'branch', key: 'b' },
      { from: 'a', to: 'j' },
      { from: 'b', to: 'j' },
      { from: 'j', to: 'gate' },
      { from: 'gate', to: 'apply' },
    ],
  }),
);

const parked = await runtime.run('request');   // parks at the durable wait
await runtime.signal({
  runId: parked.runId,
  waitId: parked.waits![0].waitId,             // exact wait addressing
  signalId: 'approval-1',                      // caller idempotency key
  signalName: 'approve',
  payload: 'approved',
});
const final = await runtime.resumeRun(parked.runId); // drive to terminal/quiescent
```

- `resumeRun` resolves the run's EXACT pinned activation (revision-pinned);
  activation selection changes never affect suspended runs; missing
  artifacts block instead of substituting.
- Retries are bounded, classified by safe stable codes, and durable
  (survive restart via the due-timer pump: `runtime.processDueTimers`).
- Ambiguous unsafe effects (non-keyed writes, irreversible operations) block
  for operator resolution (`runtime.resolveBlocked`, denied by default).
- Cancellation is a durable, cooperative, idempotent request:
  `runtime.cancel({ runId, requestId, reasonCode })`.

See `docs/architecture/STAGE-03-DURABLE-ORCHESTRATION.md` for the full
model, state diagrams, effect/ambiguity rules, and operational limits.

## Documentation

- `docs/architecture/NIGHT-01-FOUNDATION.md` — the kernel and why it exists
- `docs/architecture/STAGE-02-STORES.md` — store ports, SQLite adapter,
  migrations, restart/interruption semantics
- `docs/VICT-SYSTEM-REFERENCE.md` — authoritative system reference
- `docs/architecture/STAGE-03-DURABLE-ORCHESTRATION.md` — durable
  orchestration: tokens/attempts/waits, retries, cancellation, blocked
  resolution, exact-activation resume, checkpoint boundary
- `docs/report/VICT-STAGE-03-INDEPENDENT-RE-AUDIT.md` — authoritative Stage
  03 disposition: verified with non-blocking issues; Stage 04 permitted
- `docs/handoff/VICT-STAGE-02-HANDOFF.md` — Stage 02 scope
- `docs/handoff/VICT-STAGE-03-HANDOFF.md` — Stage 03 scope
