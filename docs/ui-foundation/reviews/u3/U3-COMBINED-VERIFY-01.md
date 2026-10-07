# U3 COMBINED INDEPENDENT VERIFICATION — U3-COMBINED-VERIFY-01

Verifier: fresh independent verifier (vict-verifier), falsification-only. I did not build or repair this candidate; no tracked file was modified; all harnesses live in `C:/Users/RZ1/AppData/Local/Temp/u3v-harness/`.

## 1. Tested SHA and lineage

| Role | SHA |
| --- | --- |
| Combined candidate TESTED (detached HEAD, clean tree) | `952d92da5131d6ab595b45b3bf18bc7ce3b3466d` |
| Repaired implementation candidate | `e0dd026e3fe08cf979d6625a88828e295f23dba6` |
| Experience tip (origin/codex/ui-foundation-u3-experience, verified via fetch) | `9c34679acf887e6130b7b4bc000716ecd5db1145` |
| U3 entry records (manager) | `aaeea16f9cabccad05650eefdd8771c756326f17` |
| U3 gate PASS WNF point (U3-VERIFY-01) | `cbb3fb6584226c48633a2f3d21bccee674ce59c0` |
| Candidate 1 (experience FAIL, preserved) | `8d99f3645691b4c3882cdfe88f298d6f0306eae0` |
| Frozen U0 contracts (STAGES-AND-VERIFICATION §5, PROOF-DESIGN §1–2, API-SPEC) | `9ec87f3e7eb8eb7793f972111258940aac635346` |

Worktree: `C:/Users/RZ1/Desktop/RZ/vict-02-u3-combined-verify` (git status clean before my untracked report/evidence dir).

### Lineage checks (all reproduced now, git)
- `git diff --stat e0dd026 9c34679` → **docs/ records only** (68 files, all under `docs/ui-foundation/u3-experience/`). Confirms "final records do not change the reviewed implementation".
- `git diff --stat cbb3fb6 aaeea16` → records/evidence only (U3-VERIFY-01 + shots + STATE/DECISIONS/HANDOFF).
- `git diff --stat aaeea16 e0dd026` (the repair) → changed files are ONLY: `examples/ui-authoring-proof` (presentation/documents/host/routes/tests), `packages/ui-svelte` (document bridge + tests), `packages/ui-editor/src/EditorCanvas.svelte`, plus `docs/ui-foundation/u3-experience/` records. **No domain, durable-adapter, server-operation or preview-session implementation file changed.** Spot-check: no file outside those paths appears in the diff.
- `git diff --name-only e0dd026 952d92d` → `.prettierignore` (+3 lines, ignores imported u3-experience evidence) + docs only.
- `git diff --name-only aaeea16 952d92d` vs allowed paths (examples/ui-authoring-proof, packages/ui-svelte, packages/ui-editor/src/EditorCanvas.svelte, docs/ui-foundation/u3-experience/, .prettierignore) → **nothing outside allowed paths**. No apps/studio, Stage 9, U4 packaging or frozen-contract edits.
- Manager report integrity: `docs/ui-foundation/reviews/u3/U3-VERIFY-01.md` imported verbatim at `aaeea16`; sha256 of the file at HEAD = `9412d96c…` (prefix matches the recorded digest in `docs/ui-foundation/DECISIONS-AND-EVIDENCE.md`; see §6 note).

### Environment integrity (junction)
`node_modules` is a junction into `C:/Users/RZ1/Desktop/RZ/vict-02-u3`; I verified that worktree is at the **same commit `952d92da` with a clean tree** and `diff -rq` of all consumed `src/` trees (ui-svelte, ui, ui-editor, ui-preview, application, runtime, sdk, contracts, example src) is byte-identical. Compiled `dist/` of application/runtime/ui identical; ui-preview dist differs only in `session.js.map` (compiled `session.js` byte-identical). Svelte packages are consumed from source via exports. So junctioned test runs exercised the pinned bytes.

