# U0 AMENDMENT RE-VERIFICATION — round B (scoped fresh re-verification of round-1 repairs)

Date: 2026-10-06 · Verifier: fresh independent, non-author, non-round-A-reviewer (falsification mode) · Repository: https://github.com/radz2291/vict-02

## 1. Tested identities (all verified live in `C:/Users/RZ1/Desktop/RZ/vict-02-u0`)

| Item | Value | Result |
| --- | --- | --- |
| Tested SHA (HEAD, truth) | `9ec87f3e7eb8eb7793f972111258940aac635346` | verified via `git rev-parse`; tree clean; branch `codex/ui-foundation-u0` |
| Baseline | `4d2df037d8a82d36c60bf1bff16919650643ce22` | live `git ls-remote origin main` = same (unmoved) |
| Ancestry | `4d2df03 → f7767b2 → 6a2f7b9 → 54490a8 → ffbafc0 → a664c70 → 33ae56f → df3d283 → 9ec87f3` | verified via `git rev-list --first-parent`; exact match to prescription |
| Remote branch tip | `a664c70…` | 3 commits behind local HEAD (amendment review + ledger + repairs local-only); **nothing pushed by this verifier** |
| Diff scope `df3d283..HEAD` | exactly 5 files, all under `docs/ui-foundation/**`: `API-SPEC.md`, `DECISIONS-AND-EVIDENCE.md`, `fixtures/ui-document-invalid-expansion-cycle.json`, `fixtures/ui-scenario-valid-revision-loop.json`, `reviews/U0-AMENDMENT-REVIEW-01.md` (new) | conforms to authorized repair scope; no other file touched |
| Preserved round-A report | `docs/ui-foundation/reviews/U0-AMENDMENT-REVIEW-01.md`, SHA-256 `382ff47c2518f4cbc9ca29352e310f3ea973deba7518ab3d1178032e97ba1199` | recomputed at HEAD — byte-exact match to the DECISIONS entry; single-commit history (added in `9ec87f3`, never modified) |
| Superseded freeze record | `FREEZE.json` (repo root) — untouched by repair diff (`git log`: single commit `ffbafc0`); records original candidate `54490a861fcd9992bfc8bfac14178fdb7921ecf0` | all **19 original pins recomputed** against `git cat-file blob 54490a8…:<path>` → **19/19 reproduce** |

This verifier edited no tracked file, pushed nothing, and left the working tree as found.

## 2. Per-repair verification (falsification attempts first)

### F-A-01 (MAJOR — ordering example) — REPAIRED, VERIFIED
- API-SPEC §2.3 comment now reads: "totally ordered by comparing (documentId, revision) as sequences of Unicode code points (equivalent to UTF-8 byte order; deliberately not UTF-16 code-unit order, which differs only for astral characters) — revision order is plain string order, e.g. `"10" < "2" < "3"`, not semantic version order".
- **Programmatic check** (python): `sorted(["2","3","10"])` → `['10','2','3']`; `'10' < '2' < '3'` → True; the old false claim `'2' < '3' < '10'` → False. Tuple sort `('C','1'),('D','1'),('D','10'),('D','2'),('D','3')` confirms lexicographic (documentId, revision) code-point ordering. The stated example is correct.
- **Example D consistency:** "sorts by code-point string comparison, so `D@2` precedes `D@3`" → `'2' < '3'` = True under code-point order. Consistent.
- **No contradicting claim remains:** grep of §2.3/Examples A–D finds ordering text only in the new comment and Example D; both agree. CONTRACTS line 25 ("totally ordered by code-point string comparison on (documentId, revision); permutation and duplicate identical entries do not change applicationVersion") is consistent. No contradiction anywhere.
- Attempted break: searched for any residual numeric/natural-order phrasing or reverse example in the diff and surrounding contract files — none found.

### F-A-04 (NOTE — document-node cycle impossibility) — REPAIRED, VERIFIED
- New §2.2 sentences: every expansion edge points **at a definition** (document→definition for a tree-level instance; definition→definition for an instantiation); no edge ever points at a document; cycles can therefore occur only among definitions and a document node can never sit on one; containment edges inside a source unit (slot fillings, repeat templates, conditional branches, portal children and descendants) never cross units at all.
- **Consistency with §2.2 rule set:** the two-class closed edge enumeration (cross-document component expansion; definition-level instantiation) has both classes targeting definition nodes — the new sentence is a faithful closure statement, and the logical inference (a cycle requires an incoming edge on every member; documents have none) holds.
- **Consistency with §3 vocabulary:** slot/conditional/portal children are `NodeId[]` inside the same document's `nodes` map; component/definition bodies are authored in their owning document; §3 states instances "never acquire multiple source parents" and containment is acyclic (`UI_DOC_CYCLE`). Containment is intra-document/intra-unit by construction — "never cross units" is correct. Cross-document composition occurs only via expansion edges, which are covered, not containment.
- Attempted break: looked for an expansion edge that could point at a document node or a containment edge that could cross units (portal targets are declared overlay references, not expansion edges) — none exists.

