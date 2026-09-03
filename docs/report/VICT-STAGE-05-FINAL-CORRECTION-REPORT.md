# VICT Stage 05 — Final Exit-Gate Correction Report

## Outcome

**FINAL CORRECTION COMPLETE — READY FOR INDEPENDENT CLOSURE AUDIT**

The runtime Application Definition compiler now enforces every member that
the public authoring model declares required, for BOTH `vict.application@1`
and `vict.application@2`. The three audited malformed objects (action
without `revision`, route without `id`, screen without `title`) — and the
full systematic superset of required-member gaps the re-audit's LOW-05-A
implied — are rejected with stable, structured, non-echoing diagnostics;
invalid input never produces a partial plan or an `applicationVersion`. All
valid `@1`/`@2` fixtures compile with byte-identical canonical manifests and
identity vectors. The complete verification ladder, three consecutive full
suites, and five consecutive required-member suite runs reproduce green.
Stage 06 and Mastra work were NOT begun.

## Starting and final SHAs

| Item | SHA |
| --- | --- |
| Required starting SHA (`origin/main` at start) | `11e26447d645326aebf6560e3963476449fa840e` |
| Remediation implementation (re-verified in ancestry) | `d346badd1d042afb61f6e36847b0716116bc4dd7` |
| Implementation commit (this correction) | `23930e7` (`fix(stage-05): enforce application required members`) |
| Documentation commit (this correction) | `1dc9083` (`docs(stage-05): record final exit-gate correction`) |
| Test-file formatting fixup | `0a842f9` (`fix(stage-05): format the required-member test file`) |
| Final remote tip after push (fast-forward `11e2644..0a842f9`) | `0a842f9e1e7b610b516abe52c550edc9231c6963` |

`origin/main` was fetched and confirmed exactly equal to the required
starting SHA before any change. The complete Stage 05 implementation, audit,
remediation, and focused re-audit history was confirmed present in ancestry.

## Exit-gate discrepancy

LOW-05-A (retained by the focused independent re-audit): the runtime
compiler accepted objects omitting members the public authoring model
(`@vict/sdk` declarations) declares REQUIRED. Proven baseline behavior at
the starting SHA (live probes against the built compiler):

| Probe at start | Result |
| --- | --- |
| `{ kind: 'local', id: 'act.x' }` (action without `revision`) | **ACCEPTED**, received an `applicationVersion` |
| `{ path: '/', screenId: 's.main' }` (route without `id`) | **ACCEPTED**, `undefined` route keys, broken duplicate detection |
| screen missing `title` | **ACCEPTED** |
| text surface missing `content` / surface missing `id` / `nav` missing `label` | **ACCEPTED** |
| `@2` list missing `titleField`, chart missing `xField`/`yField`, table column missing `field`, conversation missing `messageField`/`authorField`/`inputLabel`, tab `surfaces` missing/non-array, action-surface missing `label` | **ACCEPTED** (silently skipped/ignored members) |
| list/table/detail surfaces referencing UNKNOWN views | **ACCEPTED** (only view/states/chart/conversation roles checked) |
| form `submitActionId` referencing an unknown action | **ACCEPTED** (`UNKNOWN_FORM_ACTION` existed but was unused) |
| view missing `viewId`; region missing `name` | **ACCEPTED** |
| application `routes`/`screens`/`actions`/`resources` missing or non-array | rejected only as the GENERIC `APPLICATION_COMPILATION_FAILED` (thrown, no precise path) |
| `nav: 42`, `states: 42`, `theme: 42` (`@2`) | **ACCEPTED** — member silently vanished from the canonical manifest |

This conflicted with the authoritative Stage 05 exit gate: "Malformed
definitions and missing component/action/resource revisions must fail with
structured diagnostics rather than partial silent rendering."

## Runtime/declaration required-member matrix

