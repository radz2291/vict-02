# UI foundation — current state

**2026-10-06 — U1 CANDIDATE COMPLETE; independent falsification review pending; not yet pushed.**
The owner authorized U1 (see [U1-HANDOFF](U1-HANDOFF.md)): the first runnable rendering,
editing and simulated product loop. Implemented per the frozen API-SPEC §9 scope:
`packages/ui` (vict.ui-document@1 neutral core: model, validation, compilation to
vict.ui-render-plan@1, transactional edits, sessions, occurrence identity, A-03 identity
ordering), `packages/sdk` (@3 authoring shape), `packages/application` (@3 joint compilation,
rules 1–5, A-01 expansion-cycle detection, A-03 identity payload), `packages/ui-svelte` (the
ONE document renderer), `packages/ui-editor` (session bridge, exported transactional command
builders, canvas/inspector/history), `packages/ui-preview` (scenario orchestration, coverage
denial, reset fencing), `examples/ui-authoring-proof` (inspection product + studio; consumes
built outputs; product entry graph imports no editor/preview modules — verified by test).
Candidate history: `182caa9…` → `b9e6573…` → `4e69175…` → `9284888…` → `7f49cd0…` → `505e0b1…`
→ walkthrough repairs `4f8c1ab…` → **candidate `351d3e5…`** (branch codex/ui-foundation-u1,
worktree vict-02-u1; starting commit `9734690…`).

Automated evidence: U1-01 identity suite (Examples A–D, dangling, catalog/pin collisions, old
release rejection, permutation+duplicate invariance, code-point order, navigation-loop-valid,
expansion-cycle-rejected, @3-never-aliases-@1/@2); transaction atomicity/idempotency/undo-redo/
expected-revision save/reopen; renderer occurrence provenance tests; preview isolation tests
(SCENARIO_COVERAGE_MISSING denial, reset-during-latency fencing, DOMAIN_CONFLICT, permission
denial); product-path tests through the real adapter (approve/deny/stale); adapter discipline;
entry-graph isolation. Root suites green except SIX failures verified PRE-EXISTING at the base
commit `9734690…` in the untouched u0 worktree (bootstrap-artifact, kernel child-process
identity, scaffolder real build, store-sqlite/server SIGKILL cross-process — Windows
environment specifics).

Browser walkthrough (real Chrome via CDP, commands + screenshots under
`examples/ui-authoring-proof/walkthrough/`): queue → detail (document-mode screen) → approve
updates status/activity through the adapter boundary; technician denial leaves state unchanged;
stale decision fails visibly; studio selection maps click → exact source occurrence; exported
transactional commands edit text/styles/interactions; invalid transactions rejected with
diagnostics and no partial effect; undo/redo/expected-revision save/reload round trip preserves
IDs/layout/bindings; preview normal approve via registered double, missingCoverage denies
without invoking any handler, reset-during-latency fences the in-flight result (SESSION_STALE).
Console sweep across all routes: zero errors/warnings/exceptions.

Measurements (PROOF-DESIGN §5 workload: 1,966 authored nodes, 100 repeated occurrences,
20 consecutive transactions): compile p95 **24.3 ms** (budget ≤ 250 ms), edit feedback p95
**16.8 ms** (budget ≤ 100 ms), scenario reset p95 **0.2 ms** (budget ≤ 1 s). Product bundle:
278 KB client JS (~94 KB gzip) for the whole example build; editor/preview modules absent from
the product entry graph.

Next: fresh independent falsification review of candidate `351d3e5…` (U1-01…U1-08) → repairs
if needed → reverify → evidence, normal push, remote SHA verification, owner checkpoint at the
U1 boundary. U2 remains unauthorized.

