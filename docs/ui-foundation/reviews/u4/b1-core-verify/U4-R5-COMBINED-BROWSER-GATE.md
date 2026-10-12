# U4 ROUND-5 INDEPENDENT COMBINED GATE — REAL-BROWSER RECHECK (fresh reviewer b1)

- Candidate: packed production preview at `http://127.0.0.1:5460` (combined verify 05, candidate fe800369).
- Reviewer: independent, fresh session (worker b1). Review-only: no product code inspected-and-repaired, nothing pushed.
- Date: 2026-10-13 (local session).
- Reference tooling used UNMODIFIED: `C:/Users/RZ1/.pi/agent/skills/browser-tools/r5-focus.mjs` and `r5-journeys.mjs` (config `C:/Users/RZ1/Desktop/RZ/u5-journey-config.json`), Chrome CDP on :9222, focus emulation ON for all driven input, genuine CDP input events only.

## 1. Reference focus driver (`node r5-focus.mjs 5460 <out>`)

- Run 1: **8/9 reported PASS**, 1 FAIL — `stable-button-feedback`: "ASSERT: schedule confirm button present".
  - Investigation: the schedule confirm button (`[data-ui-occ*="confirm-schedule"]`, text "Confirm inspection schedule") **is present** on `app.html?doc=schedule` (verified by independent CDP evaluate immediately after). The failure is a hydration-timing race: the driver navigates and waits a fixed 2400 ms, and on that run the finished app had not hydrated. **Classified: environment flake, not a product defect.** Screenshot of the failed state: `docs/ui-foundation/reviews/u4/b1-core-verify/browser-r5/fail-stable-button-feedback.png` (written by the unmodified reference driver).
- Run 2 (identical command): **10/10 PASS** — combobox-placement, decision-layout, stable-button-feedback, dropdown-above-dialog, page-position-preservation, selection-outlines, mobile-layouts, f17-real-chrome-numeric-feedback, keyboard-nav-focus-restoration (+ obs-button-width-delta observation entry).
- Driver outputs: `C:/Users/RZ1/Desktop/RZ/u5-round5/focus-out.json` (run 1), `focus-out2.json` (run 2, 10/10).

## 2. Reference journey matrix (`node r5-journeys.mjs 5460 <out>`)

- **COMPLETED: 50/50 PASS, 50/50 persisted.** Output: `C:/Users/RZ1/Desktop/RZ/u5-round5/journeys-out.json` (`results: 50 items, all ok:true`; across all routes, every family has `persisted: true` or `persisted: "closed-surface"` — counted 50/50 independently from the JSON).
- Routes exercised include queue and controls (e.g. controls route: checkbox ackA, select regionSelect, switch notifySwitch, toggle escalateToggle, radio-group reviewerRadio, button submitBtn — all with canvasEcho/undoRemoved/redoRestored true, "Saved · rev r1.r1", app ECHO + PERSISTED lines).

## 3. Independent own CDP probes (small hand-written scripts, `C:/Users/RZ1/Desktop/RZ/u5-round5/`)

Environment note: my first probe session initially got `undefined` from evaluates and non-opening dialogs until I replicated the reference driver's connect sequence — `Page.enable` + `Emulation.setFocusEmulationEnabled {enabled:true}` was required (the browser window is backgrounded; without focus emulation genuine CDP input is not delivered to the page). All passing probe results below are WITH focus emulation and genuine `Input.dispatchMouseEvent`/`dispatchKeyEvent` only.

### (a) Combobox arrow inset geometry — detail Corrections tab — **PASS**
Measured on `app.html?doc=detail`, Corrections tab, combobox node `correction-owner`:
- trigger in right zone of control: yes (trigger x 1339.6 vs input x+55% threshold); right edge delta trigger vs input: **−4 px**; vertical overlap 36 px (inset control);
- input reserves arrow space: `padding-inline-end: 52px` (≥40);
- arrow glyph present, `aria-hidden="true"`, inset 16 px from trigger right edge, vertically centred (delta 0 px).
Screenshot: `C:/Users/RZ1/Desktop/RZ/u5-gate-browser/u5-r5-a-combobox-arrow.png`.

### (b) Select listbox paints above assignment dialog — **PASS**
On `app.html?doc=shell`: clicked `assignTrigger` ("Open Review guidance R5") with genuine CDP mouse events → dialog opened (`role="dialog"`); clicked `dialogSelect` with genuine mouse events → portaled `role="listbox"` opened:
- `document.elementFromPoint` at listbox center-top hits inside the listbox/content → **paints above**;
- listbox wrapper z-index **260** vs dialog z-index **181**; listbox overlaps the dialog region.
Screenshot: `C:/Users/RZ1/Desktop/RZ/u5-gate-browser/u5-r5-b-listbox-above-dialog.png`.

### (c) Menubar open/close restores scroll position and focus — **PASS**
On `app.html?doc=shell` menubar trigger `workspace-file-menu` ("Inspection"): scrolled to y=400, focused trigger, opened menu with genuine mouse click (menu + menuitems rendered, incl. "Prepare summary" `workspace-export`, "Share" `workspace-share`), pressed **Escape**:
- scroll position preserved: **400 → 400**;
- menu closed: yes; focus returned to the menubar trigger ("Inspection").
Screenshot: `C:/Users/RZ1/Desktop/RZ/u5-gate-browser/u5-r5-c-menubar-restore.png`, menu open: `u5-r5-e-menu-open.png`.

### (d) Accordion 'findings' authored label as aria-label on group root — **PASS**
On `app.html?doc=detail`: the accordion group root (`data-ui-node="findings"`, div, `data-ui-occ="consumer.detail|findings|…"`) carries **`aria-label="Open findings R5"`** — the authored label appears as aria-label on the group root in the finished app. (Authoring source shows the authored "Open findings R5" text; the finished-app group root exposes it.)
Screenshot: `C:/Users/RZ1/Desktop/RZ/u5-gate-browser/u5-r5-d-accordion-findings.png`.

### (e) Inspector shows slot-owned note for a filled menu-item label slot — **NOT COMPLETED**
What was done: opened authoring entry `/`; found `aside.uv-inspector` ("Make a selection…"); located Layers tree (`role="tree"`, root `◇Inspection Operations◇`, `aria-expanded="false"`, disclosure button "Expand Inspection Operations") and the filled-label canvas element "Queue actions" (span inside `uv-…-queue-actions`). Multiple genuine-input attempts to expand the Layers tree (click disclosure button, select root treeitem + ArrowRight) did not expand it in my session (no product-defect conclusion drawn — the drive sequence may simply be wrong; e.g. the tree may require prior canvas selection or different key handling).
**The probe was then terminated by environment failure: the preview server at 127.0.0.1:5460 went DOWN mid-session (now connection-refused / chrome-error://chromewebdata).** No verdict, no defect classification for (e). Partial screenshot: `C:/Users/RZ1/Desktop/RZ/u5-gate-browser/u5-r5-e-inspector-slot-note.png` (inspector still in unselected state).

## Checks NOT completed (run timeout / server outage)
- Probe (e) Inspector slot-owned note: **not completed** — server outage; earlier part of the session also hit a run timeout.
- Everything else in sections 1–2 and probes (a)–(d) was completed.

## Product defects found
- **None** among the completed checks. The single focus-driver failure (run 1) was classified environment (hydration timing) and passed on re-run.

## Review-only statement
No repo files modified by me except this report. Reference tooling used unmodified (its own screenshots were written by the driver to `docs/ui-foundation/reviews/u4/b1-core-verify/browser-r5/`).
