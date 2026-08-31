# Vict Greenfield Overnight Handoff 01

## Build the First Verified Vict Kernel

## Instruction to the receiving agent

Read this document completely, then execute it. This is an implementation assignment, not a request for another proposal or architecture review.

Work autonomously for the available session. Make reasonable reversible decisions, implement the system, run all relevant checks, diagnose failures, fix them, and leave an evidence-based report. Do not stop after reconnaissance or planning. Do not ask for ordinary implementation choices covered by this brief.

If the entire scope cannot be completed, finish the current atomic change, leave the repository buildable, and continue down the priority ladder until time expires. Never describe unverified work as complete.

---

## 1. Required paths

The initiating user should provide these paths when invoking you:

```text
TARGET_VICT_REPO=<absolute path to the greenfield repository you may modify>
LEGACY_VICT_PATH=<optional absolute path to the previous Vict system or documents; read-only>
```

Rules:

- Modify only `TARGET_VICT_REPO`.
- Treat `LEGACY_VICT_PATH` as optional read-only research.
- If the target repository is the current working directory, confirm that fact through repository inspection and continue.
- Do not recursively search the wider machine for another Vict project.
- Do not copy files, package boundaries, or names from the legacy project unless this handoff independently requires them.
- If no legacy path is provided, continue without it. The assignment is self-contained.

If the supplied target contains an old Vict implementation rather than a greenfield workspace, do not destructively overwrite it. Work in the explicitly designated greenfield directory or stop only if no safe target exists.

---

## 2. Greenfield declaration

This is a new architecture.

The previous Vict materials are a research corpus: they contain useful problems, scenarios, failed assumptions, and behavioural lessons. They are not the target package map and do not create compatibility obligations.

In particular, do not inherit these legacy concepts as the new public architecture:

- `@vict/engine`
- `@vict/grammar`
- `@vict/lang-*`
- “language modules” for ordinary integrations
- blueprint-as-primary-authoring-experience
- manual cross-language connection declarations
- healer as an autonomous subsystem
- runtime testing that may execute real external writes

Do not introduce compatibility aliases for them tonight.

Use the new vocabulary:

| New term | Meaning |
|---|---|
| Kernel | Pure graph compilation and execution semantics |
| Contract | Executable input/output promise |
| Capability | A typed operation a graph can invoke |
| Runtime | Stateful composition of kernel, capabilities, execution policy, and traces |
| Application graph | Versioned declaration of meaningful application orchestration |
| Change set | Future governed modification unit; not implemented tonight |
| Capability pack | Future installable collection of capabilities |

YAML is a possible future serialization format, not the product and not required tonight.

---

## 3. Mission

Build the first trustworthy vertical slice of the new Vict:

> A typed application graph can be defined, compiled, validated atomically, executed deterministically, traced completely, and simulated without accidentally performing external side effects.

Prove the kernel through a deterministic minimal ARA conversation flow:

```text
user message → prepare context → assistant capability → assistant response
```

This overnight milestone covers:

- Development Stage 0: architecture constitution and greenfield scaffold.
- Development Stage 1: verified walking kernel/runtime.
- Only the minimum forward-compatible foundations of Stage 2: graph identity/version, effect policy, and honest execution traces.

It does not cover durable database persistence, the control plane, Builder Agent, Studio, healer/recovery, capability registry, cloud deployment, or a production UI.

---

## 4. Product thesis

Vict is an agent-native application operating layer: important application behaviour is represented as an explicit, inspectable graph that can eventually be versioned and safely changed by humans or agents.

The enduring separation is:

```text
Application graph declares orchestration
Capabilities perform work
Contracts define promises
Kernel executes semantics
Runtime supplies state, policy, and observability
Control plane governs changes (later)
```

The product promise is not “write apps in YAML.” It is:

> Build applications whose operational behaviour is explicit enough for humans and AI to inspect and safely evolve together.

The conversational data path must remain fast. A Builder Agent or control-plane reasoning loop must never be placed inside every ARA response.

---

## 5. Authority and autonomy

You are authorised to:

- Inspect the complete target repository.
- Read applicable repository instructions before editing.
- Initialize the greenfield workspace when it is empty.
- Add source, tests, fixtures, configuration, scripts, and documentation.
- Select minor implementation details consistent with this architecture.
- Add narrowly justified dependencies using the chosen package manager.
- Run formatters, linters, type checks, tests, builds, benchmarks, and local examples.
- Refactor your own implementation as test evidence develops.
- Make local commits at coherent checkpoints if repository policy allows.

Do not:

- Modify the legacy/reference path.
- Discard or overwrite unrelated user work in the target.
- Use destructive git commands or rewrite history.
- push, publish packages, deploy, or mutate remote infrastructure.
- Require, reveal, or manufacture secrets.
- Call paid or state-changing external services during tests or verification.
- Perform real database writes, uploads, messages, payments, or deletions.
- weaken assertions, skip tests, or swallow errors to obtain a green result.
- create an elaborate framework surface that the ARA proof does not exercise.

For ordinary ambiguity, choose the simplest reversible implementation and record the decision. Stop only for a genuinely unsafe operation, a missing safe target repository, or required credentials with no safe local substitute. Otherwise continue.

---

## 6. Technical baseline

Follow existing target-repository instructions if present. If the target is blank and no contrary constraints exist, use:

- TypeScript with strict mode.
- ESM.
- A workspace-capable package manager; prefer `pnpm` for a blank monorepo.
- The current locally installed supported Node LTS; record the exact version used.
- Vitest or the target's established test runner.
- A formatter and linter appropriate to the selected stack.
- Package `exports` and explicit public entry points.

Public APIs must not use unbounded `any`. Use `unknown`, generics, discriminated unions, and explicit parsing at boundaries.

Prefer pure functions and dependency injection over global registries. Do not introduce microservices, queues, containers, a database, or a browser application tonight.

---

## 7. Target workspace architecture

Create or align the greenfield workspace to this shape:

```text
vict/
├── package.json
├── pnpm-workspace.yaml            # or chosen workspace equivalent
├── tsconfig.base.json
├── packages/
│   ├── contracts/                 # @vict/contracts
│   ├── kernel/                    # @vict/kernel
│   ├── runtime/                   # @vict/runtime
│   └── sdk/                       # @vict/sdk
├── examples/
│   └── ara-proof/
└── docs/
    ├── architecture/
    └── nightly/
```

Do not create placeholder packages for future components.

### Dependency direction

```text
@vict/contracts  ←  @vict/kernel  ←  @vict/runtime
       ↑                 ↑                ↑
       └──────────────── @vict/sdk ───────┘  (public authoring facade)

ara-proof → @vict/sdk + @vict/runtime
```

Interpret the SDK line pragmatically: `@vict/sdk` may depend on and selectively re-export stable authoring types from the underlying packages. No lower package may import from `@vict/sdk`.

Required rules:

- No circular package dependencies.
- `@vict/contracts` has no dependency on runtime or kernel.
- `@vict/kernel` performs no filesystem, network, database, model-provider, or secret access.
- `@vict/runtime` composes capabilities and policy but contains no ARA-specific logic.
- `@vict/sdk` is the intended import surface for application and future capability authors.
- ARA proof code lives in the example, not in framework packages.

If a materially smaller physical package arrangement is necessary to produce a coherent first milestone, document the reason before deviating. Do not fall back to the legacy engine/grammar/language package map.

---

## 8. Package responsibilities

### 8.1 `@vict/contracts`

Own executable data promises and structured validation results.

Provide the semantic equivalent of:

```ts
interface Contract<T = unknown> {
  readonly id: string;
  parse(input: unknown): ContractResult<T>;
}

type ContractResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ContractIssue[] };
```

Each issue should support:

- Stable code.
- Field/path.
- Human-readable message.
- Expected description when known.
- Safe received description when known.

Use a small adapter around an established schema library if helpful, but do not expose that library's implementation types as Vict's permanent public contract API. Avoid inventing a large schema DSL.

### 8.2 `@vict/kernel`

