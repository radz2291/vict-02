# U2 COMBINED CANDIDATE — FRESH INDEPENDENT VERIFICATION (draft)

**Verifier:** fresh independent verifier (vict-verifier), not the builder of any track.
**Date of verification runs:** 2026-10-06 23:17 → 2026-10-07 09:00 (MPST).
**Status: VERIFICATION COMPLETE. Verdict: FAIL (one blocking finding; 7 of 8 demonstrations otherwise pass).**

---

## 1. Exact candidate and remote match

| Item | Value |
| --- | --- |
| Candidate tested | `2a1ab4c0843ac0512ce23519bbe3569d8479a116` |
| Branch | `codex/ui-foundation-u2` |
| `git rev-parse` (local) | `2a1ab4c0843ac0512ce23519bbe3569d8479a116` |
| `git ls-remote origin refs/heads/codex/ui-foundation-u2` | `2a1ab4c0843ac0512ce23519bbe3569d8479a116` — **MATCH** |
| Merge commit `1a61389e7529e9501c903b7c30f5c752bfa30593` parent 1 | `e0893feebc3e9783b7a29026c2285929819f86bb` (U2 manager track) — **MATCH** |
| Merge commit `1a61389e7529e9501c903b7c30f5c752bfa30593` parent 2 | `f31477d804d561f29bcd33fb89050699bfe659a4` (UX track tip) — **MATCH** |
| Working tree at test time | clean (`git status --porcelain` empty; only my untracked evidence dir) |
| Verifier worktree | `C:/Users/RZ1/Desktop/RZ/vict-02-u2-combined-verify` (detached HEAD at the candidate; preserved for import) |

Lineage verified with `git cat-file -p 1a61389…` (both parents recorded in the merge object).

## 2. Environment

| Item | Value |
| --- | --- |
| OS | Windows (local workstation) |
| Node / npm | v22.13.1 / 11.19.1 |
| Chrome | 155.0.8059.26 (real Chrome, `C:/Program Files/Google/Chrome/Application/chrome.exe`, driven via puppeteer-core 24.43.1, dedicated user-data-dir, removed after runs) |
| Server | `npx vite dev --host 127.0.0.1 --port 5210 --strictPort` from `examples/ui-design-proof` (own port; killed after runs) |
| Install | `npm ci --ignore-scripts` (unchanged lockfile) |
| Journeys | 8 scripted real-Chrome journeys (`combined-verify-evidence/harness/j1..j8.mjs`), JSON logs in `combined-verify-evidence/journeys/`, 32 screenshots in `combined-verify-evidence/shots/` |

Journey interactions were real user-path interactions: Layers search typing, tree-item mouse clicks, ArrowDown/Enter keyboard walks, color-picker commits, numeric/text field typing with blur-commit, rail button clicks (Undo/Redo/Save/Reload stored), viewport resizes, `page.hover`, preview-size select changes, full page reloads, and behind-the-app localStorage corruption.

## 3. Checksum verification (recorded vs in-tree, sha256sum)

| File | Recorded | In-tree at candidate | Result |
| --- | --- | --- | --- |
| `independent-review/n1-recheck/REVIEW.md` | `1717c185272481830eb2f44eabd10c1695a6cf7e8ff137bf45b4b6e768c3bf43` | `1717c185272481830eb2f44eabd10c1695a6cf7e8ff137bf45b4b6e768c3bf43` | MATCH |
| `independent-review/iteration2-candidate/ITERATION-2-REVIEW.md` | `a9e8551093779d507d604f626afd8ec803d3f896d94221f70acff1e09a9944da` | `a9e8551093779d507d604f626afd8ec803d3f896d94221f70acff1e09a9944da` | MATCH |
| `independent-review/ROUND-1.md` | `b99907f938d399066abb8cc060a0cd26f05e8949c747d3c2ce79633224678efa` | `b99907f938d399066abb8cc060a0cd26f05e8949c747d3c2ce79633224678efa` | MATCH |
| `independent-review/ROUND-2.md` | `6abbd9f0515bbdc01db851bbefb27ef202737d4f8e8e7ba703943832c1be05d6` | `6abbd9f0515bbdc01db851bbefb27ef202737d4f8e8e7ba703943832c1be05d6` | MATCH |
| `independent-review/n1-candidate/REVIEW.md` | `cef997252bc91870aaede31214b9cf03e9d344330d34e9f2dc20731a5d3a65f2` | `cef997252bc91870aaede31214b9cf03e9d344330d34e9f2dc20731a5d3a65f2` | MATCH |

