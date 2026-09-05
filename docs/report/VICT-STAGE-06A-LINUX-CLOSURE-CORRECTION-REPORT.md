# VICT Stage 06A — Linux Closure Correction Report

## Outcome

**CORRECTION COMPLETE — Linux closure evidence recorded; Stage 06A remains
NOT formally closed/Verified (reserved for the final focused independent
verification).**

The two Linux-specific `npm test` failures reproduced at the audited
starting SHA were corrected without weakening any test, the POSIX
containment/permission coverage was made permanent and complete, the
storage path/permission suites became part of the `verify:stage6a` exit
gate, the `VictStoreError.driverCause` default diagnostic-safety defect
was corrected by property shape, and the neutral naming discrepancy was
resolved by the preferred `memory-store` rename with a deliberate,
documented one-time schema migration.

Stage 06B and Stage 07 have NOT begun. No real provider, HTTP/SSE control
plane, capability bridge, or Stage 06B functionality was added.

## Provenance

| Item | Value |
| --- | --- |
| Repository | `https://github.com/radz2291/vict-02.git`, branch `main` |
| Required starting audit commit | `28b4a0633d9144bfae4ffd0a21dba538709975d4` (in ancestry; remote at task start) |
| Corrected implementation (in ancestry) | `5d931e36b815bd7a6c807a2dacc7cdee79469f22` |
| Boundary-remediation report (in ancestry) | `79a1ef3afdbf290d374d70c24dbc8afcd8a75b5d` |
| Remote advance found at task start | exactly one commit (`28b4a06` itself — the independent boundary audit document), preserved via fast-forward before any work began |
| Implementation SHA (this correction) | `1ac9c18fbedd3d3d6d2ae2ddd8ae2f79622903a3` |
| Final remote SHA | `1ac9c18fbedd3d3d6d2ae2ddd8ae2f79622903a3` (pushed `28b4a06..1ac9c18 main -> main`, normal fast-forward; re-fetch before the final docs push confirmed no unexpected remote advance) |
| Working tree before changes | clean (`git status --short` empty) |
| Docs commit | this report (second bounded commit) |

## Authoritative environment (Linux closure run)

| Component | Value |
| --- | --- |
| OS | Linux x86_64 — Ubuntu 24.04.4 LTS (WSL2, kernel 6.6.87.2-microsoft-standard-WSL2) |
| Node.js | **v24.19.0** (linux-x64, dedicated install) — the exact mandated runtime |
| npm | 11.17.0 |
| Git | 2.43.0 |
| Browser (Stage 05 real-browser suite) | Chrome for Testing 152.0.7977.82 via `VICT_BROWSER_PATH` (no download inside the repo; environment tooling only) |
| Provider credentials | none present; every model execution used the deterministic offline fixture; every database a disposable local file |
| Execution model | sequential full-ladder runs; no independent heavy suites run simultaneously |

The mandated environment (Linux + Node v24.19.0) was genuinely unusable at
audit time and is usable now (a WSL2 distribution was installed for this
correction); every ladder command below was executed on it.

## Exact Linux failures reproduced at the starting SHA (negative controls)

Method: an isolated checkout of `28b4a06` in `~/vict-negctl` (Linux) with
its OWN `npm ci` (447–448 packages); nothing shared with the corrected
tree — no junctions, no shared `node_modules`.

### NC-1 — the two POSIX storage-path tests (exact reproduction)

`npx vitest run packages/mastra/test/storage.path.test.ts` at `28b4a06`:

```
NC1_VITEST_EXIT=1
Test Files  1 failed (1)
Tests  2 failed | 38 passed (40)
```

- **Failure A** — `a symlink planted at the database path cannot redirect
  creation outside (POSIX)`:
  `AssertionError: expected [Function] to throw error matching
  /escape|contained/i but got 'The database file name resolves to a
  symbolic link or junction redirection; refusing before the database is
  opened.'` — the rejection was CORRECT (pre-open, sentinel intact); the
  assertion matched incidental prose instead of the structured boundary.