Own pure graph semantics:

- Graph definition types.
- Graph compilation.
- Structural validation.
- Immutable compiled graph.
- Deterministic execution algorithm.
- Routing semantics.
- Runaway protection.
- Kernel event types.
- Structured kernel errors.

The kernel receives capability invocation and policy through explicit ports/interfaces. It does not discover handlers, read files, call networks, or own process-wide mutable state.

### 8.3 `@vict/runtime`

Own the usable in-process Vict runtime:

- Capability registration.
- Active compiled graph.
- Atomic graph activation.
- Normal, simulation, and isolated-test execution modes.
- Effect policy enforcement.
- Test-double registration.
- In-memory run/trace repository for this milestone.
- Public execution facade.
- Runtime-level result types.

No external server is mandatory tonight. A clean TypeScript API is the primary public execution surface. Add a minimal CLI only if it materially improves the example and verification without compromising the core work.

### 8.4 `@vict/sdk`

Own the stable authoring experience:

- `defineContract` or equivalent.
- `defineCapability` or equivalent.
- `defineGraph` or equivalent.
- Public authoring types.
- Public effect classifications.
- Concise application-facing exports.

Application code should not need to import deep kernel internals.

### 8.5 `examples/ara-proof`

Own:

- The deterministic ARA graph.
- Example capabilities.
- A deterministic assistant provider.
- An executable demonstration script.
- End-to-end proof tests when appropriate.

---

## 9. Canonical domain model for Night 01

Adapt syntax where useful while preserving semantics.

### Graph

```ts
interface ApplicationGraphDefinition {
  id: string;
  entry: string;
  nodes: GraphNodeDefinition[];
  edges: GraphEdgeDefinition[];
}
```

### Node

```ts
interface GraphNodeDefinition {
  id: string;
  capability: string;
  input?: string;
  output?: string;
}
```

### Edge

```ts
interface GraphEdgeDefinition {
  from: string;
  to: string;
  kind?: 'success' | 'error';
}
```

### Capability

```ts
type EffectClass = 'pure' | 'read' | 'write' | 'irreversible';

interface CapabilityDefinition<I = unknown, O = unknown> {
  id: string;
  input?: Contract<I>;
  output?: Contract<O>;
  effect: EffectClass;
  invoke(input: I, context: CapabilityContext): Promise<O>;
}
```

### Execution

```ts
type ExecutionMode = 'normal' | 'simulate' | 'test';

interface RunResult<T = unknown> {
  runId: string;
  graphId: string;
  graphVersion: string;
  status: 'completed' | 'failed' | 'blocked';
  output?: T;
  error?: VictError;
  trace: RunEvent[];
}
```

Exact names may change for TypeScript quality, but the concepts must remain recognizable and documented.

---

## 10. Graph compilation and identity

Compilation must produce an immutable compiled graph or a structured rejection.

Validate at minimum:

- Non-empty graph ID.
- Exactly one valid selected entry for this milestone.
- Unique node IDs.
- Known capability IDs at activation time.
- Edges referencing existing nodes.
- No duplicate semantically identical edges.
- Valid success/error edge kinds.
- At most one outgoing success edge per node for Night 01 sequential semantics, unless a deterministic existing design cleanly supports more.
- At most one outgoing error edge per node.
- Unsupported cycles or potentially unbounded execution.
- Known adjacent contract incompatibility where it can be determined statically.

Return stable structured error codes, affected IDs, and messages.

Graph activation is atomic: if compilation or activation fails, the currently active graph remains unchanged.

Compute or assign a stable `graphVersion` for every compiled graph. Prefer a deterministic content hash derived from a canonicalized semantic definition. Whitespace or object key insertion order must not change the version. Document the versioning method and test its determinism.

Do not implement a persistent graph-version store or change sets tonight.

---

## 11. Deterministic kernel execution

Implement sequential execution first and implement it completely.

The executor must:

1. Create a unique run ID.
2. Pin the run to the active compiled graph ID/version.
3. Validate entry input against the entry capability contract.
4. Invoke capabilities through the runtime-supplied port.
5. Validate each capability output before routing it.
6. Route the validated output through the success edge.
7. Convert failures into a structured error signal for an explicit error edge.
8. Terminate honestly when no error edge exists.
9. Enforce a maximum step count even when compilation rejects cycles.
10. Return final output, status, and trace.

Execution order and event order must be stable for the same graph and deterministic capabilities.

An object containing an `error` property is not automatically a failure. Failure must be represented through an explicit result/error mechanism, not guessed from arbitrary domain payloads. The deterministic assistant integration should translate provider failures into this explicit mechanism.

---

## 12. Trace and observability

Define a discriminated `RunEvent` union covering at minimum:

- `run.started`
- `node.started`
- `node.completed`
- `node.failed`
- `contract.rejected`
- `signal.routed`
- `effect.blocked`
- `run.completed`
- `run.failed`
- `run.blocked`

Every applicable event includes:

- Run ID.
- Graph ID and version.
- Sequence number.
- Timestamp.
- Node ID where applicable.
- Duration where applicable.
- Safe structured diagnostic metadata.

Event order must be reconstructable without relying on timestamp precision; use a monotonically increasing per-run sequence.

Do not record complete payloads by default. Provide summaries or explicitly redacted diagnostic data. Add at least one test proving an obvious secret field is not copied into trace metadata.

For Night 01, traces may be held in memory and returned with the run result.

---

## 13. Effect policy and safe simulation

This is non-negotiable.

The runtime must enforce execution policy based on both `ExecutionMode` and `EffectClass`.

Default policy:

| Effect | Normal | Simulate | Isolated test |
|---|---|---|---|
| `pure` | Real implementation | Real implementation | Real implementation |
| `read` | Real implementation | Test double required | Test double required |
| `write` | Real implementation | Test double required | Test double required |
| `irreversible` | Real implementation only when explicitly allowed by caller policy | Test double required | Test double required |

For this milestone, normal irreversible execution should be denied unless the caller explicitly supplies an allow policy. This prepares for later human approval without implementing the control plane.

When a required test double is absent:

- Do not invoke the real capability.
- Return a structured blocked result.
- Emit `effect.blocked` and `run.blocked` or the isolated-test equivalent.
- Include the capability ID, effect class, and remediation in safe diagnostics.

An isolated node test must not:

- Traverse outgoing graph edges.
- Mutate shared application state.
- Write to the production run repository/event stream.
- Invoke unmocked external I/O.

Add regression tests with spies/counters that fail unmistakably if a dangerous real implementation is called.

---

## 14. Deterministic ARA proof

Implement a checked-in example with no credential or network requirement.

Suggested graph:

```text
user-message
  → prepare-context
  → deterministic-assistant
  → assistant-response
```

Suggested contracts:

```ts
UserMessage      = { text: string }
PreparedContext  = { text: string; context: string[] }
AssistantMessage = { role: 'assistant'; text: string }
```

Minimum input:

```json
{
  "text": "Help me make this practical"
}
```

Minimum output shape:

```json
{
  "role": "assistant",
  "text": "..."
}
```

The response text may be deterministic and simple. The proof is about Vict orchestration, contracts, effects, execution, and trace—not AI quality.

If a real model adapter is added, it must be optional, isolated outside the kernel, and unused by normal verification. Do not make provider installation part of Night 01 unless it is trivial and does not displace mandatory work.

Provide one documented command that executes the example and prints:

- Final structured response.
- Run ID.
- Graph version.
- Ordered event summary.

No frontend is required.

---

## 15. Mandatory test matrix

Use the selected test framework and keep all tests deterministic and offline.

### Contracts

- Valid input parses successfully.
- Invalid input returns structured issues.
- Issue paths identify nested fields correctly where supported.
- Public API does not leak the underlying schema library's error type.

### Compilation

- Valid graph compiles.
- Graph version is deterministic across semantically identical definitions.
- Duplicate node fails.
- Missing entry fails.
- Missing capability fails activation.
- Edge to missing node fails.
- Duplicate edge fails.
- Unsupported cycle fails.
- Obvious adjacent contract incompatibility fails where statically knowable.
- Failed activation preserves the previous active graph.

