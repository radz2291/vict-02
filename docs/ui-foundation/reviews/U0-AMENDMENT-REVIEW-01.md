# U0 AMENDMENT REVIEW — round A (fresh independent contract verifier)

Date: 2026-10-06 · Verifier: independent, non-author (fresh contract challenge; falsification mode) · Repository: https://github.com/radz2291/vict-02

## 1. Audited identities (all verified live in `C:/Users/RZ1/Desktop/RZ/vict-02-u0`)

| Item | SHA / value | Verified |
| --- | --- | --- |
| Branch / worktree | `codex/ui-foundation-u0` at worktree `vict-02-u0`, clean tree | yes (`git status` clean; branch ahead of remote by 2 commits — unpushed, as expected pre-review) |
| Base | `4d2df037d8a82d36c60bf1bff16919650643ce22` | yes; live `git ls-remote origin main` = same (baseline unmoved) |
| Amended contract candidate under audit | `33ae56fef98b0f7c467a42f10cd873d08b1f8209` (parent `a664c70`) | yes |
| Evidence ledger commit | `df3d283187c852c39840cc6909ba13605de7a75b` (parent `33ae56f`) — HEAD audited | yes |
| Remote branch tip | `a664c70fe14dc9312956ad00c1a8ec86d5b93981` (amendment+ledger local-only) | yes (`ls-remote`) |
| Superseded original freeze record | `ffbafc0a509d7179eddfa81c157595fe336c9dba` over candidate `54490a861fcd9992bfc8bfac14178fdb7921ecf0` | yes; FREEZE.json at HEAD still records the ORIGINAL candidate `54490a8…`, and `git log -- FREEZE.json` shows exactly one touching commit (`ffbafc0a`) — no tampering |
| Original 19 pins | reproduced 19/19 (`git cat-file blob 54490a86…:<path>` → sha256 + size vs FREEZE.json) | yes, all intact |
| Prior round-1 report | `docs/ui-foundation/reviews/U0-REVIEW-01.md` sha256 `456e910a2873cfc613ed064909e12716fadb4f6372bcf0d6b81fc539de19c241` at HEAD; single-commit history (added `6a2f7b9`, never modified) | yes |
| Round-2 report | `reviews/U0-REVIEW-02.md` sha256 `1a5fc6488348d7a2d29618cef821d0c41706051358caa0996e6ce3e7aebb5512` at HEAD; single-commit history (`54490a8`) | yes |
| Freeze-check report | `reviews/U0-FREEZE-CHECK-01.md` sha256 `43fcaa62ad64f483cf633290caa0d03cc4ddb9c250a5cf3ead9209337e3a62dc` at HEAD; single-commit history (`a664c70`) | yes |

Diff-scope conformance:
- Amendment `a664c70..33ae56f`: exactly 8 files, all under `docs/ui-foundation/**` (API-SPEC, CONTRACTS, PRODUCT-ARCHITECTURE 1 line, PROOF-DESIGN, STAGES-AND-VERIFICATION 1 line, + 3 new fixtures). Conforms to the authorized scope.
- Ledger `33ae56f..df3d283`: exactly `STATE.md` + `DECISIONS-AND-EVIDENCE.md`. Conforms.
- This verifier edited no tracked file and pushed nothing.

## 2. Per-finding verdicts

### A-01 Cycle detection scope — CLOSED WITH NOTES

