# Vict Night 01.1 Finalization Report

## Outcome

**PASS** — all six mission areas are implemented, every mandatory regression
test passes (105/105), every verification command succeeds (exit 0), and the
isolated packed-package consumer check proves the new contract-API boundary.

Scope guard honoured: no SQLite, no durable persistence, no HTTP/MCP, no
control plane, no Builder Agent, no UI, no playbooks, no Night 02 work.

## Implemented

**Activation identity (3 layers).** Introduced `capabilitySetVersion`
(SHA-256 over the effective capability/contract bindings required by the
graph: capability id + revision + effect class + effective input/output
contract id + revision, per resolved node, canonically sorted and
deduplicated) and `activationVersion` (hash over graphVersion +
capabilitySetVersion + activation schema marker `vict.activation@1`).
`graphVersion` is unchanged in form and value (the ARA proof produces the
identical `v1_d724b3bd…` as Night 01) and is now documented as
topology/declaration identity only. Capability descriptors carry
`revision`, `inputRevision`, `outputRevision`; every run and every event
identifies graph id + all three versions. Revisions are mandatory,
author/build-owned strings validated with structured errors at
`defineContract`/registration time (`ContractDefinitionError`,
`VICT_RUNTIME_INVALID_REVISION`, `VICT_RUNTIME_INVALID_CONTRACT`). Function
bodies, zod internals, memory addresses, timestamps and insertion order are
never hashed.

**Immutable activation snapshot.** `runtime.activate()` now captures a frozen
snapshot of the compiled graph plus frozen copies of the execution-relevant
capability bindings (invoke reference, revision, effect class) and the
contracts the graph requires. Runs execute against the snapshot — never the
live registry. Post-activation definition mutation, post-activation
registration, and mid-run registry changes cannot affect an active graph or an
in-flight run; explicit `activate()` re-captures updated registry state under
a new activation identity when revisions/effect classes/contracts changed.
Internal maps are not exposed; descriptors are rebuilt per consumer.

**Run-level double snapshot + explicit replacement.** Each run snapshots the
doubles map at run start: replacing or registering a double mid-run affects
only later runs. `registerDouble` now rejects duplicates; `replaceDouble`
performs explicit replacement (and rejects when nothing is registered).

**Run-record payload policy.** New `PayloadRetention` = `'none' | 'summary' |
'full'`, configured per runtime (`payloadRetention`, default `'summary'`).
Stored `RunRecord`s contain metadata + trace (always safe) + sanitised error +
safe output summary by default; the complete validated output is retained only
under explicit `'full'`. The caller-facing `RunResult.output` always carries
the real output. `RunRecord` carries a `retention` field and typed optional
fields so the retention distinction is visible at the type boundary — the same
boundary a future `RunStore` would implement.

**Error sanitisation.** Capability-thrown and double-thrown errors no longer
copy `cause.message` anywhere: the runtime retains the stable code
(`VICT_RUNTIME_CAPABILITY_THREW` / `VICT_KERNEL_PORT_FAILURE`), capability and
node ids, a safe framework-generated message, the error class name
(`errorName`), and a correlation id (`errorId`). The kernel's port-failure
path is sanitised identically. Contract issues now carry framework-generated
messages (code/path/expected/safe-received); schema-library messages are never
copied into `message` and appear only as `issue.safeMessage` when the author
explicitly opts in via `trustSchemaMessages` (documented as author-controlled
content).

**Neutral contract API + optional Zod adapter.** `defineContract` now takes a
neutral definition object (`{ id, revision, expected?, parse }`) and returns a
frozen `Contract`. The base `@vict/contracts` (including `errorSignalContract`,
now a hand-written neutral parser) contains **zero** zod imports; base emitted
`.d.ts`/`.js` contain **zero** zod type/module references (verified by scan
and by strict tsc of a consumer with no zod installed). Zod convenience moved
to optional subpaths `@vict/contracts/zod` and `@vict/sdk/zod` (zod as an
optional peer dependency). Zod issues still map to neutral safe issues. The
ARA example explicitly imports the adapter (`@vict/sdk/zod`).

**Safe irreversible testing preserved and pinned.** Behaviour is unchanged:
irreversible normal execution requires explicit `policy.allowIrreversible`;
in simulate/test the real irreversible implementation is unreachable; a
registered safe double may run; without a double the node is blocked. A
permanent regression test asserts the double runs once while the real
implementation's spy stays at zero.