- **Failure B** — `a directory symlink redirection is rejected and the
  absent external target remains absent (POSIX)`:
  `Error: EEXIST: file already exists, symlink '/tmp/vict-store-dirsym-out-…'
  -> '/tmp/vict-store-dirsym-…/mastra'` — the fixture created a REAL
  directory at `<dataDir>/mastra` and then attempted to plant the symlink
  at the same path; it failed before VICT was ever exercised.

### NC-2 — raw `driverCause` is enumerable and serializes at the starting SHA

Exact assignment reproduction (` VictStoreError('VICT_STORE_UNAVAILABLE',
'safe', { operation: 'probe' }, { message: 'CANARY-DRIVER-SECRET', path:
'/secret/database.db' })`), executed on the isolated starting-SHA checkout:

```
KEYS=["code","details","driverCause","name"]
SERIALIZED={"code":"VICT_STORE_UNAVAILABLE","details":{"operation":"probe"},
  "driverCause":{"message":"CANARY-DRIVER-SECRET","path":"/secret/database.db"},
  "name":"VictStoreError"}
CONTAINS_driverCause_KEY=true
CONTAINS_MESSAGE_CANARY=true
CONTAINS_PATH_CANARY=true
SPREAD_KEYS=["code","details","driverCause","name"]
SPREAD_HAS_CANARY=true
```

This violates the documented "protected development-only, must never be
serialized" contract.

### NC-3/NC-4 — neutral-token state at the starting SHA

- NC-4 (SQLite durable boundary): with the starting-SHA schema applied,
  inserting a receipt with the OLD literal is `accepted` and with the NEW
  `memory-store` literal is `rejected` — the old Mastra-specific literal
  is the governed durable value.
- NC-5 (governed flow): the SAME `ConversationDeletionCoordinator` flow
  returns `COMPLETED_STEPS=["application-domain","mastra-memory"]` at
  `28b4a06` and `["application-domain","memory-store"]` at `1ac9c18` — so
  every corrected test asserting `memory-store` fails at the starting SHA
  and passes after the correction. Additionally the starting-SHA
  in-memory store silently accepted arbitrary receipt-step strings at
  runtime (no closed domain); the correction closes that gap (below).
- NC-3 note: the in-memory store at the starting SHA accepted the new
  literal at runtime because it had NO runtime step validation at all —
  the correction adds the closed domain to the in-memory boundary for
  parity with the SQLite CHECK.

The negative-control checkout was removed after use (`rm -rf`), and its
`node_modules` was never shared with any other tree.

## Root causes and corrections

### Failure A — correct rejection, incorrect assertion

- **Root cause:** the test asserted the incidental prose
  `/escape|contained/i` instead of the structured boundary.
- **Correction:** the test now catches the rejection and asserts:
  the error is a `VictMastraStorageError`, the code is exactly
  `VICT_MASTRA_STORAGE_PATH_ESCAPE`, the stable diagnostic does NOT echo
  the hostile target path, the file name, or the sentinel content, the
  external sentinel bytes remain identical, and the outside directory
  holds exactly the pre-existing sentinel and nothing else (no database,
  WAL, SHM, or journal files created outside). The test was not weakened
  to accept an arbitrary rejection — it pins the exact stable code.

### Failure B — invalid POSIX test setup

- **Root cause:** the fixture created `dataDir/mastra` as a real
  directory and then attempted `symlinkSync` at the same path → `EEXIST`
  before VICT was exercised.
- **Correction:** the fixture now creates `dataDir` (which exists), leaves
  `dataDir/mastra` absent, plants the directory symlink DIRECTLY at
  `dataDir/mastra`, calls `createDedicatedMastraStore()`, and asserts the
  structured containment failure (`VictMastraStorageError` +
  `VICT_MASTRA_STORAGE_PATH_ESCAPE`), that the absent external database
  and its sidecars remain absent, that the outside directory remains
  entry-for-entry unchanged, and — by removing the data directory inside
  the test — that fixture cleanup deletes the symlink ITSELF and never
  recursively follows or deletes its target. These are real POSIX tests
  (real `symlinkSync`, real filesystem), not mocked path tests.

## POSIX containment and permission evidence (permanent coverage)

`packages/mastra/test/storage.path.test.ts` now asserts, on POSIX:

- Directory mode `0700` after composition, after an actual memory write,
  after `restrictPermissions()` re-application, and after close/reopen.
- Main database mode `0600` at the same four points.
- WAL and SHM modes `0600` when those files exist (they do exist in the
  exercised WAL-mode configuration — see observed modes below); journal
  mode `0600` only if the selected SQLite mode creates it (it does not in
  the exercised WAL configuration, and the test does not require
  uncreated files).
- Owner traversal through the protected directory: `accessSync(R_OK |
  W_OK | X_OK)`, directory listing containing the database, and
  create/read/remove of a file inside the directory (0700 is not 0000).
- Structured permission-failure behavior: a new dedicated suite
  (`packages/mastra/test/storage.permissions.posix.test.ts`) injects a
  `chmod` failure SAFELY at the `node:fs` module boundary (only paths
  carrying a canary marker fail; every other path takes the real
  implementation) and proves that a failed POSIX permission operation
  during composition and during direct `restrictStorePathPermissions()`
  surfaces as `VictMastraStorageError` with code
  `VICT_MASTRA_STORAGE_PERMISSION`, with a non-echoing message (no raw
  driver error, no path), while a non-injected path still composes
  successfully through the real `chmod` (guard against an over-broad
  mock).

**Exact modes observed on Linux/Node v24.19.0** (dedicated probe,
composing with `fileName: 'store.db'` and writing one real message):

| Point | Directory | Database | WAL | SHM | Journal |
| --- | --- | --- | --- | --- | --- |
| After composition | `0700` | `0600` | — | — | — |
| After actual memory write | `0700` | `0600` | `0600` | `0600` | absent |
| After `restrictPermissions()` | `0700` | `0600` | `0600` | `0600` | absent |
| After close/reopen | `0700` | `0600` | `0600` | `0600` | absent |

The exercised SQLite journal mode is WAL (the VICT driver sets
`PRAGMA journal_mode = wal` for file databases), so SQLite creates
`-wal`/`-shm` sidecars and no `-journal` file; the tests assert the
sidecars that exist and do not require the one SQLite does not create.
Windows retains its honestly documented best-effort ACL limitation (POSIX
bits are not honored there and are never claimed); the win32 junction
containment coverage is unchanged.

## `verify:stage6a` now gates the storage suites

`scripts/verify-stage6a.mjs` gained a dedicated section that runs

```
packages/mastra/test/storage.path.test.ts
packages/mastra/test/storage.permissions.posix.test.ts
```

via vitest and FAILS the Stage 06A verifier on any failure. On POSIX the
real symlink and permission assertions run; on Windows the POSIX-only
cases skip (the win32 junction coverage runs instead). A Linux full-suite
storage failure can therefore no longer coexist with a silently passing
`verify:stage6a` — demonstrated in this correction's own first WSL ladder
run, where `verify:stage6a` correctly FAILED (`storage path/permission
suites pass on this platform`) while the (then-buggy) traversal test was
failing, and passed after the fix. The neutral declaration scan was also
extended to the lowercase `mastra` token, so no Mastra-specific type or
lifecycle token can re-enter neutral emitted declarations.

## `driverCause` diagnostic-safety policy and adversarial results

**Policy (now enforced by property shape in
`packages/runtime/src/store-errors.ts`):** the raw driver cause is
defined `Object.defineProperty(this, 'driverCause', { value, enumerable:
false, writable: false, configurable: false })`:

- Absent from `JSON.stringify(error)`, `Object.keys(error)`, object
  spread (`{...error}`), `Object.entries(error)`, enumerable
  own-property views, and `structuredClone` snapshots (the persistable
  diagnostic path) — therefore absent from ordinary serialized
  diagnostics and persisted errors/events/history.
- Still programmatically readable as `error.driverCause` for authorized
  local development diagnostics (same object identity, verified).
- Not writable and not configurable: strict-mode reassignment throws
  `TypeError`; `Object.defineProperty(..., { enumerable: true })` throws.
- Deliberately NOT copied to `Error.cause` (which would create another
  observable serialization/persistence path); `error.cause` is
  `undefined`.
- Public `code`, safe `message`, `name`, and safe `details` remain
  usable (`code`/`details`/`name` in serialization; `message`
  programmatically, as Error-native non-enumerable).