## 2. Battery (all reproduced now at 952d92d)

| Suite | Expected | Reproduced |
| --- | --- | --- |
| ui-authoring-proof vitest (application/product) | 68 across 9 files | **68/68 passed (9 files)** |
| renderer project (ui-svelte + ui-editor svelte tests) | 131 across 20 files | **131/131 passed (20 files)** |
| root unit project | 2499 | **2499/2499 passed (129 files)** |
| root integration project | 4 | **4/4 passed** |
| ui-design-proof | 12 | **12/12 passed** (after `svelte-kit sync`; missing `.svelte-kit` was my fresh-worktree env gap, not a defect) |
| root `typecheck` | pass | **pass (exit 0)** |
| `check:ui` | 0 errors / 2 retained warnings | **0 errors, 2 warnings (same noninteractive-text a11y warnings)** |
| example `svelte-check` | 0 errors / 2 retained warnings | **0 errors, 2 warnings** |
| `format:check` | clean | **clean** |
| example production build | pass | **pass** (`node:sqlite` external-dep warning expected) |
| `npx tsx test/measure-u3.ts` | edit p95 ≤ 100 ms; reset p95 ≤ 1000 ms | **edit p95 0.19 ms; scenario reset p95 0.17 ms; preview reset 0.33 ms; durable decision write 7.75 ms** — budgets met with ~3 orders of magnitude headroom |
| **HONEST PACKAGING:** `packages/ui-editor` workspace build | FAILS (accepted U2 F3) | **reproduced: exit 2 with exactly four TS2307 Svelte-declaration errors** (`EditorCanvas.svelte`, `Layers.svelte`, `HistoryPanel.svelte`, `Inspector.svelte`). Built-package readiness is NOT claimed by this candidate; source consumption and the example build work. |

## 3. Per-criterion verdicts (U3-01…U3-08 from frozen `9ec87f3e` STAGES-AND-VERIFICATION §5)

Legend: **REPRODUCED** = I ran it now at 952d92d. **STANDING** = prior independent evidence, carried because the relevant bytes are unchanged (justification per delta above). **NOT DEMONSTRATED (this run)** = I could not reproduce it within this verification; standing evidence is cited but not converted into a pass.

### U3-01 Journey — PASS (reproduced, minus one sub-item standing)
- **REPRODUCED (dev server 5222, real Chrome, real clicks/keystrokes):** queue → detail (i-101); exactly ONE "Review decision" area and ONE "Activity" trail (DOM-counted); reject with EMPTY reason refused with visible refusal (submit disabled; click attempt leaves state `submitted`); reason typed via real keyboard → `rejected`, reason quoted in Activity; technician "Start corrections" → `draft`, record-level decision fields cleared (`rejectionReason`/`decidedAt` gone from the record), reason REMAINS quoted in trail; integrated "Add corrections" forms add a finding (Findings · 3) and evidence (Evidence · 3); "Submit for review" → `submitted`; supervisor "Approve inspection" → `approved` at the NEW revision (seed 3 → trail shows reject@4, revise@5, submit@6, approve@7); queue reflects `approved`. Screenshots `u3-combined-verify-evidence/j01…j09-*.png` (1440×900), `j10/j11` (1024×768), `j12/j13` (390×844), `j14/j15` (`?frame=480` — measured container width exactly 480 px).
- **Zero unexplained console errors** across the whole sweep (console-error/pageerror/requestfailed collectors empty).
- **Combined-specific journey (Inspector edit → save → product renders persisted source at new stored revision → undo/save restores): NOT DEMONSTRATED (this run).** My automation could not commit the style edit in the studio (focus/typing raced re-renders; style edits additionally require the "Apply style" button — the canvas stayed 32 px). Failed attempts preserved (`b01-studio-saved-42.png` shows the non-commit). Standing evidence: EXPERIENCE-E0DD.md on `e0dd026` (PASS: 42 px round-trip at stored revision 5, restore to 32 px at revision 6, with saved-edit-proof.json) — carried because every file involved in that journey (`src/lib/authoring/store.ts`, `compile.ts`, `documents.ts`, routes, `DocumentHost`, `EditorCanvas.svelte`) is **byte-identical between e0dd026 and 952d92d** (the combined delta touches only docs/.prettierignore). I verified the adjacent machinery myself: saved-source compiles into the product plan and changes `applicationVersion`/`sourceDigest` (store→compile probe), and the corrupt-bytes path fails safe (see U3-07).
- Standing: full-journey evidence at cbb3fb6 (U3-VERIFY-01, v-j01…v-j14) — carried for the records delta (implementation bytes identical cbb3fb6→aaeea16? **No** — the repair changed presentation; therefore my fresh journey above, not the standing shots, is the evidence for the repaired UI. The cbb3fb6 journey remains valid only for the unchanged domain/server surfaces.)

