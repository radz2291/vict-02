# U2 COMBINED CANDIDATE — INDEPENDENT RE-VERIFICATION ROUND 2 (addendum)

**Verifier:** same fresh independent verifier as round 1 (independent of the builder; no repairs performed by me).
**Date of re-verification runs:** 2026-10-07 09:10 → 09:45 (MPST).
**Round-1 verdict (unchanged, preserved):** FAIL at `2a1ab4c0843ac0512ce23519bbe3569d8479a116` — report imported verbatim as `docs/ui-foundation/reviews/u2/U2-COMBINED-VERIFY-04.md`.
**Round-2 verdict: PASS WITH NON-BLOCKING FINDINGS** at the repaired candidate below.

---

## 1. Candidate identity and remote match

| Item | Value |
| --- | --- |
| Repaired candidate tested | `471952bb5e9810ec30e370658f812cf9ae6a4eca` |
| Parent | `2a1ab4c0843ac0512ce23519bbe3569d8479a116` (round-1 FAIL candidate) |
| Branch | `codex/ui-foundation-u2` |
| `git ls-remote origin refs/heads/codex/ui-foundation-u2` | `471952bb5e9810ec30e370658f812cf9ae6a4eca` — **MATCH** |
| Working tree at test time | tracked files clean; only my untracked evidence + this report |
| Verifier worktree | `C:/Users/RZ1/Desktop/RZ/vict-02-u2-combined-verify` (detached at the candidate; preserved) |

## 2. Diff boundedness (2a1ab4c..471952b, 72 files)

**Within the declared scope — confirmed:**

| Area | Files |
| --- | --- |
| F-1 repair | `packages/ui-editor/src/EditorCanvas.svelte` (selection mark now applied as a `data-ui-selected` attribute on the exact selected occurrence via Svelte effect + tick, cleared before re-marking; static CSS rule `.uv-canvas [data-ui-selected] { outline: 2px solid var(--ui-editor-selected, #2b6cff) }`; dead per-selection `<style>` block removed) |
| F-1 regression | `packages/ui-editor/test/editor-tooling-u2.svelte.test.ts` (+27: pins exactly one marked element with the exact occurrence key) |
| F-2 repair | `examples/ui-design-proof/src/design-host.css` (≤860px: `min-height: 0` on `.wb-main`/`.wb-canvas-scroll` so the canvas scrolls internally) |
| Records | `docs/ui-foundation/u2-ux/FINDINGS.md` (+54), `docs/ui-foundation/reviews/u2/U2-UX-INTEGRATION-01.md` (+36 round-2 section), `docs/ui-foundation/reviews/u2/.gitattributes` (new, `-text` scopes for the imported evidence + report) |
| Verbatim import | `docs/ui-foundation/reviews/u2/U2-COMBINED-VERIFY-04.md` — **sha256 `4f43202343096cb60dcea89cf102c77ceaa4503d2364ffb8bd91578848061957`, byte-identical to my round-1 `u2-COMBINED-VERIFY-draft.md` (verified both directions)**; `reviews/u2/combined-verify-evidence/` (harness, journeys, shots, check logs) — 5/5 spot-checks byte-identical (j6.mjs, helpers.mjs, j4 journey JSON, j7 screenshot, vitest-renderer.txt) |
| Refreshed screenshots | 4 integration selected-state PNGs (small byte deltas, consistent with the outline now rendering) |

**Nothing outside the declared scope.** No engine/compiler/session/store/renderer files touched; Inspector.svelte/InspectorControl.svelte untouched by the delta.

## 3. Automated checks at 471952b (my runs, exact numbers)

| Check | Result | Log |
| --- | --- | --- |
| `npx vitest run --project renderer` | **PASS — 125/125 (18 files)**, includes the new selection-outline regression | `round2-vitest-renderer.txt` |
| `npx vitest run --project unit packages/ui/test packages/ui-editor/test` | PASS — 70/70 (7 files) | `round2-vitest-unit.txt` |
| `npx vitest run --project integration` | PASS — 4/4 | `round2-vitest-integration.txt` |
| `npm run test -w ui-design-proof` | PASS — 12/12 | `round2-vitest-design.txt` |
| `npm run typecheck` (root) | PASS — 0 errors | — |
| `npm run check:ui` | PASS — 0 errors / 2 known warnings (`RenderNode.svelte:172`) | `round2-check-ui.txt` |
| Broad `svelte-check --tsconfig examples/ui-design-proof/tsconfig.check.json` | PASS — 0 errors / 2 warnings (same two known) | `round2-broad-svelte-check.txt` |
| `npm run typecheck -w ui-design-proof` | PASS — clean | — |
| `npm run build -w ui-design-proof` | PASS — production build + adapter-node complete | `round2-design-build.txt` |
| `npm run format:check` before AND after the design build | **FAIL — "Code style issues found in 40 files"**, identical before and after | `round2-format-before-build.txt`, `round2-format-after-build.txt` |

