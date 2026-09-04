# VICT Stage 05 — Final Snapshot and Fixture Correction Report

## Outcome

Two narrowly bounded defects were corrected; nothing else was touched.

1. **Live-source snapshot defect (corrected).** After compilation, the plan's
   `toJSON()` serializer live-read the caller-owned `application.id` and
   `application.revision` root fields, while the plan fields, the manifest,
   and the `applicationVersion` were captured at compilation time. Mutating
   the caller's root identity after compilation therefore produced a single
   serialized plan that contradicted itself: top-level identity from live
   caller state, manifest and version from the captured original. All
   plan-level scalar identity fields are now captured into immutable local
   values at successful compilation and are the only source used by both the
   plan object and its serializer.
2. **Fixed-delay SIGKILL coordination (removed).** The Stage 03
   real-subprocess crash fixtures killed the child at a fixed 3000 ms
   elapsed deadline (`spawnSync(..., 3000, { killSignal: 'SIGKILL' })`).
   Under parallel-suite load the child could still be booting when the
   deadline elapsed, so the SIGKILL landed before the durable checkpoint
   existed and the parent's `readFile(state.json)` failed with ENOENT — the
   LOW-05-B occurrence captured in full by the closure re-audit. The kill
   decision is now an explicit readiness barrier: the child emits a stdout
   sentinel strictly after its fsynced durable checkpoint, and the parent
   kills only after observing it. The real SIGKILL, real child process,
   real SQLite reopen, and exact recovery semantics are unchanged. No
   production runtime source was modified.

Stage 05 is **not** marked formally closed; Stage 06 has not begun. This
micro-correction does not reopen Stage 05 architecture or UI work.

## Starting and final SHAs

| Item | SHA |
| --- | --- |
| Required starting SHA (`HEAD == origin/main` confirmed before work) | `4aead149bf8e647f8cf1e2df57a90fea6c45fa5d` |
| Prior canonical identity remediation (history anchor) | `8ecb9aff8687e8059f78df1eb8c5bfc0b4053613` |
| Independent canonical closure re-audit (untouched, byte-identical) | `4aead149bf8e647f8cf1e2df57a90fea6c45fa5d` |
| Implementation commit — snapshot fix | (see `fix(stage-05): pin serialized plan identity`) |
| Implementation commit — readiness fixture | (see `test(stage-05): replace fixed crash timing with readiness`) |
| Documentation commit (this report) | tip of `main` after push; its own SHA is deliberately not embedded in this file |

`git diff 4aead149..HEAD --name-only` contains exactly:
`docs/architecture/STAGE-05-APPLICATION-DELIVERY.md`,
`docs/report/VICT-STAGE-05-FINAL-SNAPSHOT-CORRECTION-REPORT.md`,
`packages/application/src/compile.ts`,
`packages/application/test/snapshot-identity.test.ts`,
`packages/store-sqlite/test/fixtures/orchestration-worker.mts`,
`packages/store-sqlite/test/fixtures/readiness.ts`,
`packages/store-sqlite/test/helpers/readiness-child.ts`,
`packages/store-sqlite/test/orchestration-restart.test.ts`,
`packages/store-sqlite/test/readiness-barrier.test.ts`.

## Reproduced snapshot defect

Recorded at the required starting SHA `4aead149` with a temporary probe
through the public emitted `compileApplication` boundary (raw plain
JavaScript objects; `packages/` is byte-identical between `c4cb79b` and
`4aead149` — `git diff c4cb79b..4aead14 -- packages/` is empty). Compiling
`application.id = 'app.before'`, `application.revision = '1'`, then mutating
the caller-owned root fields to `'app.after'` / `'2'` (and `name`) produced
exactly the reported contradiction:

```text
== BEFORE caller mutation ==
plan.applicationId        = app.before
plan.applicationRevision  = 1
plan.applicationVersion   = v1_5aa80143005c99777e2be416582100354da13778a37c097fd33ab11317f9499e
toJSON().manifest.id      = app.before
toJSON().manifest.revision= 1
== AFTER caller mutation of root id/revision/name ==
plan.applicationId                 = app.before
plan.applicationRevision           = 1
plan.applicationVersion            = v1_5aa80143005c99777e2be416582100354da13778a37c097fd33ab11317f9499e
plan.toJSON().applicationId        = app.after
plan.toJSON().applicationRevision  = 2
plan.toJSON().manifest.id          = app.before
plan.toJSON().manifest.revision    = 1
DEFECT toJSON().applicationId !== plan.applicationId           = true
DEFECT toJSON().applicationId !== toJSON().manifest.id         = true
DEFECT toJSON().applicationRevision !== manifest.revision      = true
```

