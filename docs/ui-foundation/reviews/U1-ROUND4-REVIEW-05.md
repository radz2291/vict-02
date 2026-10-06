# U1 ROUND-4 INDEPENDENT VERIFICATION REPORT — U1 repairs (F1/F2 + directed cases)

- **Verifier**: fresh independent verifier (round 4); did NOT implement the repairs; falsification-only.
- **Tested snapshot (candidate)**: `345b5c62f7eae1d02d7697cdd1abc71b0daeee41` — `git rev-parse HEAD` in worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u1`, branch `codex/ui-foundation-u1`, working tree clean at start and at exit (verified `git status --porcelain` empty).
- **Base**: `97346903e0c1a242b4bab0477c92bc3f34c43c38` — confirmed ancestor of HEAD (`git merge-base --is-ancestor` → yes).
- **origin/main**: `4d2df037d8a82d36c60bf1bff16919650643ce22` — **live-verified via `git ls-remote` twice** (start and end of session) — **UNMOVED**.
- **Remote branch tip** `codex/ui-foundation-u1`: `03810cef573bcc03de92416ab74d5988ec140657` (live `git ls-remote`). The round-4 candidate `345b5c6…` is **not yet pushed — expected** and consistently stated in `docs/ui-foundation/STATE.md` (claim D verified: the current entry says round-3 is *pushed* with live remote tip `03810ce…` matching `git ls-remote`; round-2 entry updated to "subsequently pushed (history)"; no entry claims the round-4 candidate is pushed).

Harness: out-of-repo attacks in `C:/Users/RZ1/Desktop/RZ/u1-round4-falsify/` (vitest config aliases point at the candidate worktree sources; no candidate file was modified). Probe sources archived in `probes/`; attack run log in `evidence/round4-attacks-run.log`.

---

## Claim A — Preservation policy enforced in save, same authority as load → **HELD**

Independent attacks (9/9 PASS, `probes/store-preservation.attack.test.ts`, `evidence/round4-attacks-run.log`):

| # | Attack | Result |
|---|---|---|
| A1 | `future.format` @ seed rev "1": load `invalid`/`overwritable:false` (PRESERVED); save at matching expectation '1' → refused `UI_STORE_CORRUPT`, bytes unchanged | PASS |
| A2 | same payload, save at NON-matching '999' → refused `UI_STORE_CORRUPT` (not `UI_DOC_STALE_REVISION`) — preservation dominates staleness | PASS |
| A3 | `vict.authoring-store@1` without document @ "1": load PRESERVED; save at '1' refused `UI_STORE_CORRUPT`, bytes unchanged | PASS |
| A4 | both preserved classes @ non-seed "12"; save expectations '12' AND '13' → both `UI_STORE_CORRUPT`, bytes intact | PASS |
| A5 | 9 adversarial preserved shapes (null/array/string document, null/absent storedRevision, invalid JSON, top-level array/string/null) → all load `invalid`+`overwritable:false` and save-refused `UI_STORE_CORRUPT` at expectations '1','5','999'; bytes intact | PASS |
| A6 | preserved class with non-numeric bogus revision 'abc', matching expectation 'abc' → still refused `UI_STORE_CORRUPT` | PASS |
| A7 | RETAINED: overwritable (readable envelope + invalid document) replaces successfully at the recorded revision at seed '1' AND non-seed '7'; reload shows loaded @ new revision | PASS |
| A8 | overwritable class + MISMATCHED expectation → `UI_DOC_STALE_REVISION` (correct staleness, not corruption), bytes intact | PASS |
| A9 | seed discipline: empty store saves ONLY at '1'; '5' refused stale; post-save reload loaded | PASS |

Browser journey 1 (real Chrome): PRESERVED banner (`role=alert`) visible before AND after a real, dirty Save click; note `Save FAILED (UI_STORE_CORRUPT): refusing to overwrite preserved data…`; localStorage bytes byte-identical; History shows `Working 1#1 · stored 1 (unsaved)`. Reopen also refused with banner retained (`evidence/r4-j1-preserved-refused.png`, `r4-j1b-reopen-refused.png`). Builder's own new tests (`authoring-persistence.test.ts` round-4 block) cover the owner's exact cases and agree with my independent results.

