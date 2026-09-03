# VICT Stage 05 — Independent Closure Audit

## Verdict

**VERIFIED WITH NON-BLOCKING ISSUES**

The final exit-gate correction (commit `23930e7`, with documentation commits
`1dc9083`, `0a842f9`, `9fa89e4`) is accurate. Every claim in
`docs/report/VICT-STAGE-05-FINAL-CORRECTION-REPORT.md` that this audit tested
independently reproduced. The runtime compiler now rejects every malformed
definition that omits a member the public authoring model declares required,
for BOTH `vict.application@1` and `vict.application@2`, with structured,
deterministic, non-echoing diagnostics, and never issues a partial plan or an
`applicationVersion` for invalid input. Valid `@1` and `@2` definitions keep
byte-identical canonical manifests and identity vectors across the correction
(proven with auditor-constructed fixtures at both `d346bad` and `9fa89e4`).
The claimed `752 of 767` baseline negative-control result is reproduced
exactly. The packed plain-JavaScript consumer receives identical enforcement
without any install workaround. All earlier Stage 05 corrections remain
intact.

Four NEW non-blocking findings were identified (three Low, one
Informational — two of them pre-existing Stage 04 canonicalization edge
cases that this audit demonstrates are unchanged by the correction). None of
them contradicts the Stage 05 exit gate; none is remotely reachable through
JSON or the packed consumer; none blocks Stage 06.

## Is Stage 05 closed and Stage 06 permitted?

**YES WITH NON-BLOCKING ISSUES.**

The normative Stage 05 exit gate of `docs/VICT-SYSTEM-REFERENCE.md` (§23,
Stage 5) now holds at the runtime boundary, the packed-consumer boundary, and
the fresh-clone boundary. The re-audit's permissive LOW-05-A disposition is
superseded: LOW-05-A is closed by this correction with permanent regression
coverage. The new Low findings below are documentation-accuracy and
canonicalization-edge items, not gate violations. As recorded by the
previous re-audit, the planned Mastra/ARA architecture amendment remains the
documented next step before Stage 06 implementation begins; that amendment is
outside this audit's scope and its absence is not a Stage 05 defect.

## Audited SHAs and ancestry

| Item | SHA |
| --- | --- |
| `origin/main` and fresh-clone `HEAD` (verified equal at clone time) | `9fa89e4177654ea04399e3191469041107be77cb` |
| Pre-correction baseline (in ancestry, verified) | `11e26447d645326aebf6560e3963476449fa840e` |
| Previous remediation implementation (in ancestry, verified) | `d346badd1d042afb61f6e36847b0716116bc4dd7` |
| Correction implementation commit (in ancestry, verified) | `23930e7` |
| Correction documentation commit (in ancestry, verified) | `1dc9083` |
| Test-file formatting fixup (in ancestry, verified) | `0a842f9` |
| Final remote tip / audited tip | `9fa89e4177654ea04399e3191469041107be77cb` |

`git ls-remote` confirmed `refs/heads/main == 9fa89e4…` before the clone; the
remote had not advanced beyond the audit target at any point during this
audit. History is linear; no force-push occurred.

## Environment

| Item | Observed |
| --- | --- |
| Operating system | Windows 11 (build 10.0.26200), MINGW64/MSYS, win32-x64 |
| Node | **v22.13.1** (satisfies the declared `>=22.13.0` floor) |
| npm | 10.9.2 |
| Git | 2.50.1.windows.1 |
| Browser | **Chrome 151.0.7922.109** via puppeteer-core (headless), real browser |
| Node 24 | **NOT AVAILABLE** in this environment (single system install, no nvm); not executed, not claimed |
| Second OS | **NOT AVAILABLE**; not executed, not claimed |

All audit work ran from a fresh `git clone` of the pushed remote into
`C:\Users\RZ1\Desktop\RZ\vict-02-audit` (the implementer's workspace was
never used or modified). Temporary negative-control worktree, packed
tarballs, isolated consumers, adversarial probes, browser databases and all
other audit artifacts were created outside the repository or removed
afterwards; `git status --short` is empty at the audited tree.

## Repository-integrity review

Independently established after the disclosed working-tree deletion incident:

- `HEAD == origin/main == 9fa89e4…` at clone; clone started clean
  (`git status --short` empty) with **zero** pre-existing `dist` directories
  (verified by `find` before `npm ci` and before `build`).
- Required ancestry intact: `11e2644…` and `d346bad…` are ancestors of
  `9fa89e4…` (`git merge-base --is-ancestor`), and all four expected
  correction commits (`23930e7`, `1dc9083`, `0a842f9`, `9fa89e4`) appear in
  the linear history in the claimed order.
- The complete `git diff --name-status 11e2644..9fa89e4` contains **exactly
  six files**, all intentional correction content:
  `M docs/architecture/STAGE-05-APPLICATION-DELIVERY.md`,
  `A docs/report/VICT-STAGE-05-FINAL-CORRECTION-REPORT.md`,
  `M examples/application-proof/src/lib/application/definition.ts`,
  `M packages/application/src/compile.ts`,
  `A packages/application/test/required-members.test.ts`,
  `M scripts/verify-stage5.mjs`. No other file changed.