### U3-02 Scenario presets — PASS (reproduced via source, probes, and console)
- `src/lib/product/scenarios.ts` + `scenario-seeds.ts` declare exactly the frozen eight (PROOF-DESIGN §2): normal / empty / long(40 findings, unbroken strings) / latency(800 ms) / failure(declared SIMULATED_FAILURE) / missing(unavailable) / denied(technician) / conflict(stale `expectedDomainRevision`). Behavioral scenarios share the normal seed; outcomes declared in coverage, not different data.
- **REPRODUCED:** deterministic reset — two fresh `createScenarioSession('normal')` sessions return identical rows; `PUT /api/inspection/reset?scenario=…` returns `{ok:true}` and re-seeds (used before my journey). `/scenarios` console lists all eight ids; DemoControls exposes the record presets (Submitted inspections / Empty queue / Long content).
- Preset *layouts* for empty/long were not separately screenshot this run (standing: U3-VERIFY-01 v-s08…v-s10 console sweeps at cbb3fb6 cover console widths; scenario-matrix tests cover seeds). Not a gap in behavior evidence.

### U3-03 Runtime domain correctness — PASS (reproduced on BOTH adapters)
Independent probe harness (temp, not repo): over `createInspectionServer` with the simulated AND the durable SQLite adapter:
- approve as technician → `DATA_UNAUTHORIZED`; submit as supervisor → `DATA_UNAUTHORIZED` (runtime enforcement, server-side).
- reject without/empty/whitespace reason → `DATA_INVALID_INPUT`, **zero mutation** (table snapshot deep-equal before/after, all four tables).
- full loop: reject → assigned-technician revise (fields cleared, reason quoted in trail) → **revise by WRONG technician (m.osei) → `DATA_UNAUTHORIZED`** → corrections → submit → fresh approve at the new revision (approved@7).
- finding.add to an APPROVED inspection → `DATA_INVALID_INPUT`.
- stale `expectedDomainRevision` → `DOMAIN_CONFLICT` with expected/actual echoed, **zero mutation**.
- keyed replay → `DATA_IDEMPOTENT_REPLAY`; same key different decision → `DATA_IDEMPOTENCY_CONFLICT`, zero mutation.
- durable adapter: close/reopen the file → decision survives.
- API-level (live server): technician approve via `/api/inspection/inspection-approve?as=technician` → `DATA_UNAUTHORIZED`; stale approve → `DOMAIN_CONFLICT` ("expected 1, actual 2"), state verified unchanged. (Keyed replay is enforced one layer down in the shared core; my API-level replay attempt used the wrong transport — the key rides an `x-idempotency-key` header — and hit an already-decided record; the replay/conflict behaviors are demonstrated at the dispatch core in the probes above and in the 68-test suite, e.g. `domain-u3.test.ts`/`product.test.ts`.)

