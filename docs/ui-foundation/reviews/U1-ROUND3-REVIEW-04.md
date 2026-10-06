# U1 Round-3 Independent Verification — Repairs on `codex/ui-foundation-u1`

**Verifier:** independent round-3 verifier (not the builder). Adversarial re-check of the three owner-directed repairs; no repairs made by this verifier.
**Date:** 2026-10-06 (round 3)

## Tested snapshot

| Item | SHA | Live-verified |
|---|---|---|
| Candidate HEAD (worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u1`, branch `codex/ui-foundation-u1`) | `c1e3d0fec930a2a11341181061d537f16ec065ab` | `git rev-parse HEAD` ✓ (worktree clean at exit; only verifier temp specs were briefly added and removed) |
| Reopening record | `ba29828` | present in history ✓ |
| Base | `97346903e0c1a242b4bab0477c92bc3f34c43c38` | `git merge-base` confirms it is the ancestor of the candidate ✓ |
| `origin/main` | `4d2df037d8a82d36c60bf1bff16919650643ce22` | `git ls-remote origin refs/heads/main` — **live, unmoved** (checked twice, start and end of run) ✓ |

Round-2 candidate `3bd03a5d` and its `'U1-REOPEN GATE: PASS'` verdict remain preserved history (not re-certified here).

## Gates run (all in `vict-02-u1`, logs in `C:/Users/RZ1/Desktop/RZ/u1-round3-falsify/logs/`)

| Gate | Result |
|---|---|
| `npx vitest run --project unit` | **2483 passed** (127 files), EXIT 0 |
| `npx vitest run --project renderer` | **108 passed**, EXIT 0 |
| `npx vitest run --project integration` | **4 passed**, EXIT 0 |
| example suite (`examples/ui-authoring-proof`) | **28 passed**, EXIT 0 |
| `npm run typecheck` | 0 errors, EXIT 0 |
| `npm run format:check` | clean, EXIT 0 |
| `npm run check:ui` | **0 errors, 2 warnings** (the 2 known svelte-check a11y warnings), EXIT 0 |

All suite logs were re-verified to have actually run inside `vict-02-u1` (an initial precedence mistake ran four suites in the wrong tree; they were re-run pinned and are the numbers above).

## Claim A — History across successful saves (`packages/ui/src/session.ts`)

**Package-level attack battery (14 verifier-written tests, run against the candidate; spec preserved at `u1-round3-falsify/falsify-AB.spec.ts`): 14/14 PASS.**

- A1 edit→save→undo→redo: undo and redo both accepted across the saved boundary; dirty/ID/redo-state correct after each step.
- A2 edit→undo→save→redo: redo survives the save; the redo'd state then saves cleanly at the next revision (`2`→`3`), dirty false.
- A3 two edits crossing a saved boundary: undo×2 to pre-history, redo×2 forward, final save persists the top of history.
- A4 repeated saves: continuity intact, revision progression `1`→`2`→`3`, root/IDs/nodes intact.
- A5 session-level: `commitSave` leaves `canUndo` true and undo works; divergent-working conflict still refuses (stale expected revision rejected; undo refuses when the working document genuinely diverges in content).
- `historyIdentity` normalizes only the document-level `revision` stamp; `contentDigest` (canonical application identity) untouched — verified by reading the diff and by the divergence refusals above.

**Browser journey (13): PASS.** Real browser (vite 5222, CDP): select → quick edit (Working 1#1 unsaved) → Save (Working 2#2 · stored 2 (saved), envelope in localStorage) → Undo (2#3, unsaved — accepted across the save boundary) → Redo (2#4, saved) → zero conflict diagnostics at every step. Evidence: `evidence/j13-1` … `j13-4`.

**Claim A holds.**

## Claim B — Staged-commit preservation (`packages/ui` session + `packages/ui-editor/bridge.ts`)

**Package-level attacks (same battery): 9/9 PASS.**

- B1 stage from ANOTHER session → commit refused (`UI_DOC_STALE_REVISION`), target session untouched.
- B2 superseded stage (newer stage exists) → old stage refused; newest stage commits.
- B3 double commit → second refused (stored-revision move guard).
- B4 intervening edit between stage and commit → commit REFUSED, message says "preserved"; edit still in working document; storedRevision unchanged; still dirty; retry stages at the correct next revision (`2`) and commits the late edit.
- B5 SYNCHRONOUS reentrancy through the injected `DocumentStorePort.save()` callback: `apply`, `undo`, `redo` all refused inside the window with `UI_EDIT_SAVE_IN_PROGRESS`; outer save still commits; flag reset verified (edits work again); re-entrant edit never landed.
- B6 thrown write: truthful `UI_STORE_WRITE_FAILED`, nothing lost (content/dirty/storedRevision/undo continuity), flag reset on the throw path (try/finally verified), retry lands at `2` (correct next revision, no double-advance).
- B7 rejected (non-thrown) write: same preservation; retry OK.
- B8 two stale editors over one store: loser refused `UI_DOC_STALE_REVISION`, loser's edits kept, winner's bytes intact.
- B9 nested `save()` re-entered from the store callback: no exception, no lost state; inner save persisted, outer commit truthfully refused (ownership guard), session remains consistent and a subsequent save works. (Verifier's first B9 draft had a runaway-recursion bug of its own; the corrected probe passes.)

**Browser: stale-editor fencing re-driven live** (two tabs, one origin): editor X saves 5→6; stale editor Y (baseline 5) attempts a real content change and save → visible truthful diagnostic `UI_DOC_STALE_REVISION: stored revision is 6, editor expected 5. Your unsaved edits are kept`; localStorage still holds X's revision 6; Y keeps its edit (unsaved). Evidence: `evidence/j13-6-stale-editor-refused.png`.

**Claim B holds.**

## Claim C — Load diagnostics (`examples/ui-authoring-proof` store + studio banner)

**Package-level battery (10 verifier-written tests; spec preserved at `u1-round3-falsify/falsify-C.spec.ts`): 9/10 PASS, 1 gap confirmed (F1 below).**

- C1 invalid JSON → `status: invalid`, `overwritable: false`; `save()` refuses `UI_STORE_CORRUPT`; raw bytes byte-identical after the refused save. PASS
- C2 unsupported schema → invalid, `overwritable: true` with recorded revision; save at the recorded revision REPLACES. PASS
- C3 missing/null/non-record node registry (5 variants) → invalid with message, never throws. PASS
- C4 empty document (`nodes: {}`) → invalid ("empty"). PASS
- C5 null / non-record / kind-less nodes → invalid ("malformed (missing kind)"). PASS
- C6 malformed child-branch structures (children number/array-of-non-strings/non-array root children) → invalid, never throws. PASS
- C7 missing readable stored revision → `overwritable: false`; save refuses `UI_STORE_CORRUPT`. PASS
- C8 non-record JSON payload (array) → invalid, `overwritable: false`. PASS
- C9 **GAP CONFIRMED** — see New findings F1. FAIL (of the stricter truthful-classification reading)
- C10 readable-envelope-invalid-document baselined at the RECORDED revision → replacement save accepted, reload clean. PASS

**Browser journey (14): PASS with findings.**
- Class "unreadable": injected broken bytes → reload → **zero console errors / uncaught exceptions / log errors** (CDP Runtime+Log monitor during reload); visible `role=alert`: "unreadable and has been PRESERVED … a save will fail until the stored data is cleared"; NO false restoration (fresh seed Working 1#0 · stored 1); edit + Save → visible `UI_STORE_CORRUPT` refusal ("Your unsaved edits are kept"); bytes byte-identical. Evidence: `j14-1`, `j14-2`.
- Class "readable envelope, invalid document": injected `{format ok, nodes:{}, storedRevision:"4"}` → reload → zero exceptions; banner: "was not usable (stored document is empty (no nodes)). A fresh seed document was loaded; the next successful save replaces the stored data."; editor baselined at the RECORDED revision (**Working 4#0 · stored 4** — the round-2 bug seeded at 1 and the replacement save would have been stale-refused); real edit + Save → **accepted, stored 4→5, 32 nodes**, fresh-session reload persists it. Evidence: `j14-3`, `j14-4`.

**Claim C holds on every class the claim names; F1/F2 are narrower gaps (below).**

## Prior twelve probes (round-2 set) — status this round

1. **Persistence reload journey** — re-driven in real browser: edit→save→full reload→fresh session at stored revision with persisted content, history cleared. PASS (`j13-5`).
2. **Restart-mechanism statement** — durability re-verified across full page reloads and localStorage persistence semantics; a literal browser-process restart was NOT performed (time cap; localStorage durability is the stated mechanism).
3. **Rejected/thrown writes** — re-attacked at package level (B6/B7). PASS.
4. **Retry after failure** — re-attacked (B6): lands at the correct next revision, no double-advance. PASS.
5. **Two stale editors** — re-driven in the real browser (above). PASS (`j13-6`).
6–12. **Reset-during-latency, reset-after-double-started, rejecting-double-after-reset, registry immutability, reset-after-registry-change, missing double, save-acknowledgment set** — covered by the green suites that contain their regression tests (unit 2483 incl. `bridge-save.test.ts`/`edit-session.test.ts`, renderer 108, example 28); NOT individually re-driven as browser journeys this round (cap). No regression signal observed.

## New findings (verifier-originated; nothing repaired)

- **F1 (minor, non-blocking): wrong-format envelope with readable `storedRevision` is mis-classified for overwrite refusal.** `rawLoad` returns `overwritable: false` (banner: "PRESERVED … a save will fail until cleared") for a payload whose `format` ≠ `vict.authoring-store@1`, but `store.save()`'s authoritative check verifies only the readable `storedRevision`, never the envelope format — a save with the matching expected revision is ACCEPTED and replaces the "preserved" bytes (C9 probe, reproducible). User effect: in a multi-tab scenario an editor holding a matching baseline can overwrite bytes the banner called preserved. Not reachable through the single-studio flow (on invalid load no editor is baselined at that revision; the app's seed baseline `1` is stale-refused). The classes the claim explicitly names (invalid JSON, missing revision, readable-envelope-invalid-doc) are all truthful.
- **F2 (minor, non-blocking): startup corruption banner outlives its fix.** After the replacement save succeeds (stored 4→5), the "stored data was not usable…" `role=alert` remains visible until "Reload stored" is used; `storeDiagnostic` is not cleared on save success. The banner's *claim* ("next successful save replaces") was true, but the stale warning can mislead a user into thinking the save failed.

Severity for both: minor. Neither falsifies a behavior claimed by the three repairs; neither loses user data. Both are candidates for a future bounded round, not gate blockers.

## Explicitly NOT covered

- Literal browser-process restart (probe 2's strictest reading) — reload-level durability verified instead.
- Probes 6–12 not re-driven as individual browser journeys this round (suite-verified only, listed above).
- `ui-editor` `build` script .svelte failure — known non-issue (pre-existing, exports→src), not re-run.
- Performance/latency budgets, product-reference diagnostics deferral, and any Stage-9 concerns — out of scope for U1 round 3.

## Verdict

All three directed repairs held under adversarial attack at package level and in the real browser; the full standard gate set is green on the pinned snapshot; the two new findings are minor and non-blocking.

**U1-ROUND3 GATE: PASS**

— with non-blocking findings F1, F2 recorded above.
