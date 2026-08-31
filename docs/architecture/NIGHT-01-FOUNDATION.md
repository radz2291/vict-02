# Night 01 Foundation — Vict Kernel

Status: verified. Everything in this note is derived from running code in this
repository (see `docs/nightly/VICT-NIGHT-01-REPORT.md` for evidence).

## What Vict is (Night 01 slice)

> A typed application graph can be defined, compiled, validated atomically,
> executed deterministically, traced completely, and simulated without
> accidentally performing external side effects.

The proven vertical slice is a deterministic ARA conversation flow:

```text
user message → prepare context → assistant capability → assistant response
```

## Package dependency map

```text
@vict/contracts  ←  @vict/kernel  ←  @vict/runtime
       ↑                 ↑                ↑
       └──────────────── @vict/sdk ───────┘  (public authoring facade)

examples/ara-proof → @vict/sdk + @vict/runtime
```

- **@vict/contracts** — executable data promises (`Contract<T>`), structured
  validation results (`ContractResult`, `ContractIssue`), and the shared
  `VictError` shape plus a ready `errorSignalContract` for error handlers.
  Implementation detail: a small adapter over zod. Zod types are **not**
  exported; issue mapping guarantees received values are never copied into
  validation results.
- **@vict/kernel** — pure graph semantics: definition types, compiler with
  structured rejections, immutable compiled graphs, deterministic graph
  versions, the sequential executor, ordered trace events, structured errors.
  The kernel performs **no** filesystem, network, database, provider, or
  secret access. All environment access arrives through explicit ports
  (`CapabilityPort`, `PolicyPort`, `ContractEnvironment`, `CapabilityIndex`,
  `Clock`, `IdFactory`).
- **@vict/runtime** — the usable in-process runtime: capability registry,
  test doubles, execution modes (`normal | simulate | test`), effect policy
  enforcement, atomic graph activation, isolated node testing, in-memory run
  repository, public execution facade. Contains no ARA-specific logic.
- **@vict/sdk** — the stable import surface for application authors:
  `defineContract`, `defineCapability`, `defineGraph`, `createRuntime`, and
  the public vocabulary. No lower package imports from the SDK.

No circular dependencies. The physical arrangement matches the handoff; no
deviation was necessary.

## Canonical domain concepts implemented

| Concept | Implementation |
|---|---|
| Kernel | `@vict/kernel` — compile + execute, pure, port-driven |
| Contract | `Contract<T>` with `parse(input): ContractResult<T>` |
| Capability | `CapabilityDefinition<I, O>` — id, effect class, contracts, `invoke` |
| Runtime | `VictRuntime` / `createRuntime()` |
| Application graph | `ApplicationGraphDefinition` (id, entry, nodes, edges) |
| Change set | Not implemented (future governed modification unit) |
| Capability pack | Not implemented (future installable collection) |

## Execution lifecycle

1. **Author** — application code defines contracts, capabilities, and a graph
   through `@vict/sdk`.
2. **Register** — capabilities (and their embedded contracts) register on a
   runtime instance. Test doubles may be registered per capability.
3. **Activate** — `runtime.activate(definition)` compiles the graph.
   Compilation either produces an immutable compiled graph or a structured
   rejection (`GraphIssue[]` with stable codes). **Activation is atomic**:
   failure leaves the previous graph active. Compilation happens here, once —
   never on the conversational hot path.
4. **Run** — `runtime.run(input, { mode })` pins the run to the active graph
   id/version, then the kernel executor:
   - checks the effect policy for the node's capability,
   - validates the input against the effective input contract
     (node override, else capability declaration),
   - invokes through the capability port (real implementation or test double),
   - validates the output against the effective output contract,
   - routes validated output along the success edge,
   - converts failures (capability errors, contract rejections, port
     failures) into structured `VictError` signals routed along the explicit
     error edge, or fails the run honestly when none exists,
   - enforces a hard maximum step count (defense in depth; cycles are already
     rejected at compile time),
   - emits ordered events (`seq` is monotonic per run; timestamps are
     diagnostics only).
5. **Trace** — the `RunResult` carries status/output/error and the full
   ordered `KernelEvent[]`. Normal and simulate runs are recorded in the
   in-memory repository; isolated node runs are not.

Event vocabulary: `run.started`, `node.started`, `node.completed`,
`node.failed`, `contract.rejected`, `signal.routed`, `effect.blocked`,
`run.completed`, `run.failed`, `run.blocked`. Every event carries run id,
graph id, graph version, sequence number, and timestamp. Payloads are never
recorded: outputs are summarized to shapes/lengths/key-names only, and
secret-like key names are redacted (`password`, `secret`, `token`,
`credential`, `api-key`, `private-key`, `authorization`).

## Graph identity and versioning

