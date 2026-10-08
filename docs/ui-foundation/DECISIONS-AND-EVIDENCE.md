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

## U0 amendment freeze verification (2026-10-06) — FREEZE VERIFIED

Identity: freeze record audited at `ea47edd68e302dc5b6cacb2e43635d11781619ad`; amended contract candidate `9ec87f3e7eb8eb7793f972111258940aac635346`; base
`4d2df037d8a82d36c60bf1bff16919650643ce22` still live origin/main. A fourth independent fresh
checker (non-author, non-amendment-reviewer, non-recheck-verifier; report preserved verbatim
at [reviews/U0-AMENDMENT-FREEZE-CHECK-01.md](reviews/U0-AMENDMENT-FREEZE-CHECK-01.md),
SHA-256 `9b80f3d4d29d819f4d0fe06798422c9a0339b10e8c8703cf6c1f8828c78a4ed0`) reproduced all 22 pins by two independent methods, verified the
superseded original record untouched in history with its 19 original pins reproducing against
the original candidate, verified full ancestry, all five report hashes byte-exact with
single-commit histories, scope confinement (root AGENTS.md pure insertion), pack fidelity
6/11 identical + 5/11 diverged with accurate authorization mapping, truthful pre-verdict
wording, the F-A-01 corrected ordering example programmatically code-point-correct, and the
revision-loop fixture operations. Baseline checks reproduced after fresh `npm ci`: typecheck
clean, format:check clean, check:ui 0 errors / 0 warnings. Verdict: **FREEZE VERIFIED**;
U0-08 for the amendment PASS (demonstrated at the freeze-record SHA).

Findings: F-1 MINOR — the recheck verdict "REPAIRS VERIFIED — READY TO FREEZE" lacked its own
ledger entry (this entry closes that gap; verdict bytes and hash were preserved and verified).
F-2 INFO — checker-side CRLF artifact in its first shell pass, clean 22/22 re-run, no
candidate effect (retained as a process note).

This entry and the checker-report preservation are post-freeze evidence commits touching only
mutable bytes (this ledger, STATE.md, reviews/); recorded pins anchor to the candidate's git
blobs and are unaffected.

## U1 implementation record (2026-10-06) — candidate `351d3e5…`, review pending

Grant, baselines, criteria, protocol: [U1-HANDOFF](U1-HANDOFF.md). Implementation history:
`182caa9…` (ui core) → `b9e6573…` (sdk @3) → `4e69175…` (application @3 + identity tests) →
`9284888…` (ui-svelte renderer) → `7f49cd0…` (editor + preview) → `505e0b1…` (proof host) →
`4f8c1ab…` (browser-walkthrough repairs) → `351d3e5…` (candidate; build-output hygiene + root
tsconfig paths).

Disclosed implementation decisions (no frozen bytes changed; PROOF-DESIGN/API-SPEC remain
pinned at `9ec87f3…` / `ea47edd…`):

1. Joined child collections: the inspection resource additionally declares `findings`,
   `evidence`, `activity` json fields (adapter-materialized) so the detail document can bind
   them under `view.<field>`. PROOF-DESIGN §1.1's scalar domain fields are unchanged; the join
   is a view-projection mechanism, and the adapter implements every §1.2 transition rule
   (statuses, mandatory rejection reason, revise clears record-level decision fields with the
   reason preserved in the activity trail, `expectedDomainRevision` optimistic concurrency).
2. `@victframework/ui-editor` and `@victframework/ui-preview` manifests are `private: true`:
   publication is out of U-track scope and the frozen 14-package release-set identity is
   unchanged (`check-release-set` passes). Extending the release set would require separate
   owner authorization.
3. Layered validation authority: document-level validation and edit sessions defer
   product-reference diagnostics (view/record/repeat-item typing, extension closure,
   action/route ids) to the JOINT compiler (API-SPEC §2.2 rule 4). Structural validity is
   enforced at both layers.
4. Preview actor gating gates CAPABILITY ops by permission-root matching; simulated data-op
   denial coverage is a DECLARED outcome — real permission enforcement lives at the real
   adapter boundary (verified in U1-05 tests).
5. Stored-revision convention: numeric stored revisions increment (`1` → `2`); non-numeric
   revisions take a `.rN` suffix. The session working revision is `<storedRevision>#<seq>`
   and advances monotonically per accepted transaction, undo and redo.
6. The canvas text-selection affordance produces the two svelte-check a11y WARNINGS
   (click-without-keyboard on a span). It is an editor-only occurrence mapping, not an
   interactive control; canvas keyboard navigation is U2-06 workbench scope. check:ui is
   otherwise 0 errors.
7. Pre-existing test failures: six root-suite failures (bootstrap-artifact, kernel
   child-process identity, scaffolder real build, store-sqlite/server SIGKILL cross-process)
   were verified FAILING IDENTICALLY at base `9734690…` in the untouched u0 worktree —
   Windows environment specifics, not U1 regressions.

Evidence index: measurement harness `examples/ui-authoring-proof/test/measure-u1.ts`
(compile p95 24.3 ms, edit feedback p95 16.8 ms, reset p95 0.2 ms — budgets 250/100/1000);
browser screenshots `examples/ui-authoring-proof/walkthrough/` (1440×900, 1024×768,
390×844); console sweep across all routes: zero errors; launch instructions
`examples/ui-authoring-proof/README.md`. Retained limits: extensions render declared labeled
placeholders; portal rendering and component variants pending beyond U1; the
rejection→correction→resubmission journey UI is U3 scope (the adapter already implements
`revise`; the frozen journey fixture remains contract evidence).

Independent falsification review of the candidate: **DONE — see the two rounds below.**

## U2 round-3 repair: N1 reclassified and fixed; N2 closed (2026-10-06)

The owner reclassified N1 from a discretionary finding to a **U2-01 failure** (frozen
STAGES: intentional instance overrides must persist; CONTRACTS/API-SPEC cascade: shared
component presentation before instance-local styles, normalized generated-selector
specificity) and directed a bounded repair with independent re-verification.

Root cause (plan-level reproduced): the compiler assigned definition-body localStyle and
instance localStyle to the SAME 'local' layer; repeated shared-body rules appearing later
in the stylesheet overrode earlier instance rules — the owner's exact reproduction
(instance pink, then shared blue: all five cards turned blue).

Repair at candidate `83ba87f7aa112a1d93e7236c9c3ec2f4505f6cff`: one reusable
layer-assignment change in the compiler — a localStyle inside a definition body compiles
as **componentBase**; an instance localStyle remains the innermost **local** layer.
Canonical source and intentional overrides preserved. Pinned by
`packages/ui/test/cascade-n1.test.ts` (shared-blue + instance-pink in BOTH authoring
orders; plan declares local after componentBase).

Independent verification (fresh verifier, out-of-repo attacks):
**"U2-N1-VERIFY: PASS WITH FINDINGS"** at `83ba87f…` —
[U2-N1-VERIFY-03.md](reviews/u2/U2-N1-VERIFY-03.md), sha256
`3738d99352597a3ab96d7621c8e7baf9b18aa0033187f319e47357c4f9393bf1`. All seven directed
demonstrations PASS: D1 instance-pink -> shared-blue (Adaptations stayed pink; four others
blue; canvas AND /service); D2 reverse order converges identically; D3 seed attached
override survives shared edits; D4 undo/redo/save/reload/reopen preserve the distinction;
D5 override removal works at model level (F1 minor: no UI removal affordance — routed to
the Codex Inspector/Layers UX track); D6 PRESERVED banner through edit + refused save with
byte-identical bytes; D7 replacement of an overwritable invalid document clears its
warning. Plan-level cascade: 20-check attack script + served dist confirmed to contain the
fix. Gates reproduced: unit 2499/2499, renderer 116/116, integration 4/4.

N2 CLOSED with evidence: the committed worktree keeps the PRESERVED banner visible through
editing AND a refused save (bytes byte-identical, failure logged); the source clears the
banner only on an acknowledged successful save. The prior reviewer's observation was an
artifact of the mid-review drifting worktree (flagged by that reviewer); reproduction
steps are recorded in the N1-verify report.

