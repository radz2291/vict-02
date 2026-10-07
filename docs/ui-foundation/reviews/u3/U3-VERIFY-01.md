# U3 INDEPENDENT VERIFICATION — u3-VERIFY-01

- **Verifier**: fresh independent verifier (no implementation role in this candidate; falsification-only; no repairs performed)
- **Candidate (tested SHA)**: `cbb3fb6584226c48633a2f3d21bccee674ce59c0` (branch `codex/ui-foundation-u3`, local-only, unpushed — as briefed)
- **Worktree**: `C:/Users/RZ1/Desktop/RZ/vict-02-u3-verify` (detached HEAD at the pin; tree clean before and after verification; the only file I created in the worktree is this report)
- **Entry parent**: `a8379110e378357c3732fd051a3f327d897a018c` (U2 closure records)
- **Authority**: frozen amended U0 `9ec87f3e7eb8eb7793f972111258940aac635346` — `git show 9ec87f3e:docs/ui-foundation/STAGES-AND-VERIFICATION.md` §5 (U3-01…08), same commit's `PROOF-DESIGN.md` §1–2, `API-SPEC.md` §6.2/§7/§10; implementation-side claims `U3-COVERAGE.md`, `U3-PERFORMANCE.json`, `U3-WALKTHROUGH.md`, `U3-HANDOFF.md` (status: implemented)
- **Verdict**: **U3 GATE: PASS WITH NON-BLOCKING FINDINGS** (1 minor, 3 notes; details below)

---

## 0. Environment integrity (verified before any evidence was trusted)

The brief disclosed that `node_modules/@victframework/*` are **junctions into the builder's worktree** `C:/Users/RZ1/Desktop/RZ/vict-02-u3`. I therefore proved the executed bytes equal the pinned bytes before accepting any result:

1. Builder worktree: `git rev-parse HEAD` = `cbb3fb6…`, `git status --short` empty (clean), branch `codex/ui-foundation-u3`. Re-verified unchanged at the end of verification.
2. Full recursive tree diff `diff -rq vict-02-u3 vict-02-u3-verify` (excluding node_modules/.git/build artifacts): **exit 0 — byte-identical**.
3. `packages/ui-preview` (the only workspace package touched by the U3 diff) `dist/` ≡ a **fresh `tsc -p tsconfig.json` compile** of the pinned `src/` (only sourcemap noise differs). The stale-mtime scare (`dist/session.js` 12:21 vs `src/session.ts` 12:28) was disproven by content: the dist contains the `dataAdapter` port, adapter dispatch and `SESSION_STALE` fencing.
4. Builder tree re-checked at report time: still `cbb3fb6…`, clean.

Environment: Windows 11, Node v22.13.1, Chrome 154 (`C:/Program Files/Google/Chrome/Application/chrome.exe`), puppeteer-core 24.43.1; my ports dev **5212** (`npx vite dev --port 5212 --strictPort`, bound `[::1]`), production **5213** (`npm run build` + `node build`, `U3_DURABLE_DB` set). `U3_DURABLE_DB=C:/Users/RZ1/AppData/Local/Temp/u3-verify-durable/…` (my own scratch files; the candidate tree untouched).

## 1. Battery (exact numbers)

| Command | Claimed | My result | Verdict |
| --- | --- | --- | --- |
| `npm run typecheck` (root) | clean | exit 0 | PASS |
| `npm run check:ui` | 0 / 2 known | exit 0, 0 errors | PASS |
| `npm run format:check` | clean | exit 0 | PASS |
| `npx vitest run --project unit` | 2499 | 2493 passed / **4 failed** / 2 skipped — all 4 are `ERR_MODULE_NOT_FOUND` for `packages/server|store-sqlite/dist/...` spawned by repo-root-relative worker paths, i.e. my fresh checkout has no local `dist`. Re-ran exactly those 2 files at the same pinned bytes where dist exists (`vict-02-u3`): **10/10 PASS** → full unit effectively 2499 green | PASS (environment artifact, see N-2) |
| `npx vitest run --project renderer` | 125 | 125/125 | PASS |
| `npx vitest run --project integration` | 4 | 4/4 | PASS |
| authoring-proof `npx vitest run` | 66 | 66/66 (9 files) | PASS |
| authoring `npx svelte-check` | 0 errors / 2 known warnings | 0 errors, 2 warnings — both the known `a11y_click_events_have_key_events`/`a11y_no_static_element_interactions` pair in `RenderNode.svelte` | PASS |
| design vitest | 12 | 12/12 | PASS |
| design `npm run typecheck` + `npm run build` | clean | exit 0 / exit 0 | PASS |
| authoring production build (`npm run build`) | clean | exit 0 | PASS |
| `npx tsx test/measure-u3.ts` (reproduced twice) | edit p95 ≤100 ms, reset p95 ≤1000 ms | **edit 0.14 ms, scenario reset 0.11 ms, preview reset 0.24 ms, durable write 3.67 ms** (claimed: 0.2 / 0.16 / 0.33 / 7.95) — same magnitudes, comfortably within budgets | PASS |

