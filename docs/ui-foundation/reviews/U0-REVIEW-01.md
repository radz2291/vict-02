# Independent U0 contract review — VICT UI foundation workstream (review 01)

- Reviewer: fresh-context independent verifier. I did not author any candidate byte, did not
  participate in the pack authoring or the U0 installation, and did not adopt the builder's
  reasoning. My job was falsification; I repaired nothing.
- Audited candidate (exact): `f7767b2750d85399e7200991e503e061001ee03f`
  (branch `codex/ui-foundation-u0`, worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u0`, verified
  via `git rev-parse HEAD`).
- Base (declared): `4d2df037d8a82d36c60bf1bff16919650643ce22` — live `origin/main`
  re-verified during this review via `git ls-remote origin refs/heads/main`.
- Authority documents read by this reviewer (not summarized from the builder's prose):
  pack `README.md`/`AGENTS.addendum.md`/`HASHES.json` at
  `C:/Users/RZ1/Downloads/VICT-UI-Foundation-Pack-v0.1/VICT-UI-Foundation-Pack/`, and the
  installed `docs/ui-foundation/` set at the candidate SHA.
- Independence: the only file I created is this report. No edits inside
  `vict-02-u0` or the main checkout; no mutating git commands; no npm install/build/test runs
  (documentation gate — none required). Working tree of `vict-02-u0` confirmed clean after all
  checks (`git status --short` empty).

## 1. Candidate verification (task 1)

- `git rev-parse HEAD` → `f7767b2750d85399e7200991e503e061001ee03f` — exact match.
- `git log --oneline 4d2df03..HEAD` → exactly one commit:
  `f7767b2 docs(ui-foundation): U0 contract candidate — install VICT-UI-Foundation-Pack v0.1 verbatim + local reconciliation artifacts`.
- `git diff --stat 4d2df03..f7767b2` → 26 files, **3811 insertions, 0 deletions**, all inside
  allowed paths: `docs/ui-foundation/**`, root `AGENTS.md`, root `README.md`. No production
  source, manifests, lockfiles, `apps/studio`, other-track or Stage 9 bytes touched.
- `AGENTS.md` diff is a **pure insertion** (14 added lines, `@@ -5,3 +5,17 @@`). I extracted
  the appended block and byte-compared it against the addendum's block (`sed` + `diff`):
  identical. Existing root guidance preserved verbatim.
- `README.md` diff: 2 added physical lines forming ONE wrapped docs-index bullet
  (`docs/ui-foundation/STATE.md — UI foundation workstream entry point …`). See Finding F-6.
- Remote state: `origin` = `https://github.com/radz2291/vict-02.git` (fetch+push); live
  `refs/heads/main` = `4d2df037d8a82d36c60bf1bff16919650643ce22` (still equal to the pinned
  base at review time). Concurrent remote branches (Stage 9 G3 lineage) untouched.

## 2. Pack-installation fidelity (task 2)

I independently recomputed SHA-256 for all 11 shared files in both the pack and the installed
copy (`sha256sum`), and compared against the pack `HASHES.json`:

| File | Pack file | Installed copy | HASHES.json | Result |
| --- | --- | --- | --- | --- |
| AGENTS.addendum.md | f341c7b9…aa8c2 | f341c7b9…aa8c2 | f341c7b9…aa8c2 | MATCH |
| CONTRACTS.md | 42ef3089…96a2 | 42ef3089…96a2 | 42ef3089…96a2 | MATCH |
| DECISIONS-AND-EVIDENCE.md | 947629ca…c81c | **5d09972c…87cb** | 947629ca…c81c | DISCLOSED DIFF |
| HANDOFF.md | 769fc1e4…8237 | 769fc1e4…8237 | 769fc1e4…8237 | MATCH |
| PRODUCT-ARCHITECTURE.md | ca2ac84a…390f | ca2ac84a…390f | ca2ac84a…390f | MATCH |
| STAGES-AND-VERIFICATION.md | c7e07960…acad | c7e07960…acad | c7e07960…acad | MATCH |
| STATE.md | 957818b1…d70e | **463ca8dd…54e0** | 957818b1…d70e | DISCLOSED DIFF |
| reviews/PACK-REVIEW-01.md | 67162f3f…8f47 | 67162f3f…8f47 | 67162f3f…8f47 | MATCH |
| reviews/PACK-REVIEW-02.md | fd85de7f…17fed | fd85de7f…17fed | fd85de7f…17fed | MATCH |
| reviews/candidate-01.json | 8d2683a2…18e6d | 8d2683a2…18e6d | 8d2683a2…18e6d | MATCH |
| reviews/candidate-02.json | db369614…6b15a | db369614…6b15a | db369614…6b15a | MATCH |

The exactly two divergent installed files (STATE.md, DECISIONS-AND-EVIDENCE.md) are the same
files named in `HASHES.json.post_review_reporting_metadata`. I diffed installed vs pack:

- **STATE.md**: opening status replaced with the 2026-10-06 U0-execution opening (honestly
  declaring "independent review NOT yet done; freeze pins and SHAs NOT YET RECORDED"); the
  original opening preserved (with tense edits) as "Pre-installation state"; ledger rows
  updated; worktree/branch/concurrency notes updated. This matches the file's own update
  discipline and what the installation record declares. No authority or scope drift: U1–U4
  remain PLANNED; U0 closure conditions unchanged.
- **DECISIONS-AND-EVIDENCE.md**: exactly (a) the four pack-review links rewritten from
  `../../reviews/…` to installed `reviews/…`, and (b) the added "U0 installation record"
  section — exactly what the record declares. See Finding F-4 for an imprecise digest citation
  inside that new section.
- Pack `README.md`/`START-HERE.md` correctly NOT installed (pack README itself says "Keep this
  README and START-HERE as pack delivery aids").

Candidate-manifest lineage cross-check: candidate-01 vs candidate-02 manifests differ only in
the CONTRACTS.md and STAGES-AND-VERIFICATION.md digests (README/START-HERE/STATE identical),
matching the ledger's claim that the 01→02 diff was restricted to the F-01 clarification plus
manifest values. `HASHES.json.independent_contract_review_manifest_sha256` equals the
candidate-02 manifest digest `db369614…6b15a`. Verified.

## 3. Per-criterion verdicts (task 3)

Vocabulary per docs/ui-foundation/STAGES-AND-VERIFICATION.md §1–§2.

| Criterion | Verdict | Direct evidence (all at candidate SHA) |
| --- | --- | --- |
| U0-01 Baseline | **PASS** | Remote URL + live main re-fetched by me (§1 above); branch created at base with exactly one commit; isolated worktree (`git worktree list` shows `vict-02-u0` on `codex/ui-foundation-u0`, main checkout on an unrelated Stage 9 branch, untouched); clean tree; AGENTS append-only; concurrent-work classification recorded (RECONCILIATION §1). |
| U0-02 Ownership | **PASS** | PRODUCT-ARCHITECTURE §1–§2 (same Studio; reusable/reference vs complete-app; complete Studio = separate agent); HANDOFF §3 excludes `apps/studio`/other tracks; DECISIONS D-01 records the owner split; RECONCILIATION §5 marks `apps/studio` read-only. Diff proves no excluded path touched. |
| U0-03 Canonical source | **PASS** | RECONCILIATION §2 verified by me against sources (§4.a below): schema constants, closed field sets, `computeApplicationVersion`, `canonicalApplicationManifest`, `RELEASE_APPLICATION_MISMATCH` binding at `packages/application/src/release.ts:275-283`; APP-019 disposition specified (RECONCILIATION §2.5 quoting `docs/VICT-SYSTEM-REFERENCE.md:3785`; DECISIONS T-01). |
| U0-04 Contracts | **PASS** | CONTRACTS §1–§10 semantics; API-SPEC §3–§5 exact schema drafts, §7 diagnostic catalog (25 codes), §8 public API signatures; 10 fixtures on disk, all valid JSON, 5 negatives; fixture schema markers use only the six proposed/known families. Non-blocking findings F-2, F-3, F-5, F-7. |
| U0-05 Execution | **PASS** | RECONCILIATION §4 verified at source: `registerDouble`/`replaceDouble`/`hasDouble`/`getDoubleModes`/`snapshotDoubles` (`packages/runtime/src/registry.ts:366-435`, duplicate rejection at :386), fail-closed remediation text (`packages/runtime/src/effect-policy.ts:60`), adapter context `{permissions, effect, actor}` (`packages/application/src/data.ts:15-22`) + stable error codes; API-SPEC §6 reset/fencing/durable-replacement design reuses exactly these boundaries, no second engine. |
| U0-06 Module/reuse plan | **PASS** | API-SPEC §9 exact directories/exports/edges; every edge re-verified against actual `packages/*/package.json` (sdk→contracts+ui; application→contracts+sdk+ui; runtime→contracts+kernel+sdk; ui-svelte→application+sdk+ui+bits-ui+@internationalized/date, peer svelte ^5.33.0; ui fully neutral); acyclicity rule; editor/preview exclusion (A-04); built-artifact consumer rule (U4-01 language). |
| U0-07 Product/evaluation | **PASS** | PROOF-DESIGN §2 covers all eight PRODUCT-ARCHITECTURE §6 scenarios 1:1 (§4.c below); §3 walkthroughs for all three proof experiences; §4 visual criteria incl. required sizes 1440×900 / 1024×768 / 390×844 + 480px container; §5 named environment + provisional budgets matching STAGES §8, explicitly no fabricated measurements. Finding F-1 (one browser datum). |
| U0-08 Independent freeze | **NOT DEMONSTRATED** (at this SHA, as designed at this checkpoint) | No freeze pins, no freeze record, no separate freeze-byte checker, no recorded candidate/reviewer/checker SHAs or final verdict exist in the candidate. STATE.md honestly declares this ("freeze pins … NOT YET RECORDED"; ledger row "IN PROGRESS"). This report is the fresh-challenge step of WP-6; the freeze/record/fresh-checker steps remain outstanding and cannot be demonstrated at any pre-freeze candidate. |

## 4. Falsification log (task (a)–(e) spot checks)

**(a) RECONCILIATION claims vs actual sources** — every load-bearing claim I attacked held:

- Schema constants: `packages/sdk/src/application.ts:26,36,38,40` = `vict.application@1`,
  `vict.application@2`, `vict.resource@1`, `vict.application-release@1` exactly as quoted;
  `packages/application/src/compile.ts:1096,1104` = identity @1/@2;
  `packages/application/src/release.ts:21` = `vict.application-release-identity@1`.
- Closed field sets: `compile.ts:130` APPLICATION_FIELDS (schema,id,revision,name,…,theme),
  `:148` ROUTE_FIELDS_V2 (+redirect), `:152` SCREEN_FIELDS_V2 (+breadcrumbs,layoutMode,
  composition), `:167` STATES_FIELDS_V2 (+stale,partial), `:188` per-kind ACTION_FIELDS;
  unknown fields produce structured diagnostics (`:648 unknownFields`, code
  `APPLICATION_UNKNOWN_FIELD`) — no silent strip. `CompileApplicationInput`
  (`compile.ts:118-124`) has NO UI-document input today, confirming the @3 amendment is new.
- `canonicalApplicationManifest` (`compile.ts:1113ff`): set-like collections sorted by id;
  routes/regions/form fields order preserved — as claimed.
- `computeApplicationVersion` (`compile.ts:1175ff`): `v1_` + sha256 over stableJson of
  {identitySchema, applicationSchema, manifest, referencedResources, referencedViews,
  referencedActions, referencedComponents} with sorted reference lists — as claimed; the @3
  extension therefore only adds a hash input, it does not alter @1/@2.
- Release binding: `release.ts:275-283` — `RELEASE_APPLICATION_MISMATCH` fires unless
  applicationId AND applicationRevision AND applicationVersion all match the compiled plan.
  The claimed "UI edit ⇒ new applicationVersion ⇒ old release rejected" consequence is real.
- Data adapter: `data.ts:15-22` context {permissions, effect, actor}; stable codes
  DATA_UNKNOWN_RESOURCE/DATA_UNAUTHORIZED/DATA_MUTATION_NOT_DECLARED/DATA_IDEMPOTENT_REPLAY…
  verified in the union type and call sites; `runApplicationDataAdapterSuite` exists in
  `packages/application/src/data-conformance.ts`.
- Doubles: `registry.ts:366-403` — duplicate registration rejected
  (VICT_RUNTIME_DOUBLE_FOR_UNKNOWN_CAPABILITY for unknown ids,
  VICT_RUNTIME_DOUBLE_ALREADY_REGISTERED for duplicates, explicit "Use replaceDouble()"),
  `:405` replaceDouble requires an existing double, `:426-435`
  hasDouble/getDoubleModes/snapshotDoubles; `effect-policy.ts:57-61` — missing required double
  yields a denial with the exact remediation string quoted in RECONCILIATION §4.1. EFF-003/
  EFF-004 confirmed at `docs/VICT-SYSTEM-REFERENCE.md:3219-3220`.
- Renderer boundary: `packages/application/src/renderer.ts:18-23` all six diagnostic codes;
  `:52-54` `ActionDispatcher.execute(actionId, input?): Promise<ActionResult>` — as claimed.
- APP-019: `docs/VICT-SYSTEM-REFERENCE.md:3785` exact text and Deferred/Not Scheduled status.
- Dependency graph: all edges re-derived from package manifests — matches RECONCILIATION §3
  and API-SPEC §9 (see U0-06).

**(b) Unused-name check for the six proposed markers** — `git grep` at the candidate for
`vict.application@3`, `vict.application-identity@3`, `vict.ui-document`, `vict.ui-render-plan`,
`vict.ui-edit`, `vict.ui-scenario`: **zero matches under packages/, apps/, scripts/, examples/**
(exit 1). Repo-wide matches exist only in historical docs/prose that explicitly state
`vict.application@3` does not exist. All six proposed markers are unused in code. PASS.

**(c) API-SPEC internal consistency** —

- Prose-referenced codes vs §7 table: every code referenced in §2–§6 prose and code blocks is
  defined in the §7 table, with one deliberate exception: `RELEASE_APPLICATION_MISMATCH`
  (§2.3 Example B) is an EXISTING release diagnostic (`release.ts:31`), and §2.3 states "No
  new release diagnostic is introduced" — the §7 table freezes the new UI/scenario codes.
  Defensible, but the table header does not state that scope (Finding F-5).
- Fixtures reference only defined codes/fields: negative fixtures target
  UI_DOC_REVISION_COLLISION, UI_DOC_STALE_REVISION, SCENARIO_COVERAGE_MISSING,
  UI_DOC_UNKNOWN_COMPONENT (node references `def.missing-card` absent from
  `componentDefinitions`), UI_DOC_DUPLICATE_NODE_ID, UI_APP_PRESENTATION_MODE_INVALID
  (screen has BOTH `uiDocument` AND `layout`) — all present in §7.
- §9 module-plan edges vs the actual dependency graph: consistent (see U0-06); no
  ui→sdk/application/runtime/DOM/Svelte edge proposed; new packages stay strictly above the
  application/runtime boundary.
- Fixture table vs disk: **10 files on disk vs 9 table rows** —
  `application-v3-catalog-collision.json` is missing from the §10 inventory (Finding F-2);
  and the valid-application row overstates "catalog + pin match" while the fixture's
  `uiDocumentPins` is `[]` (Finding F-3).

**(d) PROOF-DESIGN scenario coverage** — PRODUCT-ARCHITECTURE §6 names eight scenarios
(normal submitted inspection; empty queue; long content/many findings; latency; operation
failure; missing implementation; insufficient permissions; conflicting/stale decision).
PROOF-DESIGN §2's table lists exactly those eight with seeds, operations and expected
observables, plus the durable-replacement proof tied to scenario 1. Full coverage; no
invented ninth scenario presented as required. PASS.

**(e) PROOF-DESIGN §5 environment** — the section explicitly defers all measurements to U1+
("Named U0 environment (recorded 2026-10-06; measurements happen in U1+…)"); no fabricated
performance numbers exist anywhere in the candidate. I re-measured the named environment on
this machine: Windows 11 Home build 26200, System Model 81N4, 12,102 MB RAM, Node v22.13.1,
npm 11.19.1, Chrome 154.0.8037.92 — **all exact matches**. Exception: the recorded
"Edge 155.0.8059.26" does not match the installed Edge (154.0.4258.53); the string
`155.0.8059.26` matches the STAGED CHROME 155 update present in Chrome's application
directory (Finding F-1). One of the two browser datums is therefore mis-transcribed; the
environment is still "named and internally recorded", so this is non-blocking but must be
corrected before U1 measures against it.

## 5. Findings

Severity ladder: BLOCKER / MAJOR / MINOR / NOTE. No BLOCKER and no MAJOR found.

- **F-1 (MINOR) — PROOF-DESIGN §5 environment table: Edge version datum mis-recorded.**
  Location: `docs/ui-foundation/PROOF-DESIGN.md` §5 table ("Edge 155.0.8059.26").
  Effect: U1+ performance work measuring "the environment named at measurement time" could
  select/verify against a browser version that does not exist on this machine; an auditor
  reproducing the named environment hits a mismatch on one of seven datums.
  Repair suggestion (not applied): re-read the installed Edge version and correct the cell
  (currently 154.0.4258.53), or name Chrome 154.0.8037.92 as the measured browser and drop
  Edge from the table; note the staged Chrome 155 update explicitly.
- **F-2 (MINOR) — API-SPEC §10 fixture inventory omits a shipped fixture.**
  Location: `docs/ui-foundation/API-SPEC.md` §10 table vs `fixtures/` (10 files, 9 rows;
  `application-v3-catalog-collision.json` absent, though §2.2 rule 2 defines the behavior it
  demonstrates and the valid fixture's note points to it).
  Effect: an implementer building from the frozen §10 inventory would miss the catalog-
  collision negative fixture; the freeze would pin an incomplete inventory.
  Repair suggestion (not applied): add the row ("two catalog entries for the same
  (documentId, revision) with differing nodes ⇒ UI_DOC_REVISION_COLLISION (authority:
  catalog)").
- **F-3 (MINOR) — §10 row for application-v3-valid.json overstates fixture content.**
  Location: `docs/ui-foundation/API-SPEC.md` §10 ("catalog + pin match") vs the fixture's
  `uiDocumentPins: []` and its own note ("pins are optional explicit inputs").
  Effect: minor freeze-time inaccuracy; the pin-match path is not actually exercised by the
  valid fixture.
  Repair suggestion (not applied): reword to "one document-mode screen + one legacy screen;
  catalog resolution, pins omitted (optional)".
- **F-4 (MINOR) — U0 installation record cites the wrong STATE.md lineage digest.**
  Location: `docs/ui-foundation/DECISIONS-AND-EVIDENCE.md` §"U0 installation record":
  "delivered opening bytes remain in pack review lineage (candidate 02 digest `8f7aeda…`)".
  The delivered bytes that "matched the pack HASHES.json inventory" were the pack STATE.md at
  `957818b1…d70e`; candidate-02's manifest pins an earlier STATE.md revision (`8f7aeda…`),
  and the two digests are different revisions. The exact delivered bytes remain recoverable
  from the pack, so nothing is lost.
  Effect: a future freeze/audit reproducing "delivered opening bytes" from the cited digest
  restores different bytes than were installed; the lineage sentence is internally
  inconsistent with its own first sentence.
  Repair suggestion (not applied): cite HASHES.json digest `957818b1…d70e` as the delivered
  STATE.md bytes and `8f7aeda…` explicitly as the pre-fold review snapshot.
- **F-5 (NOTE) — §7 diagnostic-catalog scope sentence missing.**
  Location: `docs/ui-foundation/API-SPEC.md` §7 header. `RELEASE_APPLICATION_MISMATCH`
  (referenced in §2.3) is intentionally outside the frozen table because it is an existing
  VICT release diagnostic, but the header does not say the table freezes only the new
  UI/scenario codes. Repair suggestion (not applied): add "existing application/release/
  runtime diagnostics keep their existing definitions and are not re-listed here."
- **F-6 (NOTE) — "one docs-index line" is one wrapped entry over two physical lines.**
  Location: root `README.md` diff (2 inserted lines, 1 bullet). HANDOFF §3 allows "a concise
  link … in an existing documentation index"; the addition is concise and non-conflicting,
  but RECONCILIATION §1's phrase "one docs-index line" is imprecise at byte level.
  Repair suggestion (not applied): either collapse to one physical line or record "one
  wrapped entry (2 lines)" in the freeze record.
- **F-7 (NOTE) — two negative fixtures lack an explanatory note.**
  Location: `fixtures/ui-document-invalid-dangling-component.json`,
  `fixtures/ui-document-invalid-duplicate-node.json` (no `note` field naming the expected
  diagnostic, unlike the other three negatives). Intent remains clear from the filenames and
  content. Repair suggestion (not applied): add one-line notes naming
  UI_DOC_UNKNOWN_COMPONENT / UI_DOC_DUPLICATE_NODE_ID.

**U0-08 (NOT DEMONSTRATED)** is not a candidate defect: the freeze half of WP-6 is
definitionally post-review. It is recorded here as the open required work, not as a finding
against the bytes.

## 6. Overall verdict

**HELD**

Reasoning: U0-01 through U0-07 are demonstrated by the candidate with direct, independently
re-verified evidence, and every falsification attack I ran against the candidate's claims
held. The candidate contains **no blocking defect** (findings: 4 MINOR, 3 NOTE). However,
criterion U0-08 (freeze pins, freeze record, separate independent freeze-byte verification,
recorded candidate/reviewer/checker SHAs, final verdict) is **NOT DEMONSTRATED at this SHA**,
exactly as STATE.md honestly declares, and missing proof cannot be promoted to pass. A stage
verdict of PASS would therefore be dishonest; HELD (gate not yet closable, no repair demanded
beyond the optional minor fixes) is the accurate state.

This review is the "fresh contract reviewer challenges exact contract candidate" step of
HANDOFF WP-6. Remaining before U0 closure: record this review in STATE/ledger; optionally
apply F-1..F-4 repairs and re-review affected bytes; pin the final contract bytes + commit
SHA in a freeze record committed AFTER the contract commit; have a FRESH checker reproduce
the pins; normal-push and verify the remote SHA; owner report. This report must never be
cited as the freeze-byte verification, and it grants no U1 authorization.

## 7. Reproduction commands (read-only, all at the audited SHA)

```
cd C:/Users/RZ1/Desktop/RZ/vict-02-u0
git rev-parse HEAD
git diff --stat 4d2df037d8a82d36c60bf1bff16919650643ce22..f7767b2750d85399e7200991e503e061001ee03f
git diff 4d2df03..f7767b2 -- AGENTS.md README.md
git grep -n "vict.application@3|vict.ui-document|vict.ui-render-plan|vict.ui-edit|vict.ui-scenario" -- packages apps scripts examples
git ls-remote origin refs/heads/main
sha256sum docs/ui-foundation/{CONTRACTS,STAGES-AND-VERIFICATION,PRODUCT-ARCHITECTURE,HANDOFF,STATE,DECISIONS-AND-EVIDENCE}.md docs/ui-foundation/AGENTS.addendum.md docs/ui-foundation/reviews/*
node --version; npm --version   # environment cross-check vs PROOF-DESIGN §5
python JSON validation over docs/ui-foundation/fixtures/*.json
```
