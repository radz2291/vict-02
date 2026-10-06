# U2 EXPERIENCE REVIEW — independent verifier report

- Verifier: independent fresh verifier (vict.vict-verifier), separate from the builder
- Candidate: branch `codex/ui-foundation-u2`, pinned SHA `ebac7bf766ecc1bee1e510499ce4607fb211675e` (HEAD verified in worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u2`)
- Method: real-browser walkthrough via CDP (puppeteer-core against the existing Chrome on :9222), real mouse clicks/typing where stated; dev server `http://127.0.0.1:5333` left running; port 5199 untouched
- Evidence: `C:/Users/RZ1/Desktop/RZ/vict-02-u2-experience-review/evidence/` (30 screenshots)
- Review ran across two wall-clock windows (≈35 min + a completion pass); journeys 1, 3, 4, 6, 9 prioritized per brief

## FINAL VERDICT

**U2-EXPERIENCE: FAIL**

Reasons (blocker + two majors below): the flagship round-trip claim — the workbench edits the source the application renders — is demonstrably false at this SHA, and Inspector style authoring on an instance produces no visible effect. Both break the product goal ("an agent can author real application UI quickly, a founder can understand and adjust it visually, and the same source renders in the application"), not merely polish.

---

## Findings

### F1 — BLOCKER: saved workbench edits never render in the finished page
- **Observed**: edited the “Kitchens” card title via Inspector (`Text content` → `Apply text`), Saved (activity: “Saved as stored revision 2 (persists across reloads)”, status “stored revision 2”), `Reload stored` kept the edit. localStorage `vict.u2.service.doc` contains the edit (revision `"2"`, contains “Kitchens & joinery”). A freshly opened / clean-reloaded `/service` tab still renders the seed “Kitchens”.
- **Diagnosis (read-only)**: `examples/ui-design-proof/src/routes/service/+page.svelte` compiles the static `serviceDocument` import; only `routes/workbench/+page.svelte` reads `SERVICE_STORE_KEY`. The overview page’s own “Try in two minutes” step 3 (“Open ‘Finished page’ again — the shared definition updated everywhere”) is false as shipped.
- **Repro**: Workbench → click “Kitchens” title → change text → `Apply text` → `Save` → open `/service` in a new tab → title unchanged.
- **Evidence**: `j3-08-saved.png`, `j3-09-reloaded.png` (workbench, rev 2), `j3-10-service-renders-edit.png` (service, stale), localStorage probe transcript in session log.

### F2 — MAJOR: Inspector “Apply style” on an instance frame is a visual no-op
- **Observed twice** (second time after the mid-review `compile.ts` fix was live): click the “Adaptations” card frame (activity: `Selected doc.northwind|svc.card|svc.cardAdaptations@def.serviceCard`), enter `background-color: #ffe9ec` in the Style declaration panel, click the exact “Apply style” button → activity logs `Applied inspector-1`, status flips to “Unsaved changes”, but **no card changes** (computed backgrounds re-read: all five unchanged; Adaptations keeps its seed emerald `rgb(231,242,236)`).
- **Why it matters**: the shared-definition disclosure works (selecting definition-owned nodes shows “editing the SHARED definition — 5 instances update together”, `j4-03-shared-body-div.png`), and the seed instance override renders — but a founder cannot author a new instance override through the Inspector. The “only that instance changes” half of the journey is unreachable; consequently “a shared-body edit changes all five” was also not demonstrable end-to-end.
- **Evidence**: `j4-04-instance-style.png`, `j4-06-instance-style-retest.png`, computed-style transcripts in session log.

### F3 — MAJOR: recovery from schema-corrupted store diverges from the specified behavior
- **Specified (task/handoff)**: a “not usable / replaced on next save” banner that clears after a successful edit+save.
- **Observed**: with a well-formed envelope carrying `schema: vict.ui-document@9`, reload shows the canvas replaced by “The working document does not compile: UI_DOC_UNKNOWN_SCHEMA: Unsupported UI document schema.”; no “replaced on next save” wording anywhere (`mentionsReplaced: false`); Save rendered disabled in the captured state (`j9-03`). There is no in-editor path to “edit + save” — a founder must know to clear site data. Safe and truthful, but a dead end and not the claimed recovery UX.
- **Evidence**: `j9-03-schema-mismatch-banner.png` (and the identical `j9-02-save-refused.png` frame).

### F4 — MINOR: user-visible console warnings on /service and /workbench (dev build)
- Svelte warnings fire on load: `hydration_mismatch`, `hydration_html_changed` ({@html}), `dynamic_void_element_content` ×4 (renderer emits `<svelte:element this="input">`). No errors on any route; `/` is clean. Zero horizontal overflow at 1440/1024/390/480 on both experiences.
- **Evidence**: console sweep transcript (j11 run) in session log.

### F5 — MINOR: Layers labels run together without separation
- Chips read “slot titlerequired”, “component def.serviceCardrev 1” — label+badge concatenation hurts scanability; wrapping/scroll behavior itself is fine (no clipped controls).
- **Evidence**: `j1-workbench-1440-viewport.png`, `wb-480-container.png`.

### F6 — MINOR: activity entries are non-specific
- “Applied inspector-1” does not say what changed (text? which property? which node). Combined with F2 it masks no-op applies.
- **Evidence**: activity transcripts (`21:02:24 Applied inspector-1`).

### F7 — NOTE: sticky section barely travels
- “Every project, documented” is `position: sticky` and sticks (top ≈ 15px) shortly after the “How we work” heading, but its containing section is short — at +300px scroll it has exited (top −150) at 1440×900. Correct CSS; effect is subtle.
- **Evidence**: `svc-sticky-1440-midscroll.png`, probe values.

### F8 — NOTE: 480-container typography follows window media rules
- In the 480-container frame at a 1440 window, hero type stays large because `cond.narrow` is a window media query while `cond.page` is a container query — consistent with the workbench’s own caption (“container rules respond to the frame, media rules to the window”), but visually surprising.

### F9 — NOTE (authority/environment, not a product finding)
- Worktree was clean at the pinned SHA at review start. During/after the review, other tracks modified `packages/ui/src/compile.ts` (unescaped `\${...}` template literals → real pseudo selectors), `vitest.config.ts`, `packages/ui-svelte/src/document/logic.ts`, and added `packages/ui-svelte/test/pseudo-css-u2.test.ts` plus a tmp scaffold dir. HEAD remained `ebac7bf` throughout. I made zero edits inside the repo; all artifacts live in `vict-02-u2-experience-review/`. F1–F3 behaviors were (re)verified around/after the first change; early captures may reflect the pre-fix build for hover/pseudo styling only. The working tree is NOT clean at report time (not my doing — flag to owner for track hygiene).
- Leftover state: localStorage now holds `stored revision 3` with seed-equivalent content after my final Undo+Save; owner may clear `vict.u2.service.doc` to reset.

## What works well (verified, evidence-backed)
- **Journey 1**: all three routes coherent; links work; seeded “Northwind Atelier” content is consistent fiction; no clipped controls at any size.
- **Journey 3 (in-editor)**: single click on the title text selects the text node (`svc.cardKitchensTitle`, Kind text); `Text content` + `Apply text` updates the canvas; Undo/Redo correct including status transitions (`Unsaved changes` ↔ `Saved`); Save bumps revision with truthful activity; `Reload stored` preserves the edit (`j3-04`–`j3-09`).
- **Journey 4 (partial)**: definition-owned selection shows the SHARED-definition disclosure (`j4-03`); the seed instance override (Adaptations, emerald) renders (`j1-service-1440-full.png`).
- **Journey 6**: from a clean load, Tab order is correct (Overview → Finished page → …); fields have aria-labels + `aria-describedby="design-form-feedback"`; empty submit renders `role="status"` feedback with per-field, honest messages and moves focus to it (`j6-02`); valid submit shows an honest success message (“Request sent (simulated)… does not store anything”), no navigation, fields retained; `:focus-visible` rings observed (`j6-01`).
- **Journey 9a**: corrupt JSON → truthful PRESERVED banner (“stored bytes preserved… Save will fail until the site data for this key is cleared”), editor stays usable on seed, Save refused with `Save FAILED (UI_STORE_CORRUPT): refusing to overwrite preserved data…`, revision unchanged, banner persists (`j9-01`, `j9-05`, `j9-06`).
- **Journey 5**: Full/1024/390/480-container switching never sets dirty state, never bumps the revision; container queries reflow the frame (`wb-480-container.png`).
- **Journey 8**: activity log reflects select/apply/save with timestamps; Hide/Show both work (`j8-01-activity-hidden.png`).
- **Responsive**: /service stacks correctly at 390 (`svc-390-full.png`); no horizontal overflow anywhere measured.

## Not covered (stated explicitly)
- Inspector separator resize by drag and by keyboard (journey 7) — not attempted.
- Long/unbroken-label stress content on canvas (scenario-3 style); only Layers/Inspector labels were exercised.
- Empty/loading/denial states beyond corrupt-store and compile-error cases; no latency simulation.
- “Shared-body edit changes all five instances” end-to-end (blocked by F2; only the SHARED-selection disclosure is proven).
- Console sweep per size (done at 1440 only); hover/pseudo visual states; measured contrast ratios (visual read only).
- Deep visual pass of `wb-1024-full.png` / `svc-480-bottom.png` beyond overflow/clipping measurements.
- Graph fixture document (only “Service page” exercised).

## Founder-readable summary
The workbench itself feels solid: you click a card’s title, the Inspector shows exactly that text, you type and apply, the canvas updates, Undo/Redo and Save behave, and the activity log tells the truth. If your stored data is corrupted, the tool tells you plainly, preserves your bytes, and refuses to overwrite them. The phone and tablet layouts reflow without breaking, and resizing the preview never quietly edits your page.

But the demo’s headline promise fails today: you save your edits in the workbench, open the finished page — and your edits are not there. The finished page is still showing the original built-in content, even though your saved file sits in the browser’s storage. Separately, trying to restyle one card from the Inspector says “Applied” yet nothing visibly changes. And if a stored file has an unknown schema, the editor shows a compile error with no way to recover inside the tool. Those three gaps are exactly the promises this stage exists to prove, so the experience gate cannot pass until they are fixed and re-demonstrated.