## 2. Per-criterion verdicts

| ID | Criterion (frozen §5) | Verdict | My evidence (all runs are mine; manager artifacts used only for comparison) |
| --- | --- | --- | --- |
| U3-01 | Journey incl. full rejection loop, real browser, 3 sizes + 480 px container | **PASS** | Own puppeteer journey on dev 5212: queue → detail (findings/evidence/activity) → approve → queue refresh; reject with **mandatory reason** (button disabled while empty, enables with text); technician `revise` (rejected→draft, `decidedAt`/`rejectionReason` cleared, reason **quoted verbatim in trail**); finding + evidence corrections; resubmit; **stale "old paperwork" approve from a pre-loaded supervisor tab → DOMAIN_CONFLICT carrying expected+actual**, then fresh approve against the new revision → approved. 48/50 journey checks pass; both FAILs resolved as harness artifacts (J10, S1 — see §3/§4). Screenshots: `shots/v-j01…v-j14`, `v-s01…v-s10` (1440×900 / 1024×768 / 390×844 queue+detail; `/scenarios` at all four + 480 px container proof `v-s10-console-container480.png`). No horizontal clipping at 390 px. UI-only bypass attacks refused (§4). |
| U3-02 | Eight frozen scenarios, reproducibly reset | **PASS** | Declaration-level probe vs frozen PROOF-DESIGN §2: exact id set, `vict.ui-scenario@1`, `resetBoundary:'session'`, per-scenario seeds (normal 3 submitted + findings/evidence; empty zero; long 1×40 findings with >100-char unbroken strings), latency `delayMs:800`, failure/denied outcomes, missing `unavailable`, conflict input `rev-1`, denied probe acts as technician, two actors with exactly the frozen role grants (probe B1–B8, 109/109 run `probe-u3.out`). Console: denied→OPERATION_DENIED, failure→SIMULATED_FAILURE, conflict→DOMAIN_CONFLICT, missing→disabled+unavailable, latency fencing→SESSION_STALE; reset deterministic — coverage table byte-identical after run+reset (S7); three reseeds produce identical rows (C2). |
| U3-03 | Domain correctness at runtime; no UI-only authorization | **PASS** | Probe section A run against **BOTH** simulated and durable adapters through `createInspectionServer`: technician approve → `DATA_UNAUTHORIZED` (state unchanged); approve on draft → `DATA_INVALID_INPUT`; blank rejection reason → `DATA_INVALID_INPUT`; revise by non-assigned technician → `DATA_UNAUTHORIZED`; stale `expectedDomainRevision` → `DOMAIN_CONFLICT` with expected+actual in the message, state unchanged; same-key identical replay → `DATA_IDEMPOTENT_REPLAY`; same key different payload → `DATA_IDEMPOTENCY_CONFLICT`; `finding.add` to approved → refused with zero mutation; unknown id → refused with zero mutation. Deep state snapshots (all four tables) compared before/after every failure — **no partial mutation anywhere**. Grants come from the role map at the server boundary; the UI cannot grant (`?as=` selects the demo actor; the adapter enforces). |
| U3-04 | Scenario identity, cache/seed reset coherence, fencing | **PASS** | Reset creates a NEW session identity (C2); deterministic reseed identical across three runs (C2); `session.coverage` snapshot stable within a session (C3); latency approve reset mid-flight → `SESSION_STALE`, late result never lands, fresh session's adapter untouched (C4; console demo S6); `missing` scenario → `SCENARIO_COVERAGE_MISSING` with **ZERO adapter invocations** verified through a counting proxy adapter (C5). Product-boundary generation fencing additionally exercised (server `SESSION_STALE` on reset-in-flight). |
| U3-05 | Durable replacement: same action id/contracts, digests unchanged, real restart | **PASS** | (a) Same action id and compatible input/output contracts through BOTH implementations via `createInspectionServer` — identical output row shape and scalar content (probe E2–E4); canonical UI document digest identical and the UI never branches on mode (mode label is server data). (b) Durable runs through the declared adapter boundary: `InspectionDurableAdapter` implements `ApplicationDataAdapter`; a mode switch rebuilds `createInspectionServer` around the durable adapter (code-verified) — and behavioral: my probes drove both through the same dispatcher. (c) Pragmas on disk: `journal_mode=wal`, `synchronous=2 (FULL)`, `foreign_keys=1`, `busy_timeout=5000`. (d) **REAL RESTART**: production build + `node build` on 5213 with `U3_DURABLE_DB=…\restart-proof.sqlite`; durable approve of i-103 via the real UI (mode strip truthful); FORCE-KILL (`taskkill /F /PID 33444`; port dead; curl 000; file hashes byte-unchanged: `d872a52e…`, `ce1913db…`, `eef5f53d…`); direct `node:sqlite` read of the file shows `i-103 approved rev 2` with the approval activity row **while no server runs**; fresh process (PID 39736) + fresh browser: **recovery from the file** — durable queue shows Fire shutter approved, detail shows the pre-kill trail incl. `Inspection approved` (V2/V3 + screenshots). Negative control: simulated mode after restart shows the fresh seed (`Fire shutter … submitted`) — the simulated implementation never claims to remember (V1, V8). Post-restart adversarials: stale approve → `DOMAIN_CONFLICT` (expected 1, actual 2, state unchanged), approve-on-approved → `DATA_INVALID_INPUT`, keyed replay → `DATA_IDEMPOTENT_REPLAY` (V5–V7). |
| U3-06 | Shared conformance over BOTH adapters, same fixture | **PASS** | I re-ran `runApplicationDataAdapterSuite` (from `@victframework/application/testing`) myself over the SAME evidence-resource fixture against the simulated AND the durable adapter (fresh DB per create; parent rows for referential integrity): both green (probe D1/D2). The candidate's `test/durable-adapter.test.ts` claims are reproduced within the 66/66 authoring run. Failure behavior observable: declared failure outcome leaves domain state unchanged; activity trail records attempts (S3, A-section). |
| U3-07 | Honest coverage; no readiness label | **PASS** | Coverage matrix rendered from `session.coverage` (cannot drift from the declaration); per-op modes verified against declarations (probe B3/B4); `missing` → `unavailable` + disabled control (S5). Mode strip on the queue switches truthfully between `simulated` and `durable-local` and matches the executing adapter (behaviorally confirmed: simulated forgets, durable remembers). Grepped page text (dev AND production serving): the ONLY occurrence of "production" anywhere is the mandatory disclaimer "This application is a proof; no operation here is production-ready" (queue: 0 occurrences). No readiness claim exists. |
| U3-08 | Experience; negative-state UX coherent | **PASS** | Followed `U3-WALKTHROUGH.md` nearly verbatim in a real browser: every step behaved as written (approve; reject with disabled-until-reason; revise as technician with reason preserved in trail; corrections; resubmit; stale-then-fresh decision; console "say no" sequence; durable restart with honest simulated contrast). Dedicated clean console sweep (fresh page: queue → detail supervisor → detail technician → scenarios): **zero console errors/warnings/pageerrors** (NF-2 favicon 404 is gone). Negative states are explicit and recoverable. One coherence wart retained as F-1 below (does not block: every negative is honestly surfaced and state-safe). |