Parallel track opened the same day: the owner assigned a Codex agent to the reusable
Inspector/Layers UX on `codex/ui-foundation-u2-inspector-ux` (created from `83ba87f…`,
worktree `vict-02-u2-inspector-ux`, pushed). Reserved for Codex: Inspector.svelte,
Layers.svelte, their UI helpers/styles, UX-specific tests, additive exports (demonstrated
via a separate editor-review route). The stage-manager track keeps compiler/renderer/
session/bridge/storage and owns the workbench route + shared records. Routed to Codex:
the D5/F1 removal affordance and the F2 effective-value observation. Integration of the
reviewed UX commits into `codex/ui-foundation-u2` (lineage preserved, combined candidate
independently verified) is authorized within U2.

## U2 implementation and independent verification (2026-10-06) — founder checkpoint pending

Implementation complete across four increments (foundations `cfb4bb4`, tooling `2e03e13`,
proofs `821e720`, measurement/hygiene `904fb4d`, plus docs `fc071a7`, walkthrough `36ec8eb`
and records `ffa1bb6`). Verified code candidate: `19bb4b98a18f86bb1193db5a45f8c33e1c5c9af5`
(repaired round-2; the round-1 candidate `ebac7bf766ecc1bee1e510499ce4607fb211675e` FAILED
both independent reviews — those verdicts are preserved as evidence of that exact snapshot).

Finding-to-fix map (independent round 1 -> repairs -> independent recheck):

| Independent finding | Fix | Evidence |
| --- | --- | --- |
| T-F1 (blocker): pseudo-state CSS silently inert (un-interpolated selector template; renderer never composed the pseudo suffix; escapeCss escaped the colon) | plan rule carries base selector + `pseudo` field; renderer composes `.class:pseudo` after escaping; pinned by `pseudo-css-u2.test.ts` (4 states) | Recheck R1 PASS: 8/8 fresh attacks incl. definition-body pseudo, media+pseudo, container+pseudo; candidate test verified honest |
| T-F2 (minor): env-condition diagnostic with literal `${...}` placeholders | interpolations repaired in the same pass | Recheck R1 PASS (interpolation attack) |
| T-F3 (major): root integration project collected the design proof's svelte suite and failed to collect it | design proof excluded from the root integration project (runs its own vitest) | Recheck R2 PASS: 4/4 green, exclusion audited, design suite 12/12 + typecheck 0 separately |
| EX-F1 (blocker): /service rendered the static seed import; saved workbench edits never reached the finished page | /service and workbench open the SAME persisted store per key (`loadPresentable`/`openDesignStore`); /service renders stored source after mount with truthful fallback banners | Recheck R3 PASS: save -> /service renders it; unsaved edits do NOT leak; empty storage -> clean seed; SSR clean |
| EX-F2 (major): instance-frame styling silently edited the shared node; empty style value was a silent no-op | Inspector 'Edits apply to' (shared vs this instance); style applies honor the scope; empty value disables Apply; per-mount requestId epoch; readable activity summaries | Recheck R4 PASS: instance scope changes only the target node; shared scope updates all five; empty-value guard verified incl. keyboard |
| EX-F3 (major): schema-corrupted readable envelope hard-failed the workbench ('does not compile', Save disabled) | shared store takes the host validation gate (invalid+overwritable at the recorded revision); workbench seeds with the truthful 'not usable / replaced' banner; banner clears on successful save | Recheck R5 PASS: banner -> edit+save -> revision carried with valid schema; PRESERVED path unchanged (refusal + bytes intact) |

U2 criterion verdicts (STAGES section 4):
- **U2-01 Components: PASS** (adversarial: definition edits propagate; overrides persist; slot/prop diagnostics fire).
- **U2-02 Occurrence provenance: PASS** (nested components, repeats, portals; duplicate keys rejected + reported).
- **U2-03 General presentation: PASS after repair** (grid/overlap/sticky/overflow through the model; media/container/pseudo; environment/variant dropped with explicit diagnostics; frozen cascade verified).
- **U2-04 Inspector clarity: PASS after repair** (authored origin vs effective value; condition targets; instance-vs-shared scoping; empty-value guard).
- **U2-05 Contrasting page: PASS** (technical at round 1; experience journeys PASS at recheck).
- **U2-06 Studio-style composition: PASS** (technical at round 1; experience journeys PASS at recheck).
- **U2-07 Reusable tooling: PASS** (canvas/layers/inspector/history/bridge/localStorage store exported; host composes only).
- **U2-08 Performance/coverage: PASS** (independently reproduced: p95 compile 27.3 ms / edit 18.2 ms / reopen 6.2 ms vs budgets 250/100/1000; bundle separation verified; coverage matrix `U2-COVERAGE.md`).

Reports (preserved with evidence): [U2-TECHNICAL-REVIEW-01](reviews/u2/U2-TECHNICAL-REVIEW-01.md)
(sha256 `425bc7208bd8f3f18971eb3b3b261885e51460fd57a92857d4c43856db85fab7`),
[U2-EXPERIENCE-REVIEW-01](reviews/u2/U2-EXPERIENCE-REVIEW-01.md) (sha256
`d17c5372a2b2cc93d64fab039e225f54b176394eccb6426dcf356cb2d1ae6d40`),
[U2-RECHECK-01](reviews/u2/U2-RECHECK-01.md) (sha256
`47d7c7a826b725c33a0ad4b4f184118e06a51bdaf0a4cfa4e0e7d09c111e2c67`),
[U2-EXPERIENCE-RECHECK-02](reviews/u2/U2-EXPERIENCE-RECHECK-02.md) (sha256
`2101bf55bc66d40ac03d7695a515ac67e03396fc5627d55688e07c2d176da622`), evidence in
`reviews/u2/` (recheck + experience-recheck screenshots, technical attack suite).

Remaining non-blocking findings (registered, owners assigned):
- **N1 (minor, owner decision):** shared-scope local style edit silently overrides a prior
  instance-scope override of the same property (equal specificity, later rule order).
  Owner: U-track builder; next check: origin-conflict note in the Inspector or
  occurrence-scoped local rules.
- **N2 (minor):** the PRESERVED banner clears once the user edits, before the loud
  save-failure. Owner: U-track builder; next check: compact storage-state indicator.
- Notes: design-surface wording ('stored authoring data'); sticky card travel (~150px);
  `Reload stored` on empty store truthfully refuses (UI_STORE_EMPTY).

Carried obligations closed: authoring store.ts:144 unbound type reference (fixed);
meaningful proof typechecking (design proof tsc 0 + authoring tsc 0); build wiring
repaired and supported commands reported truthfully (`npm run build -w <pkg>` for
dist-exported packages; proof apps run their own vite/svelte-kit builds); U1 guarded
save/persistence/history/fencing/snapshot behavior preserved (U1 suites unmodified and
green); safe session-API orchestration documented in
[SESSION-ORCHESTRATION](SESSION-ORCHESTRATION.md).

**Founder checkpoint next:** walk [U2-WALKTHROUGH](U2-WALKTHROUGH.md). Independent
verification is complete; **owner experience acceptance is PENDING** and is not inferred
from these verdicts. U3/U4, apps/studio, merge-to-main, force-push, publication and
deployment remain unauthorized.

## U1 owner acceptance and U2 authorization (2026-10-06)

