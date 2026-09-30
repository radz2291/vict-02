# VICT Stage 9 G3-A Fresh Gate Verification — 2026-09-30

- **Target**: integrated candidate `d014d62a9a8cd719edc9eeb58c48a2aacdb1bdcf` (`codex/stage9-g3-proposal`)
- **Verifier**: independent fresh-clone verifier (no repo writes except this report branch)
- **Environment**: Windows / bash; fresh clone of `https://github.com/radz2291/vict-02.git`
- **Report branch**: `review/stage9-g3-a-verification-20260930` (this file only)

## 0. HEAD verification

- `git ls-remote origin codex/stage9-g3-proposal` → `d014d62a9a8cd719edc9eeb58c48a2aacdb1bdcf` (branch has **not moved**).
- Local checkout `rev-parse HEAD` → `d014d62a9a8cd719edc9eeb58c48a2aacdb1bdcf`. ✅ match.

## 1. Setup

- `npm ci` clean; `npm run build` on runtime, control, sdk, application, ui, ui-svelte (plus contracts/kernel built for the studio's dist-consumption path) — all clean.

## 2. Criterion-by-criterion verdict

| Criterion | Verdict | Evidence |
|---|---|---|
| **(a) Definition-driven navigation** | **PASS** | `packages/application/src/compile.ts`: `rowDetail` appears **only** in `SURFACE_FIELDS_V2` on `'view'` and `'table'` (lines ~254–317). `collectRowDetailIssues` (compile.ts ~3760–3855) enforces: plain object only; closed shape `routeId`/`label`/`param` (unknown sibling fields rejected via `collector.unknownFields` against `TABLE_ROW_DETAIL_FIELDS`); non-empty string `routeId`; **unknown routeId → `UNKNOWN_ROUTE_REFERENCE`**; unknown route param name → `INVALID_SURFACE_DECLARATION`; non-empty `label`; plain-object `param` whose mapped row fields are validated through `collectViewFieldIssues` — **unknown row fields still rejected** (closure test present and run: `packages/application/test/row-detail.test.ts`, 5/5 pass, incl. "STILL rejects an unknown sibling surface field (the closure stays closed)"). **Falsification**: renderer link derives **only** from the plan — `Surface.svelte:143–147` (`viewIntent?.rowDetail` → `resolveRowDetailLink`) and `TableAdapter.svelte:187–193` (`intent.rowDetail` → `resolveRowDetailLink`, `logic.ts:597–645`). No host prop, dispatch, or renderer-internal seam can inject a navigation link outside the definition binding; grep over the renderer found no such injection path. |
| **(b) Absent binding = byte-identical / no link** | **PASS (negative present in all three suites)** | `packages/ui/test/row-detail.test.ts` ("absent → rowDetail undefined", 5/5); `packages/ui-svelte/test/row-detail.test.ts` (zero-link negatives without binding, 7/7, renderer project 105/105 total); `apps/studio/tests/ui/render.test.ts` ("renders surfaces WITHOUT a rowDetail binding with no links (FT-1 negative)" → `a[href]` length 0). Full studio suite 85/85. |
| **(c) Real-Studio navigation journey** | **OUT OF SCOPE** — deferred to G3-B per handoff §3 note. Not verified here. | — |
| **(d) Navigation-only scope** | **PASS** | Diff audit `57cc938..1d257f8` (G3-A lane): exactly 17 files +912/−21; only compile.ts (additive validation + closed `rowDetail` acceptance), `definition.ts` (one binding + label copy), ui/ui-svelte affordance, sdk **type-only** additions. `styles.css` change is exclusively row-link affordance CSS (`.vict-ui-table__row-link`, `.vict-data-view__row-link` colors/underline/focus/nowrap) — no style-system tokens or surface styling changed. No data surface, command, read scope, confirmation, or changeSet hunk in the G3-A lane. The integrated `57cc938..d014d62` diff additionally contains the **G3-C lane** (isolated `1d257f8..d014d62`: quellight-transport.ts, targets.ts additive entry, product/+page.* server/page, quellight-transport tests, app-definition test cast fix a9b099d — a svelte-check-only unknown-cast change, and prettier 941dda9) and qa-artifacts — all disjoint from the navigation/read/command/style-system lanes and pre-declared as the A+C integration by commit 07cfe5c. **No unauthorized scope found.** |
| **(e) Suites at d014d62** | **PASS (environmental deltas noted)** | See §3 counts. Expected totals match; only pre-existing environment-dependent failures (Windows) observed at baseline too. |

## 3. Suite counts recorded at d014d62

| Suite | Result | Note |
|---|---|---|
| Root unit (`npm run test:unit`) | **2414 total — exactly the expected count**; 2405 passed, 7 failed + 2 skipped | 7 failures are pre-existing/environment-dependent: restart-sigkill (SIGKILL cross-process), scaffolder real SvelteKit build in-process, store-sqlite cross-process/HIGH-3 (20s timeout), kernel child-process determinism. All replicate at baseline `57cc938` in a same-machine worktree (2+6 failures reproduced there directly). **Non-blocking, environmental (Windows runner), not a G3-A regression.** |
| Studio vitest (`apps/studio`) | **85/85 pass** (10 files) | matches handoff expectation |
| Renderer project (`--project renderer`) | **105/105 pass** (13 files), incl. row-detail 7/7 | |
| Focused: application row-detail | 5/5 | closure/negative present |
| Focused: ui row-detail | 5/5 | absent-binding negative present |
| Focused: ui-svelte row-detail | 7/7 | genuine-anchor tests |
| `npx tsc --noEmit` (root) | exit 0 | |
| `apps/studio npm run check` | exit 0 | |
| `npm run lint` (eslint .) | exit 0 | |
| `npm run format:check` | "All matched files use Prettier code style!" exit 0 | |
| `node scripts/verify-stage9-inventory.mjs` | **INVENTORY OK — G1 reads on all three surfaces UNAMENDED; G2 confirmation surface accounted.** |

## 4. Falsification: no dispatch-only stub remains

- `RecordsTable.svelte` and `DataView.svelte` render real `<a href={link.href}>` anchors derived from `resolveRowDetailLink` (logic.ts). `preventDefault` is called **only** in `onRowLinkClick` when `navigate` is provided AND the click is an **unmodified left-click** (guards `defaultPrevented | metaKey | ctrlKey | shiftKey | altKey | button !== 0` → always fall back to the native href). Modifier-click / keyboard (Enter) / no-host paths follow the raw href. **Genuine affordance confirmed; the G4-audit dispatch-only-button regressive pattern is absent.**
- `grep preventDefault` occurrences are the established form-submit/internals patterns, none of them unconditional on row links.

## 5. Builder-report cross-check

- `codex/stage9-g3-a-navigation` @ `1d257f8a51a3349b33c182ce5a8953ec1c57f347` fetched; `git merge-base --is-ancestor 1d257f8 d014d62` → **contained** (a9b099d integration lineage records it).
- Claims check: **17 files +912/−21** — exact match with `git diff --stat 57cc938..1d257f8`. File list matches the declared lanes. The "compile.ts authorized-additive" claim holds (existing validators untouched; only the closed new member + its collector + derivation passthrough added — the `STAGE04_SURFACE_FIELD_SETS` spread pattern is additive). The "sdk TableRowDetail type" addition is real and additive. The "render.test.ts contradiction-fix" corresponds to the label copy change in `definition.ts` + render.test.ts updates (39 lines touched) — consistent.
- **Judgment call — sdk `TableRowDetail` in `packages/sdk/src/application.ts`:** this is the **authoring-side definition vocabulary** that `compile.ts`'s authorized `rowDetail` extension validates against; without it the accepted shape has no declared type in the authoring model. It is type-only (no runtime export change), additive, and mirrors the existing `TableRowAction` pattern. **Verdict: WITHIN the authorized compile.ts extension's spirit — accepted.**
- Nothing in the builder lane was found beyond the authorized scope.

## 6. Studio definition

- `apps/studio/src/lib/application/definition.ts`: exactly one `rowDetail` binding, on the run-list `view` surface `vw.runs`: `{ routeId: 'run-detail', label: 'Open run', param: { runId: 'runId' } }` (grep confirms a single occurrence).
- `apps/studio/tests/app-definition.test.ts` asserts the exact binding, the `/runs/:runId` route path, and that **exactly one** bound surface exists across the whole plan (`bound).toHaveLength(1)` → `vw.runs`). Navigation-only scope asserted by test. ✅ (passed inside the 85/85 studio run).

## 7. VERDICT

**G3-A gate: PASS WITH NON-BLOCKING FINDINGS**

| # | Finding | Severity |
|---|---|---|
| F-1 | 7 root-unit failures are environmental (Windows: no SIGKILL semantics, in-process SvelteKit scaffolder build, cross-process sqlite timing) — reproduce at base commit `57cc938` on the same runner; not G3-A attributable. Non-Windows CI re-run recommended for the pristine 2414/2414 record. | NON-BLOCKING (informational) |
| F-2 | Criterion (c) real-Studio navigation journey intentionally deferred to G3-B per handoff §3 — not a finding against G3-A. | NOTE |
| F-3 | ui-svelte row-detail suite took ~117s wall in happy-dom on this runner (transform-heavy); slow but green. | NON-BLOCKING (perf note) |

**Gate outcome: PASS (G3-A criteria a, b, d, e all satisfied; falsifications clean; builder claims accurate; scope audit clean).**