**U0 — CLOSED (2026-10-06).** Final state: contract candidate
`9ec87f3e7eb8eb7793f972111258940aac635346` (base `4d2df037d8a82d36c60bf1bff16919650643ce22`),
freeze record `ea47edd68e302dc5b6cacb2e43635d11781619ad` (FREEZE.json v2: 22 pins,
supersedes original record `ffbafc0a509d7179eddfa81c157595fe336c9dba` over candidate
`54490a861fcd9992bfc8bfac14178fdb7921ecf0` — both historically intact; the original 19 pins
reproduce), closure/remote commit `97346903e0c1a242b4bab0477c92bc3f34c43c38` (normal push,
remote SHA verified). Independent lineage: original rounds (reports preserved under
[reviews](reviews/)) → owner-authorized amendment (A-01 cycle scope, A-02 rejection→
correction→resubmission journey, A-03 catalog total ordering) → amendment review
([U0-AMENDMENT-REVIEW-01.md](reviews/U0-AMENDMENT-REVIEW-01.md), AMENDMENT HELD;
F-A-01…F-A-07) → five repairs → scoped recheck ([U0-AMENDMENT-RECHECK-01.md](reviews/U0-AMENDMENT-RECHECK-01.md),
REPAIRS VERIFIED — READY TO FREEZE) → fourth fresh checker
([U0-AMENDMENT-FREEZE-CHECK-01.md](reviews/U0-AMENDMENT-FREEZE-CHECK-01.md), FREEZE VERIFIED:
22/22 pins by two methods, lineage/fidelity/scope/truthfulness PASS, `npm ci` + typecheck +
format:check + check:ui clean). U0-01…U0-08 PASS (U0-08 demonstrated at the freeze-record SHA).
Retained non-blocking notes: F-A-06 pack fidelity 6/11 identical / 5/11 diverged (enumerated
in FREEZE.json; divergences are the authorized amendment targets plus the two mutable-discipline
files), F-A-07 `decidedAt` fixture omission (consistent with the approve fixture), checker
F-2 CRLF process note. A documented process incident (mistaken `rm -rf` of uncommitted
working-tree edits, fully restored from git before any commit) is recorded in
[decisions](DECISIONS-AND-EVIDENCE.md).

Round history: the pack was installed verbatim into `docs/ui-foundation/` at base
`4d2df037d8a82d36c60bf1bff16919650643ce22` (all installed digests matched the pack
`HASHES.json` inventory; see [decisions](DECISIONS-AND-EVIDENCE.md) §U0 installation record).
Local reconciliation is recorded in [RECONCILIATION](RECONCILIATION.md); exact schema/API/
diagnostic drafts and the module/export plan in [API-SPEC](API-SPEC.md); fictional domain,
proof walkthroughs, visual criteria and the named performance environment in
[PROOF-DESIGN](PROOF-DESIGN.md); representative fixtures under `fixtures/`. The root
`AGENTS.md` routing block is appended per `AGENTS.addendum.md`.

Pre-installation state (5 October 2026): the documentation execution pack and U0 design
contract were authored against observed VICT main
`4d2df037d8a82d36c60bf1bff16919650643ce22`. Independent documentation review of candidate 02
returned PASS after one minor candidate 01 ambiguity was repaired and rechecked. The owner
authorized starting pack preparation. No foundation code, new schema/API, reference
application, repository integration or Stage 9 change was implemented at that time.

## Identity and authority

- Source repository: https://github.com/radz2291/vict-02.
- Baseline: origin/main `4d2df037d8a82d36c60bf1bff16919650643ce22` — verified live at U0
  start, at the U0 amendment, and again at U1 branch creation (unmoved).
- Current branch: codex/ui-foundation-u1 (isolated worktree `vict-02-u1`), created at
  `97346903e0c1a242b4bab0477c92bc3f34c43c38`; normal push destination. The completed
  `codex/ui-foundation-u0` branch and its worktree are preserved as delivered.
- Delivery location: `docs/ui-foundation/` (frozen contract bytes) plus the U1 implementation
  scope frozen at [API-SPEC](API-SPEC.md) §9.
- Authority: U0 completed and accepted; U1 authorized by the owner on 2026-10-06 with
  end-to-end ownership (see [U1-HANDOFF](U1-HANDOFF.md) §1 for the verbatim grant scope).
  U2–U4 remain the delivery plan, not an unattended implementation grant.