History distinction for ITERATION-2-REVIEW.md, verified:

- Git blob OID of the file at `f31477d` and at `1a61389` is identical (`72761c1e…`), raw sha256 of content = `a927c3d38855f79751f9de9217dfc10b8bad7ab89fbd5f99740f9b4d2b8c689f`, 11081 bytes, **0 CR bytes** (ends `2e 0a 0a`).
- At the candidate `2a1ab4c` the file is 11082 bytes, **exactly 1 CR** (final blank line CRLF-terminated, ends `0a 0d 0a`), raw sha256 = `a9e85510…`.
- Stripping CR from the candidate blob yields exactly `a927c3d3…` — **content identical modulo one trailing CR**, as claimed. The scoped protection `docs/ui-foundation/u2-ux/.gitattributes` exists at the candidate.

## 4. Automated checks (my own runs, exact numbers)

| # | Check | Result |
| --- | --- | --- |
| 1 | `npm run typecheck` (root) | PASS — 0 errors (clean exit) |
| 2 | `npm run check:ui` | PASS — 0 errors / 2 warnings (both the known a11y warnings, `packages/ui-svelte/src/document/RenderNode.svelte:172`) |
| 3 | `npx svelte-check --tsconfig examples/ui-design-proof/tsconfig.check.json` (broad) | PASS — **0 errors / 2 warnings in 1 file**, both at `RenderNode.svelte:172`. Log: `combined-verify-evidence/broad-svelte-check.txt`. (First attempt without built workspaces returned 138 errors, 60 of them `Cannot find module '@victframework/…'`; after building contracts/ui/sdk/application/ui-svelte it is 0/2 — logs preserved: `broad-svelte-check-before-workspace-build.txt`) |
| 4 | `npx vitest run --project renderer` | PASS — **124/124 (18 files)** |
| 5 | `npx vitest run --project unit packages/ui/test packages/ui-editor/test` | PASS — **70/70 (7 files)** |
| 6 | `npx vitest run --project integration` | PASS — **4/4 (1 file)** |
| 7 | `npm run test -w ui-design-proof` | PASS — **12/12 (1 file)** |
| 8 | `npm run typecheck -w ui-design-proof` | PASS — clean |
| 9 | `npm run build -w ui-design-proof` | PASS — production build + adapter-node complete |
| 10 | `npm run format:check` before AND after the build | PASS both times — "All matched files use Prettier code style!" (log: `format-check-after-build.txt`) |

Environment observation (not a claimed check, not repaired): `npm run build -w @victframework/ui-editor` fails with TS2307 (`Cannot find module './EditorCanvas.svelte'` ×4) in any environment — the package has no Svelte d.ts shim and its tsconfig is `noEmit`; the package exports point at `./src/index.ts` directly, so nothing consumes its dist. Not part of the builder's claimed gates; recorded for completeness.

## 5. Real-Chrome demonstrations — verdict table

Occurrence ids observed in the canvas are composite (`doc.northwind|<node>` / `doc.northwind|svc.card|svc.cardX@def.serviceCard` for component-instance roots). Seed values confirmed: Kitchens/Bathrooms card background `rgb(255, 255, 255)`, Adaptations attached soft-green `rgb(231, 242, 236)`, heading font-size 56px at 1440 window (clamp 34px/5vw/56px), 30px at ≤700px window (cond.narrow).