## 3. The two journey FAILs in `journey-results.json` — resolution

1. **"J10 fresh approve against new revision succeeds" — HARNESS ARTIFACT, not a candidate defect.**
   My original harness reloaded the detail page while still `?as=technician` (technician correctly has no approve control on a submitted inspection), so the click hit nothing. Resolution evidence:
   - `u3-j10-verbose.mjs` (API-GET-then-approve): full loop reject(rev3) → revise(rev4, `rejectionReason:null`) → finding.add → submit(rev5) → **API GET reads domainRevision=5** → approve with rev-1 → `422 DOMAIN_CONFLICT "expected domain revision 4, actual 5. State unchanged."` (state unchanged) → approve with exactly 5 → `200 approved rev 6`; trail holds all six entries. VERDICT line printed: PASS.
   - `u3-j10-fix.mjs` (browser, supervisor view): Approve click on the resubmitted record → status `approved`. PASS.
   - Manager sequencing comparison: `reviews/u3/evidence/harness/journey-probe.mjs` runs the same reject→revise→correct→resubmit→approve chain and asserts `approved after resubmission` — consistent with my resolution.
2. **"S1 console production mention is only a disclaimer" — HARNESS-RULE ARTIFACT; re-assessed as PASS-with-note.**
   The rule (frozen U3-07 + U3-COVERAGE) requires the console to make NO readiness claim and to print the disclaimer. My captured text IS exactly that mandatory sentence: "This application is a proof; no operation here is production-ready". Enumerated every "production" occurrence in rendered page text: `/scenarios` dev = 1 (the disclaimer), `/scenarios` production serving = 1 (the disclaimer), queue = 0. No readiness claim anywhere → S1 verdict **PASS** (the original check contradicted the coverage requirement; candidate complies).