- **All 22 protected documents are byte-identical to `11e2644`** by blob
  hash comparison: `docs/VICT-SYSTEM-REFERENCE.md` and every previous report
  under `docs/report/` (Stage 01–04 reports, the Stage 05 report, the
  Stage 05 independent audit, remediation report, and re-audit).
- All 15 expected workspaces are present in the committed tree
  (9 `packages/*`, 4 `examples/*`, 2 `packs/*`) and the root
  `package.json` workspace globs are unchanged. The full ladder below builds,
  type-checks and tests every workspace from the committed tree alone —
  nothing was recovered from local artifacts.
- No Stage 06, no Mastra reference, and no control-plane work exists anywhere
  in source, manifests, or architecture documents (case-insensitive scan,
  empty result). `vict.application@3` does not exist anywhere.
- No debug, browser, database, packed-tarball or recovery artifacts are
  committed; the tree contains no junction/symlink tricks.

The pushed repository is complete and coherent.

## Authoritative exit gate

From `docs/VICT-SYSTEM-REFERENCE.md`, §23, Stage 5 exit gate (quoted
verbatim):

> - malformed definitions and missing component/action/resource revisions
>   fail with structured diagnostics rather than partial silent rendering;

The previous focused re-audit retained LOW-05-A (the compiler accepted an
action without `revision`, a route without `id`, a screen without `title`)
as a non-blocking carry-forward. That permissive disposition does not
override the normative gate quoted above: a definition missing a required
member IS a malformed definition, and acceptance with a computed
`applicationVersion` IS partial silent rendering. This audit therefore
re-decided the gate against the corrected compiler and finds it **satisfied**
(see the next two sections).

## Independently derived required-member matrix

The required-member set below was derived by this auditor directly from
`packages/sdk/src/application.ts` (the public TypeScript authoring model),
the documented schema in `docs/architecture/STAGE-05-APPLICATION-DELIVERY.md`
§2, and the emitted declarations — NOT from the implementer's matrix. Each
row was probed at the runtime compiler boundary with plain JavaScript
objects (the shape a `JSON.parse` result or packed consumer produces), for
missing (absent), explicit `undefined`, explicit `null`, wrong primitive
(`42`), wrong container (`{}` / `'string'`), `''`, and — where the model
forbids it — whitespace-only values. Auditor probe totals: **230 assertions
passed**; the 17 remaining probe lines are analyzed in Findings
(they are rejections with less-precise codes, documented whitespace-policy
behavior, and the pre-existing sparse-array canonicalization edge case).