| Structure | Required member | Previous behavior | Corrected behavior |
| --- | --- | --- | --- |
| Application | `routes` array | generic `APPLICATION_COMPILATION_FAILED` | `APPLICATION_REQUIRED_MEMBER` |
| Application | `screens` array | generic failure | `APPLICATION_REQUIRED_MEMBER` |
| Application | `actions` array | generic failure | `APPLICATION_REQUIRED_MEMBER` |
| Application | `resources` array | generic failure | `APPLICATION_REQUIRED_MEMBER` |
| Application | `views`/`forms`/`components` arrays when declared | generic failure / silent vanish | `APPLICATION_REQUIRED_MEMBER` |
| Application | `compatibility.applicationSchema` | silently accepted when absent | `APPLICATION_REQUIRED_MEMBER` |
| Route | `id` | **silently accepted** (`undefined` keys) | `APPLICATION_EMPTY_ID` / `APPLICATION_INVALID_IDENTIFIER` |
| Route | `path` string (`@1` + `@2`) | `@1`: **silently accepted**; `@2`: checked | `ROUTE_PATH_INVALID` (grammar stays `@2` policy) |
| Route.nav | object shape + `label` | **silently accepted** when absent; `nav: 42` silently vanished | `APPLICATION_REQUIRED_MEMBER` |
| Screen | `id` | **silently accepted** | `APPLICATION_EMPTY_ID` / `APPLICATION_INVALID_IDENTIFIER` |
| Screen | `title` | **silently accepted** | `APPLICATION_REQUIRED_MEMBER` |
| Screen | `layout` array | generic failure | `APPLICATION_REQUIRED_MEMBER` |
| Screen | `states` object shape | `states: 42` silently vanished | `APPLICATION_REQUIRED_MEMBER` |
| Region | `name` | **silently accepted** | `APPLICATION_REQUIRED_MEMBER` |
| Region | `surfaces` array | generic failure | `APPLICATION_REQUIRED_MEMBER` |
| Surface (all roles) | `id` | **silently accepted** | `APPLICATION_EMPTY_ID` / `APPLICATION_INVALID_IDENTIFIER` |
| Surface `text` | `content` | **silently accepted** | `INVALID_SURFACE_DECLARATION` |
| Surface `action` | `label` | **silently accepted** | `INVALID_SURFACE_DECLARATION` |
| Surface `component` | `revision` presence | rejected only as a mismatch | `APPLICATION_EMPTY_REVISION` then mismatch check |
| Surface `list` | `titleField` | **silently skipped** | `INVALID_SURFACE_DECLARATION` |
| Surface `list`/`table`/`detail` | `viewId` resolves | **silently accepted when unknown** | `UNKNOWN_VIEW_REFERENCE` |
| Surface `table` | `columns[].field` | **silently skipped** | `INVALID_TABLE_DECLARATION` |
| Surface `chart` | `xField`, `yField` | **silently skipped** | `INVALID_CHART_DECLARATION` |
| Surface `conversation` | `messageField`, `authorField`, `inputLabel` | **silently skipped/accepted** | `INVALID_CONVERSATION_DECLARATION` |
| Tab | `surfaces` array | **silently ignored** | `INVALID_TABS_DECLARATION` |
| Surface `status` | `value` XOR `field` | already rejected | unchanged (`INVALID_STATUS_DECLARATION`) |
| ViewBinding | `viewId` | **silently accepted** | `APPLICATION_EMPTY_ID` / `APPLICATION_INVALID_IDENTIFIER` |
| ViewBinding | `resourceId`, `resourceRevision` | misleading secondary codes only | `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION`, precise and first |
| FormBinding | `formId` | **silently accepted** | `APPLICATION_EMPTY_ID` / `APPLICATION_INVALID_IDENTIFIER` |
| FormBinding | `resourceId`, `resourceRevision`, `inputContractId` | misleading secondary codes | `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` |
| FormBinding | `fields` array | generic failure | `APPLICATION_REQUIRED_MEMBER` |
| FormField | `name`, `label` | `label` **silently accepted**; `name` misleading | `APPLICATION_EMPTY_ID` / `APPLICATION_REQUIRED_MEMBER` |
| FormBinding | `submitActionId` | **not validated at all** | required + `UNKNOWN_FORM_ACTION` when undeclared |
| Action (all kinds) | `id` | **silently accepted** | `APPLICATION_EMPTY_ID` / `APPLICATION_INVALID_IDENTIFIER` |
| Action (all kinds) | `revision` (**LOW-05-A**) | **silently accepted**, received an `applicationVersion` | `APPLICATION_EMPTY_REVISION` / `APPLICATION_INVALID_IDENTIFIER` |
| Action `navigation` | `routeId` | misleading only | `APPLICATION_EMPTY_ID` then reference check |
| Action `query`/`mutation` | `resourceId`, `resourceRevision` | misleading only | `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` |
| Action `mutation` | `op` | partially (`MUTATION_NOT_DECLARED` only when revision matched) | `APPLICATION_REQUIRED_MEMBER` + whitespace `APPLICATION_INVALID_IDENTIFIER` |
| Action `mutation`/`capability` | `inputContractId` (REQUIRED by model) | **silently accepted when absent** | `APPLICATION_EMPTY_ID` then contract check |
| Action `capability` | `capabilityId`, `capabilityRevision` | misleading only | `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` |
| Resource reference | `resourceId`, `revision` | misleading; `undefined==undefined` revision could match | `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` |
| Component reference | `componentId`, `revision` | misleading; `undefined==undefined` revision could match | `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` |
| Provided `ResourceDefinition` | `schema` marker | **not validated** | `APPLICATION_UNKNOWN_SCHEMA` |
| Provided `ResourceDefinition` | `id`, `revision` | **not validated** | `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` (+ identifier) |
| Provided `ResourceDefinition` | `identity` object + `key` | **not validated** | `APPLICATION_REQUIRED_MEMBER` |
| Provided `ResourceDefinition` | `fields` array; field `name`; field `type` (closed set) | not validated; `fields` missing threw generically | `APPLICATION_REQUIRED_MEMBER` / `APPLICATION_EMPTY_ID` |
| Provided contract/capability/component registry entries | `id`(s) / `revision` | **not validated** (`undefined` registry revisions could match `undefined` references) | `APPLICATION_EMPTY_ID` / `APPLICATION_EMPTY_REVISION` |