## 4. Adversarial minimum (all executed by me)

| Attack | Result |
| --- | --- |
| Stale decision after my own restart | `DOMAIN_CONFLICT` (expected 1, actual 2, state unchanged) — durable store, post-kill process |
| Idempotency-key replay (browser API, fresh + post-restart) | identical replay → `DATA_IDEMPOTENT_REPLAY`; key reuse with different payload → `DATA_IDEMPOTENCY_CONFLICT` (X5, V7) |
| `finding.add` to an APPROVED inspection | refused (`DATA_*`), zero mutation (X3, A7 both adapters) |
| Revise by the wrong technician | `DATA_UNAUTHORIZED` — API as t.nguyen on i-103 (assigned m.osei) (X4, A4) and probe-level both adapters |
| Approve as technician directly via `/api/inspection/...` | `422 DATA_UNAUTHORIZED` (X1); server-side role grants, not UI visibility |
| Console reset during a latency approve | `FENCED: SESSION_STALE`; late result never lands; fresh session untouched (S6, C4) |
| Inspect the durable file with `node:sqlite` after the kill | i-103 `approved` rev 2 + approval activity row read from disk while the server was down; hashes pre/post kill identical |
| Malformed JSON body / unknown action | `400 DATA_INVALID_INPUT` / `UNKNOWN_ACTION` (X6, X7) |
| `git diff --stat a8379110..cbb3fb6` boundedness | 47 files: `docs/ui-foundation/*` (records/evidence), `packages/ui-preview/*`, `examples/ui-authoring-proof/*`, `examples/ui-design-proof` maintenance only (`src/app.html`, `static/favicon.svg`), `.prettierignore`. **Nothing outside allowed paths** — no apps/studio, no Stage 9, no U4 packaging, no ui-editor dist work; `packages/application` and `packages/sdk` untouched |

## 5. Findings

