# VICT Stage 05 — Application Delivery Report

## Outcome

STAGE 05 IMPLEMENTED — READY FOR FRESH INDEPENDENT AUDIT

## Starting and final SHAs

- **Starting SHA (required, confirmed as remote tip before work):** `acf962532ac147daefe27d603dfdc8ef9a69a131`
- **Final implementation SHA:** `03a04a96a3c11be641305bf035033a83d6ef82f0` (verified by the complete ladder in a fresh clone)
- **Final remote SHA (origin/main):** `03a04a96a3c11be641305bf035033a83d6ef82f0`
- Intermediate commits: `8d0ecb3` (implementation), `4d5ed92` (fresh-clone-found typecheck-alias fix), `03a04a9` (spawn-test timeout fix).

## Architecture delivered

Recorded in `docs/architecture/STAGE-05-APPLICATION-DELIVERY.md`:

- the canonical SvelteKit renderer and generic application host
  (`@vict/renderer-svelte`, host page `VitApp`, one generic catch-all route
  in every delivered application);
- the extended neutral surface vocabulary as an explicit
  `vict.application@2` schema marker with a documented compatibility path
  (`vict.application@1` unchanged, identity markers `vict.application-identity@1/@2`);
- the one-time application-host scaffolder (`@vict/scaffolder`);
- the production SQLite application-domain adapter with a separate versioned
  migration API (`@vict/appdata-sqlite`; OPEN-014 decision);
- safe generated CRUD through the typed action/data/authorization boundaries;
- the complete §17.10 reference application proof (`examples/reference-app`).

## Package dependency graph

```text
@vict/contracts
       ↓
@vict/sdk
       ↓
@vict/kernel
       ↓
@vict/runtime
       ↓
@vict/store-sqlite                      (Vict operational stores — untouched)

@vict/contracts + @vict/sdk
       ↓
@vict/application
       ↓                ↓               ↓
@vict/renderer-svelte  @vict/appdata-sqlite  @vict/scaffolder
       ↓
examples/reference-app
```

Acyclic; Svelte only in the renderer boundary, SQLite only in the two
SQLite adapter boundaries, runtime only below the spine. `@vict/application`
remains browser-safe and free of Svelte/SvelteKit/SQLite/Zod/runtime types
(Stage 04 declaration scans still pass inside `verify:stage4`/`verify:consumer`).

## Application model and version compatibility

- `vict.application@1` is UNCHANGED: exact Stage 04 field sets, validation
  semantics, and identity vectors (all pre-existing identity tests pass
  byte-identically — 64 application-package tests including the original
  conformance and identity suites).
- `vict.application@2` adds the Stage 05 vocabulary: list/table/detail/
  chart/status/tabs/dialog/drawer/conversation surfaces, route parameters
  and redirects, breadcrumbs, `visibleWhen`/`disabledWhen` safe conditions,
  `stale`/`partial` states, and closed theme-token assignments
  (`THEME_TOKEN_NAMES`, safe-value validation).
- Identity markers: `@1` → `vict.application-identity@1` (unchanged
  vectors); `@2` → `vict.application-identity@2` (explicit marker for the
  extended manifest shape; same canonicalization algorithm).
- Closed-field validation, deep capture, immutability, deterministic
  canonicalization, hostile-input structural diagnostics, and
  insertion-order independence all continue to hold and are tested for @2
  definitions.

## Renderer and built-in roles

`@vict/renderer-svelte` implements every built-in role (text with heading
levels, view, list, table with search/filter/sort/pagination, detail, form
with prefill/edit, chart, status, tabs, dialog, drawer, conversation,
action, custom-component slot) plus breadcrumbs, responsive navigation, and
the full state vocabulary (loading, empty, validation, denied, stale,
partial, safe failure). Route resolution (parameters + redirects) is
deterministic and shared by the client host and the server load. Structural
validation fails with `RENDERER_*` diagnostics before any unsafe rendering;
an update that breaks resolution renders an explicit structured failure
panel (never stale content).

## Svelte reactivity correction

The carried-forward `state_referenced_locally` issue is closed at the
source: all prop-derived values in the renderer are `$derived`/reactive
`$state` props; the reference application build emits ZERO Svelte warnings
and `verify:stage5` FAILS if `state_referenced_locally` or any
vite-plugin-svelte warning appears. Permanent tests update path, plan, rows,
and registry WITHOUT remounting and prove no stale resolution.

## Theme and accessibility