## Claim B — Save-window ownership → **HELD**

Independent attacks (8/8 PASS, `probes/save-window.attack.test.ts`):

| # | Attack | Result |
|---|---|---|
| B1 | OWNER EXACT SEQUENCE: outer bridge save stages → inside the storage callback: nested `bridge.save()` refused `UI_EDIT_SAVE_IN_PROGRESS` before staging; nested `session.stageSave()` refused before staging; nested `session.save()` refused truthfully; FOREIGN-stage `commitSave` refused `UI_DOC_STALE_REVISION` (window NOT released); nested `bridge.apply` edit refused — zero side effects → outer write succeeds → outer commit SUCCEEDS → acknowledged store revision == editor baseline ('2'=='2'); dirty cleared | PASS |
| B2 | THROWN write: truthful `UI_STORE_WRITE_FAILED`; storedRevision/dirty/undo preserved; window released (editing allowed again); retry lands at '2' | PASS |
| B3 | REFUSED write (`UI_STORE_CORRUPT`): truthful code passthrough; state preserved; immediate retry NOT save-in-progress; retry succeeds | PASS |
| B4 | foreign-stage commit NEVER releases the window: nested stageSave still refused after; the REAL stage still commits (owner identity) | PASS |
| B5 | hand-driven commit refusal after persistence: commit refused `UI_DOC_STALE_REVISION`, NO false ok, baseline not advanced, edit preserved; window held until orchestrator `releaseSaveWindow()`; subsequent `session.save()` truthful | PASS |
| B6 | `session.save()` during a window is refused WITHOUT releasing it (early return before finally); outer stage still commits | PASS |
| B7 | sequential saves: window not leaked, revisions '2'→'3', store == baseline | PASS |
| B8 | forged structurally-identical stage (different identity) cannot commit; window intact; real stage commits | PASS |

Updated pre-existing test cross-checked (`packages/ui/test/edit-session.test.ts` diff): the failed-write-then-save test now explicitly calls `session.releaseSaveWindow()` before `session.save()` with a truthful comment (host save operation ENDED → releases the window; a nested/second save while the window is owned is refused) — this reflects the new contract fairly, not a test-gaming weakening: the refused path genuinely holds the window until orchestrator release (verified by my B4/B5/B6). The three new round-4 session tests (nested stage refused, foreign commit refused + lock intact, refused-commit + finally release) match my independent attack results.

## Claim C — Studio corruption banner cleared ONLY after acknowledged save success → **HELD**

- Banner clear call site is exclusively inside the `outcome.ok` branch of the Save handler (`+page.svelte`: "Cleared ONLY here; a failed save keeps the diagnostic visible").
- Browser evidence: J1 refused save → banner still visible after save (`r4-j1-preserved-refused.png`); J1b refused reopen → banner retained (`r4-j1b-reopen-refused.png`); J2 overwritable replacement → banner cleared on success, "Saved as stored revision 4", stored bytes now a valid envelope (`r4-j2-overwritable-cleared.png`); J3 reload of replaced bytes → no banner (`r4-j3-reload-persisted.png`).

## Claim D — STATE.md wording → **HELD**

Current (latest) entry: round-3 repairs verified, "pushed — live remote tip `03810cef…` (verified via `git ls-remote`, matches local HEAD; findings F1/F2 opened a bounded round-4 repair)". Live-checked: remote tip IS `03810cef…`, which was the round-3 final HEAD (parent of the round-4 candidate). Round-2 entry updated to "subsequently pushed (history)". No statement claims the round-4 candidate is pushed. Consistent.

---

## Probes (1)–(14)