## Validation behavior

- Missing, `undefined`, `null`, wrong-type, empty, and (for identifiers and
  revisions) whitespace-only required values are each rejected with the
  precise structured diagnostic; no missing required value is defaulted.
- Diagnostics are stable, structured and non-echoing: paths use safe type
  labels for non-string keys; messages contain `absent`/type descriptions,
  never raw values; canaries planted in hostile values never appear.
- Multiple issues are reported together in stable path order
  (`Collector.sorted()`); object property insertion order does not affect
  diagnostics.
- Invalid input never creates a partial compiled plan and never receives an
  `applicationVersion` (compilation returns before identity computation).
- Throwing getters, revoked proxies and hostile enumeration fail closed via
  the established outer conversion (`APPLICATION_COMPILATION_FAILED`) with
  no raw exceptions and no echoed values.
- Unknown fields continue to be rejected through the existing closed-field
  policy (unchanged); existing safe issue-count bounds are unchanged.
- Downstream reference checks are skipped when a required member is invalid,
  so no misleading secondary diagnostics are produced.

## Compatibility decision

This is a **validation bug fix against the schema the public authoring API
has always declared — not a new schema version**. `vict.application@3` does
not exist and neither schema marker changed. Canonicalization, ordering
semantics, optional-member behavior (which optional members exist, and the
accepted values of well-typed optionals) and renderer behavior for valid
plans are unchanged. Previously accepted malformed objects never satisfied
the declared schema and may now be rejected; this is documented in
`docs/architecture/STAGE-05-APPLICATION-DELIVERY.md` §2.1/§2.3 (the only
architecture-doc changes, made to keep that document accurate).