Renderer-owned semantic tokens (closed vocabulary, safe values) are applied
as CSS custom properties on the host element. Built-ins ship accessible
defaults: landmarks, labelled fields, `aria-sort`, `aria-current`, live
regions, dialog focus trap/Escape/restore, tablist keyboard model, chart
`role="img"` summary + data-table equivalent, reduced-motion CSS, visible
focus, and responsive behavior with no unusable overflow (asserted in a
real browser at 390x844).

## Component registry and code islands

Stage 04's versioned registry is unchanged (exact id/revision resolution,
duplicate rejection, frozen identity snapshots) with new adversarial tests:
registry swap WITHOUT remount, revision drift producing a structured failure
(not stale components), and release compilation sourced from the REAL
registry snapshot. Custom components receive only declared primitive props
(`cmp.health@1` in the reference proof).

## Scaffolder

Deterministic (byte-identical trees), non-destructive (conflict refusal
with an explicit file list; author code islands never touched), path-safe
(traversal/junction-escape refusals), idempotent (`unchanged` on rerun),
and usable from packed tarballs: `verify:stage5` installs the PACKED
scaffolder in an isolated consumer, generates a host whose dependencies are
the packed tarballs, and installs+builds it in isolation. The generated
project also type-checks and builds from workspace sources (unit suite).

## Application-data adapter and migrations

`@vict/appdata-sqlite`: parameterized `json_extract` queries over validated
catalogue fields, filters/search/sort/pagination/projection, contract-bound
mutations, atomic `BEGIN IMMEDIATE` transactions, in-transaction keyed
idempotency (never consumed by failures, never reconciled across payloads or
resources), defensive copies, WAL + `synchronous=FULL` + foreign keys +
busy timeout (pragma-verified), hostile-input structured diagnostics on
BOTH adapters (LOW-C-1 closed), SQL-injection resistance suites, and a
separate, explicit, transactional, forward-ordered migration API
(`APPDATA_*` failures) with inspectable history, future-schema fail-closed
behavior, injected-failure rollback, and physical namespaces disjoint from
operational tables.

## Generated CRUD

Declared resources produce list/table/detail/create/edit/delete
presentations through the neutral plan. Every operation crosses
`UI intent → typed action/data boundary → authorization → contract
validation → effect policy → durable mutation`; the reference proof's admin
delete is visible but DENIED at the boundary. Resources without declared
operations receive no generated capability (adapter `DATA_MUTATION_NOT_DECLARED`).

## Reference application proof

One neutral `vict.application@2` definition plus explicit bindings produces
the complete application (dashboard with chart + capability-produced
metrics, conversation with a real Vict processing run, records table,
create/edit forms, detail with tabs/dialog/drawer/status, custom island,
theme customization, redirect route). The BUILT application runs as a real
Node process and is exercised over HTTP (12 tests, incl. SIGKILL restart
with full data survival) and in a real Chromium browser (8 tests, desktop
1280x800 and mobile 390x844).

## Security and leakage evidence

- Hostile-container diagnostics: stable, non-echoing, shared-suite covered
  on both adapters (throwing getters, revoked proxies, enumeration traps,
  cyclic containers, exotic prototypes; mutation-side hostile input;
  post-hostile traffic still served).
- Canaries (scripts, event handlers, hostile props, nested causes, hostile
  filter keys, contract-reject payloads, 404 paths) are asserted absent from
  rendered DOM, SSR output, HTTP error bodies, and diagnostics; intended
  application data is asserted present and inert (escaped text).
- Local actions never cross the dispatcher (renderer test + HTTP test).
- No `{@html}`, no raw-HTML feature, no CDN/telemetry; fully offline.

## Files changed

- **New packages:** `packages/renderer-svelte` (11 src + 3 test files),
  `packages/appdata-sqlite` (3 src + 5 test files), `packages/scaffolder`
  (2 src + 1 test file).
- **Extended packages:** `packages/sdk/src/application.ts`, `index.ts`
  (@2 vocabulary); `packages/application/src/{compile,data,data-conformance,
  renderer-conformance,index}.ts` + tests (compiler v2, search, hostile
  hardening, conformance extensions).
- **New example:** `examples/reference-app` (definition, release, server
  core + SQLite wiring, custom component + registry, generic routes, 4 test
  suites, README).
- **Repo wiring:** root `package.json` (build order, `verify:stage5`),
  `package-lock.json`, `vitest.config.ts` (renderer project + aliases),
  `tsconfig.json` (new package + subpath aliases, example exclusions),
  `.gitignore`, `.prettierignore`, root `README.md`.
- **Docs:** `docs/architecture/STAGE-05-APPLICATION-DELIVERY.md`, this
  report.
- **Preserved byte-for-byte:** every prior audit and report document; the
  owner's unstaged deletions of the two root-level Stage 02 documents were
  left untouched (never staged or committed by Stage 05).

