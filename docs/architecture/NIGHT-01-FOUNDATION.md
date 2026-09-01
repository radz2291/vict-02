# Night 01 Foundation — Vict Kernel

Status: verified (Night 01.1 finalization applied). Everything in this note is
derived from running code in this repository (see
`docs/nightly/VICT-NIGHT-01-FINALIZATION-REPORT.md` for the post-audit
evidence, and `docs/nightly/VICT-NIGHT-01-REPORT.md` for the original night
plus its post-audit amendment).

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

examples/ara-proof → @vict/sdk (+ optional @vict/sdk/zod)
```

- **@vict/contracts** — the neutral contract API: executable data promises
  (`Contract<T>` with `id`, `revision`, `expected`, `parse`), structured
  validation results (`ContractResult`, `ContractIssue`), and the shared
  `VictError` shape plus a ready `errorSignalContract` for error handlers.
  The base package is **schema-library neutral**: no schema library appears
  in its signatures or emitted declarations. Zod convenience exists only in
  the optional `@vict/contracts/zod` adapter subpath (zod as an optional peer
  dependency), which maps zod issues onto neutral, safe `ContractIssue`
  objects with framework-generated messages.
- **@vict/kernel** — pure graph semantics: definition types, compiler with
  structured rejections (13 stable issue codes), immutable compiled graphs,
  layered activation identity, the sequential executor, ordered trace events,
  structured errors. The kernel performs **no** filesystem, network, database,
  provider, or secret access. All environment access arrives through explicit
  ports (`CapabilityPort`, `PolicyPort`, `ContractEnvironment`,
  `CapabilityIndex`, `Clock`, `IdFactory`).
- **@vict/runtime** — the usable in-process runtime: capability registry,
  test doubles (`registerDouble`/`replaceDouble`), execution modes
  (`normal | simulate | test`), effect policy enforcement, atomic activation
  with an **immutable activation snapshot**, isolated node testing, payload
  retention policy, in-memory run repository, public execution facade.
  Contains no ARA-specific logic.
- **@vict/sdk** — the stable import surface for application authors:
  `defineContract` (neutral), `defineCapability`, `defineGraph`,
  `createRuntime`, and the public vocabulary. Optional Zod authoring sugar
  lives in `@vict/sdk/zod`. No lower package imports from the SDK.

No circular dependencies. The physical arrangement matches the handoff; no
deviation was necessary.

## Canonical domain concepts implemented

| Concept | Implementation |
|---|---|
| Kernel | `@vict/kernel` — compile + execute, pure, port-driven |
| Contract | `Contract<T>` with `id`, `revision`, `expected`, `parse` |
| Capability | `CapabilityDefinition<I, O>` — id, revision, effect class, contracts, `invoke` |
| Runtime | `VictRuntime` / `createRuntime()` with an immutable activation snapshot |
| Application graph | `ApplicationGraphDefinition` (id, entry, nodes, edges) |
| Change set | Not implemented (future governed modification unit) |
| Capability pack | Not implemented (future installable collection) |

## Activation identity: three distinct layers

Revisions are an **author/build responsibility**: changing handler logic,
effect classification or contract semantics requires changing the `revision`
(e.g. `revision: '1'` → `'2'`). Identity never hashes function bodies, schema
internals, memory addresses, timestamps, or object insertion order. Missing or
empty revisions are rejected with structured errors at authoring/registration
time.

1. **`graphVersion`** — SHA-256 over a canonicalized *topology/declaration*
   form: graph id, entry, nodes (id, capability reference, contract override
   references), edges. `graphVersion` is a declaration fingerprint **only**;
   it makes no claim about executable semantics.
2. **`capabilitySetVersion`** — SHA-256 over the effective capability/contract
   bindings the activated graph requires: per resolved node, the capability
   id + capability revision + effect class + effective input/output contract
   id + contract revision (node overrides resolved), canonically sorted and
   deduplicated. Only capabilities actually required by the graph contribute.
3. **`activationVersion`** — SHA-256 over
   `graphVersion + capabilitySetVersion + activation schema marker`. This is
   the identity of the exact executable activation.

Every normal/simulated run and every event identifies graph id,
`graphVersion`, `capabilitySetVersion`, and `activationVersion`.

## Execution lifecycle

1. **Author** — application code defines contracts (neutral API or optional
   adapter), capabilities, and a graph through `@vict/sdk`.
2. **Register** — capabilities (with revisions) and their embedded contracts
   register on a runtime instance. Registration validates revisions with
   structured errors. Test doubles are registered with `registerDouble`;
   replacement is explicit via `replaceDouble` (duplicates are rejected).
3. **Activate** — `runtime.activate(definition)` compiles the graph and
   **captures an immutable activation snapshot**: frozen copies of the
   execution-relevant capability bindings (invoke references, revisions,
   effect classes) and the contracts the graph requires. Compilation either
   produces an immutable compiled graph or a structured rejection
   (`GraphIssue[]` with stable codes). **Activation is atomic**: failure
   leaves the previous snapshot active. Compilation happens here, once —
   never on the conversational hot path.
4. **Run** — `runtime.run(input, { mode })` executes against the activation
   snapshot — never the live registry — with **doubles snapshotted at run
   start**. Registering or mutating capabilities/contracts/doubles after
   activation cannot affect an active graph or an in-flight run; an explicit
   `activate()` call captures updated registry state under a new activation
   identity when execution-relevant metadata changed. The kernel executor:
   - checks the effect policy for the node's capability,
   - validates the input against the effective input contract
     (node override, else capability declaration),
   - invokes through the capability port (real implementation or test double),
   - validates the output against the effective output contract,
   - routes validated output along the success edge,
   - converts failures (capability errors, contract rejections, port
     failures) into structured, **sanitised** `VictError` signals routed
     along the explicit error edge, or fails the run honestly when none
     exists,
   - enforces a hard maximum step count (defense in depth; cycles are already
     rejected at compile time),
   - emits ordered events (`seq` is monotonic per run; timestamps are
     diagnostics only).
5. **Trace and history** — the `RunResult` carries status/output/error and
   the full ordered `KernelEvent[]`. Run records are written to the in-memory
   repository under the runtime's payload retention policy (see below);
   isolated node runs are not persisted.

Event vocabulary: `run.started`, `node.started`, `node.completed`,
`node.failed`, `contract.rejected`, `signal.routed`, `effect.blocked`,
`run.completed`, `run.failed`, `run.blocked`.

## Trace safety versus run-history retention

Two different guarantees, deliberately separated:

- **Trace (always safe).** Events never contain values: outputs are
  summarized to shapes/lengths/key-names only; secret-like key names are
  redacted (`password`, `secret`, `token`, `credential`, `api-key`,
  `private-key`, `authorization`); contract issues carry framework-generated
  messages plus type-shape `received` descriptions.
- **Run history (policy-controlled).** A stored `RunRecord` follows the
  runtime's `PayloadRetention`:
  - `'summary'` (default): metadata, status, trace, sanitised error, and the
    safe output summary. **No complete payloads.**
  - `'none'`: additionally drop the output summary.
  - `'full'`: additionally retain the complete validated output. Explicit
    opt-in via `createRuntime({ payloadRetention: 'full' })`.

> **WARNING — full retention transfers responsibility.** Selecting `'full'`
> retention makes the caller/operator responsible for the sensitivity,
> access control, minimization, and lifecycle of the complete output that
> will be persisted. Vict cannot make arbitrary retained payloads safe merely
> by labeling the mode: pair `'full'` with an explicit access-control and
> deletion/lifecycle policy. Inputs are never stored, including under
> `'full'` retention.
- **Errors are sanitised at their source.** Thrown capability/double errors
  are untrusted: the runtime retains a stable code, capability/node ids, a
  safe framework-generated message, the error class name, and a correlation
  id — never the raw thrown message. Schema/adapter messages are never copied
  into issues; a schema message surfaces only as `issue.safeMessage` when the
  author explicitly opts in (`trustSchemaMessages`), and is then treated as
  author-controlled content.
- The caller-facing `RunResult.output` always carries the actual validated
  output regardless of retention; retention governs *stored history* only.
  Since Stage 02, that stored history lives behind the semantic store ports
  (`ActivationCatalog` / `ExecutionStore`) with the in-memory store as the
  default backend and SQLite (`@vict/store-sqlite`) as the durable adapter;
  see `docs/architecture/STAGE-02-STORES.md`.

## Simulation and effect policy

Enforced by the runtime before any invocation (kernel `PolicyPort`):

| Effect | Normal | Simulate | Isolated test |
|---|---|---|---|
| `pure` | real | real | real |
| `read` | real | double required | double required |
| `write` | real | double required | double required |
| `irreversible` | real **only** with explicit `policy.allowIrreversible` | double required (real never runs) | double required (real never runs) |

In simulate and isolated-test modes the real implementation of read, write,
and irreversible effects is **unreachable**: a registered safe double may
run, and without a double the operation is blocked. Irreversible effects in
normal mode require explicit caller permission
(`policy: { allowIrreversible: true }`). Blocked results are structured
(`effect.blocked` + `run.blocked`) with capability id, effect class, mode,
reason, and remediation. Regression tests use spies that fail loudly if a
real implementation runs where policy forbids it.

Isolated node testing (`runtime.runNode(nodeId, input)`):

- executes exactly one node of the active graph (mode forced to `'test'`),
- compiles against the activation snapshot, so post-activation registry
  changes cannot affect it,
- never traverses edges, never mutates the active graph, never writes to the
  run repository,
- returns its trace directly.

## Public API example

```ts
import { createRuntime, defineCapability, defineContract, defineGraph } from '@vict/sdk';