The owner ACCEPTED U1 at the verified round-4 candidate `345b5c62f7eae1d02d7697cdd1abc71b0daeee41`
(records `cb8539372c1f8a9d055de3a7f29dff222262b486` = starting remote HEAD, live-verified),
with the disclosed non-blocking notes (NF-1..3) RETAINED into U2 scope. The owner authorized
**U2 ONLY** — designer and workbench breadth (STAGES §4, U2-01…U2-08): shared components,
occurrence provenance, general presentation, inspector clarity, the two contrasting proofs
in `examples/ui-design-proof` (PROOF-DESIGN §3.2–3.3), reusable exported tooling, and measured
performance/coverage. Carried obligations absorbed: the unbound `compileUiDocument` type
reference at authoring store.ts:144, meaningful proof typechecking, U2 build wiring, truthful
build-command reporting, preservation of U1 save/persistence/history/fencing/snapshot
behavior, and documentation of safe host orchestration over the session API. U3/U4, the full
inspection revision journey, durable backend replacement, apps/studio, merge-to-main,
force-push, publication and deployment remain unauthorized. Verification: independent
technical challenge AND an independent experience review through real browser use at
1440×900 / 1024×768 / 390×844 / 480 CSS-px container, against PROOF-DESIGN §4 — owner
experience acceptance stays pending until the founder checkpoint. New branch/worktree:
`codex/ui-foundation-u2` at `C:/Users/RZ1/Desktop/RZ/vict-02-u2` (branch did not exist
before; verified). Handoff: [U2-HANDOFF](U2-HANDOFF.md).

## U1 reopen round 4 (2026-10-06) — repairs verified; "U1-ROUND4 GATE: PASS"

The owner directed a fourth bounded round from remote tip `03810cef…` (round-3 final,
whose verdict remains preserved): (1) enforce the SAME preservation policy in load and
save — every `overwritable:false` payload refused without changing its bytes, with the two
exact single-session cases reproduced and regression coverage at seed and non-seed
revisions, while retaining successful replacement of explicitly overwritable documents;
(2) refuse nested saves BEFORE staging — the exact sequence (outer stages → storage
callback calls nested save → nested write fails without side effects → outer write
succeeds → outer commit previously refused the superseded stage) must keep the
acknowledged storage revision and editor baseline consistent, with the save window owned
by the outer operation; (3) clear the corruption diagnostic only after acknowledged
success, keeping it visible on failed saves. Also: STATE's stale "branch not yet pushed"
wording corrected against live remote evidence.

Builder repairs at candidate `345b5c62f7eae1d02d7697cdd1abc71b0daeee41` (round-3 final
`03810cef…` is its parent after the records-hygiene commit), verified by a fresh
independent verifier (out-of-repo harness `u1-round4-falsify/`; worktree restored clean;
owner demo server untouched). Exact verdict: **"U1-ROUND4 GATE: PASS"** — report
[U1-ROUND4-REVIEW-05.md](reviews/U1-ROUND4-REVIEW-05.md), sha256
`139c538422902a76f7b06c5b7a05c99c148f577b67cf684f9a756585c0f97dc4`, evidence in
`reviews/round4/`. Finding-to-fix map (all independently attacked and held):

| Directed finding (owner) | Fix | Location | Evidence |
|---|---|---|---|
| Preservation policy not enforced in save (round-3 F1 + owner cases) | `classifyStored()` extracted as the SINGLE envelope authority for rawLoad() AND save(); unreadable classes (invalid JSON, wrong format, missing document/storedRevision) refused with `UI_STORE_CORRUPT`, bytes unchanged, at ANY revision; preservation dominates staleness; overwritable replacement retained (seeded at recorded revision) | `examples/ui-authoring-proof/src/lib/authoring/store.ts` | 9/9 attacks incl. owner's `future.format` and missing-document cases at '1' and non-seed '12'; 9 adversarial preserved shapes; browser journey r4-j1 (refused, byte-identical storage, banner kept) |
| Nested saves could supersede the outer stage / strand the baseline (round-3 owner scenario deepened) | `stageSave` refuses nested staging while a stage is in flight (`UI_EDIT_SAVE_IN_PROGRESS`); commitSave success releases the window; `releaseSaveWindow()` orchestrator-only (bridge finally); `session.save()` try/finally + TRUTHFUL refusal return (was silent ok); thrown/refused writes release the window with state preserved | `packages/ui/src/session.ts`, `packages/ui-editor/src/bridge.ts` | 8/8 attacks incl. the owner's exact sequence (nested save/stage/foreign-commit/edit refused pre-staging; outer commit succeeds; store == baseline == '2'; retry + editing normal); forged stages cannot commit |
| Corruption banner outlived successful replacement (round-3 F2) | `storeDiagnostic = null` ONLY in the acknowledged-success branch of the save handler; failed saves keep it visible | studio `+page.svelte` | Browser journeys r4-j2 (replacement accepted, banner cleared), r4-j1 (refused save keeps banner), r4-j3 (reload clean) |
| STATE said "branch not yet pushed" against pushed remote | Current entries corrected: branch pushed, live tip verified via ls-remote | `docs/ui-foundation/STATE.md` | Verifier claim D held |

Gates at the candidate: unit 2490/2490, renderer 108/108, integration 4/4, example 33/33,
typecheck 0, format clean, check:ui 0 errors (2 known warnings). All twelve previous
probes re-verified (suite-level; affected flows browser-journeyed). One pre-existing
round-3 test updated to the round-4 contract (host whose write failed releases the window
before saving again) — disclosed. Verifier non-blocking notes NF-1..3 recorded in the
report (NF-1: pre-existing unbound `compileUiDocument` type ref at store.ts:144, present
at `03810ce…`, not a round-4 regression, invisible to gates because the example is
excluded from root typecheck). Not covered (disclosed): literal browser-process restart;
individual browser journeys for unaffected probes; real-browser re-entrancy (unit-level).
Round-3 findings F1/F2 are RESOLVED by this round. Earlier verdicts/reports remain
preserved historical evidence of their exact snapshots.

## U1 reopen round 3 (2026-10-06) — repairs verified; "U1-ROUND3 GATE: PASS"

Builder repairs at candidate `c1e3d0fec930a2a11341181061d537f16ec065ab` (parent: reopening
record `ba29828`), verified by a fresh independent verifier (out-of-repo harness
`u1-round3-falsify/`; worktree restored clean; one infrastructure interruption — a transient
network timeout — resolved by resuming the same verifier session with re-orientation).
Exact verdict: **"U1-ROUND3 GATE: PASS" (with non-blocking findings F1, F2)** — report
[U1-ROUND3-REVIEW-04.md](reviews/U1-ROUND3-REVIEW-04.md), sha256
`fd151713aa4345eb0653c648eace64eeb4a774cc8a796d0f74c760bd082cd12b`, 11 evidence screenshots
(`reviews/round3/`). Finding-to-fix map (all independently attacked and held):