## Verification evidence

| Command | Exit status | Observed result |
|---|---|---|
| `npm ci` | 0 | clean install (workspace + example deps) |
| `npm run typecheck` (no dist) | 0 | clean (root paths cover all subpaths) |
| `npm run format:check` | 0 | all files formatted |
| `npm run lint` | 0 | no findings |
| `npm run build` | 0 | 9 packages emit cleanly |
| `npm run test:unit` | 0 | 53 files, 562 tests |
| `npm run test:integration` | 0 | 1 file, 4 tests |
| `npm test` | 0 | 55 files, 595 tests (3× consecutive in dev; 5× consecutive in fresh clone) |
| `npm run verify:consumer` | 0 | packed-tarball consumers pass |
| `npm run verify:stage2` | 0 | PASSED |
| `npm run verify:stage3` | 0 | PASSED |
| `npm run verify:stage4` | 0 | PASSED |
| `npm run verify:stage5` | 0 | all checks passed (build, 595 tests, warning-free reference build, 38 reference tests, packed scaffolder generation+install+build) |
| `npm run example` | 0 | ARA proof: exactly **13** ordered events |
| `npm run bench` | 0 | benchmark: exactly **10** events per completed run |
| `npm run example:application` | 0 | Stage 04 proof: 17/17 |
| `git diff --check` | 0 | clean (fresh clone) |
| `git status --short` | 0 | clean worktree after full ladder (fresh clone) |

Fresh-clone specifics (`C:\Users\RZ1\AppData\Local\Temp\vict-fresh-clone`,
commit `03a04a9`): initial clone had **zero** generated `dist` artifacts and
an empty `git status`; `typecheck` ran BEFORE `build` from that clean state
(after the subpath-alias fix). The complete ladder above was executed
inside the fresh clone. One transient failure occurred on the clone's very
first full-suite run (scaffolder CLI test exceeding vitest's default 5s
timeout while spawning three tsx child processes under load); fixed with an
explicit 120s test timeout and followed by **five consecutive clean
595/595 runs**; the incident and fix are recorded in commits
`03a04a9` (fix) and this report.

## Regression matrix

| Requirement | Pass/Fail | Evidence |
|---|---|---|
| Every required built-in role | PASS | renderer role-coverage test (15 roles through the real compiler) |
| Closed-field validation | Pass | @2 compile diagnostics suites (@vict/application, reference fixtures) |
| Deterministic canonicalization + stable identity | Pass | compile-identity suites; reference identity suite |
| Identity changes for semantic changes; renderer revisions excluded | Pass | packages/application tests; reference definition suite |
| Insertion-order independence | Pass | existing identity suites (unchanged vectors) |
| Caller mutation isolation / hostile objects | Pass | canonical-domain + hostile-container suites |
| Schema-version compatibility | Pass | @1 identity vectors unchanged; @2 explicit marker tests |
| All renderer roles + UI states | Pass | renderer + reference DOM suites (loading/empty/validation/denied/stale/partial/failure) |
| Route/redirect behavior; no stale resolution | Pass | resolveRoute suites; no-remount reactivity tests |
| Warning-free Svelte build | Pass | verify:stage5 warning checks (build fails on warnings) |
| Mobile + desktop rendering; keyboard/focus; chart equivalent | Pass | real-browser suites (puppeteer + axe) |
| XSS-safe rendering; custom-component isolation | Pass | canary DOM suites |
| Scaffolder: fresh/deterministic/idempotent/conflict/traversal/symlink/islands/packed/build | Pass | scaffolder suites + verify:stage5 packed check |
| App-data conformance (both adapters), CRUD, filter/sort/page/projection | Pass | shared suite × 2 adapters |
| Authorization ordering; idempotency scope/conflict; rollback; concurrency; defensive copies; close/reopen; fresh-process restart | Pass | appdata-sqlite suites (real child-process fixtures) |
| Migration ordering/rollback/future-schema; operational separation | Pass | migrations + restart suites |
| Hostile getters/proxies; SQL-injection resistance | Pass | conformance scenario 17; sql-safety suites |
| Release identity layering; missing/mismatched binding context fails closed | Pass | @vict/application release suites; reference release suites |
| Stage 01–04 behavior intact | Pass | verify:stage2/3/4 PASSED; ARA 13 events; bench 10 events; 595 root tests include all prior suites |
| Neutral SDK/application consumers isolated (no Svelte/SQLite/runtime/Zod) | Pass | verify:consumer + verify:stage4 declaration scans |
| Optional Zod adapter functional | Pass | verify:stage4 zod-consumer checks |

