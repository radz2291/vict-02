# U1 REPAIR RE-VERIFICATION (pass 2) — codex/ui-foundation-u1 @ 5a816722

Reviewer role: independent verifier (pass 2, scoped re-verification of the repaired candidate; not the builder; falsification only).
Prior report: `C:/Users/RZ1/Desktop/RZ/vict-02-u1-falsification-review/REPORT.md` (U1 GATE FAIL on BLOCKER-1).

## Tested snapshot

| Item | Value |
| --- | --- |
| Candidate (HEAD tested) | `5a81672283dbefbbffdbd809704fe563d114f1f7` (repair commit) |
| Parent / pass-1 snapshot | `fbe2451e28d04b7177703de26e72abb84d3a1389` |
| Base | `97346903e0c1a242b4bab0477c92bc3f34c43c38` (in history) |
| origin/main (fetched live) | `4d2df037d8a82d36c60bf1bff16919650643ce22` — **unmoved**; merge-base(HEAD, origin/main) = `4d2df03…` |
| Working tree at review end | **clean** (`git status --porcelain` = 0 entries); dev server killed; ports 5173/5210 free |
| Attack harness (out-of-repo) | `C:/Users/RZ1/Desktop/RZ/u1-falsify2/` — `probe-preview-repair.ts` (16 checks), `journey3.mjs` (12 checks), `diag-click.mjs`; nothing written into the worktree |

Environment: Windows 11, Node v22.13.1, Chrome CDP :9222 (fresh tab for the journey), dev server `vite dev --port 5210` serving the pinned worktree only.

## Per-scope-item verdicts

### 1. U1-05 real dispatch — **REPAIRED, VERIFIED (PASS)**
- Source: `examples/ui-authoring-proof/src/routes/inspection/[id]/+page.svelte` — `dispatch={runDeclaredAction}`; single shared boundary (pending/success/error feedback, `busy` duplicate guard, actor from route role). Studio `+page.svelte:280` — canvas `dispatch` calls `preview.run(actionId, input)` through the live PreviewSession (no stub).
- Stub grep: zero `dispatch={() => ({ ok: true })}` / silent-ok stubs remain anywhere in `src/` or `packages/`; remaining `ok: true` hits are the real adapter's legitimate read results.
- Input wiring attacked: RenderNode resolves `interaction.params`, but the authored document declares `input:` — verified the compiler normalizes it (`packages/ui/src/compile.ts:559` `params: interaction.input ?? {}`), so the authored button dispatches real `{id, expectedDomainRevision}` from `record.*` refs.
- On-screen claim corrected: detail route now states the document button and native control dispatch the SAME declared action through the SAME adapter boundary — and this time it is true.
- Builder's mount-level regression (`test/authored-button.test.ts`, browser-environment click on `[data-ui-node="n.approveButton"]`): approve + DATA_UNAUTHORIZED denial both pass (within example suite 15/15).
- Live browser (my journey, fresh tab): authored Approve click → status `submitted→approved`, activity 1→2, feedback "Decision recorded — status and activity refreshed." Technician on i-102: state unchanged, `role="alert"` = "DATA_UNAUTHORIZED: Approve requires qlt.inspection.approve." Screenshots: `evidence/repair2-detail-approved-1440x900.png`, `evidence/repair2-detail-denied-1440x900.png`.

### 2. U1-06 preview gate + doubles — **REPAIRED, VERIFIED (PASS)**
Out-of-repo probes against `packages/ui-preview/dist` (16/16 checks):
- Empty `permissions: []` actor → `OPERATION_DENIED`, registered double NOT invoked (probe-confirmed; MAJOR-1 bypass closed — gate is now unconditional).
- Actor with only an unrelated permission → denied, double not invoked.
- Positive controls intact (no over-blocking): `*`, exact op, qualified domain-tail (`qlt.probe.op`) all still allowed; different-op permission denied.
- Rejecting async double → `ok:false`, `code=SIMULATED_FAILURE`, message carries the rejection (never `ok:true`); sync-throw double → same structured failure; rejecting double under latency + `reset()` → `SESSION_STALE` (fencing preserved with the new await path).
- Browser has no permissions-less actor in its scenario set; the bypass attack was therefore executed at the package boundary (above), which is where the gate lives.