| Directed finding | Fix | Location | Evidence |
|---|---|---|---|
| Undo/redo broke across successful saves (round-2 FINDING-1) | History continuity + isDirty compare HISTORY identity (canonical bytes with the document-level revision stamp normalized); canonical application identity (contentDigest) untouched | `packages/ui/src/session.ts` (`historyIdentity`, undo/redo guards, isDirty) | 5/5 package attacks + browser journey 13 (edit→save→undo→redo; divergence still refuses); `edit-session.test.ts` history matrix |
| Staged commits could discard accepted edits (round-2 FINDING-2) | `commitSave` guards: stage OWNERSHIP (only the session's most recent stage object), stored-revision moves, working-session moves (intervening edit PRESERVED, commit refused); `EditorBridge` refuses apply/undo/redo during the save window (`UI_EDIT_SAVE_IN_PROGRESS`, try/finally reset) and reports post-persistence refusal truthfully | `packages/ui/src/session.ts`, `packages/ui-editor/src/bridge.ts` | 9/9 attacks incl. direct stage→edit→commit, synchronous store-callback reentrancy, cross-session stage, nested-save refusal; live two-tab stale-editor fencing; `bridge-save.test.ts` |
| Malformed stored documents could throw or fake a reopen; banner replacement claim untruthful for unreadable payloads | Envelope-shape hardening before deep access (unsupported schema, missing registry, empty document, null/malformed nodes, root); validation wrapped (never throws past the gate); `overwritable` classification; unreadable payloads PRESERVED (save refuses, `UI_STORE_CORRUPT`); readable envelopes baseline the seeded editor at the RECORDED revision so replacement saves are actually accepted; banner truthful per class | `examples/ui-authoring-proof/src/lib/authoring/store.ts`, studio `+page.svelte`, `packages/ui-editor/src/bridge.ts` (passthrough) | 9/10 attacks + browser journeys 14 (PRESERVED banner + save refusal + bytes intact; overwritable banner + replacement save accepted at the recorded revision); `authoring-persistence.test.ts` |

Retained proven behaviors: the TWELVE previous probes re-verified (suite-level; probes 6–12
not re-driven as individual browser journeys — disclosed limitation). Gates at the
candidate: unit 2483/2483, renderer 108/108, integration 4/4, example 28/28, typecheck 0,
format clean, check:ui 0 errors (2 known warnings), console sweep zero.

New findings (minor, non-blocking):
- **F1**: wrong-format envelope with readable `storedRevision` classified `overwritable:
  false` but `save()` at the matching revision accepts (multi-tab overwrite of "preserved"
  bytes possible; not reachable via the single-studio flow). Owner: U-track builder; next
  check: classification by envelope-readability + revision-consistency together.
- **F2**: startup corruption banner outlives the successful replacement save. Owner:
  U-track builder; next check: clear `storeDiagnostic` on successful save.

Not covered (disclosed): literal browser-process restart (mechanism guarantee:
localStorage is persistent per-origin storage; reload + route reopen demonstrated);
individual browser journeys for probes 6–12 (suite-verified). Round-2 FINDING-1/FINDING-2
are RESOLVED by this round. Earlier verdicts/reports remain preserved historical evidence
of their exact snapshots.

## U1 reopen round 2 (2026-10-06) — repairs verified; "U1-REOPEN GATE: PASS"

Builder repairs at candidate `3bd03a5d649c52ac529089f176f7e22b701ee09c` (parent: reopening
record `0a398d5`), then a fresh independent verifier (did not implement; out-of-repo attack
harness in `u1-reopen-falsify/`; candidate worktree untouched on exit) returned the exact
verdict **"U1-REOPEN GATE: PASS"** — report
[U1-REOPEN-REVIEW-03.md](reviews/U1-REOPEN-REVIEW-03.md), sha256
`44e1647d7321ce8b9c12cc6969bdb6aec8a8a7121897d2254f698940dea2862a`, 3 evidence screenshots.
Finding-to-fix map (all independently attacked and held):

| Reproduced finding | Fix | Location | Evidence |
|---|---|---|---|
| Studio authoring persistence was component-local memory | localStorage-backed authoring store; startup loads SAVED source (seed only when empty); corrupt/incompatible → visible `role=alert` diagnostic (structural validation + reachability gate; product refs deferred per layered authority) | `examples/ui-authoring-proof/src/lib/authoring/store.ts`, `src/routes/studio/+page.svelte` | Real-browser journey: edit→save→genuine `location.reload()`→source+revision restored; leave/reopen retained; corruption banner observed; screenshots `walkthrough/studio-persisted-reload-*`, `walkthrough/studio-corrupt-diagnostic-*` |
| `EditorBridge.save` advanced the session before store ack; expected-revision compared session-with-itself | Two-phase save: `stageSave`/`commitSave` (guarded) in the session; bridge stages → store (revision AUTHORITY) checks `expectedStoredRevision` atomically with the write → commit only on store ack; failed/thrown writes preserve working doc, dirty, stored revision, undo/redo continuity; truthful `UI_STORE_WRITE_FAILED`/`UI_DOC_STALE_REVISION`; `reopen()` reports empty/invalid | `packages/ui/src/session.ts`, `packages/ui-editor/src/bridge.ts` | Verifier probes 3–6 (rejected write, thrown write, retry at correct next revision, stale second editor) all PASS at node boundary; regression tests `packages/ui-editor/test/bridge-save.test.ts`, `packages/ui/test/edit-session.test.ts` |
| Preview fencing missed the executing-double window | Post-await token recheck on success AND rejection paths; superseded → `SESSION_STALE` (never stale `ok:true`); pre-invocation latency fencing retained | `packages/ui-preview/src/session.ts` | Probes 7–9 PASS (both windows demonstrated); regression tests in `packages/ui-preview/test/session.test.ts`; studio UI note observed: `SESSION_STALE — The session was reset while this operation was in flight` |
| Double registry re-snapshotted at execution time | Registry captured ONCE at session creation; coverage + execution use the same snapshot; reset/new sessions capture fresh | `packages/ui-preview/src/session.ts` | Probes 10–12 PASS (registry swap mid-session keeps original implementation; reset captures new; missing double denies with real-handler spy untouched) |

Gates at the candidate: unit 2475/2475 (127 files), renderer 108/108, integration 4/4,
example 20/20, typecheck 0, format clean, check:ui 0 errors (2 known warnings), console
sweep zero messages on all three routes.

New findings from the reopen review (minor, non-blocking):
- **FINDING-1 (minor, PRE-EXISTING at base)**: after a successful save, `undo()` is refused
  with `UI_EDIT_UNDO_CONFLICT` (the save stamps the working document's `revision` field; the
  undo continuity digest mismatches). Undo before any save works. The probed claims cover
  continuity across FAILED writes — which hold. Consequence: studio Undo after Save fails
  until reopen. Owner: U-track; next check: any round touching session history semantics.
- **FINDING-2 (minor, introduced this round)**: `commitSave`'s guard misses working-session
  moves between stage and commit (silent intervening-edit loss). Unreachable through
  `EditorBridge.save()`/the studio (single synchronous turn); contradicts the docstring.
  Owner: U-track builder; next check: tighten the guard before any host hand-drives the
  two-phase API across turns.

Verdict basis and retention: tested snapshot `3bd03a5…` with live `origin/main` `4d2df037…`
unmoved; the two prior verifier reports ([U1-FALSIFICATION-REVIEW-01](reviews/U1-FALSIFICATION-REVIEW-01.md),
[U1-REPAIR-REVIEW-02](reviews/U1-REPAIR-REVIEW-02.md)) remain preserved historical evidence
of their rounds, with their readiness claims superseded by the reopening entry above.

The owner's follow-up review REPRODUCED failures against existing U1-04 and U1-06 requirements
on the verified candidate `5a816722…` / records `4d67c86…`: (1) studio authoring persistence
was component-local memory (fixture + revision "1" re-initialized on every mount; save only
mutated local variables; the "Reload stored" button and round-trip test shared the same memory
closure — no full-reload or restart persistence); (2) `EditorBridge.save` called `session.save`
BEFORE store acknowledgement — a failed/thrown store write left the session advanced
(revision 1→2, dirty:false) while storage stayed at 1, and a retry skipped revision 2; the
expected-revision guard compared the session with itself instead of the authoritative store;
(3) preview reset fencing checked the fencing token only BEFORE invoking a double — an async
double resolving after a reset returned stale `ok:true` from the old session; (4) the double
registry was re-snapshotted at execution time (`snapshotDoubles()` during run), so registry
changes mutated which implementation an EXISTING session invoked. The prior "U1 GATE: PASS"
verdict and readiness claim are explicitly SUPERSEDED; both earlier verifier reports remain
preserved historical evidence of their own rounds. This entry opens a bounded repair +
re-verification round: U1-04 persistence + save acknowledgment/revision integrity, U1-06
fencing + snapshot immutability, regression tests through exported boundaries, an actual
browser reload/reopen persistence journey, then a fresh independent verifier who did not
implement the repairs. U3-05 (durable domain operation/data adapter replacement) is unaffected;
authoring-document persistence is U1-04 scope. U2 remains unauthorized.

## U1 verification cycle (2026-10-06) — FAIL → repairs → PASS; candidate `5a816722…`

**Round 1 — falsification review ([U1-FALSIFICATION-REVIEW-01.md](reviews/U1-FALSIFICATION-REVIEW-01.md),
sha256 `e37f3aa26d16c7ccd2af6ad273b29cf1dc85f57ac022be9cfbd76841fab30605`).** Fresh checker,
out-of-repo adversarial harness. Verdict **U1 GATE FAIL** on candidate `351d3e5…`: U1-01/02/03
PASS; U1-04 PASS (MINOR latent save desync); **U1-05 FAIL — BLOCKER-1**: both hosts stubbed
`DocumentHost.dispatch` with `async () => ({ ok: true })` — the authored Approve button
silently no-oped while the page claimed it dispatched through the adapter boundary (false,
undisclosed); U1-06 PASS WITH NOTES but **MAJOR-1**: `permissions: []` actors bypassed the
preview gate; MINOR: rejecting async double returned `ok:true` unawaited; U1-07 MINOR: denial
feedback polite `role="status"`; U1-08 MINOR: no Run-approve duplicate guard; three root-suite
failures classified environmental (pass on focused re-run at HEAD and base — not U1
regressions).

**Repairs — candidate `5a81672283dbefbbffdbd809704fe563d114f1f7`.** Real dispatch in both
hosts (detail route `runDeclaredAction` → `createInspectionServer`; studio canvas →
`PreviewSession.run`) with unified pending/success/error feedback and duplicate guards;
unconditional permission gate; awaited doubles → structured `SIMULATED_FAILURE`; `role="alert"`
denials; true code-point identity ordering (astral regression test); example `DocumentHost`
import fixed to the named export (latent example bug); falsification report preserved in-repo.
Builder regression tests: authored-button approve/denial at component level; empty-permissions
denial; rejecting-double failure; astral ordering. Gates at `5a81672…`: unit 2463/2463,
renderer 108/108, integration 4/4, example 15/15, typecheck/format/check:ui clean, browser
journey re-verified with zero console errors (repaired screenshots under `walkthrough/`).

**Round 2 — scoped re-verification ([U1-REPAIR-REVIEW-02.md](reviews/U1-REPAIR-REVIEW-02.md),
sha256 `5c0f11f145a15e006959cabd3021c61ca7ca20b77fd81472cc0ef785160d2fcb`).** Fresh checker,
16/16 gate probes + live journeys. Verdict **U1-REPAIR GATE: PASS WITH NON-BLOCKING
FINDINGS**. Per-criterion: U1-01 PASS, U1-04 PASS, U1-05 PASS, U1-06 PASS, U1-07 PASS,
U1-08 PASS (compile p95 14.2 ms / edit 8.7 ms / reset 0.13 ms); U1-02/03 stand from round 1
(scope); zero regressions; origin/main unmoved.

**R2-1 correction of record (MAJOR, record integrity).** The `5a81672…` commit MESSAGE claims
an `EditorBridge.save()` rollback for pass-1 MINOR-3. That claim is FALSE: the builder's patch
silently no-op'd and was not verified before commit. The desync (failed store write → session
advances 1→2 and reports clean while the store holds 1; retry skips revision 2) persists,
probe-confirmed by the round-2 verifier. The claim is withdrawn; the behavior is a latent
finding under the in-memory example store; the actual fix is owned by the U3-05 durability
slice. Retained notes R2-2 (studio scenario-note lacks a live-region role) and R2-3 (benign
Svelte dev-mode studio warning) are recorded in the round-2 report. Retained from round 1:
in-memory store (U3-05), diagnostic code-name reconciliation vs PROOF-DESIGN sketches,
host-side timing method, extension placeholders (U2+).