`graphVersion` is a SHA-256 content hash (`v1_<64 hex>`) over a canonicalized
semantic form of the definition: object keys sorted, node/edge arrays sorted
by identity, absent optionals normalized to `null`, schema marker
`vict.graph@1` included. Whitespace and key insertion order cannot change the
version; any semantic change does. Determinism is covered by tests
(`computeGraphVersion` equal across reordered, reformatted, JSON-round-tripped
definitions).

## Simulation and effect policy

Enforced by the runtime before any invocation (kernel `PolicyPort`):

| Effect | Normal | Simulate | Isolated test |
|---|---|---|---|
| `pure` | real | real | real |
| `read` | real | double required | double required |
| `write` | real | double required | double required |
| `irreversible` | real **only** with explicit `policy.allowIrreversible` | double required | denied |

When a required test double is absent, the runtime returns a structured
**blocked** result (`effect.blocked` + `run.blocked`) including the capability
id, effect class, mode, reason, and remediation. The real implementation is
never invoked. Regression tests use spies that fail loudly if a real
implementation is touched.

Isolated node testing (`runtime.runNode(nodeId, input)`):

- executes exactly one node of the active graph (mode forced to `test`),
- never traverses outgoing edges,
- never mutates the active graph,
- never writes to the normal run repository/event stream,
- returns its trace directly.

## Public API example

```ts
import { createRuntime, defineCapability, defineContract, defineGraph } from '@vict/sdk';
import { z } from 'zod';

const Text = defineContract('app.Text', z.object({ text: z.string().min(1) }));

const shout = defineCapability({
  id: 'app.shout',
  effect: 'pure',
  input: Text,
  output: Text,
  invoke: async (input) => ({ text: input.text.toUpperCase() }),
});

const runtime = createRuntime();
runtime.registerCapability(shout);
runtime.activate(defineGraph({
  id: 'app-graph',
  entry: 'shout',
  nodes: [{ id: 'shout', capability: 'app.shout' }],
  edges: [],
}));

const result = await runtime.run({ text: 'vict' });   // { status: 'completed', output: { text: 'VICT' }, trace: [...] }
```

Executable demo: `npm run example` (deterministic ARA proof, fully offline).

## Decisions that intentionally differ from legacy Vict

| Legacy idea inspected | Reused as behaviour | Rejected/reframed | Reason |
|---|---|---|---|
| `@vict/engine` — "dumb" storage/traversal engine with grammar plug slots | Graph execution remains a dedicated layer with zero domain knowledge | Kernel owns full compile + execution *semantics*; no grammar plug system (Validator/Processor/Editor) | Semantics belong to the kernel, not to pluggable interpreters; ports replace plugs |
| Four delivery modes in the engine runtime | Execution modes survive as `normal / simulate / test` | Single deterministic sequential algorithm instead of four delivery modes | Determinism first; mode is policy, not traversal shape |
| `@vict/grammar` + YAML blueprints as the primary authoring experience | Structural validation survives (compile-time rejections) | Authoring is typed TypeScript via `@vict/sdk`; YAML is a possible future serialization, not the product | Type-checked authoring beats stringly-typed YAML; the thesis is inspectable graphs, not YAML |
| `lang-app` / `lang-ai` / `lang-space` language modules | Nothing directly | Replaced by capabilities (+ future capability packs) | Ordinary integrations are typed operations, not "languages" |
| `ShapeChecker` wire validation | Inter-node contract checking survives | Contracts are executable promises enforced at execution boundaries with structured issues | Data-shaped promises, not grammar-declared wire rules |
| Live-edit `EditorSystem` (atomic graph hot-edit) | Atomicity survives in graph activation | Change sets / live edit deferred to the future control plane | Governance needs intent, not Night 01 machinery |
| Healer as an autonomous subsystem | Nothing | Explicitly out of scope | Recovery is a control-plane concern; not part of a normal ARA turn |
| `kit-svelte` / app layer | Nothing | No UI tonight | Smallest complete semantics first |

## Explicitly deferred (not built tonight)

Durable persistence (database), control plane, Builder Agent, Studio/UI,
healer/recovery, capability registry service, change sets, capability packs,
YAML serialization, HTTP/MCP surfaces, real model adapters, distributed
execution, cloud deployment. Structural contract compatibility is currently
identity-based (two adjacent contracts are statically compatible when they are
the same contract id); richer structural rules are deferred.

## Repository commands

```text
npm run format:check   # prettier
npm run lint           # eslint
npm run typecheck      # tsc, whole workspace incl. tests
npm test               # vitest (unit + integration projects)
npm run build          # ordered package builds (contracts → kernel → runtime → sdk)
npm run example        # deterministic ARA proof
npm run bench          # three-node pure graph execution benchmark
```
