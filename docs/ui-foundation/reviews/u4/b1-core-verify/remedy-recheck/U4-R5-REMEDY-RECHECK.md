# U4 R5 REMEDY RECHECK — candidate dcd3cbea255af9aa3b601236e5ee8639cfcb55a4

Reviewer: independent remedy recheck reviewer (authored no repairs; found no defects requiring repair). Date: 2026-10-08. Checkout: `C:/Users/RZ1/Desktop/RZ/vict-02-u4-remedy-recheck` at SHA `dcd3cbea255af9aa3b601236e5ee8639cfcb55a4`, clean tree, no commits/pushes made. Preview used: reviewer's own port 5470, served from reviewer's own isolated dir `C:/Users/RZ1/Desktop/RZ/u4-remedy-iso-fwd/u4-consumer` (port 5460 untouched). All browser input was genuine CDP (`Input.dispatchKeyEvent` / `Input.dispatchMouseEvent` with `Emulation.setFocusEmulationEnabled` enabled). No synthetic input was used anywhere.

## 10-line summary

1. R1 CLEAN BUILD: VERIFIED — `npm ci` exit 0 (1m33s), `npm run build` exit 0 (1m08s) at dcd3cbea.
2. R2 PACK forward-slash `U4_ISOLATED_ROOT=C:/Users/RZ1/Desktop/RZ/u4-remedy-iso-fwd`: VERIFIED — exit 0 (1m36s), grepped `ISOLATED PACKED-ARTIFACT VERIFICATION: OK`, isolated dir exactly that path, 10 tarballs in `u4-consumer/vendor/`.
3. R3 PACK relative `U4_ISOLATED_ROOT=u4-remedy-iso-rel` from repo root: VERIFIED — exit 0 (1m22s), verification OK, resolved to `C:\Users\RZ1\Desktop\RZ\vict-02-u4-remedy-recheck\u4-remedy-iso-rel` (deterministic `path.resolve` vs cwd), 10 tarballs.
4. R4 ISOLATED install/build/test: VERIFIED — 10 vendor tarballs, `npm test` 16/16 exit 0, both build entries produced (5 assets, exit 0), bits-ui exactly 2.19.3 in isolated node_modules.
5. R5 F17 stale-prefix refusal in genuine Chrome (port 5470): VERIFIED — asserts a)–g) all true (r5-asserts.txt); invalid draft `65e` Add refused, list unchanged, truthful `Enter a valid number.`, no dirty/rev change; valid add gains exactly one member; scalar badInput truthful with meter still 65.
6. R6 Inspector slot-owned annotation: VERIFIED — note renders verbatim: `Shown from the “content” slot content while that slot is filled; this value is the fallback text.` (r6-slot-owned-note2.png). First attempt used a wrong selector (drive failure, corrected per instructions; not a product defect).
7. R7 carryover runtime equivalence: VERIFIED — focus 10/10 PASS (10 checks, incl. `f17-real-chrome-numeric-feedback`; no first-run flake), journeys 50/50 PASS; normalized old-vs-new diffs EMPTY for both (10/10 and 50/50 identical pass/persist/echo sets).
8. Verdict: the re-pinned candidate dcd3cbea cures the previously falsified F17 stale-prefix refusal boundary; G-C (pack U4_ISOLATED_ROOT resolution, forward-slash and relative) and G-A/G-B (README docs observed indirectly via clean cold-start build+pack flow; docs text not re-reviewed line-by-line) hold.
9. One app-behavior note (not a defect): after valid add of 70, the committed member displays 75 because the bound `visit-duration` slider declares `step: 15` and the valueChange loop snaps/echoes the state; the refusal mechanism itself is unaffected.
10. Verdict scoped to the remedy claims only (F17 boundary, G-A/G-B/G-C); nothing here claims SSR, performance, or Stage 9.

## Per-check results

### R1 CLEAN BUILD — VERIFIED
- `npm ci`: exit 0, ~1m33s (npmci.log)
- `npm run build`: exit 0, ~1m08s (build.log; completes pack prerequisites, implicitly re-verifying F14)

