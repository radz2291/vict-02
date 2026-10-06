# U1 REOPEN-ROUND VERIFIER REPORT — independent falsification of candidate 3bd03a5

- **Verifier**: fresh verifier (independent of builder; did not implement the repairs; no repairs made during audit)
- **Date**: 2026-10-06
- **Tested snapshot**: `git rev-parse HEAD` in `C:/Users/RZ1/Desktop/RZ/vict-02-u1` = **`3bd03a5d649c52ac529089f176f7e22b701ee09c`** (branch `codex/ui-foundation-u1`), parent = reopening record `0a398d5`, base `97346903` per record.
- **Live origin/main check**: `git ls-remote origin main` → **`4d2df037d8a82d36c60bf1bff16919650643ce22`** — unmoved, matches the pinned baseline.
- **Working tree on exit**: clean (`git status --porcelain` = 0 entries). No candidate files mutated; all attack work done out-of-repo in `C:/Users/RZ1/Desktop/RZ/u1-reopen-falsify/` (own vitest config aliasing candidate `src/`; own CDP console-sweep script; own vite dev server on 127.0.0.1:5199, killed afterwards, port verified free).

## Gates re-run (all green)

| Gate | Result | Log |
|---|---|---|
| `npx vitest run --project unit` | 127 files / **2475 tests passed** | `u1-reopen-falsify/logs/unit.log` |
| `npx vitest run --project renderer` | 14 files / **108 tests passed** | `logs/renderer.log` |
| `npx vitest run --project integration` | 1 file / **4 tests passed** | `logs/integration.log` |
| example `npx vitest run` | 5 files / **20 tests passed** | `logs/example.log` |
| `npm run typecheck` | 0 errors | `logs/typecheck.log` |
| `npm run format:check` | clean | `logs/format.log` |
| `npm run check:ui` | 0 errors, 2 known warnings | `logs/checkui.log` |

## Claim attacks A–D (source-level, independent read)

- **A (persistence, `examples/ui-authoring-proof/src/lib/authoring/store.ts` + `src/routes/studio/+page.svelte`)**: store is a localStorage-backed `DocumentStorePort`; `rawLoad` returns empty/invalid/loaded explicitly (JSON parse, format tag, document/revision presence, structural validation with product-reference deferral via `isDeferredProductReference`, reachability gate over orphaned nodes); `save` reads the authoritative storedRevision in the same synchronous turn as `setItem` (check-then-set), refuses to clobber corrupt bytes (`UI_STORE_CORRUPT`), throws → `UI_STORE_WRITE_FAILED`. Studio seeds only on empty store; invalid load surfaces a visible `role=alert` banner and never fakes a reopen. **Attack result: held.**
- **B (save acknowledgment, `packages/ui/src/session.ts` + `packages/ui-editor/src/bridge.ts`)**: `stageSave` computes bytes without mutating; `commitSave` is guarded; bridge `save()` = stage → store.write (try/catch) → commit only on store ack; store is the revision authority (`expectedStoredRevision` checked atomically with the write, stale → `UI_DOC_STALE_REVISION` **without writing**); `reopen()` reports `UI_STORE_EMPTY`/`UI_STORE_INVALID` explicitly. **Attack result: held** (see FINDING-2 for a guard-contract gap).
- **C (fencing, `packages/ui-preview/src/session.ts`)**: `#settle` rechecks the token after the configured delay (pre-invocation window retained); `#runCapabilityOp` rechecks `#superseded(token)` after `await invoke(input)` on the success path AND in the catch path before reporting `SIMULATED_FAILURE`; superseded → structured `SESSION_STALE` (`ok:false`), `onStale` fired. **Attack result: held.**
- **D (snapshot immutability)**: `#doubles` copied once in the constructor from `runtime.snapshotDoubles()`; `computeCoverage` and `#runCapabilityOp` both read that same frozen map; `reset()` constructs a new session whose constructor re-snapshots. **Attack result: held.**

## Per-probe verdicts (owner's table 1–12)

