# Decisions and evidence

Date: 5 October 2026
Preserve prior decisions and failures. Distinguish owner decisions from technical design proposals.

## D-01 — one Studio product, separate foundation ownership

Owner context: “Stage 9 actually are proposing a studio, but it is a VICT native Studio”; “I want the UI foundation to be great first. Then I revisit Stage 9 Studio development, but that's gonna be handled by a different agent.”

Disposition: this work delivers reusable UI foundation, authoring modules, reference proofs and an integration handoff. The other agent owns the complete Studio application and subsequent integration.

The owner replied “Good” after this split was explained. This supersedes the earlier proposal's wording that could imply this session delivers a separate complete Studio authoring application. It does not erase Stage 9's operator evidence or declare visual authoring already implemented.

Affected records: PRODUCT-ARCHITECTURE, STAGES, HANDOFF, STATE.

## D-02 — governance and pack preparation

Owner asked: “Good. do you know how do we work? from govern-project-agents.. can you explain so i can verify”, then “Do you need to prepare any documentation packs?”, then “Ok lets start”.

Disposition: prepare the project-specific execution pack and its bounded U0 contract work. Use one stage manager, independent challenge, repair/re-verification and truthful state. Do not invent owner approval of every future implementation stage.

This delivered first handoff stops at U0. Later stages remain proposed delivery slices; their actual authority is recorded in subsequent accepted handoffs.

## D-03 — actual UI with simulated implementation

Owner vision: quickly create the actual application UI, use stubs/demo implementations to review product understanding, then progressively implement machinery without discarding the UI.

Disposition: one canonical source and renderer, contract-bound simulation, truthful per-operation coverage and specific durable replacement proof. Preserve UI when contracts remain compatible; product discoveries may require deliberate changes and must be disclosed.

## T-01 — versioned canonical UI attachment (technical candidate)

Observation: closed application @1/@2 schemas and versioned identity reject unknown UI-document fields. Application Release checks applicationVersion against the compiled plan.

Proposed choice: an opt-in @3 application/identity shape, screen document reference, explicit compile catalog and reachable source hashes. This is not an existing capability. U0 verifies names and exact public boundaries locally and freezes the choice.

Alternatives considered: unattached editor file (reject: misses canonical source/identity); arbitrary generated Svelte (reject: hides editable truth); opaque component with UI source only in mutable props/registry (reject as foundation: does not establish canonical generalized authoring and identity).

Affected records: CONTRACTS §1, A-03, U0-03 and U1-01.

## T-02 — neutral dependency direction (technical candidate)

Observation: SDK depends on UI; application imports SDK and UI. Neutral UI must not import SDK/application/runtime to resolve semantics.

Proposed choice: explicit structurally typed semantic/extension catalogs passed to neutral UI compile, with joint identity/reference validation in application compilation. Svelte stays at the renderer/editor boundary. U0 verifies the full dependency graph.

## E-01 — read-only repository reconnaissance

Repository: radz2291/vict-02.
Live main on 5 October 2026: `4d2df037d8a82d36c60bf1bff16919650643ce22`.

Sources inspected through authenticated read-only repository access:
- Root AGENTS.md and package.json.
- docs/architecture/STAGE-09-STUDIO-AND-RECOVERY.md.
- docs/governance/VICT-STAGE-09-STATE.md and formal closure record.
- docs/VICT-SYSTEM-REFERENCE.md, including APP-019 and simulation description.
- apps/studio/src/lib/application/definition.ts and the generic VitApp host.
- packages/sdk/src/application.ts and package.json.
- packages/application/src/compile.ts, release.ts, data.ts and public index.
- packages/ui/src/index.ts, composition.ts and package.json.
- packages/ui-svelte/package.json.

Observed claims: Stage 9 is an existing native operator consumer and explicitly excludes visual application authoring; formal closure is recorded. General current composition has a bounded stack/split vocabulary. Application source/identity/release and data-adapter boundaries are explicit.

An attempted packages/application/src/definition.ts read returned unavailable; the actual definition is packages/sdk/src/application.ts. No claim rests on the unavailable path.

No shell clone/build/test/browser/registry verification occurred here. Remote file observations are not local checkout evidence. The unshared separate HTML Studio prototype has not been inspected.

Pinned source root:
https://github.com/radz2291/vict-02/tree/4d2df037d8a82d36c60bf1bff16919650643ce22

## Pack review ledger