Byte-identity proof: the identity vectors and full canonical-manifest JSON
of complete valid `@1` and `@2` fixtures were captured from the
pre-correction implementation at `d346bad` (temporary detached worktree,
built, probed, removed) and are pinned as permanent assertions in
`packages/application/test/required-members.test.ts`. The same assertions
pass at both commits.

## Files changed

- `packages/application/src/compile.ts` — runtime required-member
  enforcement (the matrix above); one new diagnostic code
  `APPLICATION_REQUIRED_MEMBER`; precise reuse of existing codes
  (`APPLICATION_EMPTY_ID`, `APPLICATION_EMPTY_REVISION`,
  `APPLICATION_INVALID_IDENTIFIER`, `ROUTE_PATH_INVALID`,
  `UNKNOWN_VIEW_REFERENCE`, `UNKNOWN_FORM_ACTION`,
  `INVALID_SURFACE_DECLARATION`, `INVALID_TABLE_DECLARATION`,
  `INVALID_CHART_DECLARATION`, `INVALID_CONVERSATION_DECLARATION`,
  `INVALID_TABS_DECLARATION`, `APPLICATION_UNKNOWN_SCHEMA`); hardening of
  shared helpers so malformed catalogues/references can no longer throw.
- `packages/application/test/required-members.test.ts` (new) — permanent
  runtime-boundary required-member matrix (767 tests), the three audited
  regressions, raw-JS/JSON/hostile-object proofs, determinism and canary
  proofs, and the pinned `@1`/`@2` identity vectors.
- `scripts/verify-stage5.mjs` — new permanent packed-consumer probe (plain
  JavaScript against the PACKED, emitted compiler: the three audit cases are
  rejected and valid `@1`/`@2` definitions still compile); `--legacy-peer-deps`
  on the generated-host install with a full comment documenting the npm
  10.9.2 arborist `#loadPeerSet` crash it works around (environmental,
  reproduced independently of the repository, see Remaining limitations).
- `examples/application-proof/src/lib/application/definition.ts` — the
  Stage 04 proof's mutation action `act.adminDelete` omitted its required
  `inputContractId` (a previously accepted malformed declaration). Added the
  declared `proof.note.delete` input contract (`{ id: string }`) and
  registered it in the proof bindings. The proof's semantics are unchanged:
  the dispatched payload `{ id: 'n1' }` passes the contract and the action
  is still denied at the authorization boundary (`DATA_UNAUTHORIZED`,
  asserted by the unchanged 17/17 proof suite).
- `docs/architecture/STAGE-05-APPLICATION-DELIVERY.md` — §2.1 wording
  corrected (validation semantics of `@1` now include required-member
  enforcement; markers/identity unchanged) and new §2.3 documenting the
  runtime required-member enforcement and the compatibility decision.

Unchanged: `docs/VICT-SYSTEM-REFERENCE.md`, the Stage 05 report, independent
audit, remediation report and re-audit report (all verified byte-identical
to `11e2644` by blob comparison before commit), all other packages, the
Stage 03 SIGKILL fixture, and every owner working-tree change (the
pre-existing unstaged deletions of `VICT-STAGE-02-INDEPENDENT-AUDIT.md` and
`VICT-STAGE-02-REPORT.md` remain preserved and unstaged).

## Permanent regression evidence

- 767 permanent runtime-boundary tests (5 consecutive runs, all green,
  exit 0 each): every matrix row × {absent, `undefined`, `null`, wrong-type,
  empty, whitespace-where-prohibited}; the three audited LOW-05-A cases for
  BOTH schema markers; plain-JS objects, `JSON.parse` results, throwing
  getters, revoked proxies, hostile proxies, exotic prototypes; stable
  path-sorted multi-issue diagnostics; insertion-order independence;
  canary non-echo; no-plan/no-`applicationVersion` for invalid input; and
  the byte-identical `@1`/`@2` identity vectors + canonical-manifest JSON.
- Full suite: 3 consecutive `npm test` runs, exit 0 each
  (58 files / 1378 tests per run: 1329 unit + 45 renderer + 4 integration).