- (1)–(12) Previous twelve probes: **re-verified at SUITE level** at the candidate — full gates below all green (unit 2490/2490 across 127 files includes the U1-01 identity suites, transaction atomicity/idempotency/undo-redo, renderer occurrence tests, preview isolation, adapter discipline; renderer 108/108; integration 4/4; example 33/33). Per the task, suite-level re-verification is acceptable; individual browser journeys were re-driven only for the affected surfaces (probes touching persistence/save/banner → journeys J1–J3 above). Zero console errors in all journeys (the only console item ever observed in an earlier probe run was a benign favicon 404; final run: none).
- (13) Affected browser journeys: PASS with screenshots — PRESERVED refused + banner + bytes intact (`r4-j1-preserved-refused.png`); overwritable replacement accepted + banner cleared (`r4-j2-overwritable-cleared.png`); failed save keeps banner (J1/J1b, `r4-j1b-reopen-refused.png`); reload persistence (`r4-j3-reload-persisted.png`, `r4-j3b-reload-loaded-saved-bytes.png`).
- (14) Regression gates at `345b5c6…` (all from the candidate worktree; logs `gate-*.log` in the falsify dir):
  - `npx vitest run --project unit` → **2490/2490 PASS** (127 files)
  - `npx vitest run --project renderer` → **108/108 PASS**
  - `npx vitest run --project integration` → **4/4 PASS**
  - example suite (`examples/ui-authoring-proof`) → **33/33 PASS** (5 files)
  - `npm run typecheck` → **0 errors**
  - `npm run format:check` → clean
  - `npm run check:ui` → 0 errors, 2 known warnings (the disclosed non-issues)

Browser tooling hygiene: verifier started its own dev server on port 5222 (`--strictPort`), killed it afterwards (listener gone; only OS TIME_WAIT remnants), verified the owner's server on 5199 still listening and untouched; CDP browser on 9222 left running; journeys ran in isolated browser contexts.

## NEW findings (this round)

- **NF-1 (minor, PRE-EXISTING — not a round-4 regression, no gate impact)**: `examples/ui-authoring-proof/src/lib/authoring/store.ts:144` references `compileUiDocument` in a type position (`Parameters<typeof compileUiDocument>[3]`) without importing it. Identical unbound reference exists at round-3 candidate `03810ce…:106` (verified via `git show`), so it is carried, not introduced. It is invisible to the gates because the root tsconfig **excludes `examples/ui-authoring-proof` from typecheck** and svelte-check reports 0 errors. Runtime is unaffected (types stripped). Next check: import the symbol or drop the type alias; consider adding the example to some typecheck surface.
- **NF-2 (note, by-design residual)**: `UiEditSession.releaseSaveWindow()` is public; "orchestrator-only" is a documented convention, not an enforced capability. Harmless through `EditorBridge.save()` (release owned by its `finally`; nested actors can never obtain the in-flight stage object — a forged or foreign stage cannot commit, B8/B4). Recorded so a future hand-driving host knows the window is trust-based.
- **NF-3 (note, by-design residual, documented in-code)**: `EditorBridge.session` exposes the raw session; a store callback could bypass bridge guards and `applyTransaction` mid-window. The commit then truthfully FAILS (no false ok; store ack and baseline deliberately diverge; host must reconcile per the `commitSave` contract) — verified exactly as documented in B5 + bridge-level forced variant. Not a defect; recorded as a known boundary.

No blocking findings. No repair was made to the candidate. No real orders, no publishing, nothing pushed, worktree left clean.

## Not covered (disclosed)

- Literal browser-process restart (mechanism guarantee: localStorage is persistent per origin; full page reloads demonstrated).
- Individual browser journeys for probes 1–12 not affected by this round (suite-level re-verification; per task, acceptable).
- Real-browser demonstration of a storage callback re-entering `bridge.save()` (the studio store never re-enters by itself); covered by unit-level attacks B1/B2/B3/B6 and the builder's bridge-save tests.
- Gates were run once per suite at the candidate; no flake-hunting reruns beyond the attack suite (run twice, 17/17 both times).

## VERDICT

All four repair claims held under independent falsification: 17/17 out-of-repo attacks, 4/4 browser journeys with screenshots, full gate suite green (2490 unit + 108 renderer + 4 integration + 33 example, typecheck/format/check:ui clean), origin/main live-verified unmoved twice, worktree clean on exit, STATE.md consistent.

**U1-ROUND4 GATE: PASS**
