# Vict Night 01.1 Independent Finalization Audit

Auditor: independent verification agent, fresh session, 2026-09-01.
Scope: `C:\Users\RZ1\Desktop\RZ\260831-VCT-02` only. The finalization report
(`VICT-NIGHT-01-FINALIZATION-REPORT.md`) was read for orientation but **not
trusted as evidence**: every claim below was re-derived from observed
execution of built artifacts, source inspection, packed-package consumers,
and audit-written adversarial scripts run against the compiled `dist/` output
through package `exports`. No production source was modified; no existing
test was changed; temporary adversarial scripts lived in `audit-tmp/`
(untracked) and were deleted after evidence capture (reproductions preserved
in this report and at `%TEMP%/audit-preserved/`). The only permanent addition
is this file. `git status` is clean apart from this report at write time.

## Verdict

**VERIFIED WITH ISSUES**

## Safe to begin Night 02 persistence?

**YES WITH NON-BLOCKING ISSUES**

## Executive conclusion

The Night 01.1 finalization is real and does what it claims. All three
pre-persistence blockers raised by the Night 01 code audit are closed and
survive independent adversarial reproduction:

1. **Execution/version identity is fixed.** Three distinct identity layers
   exist and behave exactly as specified under adversarial probing: topology
   changes move `graphVersion` only; capability-revision, contract-revision,
   and effect-class changes move `capabilitySetVersion` and
   `activationVersion` while leaving `graphVersion` stable; identical
   effective semantics across runtimes produce byte-identical versions; 5 KB
   of junk inside a handler body changes nothing. Hash inputs (read from
   `packages/kernel/src/canonical.ts` and confirmed behaviourally) are
   canonicalized JSON of explicit metadata only — no `function.toString()`,
   no zod internals, no timestamps, no random ids, no insertion order.
2. **Runs pin an immutable activation snapshot.** Using a
   barrier-suspended async capability I mutated capability definitions
   (effect, revision, invoke), registered a double mid-run, and registered a
   new capability mid-run while a run was in flight: the in-flight run and
   every later run on the same activation used only the original snapshot;
   explicit `reactivate()` picked up the mutations under a new
   `capabilitySetVersion`/`activationVersion` with `graphVersion` unchanged.
   Doubles are snapshotted per run; duplicate `registerDouble` is rejected
   and `replaceDouble` is explicit.
3. **Payload retention and error sanitisation are implemented at the record
   boundary, not as a cosmetic serializer.** Stored `RunRecord`s are built
   retention-conditionally *before* reaching the repository; six distinct
   secret-injection channels (thrown message, nested cause, custom zod refine
   message, literal/enum failure, payload values, authorization-like fields)
   were all absent from traces, `RunResult.error`, default records, contract
   issues, and diagnostic metadata, while stable codes, node/capability ids,
   field paths, expected types, type-shape `received` descriptions,
   `errorName`, and correlation `errorId`s remain for debugging.

