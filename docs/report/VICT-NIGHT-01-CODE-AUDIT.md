# Vict Night 01 Independent Code Audit

Auditor: independent verification agent. Date: 2026-09-01 (audit session).
Scope: `C:\Users\RZ1\Desktop\RZ\260831-VCT-02` only. The legacy Vict
repository was not inspected or modified. No production source was modified;
no existing test was weakened or deleted; nothing was published or pushed.

## Verdict

**VERIFIED WITH ISSUES**

## Does the original Night 01 PASS remain justified?

**YES WITH QUALIFICATIONS.** Every mandatory item in the handoff's definition
of done verifies as true against observed execution (69/69 tests, all quality
commands exit 0, deterministic offline ARA proof, effect-safety matrix holds
with adversarial "poison" implementations). The qualifications are: several
documentation claims are inaccurate as stated (graph-version semantics,
irreversible isolated-test policy, benchmark event counts, Zod boundary
wording), and two design gaps must be closed **before persistence work**
(execution/version identity; run-record payload policy).

## Executive conclusion

Night 01 is a genuine, working kernel: compilation is atomic and immutable,
execution is deterministic and bounded, the effect-safety matrix held under
every adversarial probe (the real implementation never ran where policy
forbids it), traces are value-free with redacted key names, and the ARA proof
reproduces exactly 13 identically-ordered events across runs. However,
`graphVersion` is a **topology/definition** fingerprint only — the same
version can execute different handler code, different contract schemas, and
different effect classes, because execution reads the **live mutable
registry** rather than an activation snapshot. Zod is embedded in the public
`defineContract` signature and its emitted declaration file. The in-memory
run repository stores **full unredacted outputs and errors**, unlike the safe
traces. Error messages from capabilities and custom contract messages are
recorded verbatim and can carry secrets into traces and history. None of
these breaks Night 01's acceptance criteria, but the first two are blockers
for the recommended Night 02 (SQLite persistence).

## Repository state

| Item | Observed |
|---|---|
| `git status` at audit start | clean, `main` up to date with `origin/main` |
| Recent commits | `9b1792b` Night 01: architecture note, README, and evidence report; `a41b24f` Night 01: verified Vict kernel vertical slice |
| Node / npm | v22.13.1 / 10.9.2 |
| Toolchain (installed, verified) | typescript 6.0.3, vitest 4.1.11, eslint 10.9.1, prettier 3.9.6, tsx 4.23.13, zod 3.25.76 — all match the report |
| Install | `npm ci` (clean, lockfile-based) — exit 0, 0 vulnerabilities |
| Production source changed during audit | **No.** Only untracked temporary adversarial scripts under `audit-tmp/` (deleted after the audit; reproductions preserved in this report) |

## Command evidence

| Command | Exit status | Observed result |
|---|---:|---|
| `npm run format:check` | 0 | All files prettier-clean |
| `npm run lint` | 0 | 0 errors, 0 warnings |
| `npm run typecheck` | 0 | strict TS over src + tests + example + scripts |
| `npx vitest run --project unit` | 0 | 6 files, **65/65 pass** |
| `npx vitest run --project integration` | 0 | 1 file, **4/4 pass** |
| `npm test` | 0 | 7 files, **69/69 pass** (matches report exactly) |
| `npm run build` | 0 | ordered builds; all 4 packages emit `dist/` |
| `npm run example` (×3) | 0 | 13 ordered events, `v1_d724b3bd…`, identical across runs |
| `npm run bench` | 0 | median 0.030 ms/run, p95 0.059 ms/run, 5000 iterations (report claimed 0.031/0.064 — consistent) |

## Architecture verification

Verified from source, manifests, and consumer-style execution against built
`dist/` (the audit's adversarial scripts ran via Node ESM resolution through
package `exports`, not vitest aliases):