### 3. U1-04 / MINOR-3 EditorBridge.save rollback — **NOT REPAIRED (FAIL on this item)**
- `git show 5a81672 --name-only`: `packages/ui-editor/src/bridge.ts` was **not touched** by the repair commit (last modified in the original candidate `505e0b1`). The commit message claims "EditorBridge.save() rolls back the session on a failed store write" — **the claim is false**.
- Probe-confirmed the pass-1 desync persists verbatim: with a store port whose `save` fails, `bridge.save()` returns `{ok:false, issues:[UI_DOC_STALE_REVISION …]}` but the session has ALREADY advanced `storedRevision 1→2` and reports `dirty=false` while the store still holds revision 1; the retry then saves revision 3, so the store **skips revision 2** — exactly the pass-1 MINOR-3 behavior, unchanged.
- Severity rationale: runtime effect remains latent-only in U1 (single-writer in-memory port cannot fail), so U1-04's criterion-level verdict is unchanged from pass 1 (PASS with a minor). But the candidate record now contains a **false repair claim** — that is a record-integrity defect (MAJOR, R2-1 below) and must be corrected before the U1 record is relied upon or cited as final.

### 4. U1-07 role=alert / U1-08 duplicate guard + budgets — **REPAIRED, VERIFIED (PASS)**
- Detail-route error feedback now `role="alert"` (code + live-verified with DATA_UNAUTHORIZED in the alert element).
- Studio "Run approve": `approveInFlight` JS guard + `disabled` + "Approving…" label. Race attacked live: two rapid clicks during the 800 ms latency window settled to a **single** structured result ("Approved in session preview-session-3"); in the real-input-event run the button was observed mid-flight as `disabled:true / "Approving…"`. Authored-button in-flight double-click on the detail route: exactly ONE approval entry (BUSY guard on the second dispatch).
- Budgets (my rerun of `test/measure-u1.ts`): workload 1,966 authored nodes / 100 repeated occurrences / 20 transactions → compile p95 **14.2 ms** (≤250), edit feedback p95 **8.7 ms** (≤100), scenario reset p95 **0.13 ms** (≤1000). PASS.

### 5. U1-01 spot-check (astral ordering) — **REPAIRED, VERIFIED (PASS)**
- `packages/ui/src/canonical.ts`: `compareCodePoints` now iterates real code points (`Array.from` + `codePointAt`), no longer UTF-16 `<`.
- Regression test in `packages/ui/test/document-model.test.ts` orders U+10000 after U+FFFD (UTF-16 units would invert this); focused run: 19/19 pass (included in the 155 package tests).

### 6. Regression scan — **NO NEW FAILURES**
| Suite | Result |
| --- | --- |
| `npx vitest run --project unit` | 126 files / **2463 passed** |
| `npx vitest run --project renderer` | 14 files / **108 passed** |
| `npx vitest run --project integration` | 1 file / **4 passed** |
| `examples/ui-authoring-proof && npx vitest run` | 4 files / **15 passed** (incl. 2 authored-button regression tests) |
| `packages/ui-preview` + `packages/ui` | 19 files / **155 passed** (3 new gate/double regression tests) |
| `npm run typecheck` | clean |
| `npm run format:check` | clean |
| `npm run check:ui` | 0 errors, 2 warnings (the two svelte a11y warnings on the studio canvas span — disclosed in pass 1, unchanged) |

Full root `npm test` was intentionally not re-run (out of declared scope; pass-1 environmental failures excluded per instructions). Nothing new failed anywhere I ran.