- The real-browser edit (HIGH-05-A) and mobile-navigation (MED-05-A)
  regressions run inside `verify:stage5`'s reference-application suites
  (4 files / 44 tests) and passed in every `verify:stage5` execution.

## Negative controls

A temporary detached-HEAD worktree at `d346badd1d042afb61f6e36847b0716116bc4dd7`
(`npm ci` from scratch, nothing modified or committed; the current
required-member suite copied in as a temporary probe and removed; worktree
deleted afterwards; `git worktree list` verified back to the single main
tree):

| Probe | Result at `d346bad` | Corrected result |
| --- | --- | --- |
| action without `revision` (`@1` and `@2`) | **FAIL** (accepted) | PASS (rejected) |
| route without `id` (`@1` and `@2`) | **FAIL** (accepted) | PASS (rejected) |
| screen without `title` (`@1` and `@2`) | **FAIL** (accepted) | PASS (rejected) |
| full required-member matrix | **752 of 767 FAIL** | 767/767 PASS |
| `@1`/`@2` identity-vector + byte-manifest tests (5) | **PASS** | PASS |

The identity tests passing at BOTH commits is the direct evidence that the
correction preserves canonical identity exactly.

## Identity preservation

- `vict.application@1` fixture: `applicationVersion`
  `v1_377edb54188aa02f2562d771d7eee7b55b98cb78e0ceb16573c5e4fb1753b5a0` —
  identical at `d346bad` and after the correction (pinned permanently).
- `vict.application@2` fixture: `applicationVersion`
  `v1_145586e982dae2154371728f6331821ead7c72a5180b8797b315c179572228ec` —
  identical at `d346bad` and after the correction (pinned permanently).
- Full canonical manifest `stableJson` bytes for both fixtures are pinned
  and byte-identical (captured at `d346bad`).
- Set-like insertion order still never affects identity; meaningful ordered
  sequences (routes) still do.
- All Stage 04/05 identity, release-binding and compatibility suites pass
  unchanged; the reference application's `@2` version is unchanged.

## Verification evidence

Environment: Windows (win32-x64), Node v22.13.1 (satisfies >=22.13.0),
npm 10.9.2. `npm ci` was run with zero `dist` directories; `typecheck` ran
BEFORE `build` (dist: 0 before build).

| Command | Exit status | Observed result |
| --- | --- | --- |
| `npm ci` | 0 | clean install |
| `npm run typecheck` (no dist, before build) | 0 | strict, zero errors |
| `npm run format:check` | 0 | all files formatted |
| `npm run lint` | 0 | no findings |
| `npm run build` | 0 | 9 packages emit cleanly |
| `npm run test:unit` | 0 | 54 files / 1329 tests |
| `npm run test:integration` | 0 | 1 file / 4 tests |
| `npm test` (3 consecutive) | 0, 0, 0 | 58 files / 1378 tests each run |
| required-member suite (5 consecutive) | 0, 0, 0, 0, 0 | 767/767 each run |
| `npm run verify:consumer` | 0 | packed neutral/Zod/SQLite consumers pass; no Zod leakage |
| `npm run verify:stage2` | 0 | PASSED |
| `npm run verify:stage3` | 0 | PASSED |
| `npm run verify:stage4` | 0 | PASSED (application proof 2 files / 17 tests) |
| `npm run verify:stage5` | 0 | ALL checks passed (incl. warning-free reference build, 4 files / 44 reference tests incl. real-browser suites, packed install→generate→install→build, new packed required-member probe) |
| `npm run example` | 0 | ARA proof: exactly 13 ordered events (00 run.started … 12 run.completed) |
| `npm run bench` | 0 | `bench-three-node-pure`: 10 events per completed run; 10 events re-validated from SQLite n=500 |
| `npm run example:application` | 0 | Stage 04 proof: 17/17 |
| `git diff --check` | 0 | no whitespace errors |

No timeouts, sleeps, or retries were increased; no warnings were suppressed.

