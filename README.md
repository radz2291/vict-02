# Vict

An agent-native application operating layer. Important application behaviour is
represented as an explicit, inspectable graph that can eventually be versioned
and safely changed by humans and agents together.

This repository is the greenfield Stage 02 kernel with durable identity and
stores:

- `packages/contracts` — executable input/output promises
- `packages/kernel` — pure graph compilation and execution semantics
- `packages/runtime` — capabilities, policy, semantic store ports, durable
  run lifecycle, in-memory store
- `packages/store-sqlite` — SQLite adapter for the store ports (built-in
  `node:sqlite` driver, forward migrations)
- `packages/sdk` — the public authoring facade
- `examples/ara-proof` — deterministic, offline ARA conversation proof

## Quick start

```bash
npm install
npm test        # deterministic, offline tests (unit + integration)
npm run example # run the ARA proof
npm run bench   # in-memory and SQLite-backed benchmarks
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

## Documentation

- `docs/architecture/NIGHT-01-FOUNDATION.md` — the kernel and why it exists
- `docs/architecture/STAGE-02-STORES.md` — store ports, SQLite adapter,
  migrations, restart/interruption semantics
- `docs/VICT-SYSTEM-REFERENCE.md` — authoritative system reference
- `docs/handoff/VICT-STAGE-02-HANDOFF.md` — Stage 02 scope