## U2 Inspector/Layers integration and combined verification (2026-10-07)

The owner-authorized Inspector/Layers UX track (`codex/ui-foundation-u2-inspector-ux`,
tested `1bd745a…`, records `f31477d…`) was integrated into `codex/ui-foundation-u2` with
lineage preserved (merge `1a61389…` = `e0893fe… × f31477d…`). Integration, manager-owned
repairs (broad Svelte check 23 errors → 0/2 known; unitless-CSS and mid-typing field-identity
defects fixed and regression-pinned; checksum reconciliation A9E855… restored byte-exact)
at `2a1ab4c…`; fresh independent verification there **FAILED** (canvas selection outline
silently inert since U1-era `7f49cd0` — never previously tested; report preserved verbatim,
sha256 `4f432023…`). Bounded repairs (outline via `data-ui-selected` + static CSS,
regression-pinned; ≤860px workbench layout) at `471952b…`: fresh independent re-verification
**PASS WITH NON-BLOCKING FINDINGS** (repairs confirmed 14/14 and 10/10; journeys E1–E5/E7
identical; zero page exceptions; full battery reproduced; sha256 `6ac54af9…`). Full record:
[U2-UX-INTEGRATION-01](reviews/u2/U2-UX-INTEGRATION-01.md). Retained: F3 (ui-editor dist
build TS2307), F4 (Inspector scope persistence), NF-2 (favicon 404, pre-existing); NF-1
(format-check evidence scope) fixed records-only.

## U2 owner acceptance and stage closure (2026-10-07)

The owner APPROVED the integrated Inspector (relayed by the operator, 2026-10-07). Exact
recorded scope: the founder-facing [U2-WALKTHROUGH](U2-WALKTHROUGH.md) experience as
amended for the integrated Inspector/Layers (friendly labels, scope-driven Layers with
search/keyboard selection, visible canvas selection outline, Browser-now effective values,
per-control Reset, linked spacing, shared/instance scope with the Adaptations override,
first-screen Inspector at 390), against combined implementation `471952bb…` as documented
at records `1fe5383…`. NOT claimed as owner-reviewed: `/editor-review` standalone, any U3
experience, `apps/studio`, U4 packaging.

This satisfied the only pending U2 owner item (the founder checkpoint; U1 was already
accepted at `345b5c62…`; U3/U4 never reached owner checkpoints), so **U2 is CLOSED as PASS
WITH NON-BLOCKING FINDINGS** — acceptance and disposition record:
[U2-OWNER-ACCEPTANCE-01](reviews/u2/U2-OWNER-ACCEPTANCE-01.md). Retained findings carry
owners and next checks: F3 → **U4 packaging readiness** (must be resolved before any
built-artifact reuse claim); F4 → U3+ UX iteration; NF-2 → U3 host polish; R2-1 in-memory
store desync → **U3-05** durability slice; R2-2/R2-3 → U3 polish; carried NOT-DEMONSTRATED
(literal browser-process restart) → U3-05 restart evidence requirement. Closure authorizes
nothing by itself: [U3-HANDOFF](U3-HANDOFF.md) is PREPARED — IMPLEMENTATION NOT AUTHORIZED;
U4, `apps/studio`, Stage 9, merge-to-main, force-push, publication and deployment remain
unauthorized.

## U3 authorization and startup (2026-10-07)