### F-A-05 (NOTE — UTF-16 ambiguity) — REPAIRED, PARENTHETICAL TECHNICALLY CORRECT
- **UTF-8 equivalence:** UTF-8 byte order == Unicode code-point order verified over 20,000 random code-point pairs (0 mismatches; design property of UTF-8).
- **"differs only for astral characters":** exhaustive pairwise check over representative BMP (U+0041, U+005A, U+00E9, U+0100, U+D7FF, U+E000, U+FFFD) and astral (U+10000, U+1F600, U+10FFFF) code points, comparing UTF-16 code units numerically (big-endian byte comparison): 12 differing pairs, **all involve an astral character**; zero BMP-vs-BMP differences. Concrete case: U+1F600 vs U+FFFD — code-point order False, code-unit order True. The parenthetical is accurate.

### F-A-02 (MINOR — journey fixture under-demonstration) — REPAIRED, VERIFIED
- `ui-scenario-valid-revision-loop.json` operations now: `inspection.reject` → `inspection.revise` → `finding.add` → `inspection.submit`.
- **Reason quoting:** the revise activityEntry now contains the literal text `(prior reason quoted: "Seal wear beyond tolerance")`, which matches the reject step's `sets.rejectionReason` and the seed finding description — an activity-trail entry now contains the reason text (F-A-02b closed).
- **Edit between revise and submit:** the `finding.add` step is the edit. Verified it is a **declared PROOF-DESIGN action** ("`finding.add` | `qlt.inspection.edit` (technician) | append finding to a draft/submitted inspection; write"); actor `act-t1` holds `qlt.inspection.edit`; the record is `draft` post-revise, which qualifies as a finding.add target (F-A-02a closed).
- **Schema/conventions:** field set and shapes match `ui-scenario-valid.json` exactly (`vict.ui-scenario@1`, scenarioId, references, seeds {domain, random, clock}, actors/permissions, operations `{op{capabilityId}, implementation, outcome{kind, sets?, activityEntry}}`, resetBoundary, note). An operation without `sets` is pre-existing convention (the `dataOp` outcomes in the valid fixture omit `sets`).
- **Prettier-clean:** `npx prettier --check "docs/ui-foundation/fixtures/*.json"` → all files clean (exit 0).
- Fixture note updated coherently ("the finding.add step is the permitted edit on the revised draft"); §10 row ("reject → revise → edit → resubmit … incl. preserved reason") is now accurate against the fixture bytes.

### F-A-03 (MINOR — NEGATIVE note convention) — REPAIRED, VERIFIED
- `ui-document-invalid-expansion-cycle.json` now carries: `"note": "NEGATIVE: definitions def.a and def.b instantiate each other -> definition-level expansion cycle, expected UI_DOC_CYCLE (path def.a -> def.b -> def.a); all node IDs and component references resolve, so this is the ONLY defect"`.
- **Path verified against the graph:** `badge`→`def.a`; `def.a`'s `a-root`→`def.b`; `def.b`'s `b-root`→`def.a` → cycle `def.a → def.b → def.a`. Expected code `UI_DOC_CYCLE` matches the §7 catalog payload (`documentId, path: string[]`).
- **"Only defect" claim audited:** node IDs unique (`screen`, `badge`, `a-root`, `b-root`); root resolves; all `definitionId` references resolve; `styleSources`/`tokens`/`conditions`/`assets`/`localState` empty; §3 `UiDocument` field set complete and convention-identical to the reviewed valid document. No second defect introduced.

## 3. Regression results (at HEAD `9ec87f3`)