Reviewer: independent fresh-context agent /root/pack_review. The reviewer did not author or repair the candidate. Documentation adequacy was challenged against pinned source and the exact file-hash manifests.

| Candidate | Manifest SHA-256 | Verdict and disposition |
| --- | --- | --- |
| 01 | 8d2683a2a1aae7740755326af597eeed16b4a7a44cfdaf4a9d60cd8b76318e6d | PASS WITH NON-BLOCKING FINDINGS; one MINOR F-01 collision-comparison-authority ambiguity |
| 02 | db369614c97119762995480d3ad277b92d21e2eb812739d770bc16bf2df6b15a | PASS — documentation only; F-01 RESOLVED through independent affected review |

F-01: the original contract promised rejection of same-revision/different-byte source without naming comparison authority. Repair: CONTRACTS §1 now checks competing explicit catalog entries or supplied immutable pins, states that one current input without history cannot prove a historical collision, and keeps revision enforcement in the explicit authoring/session boundary. U1-01 now specifies the catalog/pinned collision negative.

The candidate 02 reviewer confirmed all nine file digests, exact manifest hash and a diff restricted to those two clarifications plus manifest values. No scope, authority or source-identity regression was found. Original finding/report and both manifests are preserved: [review 01](reviews/PACK-REVIEW-01.md), [review 02](reviews/PACK-REVIEW-02.md), [manifest 01](reviews/candidate-01.json), [manifest 02](reviews/candidate-02.json).

Post-review changes: truthful result metadata in README, STATE and this ledger; copies of reports/manifests; final content inventory/archive. These reporting/packaging bytes are outside candidate 02's independently reviewed snapshot. The architecture/contracts/stages/handoff/agent-entry/start instruction retain the reviewed bytes. Root validates final links, content hashes and archive integrity; it does not call that a second independent review.

This evidence is separate from U0 repository freeze and U1–U4 implementation gates. No repository candidate/verifier SHA or runtime pass is invented.

## U0 installation record (2026-10-06, local repository)

The pack was installed verbatim into `docs/ui-foundation/` of the isolated branch `codex/ui-foundation-u0` at base `4d2df037d8a82d36c60bf1bff16919650643ce22`. The six `docs/ui-foundation` documents, `AGENTS.addendum.md` and the two preserved review reports with both candidate manifests matched the pack `HASHES.json` inventory byte-for-byte at copy time. README and START-HERE remain pack-delivery aids and were not installed.

Installed-copy repairs (made before candidate review, recorded here):

- The four pack-review links in the ledger above were rewritten from pack-relative `../../reviews/…` paths to the installed `reviews/…` locations so links resolve inside the repository. Report and manifest bytes are unchanged.
- `STATE.md` is updated in place per its update discipline as U0 proceeds; the delivered pack STATE bytes are inventory digest `957818b1ffb47c9ebac2be3dcc2d0eb11eca177312ba46109d439c64e806d70e` (final `HASHES.json`, post-review metadata included), while the candidate-02 reviewed STATE snapshot was `8f7aeda86896ef83669e394e9a48e527f5db849a3e0fb880642a2f36bb05a963`; the installed copy departs from both through the disclosed opening/ledger update above.

## U0 contract review round 1 and repairs (2026-10-06)

Identity: repository radz2291/vict-02, branch `codex/ui-foundation-u0`, base
`4d2df037d8a82d36c60bf1bff16919650643ce22`, reviewed candidate
`f7767b2750d85399e7200991e503e061001ee03f`.

Claims and verdict: the independent fresh-context verifier (non-author; report preserved
verbatim at [reviews/U0-REVIEW-01.md](reviews/U0-REVIEW-01.md), report SHA-256
`456e910a2873cfc613ed064909e12716fadb4f6372bcf0d6b81fc539de19c241`) challenged the exact
candidate
bytes against U0-01..U0-08. Criterion results at that SHA: U0-01..U0-07 PASS (each with
independently re-derived source evidence); U0-08 NOT DEMONSTRATED — correctly so at a
pre-freeze candidate, since freeze pins, the freeze record, the separate freeze-byte checker
and recorded candidate/reviewer/checker SHAs do not exist yet. Overall verdict: **HELD** —
no blocker; the gate completes after repairs, re-review and freeze verification.

Findings and repair disposition (all repaired in this round; none blocked):