### R2 PACK with forward-slash U4_ISOLATED_ROOT (G-C) — VERIFIED
- `U4_ISOLATED_ROOT=C:/Users/RZ1/Desktop/RZ/u4-remedy-iso-fwd node scripts/pack-u4-consumer.mjs`: exit 0, ~1m36s
- Grepped (not banner-trusted): `ISOLATED PACKED-ARTIFACT VERIFICATION: OK` at pack-fwd.log:51; `isolated root: C:\Users\RZ1\Desktop\RZ\u4-remedy-iso-fwd`; `tarballs: 10`
- Confirmed isolated dir is exactly `C:/Users/RZ1/Desktop/RZ/u4-remedy-iso-fwd`; 10 tarballs found at `u4-remedy-iso-fwd/u4-consumer/vendor/*.tgz`

### R3 PACK with relative U4_ISOLATED_ROOT (G-C) — VERIFIED
- `U4_ISOLATED_ROOT=u4-remedy-iso-rel node scripts/pack-u4-consumer.mjs` from checkout root: exit 0, ~1m22s
- Grepped: `ISOLATED PACKED-ARTIFACT VERIFICATION: OK`; resolved root `C:\Users\RZ1\Desktop\RZ\vict-02-u4-remedy-recheck\u4-remedy-iso-rel` (deterministic: script uses `path.resolve(env)`, so relative resolves against cwd = repo root, per scripts/pack-u4-consumer.mjs:24-31); 10 tarballs confirmed on disk

### R4 ISOLATED install/build/test — VERIFIED
- Vendor tarball count in `u4-remedy-iso-fwd/u4-consumer/vendor/`: 10 (expected 10)
- `npm test`: exit 0, `Test Files 1 passed (1)`, `Tests 16 passed (16)` (iso-test.log)
- Build both entries: exit 0, 5 assets incl. `authoring-*.js` and `execution-*.js` (iso-build.log)
- `node_modules/bits-ui/package.json` version: exactly `2.19.3`

### R5 F17 stale-prefix refusal in genuine Chrome — VERIFIED
Setup: authoring entry `http://127.0.0.1:5470/` (vite preview from isolated dir), Reset to seed, Scheduling route, Preview-state panel. Genuine CDP keys and genuine mouse clicks only. Full verbatim output in `r5-asserts.txt`; screenshots `r5-refused-add-65e.png`, `r5-valid-add-70.png`, `r5-scalar-badinput.png`.
- List field `duration` (input `aria-label="Add duration member"`, type=number; `badInput=true` proves the visible invalid draft `65e` — `type=number` sanitizes `.value`, so the DOM value reads `""` while the visible text is `65e`):
  - a) no new member: **true** (1 → 1)
  - b) stored value list unchanged: **true** (["60 ×"] → ["60 ×"], no duplicate)
  - c) truthful error visible: **true** — verbatim `Enter a valid number.`
  - d) no spurious dirty/rev change: **true** — status `(saved)` → `(saved)`, localStorage fingerprint identical (71861:6331878 → 71861:6331878)
  - e) fix via select-all + genuine `70` + Add: **true** — exactly +1 member (1 → 2)
  - Note (not a defect): the new member displays `75 ×` because the bound `visit-duration` slider declares `step: 15` (src/product/operations.ts) and its valueChange loop snaps/echoes state; the F17 refusal path is unaffected.
- Scalar `load value` (seeded 65): genuine `e` appended → truthful error `Enter a valid number.` visible (f: **true**), `validity.badInput=true`, canvas meter still 65 (g: **true**) — stored value not touched.

### R6 Inspector slot-owned annotation — VERIFIED
Flow: reset seed → Workspace & assignment → Layers search `command-assign` (select-all + type) → genuine click on `[aria-label="Layers"] button[data-key*="command-assign"]` (data-key `consumer.taskShell|command-assign|shell@vict.catalog.appshell|workspace-command@vict.catalog.command`, row label `◇Request reviewer assignment R5◇`) → Component properties.
- Note under the `label` prop, verbatim: `Shown from the “content” slot content while that slot is filled; this value is the fallback text.` — matches the SLOT_OWNED_LABEL note pattern in packages/ui-editor/src/Inspector.svelte (`vict.catalog.command.item` → slot `content`).
- Screenshot: `r6-slot-owned-note2.png`. (First attempt `r6-slot-owned-note.png` was a reviewer selector failure — wrong row clicked; per instructions the drive was corrected, and the failure is not claimed as a product defect.)