| ID | Severity | Finding | User effect | Owner | Next check |
| --- | --- | --- | --- | --- | --- |
| F-1 | MINOR | The document-level "Approve inspection" control (`inspectionDetailDocument`, `definitions.ts:341–358`, `actionId: inspection.approve`) has **no status condition**, so it renders ENABLED on terminal-state details (approved/rejected). Clicking it is refused honestly by the boundary (`DATA_INVALID_INPUT: approve requires status 'submitted' (found 'approved')`; as technician: `DATA_UNAUTHORIZED`), state never changes — no bypass, but a dead affordance on a U3-08 surface | A supervisor sees an Approve button that can only produce an error note on already-decided inspections; slight negative-state incoherence; honest refusal is shown | U3 stage manager | Bounded repair: gate the document interaction with a status condition (or hide host-side); re-verify the detail surface + the denial demo the button also serves |
| N-1 | NOTE | On an already-approved row, an approve attempt reports the status error (`DATA_INVALID_INPUT`) rather than a decision-specific code — the status check precedes the revision check in the shared rule core. Correct refusal; ordering is cosmetic | Error text is accurate but names the wrong dimension first for stale-decision probes on decided rows | U3 stage manager | Optional reorder or doc note; no gate impact |
| N-2 | NOTE | The root unit project fails 4 tests in a fresh checkout that lacks local `packages/server|store-sqlite/dist` builds (worker scripts import repo-root-relative dist paths). Environment sensitivity of the test harness, not a candidate defect (10/10 where dist exists at the same bytes) | Verifiers in fresh clones see 4 spurious failures | Stage manager (test-infra note) | Either build those dists in verification envs or make the tests skip-with-reason |
| N-3 | NOTE | The durable adapter persists by full-table upsert of all rows per accepted mutation (write-through transaction) — correct and transactional, O(table) per write | None at proof scale | U3 stage manager | Acceptable for the local proof; revisit only if reused beyond U3 |

Environment disclosure: all results above executed bytes proven identical to the pin (§0). No candidate file was modified; my only worktree artifact is this report.

## 6. Reproduction commands (key ones)

```text
cd C:/Users/RZ1/Desktop/RZ/vict-02-u3-verify && git rev-parse HEAD        # cbb3fb6…
# battery
npm run typecheck && npm run check:ui && npm run format:check
npx vitest run --project unit   # see N-2 for the 4 dist-path tests
npx vitest run --project renderer && npx vitest run --project integration
cd examples/ui-authoring-proof && npx vitest run && npx svelte-check --tsconfig ./tsconfig.json
cd ../ui-design-proof && npx vitest run && npm run typecheck && npm run build
# probes (my harness, run from the authoring dir)
npx tsx C:/Users/RZ1/AppData/Local/Temp/u3-verify-logs/probe-u3.mts            # 109/109
node C:/Users/RZ1/AppData/Local/Temp/u3-verify-logs/u3-journey.mjs             # dev 5212 journey+console+attacks
node C:/Users/RZ1/AppData/Local/Temp/u3-verify-logs/u3-j10-verbose.mjs         # J10 resolution
U3_DURABLE_DB=…/restart-proof.sqlite npm run build && PORT=5213 U3_DURABLE_DB=… node build
node C:/Users/RZ1/AppData/Local/Temp/u3-verify-logs/u3-restart-pre.mjs         # durable approve via UI
taskkill /F /PID <pid> ; node -e "…node:sqlite read…"
node C:/Users/RZ1/AppData/Local/Temp/u3-verify-logs/u3-restart-post.mjs        # recovery+negative control
U3_DURABLE_DB=… npx tsx test/measure-u3.ts                                     # performance
```

My evidence (paths under `C:/Users/RZ1/AppData/Local/Temp/u3-verify-logs/`): `probe-u3.out` (109/109), `journey-results.json` (48 checks + per-phase console), `u3-j10-verbose.mjs` output, `u3-j10-fix.mjs` output, restart outputs (`u3-restart-pre/post/post2/approvebtn`), `pre-kill-hashes.txt`, `measure-u3-vrepro.json`, battery logs (`typecheck/check-ui/format-check/vitest-*/ap-*/design-*/secondary-job/root-job`), `clean-sweep-console.json` (zero), and 23 screenshots in `shots/` (journey 1440/1024/390, console 1440/1024/390/480-container, durable pre/post-kill, simulated-forgets, F-1 click).

---

## U3 GATE: PASS WITH NON-BLOCKING FINDINGS

- U3-01 PASS · U3-02 PASS · U3-03 PASS · U3-04 PASS · U3-05 PASS · U3-06 PASS · U3-07 PASS · U3-08 PASS (retained F-1 minor)
- Candidate: `cbb3fb6584226c48633a2f3d21bccee674ce59c0` — verified unchanged, clean, byte-equivalent execution environment
- Retained: F-1 (minor), N-1/N-2/N-3 (notes). Missing proof cannot be promoted; nothing above is inferred from silence — every verdict cites a run I executed at the pin.