| Area | Required member | @1/@2 | Runtime result | Evidence |
| --- | --- | --- | --- | --- |
| Application | `schema` (closed marker; `@3` unknown) | both | rejected `APPLICATION_UNKNOWN_SCHEMA` | probe; suite |
| Application | `id` (non-empty, non-whitespace identifier) | both | rejected `APPLICATION_EMPTY_ID` / `APPLICATION_INVALID_IDENTIFIER` (whitespace) | probe |
| Application | `revision` (identifier-grade) | both | rejected `APPLICATION_EMPTY_REVISION` / `APPLICATION_INVALID_IDENTIFIER` | probe |
| Application | `routes`, `screens`, `actions`, `resources` present arrays | both | rejected `APPLICATION_REQUIRED_MEMBER` (absent/`null`/`42`/`{}`/string) | probe; suite; baseline was generic `APPLICATION_COMPILATION_FAILED` |
| Application | `views`/`forms`/`components` arrays **when declared** | both | non-array rejected `APPLICATION_REQUIRED_MEMBER`; absence compiles | probe (both directions) |
| Compatibility | `compatibility.applicationSchema` when `compatibility` declared | both | rejected `APPLICATION_REQUIRED_MEMBER` | probe; suite |
| Route | `id` (identifier-grade) | both | rejected `APPLICATION_EMPTY_ID` / `APPLICATION_INVALID_IDENTIFIER` | probe; suite; **accepted at `d346bad`** |
| Route | `path` string | both | rejected `ROUTE_PATH_INVALID` | probe; suite |
| Route | `nav.label` when `nav` declared; `nav` object-shaped | both | rejected `APPLICATION_REQUIRED_MEMBER` | probe; suite |
| Route | `screenId` (unless `@2` redirect) | both | rejected `ROUTE_SCREEN_REQUIRED` | probe |
| Screen | `id` (identifier-grade) | both | rejected `APPLICATION_EMPTY_ID` / `APPLICATION_INVALID_IDENTIFIER` | probe; suite |
| Screen | `title` (non-empty string) | both | rejected `APPLICATION_REQUIRED_MEMBER` | probe; suite; **accepted at `d346bad`** |
| Screen | `layout` array | both | rejected `APPLICATION_REQUIRED_MEMBER` | probe; suite |
| Screen | `states` object-shaped when declared | both | rejected `APPLICATION_REQUIRED_MEMBER` | probe |
| Region | `name` (non-empty string); `surfaces` array | both | rejected `APPLICATION_REQUIRED_MEMBER` | probe; suite |
| Surface (all roles) | `id` (identifier-grade) | both | rejected `APPLICATION_EMPTY_ID` / `APPLICATION_INVALID_IDENTIFIER` | probe; suite |
| Surface `text` | `content` | both | rejected `INVALID_SURFACE_DECLARATION` | probe; suite |
| Surface `view`/`states` | `viewId` resolves | both | rejected (`UNKNOWN_VIEW_REFERENCE` when absent — structured; see AUDIT-LOW-3) | probe |
| Surface `form` | `formId` resolves | both | rejected (`UNKNOWN_FORM_REFERENCE`) | probe |
| Surface `action` | `actionId` resolves; `label` non-empty | both | rejected `APPLICATION_EMPTY_ID` / `INVALID_SURFACE_DECLARATION` | probe; suite |
| Surface `component` | `componentId` resolves; `revision` (identifier-grade) | both | rejected `APPLICATION_EMPTY_REVISION` (+ registry mismatch check) | probe; suite |
| Surface `list` | `titleField`; `viewId` resolves | @2 | rejected `INVALID_SURFACE_DECLARATION` / `UNKNOWN_VIEW_REFERENCE` | probe; suite |
| Surface `table` | `viewId` resolves; `columns[].field` non-empty | @2 | rejected `UNKNOWN_VIEW_REFERENCE` / `INVALID_TABLE_DECLARATION` | probe; suite |
| Surface `detail` | `viewId` resolves | @2 | rejected `UNKNOWN_VIEW_REFERENCE` | probe; suite |
| Surface `chart` | `kind` in {bar,line}; `xField`; `yField`; `summary` | @2 | rejected `INVALID_CHART_DECLARATION` | probe; suite |
| Surface `status` | exactly one of `value` XOR `field` | @2 | rejected `INVALID_STATUS_DECLARATION` (both directions) | probe (see AUDIT-LOW-4: zero permanent test coverage) |
| Surface `tabs` | `tabs[]` each with `name`, `label`, `surfaces` array | @2 | rejected `INVALID_TABS_DECLARATION` / `DUPLICATE_TAB_NAME` | probe; suite |
| Surface `dialog`/`drawer` | `title`, `triggerLabel`, non-empty `content` | @2 | rejected `INVALID_SURFACE_DECLARATION` | probe |
| Surface `conversation` | `viewId` resolves; `messageField`, `authorField`, `inputLabel`; `sendActionId` resolves as mutation/capability | @2 | rejected `INVALID_CONVERSATION_DECLARATION` / `APPLICATION_EMPTY_ID` / `UNKNOWN_ACTION_REFERENCE` / `INVALID_ACTION_BINDING` | probe; suite |
| ViewBinding | `viewId`, `resourceId`, `resourceRevision` (identifier/revision grade) | both | rejected `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` / `APPLICATION_INVALID_IDENTIFIER` | probe; suite |
| FormBinding | `formId`, `resourceId`, `resourceRevision`, `inputContractId`, `fields` array, `submitActionId` referencing a DECLARED action; fields[].`name` + `label` | both | rejected `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` / `APPLICATION_REQUIRED_MEMBER` / `UNKNOWN_FORM_ACTION` | probe; suite |
| Action (all kinds) | `id` and `revision` (identifier-grade) | both | rejected `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` / `APPLICATION_INVALID_IDENTIFIER` | probe; suite; **accepted at `d346bad`** |
| Action `navigation` | `routeId` (resolves) | both | rejected `APPLICATION_EMPTY_ID` / `UNKNOWN_ROUTE_REFERENCE` | probe |
| Action `query` | `resourceId`, `resourceRevision` | both | rejected `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` | probe |
| Action `mutation` | `resourceId`, `resourceRevision`, `op` (declared, non-whitespace), `inputContractId` | both | rejected `APPLICATION_EMPTY_*` / `APPLICATION_REQUIRED_MEMBER` / `APPLICATION_INVALID_IDENTIFIER` / `MUTATION_NOT_DECLARED` | probe |
| Action `capability` | `capabilityId`, `capabilityRevision`, `inputContractId` | both | rejected `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` | probe |
| Resource reference | `resourceId`, `revision` (identifier-grade; exact match) | both | rejected `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` / `RESOURCE_REVISION_MISMATCH` | probe; `undefined` revision can never match (see below) |
| Component reference | `componentId`, `revision` | both | rejected `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` / mismatch codes | probe; suite |
| Provided `ResourceDefinition` | `schema` marker, `id`, `revision`, `identity` object + `key`, `fields` array with typed `name`/`type` (closed set) | both | rejected `APPLICATION_UNKNOWN_SCHEMA` / `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` / `APPLICATION_REQUIRED_MEMBER` | probe; suite |
| Provided registries | contract/capability `id`+`revision`; component `componentId`+`revision` | both | rejected `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` | probe; suite |
| Identity | ids/revisions/identity declarations and closed-vocabulary fields participate in canonical identity | both | byte-identical vectors at both commits; ordered sequences identity-sensitive | probe; suite |

**Optional members remain genuinely optional** (no compatibility regression
from over-enforcement): auditor-built fixtures with `name`, `theme`,
`compatibility`, `views`, `forms`, `components`, route `nav`, screen
`states`, `level`, `props`, `disabledWhen`, `visibleWhen`, `breadcrumbs`,
`columns`, `queryActionId`, `searchFields`, `filterFields`, `pageSize`,
`emptyMessage`, `secondaryField`, detail `fields`, chart `title`, status
`tones`, `participantField`, `inputPlaceholder`, `required`/`widget` field
metadata, `inputContractId` (query), `outputContract*`, and resource
`mutations`/`required` all stripped — and a minimal application with only
required members — all still **compile successfully** at both markers.