One serialized plan contradicted itself: its top-level identity came from
live caller state while its manifest and version described the captured
original. (Repeated serializations were byte-identical to each other — both
equally wrong.)

## Root cause

In `packages/application/src/compile.ts`, the plan-construction closure read
the caller's live object inside the serializer:

```ts
toJSON(): Record<string, unknown> {
  return {
    applicationId: application.id,        // live read of caller state
    applicationRevision: application.revision, // live read of caller state
    applicationVersion,
    manifest, ...
```

The closure re-audit mutated nested source structures but did not mutate the
root `application.id` / `application.revision`, so its caller-ownership
proof was complete for nested data but not for the root scalars.

## Corrected snapshot semantics

At successful compilation, all plan-level scalar identity fields are
captured into immutable locals owned by VICT:

```ts
const applicationId: string = application.id;
const applicationRevision: string = application.revision;
const applicationVersionCaptured: string = applicationVersion;
```

Both the plan object and `toJSON()` use only these captured values. The
entire plan-construction region was re-inspected for live reads: the two
`toJSON()` reads above were the only closure reads of `application` (or of
any caller-owned input) after plan assembly; every other access
(`components`, `screens`, `views`, `forms`, `actions`, `resources`,
`routes`) is an eager read during assembly that immediately clones into
deep-frozen VICT-owned copies. Required behavior, all verified below:
plan scalars, manifest identity and serialization identity always agree;
`toJSON()` never reads caller state; root mutation changes nothing; nested
mutation changes nothing; repeated serializations are byte-identical;
`applicationVersion` remains pinned; no caller object is frozen; no caller
reference enters the plan or the serialized form; a returned serialization
cannot alter the plan or later serializations; the caller's application
object is never frozen.

## Caller-ownership evidence

Permanent regression `packages/application/test/snapshot-identity.test.ts`
(raw JavaScript compiler boundary, plain caller-owned fixtures, both
`vict.application@1` and `vict.application@2`, 6 tests). After compilation
the tests mutate every caller root field — `schema`, `id`, `revision`,
`name`, `theme`, `compatibility`, and the whole collections `routes`,
`screens`, `actions`, `resources`, `views`, `forms`, `components` — plus
representative nested structures (route path, screen title, region name,
surface content, view fields, form field label, action revision, resource
revision, component revision, theme tokens), in two phases (nested
in-place first, then whole-collection replacement). Asserted after every
phase: plan scalars unchanged; manifest bytes unchanged; serialization
byte-identical; `toJSON().applicationId === plan.applicationId`;
`toJSON().applicationRevision === plan.applicationRevision`;
`toJSON().manifest.id === plan.applicationId`;
`toJSON().manifest.revision === plan.applicationRevision`; no caller object
frozen (walked over the full caller graph); no plan/manifest/serialized
nested object aliases the caller (identity walk against the full caller
object set); a returned serialization can be top-level-mutated and its
frozen nested mutation attempts throw without corrupting later
serializations; five consecutive serializations are byte-identical; and the
exact pinned valid identity vectors are unchanged:
`@1 = v1_0cb67085db7cff5793eb34b48430eda648fa1140fa1ad1ad04df924628b49452`,
`@2 = v1_e8f7dd4756f51a8d7722360805513f15b433d2b2e25aff40096fb6321ea4b4f9`
(both byte-identical when computed at `c4cb79b`, proving the correction
changed no identity bytes).

## Fixture root cause