### 7. Browser journey — **PASS** (own dev server, killed afterwards; ports verified free)
| Check | Result |
| --- | --- |
| Supervisor approve via AUTHORED document button | status submitted→approved, activity 1→2, success feedback — real state change |
| Authored-button double-click inside the in-flight window | exactly ONE approval (guard repelled the second) |
| Technician denial via authored button | `role="alert"` DATA_UNAUTHORIZED; state unchanged |
| Studio canvas click | "Source node" occurrence selected |
| Canvas approve interaction | "Canvas interaction 'inspection.approve' settled in preview-session-1" — real PreviewSession dispatch, structured note |
| Run approve race (latency scenario) | single structured result; duplicate suppressed |
| Console (fresh tab, 3 routes) | **0 errors / 0 exceptions** (6 benign dev messages) |
Evidence: `evidence/repair2-detail-approved-1440x900.png`, `evidence/repair2-detail-denied-1440x900.png`, `evidence/repair2-studio-canvas-1440x900.png`, `evidence/repair2-studio-runapprove-1440x900.png`, `evidence/repair2-studio-1440x900.png`. Method note: coordinate-based trusted-input clicks missed on this display setup (diagnosed, environmental), so the journey drives real DOM `click` events via CDP `Runtime.evaluate`; the in-flight races are genuine concurrency attacks (second dispatch issued while the first is awaited).

## New findings

| ID | Severity | Area | Finding | User effect | Required next |
| --- | --- | --- | --- | --- | --- |
| R2-1 | **MAJOR (record integrity)** | U1-04 / candidate record | Commit 5a81672 claims MINOR-3 fixed ("EditorBridge.save() rolls back the session on a failed store write") but `bridge.ts` is untouched and the desync is probe-confirmed unchanged (session advances + reports clean on a failed store write; store skips a revision) | None at runtime in U1 (latent only); the record misleads the next integrator and would bite in U3-05's real store | Owner must either implement the rollback (port write before session mutation, or compensating restore) or amend the U1 record/commit note to state MINOR-3 is NOT repaired. The U1 record must not describe MINOR-3 as fixed. |
| R2-2 | NOTE | U1-07 | Studio preview-note denials (e.g. SIMULATED_FAILURE) remain polite `role="status"`; pass-1 MINOR-4 scoped the detail-route feedback, which IS fixed | Screen-reader users may miss studio preview denials | Optional: assertive role for studio error notes |
| R2-3 | NOTE | tooling | New dev-time Svelte warning `state_referenced_locally` at `routes/inspection/[id]/+page.svelte:45` (`data` captured outside a closure); svelte-check stays at 0 errors/2 known warnings | None (route params are static; dev warning only) | Optional cleanup |

## Not covered (time/scope boundary)
- Full root `npm test` (explicitly out of scope; pass-1 environmental failures not re-litigated).
- U1-02/U1-03 re-review (stand per scope; untouched by the repair diff except the disclosed example import fix).
- A permissions-less actor inside the browser UI (no such scenario actor exists there; covered at the package boundary by probes).
- Trusted-input (CDP mouse) coordinates were abandoned after a diagnosed viewport mismatch; races re-proven via synchronous double-dispatch + observed disabled state (see method note above).

## Verdict

**FINAL: U1-REPAIR GATE — PASS WITH NON-BLOCKING FINDINGS.**

BLOCKER-1 (U1-05) is genuinely repaired and survives adversarial re-attack in code, mounts, and the live browser; MAJOR-1 and MINOR-2 are fixed and probe-verified; MINOR-4, MINOR-5, and NOTE-1 are fixed; all suites, checks, budgets, and the browser journey are green with zero console errors. The one MAJOR finding R2-1 is not a runtime defect in the U1 proof — the pass-1 latent minor is simply still there while being claimed as fixed — so it does not block the gate, but the false repair claim in the candidate record MUST be corrected (implement the rollback or amend the claim) before the U1 record is treated as final and before U3-05 builds on save-failure semantics. The candidate may proceed to push as a passing gate with R2-1 recorded as an open owner action.
