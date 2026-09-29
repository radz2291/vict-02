# VICT Stage 09 — G1 Operator Foundation — Evidence Record (2026-09-29)

> **Status: builder-side evidence assembled per the G1 process amendment. This record is a CANDIDATE document: an independent fresh-context verifier must confirm every claim at the exact final pushed candidate SHA before any gate verdict is claimed. Verdict vocabulary: PASS / PASS WITH NON-BLOCKING FINDINGS / HELD / FAIL / BLOCKED.**

## 1. Candidate lineage (append-only, preserved)

| Step | SHA | Content |
| --- | --- | --- |
| G1 checkpoint (WP-1/WP-4) | `801ecee0be895172ec033f779eb5d382c19e562c` | 11 operator read commands, HTTP/CLI mappings, D-5 command mechanics, loopback-only binding, auth matrix rows, three-surface inventory. Self-reported gates recorded in the commit message; treated as self-reported, re-verified below. |
| Process amendment | `1249ca87545b49731edaba2971c13edd58b9355a` | STATE checkpoint entry + `VICT-STAGE-09-G1-PROCESS-AMENDMENT-2026-09-29.md` |
| Studio scaffold + interface | `fd2f57d1acd7b5ae1c1b869f5be2268153b0cfde` | `apps/studio` workspace + `src/lib/shared/contract.ts` (the agreed builder interface) |
| Builder track: studio-server | `codex/stage9-g1-studio-server` @ `614f82c778afa73f2e41fd7c2950b8b286080769` | session/targets/CSRF/Origin+Host boundary, HTTP adapter, 27 tests, demo target (builder report `qa-artifacts/stage9-g1/studio-server-report.md`) |
| Builder track: studio-app | `codex/stage9-g1-studio-app` @ `534ac8aef19a8b4305c21ef4f41c4d31368aa675` | real `app.vict-studio@1` definition, named `cmp.target-connection-status@1`, 12 tests, FT-1 guard (builder report `qa-artifacts/stage9-g1/studio-app-report.md`) |
| Integration (merge + wiring) | `acc6cbb6b72cc41b3f329ebad192af83bbc53892` | merges both tracks; integrator compositions (per-graph selectedActivations; detail-record convention) |
| Truthful probe/partial fix | `686175d` | probe path bounded auth-only; releases require applicationId pinned in contract; per-view failures → renderer-native `partial` banner |
| **Final G1 candidate** | (see commit at the head of this branch; verifier reports the exact SHA) | + evidence record (this file), journey tooling notes |