The Zod boundary is finalized: base emitted declarations for
`@vict/contracts` and `@vict/sdk` contain zero zod type/module references
(only prose comments), and my own isolated packed-tarball consumers
(reproduced independently of the repo's `verify:consumer` tooling) prove a
strict-typechecking, executing neutral consumer with **no zod installed**,
plus a working zod consumer through the documented `@vict/sdk/zod` subpath
receiving neutral `ContractIssue` objects. Packed manifests declare zod as an
optional peer dependency only.

All 105 tests pass (13 unit files + 1 integration file), the full quality
ladder exits 0, the ARA proof reproduces exactly 13 ordered events with
identical three-layer versions across separate processes, the benchmark
consistently shows 10 events / 6 contract validations / 1 repository write
per run with median ≈0.032–0.035 ms, and every Night 01 regression probe
(atomic activation, structured compiler errors, graph immutability, cycle +
max-step protection, error-edge routing, domain `error` payloads, effect
matrix, acyclic packages, no ARA logic in kernel/runtime) still holds.

The issues found are Low or Informational (see Required corrections): the
optional zod adapter does not freeze its returned contract, so — exactly as
disclosed in the finalization report's "Remaining risks" — an author who
mutates their own non-frozen contract object in place after activation can
change what later runs execute without any identity change (the documented
`defineContract` path is frozen and immune); documentation lacks an explicit
"caller assumes responsibility" warning for `payloadRetention: 'full'`;
in-memory run records are handed out by reference; and cycle diagnostics are
suppressed when other compile issues coexist. None of these enables secret
exposure, default payload persistence, or snapshot escape through the
documented authoring paths.

## Repository and command evidence

Repository state at audit start: `main` @ `877d859` ("Night 01.1: activation
integrity and data safety finalization"), working tree clean, up to date with
`origin/main`. Node v22.13.1, npm 10.9.2, TypeScript 6.0.3, Vitest 4.1.11,
ESLint 10.9.1, Prettier 3.9.6, tsx 4.23.13, zod 3.25.76 (root dev dep).

| Command | Exit status | Result |
|---|---:|---|
| `npm ci` | 0 | clean lockfile install, 0 vulnerabilities |
| `npm run format:check` | 0 | all files prettier-clean |
| `npm run lint` | 0 | 0 errors, 0 warnings |
| `npm run typecheck` | 0 | strict TS over workspace incl. tests/example/scripts |
| `npx vitest run --project unit` | 0 | 13 files, **101/101 tests pass** |
| `npx vitest run --project integration` | 0 | 1 file, **4/4 tests pass** |
| `npm test` | 0 | 14 files, **105/105 tests pass** |
| `npm run build` | 0 | ordered build; all 4 packages emit `dist/` incl. `contracts/dist/zod`, `sdk/dist/zod.js` |
| `npm run example` (×3) | 0 | 13 ordered events each run; identical versions across runs (below) |
| `npm run bench` (×4) | 0 | median 0.035/0.033/0.032/0.032 ms; p95 0.074/0.056/0.061/0.061 ms; 5000 iter + 1000 warm-up |
| `npm run verify:consumer` | 0 | repo's isolated packed-consumer check passes (independently reproduced, below) |

Example identity (three separate processes):

```text
graphVersion:         v1_d724b3bda1cc484b41c02ea8d8ae5ebb159f1ca6101082c49077d194280b63c0
capabilitySetVersion: v1_645f000244ff928e2b6000ddb257e5910d35006949247d4f3a4832f9ffbd16de
activationVersion:    v1_a665c4b4569818efbd645a5e0fbe4f0e02df6fc66a797adb908b76500d5a94c2
```

## Version identity

Hash inputs (inspected in `packages/kernel/src/canonical.ts`, confirmed
behaviourally by audit script t1):

- `graphVersion` = SHA-256 of canonical JSON of
  `{schema:'vict.graph@1', id, entry, nodes:[{id,capability,input,output}] (sorted), edges:[{from,to,kind}] (sorted)}`.
- `capabilitySetVersion` = SHA-256 of canonical JSON of
  `{schema:'vict.capability-set@1', bindings}` where bindings are the
  per-node effective bindings `{capability, revision, effect,
  input:{id,revision}|null, output:{id,revision}|null}`, canonically sorted
  and deduplicated. Only graph-required capabilities contribute.
- `activationVersion` = SHA-256 of canonical JSON of
  `{schema:'vict.activation@1', graphVersion, capabilitySetVersion}`.

Canonical JSON recursively sorts object keys; graph node/edge arrays and
binding arrays are explicitly sorted before hashing. Nothing else enters the
hashes.

Adversarial outcomes (19/20 checks passed; the 20th, below, is correct
behaviour, not a defect):

| Probe | Observed |
|---|---|
| Reordered semantically identical graph (nodes, edges, registration order) | identical `graphVersion`, `capabilitySetVersion`, `activationVersion` |
| Changed topology (extra node + edge) | `graphVersion` and `activationVersion` change; `capabilitySetVersion` unchanged (same binding reused — by-design dedup) |
| Capability revision `'1'`→`'2'` | `graphVersion` stable; `capabilitySetVersion` and `activationVersion` change |
| Contract revision `'1'`→`'7'` | same layer movement as above |
| Effect class `pure`→`irreversible` | same layer movement as above |
| Identical metadata, completely different handler bodies (incl. a handler with 5 KB of junk in `toString()`) | all three versions byte-identical across runtimes — proves bodies/`toString()` are not hashed |
| Registration order of capabilities | no effect on any version |
| Capability not required by the graph | does not contribute to `capabilitySetVersion` |
| Missing/empty capability revision | rejected at `registerCapability` with `VICT_RUNTIME_INVALID_REVISION` (validation is at registration, not inside `defineCapability` — matches the docs' "authoring/registration time" wording) |
| Missing/empty contract revision | rejected by `defineContract` with `INVALID_CONTRACT_REVISION` |

Cross-process determinism: the three example runs above were separate
processes minutes apart with identical versions — no timestamps or random ids
participate. (Randomness exists only as run/error correlation ids.)

**Remaining trust boundary (accepted, documented):** identity is
revision-based. If an author changes handler logic, contract semantics, or an
effect label *without* changing the explicit `revision`, no version changes.
Authors/build tooling must bump revisions when implementation semantics
change; Vict deliberately cannot read minds. Documented in
`NIGHT-01-FOUNDATION.md` ("Revisions are an author/build responsibility") and
in the code.

## Activation snapshot

Audit script t2 used a deferred-promise barrier to suspend the first
capability of a two-node graph mid-run, then mutated everything reachable:
26/26 checks pass semantically (the single initial "FAIL" was the auditor's
own assertion reading the last node's output instead of the first node's;
corrected and re-run).

| Probe | Observed |
|---|---|
| Run suspended in capability 1 on barrier; then definition objects mutated (`effect`, `revision`, `invoke` swapped), double registered mid-run, new capability registered mid-run; barrier released | run completes using **only original handlers**; output proves node 1 ran the original handler and node 2 ran the original handler, `doubleCalls === 0` |
| In-flight run identity | pins original `graphVersion`, `capabilitySetVersion`, `activationVersion` |
| Later run on same activation (post-mutation) | still original handlers, original identity; `activeGraph()` info unchanged |
| Explicit `activate()` after mutations | new `capabilitySetVersion` + `activationVersion`, same `graphVersion` (topology unchanged) |
| Post-reactivation `simulate` | blocks — new `irreversible` effect class is honoured |
| Post-reactivation normal run | blocked without `allowIrreversible`; with permission, runs the **mutated** handler (proving new snapshot is live) |
| `registerDouble` duplicate | rejected (`VICT_RUNTIME_DOUBLE_ALREADY_REGISTERED`) |
| `replaceDouble` without prior registration / unknown capability | rejected |
| Simulate with double A → `replaceDouble` to B → later run | A answers in-flight runs only; later runs use B |
| Missing double in simulate | blocked, structured `effect.blocked` + `run.blocked` with reason + remediation |
| Mutating original capability objects after registration/activation | no effect on runs (binding copies are frozen at activation; `invoke` captured by value) |
| Mutating `defineContract`-produced contract metadata | impossible — the object is `Object.freeze`n |
| Registry/snapshot maps through public references | not exposed; `activeGraph()` returns a fresh plain-info object — tampering with it does not affect the runtime's view |
| **Hand-rolled (non-frozen) contract object mutated in place after activation** | **later runs observe the swapped `parse`**; pinned identity unchanged. Same applies to `defineZodContract` output (not frozen). This is the disclosed by-reference trust boundary; the documented `defineContract` path is immune (see Issue L1) |

Conclusion: **no execution reads live mutable *capability* semantics after
activation** — invoke references, effect classes, and revisions are captured
as frozen copies at activation, and doubles at run start. Contract objects
are stored by reference (frozen when authored via `defineContract`).

## Payload-retention verification

Audit script t3 (unique secret markers per channel) plus targeted redaction
probe t3b: all retention/sanitisation properties verified (four initial
"FAIL"s were auditor assertion errors — a failed run legitimately has no
output summary, a zod refine issue has code `custom` with a framework default
message, and nested output keys are never reflected at all — each corrected
and re-verified).

### Returned result

- `RunResult.output` carries the **actual** validated output under all three
  retention modes (`'none'`, `'summary'`, `'full'`) — verified with a secret
  value that only the caller should see.

### Trace

- Events contain shape/length/key-name summaries only (`summarizeOutput`);
  no values of any kind, secret or not, appear anywhere in a trace
  (verified with secrets in nested objects, arrays, and top-level fields).
- Secret-like key names (`password`, `apiKey`, `Authorization`, `privatekey`,
  `credential`) are redacted to `[redacted]` in top-level key lists; values
  are never reflected. Safe key names (`normal`) remain visible.
- No raw capability error message appears (see sanitisation section).

### Default run history (`payloadRetention: 'summary'`, the default)

- `RunRecord` contains metadata, status, all-three version ids, mode, steps,
  trace, sanitised error, and a safe `outputSummary` (`{"shape":"object",
  "keys":[...]}`). It has **no `output` property** and **no input payload** —
  verified by property inspection and secret scan of the serialized record.
- The record is stamped `retention: 'summary'`, and the `output` field is a
  documented optional present only under `'full'` (`RunRecord` type,
  `packages/runtime/src/types.ts`).

### Explicit full retention

- `createRuntime({ payloadRetention: 'full' })` stores the complete validated
  output in the record; `'none'` drops even the summary; the default is
  `'summary'`; invalid values are rejected at construction
  (`VICT_RUNTIME_INVALID_RETENTION`). Full retention never becomes a default
  and is clearly identifiable in configuration and types.

### Policy placement (RunStore boundary, not a serializer)

`VictRuntime.#recordRun` builds the record object with retention-conditional
spread fields **before** calling `repository.record()` — the repository (the
exact boundary a future `RunStore` replaces) receives already-policy-shaped
data and cannot over- or under-retain by its own choice. This is structural
enforcement, not a cosmetic post-serializer. Under `'full'`, input values are
still never stored (only the validated output is).

## Error-sanitisation verification

Unique secrets injected through six channels; serialized
`RunResult` + `RunRecord` (which include trace, `error`, contract issues, and
diagnostic details) searched with `JSON.stringify` over own properties:

| Injection channel | Secret found in default persistable/observable diagnostics? |
|---|---|
| Capability-thrown `Error.message` (`auth failed for SECRET-THROW-…`) | **No** — record and result carry code `VICT_RUNTIME_CAPABILITY_THREW`, safe boilerplate message ("…the thrown message is not retained"), `capabilityId`, `nodeId`, `invokedVia` |
| Nested `cause` (`inner cause SECRET-CAUSE-…`) | **No** |
| Custom Zod refine message (`Auth rejected for token value: SECRET-ZOD-…`) | **No** — issue is framework-generated: `Validation failed (custom) at 'token', received string(5).` |
| Contract literal/enum error (payload carrying secret) | **No** — `received` is a type-shape (`string(5)`, `number`), never the value; wrong enum member value never reflected |
| Payload values (`SECRET-PAYLOAD-…` in input fields) | **No** — input values never enter trace or record in any mode |
| Authorization-like fields (`apiKey`, `Authorization`, `credential`, `privatekey` keys) | **No** — values never reflected; key names redacted in output summaries |

Useful structured information that **does** remain: stable error code;
capability id and node id; contract issue `code`/`path`/`expected`/`received`
(type-shape)/framework `message`; error class name (`errorName`, e.g.
`Error`); correlation id (`errorId`, `err_…`); and `safeMessage` only when
the author explicitly opts in via `trustSchemaMessages` (documented as
author-controlled content; default paths never populate it — verified
absent).

Sanitisation is **structural, not key-name matching**: thrown messages are
never copied anywhere, regardless of content. Key-name matching exists only
in trace *summaries* to decide whether a key *name* is shown or replaced by
`[redacted]`; values are never shown either way. The regex covers common
names; an exotic key name (e.g. `pwd`) would display its name — but still
never its value. Limitation documented.

## Contract-boundary verification

### Base declarations

`grep -rniE "zod"` over `packages/contracts/dist` (excluding `zod/`) and
`packages/sdk/dist` (excluding `zod.*`), `packages/kernel/dist`,
`packages/runtime/dist`: the only matches are **prose comments** (e.g.
"`defineZodContract` from `@vict/contracts/zod`"). Zero
`import/require/from 'zod'`, zero `ZodType`, zero `ZodError` in any base
emitted `.d.ts`/`.js`. The kernel, runtime, and base contracts sources
likewise contain no zod.

### Independent isolated packed-package consumers (audit-written, not the repo's tooling)

Script t4 packed all four workspaces with `npm pack`, then:

- **Neutral consumer** — installed the four tarballs and nothing else.
  Verified `node_modules/zod` **absent**. Packed manifests confirmed:
  `@vict/contracts` has zero runtime dependencies and zod as optional peer
  only; `@vict/sdk` depends only on the three `@vict/*` packages plus zod as
  optional peer. Consumer code authored a neutral contract
  (`Contract<{n:number}>` with hand-written `parse`, `ContractIssue`
  construction), ran a capability through `createRuntime`/`activate`/`run`,
  and checked both the accept and structured-reject paths.
  `tsc --strict --skipLibCheck:false` over the packed declarations exits 0;
  execution via tsx succeeds (`AUDIT_NEUTRAL_OK v1_ecbeba6be…`); a bare
  `import('@vict/contracts')` + `defineContract` also works with no zod
  present.
- **Zod consumer** — installed the tarballs plus `zod@3`, used
  `defineZodContract` from `@vict/sdk/zod`. Strict typecheck exits 0;
  execution returns neutral `ContractIssue` objects
  (`{"code":"invalid_type","path":"name","message":"Expected string at
  'name', received number.","expected":"string","received":"number"}`) with
  no `safeMessage` by default (`AUDIT_ZOD_OK`).

This exercises strict package isolation (tarballs, not workspace hoisting).
One note: my first neutral-consumer typecheck failed because my own consumer
code read `run({...}).output.n` without the `run<T>` type argument — caller
must assert the expected output type (`run<{n:number}>(…)`), identical to the
repo's own consumer. Correct typing behaviour, not a defect.

**Conclusion:** the base public boundary is Zod-free and the boundary is
finalized.

## Irreversible testing

Audit script t5 (poison real implementations with call counters): 15/15.

| Requirement | Observed |
|---|---|
| Normal irreversible execution blocked without explicit permission | `blocked`; `effect.blocked` event carries capability id, effect class, mode, reason, remediation; real spy count 0 |
| Normal irreversible runs real **only** with `policy.allowIrreversible: true` | completed via real implementation, exactly once |
| Simulate/test never invoke the real irreversible implementation | real spy count unchanged across simulate and `runNode` probes (blocked without double; double-only with double) |
| Registered safe double runs in simulation | completed with `DOUBLE-IRREVERSIBLE`, real count unchanged |
| Registered safe double runs in isolated test (`runNode`) | completed, double ×1, real ×0 |
| Missing double produces blocked result | `runNode` without double → blocked; no repository writes |
| Documentation matches behaviour | `effect-policy.ts` doc comment and `NIGHT-01-FOUNDATION.md` table both state "double required (real never runs)" for simulate/test — matches observation; the Night-01 "denied" discrepancy is gone |
| Full read/write matrix (normal/simulate/test × no-double/double) | read/write run real in normal only; simulate/test blocked without double, complete with double and real count 0; pure runs real in simulate by design |

## ARA and benchmark

### ARA (audit script t6 + CLI runs)

- Graph: exactly 4 nodes (`user-message`, `prepare-context`, `assistant`,
  `assistant-response`) and 3 success edges (source inspection of
  `examples/ara-proof/src/graph.ts`).
- Offline/credential-free: no fetch/http/net imports anywhere in the example;
  deterministic provider.
- Successful run: exactly **13 events**, exact order
  (`run.started`, 4×[`node.started`, `node.completed`] interleaved with 3
  `signal.routed`, `run.completed`), `seq` dense from 0, every event pinned
  to the same `graphId` + three versions; output re-passes the output
  contract on independent re-parse.
- Identity stable across processes: see versions above (3 CLI runs
  identical).
- Invalid input (`text: ''`): `contract.rejected` at the entry input stage;
  **zero** `node.started` events; assistant never invoked.
- Assistant throw: `run.failed` honestly with
  `VICT_RUNTIME_CAPABILITY_THREW`; raw message (including an embedded
  marker secret) absent from all diagnostics; `node.failed` emitted.
- Output-contract mismatch (empty text violating `min(1)`):
  `contract.rejected` at output stage; downstream node never started.
- Compilation placement: `compileGraph` is called only from `activate()` and
  `runNode()` (source-verified: `runtime.ts` lines 127 and 215; benchmark
  activates once outside warm-up and measured loops). A timing probe showed
  activation ≈0.5 ms vs ≈0.11 ms average per run — consistent with one-time
  compile (my "5× cheaper" assertion missed by 0.04 ms; the structural
  evidence is decisive).

### Benchmark (audit script t7 + repeated `npm run bench`)

- Graph: 3 nodes, 2 edges (`scripts/benchmark.ts`).
- Compilation outside the measured loop: verified structurally (above) and
  by construction (`activate()` precedes warm-up).
- Per successful run (reconstructed with counting contracts, event
  listener, and counting repository): exactly **10 events**
  (`run.started`, 3×[`node.started`,`node.completed`], 2×`signal.routed`,
  `run.completed`), exactly **6 contract validations** (3 nodes × input+output),
  exactly **1 repository write**. Matches the corrected documentation.
- Median = upper-middle element (2501st of 5000 sorted); p95 = index
  `floor(n·0.95)` = 4751st, one position conservative vs nearest-rank
  (4750th) — both sound, conservative, and constant-order.
- Timing broadly consistent across four invocations: median
  0.035/0.033/0.032/0.032 ms, p95 0.074/0.056/0.061/0.061 ms. No wall-clock
  assertions exist in the test suite (grep-verified) — timing is
  informational, not a correctness requirement.

## Claim matrix

| # | Claim (source: finalization report / foundation) | Verdict | Evidence | Severity |
|---|---|---|---|---|
| 1 | 105/105 tests pass; all quality commands exit 0 | **Verified** | Reproduced exactly (101 unit + 4 integration; ladder table) | — |
| 2 | Three-layer identity with the specified hash inputs | **Verified** | `canonical.ts` inspection + 19 adversarial probes (t1); cross-process identity stability | — |
| 3 | Topology changes move `graphVersion` only; revision/effect changes move `capabilitySetVersion`+`activationVersion` | **Verified** | t1 matrix | — |
| 4 | Nothing hashed except explicit metadata (no bodies/internals/time/random/order) | **Verified** | 5 KB-body probe; code inspection; cross-process runs | — |
| 5 | Revisions mandatory, structured rejection at authoring/registration | **Verified** | `VICT_RUNTIME_INVALID_REVISION` / `INVALID_CONTRACT_REVISION` observed | — |
| 6 | Runs pin an immutable activation snapshot; registry/definition/double changes invisible | **Verified** | Barrier mid-run probe (t2): in-flight + later runs unaffected; explicit reactivation changes identity | — |
| 7 | Doubles snapshotted per run; duplicate rejected; `replaceDouble` explicit | **Verified** | t2 scenarios D | — |
| 8 | "Post-activation contract mutation has no effect" (foundation wording) | **Partial** | True for `defineContract` (frozen); **false for non-frozen contract objects** (hand-rolled, and the zod adapter does not freeze): in-place `parse` swap is observed by later runs without identity change. Disclosed in the finalization report's "Remaining risks" | **Low** |
| 9 | `graphVersion` unchanged from Night 01 (`v1_d724b3bd…`) | **Verified** | Example output matches the value recorded in the Night 01 code audit | — |
| 10 | Default retention `'summary'`; no full payloads stored by default; `'full'` explicit opt-in; `'none'` drops summary | **Verified** | t3 matrix + `RunRecord` type + construction-time validation | — |
| 11 | Retention policy sits at the future `RunStore` boundary | **Verified** | `#recordRun` builds policy-shaped records before `repository.record()`; record carries `retention` + typed optional `output` | — |
| 12 | Thrown messages/causes never persisted; sanitised diagnostics retain code/ids/class/correlation id | **Verified** | Six-channel secret probe (t3/t6); structured fields observed | — |
| 13 | Contract issues are framework-generated, type-shape `received`, no schema messages by default, `safeMessage` opt-in only | **Verified** | t3 S2a/S2c incl. refine (`custom` code) and enum failures | — |
| 14 | Base declarations zod-free; optional `zod` subpaths; zod optional peer | **Verified** | dist scans + independent packed consumers (t4) + packed manifests | — |
| 15 | Neutral consumer works without zod under strict isolation | **Verified** | Independent t4 reproduction (no zod in `node_modules`; strict `skipLibCheck:false` typecheck + execution) | — |
| 16 | Zod consumer receives neutral safe issues | **Verified** | t4 zod consumer | — |
| 17 | Irreversible normal requires explicit permission; simulate/test real-unreachable; safe double runs; missing double blocks | **Verified** | t5 15/15 with poison spies | — |
| 18 | ARA: offline, 4 nodes/3 edges, 13 ordered events, output contract passes, invalid input invokes nothing, throw/mismatch fail honestly | **Verified** | t6 + 3 CLI runs | — |
| 19 | Compilation outside conversational run path / measured loop | **Verified** | `compileGraph` call sites; bench structure; timing probe | — |
| 20 | Bench: 10 events, 6 validations, repo-op count matches docs, median/p95 sound | **Verified** | t7 8/8 (1 repo write/run) | — |
| 21 | Atomic activation; structured compile errors (13 codes); immutable compiled graphs; cycle + max-step protection; error-edge routing; domain `error` payloads; effect matrix; no ARA in kernel/runtime; acyclic packages | **Verified** | 105/101+4 tests re-run; t8/t8b probes; greps (imports match declared deps; no ARA code — only comment substrings) | — |
| 22 | "Documentation warns that the caller assumes responsibility" for full retention | **Partial** | Foundation documents the opt-in mechanism and type docs explain scope, but no explicit caller-responsibility warning exists | **Low** |
| 23 | In-memory records are safely encapsulated | **Partial / Informational** | `getRun`/`listRuns` return record objects by reference (mutation visible in memory). Irrelevant for a serializing `RunStore`; not a secret-exposure path | Informational |

## Regressions

None found. Specifically re-verified after finalization:

- Atomic activation keeps the previous snapshot active and runnable after a
  failed `activate()` (t8).
- Compiler rejections remain structured with stable codes and identifiers
  (`EMPTY_GRAPH_ID`, `DUPLICATE_NODE`, `MISSING_ENTRY_NODE`,
  `EDGE_REFERENCES_UNKNOWN_NODE`, `CONTRACT_INCOMPATIBLE`,
  `UNKNOWN_CAPABILITY`, `UNSUPPORTED_CYCLE` all observed; union remains
  exactly 13 codes).
- Compiled graphs remain frozen (`Object.isFrozen` on the kernel testing
  graph; mutating the caller's definition after activation has no effect).
- Cycle rejection (`UNSUPPORTED_CYCLE` with `nodeIds`, self-loop and 2-node
  cycle) and max-step protection (`VICT_KERNEL_MAX_STEPS_EXCEEDED` at step
  101 after exactly 100 invocations, default 100) intact.
- Error-edge routing delivers a sanitised `VictError` signal to the handler
  and completes; domain payloads containing an `error` property complete
  normally (t6).
- Effect-safety matrix fully intact (t5); blocked runs leave the active graph
  intact.
- No ARA logic entered kernel/runtime/contracts/sdk (grep: only comment
  substrings and the "contains no ARA" doc comment).
- Package dependency graph remains acyclic: contracts ← kernel ← runtime ←
  sdk; every cross-package import maps to a declared dependency.

## Severity summary

- **Critical:** none. No forbidden side effects, no secret exposure on any
  default path, no corrupt execution observed.
- **High:** none. Activation is pinned; no Night 01 behaviour regressed.
- **Medium:** none. The three pre-persistence blockers from the Night 01
  code audit are closed and adversarially verified.
- **Low:**
  1. `defineZodContract` (and any hand-rolled contract) does not freeze its
     returned contract object, so an author can mutate `parse` in place
     after activation and later runs will execute the new logic with the old
     identity. This is the disclosed by-reference snapshot-depth boundary
     and is unreachable through the documented neutral path (`defineContract`
     freezes), but the adapter could cheaply freeze its result to make all
     *adapter-authored* contracts equally immutable.
  2. Documentation does not contain an explicit "under `payloadRetention:
     'full'` the caller assumes responsibility for what is persisted"
     warning; the mechanism is documented, the responsibility transfer is
     not spelled out.
- **Informational:**
  1. In-memory run records are returned by reference from
     `getRun`/`listRuns` (mutation visible in memory); harmless for an
     in-process repository and irrelevant to a serializing `RunStore`.
  2. Cycle detection runs only when no other compile issues exist, so a
     cyclic graph with an additional issue reports the other issue first
     (the cycle surfaces on the next compile); max-step enforcement backs
     this up at runtime.
  3. Identity is revision-based (authors must bump revisions on semantic
     change) and effect labels are author-supplied — both documented trust
     boundaries, unchanged and accepted.
  4. Trace key-name redaction is best-effort by name; values are never
     reflected regardless (documented limitation).
  5. Benchmark median/p95 conventions are slightly conservative; timing
     drift since Night 01 (median 0.030 → 0.032–0.035 ms observed) is well
     within budget and unasserted.
  6. `RunResult` output typing requires the caller to supply `run<T>` to get
     a typed output (by design; unknown by default).

## Required corrections

No blockers. Recommended (non-blocking, cheap) corrections before or during
Night 02:

1. Freeze the contract returned by `defineZodContract` (and consider freezing
   the parsed contract object in any future adapters) so every
   adapter-authored contract is as immutable as `defineContract` output.
2. Add one sentence to `NIGHT-01-FOUNDATION.md` (and the `PayloadRetention`
  type docs): under `'full'`, the caller assumes responsibility for the
   content that gets persisted.
3. Consider copying run records on return in the in-memory repository (or
   documenting the by-reference behaviour) so the future `RunStore` contract
   can require read-only handover explicitly.

## Recommendation

**Night 02 durable persistence may begin.** All three pre-persistence
blockers from the Night 01 code audit (execution/version identity, activation
snapshot pinning, payload/error policy at the store boundary) are genuinely
implemented and independently verified under adversarial probing; the Zod
boundary is finalized and proven under strict package isolation; no Night 01
behaviour regressed (105/105 tests plus targeted probes). The safe scope for
Night 02 is unchanged from the plan: a pluggable `RunStore` port with a local
SQLite implementation keyed by the now three-layer activation identity,
keeping runs offline and deterministic. The Low items above should be picked
up as hygiene during Night 02 but do not gate it.