## OPEN-013 decision

**Renderer-owned native components; no external UI or chart library.**
Recorded with the full evaluation (license/weight/maintenance, Svelte 5 +
SSR compatibility, accessibility incl. the chart's textual/tabular
equivalent, offline determinism, absence of telemetry/CDN, library-type
containment, theming, packed behavior) in
`docs/architecture/STAGE-05-APPLICATION-DELIVERY.md` §13. No
component/chart library types exist in `@vict/application` or `@vict/sdk`.

## OPEN-014 decision

**Separate, explicit, versioned application-domain migration API** —
`ApplicationDataMigration { id, version, name, statements }` with
transactional application, bookkeeping in `vict_appdata_migrations`
(disjoint from `vict_schema_migration` and all operational tables), forward
ordering, duplicate-identity conflicts, injected-failure rollback,
future-schema fail-closed behavior, inspectable history, and
`migrationsFromResources` for the common bootstrap. No destructive
inference from definition diffs; physical schema versions are independent
of application/resource revisions. Details in the architecture document §10.

## Compatibility decisions

- `vict.application@2` with preserved `@1` semantics and byte-identical @1
  identity vectors (documented in the architecture document §2).
- `vict.application-identity@2` marker for @2 definitions.
- The application-data port gains one additive, closed, typed field
  (`search`) with identical semantics in both adapters; all pre-existing
  request semantics unchanged.
- The shared renderer conformance suite's role vocabulary now includes the
  Stage 05 roles; the canary scenario inspects LIVE output before teardown
  (stronger evidence; Svelte 5 teardown detaches rendered content).

## Remaining genuine limitations

- Computed/derived summary views are not part of the neutral model; the
  reference proof produces dashboard metrics through a declared capability
  writing real application-domain rows (documented pattern).
- Table filters are exact-match equality (no query language by design);
  charts support bar/line encodings only.
- The scaffolder owns the initial host only; host upgrades are manual.
- Node 24 and a second operating system were NOT available in this
  environment; the complete ladder was executed on Windows (win32-x64,
  Node v22.13.1) only — recorded as an environmental limitation, not a
  claim. A second Node runtime was not available either.
- One transient scaffolder CLI timeout flake occurred on the first
  fresh-clone run and was fixed with an explicit timeout (commit
  `03a04a9`); 5+ subsequent full fresh-clone runs were clean.
- Screen-reader UX beyond automated axe coverage was not manually evaluated
  in this stage.

## Ready for independent audit?

YES

---

### Environment

- Node v22.13.1 (>= 22.13.0), npm 10.9.2, Windows (MINGW64_NT-10.0-26200,
  win32-x64).
- Browser scenario runtime: locally installed Google Chrome via
  puppeteer-core (no download, no telemetry).
- Node 24 and a second OS were NOT available; this is recorded accurately
  and no claim is made for them.

### Counts

- Root vitest suite: 55 files, 595 tests (unit 562 / integration 4 /
  renderer 29); repeat runs: 3× consecutive (dev) + 5× consecutive (fresh
  clone) after the timeout fix, all green.
- Targeted repeat runs (3× each): renderer project 29/29; appdata-sqlite +
  scaffolder 27/27.
- Stage 04 SvelteKit proof: 17/17 (`example:application`).
- Reference application: 38 tests — definition 8, DOM 10, real-process HTTP
  12 (incl. SIGKILL restart), real-browser 8 (desktop + mobile, axe).
- ARA proof: exactly 13 events. Benchmark: exactly 10 events per completed
  run.
- Packed-consumer evidence: `@vict/scaffolder` from tarball; generated host
  installs and builds against the packed renderer/application/data stack.
- Fresh-process restart evidence: appdata package child-process fixtures
  (rows + keyed idempotency across processes) and the built reference app
  SIGKILL/restart over the same SQLite file (all rows intact).

### Commit list

```text
8d0ecb3  feat(stage-05): deliver complete application renderer and storage
4d5ed92  fix(stage-05): map the @vict/application/renderer subpath in the root typecheck paths
03a04a9  fix(stage-05): give the scaffolder CLI spawn test an explicit timeout (three tsx child processes under load)
(docs commit follows this report)
```

### Fresh-clone evidence

- Cloned from the pushed implementation commit; HEAD `03a04a9` (after the
  two fix commits, both verified in the same fresh clone by pulling).
- Initial state: empty `git status`, zero `dist` artifacts.
- Complete ladder executed and green (see table); `git diff --check` and
  `git status --short` clean afterward.
- Temporary clone, databases, and browser output removed after evidence
  collection; no probe scripts committed.