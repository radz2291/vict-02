# Independent U0 affected re-verification, round 2 — VICT UI foundation workstream (review 02)

- Reviewer: fresh-context independent verifier for round 2. I did not author any candidate
  byte, did not participate in the round-1 review, the pack authoring, the U0 installation,
  or the repairs, and I did not adopt the builder's or manager's reasoning. My job was
  falsification of the repaired candidate. I repaired nothing.
- Audited candidate (exact): **`6a2f7b9ea3078da16ce42253ee9db0c902bdf3af`**
  (branch `codex/ui-foundation-u0`, worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u0`, verified
  via `git rev-parse HEAD`; working tree clean before and after all checks).
- Round-1 reviewed candidate: `f7767b2750d85399e7200991e503e061001ee03f` (re-verified via
  `git rev-parse f7767b2`; matches the round-1 report's audited SHA string exactly).
- Base: `4d2df037d8a82d36c60bf1bff16919650643ce22`; live `origin/main` re-fetched during this
  review via `git ls-remote origin` → still `4d2df037d8a82d36c60bf1bff16919650643ce22`
  (baseline unmoved). The candidate branch is not yet on the remote; the branch's only new
  commit since round 1 is `6a2f7b9` ("U0 round-1 review repairs F-1..F-7 + manager
  fixture-semantics repair; preserve reviewer report").
- Independence: the only file I created anywhere is this report (in
  `vict-02-u0-review-02/`, outside both worktrees). Zero edits inside `vict-02-u0` or the
  main checkout; read-only git and read-only npm (`prettier --check`) only; no install, no
  build. Working tree of `vict-02-u0` confirmed clean after all checks.

## 1. Candidate and integrity verification

- `git diff f7767b2..6a2f7b9 --stat`: 8 paths, ALL under `docs/ui-foundation/**` —
  API-SPEC.md (+12/−6), DECISIONS-AND-EVIDENCE.md (+44/−1), PROOF-DESIGN.md (+1/−1),
  RECONCILIATION.md (+1/−1), STATE.md (+3/−2), fixture rename
  `ui-document-invalid-duplicate-node.json` → `ui-document-invalid-dangling-child.json`
  (R93, +content edits), `ui-document-invalid-dangling-component.json` (+1),
  `reviews/U0-REVIEW-01.md` (new, +272). No production source, manifests, lockfiles,
  `apps/studio`, root `AGENTS.md`/`README.md`, other-track or Stage 9 bytes touched.
  Root `AGENTS.md` and `README.md` diff f7767b2→HEAD: **0 lines**.
- **Reviewer-report integrity**: SHA-256 of
  `docs/ui-foundation/reviews/U0-REVIEW-01.md` at HEAD =
  `456e910a2873cfc613ed064909e12716fadb4f6372bcf0d6b81fc539de19c241` — byte-identical to the
  pinned round-1 report hash. The reviewer's words were preserved verbatim. (The report was
  not present at f7767b2; the repair commit adds it unchanged.)
- The round-1 report's "other three negatives have notes" phrasing is slightly loose
  (see N-2), but the report bytes are preserved as written — correct behavior.

## 2. Per-finding repair verification

| Finding | Round-1 severity | Repair verified? | Evidence at 6a2f7b9 (independently re-derived) |
| --- | --- | --- | --- |
| F-1 Edge datum | MINOR | **REPAIRED — with a NOTE-level residual (N-1)** | PROOF-DESIGN §5 now records Edge **154.0.4258.53** "(installed executable version; …)". I independently confirmed the installed Edge: `msedge.exe` ProductVersion/FileVersion = 154.0.4258.53 (`C:\Program Files (x86)\Microsoft\Edge\Application\`) AND HKCU `Edge\BLBeacon` = 154.0.4258.53. The cell also discloses a staged package — but attributes 155.0.8059.26 ambiguously to the Edge row; see new finding N-1. All other §5 datums re-measured exact: Node v22.13.1, npm 11.19.1, Windows 11 Home build 26200, model 81N4, 12,102 MB RAM, Chrome 154.0.8037.92 (exe + HKCU BLBeacon). |
| F-2 §10 omits collision fixture | MINOR | **REPAIRED** | §10 now has a row for `application-v3-catalog-collision.json` ("two competing catalog entries for the same `(documentId, revision)` with different digests → `UI_DOC_REVISION_COLLISION`"). Row count 10 == 10 files on disk, names identical. Row semantics match API-SPEC §2.2 rule 2 and the fixture itself (see §4.b). |
| F-3 valid-row overstatement | MINOR | **REPAIRED** | Row now: "one document-mode screen + one legacy screen, document supplied via the explicit catalog (pins are an optional input and omitted here)". Fixture ground truth: `uiDocumentPins: []`; screens = `screen.inspection-detail` (uiDocument ref, document-mode) + `screen.settings` (layout, legacy). Accurate. |
| F-4 STATE digest conflation | MINOR | **REPAIRED** | Installation record now cites BOTH, verified against pack artifacts: delivered pack STATE bytes = inventory digest `957818b1ffb47c9ebac2be3dcc2d0eb11eca177312ba46109d439c64e806d70e` — exact match to pack `HASHES.json` `docs/ui-foundation/STATE.md.sha256`; candidate-02 reviewed STATE snapshot = `8f7aeda86896ef83669e394e9a48e527f5db849a3e0fb880642a2f36bb05a963` — exact match to `reviews/candidate-02.json` manifest. Both digest strings quoted in full and correctly attributed, with the honest clause that the installed copy departs from both via the disclosed updates. |
| F-5 §7 scope sentence | NOTE | **REPAIRED** | §7 header now carries the scope paragraph: existing application `APPLICATION_*`, release `RELEASE_*` (e.g. `RELEASE_APPLICATION_MISMATCH` cited in §2.3), adapter `DATA_*`, renderer `RENDERER_*`, runtime effect denials "remain governed by their owning modules and are intentionally not duplicated here". Accuracy re-verified: §2.3 indeed cites `RELEASE_APPLICATION_MISMATCH` (line 94); §6.2 "Preview scenarios and fencing" exists; the code is real at `packages/application/src/release.ts:31` (union type) and `:280`. |
| F-6 "one docs-index line" | NOTE | **REPAIRED** | RECONCILIATION §1 now reads "a single docs-index bullet (source-wrapped over two physical lines) in `README.md`" — byte-accurate: README.md (unchanged by the repair commit) carries exactly one bullet for ui-foundation, wrapped over 2 physical lines (lines 268–269). |
| F-7 negative-fixture notes | NOTE | **REPAIRED (scope = the two named files)** | `ui-document-invalid-dangling-component.json` now ends with a note naming `UI_DOC_UNKNOWN_COMPONENT` (and the fixture genuinely references `def.missing-card`, absent from `componentDefinitions`, which holds only `def.finding-card`). The duplicate-node fixture (now dangling-child) carries a note naming `UI_DOC_UNKNOWN_NODE` plus the duplicate-ID JSON limitation. The only negative still without a note is `application-v3-invalid-mixed-presentation.json`, which had no note at f7767b2 either (bytes unchanged) and was not in F-7's scope — recorded as observation N-2. |
| Manager repair M-1 (disclosed beyond reviewer list): duplicate-node → dangling-child + new code | — | **REPAIRED, consistent in all three places** | (a) §7 catalog: exactly one row added (catalog table rows 27 → 28): `UI_DOC_UNKNOWN_NODE`, error, payload `documentId, nodeId, missingChildId`, class "invalid tree (internal ordered reference)". (b) Fixture: `ui-document-invalid-dangling-child.json` — root `screen` lists child `gone-child`; my resolution pass over the whole node registry finds exactly ONE unresolved child ref (`screen → gone-child`) and no other dangling refs, no intra-node duplicate children, and the one component instance resolves (`def.finding-card` exists). Note field correctly explains: JSON object keys cannot repeat, so `UI_DOC_DUPLICATE_NODE_ID` is exercised at parsed-model level in U1. (c) `UI_DOC_DUPLICATE_NODE_ID` remains specified in the §7 catalog (row retained, payload `documentId, nodeId`) with the JSON-limitation note carried in the §10 row and the fixture note. |

## 3. Regression checks

1. **Diff scope & report integrity** — see §1: only `docs/ui-foundation/**`; reviewer report
   byte-identical (SHA-256 match); AGENTS/README untouched by the repair commit.
2. **Pack-fidelity regression** — recomputed SHA-256 of all 11 pack-inventoried installed
   files at HEAD vs pack `HASHES.json`: AGENTS.addendum.md, CONTRACTS.md, HANDOFF.md,
   PRODUCT-ARCHITECTURE.md, STAGES-AND-VERIFICATION.md, PACK-REVIEW-01.md, PACK-REVIEW-02.md,
   candidate-01.json, candidate-02.json — all 9 still byte-identical to the pack. Only
   DECISIONS-AND-EVIDENCE.md and STATE.md differ — precisely the two files
   `HASHES.json.post_review_reporting_metadata` declares as reporting-mutable. PROOF-DESIGN,
   API-SPEC, RECONCILIATION and the fixtures are candidate-authored artifacts (not in the
   pack `docs/`), so repairing them violates no inventory. The round-1 U0-02/U0-03 evidence
   (ownership exclusion, canonical-source quotes) is untouched by the diff.
3. **Catalog/inventory consistency** — §7 table rows 27 → 28 (only `UI_DOC_UNKNOWN_NODE`
   added); §10 rows (10) == files on disk (10), names identical; `npx prettier --check
   docs/ui-foundation/fixtures/*.json` → "All matched files use Prettier code style!" (exit 0).
4. **Diagnostic-code sweep** — every code referenced by any fixture exists in the §7 catalog
   (UI_DOC_UNKNOWN_NODE, UI_DOC_DUPLICATE_NODE_ID, UI_DOC_UNKNOWN_COMPONENT,
   UI_DOC_REVISION_COLLISION, UI_APP_PRESENTATION_MODE_INVALID, UI_DOC_STALE_REVISION,
   SCENARIO_COVERAGE_MISSING). Non-catalog codes appearing in prose are (a) existing VICT
   diagnostics quoted from source in RECONCILIATION §4 (DATA_*, RENDERER_*, RELEASE_*) or
   (b) schema/type identifiers (`APPLICATION_DEFINITION_SCHEMA_V3`, `APPLICATION_FIELDS`,
   …) — exactly what the new §7 scope sentence places outside the table. No orphan code.
5. **U0-01..U0-07 targeted re-checks** — base & remote unchanged (§ header above); branch/
   worktree isolation intact; README/AGENTS untouched; the repairs did not weaken any round-1
   U0-01..U0-07 evidence (each repair is confined to the finding it addresses); environment
   datums (U0-07) all re-measured exact (§2 F-1 row).
6. **Spot falsifications of my own choice**:
   - a. Edge staged-package claim → found the misattribution recorded as N-1 below.
   - b. Collision-fixture genuineness: the two `uiDocuments` entries share
     `id=doc.inspection-detail`, `revision=3`, schema `vict.ui-document@1`; canonicalized
     JSON digests differ (one text node: "Approve inspection" vs "Approve") ⇒ a real
     same-(documentId,revision)/different-digest collision, matching §2.2 rule 2 and the §10
     row. Held.
   - c. Dangling-child negative is minimally invalid: exactly one unresolved ref, everything
     else resolves — the fixture demonstrates the new code and nothing else. Held.

## 4. New findings

Severity ladder per STAGES-AND-VERIFICATION.md §1. No BLOCKER, no MAJOR, no MINOR found.

- **N-1 (NOTE) — PROOF-DESIGN §5 staged-package disclosure is mis-scoped to the Edge cell.**
  The repaired cell reads "Edge 154.0.4258.53 (installed executable version; a newer staged
  155.0.8059.26 package is present but is not the installed binary)". On this machine
  155.0.8059.26 is staged ONLY for Chrome: `C:\Program Files\Google\Chrome\Application\`
  contains both 154.0.8037.92 and 155.0.8059.26 (chrome.exe = 154.0.8037.92); the Edge
  Application directory contains only 154.0.4258.48 and 154.0.4258.53; recursive search finds
  no 155.0.8059.26 anywhere under Edge or EdgeUpdate. The installed Edge datum (the load-
  bearing number) is correct, and a staged 155.0.8059.26 package IS present on the machine —
  but the sentence invites the reading that Edge has a staged 155 package, which is false.
  Round-1's own repair suggestion ("note the staged **Chrome** 155 update explicitly") was
  only partially followed. User effect: an auditor reproducing the named environment looks
  for a staged Edge 155 and finds none. Repair (not applied, per my mandate): name Chrome in
  the disclosure clause, or move it out of the Edge cell — conveniently doable in the
  freeze-record round since freeze pins follow anyway.
- **N-2 (NOTE, pre-existing, out of F-7 scope) — `application-v3-invalid-mixed-presentation.json`
  is the only negative fixture without an expected-diagnostic note.** It had no note at
  f7767b2 either (bytes unchanged by the repair commit); its negative semantics are
  structural (screen.inspection-detail carries BOTH `uiDocument` and `layout`) and its §10
  row names `UI_DOC_PRESENTATION_MODE_INVALID` — recorded here as `UI_APP_PRESENTATION_MODE_INVALID` —
  so intent is recoverable. Round-1 F-7's "unlike the other three negatives" was slightly
  imprecise; the repair satisfied F-7's letter. Optional uniformity fix at freeze.
- **N-3 (NOTE, unverified) — STATE.md's baseline-check claims were not re-run by me.**
  STATE.md asserts "npm run typecheck clean, npm run format:check clean, npm run check:ui
  0 errors/0 warnings" at the candidate. Verifying would require `npm install` (tree-
  mutating), which my mandate forbids. These claims are plausible, non-load-bearing for the
  U0 documentation contract, and reproducible by the freeze checker in an installed
  workspace. Marked unverified, with the reproducing command stated.

## 5. Per-criterion status at 6a2f7b9ea3078da16ce42253ee9db0c902bdf3af

| Criterion | Status | Basis |
| --- | --- | --- |
| U0-01 Baseline | PASS (re-checked) | Remote/main unchanged; branch/worktree isolation intact; clean tree; repairs inside allowed paths only |
| U0-02 Ownership | PASS (untouched by diff) | No excluded path in the repair diff; f7767b2 evidence carries over |
| U0-03 Canonical source | PASS (untouched by diff) | RECONCILIATION §2/§4 not modified by the repair commit; f7767b2 evidence carries over |
| U0-04 Contracts | PASS | Repairs strictly improve §7/§10/fixture consistency; catalog 28 codes; §10 == disk; prettier clean; no orphan codes |
| U0-05 Execution | PASS (untouched by diff) | API-SPEC §6 execution sections not modified by the repair commit |
| U0-06 Module/reuse plan | PASS (untouched by diff) | §9 not modified by the repair commit |
| U0-07 Product/evaluation | PASS | §5 environment now measured-exact on all seven datums; scenario/walkthrough sections untouched |
| U0-08 Independent freeze | **NOT DEMONSTRATED (at this SHA, by design)** | No freeze pins/record/checker/recorded SHAs yet; this report is the "affected re-verification" step INSIDE U0-08; missing proof cannot be promoted to pass |

## 6. Round-2 overall verdict

**HELD**

All seven round-1 findings plus the disclosed manager repair are genuinely applied and
effective at `6a2f7b9ea3078da16ce42253ee9db0c902bdf3af`; the repairs regressed nothing; the
preserved round-1 report is byte-intact. Three NOTE-level findings remain (N-1 mis-scoped
staged-package disclosure, N-2 pre-existing note gap on one negative fixture, N-3 unverified
baseline-check claims) — none blocking. U0-01..U0-07 are demonstrated at the new SHA; U0-08
(freeze pins, freeze record, separate fresh freeze-byte checker, recorded
candidate/reviewer/checker SHAs, final verdict) is NOT DEMONSTRATED at any pre-freeze SHA and
cannot be promoted to pass. A stage verdict of PASS would therefore be dishonest; HELD
remains the accurate state — and is the designed pre-freeze state, not a repair demand.

**Ready to freeze: YES.** The repaired candidate is fit to enter the freeze half of WP-6 as
the U0 contract candidate: pin the contract bytes at this SHA (or after applying the one-
clause N-1 correction, which would then warrant a trivial re-check of that single cell),
commit the freeze record afterwards, and have a fresh checker reproduce the pins. This report
must never be cited as the freeze-byte verification, and it grants no U1 authorization.

## 7. Reproduction commands (read-only, all at the audited SHA)

```
cd C:/Users/RZ1/Desktop/RZ/vict-02-u0
git rev-parse HEAD                       # 6a2f7b9ea3078da16ce42253ee9db0c902bdf3af
git diff f7767b2..6a2f7b9 --stat
git diff f7767b2..6a2f7b9 -- README.md AGENTS.md          # empty
sha256sum docs/ui-foundation/reviews/U0-REVIEW-01.md      # 456e910a…c241
git ls-remote origin refs/heads/main                      # 4d2df03…ce22
npx prettier --check docs/ui-foundation/fixtures/*.json   # exit 0
powershell: (Get-Item 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe').VersionInfo.ProductVersion  # 154.0.4258.53
dir 'C:\Program Files\Google\Chrome\Application\'         # 154.0.8037.92 + staged 155.0.8059.26 (Chrome only)
```
