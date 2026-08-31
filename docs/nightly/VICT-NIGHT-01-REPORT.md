# Vict Night 01 Report

## Outcome

**PASS** — every mandatory statement in the handoff's definition of done is
true and backed by a run command or a named test (see Acceptance matrix).

## Paths and initial state

- **Target path:** `C:\Users\RZ1\Desktop\RZ\260831-VCT-02` (confirmed as the
  working repository; treated as greenfield)
- **Legacy reference path:** `C:\Users\RZ1\Desktop\RZ\260518-VCT`
  (read-only; consulted briefly for the legacy table in
  `docs/architecture/NIGHT-01-FOUNDATION.md`)
- **Initial target contents:** only `docs/VICT-OVERNIGHT-HANDOFF-01.md`.
  No package files, no git repository, no other user work.
- **Git:** repository initialized this session (`main`); repo-local identity
  configured (`Vict Overnight Agent <vict-agent@localhost>`); no remote, no
  history rewritten.
- **Legacy integrity:** untouched. Only read operations were performed there
  (`head` on `README.md` and `PRINCIPLES.md`). The legacy worktree's
  pre-existing modifications (`agent`, `docs/plan/phases/26A.md`, `lang-*`)
  carry mtimes of 2026-05-30 and 2026-08-31 18:55–18:56 — hours before this
  session began (~23:37). Evidence: `stat` output captured 2026-09-01 00:38.

## Toolchain

| Tool | Version |
|---|---|
| Node.js | v22.13.1 (installed LTS; recorded) |
| npm | 10.9.2 (workspace-capable package manager) |
| TypeScript | 6.0.3 (strict, ESM, NodeNext) |
| Vitest | 4.1.11 (unit + integration projects) |
| ESLint | 10.9.1 + typescript-eslint 8.68.0 (flat config) |
| Prettier | 3.9.6 |
| tsx | 4.23.13 (example + benchmark runner) |
| zod | ^3.25.76 (internal to `@vict/contracts` only) |

## Implemented

**Behavioural capabilities**

- Typed graph definitions; compilation into an immutable (deep-frozen)
  compiled graph, or a structured rejection with 12 stable issue codes
  (`EMPTY_GRAPH_ID`, `DUPLICATE_NODE`, `MISSING_ENTRY_NODE`,
  `EDGE_REFERENCES_UNKNOWN_NODE`, `DUPLICATE_EDGE`, `MULTIPLE_SUCCESS_EDGES`,
  `MULTIPLE_ERROR_EDGES`, `UNSUPPORTED_CYCLE`, `UNKNOWN_CAPABILITY`,
  `MISSING_CONTRACT`, `CONTRACT_INCOMPATIBLE`, `EMPTY_*` variants).
- Deterministic graph versions: SHA-256 (`v1_<64 hex>`) over a canonicalized
  semantic form (sorted keys, sorted node/edge arrays, `null` for absent
  optionals, `vict.graph@1` marker). Whitespace/key-order/node-order
  insensitive; semantics-sensitive. Tested.
- Deterministic sequential executor: entry-input and per-node
  input/output contract enforcement, capability invocation through ports,
  success routing, structured error-signal routing over explicit error edges,
  honest failure when no error edge exists, hard max-step bound (default 100),
  blocked status for policy denials.
- Complete ordered trace: 10-event discriminated union, monotonic per-run
  `seq`, pinned graph id/version on every event, safe summaries only
  (shape/length/key-names; secret-like key names redacted; values never).
- Effect policy: `pure/read/write/irreversible` × `normal/simulate/test`
  matrix exactly as specified; test doubles; blocked results with remediation;
  irreversible normal execution denied without explicit
  `policy.allowIrreversible`.
- Atomic graph activation (failed compile keeps previous graph active).
- Isolated node testing (`runNode`): single node, mode forced `test`, no edge
  traversal, no repository writes, no policy overrides permitted.
- In-memory run repository (`list`/`get`).
- Deterministic, offline ARA proof + executable demo command.

**Public API** (`@vict/sdk`): `defineContract`, `defineCapability`,
`defineGraph`, `createRuntime`, `VictRuntime`, `errorSignalContract`,
`victError`, `createInMemoryRunRepository`, `decideEffectAuthorization`, and
the public type vocabulary. Applications do not need kernel internals.