**`undefined === undefined` can never match again:** a resource reference
with an absent revision is rejected outright (`APPLICATION_EMPTY_REVISION`),
before any comparison; registry and capability revisions are required
members of the provided entries, so an `undefined` registry revision cannot
silently match an `undefined` reference (the historical bug). Verified at the
target; at `d346bad` the same input produced only the misleading
`RESOURCE_REVISION_MISMATCH`.

## Malformed-definition behavior

Independently proven at the runtime boundary (auditor probes) and in a real
isolated packed consumer:

- **Structured diagnostics only.** Every malformed input produced
  `{ code, message, path? }` issues with stable codes. No raw exception ever
  escaped: throwing getters (`Object.defineProperty` + `get` that throws),
  hostile `Proxy` handlers (throwing `get`/`getOwnPropertyDescriptor`),
  enumeration traps (throwing `ownKeys`), and a revoked
  `Proxy.revocable()` all returned structured rejections inside
  `compileApplication` without throwing.
- **No hostile-data echo.** Unique secret canaries planted in hostile
  objects (`toString`/`valueOf` canaries, getter messages, proxy messages)
  never appear in the complete serialized diagnostics (`JSON.stringify` of
  the full result searched). Non-string values are described as
  `absent`/type names only.
- **Stable codes.** All rejections use the documented diagnostic vocabulary;
  the suite pins exact code + path per case.
- **Deterministic, path-sorted, insertion-order independent.** The same
  malformed definition built with different property insertion orders
  produces `JSON`-identical diagnostics; multi-issue results are sorted by
  path with a stable code tiebreak (probe + permanent suite).
- **No silent defaults.** No missing required value was ever defaulted; each
  produced a diagnostic.
- **No partial compilation.** For every invalid input, `'plan' in result`
  is false and the serialized result contains no `applicationVersion`
  (compilation returns before identity computation; identity computation
  itself fails closed on out-of-domain values).
- **Six historical cases reproduced independently** (both markers, all
  twelve combinations): action missing `revision`, route missing `id`,
  screen missing `title` — **rejected** at `9fa89e4` with the precise codes,
  **accepted** at `d346bad` (see Negative controls).

## Compatibility and identity

- Valid `@1` and valid `@2` definitions compile (probe baselines, permanent
  suite, packed consumer).
- No `vict.application@3` exists anywhere in the tree; the correction is
  validation hardening against the model the authoring API always declared —
  not an identity-model change. `APPLICATION_IDENTITY_SCHEMA` markers are
  unchanged for both markers.
- **Independent cross-commit identity proof:** auditor-constructed valid
  `@1` and `@2` fixtures were compiled at BOTH `d346bad` (temporary detached
  worktree, isolated `npm ci`, built) and `9fa89e4`. The
  `applicationVersion` AND the full `stableJson` canonical-manifest bytes are
  byte-identical across the two commits:
  `@1 = v1_4f0d81be3a78f97444141897892526312bfa4bc16e7012fa0238505643f19bc5`,
  `@2 = v1_83a82300d10d8300ffe224dd9582f2ca0bcfe2724b166d10cf3628613249ae1b`.
  This does not rely on the implementer's fixtures.
- The permanent suite additionally pins the implementer's captured
  pre-correction vectors (`v1_377edb54…`, `v1_145586e9…`) and full manifest
  byte strings; those 5 identity tests are among the tests that pass at BOTH
  commits (see negative controls).
- Object insertion order of set-like declarations (`screens`, `actions`,
  `forms`, `views`, `components`, `resources`) does not affect identity;
  reversing the ordered `routes` array changes it. Both verified by probe.
- Optional-field absence retains its established meaning (stripped fixtures
  compile with changed identity exactly as semantics require; nothing became
  mandatory).
- Invalid definitions never acquire identity (no `applicationVersion`).
- Existing Stage 04 and Stage 05 valid examples compile and behave
  consistently: `example:application` 17/17, reference application 44/44
  (×3), all stage verifiers green.
- **Stage 04 proof correction reviewed:** `act.adminDelete` previously
  omitted its required `inputContractId`. The correction adds the declared
  `proof.note.delete` input contract (`{ id: string }`, revision `1`,
  registered in the proof bindings) and references it. The contract exists,
  has the correct revision, validates exactly the identity payload the proof
  dispatches (`{ id: 'n1' }`), and the proof's behavior is unchanged: the
  authorization boundary still denies the action (`DATA_UNAUTHORIZED`
  asserted in the unchanged 17/17 suite) and no effect/execution behavior
  was weakened. The correction makes a previously malformed declaration
  valid; it does not relax anything.

## Negative-control results

Temporary detached-HEAD worktree at `d346bad…` (no junctions, no symlinks,
no shared `node_modules`; real isolated `npm ci` — 276 packages, exit 0 —
and full build, exit 0; nothing modified or committed; the permanent suite
copied in as a temporary file and removed; worktree deleted afterwards,
`git worktree list` back to the single main tree).