| Finding | Severity | Repair |
| --- | --- | --- |
| F-1 Edge version datum wrong (staged 155 recorded as installed) | MINOR | PROOF-DESIGN §5 now records the installed executable version 154.0.4258.53 and discloses the staged package |
| F-2 §10 fixture table omitted `application-v3-catalog-collision.json` | MINOR | row added |
| F-3 `application-v3-valid.json` row overstated "catalog + pin match" | MINOR | row reworded (pins are optional inputs, omitted in that fixture) |
| F-4 installation record conflated delivered vs reviewed STATE digests | MINOR | record now cites both `957818b1…` (final inventory) and `8f7aeda8…` (candidate-02 snapshot) precisely |
| F-5 §7 lacked a scope sentence for pre-existing VICT diagnostics | NOTE | scope paragraph added (`RELEASE_APPLICATION_MISMATCH` etc. remain governed by their owning modules) |
| F-6 "one docs-index line" imprecise at byte level | NOTE | RECONCILIATION §1 reworded (single wrapped bullet) |
| F-7 two negative fixtures lacked expected-diagnostic notes | NOTE | notes added |

Additional manager-identified repair, disclosed beyond the reviewer's list: the
`ui-document-invalid-duplicate-node.json` fixture could not actually demonstrate
`UI_DOC_DUPLICATE_NODE_ID` (JSON object keys cannot repeat). Replaced by
`ui-document-invalid-dangling-child.json` exercising the new `UI_DOC_UNKNOWN_NODE` code
(added to the §7 catalog, class "invalid tree"); the duplicate-ID rule remains specified as a
parsed-model validation whose negative is exercised in U1 at model level.

Reproduction: review report section 3 (per-criterion evidence) and section 4 (falsification
log) in the preserved report; `git diff f7767b2..<repair SHA>` after this commit shows every
repair bounded to `docs/ui-foundation/**`.

Authority: HANDOFF WP-6 continues — affected re-verification of the repaired bytes by a fresh
independent reviewer, then freeze pins at the accepted contract SHA, freeze-record commit, and
a separate fresh checker reproducing the pins before push/report.

## U0 contract review round 2 — affected re-verification, and pre-freeze micro-repairs (2026-10-06)

Identity: same branch/base; audited repaired candidate `6a2f7b9ea3078da16ce42253ee9db0c902bdf3af`.

Claims and verdict: a second independent fresh-context verifier (non-author, non-round-1;
report preserved verbatim at [reviews/U0-REVIEW-02.md](reviews/U0-REVIEW-02.md), SHA-256
`1a5fc6488348d7a2d29618cef821d0c41706051358caa0996e6ce3e7aebb5512`) re-verified the repairs:
F-1..F-7 all REPAIRED and re-measured where falsifiable (including an independent Edge
154.0.4258.53 re-confirmation); the manager's fixture-semantics repair verified consistent
(§7 catalog 28 codes; minimal dangling-child negative). Regression clean: repair diff confined
to `docs/ui-foundation/**`; round-1 report bytes preserved (456e910a…c241 re-confirmed);
9/11 pack-inventoried files still byte-identical to the pack; prettier-clean fixtures; no
orphan diagnostic references; U0-01..U0-07 hold. Verdict: **HELD pre-freeze by design**;
explicit "ready to freeze: YES"; U0-08 remains the freeze half of WP-6.

New round-2 findings and disposition:

| Finding | Severity | Disposition |
| --- | --- | --- |
| N-1 §5 staged-package clause attached the Chrome-only staged 155.0.8059.26 package to the Edge cell | NOTE | repaired pre-freeze: clause now names Chrome as the staged package's owner and states Edge has none |
| N-2 `application-v3-invalid-mixed-presentation.json` was the only negative without a note | NOTE | repaired pre-freeze: note added (expected `UI_APP_PRESENTATION_MODE_INVALID`) |
| N-3 STATE's typecheck/format:check/check:ui claims not re-runnable without `npm ci` | NOTE | closed by the freeze checker, which reproduces all three checks after `npm ci` at the pinned SHA |

N-1/N-2 are disclosed post-review micro-repairs; their corrected bytes are part of the frozen
contract set and are covered by the freeze-byte verification (STAGES §2 U0-08).

## U0 freeze-byte verification (2026-10-06) — FREEZE VERIFIED

Identity: freeze record audited at `ffbafc0a509d7179eddfa81c157595fe336c9dba`; contract
candidate `54490a861fcd9992bfc8bfac14178fdb7921ecf0`; branch `codex/ui-foundation-u0`; base
`4d2df037d8a82d36c60bf1bff16919650643ce22` (still live origin/main at checker time).