### U3-04 Scenario identity / fencing — PASS (reproduced)
- Deterministic reset: identical rows across fresh sessions (probe).
- **Missing implementation → `SCENARIO_COVERAGE_MISSING` with ZERO adapter invocations** (counting wrapper around query/mutate: 0 calls).
- **Latency fencing:** scenario-console approve with declared 800 ms; `session.reset()` inside the delay window → in-flight result fenced `SESSION_STALE`; adapter state deep-equal unchanged; the late result never lands. Product-server generation fencing: reset while a dispatch is in flight → `SESSION_STALE`, record still `submitted` afterwards.
- Capability snapshot stability in-session is structural (snapshot captured at session creation; verified in code and by renderer/preview tests within the 131/2499 suites).

### U3-05 Durable replacement — PASS (reproduced, REQUIRED restart proof done on the combined app)
- **Mode switch on the queue UI:** Storage select `Simulated` / `Saved locally (SQLite)`; DemoControls summary strip flips between "Submitted inspections · Simulated" and "Saved records · Saved locally" (observed both live).
- **Same action id + contracts across the swap:** my probes dispatched identical action ids through `createInspectionServer` over both adapters with identical inputs/outputs; `durable-adapter.test.ts` additionally asserts document/binding digests and application version are mode-independent (within the 68 reproduced).
- **REQUIRED ACTUAL RESTART (production build, `node build` on port 5223, `U3_DURABLE_DB` in temp):**
  - Cycle 1 (negative control): simulated approve → `taskkill /F /T` (port verified dead) → fresh process → decision **FORGOTTEN** (back to `submitted`). Reproduced.
  - Cycle 2: switch to durable → approve (`approved@4`, `decidedAt` recorded) → SHA-256 of the SQLite file captured → force-kill (port dead) → file exists, hash **unchanged** → fresh `node build` process + **fresh browser** → remount durable (a fresh process boots simulated by design; the durable mount reads the file and never reseeds) → fresh-browser queue and detail show `approved`, activity trail recovered ("Inspection approved"), and there is **no enabled approve affordance** on the recovered record. Screenshots `r01-durable-approved-prekill.png`, `r02-durable-recovered-postkill.png`.
  - `node:sqlite` read-only read of the same file after the kill: `i-101 approved, domainRevision 4`, `journal_mode = wal`, 2 activity rows. Storage: `C:/Users/RZ1/AppData/Local/Temp/u3-combined-verify-durable/restart-proof.sqlite` (+`-wal`/`-shm`). Durability pragmas confirmed in `packages/appdata-sqlite/src/driver.ts:74-79` (`foreign_keys=ON`, `busy_timeout`, `journal_mode=WAL`, `synchronous=FULL`).
- Standing: TECHNICAL-REVIEW-02/TECHNICAL-REVIEW-01 process-before/after.json + process-restart-verdict at e0dd026/cbb3fb6 — carried as corroboration; the combined-app restart above is my own fresh reproduction.