Independent baseline probe (auditor script against the built `d346bad`
compiler):

| Probe | Result at `d346bad` | Result at `9fa89e4` |
| --- | --- | --- |
| `@1` action missing `revision` | **ACCEPTED** | rejected `APPLICATION_EMPTY_REVISION` |
| `@2` action missing `revision` | **ACCEPTED** | rejected `APPLICATION_EMPTY_REVISION` |
| `@1` route missing `id` | **ACCEPTED** | rejected `APPLICATION_EMPTY_ID` |
| `@2` route missing `id` | **ACCEPTED** | rejected `APPLICATION_EMPTY_ID` |
| `@1` screen missing `title` | **ACCEPTED** | rejected `APPLICATION_REQUIRED_MEMBER` |
| `@2` screen missing `title` | **ACCEPTED** | rejected `APPLICATION_REQUIRED_MEMBER` |
| action missing `id`; surface missing `id`; text missing `content`; `nav` missing `label`; form `submitActionId` unknown; `@2` list surface with unknown view | **ACCEPTED** (all) | rejected (precise codes) |
| application `routes`/`screens`/`actions`/`resources` missing | rejected only as generic `APPLICATION_COMPILATION_FAILED` | rejected `APPLICATION_REQUIRED_MEMBER` (precise) |
| resource reference with absent revision | misleading `RESOURCE_REVISION_MISMATCH` | rejected `APPLICATION_EMPTY_REVISION` (precise; no match possible) |

Permanent required-member suite executed against the baseline:

- **Exact counts: 752 failed | 15 passed (767 total), exit 1.** The claimed
  `752 of 767` negative-control result is **exactly reproducible**.
- The 15 passing-at-baseline tests, enumerated: the 5 identity/vector tests
  (applicationVersion `@1`+`@2`, canonical-manifest bytes `@1`+`@2`,
  set-like ordering) — passing at BOTH commits is direct identity
  preservation evidence; 4 `@2` route-path grammar tests
  (`ROUTE_PATH_INVALID`, pre-existing); 4 hostile-object fail-closed tests
  (throwing getter, revoked proxy, hostile proxy, exotic prototype —
  pre-existing Stage 04 canonical-domain behavior); 2 determinism tests
  (path-sorted multi-issue diagnostics; invalid input never receives an
  `applicationVersion`).
- Categories failing at baseline: every required-member matrix row (absent /
  `undefined` / `null` / wrong-type / empty / whitespace values across
  application, routes, screens, regions, surfaces, views, forms, actions,
  references, provided resources and registries) and the three audited
  LOW-05-A regressions — i.e. exactly the correction's scope.
- Why any tests pass at both revisions: they test behavior the correction
  did not change — identity bytes (must not change), pre-existing `@2`
  grammar validation, pre-existing hostile-value fail-closed conversion, and
  diagnostic discipline.

The audit's own new-finding probes were also run at the baseline:
prototype-inherited required members were accepted there too, and the
sparse-array canonicalization behavior is byte-identical at both commits
(see findings) — both are pre-existing, not correction regressions.

## Test-quality inspection

`packages/application/test/required-members.test.ts` (767 tests) inspected
in full rather than trusted by count:

- **Expectations are independent of the implementation:** every case asserts
  hard-coded diagnostic codes and exact paths authored per member type
  (`APPLICATION_EMPTY_ID` vs `APPLICATION_EMPTY_REVISION` vs
  `APPLICATION_REQUIRED_MEMBER` vs structure-specific codes). No expectation
  is derived from the compiler at runtime.
- **Not tautological:** the suite runs at the plain-JavaScript boundary (no
  `defineApplication`, no TypeScript checking), i.e. exactly the shape a
  packed consumer or `JSON.parse` produces. Valid controls accompany the
  invalid matrix (two complete valid fixtures compile with pinned vectors).
- **Both schemas covered:** every generic matrix loop runs for `@1` and
  `@2`; `@2`-only roles are asserted at `@2` (and `@1` correctly rejects the
  roles themselves).
- **Assertions check safety, not just presence:** `result.ok === false`,
  absence of the `plan` key, presence of the exact code, exact path match,
  canary non-echo over the complete serialized result, and no
  `applicationVersion` anywhere for invalid input.
- **Hostile-object tests genuinely execute hostile code paths:** an
  enumerable throwing getter via `Object.defineProperty`, a revoked
  `Proxy.revocable`, a `Proxy` whose `get` throws for specific keys, and an
  exotic class-instance prototype. These are real, not simulated.
- **Identity tests compare complete canonical bytes:** full `stableJson`
  manifest strings and full applicationVersion hashes — not prefixes.
- **The 767 count is real breadth, not duplication:** the loops enumerate
  distinct (required member × bad value) pairs; minor value redundancy
  (e.g. `42` vs `{}` for a string member exercising the same type check) is
  an acceptable breadth trade-off and is noted, not concealing.