Claims and verdict: a third independent fresh-context checker (non-author, non-round-1,
non-round-2; report preserved verbatim at
[reviews/U0-FREEZE-CHECK-01.md](reviews/U0-FREEZE-CHECK-01.md), SHA-256
`43fcaa62ad64f483cf633290caa0d03cc4ddb9c250a5cf3ead9209337e3a62dc`) reproduced all 19
FREEZE.json pins (git blob + working-tree bytes, two independent computation passes), verified
ancestry order, live baseline, both report hashes, faithful verdict summaries, allowed-path
diff (AGENTS.md +14/−0 pure insertion), reproduced the baseline checks in a fresh install
(`npm ci` 524 packages; typecheck/format:check/check:ui all clean — closing round-2 N-3), and
confirmed truthful pre-verdict STATE wording. Verdict: **FREEZE VERIFIED**; U0-08 DEMONSTRATED.

Findings retained (all NOTE, non-blocking): FV-1 pre-verdict present-tense phrasing (mitigated
by explicit checker-pending ledger; clarified post-freeze in STATE — mutable bytes only, frozen
pins untouched); FV-2 former “Missing proof” paragraph scoped to the pack-authoring environment
(underclaimed; rewritten in STATE post-freeze); FV-3 npm allowScripts warning for esbuild
postinstall scripts (environment-side notice, exit 0, no repository effect; retained).

Post-freeze commits touch ONLY evidence bytes — STATE.md, this ledger's appended
verification sections, and preserved reports under reviews/. FREEZE.json pins anchor to the
contract candidate's blobs (`git cat-file blob <contract_candidate_sha>:<path>`), so appended
evidence does not alter any recorded pin; reproduction always resolves against the candidate
SHA, never HEAD. U0-08 is demonstrated at the freeze-record SHA; later evidence commits are
append-only lineage.

## U0 amendment round (2026-10-06) — owner-authorized bounded reopening, findings A-01..A-03

Authorization: the owner's follow-up review independently confirmed all prior lineage (remote
refs, all 19 original pins at `54490a8…`, all three report hashes, baseline `4d2df03…` unmoved)
and authorized a bounded documentation/contract amendment to close three findings before U1.
Scope: docs/ui-foundation contract documents and design fixtures + the freeze record. No U1
implementation, no Stage 9/apps-studio work, no merge to main, no force-push, no publication.

Finding-to-fix mapping (amended candidate `33ae56fef98b0f7c467a42f10cd873d08b1f8209`):

- **A-01 cycle-detection ambiguity** (API-SPEC §2.2, CONTRACTS): the former rule-3 wording
  ("a document referencing a screen/application that references it") could read legitimate
  navigation as a cycle. Cycle detection is now defined on the structural expansion graph
  (nodes: documents and component definitions; edges only from cross-document component
  expansion and definition-level expansion). Navigation edges (route→screen ownership,
  `navigate`), product-reference edges (`invokeAction`, view/record/resource/capability) and
  expression references resolve but never become expansion edges. New fixtures:
  `application-v3-valid-navigation.json` (mutual owning-route navigation loop — valid) and
  `ui-document-invalid-expansion-cycle.json` (mutually expanding definitions → `UI_DOC_CYCLE`).
  Contract ambiguity, not an observed runtime failure.
- **A-02 incomplete rejection→correction→resubmission journey** (PROOF-DESIGN,
  PRODUCT-ARCHITECTURE §fictional domain, API-SPEC fixture table): submit only accepted draft
  and no action returned rejected to draft. New `inspection.revise` action (permission
  `qlt.inspection.revise`, assigned technician, `rejected → draft`); record-level decision
  fields (`decidedAt`, `rejectionReason`) are cleared on the record while the activity trail
  preserves the quoted reason; `submit` validates `status === 'draft'`, `revise` validates
  `status === 'rejected'` + assignment; permitted edits resume in draft. Journey fixture
  `ui-scenario-valid-revision-loop.json` (reject → revise → edit → resubmit) added; it is a
  journey fixture, not a ninth product scenario. This affects the later complete journey only;
  it is not evidence about U1's approval path, which has not been implemented.