## Version model

```text
graphVersion         = hash(graph topology + declaration: id, entry, nodes,
                            capability references, contract override
                            references, edges)          — topology ONLY
capabilitySetVersion = hash(per-node effective bindings: capability id +
                            revision + effect + effective input/output
                            contract id + revision; sorted, deduplicated)
activationVersion    = hash(graphVersion + capabilitySetVersion +
                            'vict.activation@1')
```

Verified: identical inputs → identical versions across runtimes; topology,
capability revision, contract revision and effect-class changes each move
exactly the layers they should; binding/registration order does not affect
versions; capabilities not required by the graph do not contribute.

## Snapshot semantics

| Frozen | When |
|---|---|
| Compiled graph (topology, adjacency, effective contract ids, three versions) | `activate()` |
| Capability bindings (invoke reference, revision, effect class) | `activate()` (frozen copies) |
| Required contracts (references) | `activate()` |
| Test doubles | run start (per run) |

In-flight runs observe none of: registry registration, definition-object
mutation, effect-class mutation, double registration/replacement. Explicit
`activate()` re-captures the registry; identity changes only when
execution-relevant metadata changed.

## Payload and error policy

| Data | Caller (`RunResult`) | Trace | Stored `RunRecord` (default `'summary'`) |
|---|---|---|---|
| Validated output | actual value | shape/length/key-name summary, secret-like keys redacted | summary only (`output` only under `'full'`) |
| Input values | n/a | never | never |
| Thrown error message | never | never | never (code + ids + `errorName` + `errorId` + safe message) |
| Contract issue messages | framework-generated | framework-generated | framework-generated (`safeMessage` only on explicit opt-in) |
| Structured error (`VictError`) | sanitised | sanitised | sanitised, retained |

## Contract API

- **Neutral base (no zod anywhere):** `defineContract({ id, revision,
  expected?, parse })` in `@vict/contracts` / `@vict/sdk`.
- **Optional adapter:** `defineZodContract(id, revision, schema, options?)`
  in `@vict/contracts/zod` / `@vict/sdk/zod`; zod is an **optional peer
  dependency** of both packages.
- **Proof:** `npm run verify:consumer` packs all four packages, installs them
  into an isolated consumer **without zod**, type-checks it with strict
  TypeScript against the packed declarations (`skipLibCheck: false`), and
  runs it; a second consumer installs zod and exercises the adapter subpath.
  A declaration scan confirms zero zod type/module references in base
  artifacts.

## Files changed

Grouped by purpose:

- **Neutral contracts + revisions:** `packages/contracts/src/{types,define-contract,errors,error,issue-mapping,index}.ts` (new: `errors.ts`, `issue-mapping.ts`), `packages/contracts/src/zod/{index,define-zod-contract}.ts` (new subpath), `packages/contracts/package.json` (zod → optional peer, `./zod` export)
- **Activation identity (kernel):** `packages/kernel/src/{types,canonical,compile,execute,testing,index}.ts` (canonical.ts gains capability-set/activation hashes; compile computes layered identity; executor envelope + sanitised port failures)
- **Snapshot runtime:** `packages/runtime/src/{types,errors,registry,runtime,effect-policy,index}.ts` (activation snapshot, run-scoped doubles, `replaceDouble`, retention policy, sanitised capability failures)
- **SDK:** `packages/sdk/src/{index,zod}.ts`, `packages/sdk/package.json` (neutral re-exports, `./zod` subpath, optional peer)
- **Example/benchmark:** `examples/ara-proof/src/{contracts,capabilities,ara,main}.ts`, `scripts/benchmark.ts` (adapter usage, revisions, full identity in demo output)
- **Regression tests (new):** `packages/kernel/test/activation-identity.test.ts`, `packages/contracts/test/{neutrality,zod-adapter}.test.ts`, `packages/runtime/test/{snapshot,payload-retention,error-sanitization,bench-semantics}.test.ts`
- **Regression tests (updated):** `packages/contracts/test/contracts.test.ts`, `packages/kernel/test/{compile,execute}.test.ts`, `packages/runtime/test/{runtime,effects}.test.ts`, `packages/sdk/test/sdk.test.ts`, `examples/ara-proof/test/public-surface.test.ts`
- **Verification tooling:** `scripts/isolated-consumer-check.mjs` (new, also `npm run verify:consumer`)
- **Docs:** `docs/architecture/NIGHT-01-FOUNDATION.md` (corrected in place), `docs/nightly/VICT-NIGHT-01-REPORT.md` (historical text preserved; clearly-labelled post-audit amendment appended), `README.md`, this report
- **Toolchain config:** root `package.json` (`verify:consumer` script, zod dev dependency), `eslint.config.js` (Node globals for `.mjs`), `vitest.config.ts` + `tsconfig.json` + example `tsconfig.json` (zod-subpath resolution)