- **Coverage gaps recorded (all non-gating):**
  1. `INVALID_STATUS_DECLARATION` (status `value` XOR `field`) has **no
     permanent test coverage anywhere in the repository**; this audit
     independently verified the compiler enforces both directions correctly
     (both-declared and neither-declared are rejected).
  2. `dialog`/`drawer` required members (`title`, `triggerLabel`,
     non-empty `content`) and breadcrumb `label`/route-reference absence are
     not covered by the required-member suite (the compiler enforces them —
     independently verified).
  3. Surface-level reference members absent (`viewId`/`formId`/`actionId`/
     `componentId`/`sendActionId` on surfaces) are not covered; the runtime
     rejects them via the reference codes (`UNKNOWN_*_REFERENCE`) rather
     than required-member codes (see AUDIT-INFO-1).
  4. Whitespace-only display strings are not covered anywhere (see
     AUDIT-LOW-3).

## Packed-consumer verification

Built and packed `@vict/contracts`, `@vict/sdk`, `@vict/application` from
the audited tree (`npm pack`, exit 0 each), then created an isolated
consumer **outside the workspace** with the tarballs as `file:` dependencies:

- **Plain `npm install` succeeded (exit 0, 3 packages).** The documented
  `--legacy-peer-deps` workaround is NOT required on the plain-JS consumer
  path.
- Using only the emitted `dist/` JavaScript (no TypeScript sources, no
  workspace aliases, no hoisting), an auditor-authored probe verified
  **38/38 assertions**: valid `@1`/`@2` compile with `applicationVersion`;
  the six historical cases are rejected with the same codes; representative
  nested missing-member cases (form field `label`, view `resourceRevision`,
  mutation `inputContractId`) are rejected; diagnostics are structured,
  path-sorted, insertion-order independent, and canary-free; invalid input
  contains no plan and no `applicationVersion`; a hostile getter through the
  packed artifact fails closed without echo.
- Package exports resolve under strict isolation and the emitted
  declarations (`dist/*.d.ts`) are complete in the tarballs for all three
  packages; workspace hoisting is not required.
- `verify:stage5`'s own packed chain (scaffolder install → generate →
  install → build in isolation + the new required-member probe) passed as
  part of the verifier.