### Execution

- Three-node pure graph executes in stable order.
- Input contract failure prevents invocation.
- Output contract failure prevents downstream routing.
- Explicit error edge receives a structured error signal.
- Unhandled error produces failed run status.
- Maximum-step protection terminates runaway execution.
- Event sequence numbers are strictly increasing.
- Final event matches final run status.
- Graph ID/version remain constant throughout a run.

### Effect safety

- Pure capability runs in simulation.
- Read capability without a double is blocked.
- Read capability with a double invokes only the double.
- Write capability without a double is blocked.
- Write capability with a double invokes only the double.
- Irreversible capability is blocked in simulation/test regardless of ordinary runtime permission.
- Irreversible normal execution is blocked without explicit allow policy.
- Isolated test does not traverse downstream.
- Isolated test does not publish into normal run history.

### Trace safety

- Secret-like fields are not present in trace diagnostics.
- Contract errors remain useful after redaction.

### ARA proof integration

1. Register deterministic capabilities.
2. Compile and activate the ARA graph.
3. Execute one user message.
4. Confirm the assistant output contract.
5. Confirm expected ordered nodes.
6. Confirm completed run status and terminal event.
7. Confirm graph version in all events.

### Public-surface smoke test

Exercise the actual public SDK/runtime imports from outside package internals. Do not prove the system only through private classes.

---

## 16. Quality and performance verification

Provide root scripts for the repository's applicable checks. Run them before completion:

```text
format check
lint
typecheck
unit tests
integration tests
full test suite
package build
ARA example
benchmark
```

Fix failures caused by this implementation. Record verified pre-existing environmental failures separately, with evidence.

### Performance baseline

Add a small benchmark for repeated execution of the deterministic pure ARA graph or an equivalent three-node pure graph.

- Exclude install, process startup, filesystem discovery, network, and model latency.
- Warm up before measurement.
- Record runtime version, platform, iteration count, median, and p95.
- Do not add a flaky wall-clock assertion to the normal test suite.
- Investigate accidental delays, repeated compilation, unnecessary serialization, or excessive copying.

Compilation should happen at activation, not on every conversational execution.

---

## 17. Priority ladder

Continue in this order. Do not begin a lower priority while a higher one is broken.

### P0 — Safe greenfield initialization

- Confirm target and optional legacy paths.
- Read target instructions.
- Preserve existing target changes.
- Select and record toolchain.
- Initialize workspace and root quality scripts.

### P1 — Contracts and compiled graph

- Implement `@vict/contracts`.
- Implement graph definitions and compiler in `@vict/kernel`.
- Structured validation errors.
- Deterministic graph version.
- Atomic activation foundation.

### P2 — Kernel execution and trace

- Deterministic sequential executor.
- Contract enforcement.
- Success/error routing.
- Runaway bound.
- Ordered safe events.

### P3 — Runtime safety

- Capability registry.
- Execution modes.
- Effect policy.
- Test doubles.
- Isolated node test.
- Atomic active-graph behaviour.

### P4 — SDK and ARA proof

- Stable public authoring facade.
- Deterministic ARA example.
- End-to-end and public-import tests.
- Executable example command.

### P5 — Verification and handoff

- Full quality commands.
- Benchmark.
- Architecture note.
- Night report with evidence.

### Stretch only after P0–P5 pass

- Property-based compiler tests.
- Contract compatibility preflight beyond the obvious cases.
- Pluggable clock/ID source for fully deterministic trace snapshots.
- A second example proving an explicit error path.
- In-memory graph-version catalog, without persistence or change-set APIs.

Do not stretch into HTTP/MCP, a control plane, SQLite/Postgres, Studio, frontend, Builder Agent, healer, playbooks, capability registry, distributed execution, or cloud deployment.

---

## 18. Architecture documentation required

Create `docs/architecture/NIGHT-01-FOUNDATION.md` containing:

- The actual package dependency map.
- The canonical domain concepts implemented.
- Execution lifecycle.
- Simulation/effect policy.
- Public API example.
- Decisions that intentionally differ from legacy Vict.
- Explicitly deferred components.

Keep it concise and derived from running code. Do not write speculative future subsystems in detail.

If `LEGACY_VICT_PATH` was supplied, include a short table:

| Legacy idea inspected | Reused as behaviour | Rejected/reframed | Reason |
|---|---|---|---|

Do not inventory the entire legacy project.

---

## 19. Night report required

Create `docs/nightly/VICT-NIGHT-01-REPORT.md` with this structure:

```markdown
# Vict Night 01 Report

## Outcome
PASS / PARTIAL / BLOCKED

## Paths and initial state
- Target path
- Legacy reference path or none
- Initial target contents and git status

## Toolchain
- Runtime and package-manager versions
- Test/build tools selected

## Implemented
- Behavioural capabilities
- Public API
- Package boundaries

## Files changed
- Grouped by purpose

## Verification evidence
| Command | Exit status | Result | Notes |
|---|---:|---|---|

## Acceptance matrix
| Requirement | Pass/Fail | Evidence |
|---|---|---|

## Performance baseline
- Environment
- Iterations
- Median
- p95

## Autonomous decisions
- Decision
- Reason
- Reversibility and impact

## Legacy concepts consciously rejected
- Concept
- Replacement
- Reason

## Remaining risks or failures
- Exact issue
- Evidence
- Smallest next action

## Recommended Night 02
- One bounded milestone toward durable execution
```

Include exact test counts and command exit statuses where available. Never state that all tests pass unless the relevant command was actually run.

---

## 20. Definition of done

Mark the night `PASS` only if every mandatory statement is true:

- [ ] Target was treated as greenfield; legacy source remained unchanged.
- [ ] No legacy `engine`, `grammar`, or `lang-*` public package architecture was reproduced.
- [ ] Package graph has no cycles.
- [ ] `@vict/contracts`, `@vict/kernel`, `@vict/runtime`, and the public SDK responsibility exist coherently.
- [ ] A valid graph compiles into an immutable representation.
- [ ] Graph version is deterministic.
- [ ] Invalid activation leaves the previous graph active.
- [ ] A deterministic graph executes end to end.
- [ ] Input and output contracts are enforced.
- [ ] Error routing and unhandled failure semantics are explicit.
- [ ] Runaway execution is bounded.
- [ ] Events are ordered and identify the pinned graph version.
- [ ] Trace diagnostics do not expose tested secret values.
- [ ] Simulation/test cannot invoke unmocked read, write, or irreversible capabilities.
- [ ] Normal irreversible execution requires explicit permission.
- [ ] Isolated node testing does not traverse or pollute normal run history.
- [ ] Deterministic ARA proof passes offline.
- [ ] Public SDK/runtime imports are exercised outside package internals.
- [ ] Format, lint, typecheck, tests, build, example, and benchmark were run where configured.
- [ ] Architecture note and Night 01 report contain evidence.
- [ ] Repository is buildable and unrelated target work is preserved.

If any mandatory box is false, report `PARTIAL`, explain the exact gap, and leave the smallest reliable next step. Honest, coherent partial progress is preferable to a broad but unverified framework.

---

## 21. Final working principles

- This is a greenfield system; design for the strongest model, not legacy compatibility.
- Build the smallest complete semantics before broad features.
- The kernel stays pure.
- Contracts are executable promises.
- Capabilities are typed operations, not language modules.
- The runtime enforces effects; documentation alone is not safety.
- Graphs express meaningful orchestration, not every function call.
- YAML is serialization, not the authoring thesis.
- Compilation is off the conversational hot path.
- A Builder Agent is future control-plane tooling, not part of a normal ARA turn.
- Every abstraction introduced tonight must be exercised by the ARA proof or a mandatory safety test.
- End with executable evidence.

Begin now at `TARGET_VICT_REPO`: inspect safely, initialize the greenfield workspace, and proceed directly through P0–P5.