## Verification evidence

All commands run from the repository root, final pass, 2026-09-01.

| Command | Exit status | Result |
|---|---:|---|
| `npm run format:check` | 0 | prettier-clean |
| `npm run lint` | 0 | 0 errors, 0 warnings |
| `npm run typecheck` | 0 | strict TS over all src + tests + example + scripts |
| `npx vitest run --project unit` | 0 | 13 files, **101/101 tests pass** |
| `npx vitest run --project integration` | 0 | 1 file, **4/4 tests pass** |
| `npm test` | 0 | 14 files, **105/105 tests pass** (Night 01: 69 → Night 01.1: 105, +36) |
| `npm run build` | 0 | all 4 packages emit `dist/`, including `contracts/dist/zod` and `sdk/dist/zod.js` |
| `npm run verify:consumer` | 0 | 4 packed tarballs; neutral consumer without zod type-checks (strict, `skipLibCheck: false`) and runs; zod consumer exercises `@vict/sdk/zod`; zero zod type/module references in base artifacts |
| `npm run example` | 0 | deterministic ARA proof: 13 events, graphVersion `v1_d724b3bd…` unchanged from Night 01, capabilitySetVersion + activationVersion printed |
| `npm run bench` | 0 | 5000 iterations (+1000 warm-up), median 0.036 ms/run, p95 0.071 ms/run, total 241.5 ms |

## Regression matrix

| Requirement | Pass/Fail | Evidence |
|---|---|---|
| Same graph + same revisions → same activation version | PASS | `activation-identity.test.ts` "identical versions"; runtime-level identity test in `runtime.test.ts` |
| Different topology → different graph + activation versions | PASS | `activation-identity.test.ts` "different topology" (capabilitySetVersion unchanged, as designed) |
| Different capability revision → different capability-set + activation versions | PASS | `activation-identity.test.ts` "different capability revision" |
| Different contract revision → different capability-set + activation versions | PASS | `activation-identity.test.ts` "different contract revision" |
| Different effect class → different capability-set + activation versions | PASS | `activation-identity.test.ts` "different effect class" |
| Property/insertion order does not affect versions | PASS | `activation-identity.test.ts` "binding order"; graph-level order test in `compile.test.ts` |
| Post-activation capability mutation does not affect execution | PASS | `snapshot.test.ts` "post-activation mutation" (effect + invoke mutated; run unchanged, same activationVersion) |
| Post-activation registry replacement/registration does not affect execution | PASS | `snapshot.test.ts` "post-activation registration" |
| Explicit reactivation captures the new definition | PASS | `snapshot.test.ts` "explicit reactivation" (new capabilitySet/activation versions; simulate now blocks) |
| Mid-run registry change does not affect an in-flight run | PASS | `snapshot.test.ts` "mid-run double registration" (blocked; later run uses the double) |
| Mid-run test-double replacement does not affect an in-flight run | PASS | `snapshot.test.ts` "mid-run double replacement" (A answers in-flight, B answers later runs) |
| Default retained record contains no full output | PASS | `payload-retention.test.ts` (no `output` property; summary only; serialized record lacks secret) |
| Explicit full retention stores output only when selected | PASS | `payload-retention.test.ts` (`'none'`/`'summary'`/`'full'` matrix) |
| Capability-thrown secret absent from trace/default history | PASS | `error-sanitization.test.ts` (unique secret in thrown message; absent from trace, error, record) |
| Custom Zod-message secret absent from trace/default history | PASS | `error-sanitization.test.ts` "custom schema messages"; adapter default proven in `zod-adapter.test.ts` |
| Nested secret values absent | PASS | `error-sanitization.test.ts` (nested output secret; failing-input secret; error-cause secret) |
| Returned successful `RunResult.output` remains usable | PASS | `payload-retention.test.ts` (actual output present under all retention modes) |
| Neutral contract works without Zod | PASS | `contracts.test.ts` (hand-written parsers); isolated consumer (no zod installed) type-checks and runs |
| Base emitted declarations contain no Zod references | PASS | `neutrality.test.ts` (source scan); `verify:consumer` declaration scan (dist) |
| Optional Zod adapter works | PASS | `zod-adapter.test.ts`; zod consumer in `verify:consumer` |
| Zod errors become neutral safe issues | PASS | `zod-adapter.test.ts` (plain objects, framework messages, type-shape `received`, no `ZodError` instances) |
| Irreversible isolated test: registered double runs, real implementation untouched | PASS | `effects.test.ts` "registered safe double… real implementation stays untouched" (double×1, real×0) |
| Irreversible normal execution requires explicit permission | PASS | `effects.test.ts` (blocked without `allowIrreversible`, real only with it) |
| Irreversible simulate/test never invokes the real implementation | PASS | `effects.test.ts` + poison-spy assertions across the matrix |
| ARA proof remains deterministic and offline | PASS | `npm run example` exit 0; identical graphVersion to Night 01; integration tests |
| ARA trace remains 13 events | PASS | `public-surface.test.ts` asserts `trace.length === 13`; example prints 13 events |
| Three-node benchmark semantics remain 10 events | PASS | `bench-semantics.test.ts` asserts the exact 10-event sequence |
| All previous Night 01 tests continue passing | PASS | 105/105 (supersets of the original 69, updated for the new APIs) |