Base for all of the above: VICT merged `main` `fd675d9083a32f282820d9e0135c191d691c943c` (G0 freeze `5c680d5` merged via PR #2, independently freeze-verified at `74b6d49`).

## 2. Builder independence (process)

Two genuinely separate builder agents executed in isolated worktrees with non-overlapping path sets (`../vict-02-g1-a`, `../vict-02-g1-b`), branching from the scaffold commit; the interface was agreed FIRST in `src/lib/shared/contract.ts` + `apps/studio/README.md`, and the stage manager acted as single integrator. Two intra-build decisions were escalated to the stage manager (vitest svelte plugin; browser resolution conditions) and recorded as approved deviations in the studio-app builder report. Fresh-context independent verification: see §7.

## 3. Criterion matrix (builder-side claims; verifier confirms/falsifies)

| G1 criterion | Claim | Evidence |
| --- | --- | --- |
| (a) Safe operator reads incl. graph/activation identity + D-5 positive path | PASS (self-reported; re-verified at integrated SHA below) | Checkpoint tests (12) + auth matrix rows (33) + server suite 174/174 + live D-5 block (§5) |
| (b) HTTP/CLI mappings + three-surface inventory | MET at checkpoint; re-run at final SHA | `npm run verify:stage9-inventory` → INVENTORY OK (divergences classified; G2 commands asserted absent) |
| (c) Operator connection/session boundary (D-2/D-7) | MET (live-verified) | §5: HttpOnly/SameSite cookie; CSRF + Origin/Host negatives; four truthful target states; token canaries zero |
| (d) Real Studio Application Definition/Plan read path through genuine `ui`/`ui-svelte`, integrated to a working browser read | MET (live-verified) | §5: real `app.vict-studio@1` compiled plan; VitApp-rendered dashboard/runs/run detail/activations/audit; browser screenshots |
| S9-02 drill-down | **NOT CLAIMED** (FT-1 dependency; D-1) | `/runs` has zero anchors in data surfaces (live count 0; also tested) |
| G2 receipts/mutations | ABSENT | no mutation commands; adapter `mutate()` always rejects; `actions: []` in definition |

## 4. Mechanical checks at the integrated candidate (builder-run, to be re-verified)

`npm run build` OK · `npm run check -w vict-studio` 0 errors · `npm run test -w vict-studio` 39/39 (5 files: boundary 13, adapter 9, targets 5, app-definition, ui render) · `npm run lint` clean · `npm run format:check` clean · `node scripts/verify-stage9-inventory.mjs` INVENTORY OK · `npx vitest run --project unit packages/server` 174/174 · **full unit suite at the final code state: 2355/2355 (119/119) — no failure this run** (see §6 for FT-4's status).

## 5. Live browser + direct-API journey (real stack this session)

Stack: demo target at `127.0.0.1:4310` (`apps/studio/scripts/demo-target.mjs`: two admin-provisioned actors — `actor-studio-operator` without `run.detail`, `actor-studio-detail` with `run.detail` — published+selected activation, completed/failed/blocked runs, one durable wait, full-retention output); Studio dev at `127.0.0.1:5173` with five provisioned targets (connected ×2, unreachable, wrong-credential, unprovisioned-credential).

Login boundary: wrong secret → non-echoing "Sign-in failed." (identical for unknown label); correct → 303 to dashboard; cookie `HttpOnly; SameSite=Lax; Max-Age=28800`; `document.cookie` empty in-browser.

Dashboard: four truthful connection states rendered (Connected ×2 / "Target unreachable at http://127.0.0.1:47999." / "Target rejected the Studio credential (401/403)" / "No provisioned target with this id."); composed selected activation `g.studio-demo — v1_ab66cb…`; releases panel shows the truthful partial banner (enumeration requires `applicationId`; nothing invented to fill empties).

Runs list: three truthful rows; **zero anchors** in data surfaces + truthful FT-1 text. Run detail (failed): identity incl. graph/capabilitySet/activation versions, status, retention, currentNodeId, ordered events (run.started → node.started → node.failed → run.failed). Blocked run: real durable wait (`wait-demo-signal — signal`). Activations: manifest-derived identity (nodeCount/bindingCount/contractCount) + per-graph selection. Audit: truthful empties BEFORE, per-access entries AFTER the D-5 API block (closed loop).

Direct-API D-5 block (target boundary, `Authorization: Bearer …`):
1. `GET /vict/v1/runs/run-demo-completed/detail` with operator token → **403 `VICT_ACTOR_SCOPE_DENIED`** (non-echoing).
2. Same with detail token → **200** `protectedAvailable:true`, `retention:"full"`, real protected output bytes present.
3. Detail token on summary-retention run → `protectedAvailable:false`, `protectedOutput:null`, `retention:"summary"` — truthful absence.
4. `GET /vict/v1/audit?subjectType=run&subjectId=run-demo-completed` → per-access `run.detail.accessed` events **attributed to `actor-studio-detail`**; the same entries appear in the Studio audit view (actor/subject/summary).

Boundary negatives (live HTTP): unauthenticated navigation → 303 /login; unauthenticated JSON → 401/403 fail-closed; JSON POST with session but missing/wrong `x-vict-csrf` → **403 `VICT_STUDIO_CSRF`**; foreign Origin → **403 `VICT_STUDIO_ORIGIN`** (non-echoing envelopes).

Leak canary: all six Studio routes' server-rendered HTML+hydration (61–67 KB each) string-scanned for all three credential tokens + the human secret → **0 hits**. No token in any browser-visible byte.

Keyboard: focus order semantic (menu button → nav links; component `<details>/<summary>` keyboard-reachable per unit tests). Responsive: 390px-full-page + 1280px screenshots captured (`qa-artifacts/stage9-g1/shots/0*.png`); grid stacks under 640px via component CSS.

Screenshots: `01-login-failed-nonechoing.png` (saved), `02-dashboard-four-states.png`, `03-runs-list-no-row-links.png`, `04-run-detail-failed.png`, `05-run-detail-blocked-with-wait.png`, `06-audit-empty-truthful.png`, `07-responsive-390px.png`, `07b-responsive-390-nav.png`, `08-audit-peraccess-entries.png`.

## 6. FT-4 classification (visible, per protocol)

`qa-artifacts/stage9-g1/ft4-classification.md`: release-authority timeout = resource-starvation of git-fixture spawning under the full 119-file pool. This session's observations: the failure reproduced at the `801ecee` checkpoint full-suite run (2354/2355, timeout, no assertion failure), passed 65/65 isolated at default AND 30s timeout, passed 263/263 under moderate parallel load — and the final full-suite run at the integrated candidate passed 2355/2355 with no timeout (lower concurrent load at that moment). FT-4 therefore REMAINS classified as environmental/load-sensitive, pre-existing since the Stage 8 G4 audit, never silently absorbed, and never claimed fixed: a future full-suite run under different load may reproduce it, and it stays scheduled in the follow-up register.

Also fixed at integration: the login page's `autofocus` attribute (svelte a11y warning) — removed; keyboard focus starts from the page itself.

## 7. Independent verification

The fresh-context verifier's report and verdict are recorded in its own
`review/...` branch (separate checkout, did not build): see
`docs/governance/VICT-STAGE-09-G1-VERIFICATION-*.md` and the verifier branch
SHA reported to the owner. Verifier findings are triaged by the stage
manager; repairs (if any) were followed by re-verification of affected
claims. This file states builder claims only — the verdict is the
verifier's, and only the owner records acceptance.

## 8. Known non-blocking items for the verifier's attention

1. `[object Object]` cosmetic rendering of the run `error` object field in DataView (safe summary fields only; no protected bytes; pre-existing generic DataView behavior).
2. `release.list`/`release.selections` require `applicationId` server-side; without it the target 400s and Studio shows the truthful `partial` banner ("release enumeration requires an applicationId") — API shape documented in the contract.
3. Probe `selected` is truthfully null (per-graph API prevents enumeration); selected-version visibility is carried by the composed dashboard view instead.
4. Responsive/overflow precision at intermediate widths re-verified independently (screenshots captured at 390px; unit render tests assert stacking behavior).
5. Session store is in-memory by design (restart logs users out; D-2 short-lived).
6. The run-detail `v.runDetail` viewData row intentionally omits the `steps` json blob (read-only detail projection; all other safe fields present).