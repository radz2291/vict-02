# U2 EXPERIENCE RECHECK — independent verifier report

- **Pinned candidate:** `19bb4b98a18f86bb1193db5a45f8c33e1c5c9af5` (branch `codex/ui-foundation-u2`)
- **SHA actually tested (browser):** served build of worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u2`, HEAD `ffa1bb644a3bb20f19888d024cffab53abcd6dc8`
- **Provenance note:** `19bb4b9` is a verified git ancestor of `ffa1bb6`. `git diff --stat 19bb4b9..HEAD` touches ONLY `docs/ui-foundation/` markdown + PNG evidence — zero app code. The served app therefore reflects the pinned candidate's code. Disclosure: at audit start HEAD was `36ec8eb` with the reviews dir untracked; mid-audit the owner committed `ffa1bb6` (review records). Repo working tree left clean; no repo files modified by this recheck.
- **Method:** real-browser only (Chrome via CDP :9222), real clicks/keyboard unless noted; localStorage cleared (both keys `vict.u2.service.doc`, `vict.u2.fixture.doc`) and re-seeded before journeys.
- **Scope honesty:** ~40 min spent (over the 20-min cap; see "Not covered" below).

## Journey verdicts

### J-A — workbench edit reaches /service; undo reverts it — **PASS**
- Selected the `Kitchens` card title in the canvas (clicked the `span.uv-text` inside the h3), typed `Kitchens — rechecked`, **Apply text**, **Save** → activity: `22:41:04 Saved as stored revision 2 (persists across reload)`.
- Opened `/service` in a NEW tab: heading reads **"Kitchens — rechecked"** (evidence: localStorage `vict.u2.service.doc` grew; DOM text captured in transcript).
- **Undo** in workbench → canvas back to `Kitchens` → **Save** → `22:41:29 Saved as stored revision 3` → reloaded the `/service` tab → heading reads **"Kitchens"**. Round-trip confirmed both ways.

### J-B — instance vs shared styling scope — **PASS**
- Clicked the Adaptations card **body** (`article.svc_cardAdaptations`): Inspector showed the shared-definition notice *"Inside component def.serviceCard (svc.cardAdaptations) editing the SHARED definition — 5 instances update together"* and **"Edits apply to"** with `the shared definition (all instances)` / `this instance only (svc.cardAdaptations)`.
- Scope = **this instance only**, `background-color: #fde68a` → Apply style → **only Adaptations** changed to `rgb(253,230,138)`; the other four cards stayed `rgb(255,255,255)`. Evidence: `evidence/jb-instance-only-adaptations.png`.
- Scope = **shared**, `#dbeafe` → **all five cards** `rgb(219,234,254)`. Evidence: `evidence/jb-shared-all-five.png`.
- **Undo ×2** → colors restored exactly (incl. Adaptations' original tint `rgb(231,242,236)`), Redo re-enabled. Measured computed styles, not just visuals.

### J-C — empty-value guard on Apply style — **PASS**
- With `Property = background-color` and an **empty** value: **Apply style is disabled** (also `title` tooltip: "Enter a value first (an empty value would be a silent no-op)"). Whitespace-only value ` ` → also disabled. Valid value → enabled.
- Verification note (not a product finding): using synthetic DOM `input` events with same-tick reads the button *appeared* enabled — Svelte flushes asynchronously, so the DOM attribute lagged the read. Re-tested with **real keyboard input** (per-key CDP typing + Ctrl+A/Delete): guard holds in every case. Anyone re-verifying this guard must use real input or await a microtask.

### J-D — corrupt stores — **PASS (both cases)**
1. **Invalid JSON** (`definitely-not-json{{{` in `vict.u2.service.doc`, reload): banner *"⚠ Stored design data is unreadable and has been PRESERVED (stored authoring data is not valid JSON (stored bytes preserved)). Save will fail until the site data for this key is cleared."* — **Save refused**: activity `22:48:24 Save FAILED (UI_STORE_CORRUPT): refusing to overwrite preserved data`; stored bytes still exactly the injected junk. **Editor usable**: applied text `Editable while preserved` in memory. Evidence: `evidence/jd1-preserved-banner.png`.
2. **Schema-corrupted readable envelope** (`{format:'vict.design-store@1', storedRevision:'7', document:{garbage}}`): banner *"⚠ Stored design data was not usable (stored document invalid: UI_DOC_UNKNOWN_SCHEMA — Unsupported UI document schema.). A fresh seed was loaded; the next successful save replaces the stored data."* → selected Kitchens, typed `Kitchens (post-recovery)`, Apply text, **Save** → `22:49:54 Saved as stored revision 8`, **banner cleared** (0 matches for /Stored design/). Evidence: `evidence/jd2-notusable-banner.png`.
- Both keys cleared afterwards; origin re-seeded clean at the end.

### J-E — previously uncovered items — **PASS**
- **Keyboard resize:** separator `[role=separator]` is focusable (`tabindex=0`, aria-label "Resize inspector (left and right arrows)"). Real ArrowLeft/ArrowRight change the inspector width: 320.8 → 352.8 px after 2×ArrowLeft (+16/step), → 304.8 after 3×ArrowRight (−16/step). Evidence: `evidence/je1-keyboard-resized-352.png`.
- **Long labels:** applied a 90-char card title (unsaved). Measured at 1440 and at a true 390 viewport (`innerWidth=390`): **0 of 95** Layers buttons clipped (`scrollWidth ≤ clientWidth`), no horizontal overflow on `.wb-inspector` / `.uv-layers` / canvas, no page horizontal scroll. Labels wrap (e.g. "component def.serviceCard · rev 1" wraps to two lines). Evidence: `evidence/je2-longlabel-1440.png`, `evidence/je4-longlabel-390-true.png`.
- **Console sweep:** fresh page per route/size, collecting console + pageerrors: `/`, `/service`, `/workbench` at 1440×900 and 390×844 — **all 6 CLEAN (0 errors, 0 warnings, 0 pageerrors)**. Full-page screenshots per sweep in `evidence/sweep-*.png`.

## Required size captures (all in `evidence/`)
- `size-service-1440x900.png`, `size-service-1024x768.png`, `size-service-390x844.png` (full-page)
- `size-workbench-1440x900.png`, `size-workbench-1024x768.png`, `size-workbench-390x844.png` (full-page, clean seeded state)
- `size-workbench-480container-1440x900.png` (Preview size = "480 container"; frame narrows, hero/cards reflow, media/container rules respond)

## Findings (none blocking)
1. **MINOR (UX truthfulness) — PRESERVED banner is transient once you edit.** In the J-D case-1 state the PRESERVED banner was visible after reload but was no longer present after an in-memory text edit (and after the refused save). The user is still protected loudly at save time (`Save FAILED (UI_STORE_CORRUPT) …` in the Activity log) and the banner returns on next load, but between edit and save attempt the page no longer advertises that storage is broken. Repro: inject invalid JSON → reload workbench → observe banner → click Kitchens title → Apply text → banner gone. User effect: a user could keep editing under the impression saves will work, and only discover the refusal on Save.
2. **OBSERVATION (good behavior, recorded for the record) — `Reload stored` with an empty store refuses with `Reopen refused (UI_STORE_EMPTY)`** and keeps the unsaved working document (no silent data loss). Encountered at 22:52:28; no action needed.
3. **VERIFICATION-METHOD NOTE** — J-C's guard is only demonstrable with real input events or async-aware reads (see J-C). Automated checks that dispatch synthetic events and read `disabled` synchronously will produce a false failure. Not a product defect.

## Not covered
- Real drag-resize of the separator by mouse (pointer events) — only keyboard path verified (task scoped to keyboard).
- The `/` overview route beyond console sweep + screenshots (no interaction journey specified).
- `Graph fixture` document workbench flows (out of scope; fixture key only cleared).
- Form submission on /service (Send request) — not part of the assigned journeys.
- Save-conflict/stale-revision path (two tabs writing concurrently) — not in scope.
- The 20-minute cap was exceeded (~40 min) due to tooling setup (CDP helper, emulation quirks) and re-verification of J-C with real input.

## Verdict
All three previously-failed findings' repairs are confirmed through real browser use (J-A persistence, J-B instance styling, J-D corrupt-store gates), J-C/J-E pass, console clean at both sizes.

**U2-EXPERIENCE-RECHECK: PASS WITH FINDINGS**