**Adversarial suite** (`packages/runtime/test/store-errors.driver-cause.test.ts`)
plants unique canaries in: a plain object with enumerable canary fields
(including a nested canary and a path canary), a normal `Error` with a
canary message and a nested cause, a hostile getter cause (read-count
asserted: never read during serialization, exactly once on explicit
programmatic access), and a representative SQLite driver error
(`ERR_SQLITE_ERROR`, errcode 26, canary message and stack) wrapped via
`storeUnavailable` (including the BUSY classification path). Every
serialized surface is searched; all canaries and the `driverCause` key
are asserted ABSENT, and the property descriptor is asserted
non-enumerable/non-writable/non-configurable.

**Linux probe result at the corrected SHA:**
`P1_RESULT=PASS (no canary/driverCause leak on any surface)` — covering
the assignment's exact reproduction plus all four adversarial cases.
Existing intentional inspection of `driverCause` was verified unaffected:
the only production readers are documentation comments and
`storeUnavailable`'s wrapping (cause passed through construction, never
serialized); the pre-existing conformance check "serialized does not
contain `driverCause`" still passes, now enforced by shape rather than
convention.

## Neutral naming decision

**Decision: RENAME to the implementation-neutral lifecycle token
`memory-store` (the preferred direction).** The literal `mastra-memory`
no longer exists in any neutral source, type, governance rule, durable
schema domain, emitted declaration, test, or verifier expectation.

- Neutral type: `AgentDeletionStep = 'application-domain' |
  'memory-store'` (`packages/runtime/src/agent-governance.ts`); error
  texts updated; governance logic, receipt ordering, and coordinator flow
  updated coherently (`completedSteps` policy order preserved:
  `application-domain` first).
- In-memory store: now enforces the closed step domain
  (`VICT_AGENT_DELETION_RECEIPT_STEP_INVALID` for unknown steps) — parity
  with the SQLite CHECK constraint; previously it silently accepted
  arbitrary step strings at runtime.
- SQLite: migration history is preserved verbatim (version 3 keeps its
  original CHECK text — a record of what v3 databases contain). A NEW
  migration `4 agent-governance-neutral-memory-store-step` rebuilds
  `vict_agent_deletion_receipt` with the new CHECK
  `('application-domain', 'memory-store')` and deterministically rewrites
  any pre-verification `mastra-memory` receipt rows exactly once
  (`CASE step WHEN 'mastra-memory' THEN 'memory-store' ELSE step END`),
  preserving `intent_id`, `at`, and the primary key; receipt ordering is
  deterministic and unchanged (`ORDER BY step ASC` keeps
  `application-domain` first before and after the rename — `a` < `m`).
- **Pre-verification records decision:** Stage 06A is pre-verification
  and unshipped, so a deliberate, documented one-time migration was
  chosen over fail-closed rejection: persisted receipt values are never
  silently reinterpreted (the rewrite is explicit, atomic with the
  version row, logged in the migration name/comment, and covered by a
  dedicated regression test that asserts exact receipt rows, the
  untouched intent record, and that the OLD literal is now rejected by
  the CHECK for new writes — fail closed for the legacy token going
  forward).
- Emitted declarations verified Mastra-free (P3 probe + extended
  `verify:stage6a` lowercase scan): `contracts`, `sdk`, `kernel`,
  `runtime` declarations contain no `mastra` token in any case.
- Deterministic recovery re-verified: the fresh-process recovery proof
  inside `verify:stage6a` asserts exactly one receipt per step —
  `['application-domain', 'memory-store']` — after close/reopen and
  crash/resume, on the corrected schema.
- Architecture wording: with the rename, the STAGE-06A architecture
  statement "no neutral source, declaration, or emitted `.d.ts`
  mentions Mastra" is now literally true; no narrowing was required. The
  normative AI-002 rule (no Mastra dependencies or types in neutral
  packages) was already satisfied and remains the enforced invariant.

## Negative-control summary