**Package boundaries**: `contracts ← kernel ← runtime`, SDK layered on top,
no cycles, `@vict/contracts` depends only on zod, kernel does no I/O, runtime
contains no ARA logic, example code lives in `examples/ara-proof`.

## Files changed

Grouped by purpose (all inside `TARGET_VICT_REPO`):

- **Root scaffold**: `package.json`, `tsconfig.base.json`, `tsconfig.json`,
  `vitest.config.ts`, `eslint.config.js`, `.prettierrc.json`,
  `.prettierignore`, `.gitignore`, `README.md`, `package-lock.json`
- **@vict/contracts**: `package.json`, `tsconfig.json`,
  `src/{index,types,define-contract,error}.ts`,
  `test/contracts.test.ts`
- **@vict/kernel**: `package.json`, `tsconfig.json`,
  `src/{index,types,errors,canonical,compile,execute,summarize,testing}.ts`,
  `test/{compile,execute}.test.ts`
- **@vict/runtime**: `package.json`, `tsconfig.json`,
  `src/{index,types,errors,effect-policy,repository,registry,runtime}.ts`,
  `test/{runtime,effects}.test.ts`
- **@vict/sdk**: `package.json`, `tsconfig.json`,
  `src/{index,authoring}.ts`, `test/sdk.test.ts`
- **ARA proof example**: `examples/ara-proof/package.json`, `tsconfig.json`,
  `src/{main,ara,contracts,capabilities,assistant,graph}.ts`,
  `test/public-surface.test.ts`
- **Benchmark**: `scripts/benchmark.ts`
- **Docs**: `docs/architecture/NIGHT-01-FOUNDATION.md`, this report,
  `docs/VICT-OVERNIGHT-HANDOFF-01.md` (pre-existing, preserved)

## Verification evidence

All commands run from the repository root on 2026-09-01. Exit statuses are
from the final full pass (the same commands were run multiple times during
development; failures encountered early were fixed, never suppressed).

| Command | Exit status | Result | Notes |
|---|---:|---|---|
| `npm run format:check` | 0 | All files prettier-clean | |
| `npm run lint` | 0 | 0 errors, 0 warnings | `no-explicit-any` is an error rule |
| `npm run typecheck` | 0 | strict TS over src + tests + example + scripts | |
| `npx vitest run --project unit` | 0 | 6 files, **65/65 tests pass** | kernel/runtime/contracts/sdk |
| `npx vitest run --project integration` | 0 | 1 file, **4/4 tests pass** | ARA proof + public-surface |
| `npm test` | 0 | 7 files, **69/69 tests pass** | all deterministic and offline |
| `npm run build` | 0 | all 4 packages emit `dist/` | ordered: contracts → kernel → runtime → sdk |
| `npm run example` | 0 | prints final response, run id, graph version, 13 ordered events | fully offline |
| `npm run bench` | 0 | median 0.031 ms/run | see below |

## Acceptance matrix