**Format:check failure detail (new finding NF-1):** all 40 flagged files are the imported verifier evidence — 24 under `reviews/u2/combined-verify-evidence/harness/` (my .mjs harnesses) and 16 under `…/journeys/` (my journey JSONs). The candidate's `.prettierignore` was not extended for the new `docs/ui-foundation/reviews/u2/combined-verify-evidence/` directory (the round-1 ignore covered only the `u2-ux/` evidence dirs). The bytes themselves are correct and MUST stay verbatim (verified identical to my originals); the fix is a records-only `.prettierignore` extension (or amending the record). **The round-2 record's battery claim "…; format clean" is therefore NOT REPRODUCED at the pushed commit** — most plausibly the check was run before the evidence import landed in the same commit. Product behavior is unaffected; the evidence-protection doctrine (verbatim bytes) dominates reformatting, consistent with prior program treatment of imported-evidence formatting artifacts. Recorded as non-blocking with a required records correction.

Environment note: `npm run build -w @victframework/ui-editor` still fails with the same 4 pre-existing TS2307 errors (F-3, re-confirmed at this candidate; not a claimed gate, nothing consumes the dist).

## 4. Real-Chrome journeys (puppeteer-core 24.43.1 + Chrome 155.0.8059.26, port 5210 --strictPort, dedicated profile)

**Page exceptions: 0 across all 8 journeys.** One console-noise entry per journey (`favicon.png` 404) — falsified as pre-existing: app.html declares `favicon.png` which is absent from `static/` at BOTH `2a1ab4c` and `471952b` (probe run at both SHAs). Cosmetic, not a page exception.