| # | Probe | Verdict | Direct evidence |
|---|---|---|---|
| 1 | Edit → save → **full page reload** → saved source AND revision restored (real browser) | **PASS** | Real Chrome on 127.0.0.1:5199/studio: title text edited to 'Approve inspection' via canvas selection + Quick edit; History went `Working 1#1 · stored 1 (unsaved)` → save → `Working 2#2 · stored 2 (saved)`; `location.reload()` → title text still 'Approve inspection', `Working 2#0 · stored 2 (saved)`, no alert. localStorage payload `{"format":"vict.authoring-store@1","document":{...,"revision":"2",...}`. Screenshot: `evidence/probe1-after-reload-1440x900.png` |
| 2 | Reopen after applicable restart for the mechanism | **PASS** | Mechanism guarantee: localStorage is persistent origin storage (survives full reloads, route changes and browser restarts for the origin). Demonstrated in real Chrome: `location.reload()` (probe 1) AND route leave to `/` + reopen `/studio` → 'Approve inspection' + `stored 2 (saved)` retained. (Browser-process kill/relaunch itself not separately performed — stated per instructions; mechanism guarantee given above.) |
| 3 | Rejected storage write: visible failure, working source retained, dirty true, stored revision unchanged | **PASS** | Out-of-repo probes.test.ts: store write fails → `bridge.save()` ok:false; dirty still true; storedRevision still '1'; working doc keeps 'beta'; `canUndo` true; storage bytes untouched (`raw()` null). |
| 4 | Storage write THROWS: same preservation | **PASS** | Throwing port → `UI_STORE_WRITE_FAILED` with thrown message surfaced; snapshot unchanged (dirty true, stored '1', revision '1#1'). |
| 5 | Retry after failed write succeeds at correct next revision | **PASS** | Retry → storedRevision '2', dirty false; persisted payload revision '2' with edited text; undo/redo continuity across the FAILED write verified (undo→'alpha', redo→'beta'). |
| 6 | Two editors at same stored revision: first wins, second rejects without overwrite | **PASS** | A saves → '2'; B (stale, expects '1') → `UI_DOC_STALE_REVISION`; stored bytes remain A's document at revision '2'. Store-side stale rule also verified for empty-store expectation ('7' vs seed → rejected). |
| 7 | Reset during configured latency: SESSION_STALE, current session unchanged | **PASS** | Browser: latency scenario (800 ms), 'Run approve' + scenario reset in the same JS tick → note at t+0.5 s: "SESSION_STALE — The session was reset while this operation was in flight; the result was dropped.", stable at t+2.5 s (no obsolete 'Approved' feedback). Node: fenced `SESSION_STALE`, current session still usable (mutate succeeds, rows update only there). Screenshot: `evidence/probe7-session-stale-1440x900.png` |
| 8 | Reset AFTER async double started: SESSION_STALE after completion, never stale ok:true | **PASS** | Node: deferred double; invoke confirmed started; reset; resolve 'late-result' → result `ok:false SESSION_STALE`, `value` undefined, `onStale` fired; current session untouched. |
| 9 | Async double rejects after reset: structured stale result, no unhandled rejection, no obsolete UI feedback | **PASS** | Node: rejecting deferred double after reset → structured `SESSION_STALE`; `unhandledRejection` listener captured zero events; current session live. |
| 10 | Registry changes during existing session: original implementation kept | **PASS** | Node: double deleted from registry mid-session → coverage still 'available', execution invokes the ORIGINAL double (spy count 1, impl 'old'). |
| 11 | Reset after registry change: new session uses newly captured implementation | **PASS** | Node: registry swapped then `reset()` → new session executes the NEW double (impl 'new'). |
| 12 | Missing required double: denial; real-handler spy untouched | **PASS** | Node: empty registry → `SCENARIO_COVERAGE_MISSING`; real handler (separate spy) never invoked. |

Additional browser checks: corrupt payload (`{corrupted-not-json`) + reload → visible `role=alert`: "Stored authoring data was not usable (stored authoring data is not valid JSON)…" with fresh seed loaded (never a fake reopen) — `evidence/probeA-corruption-alert-1440x900.png`. Console sweep (own CDP script, fresh page) across `/`, `/inspection/i-101?as=supervisor`, `/studio`: **zero console errors/warnings/pageerrors**.

## NEW findings (neither blocks the probed claims)

- **FINDING-1 — minor, PRE-EXISTING at base `0a398d5` (not a regression of `3bd03a5`)**: after a **successful** save, `undo()` is refused with `UI_EDIT_UNDO_CONFLICT`. Cause: the save stamps the working document's `revision` field to the new stored revision; canonical digests exclude nothing, so the undo continuity digest check against the pre-save history entry mismatches. Control: undo before any save succeeds. User effect: in the studio, Undo after Save always fails until reopen (HistoryPanel still shows Undo enabled). Out of scope of the probed claims (which cover continuity across *failed* writes — that holds). Evidence: `u1-reopen-falsify/attacks/repro.test.ts` (F1/F1b); base equivalence: `git show 0a398d5:packages/ui/src/session.ts` (same stamp shape; undo logic unchanged per `git diff 0a398d5..HEAD`).
- **FINDING-2 — minor, introduced with this round's two-phase API**: `UiEditSession.commitSave`'s guard compares only `fromStoredRevision !== storedRevision`; a transaction applied **between `stageSave` and `commitSave`** moves the working session but not the stored revision, so the commit succeeds and silently replaces the working document with the staged bytes (the intervening edit is lost; replay of its requestId is refused with `UI_EDIT_REQUEST_CONFLICT`). This contradicts the docstring "the commit is rejected if the session moved since the stage was computed". Not reachable through `EditorBridge.save()` (stage → store → commit in one synchronous turn) nor through the studio; only hosts hand-driving the two-phase API across turns are exposed. Evidence: `attacks/repro.test.ts` (F2), codified in `attacks/probes.test.ts` ("F2 codified").
- **Informational (not probed)**: `PreviewSession.run()` called on an already-reset session object is not fenced (it captures the post-reset token); results would only touch the dead session's own state. Not reachable via the studio's `reset()` flow.

## Not covered

- Actual browser-process kill/relaunch (probe 2 demonstrated reload + route leave/reopen; mechanism guarantee stated instead).
- Browser-UI drive of probe 8's exact post-await window (studio's latency gate precedes the double invocation; the post-await window was proven at the exported boundary in node with a deferred double).
- uieditor `npm run build` (known pre-existing failure, per instructions), pass-1 environmental root-suite failures (not U1).

## Verdict

All four repair claims (A–D) survived independent falsification; all 12 owner probes pass with direct evidence; all required suites and gates pass; console sweep clean; candidate worktree untouched. The two new findings are minor, non-blocking, and outside the claimed behaviors (one pre-existing, one unreachable through shipped flows).

**U1-REOPEN GATE: PASS**