| Check | Result |
| --- | --- |
| DECISIONS round-1 entry truthfulness | PASS — verdict "AMENDMENT HELD (repairs needed)"; A-01/A-02 CLOSED WITH NOTES, A-03 NOT CLOSED pending F-A-01 — matches preserved review §5 verbatim in substance; disposition table severities/prescriptions match the review (F-A-01 MAJOR repaired, F-A-02/F-A-03 MINOR repaired, F-A-04/F-A-05 NOTE repaired, F-A-06 accepted with freeze-record obligation, F-A-07 retained); preserved-report SHA-256 recomputed byte-exact; "scoped fresh re-verification precedes the new freeze record (per the reviewer's own prescription)" — truthful, this document is that re-verification |
| SHA hygiene | PASS — programmatic sweep of all 40-hex strings in DECISIONS + preserved review against real commit SHAs: 0 typos, 0 unknowns; all three prior report hashes (U0-REVIEW-01 `456e910a…`, U0-REVIEW-02 `1a5fc648…`, U0-FREEZE-CHECK-01 `43fcaa62…`) recomputed at HEAD — all match |
| §7 catalog | PASS — 28 diagnostic rows, byte-identical to `df3d283` (diff of extracted §7 sections: identical) |
| Diagnostic orphan sweep | PASS — zero live orphan references; the single sweep hit (`UI_DOC_PRESENTATION_MODE_INVALID`) is a historical mention inside preserved `U0-REVIEW-02` that itself documents the rename to `UI_APP_PRESENTATION_MODE_INVALID` — historical evidence, not a live diagnostic reference |
| Fixture table | PASS — 13 §10 rows ↔ 13 fixture files, names exact |
| U0-01..U0-07 | PASS (scope-level) — STAGES-AND-VERIFICATION.md not touched by `df3d283..HEAD`; the dimensions this diff touches (§2/§2.2/§2.3 canonical source content, fixture conventions, §10 table) re-verified above with no drift |
| No U1/perf/publication claims | PASS — every U1/performance/publish grep hit in the diff is inside the preserved round-A review's audit prose (describing and negating such claims); no new normative claim added |
| STATE.md | PASS — untouched by the diff; still says amended candidate `33ae56f…` awaiting fresh independent review, next = review → repairs if needed → new freeze record → separate fresh checker → push; U1 remains unauthorized (see observation O-1) |
| FREEZE.json / original pins | PASS — untouched (single-commit history `ffbafc0`); 19/19 original pins reproduce against `54490a8…` |
| Prettier | PASS — `npx prettier --check "docs/ui-foundation/fixtures/*.json"` exit 0 |
| npm typecheck | PASS — `npm run typecheck` exit 0 (spot check; no build-affecting file changed since `df3d283`) |
| U0-08 | NOT EVALUATED by design — belongs to the new freeze record + separate fresh checker |

## 4. Findings

| ID | Severity | Finding | User effect |
| --- | --- | --- | --- |
| O-1 | NOTE (process, non-blocking) | STATE.md's opening state is one round behind reality: it still describes "awaiting fresh independent review" of `33ae56f…` and does not yet record the round-A HELD verdict or these repairs. This is per the audited scope (STATE was not in the authorized repair diff) and the repo's own update discipline (opening state is updated with the next record). | None now — but the **new freeze record commit MUST** update STATE.md to the round-A verdict + repairs + new candidate, recompute all pins at `9ec87f3…`, and honor F-A-06 by enumerating all diverging pack files (CONTRACTS, DECISIONS, PRODUCT-ARCHITECTURE, STAGES-AND-VERIFICATION, STATE) with authorized causes, instead of the superseded 9/11 framing. |
| O-2 | NOTE (inherited, accepted) | F-A-06 (pack-fidelity framing) and F-A-07 (`decidedAt` not fixture-modeled) remain open **by design** — accepted/retained in round A; both are U1-safe and impose no repair obligation on this candidate. | None. |

No MAJOR or MINOR findings. No repair regression found: every attempted falsification (wrong-order example resurrection, contradictory ordering claim, expansion edge pointing at a document, containment crossing units, UTF-16 parenthetical error, missing/incorrect fixture steps, undisclosed hash or SHA drift, catalog drift, silent U1/publication claims) failed to break the candidate.

## 5. Verdict

**REPAIRS VERIFIED — READY TO FREEZE.**

- F-A-01 repaired and programmatically verified (example now `"10" < "2" < "3"`; Example D consistent; no contradicting claim). F-A-02 repaired (reject → revise → finding.add → submit; reason quoted in the activity trail; declared action). F-A-03 repaired (NEGATIVE note with expected `UI_DOC_CYCLE` and the `def.a → def.b → def.a` path; single-defect claim audited). F-A-04 repaired (closure sentences consistent with §2.2/§3). F-A-05 repaired (parenthetical verified technically correct).
- All regression checks pass; DECISIONS round-1 entry truthful including the preserved report hash; superseded freeze intact (19/19 pins reproduce); scope clean; checks clean.
- **The new freeze record may proceed** — provided it (a) pins at candidate `9ec87f3e7eb8eb7793f972111258940aac635346`, (b) updates STATE.md per O-1, and (c) enumerates pack fidelity per F-A-06 — followed by the separate fresh freeze checker before any push, per the standing process.

Tested SHA: HEAD `9ec87f3e7eb8eb7793f972111258940aac635346` (repair-diff base `df3d283187c852c39840cc6909ba13605de7a75b`; audited candidate lineage anchored at base `4d2df037d8a82d36c60bf1bff16919650643ce22`, verified live against origin).