| # | Demonstration | Round-2 verdict | Observed |
| --- | --- | --- | --- |
| E1 | Shared blue / attached / instance overrides | **PASS 7/7** | Identical to round 1: blue `rgb(29, 78, 216)` on Kitchens+Bathrooms, Adaptations keeps `rgb(231, 242, 236)`, instance pink `rgb(255, 105, 180)` only on Adaptations; annotations honest throughout |
| E2 | Reset reveals next cascade value; one-step undo | **PASS 7/7** | Identical to round 1: reset → soft-green; one Undo → pink; Redo → soft-green |
| E3 | Undo/Redo + save/reload/reopen (heading 61px) | **PASS 12/12** | Identical to round 1: 56px↔61px with annotations; saved rev 2; reload + Reload stored preserve 61px + annotation |
| E4 | Browser-now == actual across states; no dirtying | **PASS 7/7 agree** | 56px/51.2px/51.2px(container)/30px(media narrow)/card border normal-hover-leave `rgb(217,210,197)`→`rgb(31,111,84)`→back; rail + history unchanged; 0 Applied commands |
| E5 | Linked padding one transaction | **PASS 6/6** | 29px on all four sides, ONE Applied entry, ONE Undo restores 72/0/24/0px |
| **E6** | **Selection outline + sync (F-1 repair)** | **PASS 14/14 — REPAIRED** | Computed `outline-style: solid`, color `rgb(43, 108, 255)` (#2b6cff), on the exact selected occurrence after mouse AND Layers keyboard selection; `data-ui-selected` on **exactly one** element at all times; mark **moves** to the heading on re-selection and the card reverts to `none`; all round-1 sync checks (search, Escape, keyboard walk, breadcrumb, aria-selected) still pass. Screenshots `shots/j6-02/04/05*.png` |
| E7 | Storage refusal preserves bytes + banner | **PASS 7/7** | Identical to round 1: PRESERVED banner, byte-identical bytes through reload + refused save, `UI_STORE_CORRUPT` logged, banner persists |
| **E8** | Responsive editing + first screen at 390 (F-2 repair) | **PASS 10/10 — REPAIRED** | Text size control **within the first screen at 390×844: x=22, y=681.7, in-viewport TRUE** (round 1: y=3498.9); no horizontal overflow (375≤390); edits still work at 1440/1024/390/480-container with annotation==actual (at 390 the committed local 64px is honestly reported against the winning narrow rule 30px); `/editor-review` still loads and edits. Screenshots `shots/j8-03/04*.png` |

Journey JSONs updated in place under `combined-verify-evidence/journeys/` (round-2 runs); round-1 journeys remain preserved verbatim in the candidate at `docs/ui-foundation/reviews/u2/combined-verify-evidence/`.

## 5. Findings (round 2)

- **NF-1 (non-blocking; records correction required)** — `format:check` fails at this candidate (40 files, all imported verifier evidence) and the round-2 record's battery line "…; format clean" is not reproducible at the pushed commit. Required correction: extend `.prettierignore` to `docs/ui-foundation/reviews/u2/combined-verify-evidence/` **or** amend the record to disclose the failing check. Do NOT reformat the evidence bytes (their verbatim identity is the point; verified identical to my originals). User effect: none (repo hygiene gate only).
- **NF-2 (non-blocking, pre-existing)** — `favicon.png` 404 console noise: declared in `app.html`, absent from `static/` at both candidates. Cosmetic; 0 page errors.
- **F-3, F-4 (non-blocking, carried)** — F-3 re-confirmed unchanged (same 4 pre-existing TS2307s in the ui-editor workspace build). F-4 stands (Inspector untouched by this delta).
- **No drift** detected in E1–E5/E7 vs round 1: identical assertion counts and values.

## 6. NOT DEMONSTRATED (round 2)

1. Literal browser-process restart (page reloads only) — carried disclosure.
2. Owner/founder experience acceptance — outside my scope; this verdict does not substitute for it.
3. The "format clean" battery claim — demonstrated FALSE at this commit (see NF-1); listed here so it is not smoothed over.

## 7. Final verdict (round 2)

**PASS WITH NON-BLOCKING FINDINGS** at `471952bb5e9810ec30e370658f812cf9ae6a4eca`.

- Both round-1 findings are genuinely repaired and independently re-verified in real Chrome: F-1 (selection outline solid, exactly one marked element, moves/clears correctly, regression-pinned at 125/125) and F-2 (Text size control in the first screen at 390×844, canvas scrolls internally, no overflow, editing intact).
- The full regression battery holds (E1–E5, E7 identical to round 1; all suite numbers unchanged except renderer 124→125 with the new regression).
- Remaining non-blocking: NF-1 (failing repo format gate on imported verbatim evidence + inaccurate "format clean" record line — records-only correction required, do not touch evidence bytes), NF-2 (pre-existing favicon 404 noise), F-3/F-4 carried.
- Owner experience acceptance and U2 closure remain pending and are not granted by this verdict.

## 8. Round-2 evidence index (under `combined-verify-evidence/`)

- Journeys (round-2 runs, JSON): `journeys/j1…j8` (updated in place)
- Harness additions (mine): `harness/probe-404.mjs`; `harness/j6.mjs` extended with outline assertions
- Check logs: `round2-vitest-renderer.txt` (125/125), `round2-vitest-unit.txt`, `round2-vitest-integration.txt`, `round2-vitest-design.txt`, `round2-check-ui.txt`, `round2-broad-svelte-check.txt`, `round2-design-build.txt`, `round2-format-before-build.txt`, `round2-format-after-build.txt` (fail), `round2-dev-server.log`
- Screenshots (33 in `shots/`; **round-2 captures under the journey filenames below** — the round-1 originals of the same names remain preserved verbatim in the candidate at `docs/ui-foundation/reviews/u2/combined-verify-evidence/shots/`): key round-2 evidence `shots/j6-02-mouse-selected.png`, `shots/j6-04-keyboard-selected.png`, `shots/j6-05-outline-moved.png` (new: outline moved to heading), `shots/j8-03-390x844-first-screen.png` (Text size control in first screen), `shots/j8-04-390-edited.png`; plus refreshed `j1-*`–`j5-*`, `j7-*`, `j8-01/02/05/06` captures

Cleanup: dev server (port 5210) killed after runs; Chrome profile removed; tracked tree clean; nothing pushed; worktree + evidence preserved.