- Concurrent work: Stage 9 branches and other ui-foundation/qa/pi tracks on the remote belong
  to other agents and are left untouched; U1 never modifies `apps/studio` or Stage 9 bytes.

## Current gate ledger

| Item | Status | Candidate/verifier | Next action |
| --- | --- | --- | --- |
| Pack drafting | COMPLETE | Candidate 02; final reporting metadata folded afterward | Installed 2026-10-06; see decisions §U0 installation record |
| Pack independent review | PASS — documentation only | Candidate 01: 8d2683a2a1aae7740755326af597eeed16b4a7a44cfdaf4a9d60cd8b76318e6d; candidate 02: db369614c97119762995480d3ad277b92d21e2eb812739d770bc16bf2df6b15a | Reports preserved under reviews/ |
| U0 repository establishment/freeze | **CLOSED — amended contract frozen (22 pins) and freeze-byte verified; owner accepted; pushed (`a664c70…` → `9734690…` fast-forward)** | Candidates `54490a8…`/`9ec87f3…`; freeze records `ffbafc0…`/`ea47edd…`; four independent verdicts incl. FREEZE VERIFIED (`9b80f3d4…`) | None — closed. Preserve freeze records and historical evidence |
| U1 rendering/editing loop | **CANDIDATE COMPLETE — falsification review pending** (handoff [U1-HANDOFF](U1-HANDOFF.md)) | Candidate `351d3e5…` (from `9734690…`; contract authority `9ec87f3…`); automated suites + browser walkthrough + measurements recorded | Fresh independent verifier (U1-01…U1-08) → repairs/reverify → evidence, push, remote SHA verify, owner checkpoint |
| U2 breadth | PLANNED | None | Requires U1 pass and its own accepted scope |
| U3 realism | PLANNED | None | Requires U2 and its own accepted scope |
| U4 reuse/handoff | PLANNED | None | Requires U3 and its own accepted scope |

## Baseline observations

- Root AGENTS.md routes existing work through the system reference and Stage 9 pack; preserve it.
- SDK accepts application schema @1/@2; application compile uses closed field sets and versioned canonical identity.
- Application Release binds the compiled applicationVersion and renderer/data-adapter/component identities.
- UI composition is currently closed stack/split plus semantic presets.
- Existing UI and Svelte package manifests declare 0.4.0-rc.1. This is source evidence, not a newly checked npm registry claim.
- Existing ApplicationDataAdapter query/mutate context carries permissions/effect/actor.
- System reference describes capability simulation doubles; the exact callable composition APIs (`registerDouble`/`replaceDouble`/`snapshotDoubles` and the adapter context) were reconciled in [RECONCILIATION](RECONCILIATION.md) §4.

## Missing proof and limits

U1 status (2026-10-06, at authorization): no implementation evidence exists yet — no contract
element executed as code, no browser/visual work, no performance measurements, no adapter or
double runtime execution for the document model, no U1 candidate commit. The frozen U0
fixtures remain contract examples for review, not executed evidence. Everything below the U0
line is unchanged: no package publication, no npm-registry verification, no Studio
integration. U1 verification must add runtime evidence per [U1-HANDOFF](U1-HANDOFF.md) §4;
design-fixture inspection alone does not establish runtime behavior.

Pack-review limits remain historical facts: the pack documentation review established the
pack's adequacy only, and its candidate-02 snapshot excludes the folded reporting metadata
(final delivery hashes in the pack inventory). U0 repository freeze evidence is recorded in
this repository: FREEZE.json, [decisions](DECISIONS-AND-EVIDENCE.md), and the preserved
reports under [reviews](reviews/).

## Update discipline

After each candidate/review/repair, update this opening state and ledger rather than append
contradictory "current" statuses. Historical decisions/evidence remain in
DECISIONS-AND-EVIDENCE. Include full tested candidate/verifier SHAs and the next authorized
action. Do not copy mutable status into AGENTS.