**One failure was investigated honestly during verification** (documented
here rather than dismissed): one `verify:stage5` execution hit the
documented LOW-05-B load-sensitivity — the Stage 03-era
`orchestration-restart.test.ts` "partial fan-out SIGKILL" fixture read the
SIGKILLed child's state file before it was fully flushed
(`Unexpected end of JSON input`). The fixture was not modified (per this
assignment). Re-run in isolation: 6/6 pass; the full `verify:stage5`
re-executed end-to-end: all checks passed. Production Stage 03 behavior is
untouched and its suites otherwise passed in every execution of this
correction (including three consecutive full-suite runs).

## Fresh-clone and packed-consumer evidence

Performed after pushing the correction commits. Fresh `git clone` of the
pushed remote tip `0a842f9e1e7b610b516abe52c550edc9231c6963` into a
temporary directory:

| Check | Result |
| --- | --- |
| Initial tree clean (`git status --short` empty) | yes |
| No generated `dist` before build | yes (0) |
| `npm ci` | 0 |
| `npm run typecheck` (BEFORE build, no dist) | 0 |
| `npm run format:check` / `npm run lint` | 0 / 0 |
| `npm run build` | 0 (9 packages) |
| `npm run test:unit` | 0 (54 files / 1329 tests) |
| `npm run test:integration` | 0 (4 tests) |
| `npm test` | 0 (58 files / 1378 tests) |
| Required-member suite ×3 consecutive | 0, 0, 0 (767/767 each) |
| `verify:consumer` / `verify:stage2` / `verify:stage3` / `verify:stage4` | 0 / 0 / 0 / 0 |
| `verify:stage5` | 0 — ALL checks passed, including the packed-consumer required-member probe: a plain-JavaScript consumer of the PACKED emitted compiler rejects action-without-`revision`, route-without-`id`, screen-without-`title`, and still compiles valid `@1`/`@2` definitions with an `applicationVersion` |
| `npm run example` | 0 — exactly 13 ordered ARA events |
| `npm run bench` | 0 — 10 events per completed run |
| `npm run example:application` | 0 — Stage 04 proof 17/17 |
| `git diff --check` | 0 |
| Clone clean afterwards | yes; clone removed |

One pre-push iteration detail, recorded for accuracy: the first pushed tip
(`1dc9083`) failed only `format:check` in the fresh clone (two lines of the
new test file needed a prettier pass after a late typecheck cast fix);
`0a842f9` is the formatting-only fixup, and the full ladder above was
executed against it. No history rewrite occurred (normal fast-forward
pushes only: `11e2644..1dc9083`, then `1dc9083..0a842f9`).

## Remaining genuine limitations

- Node 24 is NOT available in this environment (Node v22.13.1 satisfies the
  declared `>=22.13.0` floor); no Node 24 execution was performed or
  claimed. No second operating system is available; none was claimed.
- The documented LOW-05-B fixture load-sensitivity remains (read-only
  acknowledgment; one occurrence observed and investigated above; fixture
  intentionally untouched).
- npm 10.9.2 (bundled with the installed Node) crashes inside its arborist
  `#loadPeerSet` while resolving vitest 4.x OPTIONAL browser-provider peer
  ranges against current registry metadata. This reproduces with a pristine
  `npm install` of only the standard devDependencies in an empty directory
  (no Vict code involved), so it is purely environmental. The
  `verify:stage5` packed-consumer install passes `--legacy-peer-deps` with a
  full explanatory comment; every real peer of the generated host is an
  explicit devDependency, and the install/build checks are unchanged.
- npm-audit dev-toolchain advisories and the `node:sqlite` experimental
  warning (pre-existing, exit-neutral, unchanged from prior stages).
- LOW-05-B remains the only open carry-forward; LOW-05-A is closed by this
  correction.

## Ready for independent closure audit?

**YES** — LOW-05-A is closed with permanent runtime-boundary matrix
coverage, packed-consumer proof, negative controls at `d346bad`, and
byte-identical `@1`/`@2` identity preservation. The exit gate now holds:
malformed definitions fail with structured diagnostics rather than partial
silent rendering, before any renderer or release compilation can see them.