| Control | At `28b4a06` (starting SHA) | At `1ac9c18` (corrected) |
| --- | --- | --- |
| NC-1 storage-path POSIX tests | **FAIL (exit 1)** — exactly the two documented failures (prose assertion; EEXIST fixture) | PASS (structured assertions) |
| NC-2 `driverCause` serialization | **LEAKS** — `driverCause` key + both canaries in `JSON.stringify`, `Object.keys`, spread | PASS — no canary/driverCause on any surface; programmatic access intact |
| NC-4 SQLite receipt-step CHECK | old literal accepted; `memory-store` **rejected** | `memory-store` accepted; old literal rejected (CHECK + in-memory closed domain) |
| NC-5 governed-flow steps | `["application-domain","mastra-memory"]` | `["application-domain","memory-store"]` |

All corresponding tests pass after correction (full ladder below). The
isolated starting-SHA checkout and its `node_modules` were removed after
the controls were captured.

## Complete command ladder (authoritative Linux run)

Fresh clone from GitHub (`~/vict-final`), no `dist` directories before
build, Node v24.19.0, npm 11.17.0, sequential execution:

| Command | Exit | Observed result |
| --- | --- | --- |
| `npm ci` | 0 | clean lockfile install (447 packages) |
| `npm run typecheck` | 0 | strict, run BEFORE build |
| `npm run format:check` | 0 | "All matched files use Prettier code style!" |
| `npm run lint` | 0 | clean |
| `npm run build` | 0 | all ten packages build |
| `npm run test:unit` | 0 | 68 files / **1,605 tests** |
| `npm run test:integration` | 0 | 1 file / **4 tests** |
| `npm test` | 0 | 81 files / **1,777 tests** |
| `npm run verify:consumer` | 0 | packed neutral consumer passes |
| `npm run verify:stage2` | 1 → **0 (quiet re-run)** | first run: `[sqlite] HIGH-3` exceeded its documented 5 s vitest timeout (5,024 ms) under post-`npm test` machine state; quiet re-run exit 0. Complete output captured |
| `npm run verify:stage3` | 0 | orchestration suites |
| `npm run verify:stage4` | 1 → **0 (quiet re-run)** | first run: `[sqlite] blocked resolution…` observed `invokeCount` 0 (expected 1) — the documented 20 ms write-deadline race (deadline expired before the invoke was scheduled); quiet re-run exit 0 |
| `npm run verify:stage5` | 1 → 1 → **0 (second re-run)** | first run: HIGH-3 5 s timeout inside the full-suite portion (reference-app portion 44/44 incl. the 13 real-browser tests); re-run 1: the OTHER documented timing race (`blocked resolution…`) in the same file class (HIGH-3 passed); re-run 2: **81 files / 1,777 tests + 44/44 incl. browser, exit 0** |
| `npm run verify:stage6a` | 0 | all checks passed — package inspection, declaration scans (now including lowercase `mastra`), packed neutral + adapter consumers, exact pinned versions, storage path/permission gate, fresh-process proofs with `memory-store` receipts |
| `npm run example` | 0 | ARA proof: 13 ordered events |
| `npm run bench` | 0 | 10 events per completed run |
| `npm run example:application` | 0 | Stage 04/05 application proof |
| `git diff --check` | 0 | clean |
| `git status --short` | 0 (empty) | clean |

**All 19 command groups exit 0** — seventeen in the single main pass and
three (`verify:stage2`, `verify:stage4`, `verify:stage5`) on documented
quiet re-runs after pre-existing Stage 03 timing sensitivity (analyzed
below, unchanged by this correction). The identical ladder was also
executed on a bundle-cloned working tree (`~/vict-work`, same SHA) where
ALL NINETEEN commands exited 0 in a single pass — demonstrating the
re-runs address environmental scheduling variance, not a deterministic
defect. The three affected tests also pass standalone repeatedly
(`orchestration-conformance.test.ts`: 48/48, observed seven consecutive
times across the session).

### Honest record of initial failures on Linux (later passes, with causes)

Three classes of initial failures were recorded and resolved; none is
caused by this correction's code changes:

1. **First working-tree ladder run — the two new suites had a defect and
   the environment lacked a browser:**
   - `verify:stage6a` exit 1 — the NEW storage-suite gate correctly
     caught a genuine defect in THIS correction's traversal test: it
     asserted mode `0600` on an arbitrary caller-created file, which is
     governed by the process umask (observed `0644`). The test was
     corrected (the owner-only policy is asserted on STORE-owned files;
     the probe file proves traversal only), and `verify:stage6a` then
     passed completely — demonstrating exactly the "full suite cannot
     fail while `verify:stage6a` silently passes" property the gate was
     added for.
   - `verify:stage5` exit 1 — the real-browser suite threw
     `No Chrome/Edge installation found` (the fresh WSL had no browser;
     the test's discovery list contains only Windows paths plus
     `VICT_BROWSER_PATH`). Resolved by installing Chrome for Testing
     into the environment; no repository code changed. After that, all
     13 browser tests pass on Linux, every time.
2. **The two pre-existing Stage 03 timing sensitivities** (both also
   documented by the independent audit, finding #5, and observed on
   Windows during the prior remediation session):
   - `[sqlite] HIGH-3: authorized operator fail…` carries a **5 s**
     vitest timeout while normally completing in ~330 ms; under full-suite
     memory/cache pressure on WSL2 it exceeded 5 s once in the first
     working-tree ladder, once in the fresh-clone `verify:stage2`, and
     once in the fresh-clone `verify:stage5`. It passed standalone and in
     every quiet re-run.
   - The 20 ms write-deadline race family (`unsafe write timeout blocks
     without replay…`, `[sqlite] blocked resolution…`): the graph pins a
     **20 ms** node deadline against a ~200 ms capability; if WSL2
     scheduling delays the invoke past the deadline, the run blocks
     before the invoke (`invokeCount` 0 instead of 1). Observed once in
     the first working-tree ladder (`unsafe write…`), once in the
     fresh-clone `verify:stage4`, and once in `verify:stage5` re-run 1
     (`blocked resolution…`, with HIGH-3 passing). The file passes
     standalone 48/48 every time (seven consecutive observations).
   - Neither involves any file this correction touched (Stage 03
     orchestration/store code and conformance suites are unchanged); the
     identical SHA passed `npm test` (81 files) twice and all three
     verifiers on quiet re-runs and in the working-tree single pass.
   - Per the mandate, no timeout was increased, no sleep added, and no
     test weakened to mask this; the failures, causes, and passes are
     recorded verbatim here for the independent closure auditor.

### POSIX storage suite repetition

Five consecutive runs of the storage path/permission suites on Linux:

```
STORAGE_RUN_1_EXIT=0 … STORAGE_RUN_5_EXIT=0
```

## Windows verification (secondary, Node v22.13.1 / npm 10.9.2)

On the development Windows working tree: `typecheck`, `format:check`,
`lint`, `build`, and the full `npm test` (79 files / 1,761 tests at the
pre-fix intermediate state; 1,777 after the new suites) all exit 0; the
win32 junction containment tests run, POSIX-only cases skip honestly.
Environment note: the local untracked `.pi/` agent-tooling directory
causes eslint noise locally (it is not repository content and is not
part of any commit; the repository's own lint is clean, as the Linux run
confirms).

## Files changed

Implementation/verification (`fix(stage-06a): close linux and diagnostic
safety gaps` — `1ac9c18`):

- `packages/runtime/src/store-errors.ts` — `driverCause` non-enumerable,
  non-writable, non-configurable; not copied to `Error.cause`.
- `packages/runtime/test/store-errors.driver-cause.test.ts` — NEW
  adversarial canary suite (plain object, Error+cause, hostile getter,
  SQLite driver error, shape/lock/persistable-snapshot assertions).
- `packages/mastra/test/storage.path.test.ts` — Failure A structured
  assertions; Failure B fixture fix + cleanup-does-not-follow proof;
  extended permanent POSIX permission coverage (write, re-apply,
  reopen, traversal, existing-sidecar modes).
- `packages/mastra/test/storage.permissions.posix.test.ts` — NEW safely
  injected chmod-failure suite (structured `VICT_MASTRA_STORAGE_PERMISSION`).
- `packages/runtime/src/agent-governance.ts` — `memory-store` rename;
  closed in-memory step domain (`VICT_AGENT_DELETION_RECEIPT_STEP_INVALID`).