The re-audit's captured failure (`partial fan-out SIGKILL … ENOENT …
state.json` after 3226 ms) is reproduced structurally: the parent used
`runChild(..., 3000, { killSignal: 'SIGKILL' })` — `spawnSync` kills at a
FIXED elapsed deadline. Unloaded, the child reached its checkpoint in
~500–600 ms; under parallel-suite load the boot could exceed 3000 ms, the
child was killed before `writeState({hanging: true})` executed, and the
parent's `readFile(state)` produced ENOENT. The baseline kill decision is
elapsed-time based; the corrected decision is readiness based (structural
and deterministic proof below).

## Readiness-barrier design

Fixture infrastructure only (`packages/store-sqlite/test/fixtures/readiness.ts`,
`packages/store-sqlite/test/helpers/readiness-child.ts`, worker and test
updates). No production runtime source changed.

1. Parent starts the real child (`spawn(process.execPath, ['--import',
   'tsx', WORKER, stage, db, state])`).
2. Child boots, opens SQLite, activates the runtime, reaches the intended
   hanging branch.
3. Child durably writes its checkpoint — `durableWrite` = write + **fsync**
   on the write handle — for `start-hang` the state file, for `hang-write`
   the external ledger, for `start-join-partial` the branchB ledger bump and
   the state file.
4. Child emits an explicit stdout sentinel
   `[vict-fixture-ready] <stage>` (synchronous `fs.writeSync(1, …)`,
   EAGAIN-safe) — ONLY after the durable write completed.
   For `start-join-partial` the sentinel is additionally causally after
   branch 'a'’s durable `branch.completed` event: branchB's handler waits
   (bounded 30 s) for that event before checkpointing, because killing
   exactly at branchB's hang could otherwise catch branch 'a' mid-attempt
   (invoked, completion not yet committed) and recovery would reclaim two
   attempts — breaking the fixture's own documented scenario.
5. Parent waits for the sentinel (`spawnUntilReady().ready`); ONLY the exact
   `prefix + ' ' + stage` line counts.
6. Parent sends the real `SIGKILL`.
7. Recovery assertions run unchanged against the durable state.

A bounded wall-clock timeout remains solely as a failure guard for
"readiness was never reached": when it fires, `ready` rejects with a clear
bounded fixture error and the guard performs the kill. It never determines
the kill in a passing run, no delay was increased, no sleep added, no
assertion weakened, the ENOENT is not suppressed, the state file is never
created by the parent, and no retry loop exists. Each rewritten kill test
additionally proves causality directly: immediately after `await ready` it
reads the durable checkpoint (state file / ledger) BEFORE killing, and
asserts the exit signal is `SIGKILL`.

## Negative-control evidence

Snapshot defect — isolated git worktree at
`c4cb79beee3ed3d229084367a846bd2be3f9cf33` with a real independent
`npm ci` (276 packages) and real `npm run build` (both exit 0); no
junctions, symlinks, or shared `node_modules` (worktrees never share them);
worktree removed after evidence capture:

- Mutating root `application.id` changed `toJSON().applicationId`
  (`app.before → app.after`); mutating root `application.revision` changed
  `toJSON().applicationRevision` (`1 → 2`).
- Plan fields stayed `app.before`/`1`, manifest stayed `app.before`/`1`,
  `applicationVersion` stayed `v1_d7f81a55…` — one serialization internally
  inconsistent, exactly as at the starting SHA.
- The new permanent regression FAILS there: at `c4cb79b` the suite reports
  2 failed / 1430 passed (both revision variants of "root and nested caller
  mutation after compilation changes nothing", failing on byte-identity of
  the serialization). After correction the identical file passes
  (6/6) in the main tree.
- Identity vectors for the regression fixtures are byte-identical at
  `c4cb79b` and after the correction (`@1 v1_0cb67085…`, `@2 v1_e8f7dd47…`,
  visible inside the negative-control failure output itself).

Fixture defect — structural and deterministic proof (no reliance on a
nondeterministic loaded failure):

- Structural: `git show c4cb79b:packages/store-sqlite/test/orchestration-restart.test.ts`
  contains three fixed-deadline kills
  (`runChild([…], 3000, { killSignal: 'SIGKILL' })` at lines 149, 197,
  241–242) — the kill decision is elapsed-time based. The corrected tree
  contains zero live elapsed kills (the only `3000` occurrences are
  documentation comments) and three `spawnUntilReady` call sites with their
  three `await child.ready` readiness waits (plus import and documentation
  references) — the kill is invoked strictly after readiness resolution.
- Deterministic harness-level probe (temporary, scaled timings, run once
  and removed): a synthetic child writes its fsynced checkpoint at 400 ms
  and emits readiness at 500 ms. Baseline-style decision — fixed 200 ms
  elapsed kill (`spawnSync(..., { timeout: 200, killSignal: 'SIGKILL' })`),
  the scaled analog of the fixed 3000 ms deadline beating a loaded boot —
  kills before the checkpoint: `checkpointExisted=false` (the parent's
  read would ENOENT; the captured LOW-05-B mechanism). Corrected decision —
  kill only after the sentinel — always preserves the checkpoint:
  `checkpointExisted=true, signal=SIGKILL`. Probe file kept outside the
  repository and not committed.
- The permanent `packages/store-sqlite/test/readiness-barrier.test.ts`
  (4 tests, real `node -e` probe children, short synthetic timings) proves:
  an intentionally delayed child is not killed merely because wall-clock
  windows elapse (alive markers at 120 ms and 250 ms exist; kill follows
  the 380 ms sentinel); readiness is emitted only after the durable
  checkpoint exists (checkpoint file verified at readiness time); a missing
  readiness signal fails with a clear bounded fixture error
  (`readiness for 'never-ready' was NOT observed within 700 ms … bounded
  failure guard`) and the guard performs the SIGKILL; malformed readiness
  signals (wrong stage, `prefix-probe`, upper-case prefix, double space)
  never substitute for readiness and never trigger a kill (child exits 0 by
  itself, `signal=null`); the sentinel matcher is exact (8 cases).

## Files changed

- `packages/application/src/compile.ts` — captured scalar plan identity;
  plan + serializer use only captured values.
- `packages/application/test/snapshot-identity.test.ts` — NEW permanent
  snapshot regression (@1/@2).
- `packages/store-sqlite/test/fixtures/readiness.ts` — NEW shared fixture
  readiness module (sentinel prefix, fsynced `durableWrite`, `emitReady`,
  exact `isReadyLine`).
- `packages/store-sqlite/test/helpers/readiness-child.ts` — NEW parent-side
  `spawnUntilReady` readiness barrier with bounded failure guard.
- `packages/store-sqlite/test/fixtures/orchestration-worker.mts` — test
  fixture only: fsynced checkpoint writes; readiness sentinels emitted after
  the durable checkpoints in the three kill stages; branchB waits for
  branch 'a'’s durable completion before its own checkpoint; header
  documentation.
- `packages/store-sqlite/test/orchestration-restart.test.ts` — test only:
  three kill tests switched from fixed-deadline `spawnSync` to the
  readiness barrier with causal checkpoint-before-kill proof and explicit
  `SIGKILL` exit assertions; header documentation. Recovery stages and all
  restart/fencing assertions unchanged.
- `packages/store-sqlite/test/readiness-barrier.test.ts` — NEW permanent
  harness-level readiness tests.
- `docs/architecture/STAGE-05-APPLICATION-DELIVERY.md` — clarification only:
  the captured-scalar serialization semantics are now stated explicitly
  (the existing prose claimed serializers never re-read caller objects,
  which the root-scalar defect contradicted).
- `docs/report/VICT-STAGE-05-FINAL-SNAPSHOT-CORRECTION-REPORT.md` — NEW
  (this file).

`packages/store-sqlite/src/` is untouched (production orchestration
behavior unchanged); no application schema marker changed; no Stage 06 or
Mastra work exists.

## Identity compatibility

- Valid `@1`/`@2` canonical bytes and application versions are unchanged:
  the regression's pinned vectors (`v1_0cb67085…`, `v1_e8f7dd47…`) are
  byte-identical at `c4cb79b` and after the correction; existing
  `compile-identity`, `canonical-boundary` (57 tests ×3 runs), and
  `required-members` (807 tests ×3 runs) suites remain green.
- Inherited/exotic definitions rejected; non-enumerable declarations
  rejected; sparse arrays rejected; component props bounded to primitives;
  whitespace-only required display text rejected; invalid input produces no
  partial plan or identity; caller-owned exotic objects remain unfrozen —
  all covered by the unchanged `audit-remediation-*`, `canonical-boundary`,
  and `required-members` suites (all green throughout).
- Packed plain-JavaScript consumer (`verify:consumer`) passes.
- Typed numeric edit-save, mobile navigation, and warning-free renderer —
  covered by the unchanged `application-proof` (`example:application`),
  `verify:stage4`, and reference-app suites inside `verify:stage5` (all
  green).

## Verification evidence

Environment: Windows 11 Pro (win32-x64, MINGW64/MSYS), Node v22.13.0
satisfied by v22.13.1, npm 10.9.2, git 2.50.1.windows.1. Complete output of
every run captured to logs outside the repository.

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci` (at starting SHA; again at final state) | 0 | 276 packages, plain npm |
| `npm run typecheck` | 0 | clean |
| `npm run format:check` | 0 | clean |
| `npm run lint` | 0 | clean |
| `npm run build` | 0 | all 9 workspace packages |
| `npm run test:unit` | 0 | 57 files / 1436 tests |
| `npm run test:integration` | 0 | 1 file / 4 tests |
| `npm test` (run 1 of 3) | 0 | 61 files / 1485 tests |
| `npm test` (run 2 of 3) | 0 | 61 files / 1485 tests |
| `npm test` (run 3 of 3) | 0 | 61 files / 1485 tests |
| `npm run verify:consumer` | 0 | packed plain-JS consumer enforced |
| `npm run verify:stage2` | 0 | green |
| `npm run verify:stage3` | 0 | green |
| `npm run verify:stage4` | 0 | green |
| `npm run verify:stage5` (run 1 of 3) | 0 | green (build + 1485-test suite + reference app + packed scaffolder) |
| `npm run verify:stage5` (run 2 of 3) | 0 | green |
| `npm run verify:stage5` (run 3 of 3) | 0 | green |
| `npm run example` | 0 | green |
| `npm run bench` | 0 | green |
| `npm run example:application` | 0 | green |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` (before commit) | 0 | exactly the 9 intended files |

Full-suite arithmetic reconciliation: `npm test` 61 files / 1485 tests =
unit 57 / 1436 + renderer 3 / 45 + integration 1 / 4.
`verify:stage5` re-runs the build and the same 61/1485 suite plus the
reference-application build/suites and packed-scaffolder chain. The unit
count grew from 1426 (re-audit) to 1436: +6 snapshot-identity tests and +4
readiness-barrier tests; nothing else changed count.

## Repeat and stress evidence

| Suite | Runs | Result |
| --- | --- | --- |
| New snapshot tests (`snapshot-identity`, 6 tests, inside full unit suite) | 5 consecutive full-unit runs + numerous ladder runs | 6/6 every time |
| Canonical-boundary suite (57 tests) | 3 consecutive standalone runs | 57/57 each |
| Required-member suite (807 tests) | 3 consecutive standalone runs | 807/807 each |
| Partial-fan-out SIGKILL real-process fixture (whole `orchestration-restart` file, 6 tests incl. the formerly flaky scenario) | 10 consecutive standalone runs | 6/6 each |
| Real-process fixture under the COMPLETE parallel unit suite | 5 consecutive `npm run test:unit` runs (1436/1436 each) + 3 `npm test` + 3 `verify:stage5` | green every time |
| Packed plain-JavaScript consumer | `verify:consumer` + inside each `verify:stage5` | green every time |
| Negative control at `c4cb79b` | real worktree, independent install/build | regression FAILS there, PASSES after correction |

No failure occurred in any corrected-state run; there was nothing to
diagnose away and no run was discarded.

## Remaining genuine limitations

- Node 24 is NOT available on this machine (single system install, no nvm)
  and no second OS exists; all evidence is Windows 11 / win32-x64 / Node
  v22.13.1. Nothing was executed or claimed on other platforms.
- The readiness failure guard is bounded (60 s default in the integration
  fixture, 30 s in harness probes and the branch-completion wait); a child
  that cannot boot within the bound fails the test loudly instead of
  hanging — by design.
- The `start-join-partial` readiness now also waits for branch 'a'’s
  durable completion (bounded); this makes the fixture's documented
  scenario deterministic but adds a store-poll loop to fixture code only.
- The npm 10.9.2 arborist crash for vitest 4.x devDependency installs
  (AUDIT-INFO-2) and the `node:sqlite` experimental warning remain
  pre-existing and environmental, unchanged by this correction.

## Ready for final focused closure verification?

**YES.** The snapshot defect is corrected and regression-pinned at both
application schema revisions; the Stage 03 fixture kill decision is
readiness-based, negative-controlled, and repeat/stress-proven; the full
verification ladder and all required repeats are green; prior reports and
the system reference are byte-identical; no production orchestration
behavior changed. Stage 05 final snapshot correction is complete and ready
for final focused independent closure verification. Stage 06 has not begun.