// Neutral contract authoring (no schema library). Optional Zod sugar:
//   import { defineZodContract } from '@vict/sdk/zod';
const Text = defineContract<{ text: string }>({
  id: 'app.text',
  revision: '1',
  parse: (input) =>
    typeof (input as { text?: unknown })?.text === 'string'
      ? { ok: true, value: input as { text: string } }
      : { ok: false, issues: [{ code: 'invalid_type', path: 'text', message: "Expected a string at 'text'." }] },
});

const shout = defineCapability({
  id: 'app.shout',
  revision: '1',
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

Executable demo: `npm run example` (deterministic ARA proof, fully offline,
13 events). Package-isolation proof: `npm run verify:consumer` (installs
packed tarballs into isolated consumers; the neutral consumer has no zod).

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
the same contract id); richer structural rules are deferred. Effect
classifications are author-supplied labels — a capability labelled `pure`
could still perform I/O; enforcement is only as truthful as the
classification (documented trust boundary).

## Repository commands

```text
npm run format:check     # prettier
npm run lint             # eslint
npm run typecheck        # tsc, whole workspace incl. tests
npm test                 # vitest (unit + integration projects)
npm run build            # ordered package builds (contracts → kernel → runtime → sdk)
npm run example          # deterministic ARA proof
npm run bench            # three-node pure graph execution benchmark
npm run verify:consumer  # isolated packed-package consumer check (run after build)
```