## Compatibility decisions

Intentional breaking changes to the pre-persistence internal surface (all
call sites in this repository updated; the system is pre-1.0 and unpublished):

1. `defineContract(id, schema, options)` → `defineContract({ id, revision,
   expected?, parse })`. Zod authoring moves to `defineZodContract` from the
   optional `@vict/contracts/zod` / `@vict/sdk/zod` subpaths.
2. `Contract` and `CapabilityDefinition` now require a non-empty `revision`.
3. `CompiledGraph.version` renamed to `graphVersion`;
   `capabilitySetVersion`/`activationVersion` added to compiled graphs, run
   outputs, events, records, activation results, and invocation contexts.
4. `registerDouble` rejects duplicates; `replaceDouble` added.
5. `createRuntime` accepts `payloadRetention`; stored `RunRecord`s no longer
   contain complete outputs by default (this is the point of the policy).
6. Sanitised failure errors no longer embed raw thrown messages (new
   `errorName`/`errorId` diagnostics instead).
7. Capability-registration validation errors now use dedicated codes
   (`VICT_RUNTIME_INVALID_CAPABILITY`, `VICT_RUNTIME_INVALID_REVISION`,
   `VICT_RUNTIME_INVALID_CONTRACT`) instead of reusing the duplicate-
   capability code (audit Low finding).
8. Graph issue codes remain exactly 13 (no codes added or removed).

## Remaining risks

- **Effect classification is a trust boundary** (audit, informational —
  accepted and now documented in the foundation): a capability labelled
  `pure` could still perform I/O; Vict cannot detect mislabelling.
- **Static contract compatibility is still identity-based** (documented,
  deferred): structurally identical contracts with different ids are rejected
  as incompatible at compile time.
- **`safeMessage` is author-controlled content** when
  `trustSchemaMessages: true`: by design it can contain anything the schema
  author wrote; default paths never populate it.
- **Snapshot depth:** capability bindings are shallow-frozen copies (invoke
  references captured); contract objects are stored by reference. Authors can
  still mutate their own objects' internals — what is pinned is what was read
  at activation, and identity is revision-based, so undetected in-place
  mutation without a revision bump remains possible by construction (same
  trust boundary as effect labels).
- **Benchmark drift:** median moved 0.031 → 0.036 ms/run with retention and
  identity bookkeeping — well within budget, noted for the record.

## Ready for independent verification?

**YES.** The audit's three required pre-persistence corrections are
implemented with adversarial regression coverage; the full verification ladder
and the isolated packed-package consumer check pass from a clean state
(`git status` clean after commit; every command exit 0). The independent
auditor can re-run: `npm ci && npm run build && npm test && npm run
verify:consumer` plus the per-command ladder in the evidence table.