| # | Demonstration | Verdict | Observed (key values) | Evidence |
| --- | --- | --- | --- | --- |
| E1 | Shared blue preserves attached/instance overrides | **PASS** (7/7 assertions) | Shared blue `#1d4ed8` → Kitchens `rgb(29, 78, 216)`, Bathrooms `rgb(29, 78, 216)`, Adaptations stays `rgb(231, 242, 236)`; instance pink `#ff69b4` → Adaptations `rgb(255, 105, 180)` only; Kitchens/Bathrooms stay blue. Browser-now annotations matched at every step (white → blue → pink). | `journeys/j1-shared-override.json`; `j1-01…j1-04*.png` |
| E2 | Reset removes only the intended override, reveals next cascade value; one-step Undo | **PASS** (7/7) | Reset on pink instance → Adaptations back to `rgb(231, 242, 236)` (attached value), Kitchens/Bathrooms stay `rgb(29, 78, 216)`; ONE Undo → pink `rgb(255, 105, 180)` restored; Redo → soft-green again; annotation after reset honest ("No declaration here…"). | `journeys/j2-reset-undo.json`; `j2-01/j2-02*.png` |
| E3 | Undo/Redo and save/reload/reopen preserve heading edits | **PASS** (12/12) | Baseline 56px computed + annotation (textual editor shows `clamp(34px, 5vw, 56px)`); type 61 → computed `61px`, annotation `61px`; Undo → `56px` + annotation (clamp restored); Redo → `61px`; Save → "Saved stored revision 2"; full reload → `61px`; Reload stored → `61px` + annotation `61px` (re-selection after reopen, which clears selection by design). | `journeys/j3-undo-redo-persist.json`; `j3-01…j3-04*.png` |
| E4 | Browser-now matches actual after edits/resizing/live states; measuring never dirties source | **PASS** (7/7 samples agree; rail + activity unchanged) | 1440×900 → 56px=56px; 1024×800 → 51.2px=51.2px; preview 390 (container) → 51.2px=51.2px (vw is window-relative; ResizeObserver refresh exercised); window 390×844 (media narrow) → **30px=30px** (conditional rule wins, annotation follows); Kitchens card border-color normal `rgb(217, 210, 197)` → hover `rgb(31, 111, 84)` → leave `rgb(217, 210, 197)`, annotation matches at each settled sample. Rail text and history unchanged by all measuring; 0 new Applied commands. | `journeys/j4-browser-values.json`; `j4-01…j4-05*.png` |
| E5 | Linked padding = one undoable transaction | **PASS** (6/6) | Link sides → type 29 into `padding top` → all four inputs `29px`, all four computed `29px`; exactly ONE "Applied setStyleDeclaration on svc.hero" activity entry; ONE Undo → computed back to previous 72/0/24/0px and inputs restored. | `journeys/j5-linked-padding.json`; `j5-01…j5-03*.png` |
| E6 | Layers search + keyboard selection synchronized; canvas outline + breadcrumb follow | **FAIL (one sub-item) / sync 10/10** | Search "Bathrooms" → "3 matches · ancestors shown"; mouse-select exact card root (`…\|svc.cardBathrooms@def.serviceCard`) → breadcrumb "Location · Bathrooms card" (full "Bathrooms card / Card"); Escape → search cleared, normal tree (39 rows) returns, selection persists; keyboard: ArrowDown focuses exact card row, Enter selects → breadcrumb + Layers `aria-selected` follow. **BUT the canvas selection outline never renders** (see Finding F-1): computed `outline-style: none` after mouse AND keyboard selection. Hover dashed outline (`:hover` rule) does render. | `journeys/j6-layers-search-keyboard.json`; `j6-00…j6-04*.png` |
| E7 | Storage refusal preserves bytes; warning stays visible | **PASS** (7/7) | Save rev 2 → corrupt bytes behind app's back → reload → banner: "⚠ Stored design data is unreadable and has been PRESERVED (stored authoring data is not valid JSON (stored bytes preserved)). Save will fail until the site data for this key is cleared."; bytes byte-identical after reload AND after save attempt; activity: "error: Save FAILED (UI_STORE_CORRUPT): refusing to overwrite preserved data…"; banner still visible; editor fell back to seed (56px). Wording is honest, does not overstate persistence. | `journeys/j7-storage-refusal.json`; `j7-01/j7-02*.png` |
| E8 | Usable editing at 1440/1024/390/480-container; editor-review route | **PASS with one failed sub-item** | Edits: 62px@1440, 63px@1024, 65px@480-container — computed + annotation agree each time; at 390 the edit commits locally (`64` in control) and annotation=actual=`30px` (cond.narrow wins over the local override — honest difference display). No horizontal overflow at 390 (`scrollWidth` 375 ≤ 390) or at any size. Rail + Inspector reachable at all sizes; undo after each edit. `/editor-review` loads, canvas-click selects the h1 ("Location · Heading · Make room for better work"), Style tab shows the Text size control, Layers present. **FAILED sub-item: Text size control NOT visible in the first screen at 390×844** — measured at x=22, y=3498.9 (below the full-height stacked canvas), see Finding F-2. | `journeys/j8-responsive-editor-review.json`; `j8-01…j8-06*.png` |