What I attempted to break:
- **Graph closure.** The definition is closed ("A directed edge exists only where…"): edges only from (1) cross-document component expansion and (2) definition-level instantiation (within or across documents). I searched for real cycles that could escape: any cycle requires an edge *into* the start unit; no edge class targets a *document* node, so cycles can only form among definitions via class 2 — always detectable, including within one document (consistent with §3's "acyclic containment (`UI_DOC_CYCLE`)"). The asymmetric exclusion of same-document body→own-definition edges cannot hide a cycle (such edges only point into definition nodes already covered by class-2 detection).
- **Old ambiguity reversed both ways.** A legitimate navigation loop is explicitly non-cycle ("mere co-membership in the same application is never an expansion edge"); genuine structural embedding still cycles. The superseded rule-3 wording is gone; CONTRACTS bullet is consistent with the API-SPEC subsection; PRODUCT-ARCHITECTURE is untouched except the authorized A-02 lifecycle sentence.
- **Unnamed constructs.** Slot fallbacks, portal children, repeat templates and conditional branches are content authored in the owning unit; §3's "instances never acquire multiple source parents" keeps containment with authorship, so the closed edge definition covers them without extra edge classes. Not stated explicitly — see F-A-04 (NOTE).
- **Fixtures.**
  - `application-v3-valid-navigation.json`: verified to contain ONLY navigation/product-reference cross-links — mutual `navigate` ops through owning routes (`route.detail` ⇄ `route.queue`), record/repeat expression references, empty `actions`/`views`, empty `componentDefinitions` in both documents (zero structural composition). Field set and shapes byte-convention-identical to the reviewed `application-v3-valid.json` (same top-level keys, application field set, resource/route/screen shapes, `uiDocumentPins: []`, trailing `note`). Rule-1 references equal `(documentId, revision)` for both documents. Demonstrates the claim.
  - `ui-document-invalid-expansion-cycle.json`: `def.a → def.b → def.a` is the ONLY defect. Node IDs unique; all component/definition references resolve; no product references or expressions; §3 field set complete and conventions match the reviewed `ui-document-valid.json` (per-definition `nodes` maps). `UI_DOC_CYCLE` payload fields (`documentId, path`) match §7. Demonstrates the claim — but see F-A-03 (missing NEGATIVE note convention).

### A-02 Rejection→correction→resubmission — CLOSED WITH NOTES

- **Transition fully specified.** `inspection.revise` / permission `qlt.inspection.revise` (technician assigned); validates `status === 'rejected'` + assignment; `rejected → draft`; clears `decidedAt`/`rejectionReason` on the record with the reason preserved in the activity trail; activity entry; write. Lifecycle graph is now closed: draft→submitted (submit, validates draft), submitted→approved/rejected (approve/reject with `expectedDomainRevision`), rejected→draft (revise). Permitted edits resume (finding/evidence add operate on draft/submitted — draft post-revise qualifies). No contradiction with the pre-existing rules.
- **Concurrency** is coherent within the modeled rules: approve/reject carry `expectedDomainRevision`; submit/finding.add/evidence.add/revise are status-guarded single-actor-boundary writes; the journey ends in "a fresh approve/reject decision against a new `expectedDomainRevision`". Assignment validation has a modeled target (seed records carry `technician`/`supervisor`; fixture actor `act-t1` = record technician, holding `qlt.inspection.edit` and `qlt.inspection.revise`).
- **Journey text complete.** PROOF-DESIGN §3.1 now describes the full loop; PROOF-DESIGN §2 stays "all eight PRODUCT-ARCHITECTURE §6 scenarios"; PA §6 lists exactly eight scenarios and was changed only by the lifecycle sentence; fixture is correctly labeled a journey fixture, not a ninth scenario (row text, fixture note, PROOF-DESIGN parenthetical, PA §6 unchanged).
- **No runtime-proof claim.** Domain rules are tagged "proven at runtime in U3 (U3-03)"; API-SPEC §10 reiterates fixtures are "not executed in U0"; nothing in the amendment claims U0 execution evidence (STAGES §2 discipline upheld).
- **Fixture conformance.** `ui-scenario-valid-revision-loop.json` matches `ui-scenario-valid.json` conventions exactly (schema `vict.ui-scenario@1`, references, seeds incl. random/clock, actors/permissions, OutcomeSpec `{kind, sets, activityEntry}`, `resetBoundary`) and the declared action/permission names. Notes: F-A-02 (under-demonstrated steps), F-A-07 (decidedAt not fixture-modeled).

### A-03 Catalog identity total ordering — NOT CLOSED

- The normative rule itself is deterministic and complete: after rule-2 validation, dedup by `(documentId, revision)`, total order by code-point string comparison on the tuple, explicit non-semantic revision order. Example D correctly states permutation/duplicate invariance, the add/remove boundary, and the collision boundary (same key + different digests = rule-2 `UI_DOC_REVISION_COLLISION`, not an ordering case). CONTRACTS wording is consistent. The U1-01 addition ("catalog input permutation and duplicate identical entries leave applicationVersion unchanged (A-03)") is correct and testable.
- **But the amendment's own example is factually wrong (F-A-01, MAJOR).** API-SPEC §2.3 states: "revision order is plain string order (e.g. `"2" < "3" < "10"`), not semantic version order". Under code-point/lexicographic string order the true chain is `"10" < "2" < "3"` ('1' U+0031 < '2' U+0032) — verified programmatically (`'10' < '2' < '3'` → True; `'2' < '3' < '10'` → False). The parenthetical asserts numeric/natural order — precisely what the sentence disclaims. This is an internal contradiction inside the exact clause whose purpose is determinism, and it would mislead a U1-01 test author asserting sorted-payload order. Example D itself (D@2 before D@3) is unaffected.
- Residual wording ambiguity: F-A-05 (NOTE) on code-point vs UTF-16 code-unit ordering (differs only for astral characters).

## 3. Regression results (amended bytes at HEAD `df3d283`)

| Check | Result |
| --- | --- |
| U0-01 Baseline | PASS — clean isolated worktree; live `origin/main` = `4d2df03…` re-verified via ls-remote; root AGENTS routing pinned via byte-identical `AGENTS.addendum.md`; concurrent-track classification present |
| U0-02 Ownership | PASS — amendment diff confined to `docs/ui-foundation/**`; no apps/studio, manifests, lockfiles, or other-track bytes; same-Studio ownership text unchanged |
| U0-03 Canonical source | PASS — §2/§2.3 versioned attachment, closure/digest/identity/release behavior still fully specified (amendment tightens ordering); APP-019 disposition present (CONTRACTS §1, DECISIONS, HANDOFF WP-2) |
| U0-04 Contracts | PASS — schemas/drafts §3–§6, public APIs §8, 13 fixtures on disk ↔ 13 §10 rows (exact match, no orphans/missing), §7 catalog = 28 codes, zero orphan diagnostic references across docs+fixtures; new fixtures conform to §3/§6.2 drafts and established fixture conventions |
| U0-05 Execution | PASS — §6.2 execution mapping untouched (doubles via registry, adapter conformance, fail-closed missing-double, reset/fencing, durable replacement design) |
| U0-06 Module/reuse plan | PASS — §9 untouched by the amendment |
| U0-07 Product/evaluation | PASS — PA §6 (8 scenarios) + lifecycle sentence; PROOF-DESIGN walkthroughs, visual criteria, named environment (Edge 154.0.4258.53), budgets intact; journey now complete |
| U0-08 | NOT EVALUATED at this candidate by design — this is the pre-freeze amendment review; U0-08 belongs to the new freeze record + fresh checker (STATE says exactly this) |
| Pack fidelity | At candidate `54490a8…`: 9/11 pack-inventoried files byte-identical to pack `HASHES.json` (only DECISIONS + STATE diverged) — historical claim verified true. At HEAD `df3d283…`: 6/11 identical; diverged = CONTRACTS, DECISIONS, PRODUCT-ARCHITECTURE, STAGES-AND-VERIFICATION, STATE. The three extra divergences are exactly the owner-authorized A-01/A-02/A-03 targets; all four review/manifest pack files and HANDOFF and AGENTS.addendum remain byte-identical. No unauthorized pack-file drift (see F-A-06). |
| Diagnostic catalog | §7 has exactly 28 codes; regex sweep of all docs + fixtures found no reference to a code outside the catalog |
| Fixture table | 13 rows ↔ 13 files, names exact |
| Prettier fixtures | `npx prettier --check docs/ui-foundation/fixtures/*.json` — all clean |
| npm format:check | clean |
| npm typecheck | clean (tsc, no output) |
| npm check:ui | svelte-check: 0 errors, 0 warnings |
| STATE/DECISIONS truthfulness | truthful pre-verdict: "awaiting fresh independent review"; supersession recorded (original freeze + its readiness claims superseded for amended bytes; history preserved); original pins re-verified at reopening (I reproduced this independently — true); no U1/performance/publication claims anywhere; the `rm -rf` process incident is disclosed; ledger SHAs byte-match the real commits (checked programmatically, not by eye) |

## 4. Findings

| ID | Severity | Finding | User effect / repair |
| --- | --- | --- | --- |
| F-A-01 | **MAJOR** | API-SPEC §2.3 (A-03) ordering example `("2" < "3" < "10")` contradicts the normative code-point/plain-string rule (true order `"10" < "2" < "3"`; programmatically verified). Internal contradiction inside the determinism amendment. | A U1-01 implementer following the example would assert the wrong sorted-payload order. One-line repair required before freeze; everything else in A-03 is correct. |
| F-A-02 | MINOR | Journey fixture under-demonstrates two of its own labeled steps: (a) no edit operation (e.g. finding addition, `capabilityId: inspection.edit`) between revise and submit despite "reject → revise → **edit** → resubmit" in the §10 row, DECISIONS mapping, and the fixture's own note; (b) the "preserved reason" appears only as an activityEntry parenthetical asserting the quote — no activity trail entry contains the reason text. | Normative loop semantics (PROOF-DESIGN/PA) are complete; the gap is fixture-vs-row overstatement. Recommend adding one `inspection.edit` operation and a reason-quoted activityEntry in the repair round (file gets repinned anyway). |
| F-A-03 | MINOR | New negative fixture `ui-document-invalid-expansion-cycle.json` lacks the trailing `"note": "NEGATIVE: … expected UI_DOC_CYCLE"` field that every other negative fixture carries (the F-7 repair convention). | Consistency regression only; the §10 row documents the expected diagnostic. Add the note in the repair round. |
| F-A-04 | NOTE | The A-01 edge enumeration reads as if same-document body→definition instantiation were unexamined (edge class 1 restricted to cross-document). It is harmless — no edge class targets document nodes, so only definition→definition edges can cycle — and slot/portal/repeat/conditional content is covered by the closed definition via §3 authorship-containment, but neither point is stated. | Optional half-sentence ("document nodes cannot sit on cycles; slot/portal/repeat/conditional content belongs to its authoring unit") would make the closure airtight for future readers. Not required for correctness. |
| F-A-05 | NOTE | "Code-point string comparison" leaves UTF-16 code-unit vs Unicode code-point order distinguishable only for astral characters (JS default sort compares code units). ASCII documentIds/revisions are unaffected. | A U1 implementer note (pick code-unit or code-point order explicitly) removes the last ambiguity. Non-blocking. |
| F-A-06 | NOTE | The round's framing "9/11 pack-inventoried files untouched; only CONTRACTS/DECISIONS may diverge among pack files, plus STATE" was true at `54490a8…` (verified) but not at HEAD: the authorized amendment also diverges PRODUCT-ARCHITECTURE and STAGES-AND-VERIFICATION (now 6/11 identical). The repo's own dated round-2 statement is not false; no current artifact misstates fidelity. | The NEW freeze record should enumerate all five diverging pack files (CONTRACTS, DECISIONS, PRODUCT-ARCHITECTURE, STAGES-AND-VERIFICATION, STATE) with their authorized causes instead of reusing the 9/11 framing. |
| F-A-07 | NOTE | No fixture models `decidedAt` in outcome `sets` (the pre-existing approve fixture doesn't either), so "decidedAt cleared on revise" is prose-only; and per the action table reject never sets `decidedAt`, so on the rejection path there is typically nothing to clear — the rule is defensive rather than demonstrable. | Consistent with pre-existing conventions; no new inconsistency introduced. Optional alignment (reject sets `decidedAt`, or drop it from the revise clause) can wait for U1. |

No BLOCKING findings. No authority leakage, no future-data/runtime-proof claims, no silent substitutions, no lost-state-on-reload semantics, reproducible lineage throughout.

## 5. Verdict

**AMENDMENT HELD (repairs needed).**

- A-01: CLOSED WITH NOTES · A-02: CLOSED WITH NOTES · A-03: NOT CLOSED (F-A-01).
- Required repair before freeze: **F-A-01** (one-line ordering-example fix in API-SPEC §2.3). Strongly recommended in the same repair round since both files are repinned anyway: F-A-02 (add the edit operation + reason-quoted activity entry to the journey fixture and/or align the row wording) and F-A-03 (NEGATIVE note on the cycle fixture).
- **New freeze record:** may proceed **only after** the F-A-01 repair (plus, recommended, F-A-02/F-A-03) is committed as a new candidate and re-checked; a freeze at `33ae56f…` as-is would pin a self-contradicting example inside the very clause A-03 was meant to fix. The new record must recompute all pins at the repaired candidate and update the pack-fidelity framing per F-A-06. Post-repair re-review can be scoped to the repair diff; the amendment's substance (A-01/A-02 and A-03's rule/Example D/U1-01) otherwise survived falsification.
- Tested SHA: HEAD `df3d283187c852c39840cc6909ba13605de7a75b` (candidate `33ae56fef98b0f7c467a42f10cd873d08b1f8209`; base `4d2df037d8a82d36c60bf1bff16919650643ce22` verified live against origin).