| Requirement | Pass/Fail | Evidence |
|---|---|---|
| Target treated as greenfield; legacy unchanged | PASS | Initial tree contained only the handoff; legacy mtimes predate session (see Paths) |
| No legacy `engine`/`grammar`/`lang-*` architecture reproduced | PASS | Package map is contracts/kernel/runtime/sdk; `docs/architecture/NIGHT-01-FOUNDATION.md` legacy table |
| Package graph has no cycles | PASS | Ordered build `contracts → kernel → runtime → sdk` succeeds; no lower package imports a higher one |
| Contracts/kernel/runtime/SDK exist coherently | PASS | `npm run build` + public API exercised from `@vict/sdk` only |
| Valid graph compiles into an immutable representation | PASS | `compile.test.ts` "compiles a valid graph into an immutable compiled graph" (`Object.isFrozen` on graph, nodeIds, nodes) |
| Graph version is deterministic | PASS | `compile.test.ts` determinism across reordered/reformatted definitions; different semantics → different version |
| Invalid activation leaves previous graph active | PASS | `runtime.test.ts` "preserves the previously active graph when activation fails" |
| Deterministic graph executes end to end | PASS | `npm run example` exit 0; ARA integration tests |
| Input and output contracts enforced | PASS | `execute.test.ts` entry-input rejection (no invocation), output rejection (no downstream routing), accept path |
| Error routing and unhandled failure explicit | PASS | error-edge routing test (handler receives `VictError` signal); no-edge test (`run.failed`); runtime throw tests |
| Runaway execution bounded | PASS | `execute.test.ts` max-steps test via `@vict/kernel/testing` unsafe cyclic graph: fails at step 11 with `VICT_KERNEL_MAX_STEPS_EXCEEDED` |
| Events ordered, pinned graph version | PASS | dense `seq` assertions; every event carries `graphId`/`graphVersion` (ARA test) |
| Trace diagnostics do not expose tested secrets | PASS | kernel + runtime redaction tests: secret values absent from serialized traces; secret-like key names become `[redacted]` |
| Simulation/test cannot invoke unmocked read/write/irreversible | PASS | `effects.test.ts` spy-based tests: real implementations never called when blocked |
| Normal irreversible requires explicit permission | PASS | `effects.test.ts`: blocked without `allowIrreversible`, real invoked with it |
| Isolated node testing does not traverse or pollute history | PASS | `effects.test.ts`: second node never invoked; `repository.list()` empty after `runNode` |
| Deterministic ARA proof passes offline | PASS | `npm run example` + 4 integration tests (no network, no credentials, deterministic provider) |
| Public SDK/runtime imports exercised outside package internals | PASS | `sdk.test.ts` and `public-surface.test.ts` import only `@vict/sdk` |
| Format/lint/typecheck/tests/build/example/bench run | PASS | all exit 0 (table above) |
| Architecture note and report contain evidence | PASS | this file + `docs/architecture/NIGHT-01-FOUNDATION.md` |
| Repository buildable; unrelated work preserved | PASS | build exit 0; handoff doc untouched; no other target work existed |

## Performance baseline

- **Environment:** Node v22.13.1, Windows 11 Pro (win32 10.0.26200) x64,
  in-process, dependencies installed
- **Graph:** `bench-three-node-pure` (3 pure nodes), compiled once at
  activation, version `v1_c2b26d19601ed3a…`
- **Iterations:** 5,000 measured (1,000 warm-up discarded)
- **Total:** 202.2 ms
- **Median:** 0.031 ms/run
- **p95:** 0.064 ms/run
- (mean 0.040 ms, min 0.018 ms, max 5.331 ms — max is first-measured-run JIT
  noise, not a steady-state delay)

No wall-clock assertions exist in the test suite. Investigation notes: each
run validates two contracts, emits 4 events, and appends one repository
record; no repeated compilation, serialization, or deep copying was found on
the hot path.

## Autonomous decisions

| Decision | Reason | Reversibility / impact |
|---|---|---|
| npm workspaces instead of pnpm | Handoff prefers pnpm, but `corepack enable` failed (`EPERM` writing to `C:\Program Files\nodejs`); npm is workspace-capable and preinstalled | Low: swap to pnpm later by adding `pnpm-workspace.yaml`; package.json files are already pnpm-compatible |
| TypeScript 6.0.3 with `types: ["node"]`; `baseUrl` removed | Latest stable via `npm i -D typescript@latest`; TS6 deprecates `baseUrl` (TS5101) and no longer auto-includes @types in package builds (TS2591) | Low: config-only |
| zod as the internal schema library of `@vict/contracts` | Handoff explicitly permits "a small adapter around an established schema library"; avoids inventing a schema DSL | Medium: zod is hidden behind `Contract`/`ContractResult`; adapter is ~120 lines |
| `received` issue field is a type-shape description (e.g. `string(12)`), never the value | Secret-safety requirement; zod's own `received` can embed values on literal mismatches | None: strictly safer; issues remain actionable (code/path/message/expected) |
| Static adjacent-contract compatibility is identity-based | Without structural type information, honest static checks are limited; unknown sides pass, mismatched ids fail | Low: `ContractEnvironment.isCompatible` is a port; structural rules can slot in later |
| Error edges skip static compatibility checking | Error edges carry the universal `vict.error-signal`, not the source node's output contract; handlers are validated at execution time | Low: documented in architecture note |
| `@vict/kernel/testing` subpath with `unsafeCompiledGraphForTesting` | Mandatory max-step test needs a cyclic compiled graph the compiler would reject; isolates the capability from product code | Low: separate export, clearly documented as test-only |
| Kernel uses `node:crypto` (SHA-256, randomUUID defaults) | Standard library, deterministic hashing, no I/O; purity preserved (all injectable via ports) | Low: replaceable with a pure hash if browser-neutral kernel is ever needed |
| Policy denials → `blocked`; contract/data failures → `failed` | Matches handoff's blocked semantics (effect-related) and honest-failure semantics | Low: status mapping is centralized |
| Explicit ordered build script (not project references) | Simpler and transparent; packages resolve cross-package types via installed workspace links | Low |
| Single root vitest config with `unit`/`integration` projects; workspace names alias to TS source | Tests exercise source without requiring a prior build; build verified separately | Low |
| Initialized git + repo-local identity; committed in coherent checkpoints | Handoff authorizes local commits; no repository policy existed | Low: history is additive, nothing rewritten |