**Page exceptions: 0 across all 8 journeys** (each journey collected `pageerror` + console errors; zero recorded).

## 6. Honesty checks

- "Browser now" never claimed a value the canvas did not show: verified across 7 live samples (E4), 4 edit states (E1/E3), reset/undo transitions (E2), and the 390 narrow-cascade case (E8) — **no mismatch found anywhere**.
- Banner wording is precise about what happened to stored bytes (PRESERVED, save will fail, how to recover) — no overstatement (E7).
- Save/Unsaved + stored-revision status text matched reality at every sample (E3/E4/E7).
- The `differs` note ("Browser now: … / Resolved in preview") correctly appears when a committed local value differs from the previewed cascade result (E8 at 390).

## 7. Findings

### F-1 (BLOCKING) — Canvas selection outline silently never renders
- **What:** `packages/ui-editor/src/EditorCanvas.svelte:97` emits the selection rule as literal text:
  `.uv-canvas [data-ui-occ='{escapeSelector(selectedOccurrence)}'] { outline: 2px solid … }` inside a `<style>` block. Svelte does not interpolate `{…}` inside `<style>`, so the selector string is verbatim `{escapeSelector(selectedOccurrence)}` and matches nothing. Verified live: after selecting (mouse and keyboard), the selected element's computed `outline-style` remains `none` while the live stylesheet contains the un-interpolated literal.
- **User effect:** the persistent "what is selected" highlight on the canvas is absent. Selection still works functionally everywhere (Inspector breadcrumb, Layers `aria-selected`, editing targets — proven in E1–E6); the `:hover` dashed outline still renders, so there is partial feedback while the pointer stays on the element. But the designed selection affordance is dead UI.
- **Lineage:** byte-identical at `83ba87f` (N1-verified base), `19bb4b9` (U2 recheck candidate), `e0893fe` (manager tip), `f31477d` (UX tip). Introduced in `7f49cd0` (U1-era editor modules, 2026-10-06 06:25 +0800). **Not an integration regression** — but also **never verified before**: no retained report (`reviews/u2/*`, `independent-review/*`) mentions the outline at all. This verification is the first to test it.
- **Why blocking:** E6 explicitly requires "canvas outline + Inspector breadcrumb follow". A required, user-visible affordance is silently inert — the same class of failure (silently inert CSS) that failed the U2 round-1 technical gate. It is a one-line-class repair (compute the selector string in script and bind it), but repairing it is the manager's task, not mine.

### F-2 (NON-BLOCKING, moderate) — Text size control not visible in the first screen at 390×844 on the workbench
- **What:** at 390×844 the workbench stacks rail → full-height canvas → inspector (≤860px CSS); the Text size input sits at y≈3499px (document top), i.e. below roughly four screens. Criterion item "Text size control visible in the first screen at 390" fails on the workbench route.
- **User effect:** phone-size users must scroll the entire rendered page to reach editing controls. Editing IS reachable and works (typed 64 successfully; no horizontal overflow; honest annotations), and the dedicated `/editor-review` route provides proper mobile panel tabs — but the workbench route itself fails the stated first-screen expectation.
- **Scope:** workbench CSS/layout (`design-host.css` ≤860px rules + inspector below the unconstrained canvas), not the Inspector component.

### F-3 (NON-BLOCKING, minor) — `npm run build -w @victframework/ui-editor` fails with TS2307 (pre-existing)
- The ui-editor workspace build script cannot resolve `.svelte` imports (no shim, `noEmit` config). Nothing consumes its dist (exports point at `src`), the root typecheck excludes it, and it is not a claimed gate. Recorded so nobody mistakes it for a new breakage.

### F-4 (NON-BLOCKING, minor) — Inspector scope state persists across selection changes
- After setting scope to "This instance" for one card, selecting another card retains the instance scope (observed during E1 setup). Behavior is consistent and the scope badge always shows the active destination, so no misdirection was observed; noted as a UX sharp edge only.