- **npm workaround classification:** a pristine `npm install` of ONLY
  `vitest ^4.1.11` in an empty directory (zero Vict code) reproduces the
  npm 10.9.2 arborist crash (`Cannot read properties of null (reading
  'edgesOut')`); `--legacy-peer-deps` installs cleanly. The trigger is
  vitest 4.x's pinned optional browser-provider peer ranges
  (`@vitest/browser-*: "4.1.11"`, optional) colliding with an npm-arborist
  defect — an environmental/third-party issue, **not** concealed Vict peer
  metadata (the Vict packed consumer installs with default npm behavior, and
  `@vict/sdk`'s only peer is the standard optional `zod`). The workaround in
  `scripts/verify-stage5.mjs` is correctly scoped to the generated-host
  install and honestly documented.

## Earlier-finding regression checks

All previously closed Stage 05 findings were re-verified against the built
reference application with an independent real-browser probe (Chrome 151,
52/52 assertions, run twice consecutively) plus the permanent suites:

### Typed edit form (HIGH-05-A) — intact

- Opened an existing record; the numeric prefill displayed `42` untouched;
  only the text field was changed; save succeeded (`result-state` visible).
- The payload captured at the real `fetch` boundary dispatched
  `budget` as the JavaScript **number** `42` (plus edited name, preserved
  status, `__identity`).
- Reload showed the edit. Direct SQLite read of `appdata_projects.data`
  confirmed the retained JSON value is a **number**. The real server process
  was SIGKILLed and restarted over the same database file: HTTP 200, the
  edit renders, and the SQLite re-read still holds a numeric `42`.
- Invalid numeric input (`1e999`) never dispatched (zero `act.updateProject`
  calls) and produced field-local accessible feedback (`aria-invalid="true"`,
  `aria-describedby` pointing at a non-empty field message).
- (Incidental evidence: a hostile `<script>` payload in the edited text is
  stored as data and rendered inert — SSR emits it escaped, never as markup.)

### Mobile navigation (MED-05-A) — intact

Verified at 320×720, 390×844, 820×1180, 1280×800 with real
`getBoundingClientRect` + computed grid tracks:

- Opening the mobile menu does NOT reduce the main-column width (identical
  within measurement tolerance at both mobile sizes).
- The open menu is an in-flow row between header and main (nav y above main
  y; full-width), on a **single explicit** `grid-template-columns` track —
  no implicit track.
- No horizontal overflow in any state (`scrollWidth == clientWidth`).
- Navigating to another screen closes the menu (policy); Escape closes it
  and restores focus to the toggle (`document.activeElement`).
- Tablet (820×1180) and desktop (1280×800) keep the sidebar layout: toggle
  hidden, nav always visible in the left column, two explicit tracks.

### Other preserved behavior — intact

- Heading levels use only the closed `h1`–`h6` mapping (no `h7`+ elements
  possible; screen titles render `h1`); unleveled text remains a paragraph.
- The duplicate public declaration member remains removed (root strict
  `typecheck` passes; declarations complete for packed consumers).
- Renderer build is warning-free without filtering (`verify:stage5`
  explicitly scans for `state_referenced_locally` and any
  vite-plugin-svelte warnings; both clean).
- Local actions remain local; authorization, contracts, effects and
  idempotency remain intact (all conformance suites and stage verifiers
  green).
- SQLite application data, migrations and restart behavior remain intact
  (browser probe direct SQLite reads + real SIGKILL restart; HTTP suite).
- Stage 01–04 verification remains green: `verify:stage2/3/4` exit 0; ARA
  proof exactly **13 ordered events** (`00. run.started` … `12.
  run.completed`); benchmark exactly **10 events per completed run**
  re-validated from SQLite (n=500); Stage 04 proof **17/17**.

## Command and test evidence

From the fresh clone, in the required order, Node v22.13.1, no pre-existing
`dist` (0 before `typecheck` and `build`):

| Command | Exit | Observed result |
| --- | --- | --- |
| `npm ci` | 0 | clean install, 276 packages |
| `npm run typecheck` (BEFORE build) | 0 | strict, zero errors |
| `npm run format:check` | 0 | all files formatted (an early run flagged only this audit's own temporary probe file, which was then moved outside the repository; final run clean) |
| `npm run lint` | 0 | no findings (same note; final run clean) |
| `npm run build` | 0 | 9 packages emit cleanly |
| `npm run test:unit` | 0 | **54 files / 1329 tests** |
| `npm run test:integration` | 0 | **1 file / 4 tests** |
| `npm test` (×3 consecutive) | 0, 0, 0 | **58 files / 1378 tests** each run |
| `npm run verify:consumer` | 0 | packed-tarball neutral/Zod/SQLite consumers pass |
| `npm run verify:stage2` | 0 | PASSED |
| `npm run verify:stage3` | 0 | PASSED (offline proof, packed orchestration consumer) |
| `npm run verify:stage4` | 0 | PASSED (application proof 2 files / 17 tests) |
| `npm run verify:stage5` | 0 | ALL checks passed: full suite 58/1378; warning-free reference build (explicit scans); reference suites 4 files / 44 tests (incl. real-browser HIGH-05-A + MED-05-A regressions); packed scaffolder install→generate→install→build in isolation; packed required-member probe |
| `npm run example` | 0 | ARA proof: exactly **13 ordered events** (00 run.started … 12 run.completed) |
| `npm run bench` | 0 | 10 events per completed run; 10 events re-validated from SQLite, n=500 |
| `npm run example:application` | 0 | Stage 04 proof: **17/17** |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` | 0 | empty (pristine tree) |
| required-member suite (×3 consecutive) | 0, 0, 0 | **767/767** each run |
| reference-app full suite (×3 consecutive) | 0, 0, 0 | **4 files / 44 tests** each run (incl. browser + HTTP + DOM + definition) |
| auditor JS boundary probe (2 schemas, full matrix) | — | **230 assertions passed**; 17 classified lines (see Findings) |
| auditor real-browser probe (×2 consecutive) | 0, 0 | **52/52 assertions** each run |
| negative control at `d346bad` | suite exit 1 | **752 failed / 15 passed of 767** (exact match with claim) |
| isolated packed consumer | install 0; probe 0 | **38/38 assertions** |

Complete project-by-project arithmetic of `npm test` (58 files / 1378):
54 unit files / 1329 tests + 3 renderer-project files / 45 tests + 1
integration file / 4 tests. No flaky failure occurred in any official run;
no failure was rerun into passing; no timeout, sleep or retry was changed;
no warning was suppressed. One audit-process note recorded honestly: early
`format:check`/`lint` executions flagged this audit's own temporary probe
file sitting in the repository root; the probe was moved outside the
repository and both commands re-run clean. All probe-authoring mistakes made
during the audit were probe bugs (verified as such against compiler
behavior), never product defects, and are not counted anywhere as product
failures.

## Findings

| ID | Severity | Finding | Evidence | Required action |
| --- | --- | --- | --- | --- |
| AUDIT-LOW-1 | Low (new; **pre-existing at `d346bad`**, verified) | The canonicalization sparse-array guard is ineffective: `value.length !== new Set(value.keys()).size` can never be true for a real array (`Array.prototype.keys()` yields hole indices), so sparse arrays pass the guard and their holes silently canonicalize to `null` in identity content (`[,,'x']` and `[null,null,'x']` produce the **same** `applicationVersion`), contradicting the documented canonical domain ("rejects a sparse array"). Identical behavior at both commits — NOT introduced or worsened by the correction. Unreachable from JSON or the packed consumer; requires deliberate JS construction of a holey array inside an unvalidated container (e.g. component `props`). | Auditor probes at both commits; `git diff` of the guard code between commits is empty; baseline probe ACCEPTED with identical collision | Fix the guard (e.g. own-property count) in a future hardening pass; correct the canonical-domain documentation or the code |
| AUDIT-LOW-2 | Low (new; **pre-existing at `d346bad`**, verified) | Required members supplied through a prototype chain (`Object.create(proto)`) or as non-enumerable own properties are accepted at validation (member reads use `[[Get]]`) but silently omitted from the canonical manifest (identity enumerates own enumerable keys), so identity is computed over reduced content and two definitions differing only in a non-enumerable member's value share one identity. Exotic construction only — impossible from JSON, typed authoring, or the packed consumer; deterministic, fail-safe in the serialized contract sense. Accepted identically at `d346bad`. | Auditor probes: prototype action ACCEPTED with manifest entry absent; non-enumerable `revision` ACCEPTED and absent from manifest bytes; baseline probe ACCEPTED | Optionally reject non-plain/exotic member sources at validation, or document own-enumerable-members as the canonicalization contract |
| AUDIT-LOW-3 | Low (new; correction-scoped observation) | Whitespace-only values for required display strings (screen `title`, region `name`, form field `label`, text `content`, chart `summary`) are ACCEPTED: the whitespace rule is implemented (and documented, architecture §2.3 / final-correction report) for identifier-grade and revision-grade members only, while display strings require only non-empty-by-length. Consistent with the documented scope and not a gate violation (these are not missing ids/revisions), but a whitespace-only title is a likely authoring mistake that compiles. | Auditor matrix: `'   '` accepted for title/name/label/content (both markers); rejected for all identifier/revision members | Consider extending the non-whitespace rule to display strings in a future hardening pass (may require documenting the change) |
| AUDIT-LOW-4 | Low (new; test-coverage) | `INVALID_STATUS_DECLARATION` (status `value` XOR `field`, both directions) has zero permanent test coverage in the repository; the required-member suite also lacks `dialog`/`drawer` required-member absence cases, breadcrumb absence cases, and surface-level reference-absence cases. The compiler behavior itself is correct in every one of these cases (independently verified by this audit's probes). | `grep` over all test trees (only `compile.ts` mentions the code); auditor probes confirm correct rejection | Add the missing permanent cases to the required-member suite in a future pass |
| AUDIT-INFO-1 | Informational | Absent surface-level reference ids (`viewId`/`formId`/`actionId`/`componentId`/`sendActionId` on surfaces) are rejected via the reference codes (`UNKNOWN_*_REFERENCE` with deterministic paths) rather than `APPLICATION_EMPTY_ID`, although architecture §2.3's id-like list is ambiguous enough to suggest otherwise for surface usage. Rejection is guaranteed (a reference key can never resolve to `undefined`), structured and deterministic — enforcement holds; only code precision differs from the most strict reading of the documentation. | Auditor matrix (8 classified lines); probe outputs | Clarify §2.3 wording or emit the precise code; cosmetic |
| AUDIT-INFO-2 | Informational (environmental) | npm 10.9.2 crashes (`#loadPeerSet`, "Cannot read properties of null (reading 'edgesOut')") when installing vitest 4.x devDependencies — reproduced with a pristine vitest-only install containing no Vict code; `--legacy-peer-deps` avoids it. The plain packed-consumer path installs with default npm. The verify:stage5 workaround is correctly scoped, documented, and conceals no Vict metadata defect. | This audit's isolated reproduction; packed consumer plain-install exit 0 | None for this repository; revisit when npm/vitest versions change |

No Critical, High, or Medium finding. No finding contradicts the Stage 05
exit gate: every malformed definition that omits a required member or
declares a missing revision fails with structured diagnostics at every
audited boundary; nothing invalid is silently rendered, partially compiled,
or issued an identity.

## Severity summary

| Severity | Count | IDs |
| --- | --- | --- |
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low (new, non-blocking) | 4 | AUDIT-LOW-1, AUDIT-LOW-2, AUDIT-LOW-3, AUDIT-LOW-4 |
| Informational (new) | 2 | AUDIT-INFO-1, AUDIT-INFO-2 |
| Carry-forward (unchanged) | 1 | LOW-05-B (Stage 03 fixture load sensitivity; documented; not observed in any official run of this audit) |
| Closed by this correction | 1 | LOW-05-A (verified closed; negative controls + matrix + packed proof) |

## Remaining limitations

- Node 24 was not available in this environment; no Node 24 execution was
  performed or claimed. No second operating system was available; none was
  claimed. All evidence is from Windows 11 / win32-x64 / Node v22.13.1 /
  Chrome 151.0.7922.109.
- The LOW-05-B Stage 03-era fixture load sensitivity remains a documented
  carry-forward; it did not reproduce in any official run of this audit
  (3× full suite, 5 stage verifiers, 3× reference suite).
- The npm 10.9.2 arborist crash (AUDIT-INFO-2) is environmental; the
  documented `--legacy-peer-deps` scoping remains necessary for the
  generated-host install until npm or vitest versions change.
- npm-audit advisories in the dev toolchain and the `node:sqlite`
  experimental warning remain pre-existing and exit-neutral (unchanged from
  prior audits).
- Screen-reader UX (beyond axe and semantic-structure checks performed in
  prior stages) remains a manual activity outside this audit's scope,
  unchanged from the re-audit's limitation record.

## Recommendation

Accept the final exit-gate correction. Stage 05 satisfies its normative exit
gate, the pushed repository is complete and coherent, identity is provably
preserved across the correction, and the packed-consumer boundary enforces
the same rules. Record the four new non-blocking findings (AUDIT-LOW-1/2/3/4
and AUDIT-INFO-1/2) as hardening recommendations for a future pass — the
canonicalization-domain items (AUDIT-LOW-1/2) being the most worthwhile.
Per the standing sequence, proceed to the formal Stage 05 closure decision
(this audit), then the planned Mastra/ARA architecture amendment, and only
then begin Stage 06.