- Import graph (grep over all `src/`):
  `@vict/contracts` → `zod` only; `@vict/kernel` → `@vict/contracts` +
  `node:crypto`; `@vict/runtime` → `@vict/contracts` + `@vict/kernel`;
  `@vict/sdk` → contracts + kernel + runtime; `examples/ara-proof` →
  `@vict/sdk` + `zod`. **No cycles; no lower package imports `@vict/sdk`; no
  ARA code in kernel/runtime** (the only `ara` match in runtime is a doc
  comment saying it contains none).
- Kernel purity: no `fs`/`http`/`net`/`dns`/database/provider imports in
  kernel or contracts. The only Node built-in is `node:crypto`
  (`createHash`, `randomUUID`), both injectable via ports.
- Every cross-package import maps to a declared dependency in the importing
  `package.json`. No undeclared (hoisting-hidden) imports were found. The
  report itself flags that nothing enforces this mechanically — confirmed:
  no dependency-cruiser or equivalent is present (informational).
- `npm pack --dry-run` per package: each tarball contains `dist/` with
  `.js`, `.d.ts`, and `.js.map` files; `exports`/`main`/`types` point at
  `dist`. Published contents would be complete. (All packages are
  `private: true`; nothing was published.)
- All packages declare `"files": ["dist"]`; kernels's `./testing` subpath is
  separately exported and documented as test-only.

## Claim matrix