### U3-06 Shared conformance — PASS (reproduced)
`runApplicationDataAdapterSuite` run by my own harness over the SAME evidence fixture against BOTH adapters (simulated seeding the suite rows through `SeedInput`; durable inserting the same rows via the store's own SQL with placeholder parents): **both pass**. The repo's own `durable-adapter.test.ts` does the same (within the reproduced 68).

### U3-07 Truthful modes — PASS (reproduced, with one minor finding)
- `/scenarios` console: all eight scenario ids + preset label; per-operation coverage matrix with implementation + availability + reason; explicit semantics text: *"'simulated' means the in-memory domain adapter — real rules, no persistence. 'unavailable' denies with SCENARIO_COVERAGE_MISSING before anything runs. This application is a proof; no operation here is production-ready."* `missing` tab shows `inspection:approve unavailable` and names `SCENARIO_COVERAGE_MISSING`. Screenshots `s01`, `s03`.
- Mode strip truthful: Simulated labelled in-memory; `Saved locally (SQLite)` claims only a local SQLite file ("Saved locally uses a SQLite file and keeps existing records when settings change") — never durability beyond that, never production readiness.
- **Corrupt/remove saved source → fails safe:** with `localStorage['vict.u1.authoring.doc'] = '<<<corrupted…>>>'` the detail page renders the bundled presentation, the bytes are **preserved verbatim** (asserted), and the studio discloses loudly: *"⚠ Stored authoring data is unreadable and has been PRESERVED … The store refuses to overwrite it — a save will fail until the stored data is cleared."* Finding V-F1 below concerns the detail page's own disclosure.

### U3-08 Product experience — PASS (reproduced at all required widths)
- 1440×900, 1024×768, 390×844 queue+detail and 480 px container (`?frame=480`, measured 480 px) — screenshots j01–j15. Hierarchy (status, findings/evidence labelled with severities and image-ref/note kinds, labelled placeholders — no fake images), ONE decision area, ONE chronological activity trail, integrated correction forms, keyboard use (real `page.keyboard` typing into reason/finding/evidence fields; select interaction for role/severity), visible refusal feedback (disabled submit with empty reason; API refusals surfaced as `diagnostic` with `canReload`), terminal-state control: after approval there is **no enabled Approve affordance** (DOM-verified; F-1 from cbb3fb6 confirmed fixed in the repaired UI). Demo controls in a collapsed `<details>` disclosure. Zero unexplained console errors on clean sweeps.

## 4. Extension / source-ownership challenges
- **REPRODUCED (node, against `resolveSvelteExtension` from the pinned tree):** exact registration (extensionId + revision + rendererImplementationId) resolves; MISSING implementation → `UI_RENDER_EXTENSION_UNAVAILABLE` (fail-closed, no guessing by id); MISMATCHED rendererImplementationId → unavailable; WRONG revision → unavailable; descriptor declaring events OR slots → `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED` (props-only bridge holds). These codes are surfaced as render diagnostics with a safe unavailable placeholder by `RenderNode.svelte` (covered by the reproduced renderer tests, incl. `document-extensions.test.ts` and `document-state-values.test.ts` within the 131).
- **Extensions have no runtime dispatch authority:** dispatch remains on authored elements/forms (`+page.svelte` `request()`/`dispatch()` go through `/api/inspection/*` with the acting identity; extension components receive only `{props, occurrenceKey, nodeId}`).
- **Authored canonical documents:** queue/detail are `vict.ui-document@1` data (`documents.ts`, no Svelte imports); detail renders from stored source (bundled or valid saved source recompiled, `applicationVersion` changes with it — probe-verified); the `inspectionQueue` resource is a read-only projection (`{ inspections: inspection.list.rows }`).
- `stateValues` type-gate: `UI_RENDER_STATE_VALUE_REJECTED` for undeclared/type-mismatched keys is covered by `document-state-values.test.ts` (reproduced within the 131); I did not forge it in a live browser within budget — labelled accordingly.
- Standing: TECHNICAL-REVIEW-02 source-ownership review (registration identity, no side-channel rendering) at e0dd026 — carried; those files are byte-identical at 952d92d.

## 5. Findings

| # | Severity | Finding | User effect | Owner / next check |
| --- | --- | --- | --- | --- |
| V-F1 | Minor (non-blocking) | On the **detail** page, a saved-source `status === 'invalid'` diagnostic set in `onMount` is immediately cleared by the route-key `$effect` (initial `routeKey` differs on first run, resetting `diagnostic = ''`). The corrupt-bytes case still fails safe (bundled presentation renders, bytes preserved, save refuses to overwrite) and the **studio** page discloses the preserved-bytes state loudly — but a user landing directly on a detail page sees no disclosure of why the saved presentation was not applied. (`examples/ui-authoring-proof/src/routes/inspection/[id]/+page.svelte:16-24`) | Cosmetic/disclosure gap on one surface; no data loss; safe fallback already active. | Experience track; one-line ordering fix (initialize `routeKey` from `data`, or set the invalid-source diagnostic after the effect). Verify with the corrupt-bytes probe. |
| V-F2 | Info (accepted, carried) | `packages/ui-editor` workspace build fails with four TS2307 Svelte-declaration errors (reproduced, exit 2). This is the accepted U2 F3; built-package readiness is not claimed and must not be inferred from the working example. | No user effect in this proof; packaging risk stays owned by U4. | U4 track. |
| V-F3 | Info (verifier limitation, not a defect) | The Inspector-edit → persisted-source round-trip and the `stateValues` browser-level forgery were NOT reproduced by me this run (automation focus/typing race; time budget). Standing independent evidence on byte-identical files (EXPERIENCE-E0DD + saved-edit-proof.json; renderer tests) covers both. | None. | Owner experience acceptance session can re-walk the 42 px edit live. |
| V-F4 | Info | Fresh process boots in `simulated` mode; durable recovery requires remounting the store (which never reseeds). This is by design and now documented here with evidence; it means "restart recovery" is a property of the file + remount, not of process boot. | Operator must re-select Saved locally after a restart to see persisted decisions. | Consider a boot-time durable-mount env switch in a future slice. |

Preserved failures (not repaired, by rule): all journey-script iterations that failed due to my harness bugs (CSS id-dot selector bug, wrong API action path `/api/decision`, wrong scenario op spelling, ESM import slips) are in the transcript/temp harness; the one product-adjacent non-commit (`b01-studio-saved-42.png`) is preserved as V-F3 evidence.

## 6. Environment + reproduction commands
- Node v22.13.1 (built-in `node:sqlite`), Windows, Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe` (headless new, puppeteer-core via the junctioned workspace node_modules).
- Worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u3-combined-verify` @ 952d92da (clean; only untracked `u3-COMBINED-VERIFY-01.md` + `docs/ui-foundation/reviews/u3/u3-combined-verify-evidence/`).
- Battery: `npm run build` (root) + `npm run build -w @victframework/ui-preview`; example `npx vitest run`; root `npx vitest run --project renderer|unit|integration`; `examples/ui-design-proof npx vitest run`; `npm run typecheck`; `npm run check:ui`; example `npx svelte-check`; `npm run format:check`; example `npm run build`; `npx tsx test/measure-u3.ts`.
- Probes (temp, untracked): `u3v-harness/u3v-probe-u3-03-04-06.mts` (tsx, `--tsconfig examples/ui-authoring-proof/tsconfig.json`, `U3_DURABLE_DB` in temp), `u3v-probe-extensions.mts`, `u3v-journey-a.mjs`, `u3v-journey-b.mjs`, `u3v-restart-proof.mjs`, `u3v-scenarios-fallback.mjs`.
- Dev server: `npx vite dev --port 5222 --strictPort` (with `U3_DURABLE_DB` in temp); prod: `npm run build && node build` with `PORT=5223 HOST=127.0.0.1 U3_DURABLE_DB=<temp>/restart-proof.sqlite`.
- Manager-report digest note: recorded sha256 prefix `9412d96c…` for `docs/ui-foundation/reviews/u3/U3-VERIFY-01.md` matches the file imported at `aaeea16` (byte-identical thereafter; `.gitattributes`-normalized line endings make Windows working-tree hashing unreliable, so identity was verified via git object equality `cbb3fb6 → 952d92d`, which is exact).

## 7. Verdict

**U3 COMBINED GATE: PASS WITH NON-BLOCKING FINDINGS**

- All eight criteria hold at `952d92da5131d6ab595b45b3bf18bc7ce3b3466d`. U3-01/03/04/05/06/07/08 core behaviors were independently reproduced now; the combined-specific authoring round-trip (U3-01 sub-item) and two browser-level forgeries stand on byte-identical prior evidence (V-F3).
- Non-blocking findings: V-F1 (detail-page disclosure wipe; studio discloses; fails safe), V-F2 (accepted packaging failure, reproduced), V-F3 (verifier limitation, standing evidence), V-F4 (boot-mode design note).
- This verdict does NOT close U3 (owner experience acceptance remains pending, per the handoff), does not authorize U4, and does not upgrade the ui-editor dist situation.