## 8. Explicitly NOT DEMONSTRATED (claims I could not verify)

1. **Canvas selection outline** (E6 sub-item) — demonstrated to NOT work (F-1). This also means the prior records' implied "canvas→Inspector selection" visual affordance was never evidenced anywhere in the retained reports.
2. **Text size control visible in the first screen at 390** (E8 sub-item) — demonstrated to NOT hold on the workbench route (F-2).
3. **Literal browser-process restart** — not performed (same as prior disclosures); page reloads were performed, Chrome process restarts were not.
4. **Owner/founder experience acceptance** — outside my scope; this verdict does not substitute for it.
5. I did not audit the U1/U2 compiler/engine semantics beyond what the journeys exercise (frozen engine behavior was verified by prior gates at earlier candidates; I tested the combined candidate's mounting, honesty, and UX claims).

## 9. Verdict

**FAIL** — for the combined candidate as presented.

- 7 of 8 demonstrations pass in full (E1, E2, E3, E4, E5, E7, E8-minus-one-sub-item), automated checks match every builder-claimed number (124/124 renderer, 70/70 unit, 4/4 integration, 12/12 design, 0/2 broad svelte-check, clean builds and format), checksums are reconciled exactly as recorded, and the workbench mounting honesty (annotation==actual, refused-save byte preservation) held under attack.
- The blocking failure is F-1: the canvas selection outline is silently inert (dead CSS selector) — a required E6 behavior, user-visible, and the exact class of defect this program's gates have treated as blocking before. It is pre-existing since `7f49cd0` and newly discovered because no prior verification exercised it.
- Next allowed action (for the manager, not me): bounded repair of the EditorCanvas selection-style interpolation, plus (optionally, non-blocking) the 390 first-screen layout improvement; then re-verification of E6 and the affected E8 sub-item at the repaired candidate. I did not repair, format, or otherwise modify any tracked file; the candidate's working tree is exactly as delivered.

## 10. Evidence index (all under `C:/Users/RZ1/Desktop/RZ/vict-02-u2-combined-verify/combined-verify-evidence/`)

- Journeys (JSON): `journeys/j1-shared-override.json`, `j2-reset-undo.json`, `j3-undo-redo-persist.json`, `j4-browser-values.json`, `j5-linked-padding.json`, `j6-layers-search-keyboard.json`, `j7-storage-refusal.json`, `j8-responsive-editor-review.json`
- Harness (mine, untracked): `harness/helpers.mjs`, `harness/j1.mjs` … `harness/j8.mjs`, `harness/probe.mjs`, `harness/debug-*.mjs`
- Check logs: `broad-svelte-check.txt`, `broad-svelte-check-before-workspace-build.txt`, `vitest-renderer.txt`, `vitest-unit.txt`, `vitest-integration.txt`, `vitest-design.txt`, `design-typecheck.txt`, `design-build.txt`, `format-check-after-build.txt`, `dev-server.log`
- Screenshots (32): `shots/j1-01-initial-1440.png`, `j1-02-kitchens-selected.png`, `j1-03-shared-blue.png`, `j1-04-instance-pink.png`, `j2-01-after-reset.png`, `j2-02-after-undo.png`, `j3-01-heading-selected.png`, `j3-02-edited-61.png`, `j3-03-after-undo.png`, `j3-04-after-reload-reopen.png`, `j4-01-1440.png`, `j4-02-1024x800.png`, `j4-03-preview390.png`, `j4-04-card-hover.png`, `j4-05-window390.png`, `j5-01-spacing-before.png`, `j5-02-linked-29.png`, `j5-03-after-one-undo.png`, `j6-00-canvas-click-selected.png`, `j6-01-search-bathrooms.png`, `j6-02-mouse-selected.png`, `j6-03-after-escape.png`, `j6-04-keyboard-selected.png`, `j7-01-preserved-banner.png`, `j7-02-save-refused.png`, `j8-01-1440x900.png`, `j8-02-1024x768.png`, `j8-03-390x844-first-screen.png`, `j8-04-390-edited.png`, `j8-05-container480.png`, `j8-06-editor-review.png`

Cleanup performed: my dev server (port 5210) killed; my Chrome profile directory removed; no tracked files modified; nothing pushed; this worktree and its evidence left in place for the manager to import.