The owner AUTHORIZED **U3 ONLY** — product realism and durable replacement (frozen
STAGES §5, U3-01…U3-08): the complete inspection journey with the rejection → correction
→ resubmission loop; the eight-scenario matrix with deterministic resets, coherent
seed/cache reset, capability snapshots, in-flight fencing and truthful per-operation
implementation modes; runtime permissions/validation/stale-and-replayed-decision checks at
the adapter boundary; one durable local replacement (scenario 1's `inspection.approve`)
through the existing `ApplicationDataAdapter`/capability-dispatch boundaries with unchanged
action identity, compatible contracts and UI source/binding digests, plus real process
restart evidence and shared adapter conformance; and a founder walkthrough. U4, `apps/studio`,
Stage 9, merge-to-main, force-push, publication, deployment and external production services
remain unauthorized. Scope corrections recorded at startup:

1. **Entry reference corrected:** the prepared handoff named `1fe5383…`; the actual U2
   final closure records are `a8379110e378357c3732fd051a3f327d897a018c` (remote-verified),
   which the U3 branch/worktree was created from. Verified `codex/ui-foundation-u3` did
   not exist (local or remote) before creation — no concurrent work reconciled.
2. **R2-1 carry-forward corrected:** the failed-save session desync was already repaired
   and independently verified in U1 round 4 (F2 guard; "U1-ROUND4 GATE: PASS"). The
   historical finding and the withdrawn round-2 commit-message claim remain preserved
   above; U3-05 owns only INSPECTION-domain durability (scenario 1 approve), not the
   authoring store (those are different persistence concerns).
3. **Product host clarified:** `examples/ui-authoring-proof` is the frozen inspection
   product host (queue/inspection-detail/studio already live there with the real in-memory
   `InspectionDataAdapter`); the U3 journey completes THAT host. `examples/ui-design-proof`
   remains the contrasting page/workbench proof — necessary maintenance only. The prepared
   handoff's U3-01 row erroneously named the design proof as the journey host; corrected.

New branch/worktree: `codex/ui-foundation-u3` at `C:/Users/RZ1/Desktop/RZ/vict-02-u3`
(from `a8379110…`). Handoff: [U3-HANDOFF](U3-HANDOFF.md).

## U3 implementation record (2026-10-07) — verification pending

Increments on `codex/ui-foundation-u3` (entry `a8379110…`): startup + handoff
corrections `b4023bc`; domain core + frozen diagnostics `aefb498`; server-hosted
journey `2c46115`; scenario matrix `db48707`; durable replacement `3b508b1`;
restart proof `5bb145f`; performance `986a609` (+ docs this commit).

Implementation decisions of record:

1. **One domain core, two backends.** The inspection rules (permissions,
   transitions, mandatory rejection reason, expectedDomainRevision, replay)
   live in a shared core (`applyInspectionMutation`/`applyChildAdd`); the
   simulated in-memory adapter and the durable SQLite adapter both execute the
   SAME core — no second domain engine.
2. **Frozen diagnostics aligned.** Stale decisions surface DOMAIN_CONFLICT
   (expected/actual in the message); replayed decisions (same idempotency
   key + same input) DATA_IDEMPOTENT_REPLAY; key reuse with different input
   DATA_IDEMPOTENCY_CONFLICT; keyed creates reconcile (shared suite rule).
   The U1-era DATA_CONTRACT_REJECTED stale code was replaced (test updated).
3. **Server-hosted boundary.** The product singleton moved server-side
   (+page.server.ts loads, /api/inspection/[action] POST boundary,
   generation-based in-flight fencing as SESSION_STALE) so queue/detail share
   one coherent domain and the durable file outlives the process.
4. **Preview adapter port.** packages/ui-preview gained PreviewDataAdapterPort
   (frozen API-SPEC §6.2: data operations dispatch through a conforming
   adapter); declared outcomes short-circuit BEFORE any adapter call; reset()
   carries the port. The studio's legacy seeded-rows behavior is unchanged
   when no port is declared.
5. **Evidence rule fidelity.** PROOF-DESIGN §1 constrains finding.add
   (draft/submitted + existing inspection) but evidence.add is "append
   evidence; write" with no constraint — implemented exactly so; the shared
   conformance suite therefore runs over the evidence resource for BOTH
   implementations.
6. **Storage location.** The durable file is pinned by U3_DURABLE_DB
   (default ./.local-data/inspections-u3.sqlite, gitignored); pragmas WAL +
   synchronous=FULL verified in the restart evidence.

Founder checkpoint: prepared at the verified candidate; U3-WALKTHROUGH.md is
the owner-facing sheet. U4, apps/studio, Stage 9, merge-to-main, force-push,
publication and deployment remain unauthorized.

## U3 independent verification record (2026-10-07) — founder checkpoint next

Fresh independent verifier (separate detached checkout, falsification-only,
no repairs) at the exact candidate `cbb3fb6584226c48633a2f3d21bccee674ce59c0`:
**"U3 GATE: PASS WITH NON-BLOCKING FINDINGS"** — all eight criteria PASS on
the verifier's own evidence. Report imported verbatim:
[U3-VERIFY-01](reviews/u3/U3-VERIFY-01.md) (sha256
`9412d96c7335f85618fd53344f039393c56817825f625f38109d6dec58db5a2e`,
bytes preserved via scoped .gitattributes) with the verifier's harness and 29
screenshots under reviews/u3/evidence/. Highlights: 109/109 independent node
probes; the two initial journey FAILs resolved as harness artifacts with the
re-verification documented (J10 approve leg: DOMAIN_CONFLICT at the stale
revision then approved at the fresh one — exactly the frozen semantics; S1:
the flagged text is the mandatory honest disclaimer, the only "production"
occurrence); real restart reproduced independently (force-kill, on-disk
read, fresh process + fresh browser, negative control); 9/9 adversarial API
attacks refused; battery and frozen budgets reproduced.

Retained findings with owners: **F-1 (MINOR)** document-level approve control
status-ungated (dead affordance on decided inspections; every click honestly
refused; no bypass) — owner U3+ UX iteration, next check the next stage
touching the inspection document; retained unrepaired to keep the verified
candidate byte-stable (a post-gate behavior change would demand affected
re-verification for zero boundary risk). **N-2 (environment)**: the root
unit suite needs built package dists — next check U4 packaging readiness
(alongside F3). Founder checkpoint prepared ([U3-WALKTHROUGH](U3-WALKTHROUGH.md));
owner experience acceptance PENDING. U4 remains unauthorized.

## U3 integration, combined verification and closure (2026-10-07)

The owner authorized integrating the Codex experience repair, independent
combined verification, runnable-example preservation/documentation and U3
closure. Decisions of record:

1. **Fast-forward integration.** `codex/ui-foundation-u3` advanced by normal
   fast-forward over the linear experience chain (`8d99f36` FAIL-preserved →
   `e0dd026` repaired PASS → `9c34679` records) plus one records-only
   `.prettierignore` commit protecting imported evidence bytes
   (`952d92da5131d6ab595b45b3bf18bc7ce3b3466d`). The experience branch and
   all review history remain untouched at `9c34679…`.
2. **Combined gate.** Fresh independent verifier at the exact integrated SHA:
   "U3 COMBINED GATE: PASS WITH NON-BLOCKING FINDINGS" — report verbatim at
   [U3-COMBINED-VERIFY-01](reviews/u3/U3-COMBINED-VERIFY-01.md) (sha256
   `e101b4c705cc9c13ce6b5f44b2f31a33264acb54f3f14e19f60d74a23653efe4`) with
   21 evidence files; per-criterion evidence labelled reproduced-now vs
   standing (standing legs justified by byte-identical files).
3. **Owner feedback scope.** "I have try it, it work simply." recorded
   verbatim, scoped to the repaired queue/detail experience
   ([OWNER-FEEDBACK-01](reviews/u3/OWNER-FEEDBACK-01.md)); it does not attest
   scenario internals, the durable restart or Studio surfaces.
4. **Closure.** U3 closed PASS WITH NON-BLOCKING FINDINGS: gate + owner
   criterion satisfied; F-1 repaired by the integration (combined verifier
   confirmed terminal records carry no enabled approve affordance);
   V-F1 minor (invalid-saved-source diagnostic wiped on detail first mount,
   fails safe) retained with owner; F3 + N-2 carried to U4 packaging
   readiness; the durable restart named as the single owner-unattested
   (triple-independently-verified) headline item with a short walkthrough.
5. **Runnable examples preserved and documented.** Both examples stay
   committed; `examples/ui-authoring-proof/README.md` rewritten to U3 truth
   (roles, presets, storage modes, data locations, seed recreation),
   `examples/ui-design-proof/README.md` created, central index
   [examples/README.md](../../examples/README.md) added; launch instructions
   validated against a real fresh clone (npm ci → package builds → dev +
   production `node build`, all documented routes HTTP 200). Git preserves
   source/fixtures; servers, builds and runtime data (SQLite file, browser
   localStorage) are separate; browser-saved edits are not Git commits.

U4 handoff obligations (documentation only, NOT authorized to start): ui-editor
dist build TS2307 ×4 (F3) + dist-dependent unit suite (N-2) must be resolved
before any built-artifact reuse claim; V-F1 in the next product-host UX pass;
see [U3-HANDOFF](U3-HANDOFF.md) closure table.

## U4 component-integration amendment record (2026-10-07) — documentation/design only

Owner decision: existing catalog components must participate in canonical
VICT UI authoring — their meaningful properties, values and action
connections inspectable and editable through the authoring experience; the
registered-component proof with code-owned state/wiring does not satisfy
this requirement; registered components remain a legitimate route but do not
substitute for the document-authored catalog proof.

Actions of record (all documentation/design; runtime + U4 implementation
remain unauthorized):

1. Branch `codex/ui-foundation-u4-component-amendment` created from the
   prepared handoff records `cfbd6d3…`; all four entry SHAs verified live
   (`cfbd6d3…`, `16df3bf…`, `952d92d…`, `9ec87f3…`). Original freeze bytes
   preserved; the prior P3 recommendation retained as history and labelled
   superseded-for-the-required-proof.
2. [U4-COMPONENT-AMENDMENT](U4-COMPONENT-AMENDMENT.md) written — the
   smallest reusable contract: canonical instance → compiled instruction →
   registered implementation → typed output → authored state/action
   connection, on the EXISTING channels (setState / declared-action
   dispatch); additive optional fields only inside `vict.ui-document@1` /
   `vict.ui-render-plan@1` (schema strings unchanged — verified: the
   `UI_DOC_UNKNOWN_SCHEMA` guard rejects any schema-string change; document
   validation is property-based and tolerates additive optional fields);
   ABI marker `vict.ui-component-abi@1` carries cross-implementation
   compatibility; implementations receive emit-only authority (no
   dispatcher, no adapters); generation-gated stale-callback drop;
   declared-slot composition for AppShell/Dialog (minimum necessary —
   both proofs require authored children); new diagnostics specified
   (unknown output, payload invalid, incompatible binding, slot
   required/unavailable, component unavailable, ABI unsupported, stale,
   rejected emit); digest/applicationVersion semantics stated from
   verified mechanics (`canonicalUiDocument` → document identity entry →
   `computeApplicationVersion`).
3. Contract fixtures (examples, not runtime evidence):
   [fixtures/component-contract/](fixtures/component-contract/README.md) —
   valid checkbox/select/button/dialog/appshell connections, multiple
   instances with distinct bindings, invalid/unknown outputs, incompatible
   payloads/bindings, missing/mismatched implementations, slot composition.
4. [U4-COMPONENT-INTEGRATION-DESIGN](U4-COMPONENT-INTEGRATION-DESIGN.md)
   rewritten around the authoring route (P3/P2 kept as labelled
   comparisons); [U4-COMPONENT-REUSE-MATRIX](U4-COMPONENT-REUSE-MATRIX.md)
   gains the amendment support-level table (every new piece C — contract
   only); [U4-HANDOFF](U4-HANDOFF.md) scope/acceptance/negatives/agent
   brief updated; the old §12 authorization prompt SUPERSEDED in place
   (marked unusable) and replaced by the amended prompt pinned to the
   frozen amendment.
5. The withdrawn "extension v2" sketch is replaced by the amendment's
   implementable drafts; no text adopted unresolved.
6. Independent contract review: round 1 **FAIL** at `9c31fae…` (B-1
   blocker — the instance revision pin was misattributed as existing; the
   extension compile path echoes the descriptor revision and resolves
   id-keyed last-wins; 8 minors incl. nonexistent diagnostic code in a
   fixture, malformed expression shape, underspecified implementation
   interface, unnamed action-input-catalog mechanism) → repairs
   `d84035a…` → round 2 **PASS WITH NON-BLOCKING FINDINGS** (SLOT_REQUIRED
   applicability scoping; .gitattributes restore) → `d78a309…` → round 3
   **PASS**. Report verbatim:
   [U4-AMENDMENT-REVIEW-01](reviews/u4/U4-AMENDMENT-REVIEW-01.md)
   (final sha256 `34506ab9…`; round-1 section byte-identical to the
   delivered `9ce2267c…`).
8. Owner decision 8 — CATALOG RECALIBRATION (this cycle): the owner
   clarified the UI library is much richer than the amendment's five
   compositions and required a full-catalog architecture and delivery plan
   (41 families reconciled with 38 recipe modules; higher-level public
   components inventoried; family-and-mode capability; contract challenge;
   explicit batches). Output: [U4-CATALOG-RECALIBRATION](U4-CATALOG-RECALIBRATION.md)
   (inventory + trace + design + batches), amendment §10 (UiValueType
   widening: stringList/numberList/isoDate/isoTime; dual-scalar date
   ranges; empty-value conventions; item-content authoring rule; gate
   re-checked family-agnostically), four new contract fixtures, and the
   reuse-matrix §6 standing ledger. Application-surface components
   (RecordsTable, Chart, Conversation, Form, …) are recorded as
   application-plan governed (P3), not document-authoring targets; the
   three deferred families stay deferred. Batches B1–B5 with B1
   recommended first (scalar foundation). Runtime implementation remains
   unauthorized; supersedes the amendment §8 five-family limit and its
   "must not expand" clause (both preserved in frozen bytes at `460d963…`).
   Review: R1 **PASS WNF** (9 findings, all repaired) -> round-2 recheck
   **PASS WNF** (8/9; pointer residual repaired). Frozen (SUPERSEDING,
   scope): payload `52684696…` (seven pins incl. amendment-with-§10 and
   the recalibration document), record
   [U4-CATALOG-RECALIBRATION-FREEZE](U4-CATALOG-RECALIBRATION-FREEZE.md).
   Freeze-check (separate fresh checker): `U4 CATALOG RECALIBRATION FREEZE
   CHECK 03: VERIFIED`
   ([reviews/u4/FREEZE-CHECK-03.md](reviews/u4/FREEZE-CHECK-03.md),
   sha256 `b60a6041…`): 14/14 pins, marker-commit proof, prior payloads
   and artifacts preserved, lineage/scope/report-integrity/static-contract
   checks all pass.
7b. Superseding freeze — VERIFIED: payload commit `460d963…` (empty
    marker; ten byte-pins), record
    [U4-AMENDMENT-FREEZE-02](U4-AMENDMENT-FREEZE-02.md); separate fresh
    checker reproduced 20/20 pins, confirmed the superseded payload and
    record byte-preserved, docs-only scope, lineage and probe evidence
    (verbatim rerun byte-identical), verdict `U4 AMENDMENT FREEZE CHECK
    02: VERIFIED` ([reviews/u4/FREEZE-CHECK-02.md](reviews/u4/FREEZE-CHECK-02.md),
    sha256 `1bb61584…`). MINOR-2 closed: handoff §12.2 pins the
    superseding record; the first freeze is marked must-not-use.
7a. Owner-directed REPAIR CYCLE (supersedes decision 7's payload, not its
    process): the first freeze's compatibility claim ("old renderer
    rejects via the descriptor abi field") was FALSIFIED — resolver-level
    probe against the exact `952d92d…` bytes ACCEPTED the frozen
    fixture descriptor (abi/outputs invisible to the legacy gate; probe
    C1, 5/5, reviews/u4/abi-probe/, production files unmodified). The
    gate was rebuilt from verified legacy behavior: ABI marker declared
    in descriptor `events` (the field legacy consumers fail close on),
    compile-artifact marker (`outputDecls` always emitted for abi@1
    descriptors), implementation `abi` match. Adjacent fixes: `outputDecls`
    corrected to the array type; action-input catalog owned by
    @victframework/application (`deriveActionInputCatalog` -> `compileUiDocument`
    catalogs option `actionInputs` at the existing ui-attach.ts call site;
    in the later U4 allowed scope). R2 review: round 1 **PASS WNF** at
    `0ad3a2a…` (MINOR-1 harness rerunnability — fixed and proven by
    verbatim rerun; INFO-1/2/3 — fixed) -> round 2 **PASS WNF**. Report:
    [U4-AMENDMENT-REVIEW-02](reviews/u4/U4-AMENDMENT-REVIEW-02.md).
7. First freeze — VERIFIED at the time, now SUPERSEDED by decision 7a:
   immutable payload commit `68e166f…`
   (empty marker; payload paths byte-exact), per-file SHA-256 pins and
   supersedes/governing statement in
   [U4-AMENDMENT-FREEZE](U4-AMENDMENT-FREEZE.md); a separate fresh checker
   reproduced all pins (18/18), verified docs-only scope and the lineage,
   verdict `U4 AMENDMENT FREEZE CHECK: VERIFIED`
   ([reviews/u4/FREEZE-CHECK-01.md](reviews/u4/FREEZE-CHECK-01.md), sha256
   `18b213f3…`). Implementation remains unauthorized; the operative U4
   authorization prompt is [U4-HANDOFF](U4-HANDOFF.md) §12.2 pinned to the
   frozen amendment.

## U4 handoff preparation record (2026-10-07) — implementation NOT authorized

Documentation-only cycle on `codex/ui-foundation-u4-handoff` (from the U3
closure records `16df3bf…`). Deliverables:
[U4-HANDOFF](U4-HANDOFF.md) (PREPARED — IMPLEMENTATION NOT AUTHORIZED; all
seven frozen U4 criteria mapped; the representative component proof is an
explicit additional owner requirement that cannot be relabelled a minor
finding; packed-tarball isolation; copy-paste authorization prompt),
[U4-COMPONENT-REUSE-MATRIX](U4-COMPONENT-REUSE-MATRIX.md) (source-backed,
support levels A/B/C, explicit non-claims),
[U4-COMPONENT-INTEGRATION-DESIGN](U4-COMPONENT-INTEGRATION-DESIGN.md)
(representative proof on registered components + document elements; zero
frozen-contract changes; the props-only extension gap documented with a
scoped extension-v2 amendment proposal requiring owner authority, NOT
implemented). U3-HANDOFF opening status corrected (IMPLEMENTED → CLOSED;
historical bytes untouched).

Decisions of record:

1. **Recommended integration route**: registered components (P3) + document
   elements (P2) — both use existing public exports and recorded-tested
   patterns; no contract amendment needed for the U4 proofs.
2. **ui-editor packaging repair (F3) restated truthfully** after reviewer
   verification: the package is source-only today and its build is a
   `noEmit` typecheck that fails — the U4 repair is an emitting build (or
   the documented source-exports fallback, an explicit recorded choice) plus
   the four TS2307 fixes; no editor behavior change.
3. **Owner decisions surfaced** (not assumed): acceptance of the
   registered-component route as catalog reuse for U4; the ui-editor repair
   scope; packed-tarball install as the isolation mechanism and the pack
   list.
4. **Independent handoff review** (fresh documentation reviewer, read-only):
   round 1 FAIL (3 blockers: self-citing review reference, ui-editor
   packaging contradiction, non-exported ActionButton in the design; 4
   minors + process) → repairs → round 2 FAIL (narrow: three superseded
   statements survived; premature push claim; table nits) → repairs →
   round 3 FAIL (§8 record was a silent no-op edit; one table break) →
   repairs made against actual file bytes with post-edit verification →
   **round 4 PASS WITH NON-BLOCKING FINDINGS** (delivery-coupled NF-1/NF-2
   resolved by this delivery commit + push). Report imported verbatim:
   [U4-HANDOFF-REVIEW-01](reviews/u4/U4-HANDOFF-REVIEW-01.md) (final sha256
   `3b41263d1ce53ab629a804da9264730d9119704a2723b023fae302990b98d0db`;
   round-1 section byte-identical to `0b4c3ef3…`, preserved via scoped
   .gitattributes). Process lesson recorded: string-replacement edits must
   be verified against file bytes — a missed match is silent.

## U4 catalog recalibration bounded repair (2026-10-07) — documentation/design only

Owner findings F1–F4, repaired on `codex/ui-foundation-u4-catalog-repair`
(base `b05d016…`):

- **F1 complete value path** — amendment §10.1a added: the serializable
  carrier `UiValue` (= `string | number | boolean | readonly string[] |
  readonly number[]`), the ONE shared guard `isUiValueOfType` (new
  `packages/ui/src/values.ts`, owner `@victframework/ui`), and the
  boundary table widening all eight public interfaces: `io.emit` payload
  (bridge copies arrays), state initials, prop defaults, host
  `stateValues` (DocumentHost + EditorCanvas), render-side validation
  (replacing `typeof value === declaration.type`,
  `DocumentHost.svelte:95`), author-time validation (replacing the
  three-way typeof conjunction, `validate.ts:383–385`), compiled
  `outputDecls`/`actionInputs` typing, preview forwarding. Reference-only
  array props preserved alongside list-state sources; ownership/copy
  discipline recorded; illustrative signatures typechecked under
  `--strict` with negative cases failing (`reviews/u4/validator-probe/
  f1-signatures.ts`). §3.2/§3.4 inline blocks updated to agree.
- **F2 legacy-validator compatibility** — disposable probe against the
  pinned legacy bytes (`952d92d` ≡ `b05d016` for `packages/ui/src/**`):
  all four widened declarations REJECTED with `UI_EXPR_TYPE_MISMATCH`
  (severity error; lists `actual: 'object'`, iso markers `'string'`);
  string/string control ACCEPTED. Evidence:
  `reviews/u4/validator-probe/{probe.mjs,output.txt}`. The §4.3 matrix
  "new document → old validator: accepted" row is replaced by split
  rows: primitive-state output documents accepted; widened-vocabulary
  documents REJECTED at the VALIDATION gate (earliest fail-closed stage
  — not the descriptor marker); new-instructions→legacy-renderer row
  noted as normally unreachable upstream. Probe is validator-level only
  (no browser). The verified events-marker gate, outputDecls compile
  marker and implementation `abi` requirements are unchanged; new-side
  acceptance is a contract requirement until B1 lands it.
- **F3 Collapsible + ledger reconciliation** — collapsible assigned B5
  (open boolean loop + trigger/content composition + acceptance row);
  programmatic manifest↔ledger reconciliation added as a standing rule
  (`reviews/u4/ledger-reconciliation/reconcile-ledger.mjs`): 38 available
  families must each hold an assignable row, deferred three only in the
  X-exclusion row. Repair run: exactly one gap (collapsible — fixed),
  zero misplaced exclusions; re-run output RECONCILIATION OK.
- **F4 ownership vs founder authoring** — the overbroad blanket
  "document-node authoring: No — by boundary decision" is corrected:
  StatusBadge/Feedback/Button ALREADY mount in documents via
  `ext.status`/`ext.feedback`/`ext.button` registered implementations
  (U3 descriptors + authored instances wrapping the PUBLIC components —
  direct evidence in `examples/ui-authoring-proof`); per-component
  roadmap added (recalibration §4.0): canonical config source, working
  evidence, unavailable-to-founder surface, proposed Studio editing
  surface — ALL recorded PENDING owner decision; agent-selected
  boundaries are not owner acceptance. Application-plan ownership
  retained for intent-driven surfaces; no component forced into a
  document node; apps/studio untouched.
- Governing documents reconciled (amendment, recalibration, matrix,
  handoff §13.1 single current B1 prompt with §12.2 superseded visibly);
  B1 scope made explicit: vocabulary + boundary plumbing lands, founder
  proofs stay limited to B1 rows. All seven U4 criteria, packaging
  repair, packed-artifact isolation, parity, bundle separation,
  unfamiliar-agent exercise and founder checkpoint preserved.

## Future evidence entry format

Identity: repository, branch, full base/candidate/reviewer SHAs, environment and contract pins.
Claims: criterion ID with PASS/FAIL/NOT DEMONSTRATED and direct evidence.
Reproduction: commands, inputs, fixture versions, screenshots/browser sizes or API behavior.
Findings: severity, effect, owner, fix/carry decision, next check.
Verdict: independent conclusion and exact audited snapshot.
Repair: prior failure, fix commit, affected checks and new verifier snapshot.
Authority: next accepted action; never derive it from an agent's own proposal.