- **A-03 incomplete catalog identity ordering** (API-SPEC §2.3, CONTRACTS, STAGES U1-01):
  the hashed list was "sorted by documentId" only. Now: after rule-2 validation, deduplicate
  by `(documentId, revision)`, then total order by code-point string comparison on
  `(documentId, revision)` (plain string order for revisions — not semantic version order).
  Example D added (same-ID/different-revision + duplicate identical entries + permutation).
  U1-01 now requires: catalog input permutation and duplicate identical entries leave
  `applicationVersion` unchanged. Non-blocking on its own; closed for determinism.

Supersession: the original freeze (`ffbafc0…` over `54490a8…`) and its "U0 COMPLETE / FREEZE
VERIFIED / U0-08 demonstrated" readiness claims are superseded for the amended bytes; the
historical verdicts, pins and reports remain valid for their audited SHAs and are preserved
unchanged. A new freeze record will pin the amended candidate only after a fresh independent
review (and any repairs) complete. The original 19 pins were re-verified intact at reopening
before any edit.

Process note (disclosed): during this round a mistaken `rm -rf` targeted the real
`docs/ui-foundation` directory and deleted uncommitted working-tree edits; nothing committed
was affected, all bytes were restored from HEAD `a664c70…` via git, and the amended candidate
was then re-derived and committed immediately. No evidence bytes were fabricated or lost.

## U0 amendment review round 1 (2026-10-06) — AMENDMENT HELD; repairs F-A-01..F-A-05 applied

Identity: fresh independent verifier audited candidate `33ae56f…` + ledger `df3d283…` (report
preserved verbatim at [reviews/U0-AMENDMENT-REVIEW-01.md](reviews/U0-AMENDMENT-REVIEW-01.md),
SHA-256 `382ff47c2518f4cbc9ca29352e310f3ea973deba7518ab3d1178032e97ba1199`). Verified: baseline
live, amendment diff confined to docs/ui-foundation, superseded freeze intact (all 19 original
pins reproduce; FREEZE.json untouched), all three prior report hashes match at HEAD, regression
U0-01..U0-07 PASS, catalog 28 codes/no orphans, fixture table 13↔13, checks clean, ledger
truthful.

Verdict: **AMENDMENT HELD (repairs needed)** — A-01 and A-02 CLOSED WITH NOTES, A-03 NOT CLOSED
pending F-A-01. Findings and dispositions:

| Finding | Severity | Disposition |
| --- | --- | --- |
| F-A-01 Example contradicts itself: claimed code-point order gives `"10" < "2" < "3"`, text said `"2" < "3" < "10"` | MAJOR | repaired: comment now states the correct code-point example; Example D's `D@2` before `D@3` remains correct (`"2" < "3"`) |
| F-A-02 journey fixture under-demonstrated: no edit between revise and resubmit; reason asserted, never quoted | MINOR | repaired: `finding.add` step inserted; revise activity entry quotes the actual reason |
| F-A-03 expansion-cycle negative lacked the `NEGATIVE: …` note convention | MINOR | repaired: note added (expected `UI_DOC_CYCLE`, path `def.a → def.b → def.a`, single-defect statement) |
| F-A-04 document-node cycle-impossibility implicit | NOTE | repaired: one sentence states every expansion edge points at a definition, so cycles occur only among definitions |
| F-A-05 code-point vs UTF-16 code-unit ambiguity (astral only) | NOTE | repaired: ordering specified as Unicode code points (UTF-8 byte order equivalent, deliberately not UTF-16 code units) |
| F-A-06 pack-fidelity framing was 9/11 at `54490a8…` but 6/11 post-amendment (extra divergences = exactly the authorized amendment targets) | NOTE | accepted; the new freeze record enumerates pack fidelity explicitly |
| F-A-07 `decidedAt` never fixture-modeled (consistent with the pre-existing approve fixture) | NOTE | retained; no change |

Repaired candidate replaces `33ae56f…`; a scoped fresh re-verification of the repairs precedes
the new freeze record (per the reviewer's own prescription).

## Future evidence entry format

Identity: repository, branch, full base/candidate/reviewer SHAs, environment and contract pins.
Claims: criterion ID with PASS/FAIL/NOT DEMONSTRATED and direct evidence.
Reproduction: commands, inputs, fixture versions, screenshots/browser sizes or API behavior.
Findings: severity, effect, owner, fix/carry decision, next check.
Verdict: independent conclusion and exact audited snapshot.
Repair: prior failure, fix commit, affected checks and new verifier snapshot.
Authority: next accepted action; never derive it from an agent's own proposal.