### R7 carryover runtime equivalence — VERIFIED
- `node r5-focus.mjs 5470 focus-recheck.json`: exit 0, `R5-FOCUS DONE: 10/10 PASS` on first run — no hydration-timing first-run flake; all 10 check names present (incl. `f17-real-chrome-numeric-feedback` and `stable-button-feedback`).
- `node r5-journeys.mjs 5470 journeys-recheck.json`: exit 0, 50/50 PASS, all routes end `Saved · rev r1.r1`.
- Normalized diff evidence (keep only name + ok/persisted/appEcho-family booleans; drop timings/screenshots/timestamps/rev strings), old = `C:/Users/RZ1/Desktop/RZ/u5-focus-dcd.json` and `C:/Users/RZ1/Desktop/RZ/u4-journeys-r5-dcd.json` (read-only), new = this run:
  - `normalized-focus-diff.txt` (quoted verbatim):
    ```
    old count 10 new count 10
    ```
    (no DIFF lines — empty diff)
  - `normalized-journeys-diff.txt` (quoted verbatim):
    ```
    old count 50 new count 50
    ```
    (no DIFF lines — empty diff)
- Both normalized result sets are byte-identical to the prior dcd3cbea-era comparison inputs: TOTAL DIFFS = 0.

## Reviewer results (own observations) vs carried numbers

Own observations (re-observed this run): everything in R1–R7 above — build/pack exit codes and durations, 16/16 tests, bits-ui 2.19.3, tarball counts, all R5 DOM assertions, the R6 note text, the 10/10 and 50/50 driver results, and the normalized diffs.

Carried, not re-observed: the prior technical gate report's FAIL at fe80036 and its falsification of the old F17 candidate boundary (`docs/ui-foundation/reviews/u4/b1-core-verify/U4-R5-COMBINED-TECHNICAL-GATE.md`); any SSR, performance, or Stage 9 numbers from prior rounds. No numbers from prior reports are presented as evidence here.

## Final verdict (scoped to remedy claims)

The re-pinned candidate dcd3cbea255af9aa3b601236e5ee8639cfcb55a4 cures the previously falsified F17 stale-prefix refusal boundary: in genuine Chrome, an invalid visible draft (`65e`) is refused on Add with no member committed, no duplicate, no stored-state or dirty/revision change, and truthful `Enter a valid number.` feedback, on both the numeric list field and the scalar number field. G-C holds: the pack script resolves forward-slash and relative `U4_ISOLATED_ROOT` overrides correctly (scripts/pack-u4-consumer.mjs:24-31, both packs verified end-to-end with grepped verification text and on-disk tarballs). G-A/G-B (README doc fixes) are consistent with the clean cold-start build→pack→isolate→test→preview flow executed here; the README prose itself was not re-reviewed line-by-line. This verdict makes no claim about SSR, performance, or Stage 9.

## Limitations

1. R5 draft invalidity for `65e` was observed via `validity.badInput` (and truthful error text); `input type=number` sanitizes `.value`, so the literal string `65e` is not readable from the DOM — visible-text confirmation relies on the browser's number-input behavior plus badInput=true.
2. The valid-add member value displayed as 75 (not the typed 70) due to the app's bound slider `step: 15` echo loop; this is app semantics outside the remedy claims and was not investigated further.
3. R6 required a corrected selector after a first reviewer-side drive failure (wrong row); the corrected drive is the evidence of record.
4. G-A/G-B README doc fixes were not re-reviewed line-by-line; they are covered indirectly by the clean cold-start flow.
5. Drivers (r5-focus.mjs / r5-journeys.mjs) were reused unmodified and write their failure screenshots to their own preconfigured directory; reviewer screenshots live in this artifacts dir.
6. Equivalence is relative to the supplied read-only comparison inputs (u5-focus-dcd.json, u4-journeys-r5-dcd.json); no independent re-run of the old baseline was performed.
7. Single browser instance shared via CDP tab at 127.0.0.1:9222; reviewer navigated only its own URLs on port 5470.