| # | Claim (source) | Verdict | Evidence | Severity |
|---|---|---|---|---|
| 1 | 69 deterministic offline tests pass (report) | **Verified** | 69/69 observed twice (unit 65 + integration 4) | — |
| 2 | No circular package dependencies; contracts ← kernel ← runtime ← sdk (both docs) | **Verified** | Import grep + ordered build + manifest audit | — |
| 3 | Kernel performs no I/O (foundation) | **Verified** | Only `node:crypto`; all env via ports | — |
| 4 | Valid graph compiles into a deeply immutable representation (both docs) | **Verified** | `Object.isFrozen` on graph, `nodeIds`, nodes, `toDefinition()`; original definition mutated after compile → compiled graph unchanged | — |
| 5 | Deterministic version; whitespace/key-order/node-order insensitive (both docs) | **Verified** | Reordered/reformatted/JSON-round-tripped definitions → identical `v1_…` hash | — |
| 6 | "…any semantic change does [change the version]" (foundation) | **False as stated** | Same version observed across: different handler code, different contract schema (same id), different effect class. See Four targeted concerns §1 | **Medium (blocker before persistence)** |
| 7 | 12 stable issue codes (report) | **Minor inaccuracy** | `GraphIssueCode` union has **13** codes (all 13 exercised) | Low |
| 8 | Atomic activation; failure keeps previous graph (both docs) | **Verified** | Existing test re-verified; adversarial: `activeGraph()` unchanged after failed activate; blocked run leaves graph intact | — |
| 9 | Hard max-step bound, default 100, independent of cycle rejection (both docs) | **Verified** | Cyclic `unsafeCompiledGraphForTesting` graph with no `maxSteps`: fails at step 101 after exactly 100 real invocations, `VICT_KERNEL_MAX_STEPS_EXCEEDED`; self-loop also rejected by compiler | — |
| 10 | Full structured rejection with affected identifiers | **Verified** | `DUPLICATE_NODE.nodeIds`, `EDGE_REFERENCES_UNKNOWN_NODE.edge`, `CONTRACT_INCOMPATIBLE.contractIds`, multi-issue aggregation observed | — |
| 11 | Effect matrix normal/simulate (both docs) | **Verified** | Adversarial poison-real tests: pure runs real in simulate; read/write blocked without double, double-only with double; irreversible normal blocked without explicit `allowIrreversible`, real only with it | — |
| 12 | Effect matrix isolated test: irreversible "denied" (foundation table; also `effect-policy.ts` doc comment) | **False as documented** | `runNode` on an irreversible capability **with a registered double runs the double** (`status=completed`, double×1, real×0). Denied only when no double is registered. Matches the handoff ("test double required"), violates the foundation doc | Low (doc/spec deviation; behavior is safe) |
| 13 | Isolated node testing: no traversal, no repository writes, no graph mutation (both docs) | **Verified** | Adversarial: downstream never invoked; `listRuns()` empty after `runNode`; `activeGraph()` unchanged | — |
| 14 | "Payloads are never recorded: outputs are summarized…" (foundation Trace section) | **True for traces, false for run history** | Traces contain only shapes/lengths/key-names (values never, verified with 10 sensitive key variants + nested arrays). But `RunRecord.output` stores the **full validated output** and `RunRecord.error` the full error | **Medium** |
| 15 | "issue mapping guarantees received values are never copied into validation results" (foundation) | **Partial** | `received` field is always a type-shape string (verified incl. literal/enum failures). But schema-author-supplied custom messages are copied verbatim and can embed values (confirmed end-to-end into trace + error + repository; also flagged in the report's own remaining risks) | Medium (security-adjacent) |
| 16 | "Zod types are not exported; schema library is an implementation detail" (foundation) | **Partial / misleading** | No Zod types are *re-exported*, but `defineContract(id, schema: ZodType<T>)` puts `ZodType` in the public signature; emitted `packages/contracts/dist/define-contract.d.ts` line 1 is `import type { ZodType } from 'zod'`. SDK consumers authoring contracts the documented way must install and import zod | Medium |
| 17 | Contract/ContractResult are library-neutral; no Zod error leaks (handoff §8.1, report) | **Verified** | Issues are plain objects (`Object.prototype` proto, no `Error` instance, fixed key set); a hand-rolled `Contract` object with zero zod works end-to-end through the public SDK | — |
| 18 | Error routing: explicit error edge receives structured signal; honest failure without one; error-signal contract for handlers; domain `error` property not misclassified (both docs) | **Verified** | All four adversarially reproduced, including a handler with a non-error-signal input contract failing honestly with `contract.rejected` (input) | — |
| 19 | Events: dense seq, pinned run/graph identity, terminal event matches status (both docs) | **Verified** | Adversarial checks across completed/failed/blocked runs | — |
| 20 | ARA proof: offline, deterministic, 13 events, correct order (both docs) | **Verified** | 3 CLI runs + 2 API runs: identical `v1_d724b3bd…`, identical event order; only run IDs/timestamps vary; expected count `1 + 2×4 + 3 + 1 = 13` matches exactly; empty/missing text fails before any `node.started`; assistant throw fails honestly; output-contract mismatch blocks downstream | — |
| 21 | Benchmark: median ≈0.031 ms, p95 ≈0.064 ms (report) | **Verified** | Reproduced: median 0.030 ms, p95 0.059 ms, 5000 iter, 1000 warmup | — |
| 22 | "Each run validates two contracts, emits 4 events" (report, bench notes) | **False** | Bench graph = 3 nodes / 2 edges → **10 events** (1+6+2+1) and **6 contract validations** per run (measured via `onEvent` on an exact reconstruction). Compilation is genuinely outside the loop (only `activate()` compiles); repository append (1/run) is included; median/p95 arithmetic is sound (median is the upper median; p95 index is one position conservative) | Low |
| 23 | No wall-clock assertions; no network in verification | **Verified** | Grep: none; no fetch/http/axios anywhere in packages/examples/scripts | — |
| 24 | "Compilation happens at activation, never on the conversational hot path" | **Verified** | `compileGraph` called only in `activate()` and `runNode()`; `run()` executes the compiled graph directly | — |

## Adversarial tests

All tests were written for this audit, run via `tsx` against the **built
`dist/` artifacts** (consumer-style resolution), with real implementations
instrumented as loudly-counted spies. Scripts were temporary and removed;
the material reproductions are quoted below.

| Test | Expected | Actual | Result |
|---|---|---|---|
| Deep freeze of compiled graph + immunity to mutation of the original definition | frozen, unchanged | as expected | PASS |
| Self-loop cycle; multiple simultaneous issues with identifiers | `UNSUPPORTED_CYCLE`; aggregated codes + `nodeIds`/`edge`/`contractIds` | as expected | PASS |
| Max-steps default (no `maxSteps`) on a cyclic graph | bounded, honest failure | failed at step 101, 100 invocations, `VICT_KERNEL_MAX_STEPS_EXCEEDED` | PASS |
| Property order + node/edge reorder | same version | identical hash | PASS |
| Change capability id / edge / contract-override id | version changes | changes in all three | PASS |
| **Different contract schema, same contract id** | (audit question) | **same `graphVersion`; A accepts `{n:number}`, B accepts `{n:string}`** | finding |
| **Different handler code, same capability id** | (audit question) | **same `graphVersion`; outputs differ (`original` vs `COMPLETELY DIFFERENT HANDLER CODE`)** | finding |
| **Different effect class, same structure** | (audit question) | **same `graphVersion`; simulate completes vs blocks** | finding |
| **Mutating a registered capability's `effect` after activation** | (audit question) | **next run observes the new class (live registry, no snapshot)** | finding |
| Effect matrix × poison real implementations (8 cells) | real never runs where forbidden | `calls.real === 0` in every forbidden cell | PASS |
| **Irreversible isolated test with registered double** | doc says "denied" | **double runs (`completed`, double×1, real×0)** | doc/spec deviation |
| Blocked simulation leaves active graph intact | unchanged | unchanged; subsequent normal run completes | PASS |
| Domain payload containing `error` property | not a failure | run completes | PASS |
| Error handler with non-error-signal input contract | honest failure | `contract.rejected` (input) → `run.failed` | PASS |
| Terminal event ↔ status; seq dense/unique; runId/graphVersion constant | holds | holds across completed/failed/blocked | PASS |
| **Mid-run `registerDouble` for a not-yet-reached node during a suspended simulate run** | (audit question) | **run completes using the newly registered double** | finding |
| **Mid-run replacement of an existing double** | (audit question) | **`registerDouble` overwrites silently; run uses the replacement** | finding |
| Custom zod message embedding a secret | (audit question) | secret present in `ContractIssue.message`, `contract.rejected` trace event, `VictError.details`, **and the stored run record** | security-adjacent finding |
| 10 sensitive key-name variants (`password`, `Password`, `secret`, `token`, `api-key`, `api_key`, `private-key`, `authorization`, `Authorization`, `credential`) + nested arrays | values absent; names redacted | values absent everywhere; all 10 names → `[redacted]`; nested key names/values never reflected | PASS |
| Capability throws a message containing an input secret | (audit question) | message recorded verbatim in `node.failed`/`run.failed`, `RunResult.error`, and the repository record | security-adjacent finding |
| Repository vs trace safety | (audit question) | trace safe; **`RunRecord.output` holds the full unredacted output** | finding |
| Hand-rolled zod-free `Contract` through the public SDK | works | works (parse success + structured rejection) | PASS |
| ARA: empty/missing text | fail before assistant invocation | failed with zero `node.started` events | PASS |
| ARA: assistant throw / output-contract mismatch | honest failure / detected | `run.failed` (`VICT_RUNTIME_CAPABILITY_THREW`); output rejection blocks downstream | PASS |
| ARA CLI ×2 + API ×2 | identical version + event order; only runId/timestamps vary | identical (`v1_d724b3bd…`, 13 events, same order) | PASS |
| Bench reconstruction instrumented | (audit question) | 10 events, 6 contract validations, 1 repository append per run | report-claim finding |

### Minimal reproductions (preserved)

**R1 — Same `graphVersion`, different executable semantics (blocker before
persistence):**

```ts
import { createRuntime, defineCapability, defineContract, defineGraph } from '@vict/sdk';
import { z } from 'zod';

const graph = () => defineGraph({ id: 'g', entry: 'a', nodes: [{ id: 'a', capability: 'c' }], edges: [] });
const Strict = defineContract('same.id', z.object({ n: z.number() }));
const Loose  = defineContract('same.id', z.object({ n: z.string() }));

const a = createRuntime();
a.registerCapability(defineCapability({ id: 'c', effect: 'pure', input: Strict, output: Strict, invoke: (i) => i }));
const b = createRuntime();
b.registerCapability(defineCapability({ id: 'c', effect: 'pure', input: Loose,  output: Loose,  invoke: () => ({ result: 'different handler code' }) }));

const va = a.activate(graph()), vb = b.activate(graph());
console.log(va.graphVersion === vb.graphVersion);            // true
await a.run({ n: 1 });   // completed — number schema
await b.run({ n: 's' }); // completed — string schema, same handler id, SAME version
// Likewise: same version executes different invoke code, and a capability
// registered as 'irreversible' vs 'pure' yields the same version but
// different policy behaviour. Execution reads the live registry each step,
// so registrations/doubles swapped mid-run (registerDouble overwrites
// silently) are observed by the in-flight run.
```

**R2 — Isolated irreversible testing runs a registered double (doc says
"denied"):**

```ts
const rt = createRuntime();
rt.registerCapability(defineCapability({ id: 'irr', effect: 'irreversible', invoke: real }));
rt.registerDouble('irr', double);
rt.activate(defineGraph({ id: 'g', entry: 'n', nodes: [{ id: 'n', capability: 'irr' }], edges: [] }));
const r = await rt.runNode('n', input);
// r.status === 'completed'; double invoked once; real never invoked.
// Foundation doc table (and effect-policy.ts comment) claim this is "denied".
```

**R3 — Secret-bearing custom contract message reaches trace and history:**

```ts
const SECRET = 'TOPSECRET-9f3c';
const C = defineContract('c', z.object({ token: z.string().refine(
  (v) => v.length > 100, { message: `Auth rejected for token value: ${SECRET}` }) }));
// register as input contract, activate, run({ token: 'short' })
// → ContractIssue.message, contract.rejected event, RunResult.error.details,
//   and runtime.getRun(runId) all contain SECRET.
```

## ARA example verification

- **Graph:** exactly the documented four nodes (`user-message`,
  `prepare-context`, `assistant`, `assistant-response`) and three success
  edges; ARA code exists only under `examples/ara-proof`.
- **Imports:** `@vict/sdk` + `zod` only; no network-capable import anywhere
  in the example (grep), no credentials, deterministic provider function.
- **Output:** satisfies `AssistantMessageContract`; `main.ts` re-validates
  before printing.
- **Determinism:** three CLI runs and two API runs produce the identical
  graph version `v1_d724b3bda1cc484b41c02ea8d8ae5ebb159f1ca6101082c49077d194280b63c0`
  and byte-identical event type/node sequences; only run IDs, timestamps and
  durations vary.
- **Event count:** `1 run.started + 4×2 node events + 3 signal.routed +
  1 run.completed = 13` — the 13 observed events match this formula exactly,
  in the correct order.
- **Failure honesty:** empty text → `VICT_KERNEL_CONTRACT_REJECTED` at the
  entry contract with zero capability invocations (CLI exit 1); assistant
  throw without an error edge → `run.failed`; assistant output-contract
  mismatch → `contract.rejected` (output) with downstream node never started.
- **No ARA logic in kernel/runtime:** confirmed by grep (comment-only match).

## Four targeted concerns

### Execution/version identity
`graphVersion` = SHA-256 over the canonicalized **definition** only (schema
marker, graph id, entry, node ids/capability ids/contract-override ids, edge
triples). It is order- and formatting-insensitive (verified) and it **does
not** fingerprint capability implementations, capability effect classes, or
contract schemas. Activation stores only the compiled graph; every execution
step re-reads descriptors and implementations from the **live mutable
registry** (proven by mid-run registration, mid-run double replacement, and
post-activation mutation of a registered definition object). Therefore the
same `graphVersion` can identify arbitrarily different executable semantics
across processes or even mid-run. Per audit guidance this does not fail
Night 01 (durable execution was deferred), but the foundation's "any semantic
change does [change the version]" is **inaccurate**, and this is a **blocker
before persistence**: a persisted version catalog keyed only on
`graphVersion` could silently replay a run against different handler code or
schemas. Recommendation: keep `graphVersion` (topology) and add a
**`capabilitySetVersion`** (hash over registered capability id + effect +
contract ids + implementation/contract fingerprints) captured into an
**`activationVersion`/application revision at activation**, and have runs pin
the activation snapshot instead of the live registry. All three layers are
warranted; they answer different questions (shape / semantics / what a run
actually bound).

### Zod/public SDK boundary
`Contract<T>`, `ContractResult<T>`, `ContractIssue`, and `VictError` are
genuinely library-neutral, and a zod-free hand-rolled contract works through
the whole runtime (verified). However the *documented authoring path*
`defineContract` requires `schema: ZodType<T>`; the emitted
`packages/contracts/dist/define-contract.d.ts` literally begins
`import type { ZodType } from 'zod'`, so any consumer type-checking against
the public declarations needs zod installed, and authoring a schema requires
importing it. Zod is therefore effectively Vict's required public schema
system, not merely one internal adapter — contrary to the handoff's
"do not expose that library's implementation types as Vict's permanent public
contract API". No ZodError instances or Zod issue objects leak through
results (issues are plain, prototype-checked objects). Under npm hoisting the
transitive zod dependency resolves; under strict package managers (pnpm)
SDK consumers would need to declare zod themselves — the example does, the
SDK does not mention it. Recommended direction: keep the adapter but accept a
neutral parse interface (or provide `defineContractFromParser`), reserving
zod-typed sugar as an optional subpath.

### Irreversible isolated testing
The implementation runs the registered double for an irreversible capability
under `runNode` (mode `test`) — the original handoff's "test double required"
— while the foundation doc and `effect-policy.ts` comment say "denied".
Denial happens only when no double is registered (existing test covers that
case only). Safety holds in all cases (the real implementation is unreachable
in `test` mode; verified with a poison spy), and allowing a double actually
preserves testability. This is a **specification deviation in the
documentation**, classified Low, not a safety failure; the team should pick
one behavior and align code comment, doc table, and (optionally) a regression
test. Trust boundary, stated plainly: effect classes are author-supplied
labels. Vict cannot prevent a capability labelled `pure` from secretly
performing I/O; enforcement is only as truthful as the classification. This
is a documented, currently acceptable limitation for Night 01.

### Benchmark event-count inconsistency
The benchmark graph is genuinely three pure nodes with two edges, compiled
once at activation (no compilation in the measured loop), executed through
the public `runtime.run` path, with one repository append per run. Measured
per run: **10 events** (1 started + 6 node.started/completed + 2 routed +
1 completed) and **6 contract validations**. The report's investigation note
— "each run validates two contracts, emits 4 events" — is simply incorrect
(likely a miscount); the timings themselves reproduce (median 0.030–0.031 ms,
p95 0.059–0.064 ms). Median uses the upper-middle element and p95 uses
`floor(n·0.95)` (one position conservative vs nearest-rank) — harmless at
n=5000, worth a comment. Not a behavioural failure.

## Additional findings

- **Run history stores full payloads (Medium, pre-persistence blocker).**
  `RunRecord.output` holds the complete validated output and `RunRecord.error`
  the complete error, unlike the summarized/redacted trace. The handoff says
  "Do not record complete payloads by default." In-memory today; would be
  persisted verbatim by the recommended Night 02 SQLite store. Same exposure
  class as R3.
- **Error messages bypass redaction (Medium, security-adjacent).**
  `VICT_RUNTIME_CAPABILITY_THREW`/`VICT_KERNEL_PORT_FAILURE` embed
  `cause.message` verbatim into `node.failed`, `run.failed`, `RunResult.error`,
  and the repository record; capability-thrown messages commonly embed input
  values (proven with a payload secret). Custom contract messages behave the
  same (R3, already flagged in the report's remaining risks, but the
  foundation's blanket "never copied" claim should be softened).
- **`registerDouble` silently overwrites an existing double (Low).**
  `CapabilityRegistry.registerDouble` has no conflict check, unlike
  capability/contract registration; combined with live-registry execution it
  enables mid-run double replacement (see R1). Also the `EMPTY_*`
  registration errors reuse `VICT_RUNTIME_DUPLICATE_CAPABILITY` as the code,
  which is misleading (cosmetic).
- **Issue-code count "12" vs actual 13 (Informational).** Cosmetic doc slip.
- **Benchmark claims (Low).** See targeted concern above.
- **Positives worth recording:** contract-rejection error signals embed only
  safe issue objects; `received` is always a type-shape string (including
  literal/enum mismatches); activation snapshot immutability survives
  mutation of the caller's definition object; the SDK surface is sufficient
  to build and run the entire ARA proof without touching kernel/runtime
  internals.

## Severity summary

- **Critical:** none. No external side effects occurred in any simulation or
  test path; no secret is exposed by default paths; execution semantics are
  correct in every probe.
- **High:** none. Every core Night 01 acceptance requirement in the handoff's
  definition of done verified as true.
- **Medium:**
  1. `graphVersion` does not identify executable semantics; execution reads
     the live registry (no activation snapshot) — blocker before persistence.
  2. Run repository stores full unredacted outputs/errors — blocker before
     persistence; contradicts handoff §12 and the foundation's trace-safety
     framing.
  3. Zod embedded in the public `defineContract` signature and emitted
     declaration — SDK consumers effectively require zod; conflicts with the
     handoff's schema-library encapsulation rule.
  4. Capability-thrown and custom contract messages are recorded verbatim and
     can carry payload secrets into traces and run history.
- **Low:**
  1. Isolated irreversible testing runs a registered double; foundation doc
     (and code comment) claim "denied" — documentation/spec mismatch, safe
     behavior.
  2. Benchmark note "4 events / two contracts" is wrong (actual 10 / 6).
  3. `registerDouble` overwrite without conflict; misleading error-code reuse
     for empty/invalid capability registrations.
- **Informational:**
  1. Effect classification is a trust boundary; Vict cannot detect a
     mislabelled capability performing I/O.
  2. Static contract compatibility is identity-based (documented, deferred).
  3. Median/p95 conventions in the benchmark are slightly conservative.
  4. No mechanical dependency-direction enforcement (report acknowledges).
  5. Issue-code count typo ("12" vs 13).

## Required corrections before Night 02

Only genuine blockers for the recommended persistence milestone:

1. **Execution/version identity:** introduce `capabilitySetVersion` (or
   equivalent fingerprint of the effective capability+contract set) and pin
   runs to an activation snapshot (or at minimum an `activationVersion`)
   so a persisted `graphVersion` can never be replayed against different
   handler code or schemas. (Evidence: R1.)
2. **Run-record payload policy before anything is persisted to SQLite:**
   summarize/redact `RunRecord.output`/`error` by default, or make
   full-payload storage explicit and opt-in; apply the same policy to
   error-message propagation (scrub or document an authoring rule for
   messages/custom zod messages). (Evidence: repository finding + R3.)
3. **Documentation alignment (cheap but required for an honest record):**
   fix the "any semantic change" version claim, the isolated-irreversible
   policy row (or change the behavior to match the doc), the benchmark
   "4 events / two contracts" note, the issue-code count, and the Zod-boundary
   wording in `NIGHT-01-FOUNDATION.md` and the report.

Items 1–2 are small, well-scoped, and do not require changing the public API
shape. Item 3 is documentation-only.

## Recommended next milestone

Persistence/SQLite **can safely begin only after blockers 1 and 2 above** are
implemented, because both defects would otherwise be baked into durable state
(a version catalog that cannot distinguish semantics, and stored runs that
contain unredacted payloads). With those two changes — a `RunStore` port plus
an activation/capability-set version and a payload policy — the Night 02 plan
in the report (`node:sqlite`, same public API, offline deterministic tests)
is sound and well-scoped. Night 01's `PASS` verdict itself remains justified
with the qualifications listed above.