## Legacy concepts consciously rejected

| Concept | Replacement | Reason |
|---|---|---|
| `@vict/engine` + grammar plug slots (Validator/Processor/Editor) | Kernel with compile/execute semantics and explicit ports | Semantics belong to the kernel; plugs become ports and contracts |
| `@vict/grammar` + YAML blueprints as primary authoring | Typed TS authoring via `@vict/sdk`; YAML deferred | Type-checked authoring; YAML is serialization, not the thesis |
| `lang-app` / `lang-ai` / `lang-space` language modules | Capabilities (+ future capability packs) | Ordinary integrations are typed operations, not languages |
| Four engine delivery modes | One deterministic sequential algorithm + `normal/simulate/test` policy modes | Determinism first; mode is policy, not traversal shape |
| `ShapeChecker` wire validation | Executable contracts enforced at execution boundaries | Data promises with structured, safe issues |
| Live-edit `EditorSystem` | Atomic activation now; change sets/control plane later | Governance needs intent, not Night 01 machinery |
| Healer autonomous subsystem | Not built (explicitly deferred) | Recovery is a control-plane concern |
| `kit-svelte` app layer | Not built | No UI tonight |

## Remaining risks or failures

| Issue | Evidence | Smallest next action |
|---|---|---|
| Static contract compatibility is identity-based; two structurally identical contracts with different ids are rejected as incompatible | `CONTRACT_INCOMPATIBLE` code; architecture note documents it | Add a structural-compatibility preflight over contract summaries in `ContractEnvironment.isCompatible` |
| Custom zod messages are copied verbatim into issues; a hand-written message could embed a received value | Default zod messages verified safe by tests; custom messages are schema-author responsibility | Add a scrubbing pass or document an authoring rule in `defineContract` |
| Kernel defaults use `node:crypto`/`Date.now` (not fully deterministic traces by default) | `execute.ts` system clock/id factories | Implement the stretch item: pluggable clock/id source for deterministic trace snapshots |
| Nothing enforces dependency direction mechanically | Ordered build + review discipline only | Add `dependency-cruiser` (or equivalent) rule to lint |
| npm hoists dependencies, so an undeclared import could still resolve locally | `package.json` dependency lists are hand-maintained | Add a publint/isolated-install check to CI |
| Git emits CRLF→LF warnings on Windows | Commit output warnings | Cosmetic; optionally add `.gitattributes` (`* text=auto eol=lf`) |

## Recommended Night 02

**One bounded milestone toward durable execution:** introduce a pluggable
`RunStore` port (same shape as the in-memory repository) with a local
SQLite-backed implementation, plus a graph-version catalog keyed by the
already-deterministic `graphVersion` — no change sets, no control plane, no
server. Runs, events, and graph versions become restart-survivable while the
public API stays identical. Include migration of the existing in-memory
repository to the new port and keep every test offline and deterministic
(uses `node:sqlite`, which ships with the installed Node 22 LTS).