- `packages/store-sqlite/src/agent-governance-adapter.ts` — rename.
- `packages/store-sqlite/src/migrations.ts` — NEW migration 4
  (`agent-governance-neutral-memory-store-step`): deterministic one-time
  receipt-step rebuild; v3 history untouched.
- `packages/store-sqlite/test/migrations.test.ts` — NEW migration-4
  regression (exact receipt rewrite, intent untouched, legacy literal
  now rejected).
- `packages/runtime/test/agent-governance-receipts.test.ts` — rename +
  closed-step-domain regression.
- `packages/runtime/test/agent-governance.test.ts`,
  `packages/store-sqlite/test/agent-governance-adapter.test.ts`,
  `packages/store-sqlite/test/agent-governance-corrective.test.ts`,
  `packages/mastra/test/adapter.restart.test.ts` — rename.
- `scripts/verify-stage6a.mjs` — storage path/permission suites added to
  the exit gate; neutral declaration scan extended to lowercase
  `mastra`; fresh-process receipts expectation renamed.

Documentation (`docs(stage-06a): record linux closure correction`):

- `docs/report/VICT-STAGE-06A-LINUX-CLOSURE-CORRECTION-REPORT.md` — this
  report (NEW).

NOT modified: `docs/report/VICT-STAGE-06A-INDEPENDENT-BOUNDARY-AUDIT.md`
(preserved byte-for-byte; never staged), every other historical report,
and the Stage 06A Verified/closed status in
`docs/VICT-SYSTEM-REFERENCE.md` (Stage 06A remains NOT formally closed).

## Preservation confirmation

No regression was introduced in: receipt-backed deletion state
transitions (full receipts suite + fresh-process recovery green),
mandatory shared deletion fencing, post-deletion resurrection prevention,
pre-open storage containment (all containment suites green on both
platforms), activation-record content validation, `vict.agent-activation@3`,
resolved subagent identity pinning, restored `createdAt`, tool-budget
terminal failure, sanitized tracing/guardrail/contract/tool/credential
boundaries, ten-year retention arithmetic (`MAX_RETENTION_AGE_MS`
unchanged at 315,360,000,000), offline-only verification (no credentials
in either environment), or Stage 01–05 behavior (stages 2–5 verifiers
green on Linux). The rename is purely a data-literal change covered by
the durable migration; no package ownership changed and no Stage 06B
concept was introduced.

## Remaining genuine limitations

- **Final independent verification is intentionally not performed here.**
  This report is implementation-side evidence; the focused independent
  closure verification (including re-derivation of the POSIX assertions
  and canary scans) belongs to the independent auditor.
- The two pre-existing timing sensitivities documented by the audit
  (the 20 ms unsafe-write/blocked-resolution deadline race and the HIGH-3
  5 s timeout) remain: on WSL2 each was observed to trip occasionally
  under full-suite machine pressure (HIGH-3 three times, the deadline
  race three times, in different runs — never both at once), while the
  affected file passed standalone 48/48 on seven consecutive
  observations and every full-suite run passed either in the main pass
  or on a quiet re-run. They are Stage 03 test-timing properties,
  unchanged by this correction, and remain candidates for a future
  governed Stage 03 test-robustness change (clock injection), which was
  deliberately NOT attempted here to keep this correction narrowly
  bounded.
- The exercised SQLite journal mode is WAL: `-journal` sidecars are never
  created and are therefore asserted only conditionally (per the
  requirement not to require files SQLite does not create). Rollback-
  journal mode coverage would require a different journal-mode
  configuration and is not exercised here.
- `verify:stage5`'s real-browser suite requires a browser executable;
  on a bare Linux host without `VICT_BROWSER_PATH` (or a standard
  install path) it fails with a clear environment error. The Linux
  closure evidence uses Chrome for Testing 152.0.7977.82.
- WSL2 was used as the Linux environment (Ubuntu 24.04.4, kernel
  6.6.87.2). It is genuine Linux x86_64 with the exact mandated Node
  v24.19.0; native bare-metal behavior is not claimed beyond that.
- Windows POSIX-mode emulation remains the documented best-effort
  limitation; nothing in this correction claims Windows mode bits prove
  POSIX security.
