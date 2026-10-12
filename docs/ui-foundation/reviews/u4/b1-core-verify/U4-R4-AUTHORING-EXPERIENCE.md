# U4 Round 4 — REAL-BROWSER AUTHORING / EXPERIENCE REVIEW

Candidate under evaluation (frozen): `32d8465aa9c810e4285995549a562957c85d2e36`
Environment: packed production preview, isolated packed consumer, `http://127.0.0.1:5450` (authoring at `/`, finished app at `/app.html?doc=…`); real Chrome via CDP port 9222 with `Emulation.setFocusEmulationEnabled(true)` for the whole session; all input genuine CDP pointer/keyboard (no synthetic DOM events for assertions).

**VERDICT: PASS WITH FINDINGS — the authoring experience is coherent, feedback-rich and end-to-end reliable (50/50 family journeys across all 5 routes pass, including 5 closed surfaces demonstrated open in the finished app), but 3 experience-level findings are recorded, the most significant being that the numeric-list editor's invalid-draft validation is unreachable in a real browser (jsdom-oracle-only) and the user gets a silent no-op instead of an error.**

This is a review-only report; nothing was repaired, no repository file other than this report and its screenshots was written. Driver scripts were kept outside both repositories (`C:/Users/RZ1/Desktop/RZ/u4-r4-experience.mjs` + focused re-probes).

---

## 1. Journeys performed (family · route · steps · result)

Full matrix driven with the unmodified round-4 reference driver (`r4-journeys.mjs` + `u4-journey-config.json`); per family: seed reset → Layers-panel search + row click (pointer) → Inspector prop edit (keyboard: focus/select/type/Enter) → canvas echo → Undo → Redo → per-route Save → Reload stored → persistence → finished-app check. Full result matrix: `C:/Users/RZ1/Desktop/RZ/u4-r4-review-journeys.json`.

| # | Family (occurrence) | Route | Steps | Result |
|---|---|---|---|---|
| 1 | dropdown-menu (queue-actions) | queue | select → edit `label` → echo via Inspector (plan-level) → undo/redo → save/reload/finished app | PASS (persisted; no canvas echo by implementation — slot wins) |
| 2 | tooltip (priority-help) | queue | edit `title` → hover in finished app → `[role=tooltip]` portal | PASS — portal opens on genuine hover, authored text shown |
| 3 | avatar (lead-avatar) | queue | edit `fallback` → canvas text echo | PASS |
| 4 | link-preview (site-preview) | queue | edit `title` → hover → floating card | PASS |
| 5 | pagination (queue-pages) | queue | edit `label` → aria-label echo | PASS |
| 6 | context-menu (inspection-context) | queue | plan-level edit → undo/redo/save/reload | PASS |
| 7 | tabs / tabs-trigger (inspection-tabs / tab-evidence) | detail | edit `label` → aria / text echo | PASS ×2 |
| 8 | accordion-multiple / accordion-item (findings / finding-handrail) | detail | plan-level + text echo | PASS ×2 |
| 9 | **alert-dialog (archive-inspection)** | detail | edit `title` → save → Corrections tab → click trigger → `[role=alertdialog]` | PASS — opened dialog shows "Archive this inspection R4" (screenshot `r4-review-alertdialog-saved.png`) |
| 10 | button / checkbox / collapsible / combobox / select-multiple / separator / toggle-group(-multiple) / aspect-ratio | detail | standard cycle per family | PASS ×10 |
| 11 | **popover (decision-guidance)** | detail | edit `title` → open on Corrections tab → floating content | PASS — authored title in portal |
| 12 | calendar / date-field / date-picker / time-field / date-range-field / date-range-picker / range-calendar | schedule | standard cycle per family | PASS ×7 |
| 13 | meter / progress / slider / button / collapsible | schedule | standard cycle | PASS ×5 |
| 14 | navigation-menu.item / menubar.menu / menubar.item / toolbar / toolbar-button / command / command.item / scroll-area / label / appshell | shell | standard cycle | PASS ×10 |
| 15 | **dialog (assignTrigger)** | shell | edit `title` → save → trigger click → `[role=dialog]` | PASS — "Review guidance R4" shown |
| 16 | checkbox / select(disabled, boolean) / switch / toggle / radio-group / button | controls | standard cycle incl. boolean literal via source picker | PASS ×6 |

Totals: **50/50 journeys PASS** · 50/50 persisted after Save + Reload stored · 40/50 echo in the finished app (10 plan-level, recorded honestly — slot-wins/unimplemented-prop/CSS-only, consistent with §19 of the background report). Routes covered: 5/5 (queue, detail, schedule, shell, controls); families covered: 50 occurrences over 38 available families + AppShell.

Experience-specific journeys driven with my own script (`u4-r4-experience.mjs` + re-probes):

| # | Journey | Steps | Result |
|---|---|---|---|
| E1 | Selection clarity | type `visit-duration` in Layers search → exactly 1 row ("◇Visit duration R4◇") → pointer click on row → Inspector shows the occurrence's props | Good — deterministic, single match, no ambiguity |
| E2 | Dirty/status feedback | status "Saved · rev r1.r1" with Undo/Redo disabled → type in Inspector `label` → status flips to "Unsaved changes · rev r1.r1", Undo/Redo enable | Good — visible, immediate, revision always shown |
| E3 | Numeric-list editor (StateValuesPanel, `duration` list) | focus "Add duration member", type `1e999` (keystroke-by-keystroke observed), Enter; then type `42`, click the row's Add button | See findings F1/F2 |
| E4 | Date-range coherence (finished app) | open `window-picker` popover → click day 10 → observe fields → click day 20 → observe fields | Good — start-only shows `10/10/2026 to dd/mm/yyyy` (coherent, ordered, empty-end convention), completing shows `10/10/2026 to 20/10/2026`; exactly one coherent display transition per action; no garbage intermediate ever visible (screenshot `r4-review-range-selected.png`) |
| E5 | Time field en-GB 12h (finished app) | read `handover-time` display | PASS — `13:30` renders `01:30:00 PM` (PM present, AM absent) in the en-GB 12h field |
| E6 | Tooltip hover (finished app, queue) | genuine mouse move onto `priority-help` | PASS — `[role=tooltip]` portal appears with authored "Priority help R4 …" (screenshot `r4-review-tooltip-open.png`) |
| E7 | Closed surface on its saved change | finished app `detail` → Corrections tab → click `archive-inspection` trigger | PASS — alert-dialog opens with the saved title (E2/journey 9) |

## 2. Experience findings (numbered, severity-tagged)

1. **[MODERATE — repair-candidate] Numeric-list invalid-draft validation is unreachable in a real browser; the user gets a silent no-op.** The pinned oracle `state-values-panel-numeric-list` asserts "draft kept verbatim + validation surfaced" for `1e999` (`state-values-panel-numeric-list.svelte.test.ts:75-96`), and `StateValuesPanel.addListItem` does surface `List members must be finite numbers.` when the draft is non-finite. But the input is `type="number"`, and **real Chrome sanitizes `1e999` to `value === ""` (badInput=true)**, so `listDraft` becomes `""` and `addListItem` silently returns (`raw === ''` → return) — no error element, no seed, draft gone. Verified keystroke-by-keystroke in the packed UI: after `1`,`e`,`9`,`9`,`9` the input property is `""`, Enter/Add produce no feedback. The oracle passes only because jsdom does not apply Chrome's number-input sanitization. Behavior is *safe* (never seeds garbage) but *silent* — the operator has no idea why nothing happened. The background doc's claim "1e999 survives the number-input sanitizer" does not hold in Chrome.
2. **[MINOR] Valid-member add works, but the error path has no observable trigger in Chrome.** Typing `42` + clicking the duration row's Add correctly appends `[60, 42]` and clears the input (verified). However, since Chrome reduces every invalid numeric draft to `""`, the `errors[...]` message for number lists effectively cannot be reached by typing or pasting; the same applies to the scalar `number` input's "Not a finite number." path. A text/inputmode-based input (or reading `validity.badInput`) would restore the guarded, surfaced-error UX the repair intended.
3. **[MINOR — discoverability] Enter does not commit a list member.** The list-add input has no Enter handler and the Add button is `type="button"` outside a form, so pressing Enter is a no-op; users must find and click the small "Add" button. Consistent, but not discoverable; an `onkeydown` Enter→add would match the Inspector's Enter-to-commit convention.
4. **[OBSERVATION — positive] Transient sanitizer flicker while typing numeric drafts** (`1e` → `""` → `1e9`): visible in the value property, causes no functional problem, but reinforces F1/F2.
5. **[OBSERVATION — positive] Plan-level authoring is honest but under-communicated.** For the 10 plan-level families (dropdown-menu, context-menu, menubar.menu/item, command.item, navigation-menu.item, accordion-multiple, collapsible ×2, scroll-area, aspect-ratio) the edit succeeds, undo/redo work and the value persists, yet the canvas shows nothing — the only feedback is the Inspector field. The Inspector does offer a Literal source picker and the status line is accurate, but nothing tells the user "this prop has no canvas effect on this family" (related to known F15/F16). A hint on such props would remove the "did my edit apply?" doubt.
6. **[OBSERVATION — positive] Everything else meets a demanding user's bar.** Selection via Layers search is exact; the dirty marker and `rev` are always visible; Undo/Redo enable/disable precisely with history (disabled when clean, one click removes/restores the last edit for every family); Save flips to `Saved · rev r1.r1`; Reload stored re-reads without surprises; closed surfaces (alert-dialog, dialog, popover, tooltip, link-preview) all open on their **saved** changes with the authored content; the finished app is faithful to the authored plan (40/50 direct echoes, 10 plan-level by design).

## 3. Repair checks from a user standpoint (task item 3)

- **Date-range one coherent change per action: CONFIRMED in the UI.** Selecting the start day updates the composite to `10/10/2026 to dd/mm/yyyy`; selecting the end completes it to `10/10/2026 to 20/10/2026`. Ordered, no reversed/garbage intermediate, empty-end convention visible. (Note: the composite does not emit native DOM `change` events — verification of "one emission" rests on the pinned oracles; the UI-level evidence is the two clean display transitions.)
- **Time field en-GB 12h shows PM for 13:30: CONFIRMED.** `01:30:00 PM`, no AM.
- **Tooltip opens on hover: CONFIRMED** in the finished app with genuine pointer movement, showing the saved authored title.

## 4. Evidence

- Journey result matrix: `C:/Users/RZ1/Desktop/RZ/u4-r4-review-journeys.json` (50/50 PASS).
- Experience probe results: `C:/Users/RZ1/Desktop/RZ/u4-r4-experience.json`; re-probe scripts `u4-r4-reprobe*.mjs` (outside repositories).
- Screenshots (this directory, `browser-r4/`): `r4-review-inspector-dirty.png`, `r4-review-numeric-draft.png`, `r4-review-tooltip-open.png`, `r4-review-alertdialog-saved.png`, `r4-review-range-selected.png`.
- Background: `U4-FULL-CATALOG-VERIFY-03.md` §16–§19a (read-only).

## 5. Verdict rationale

The frozen candidate passes every functional journey and the three targeted repair checks behave correctly for the user. The numeric-list finding (F1) does not corrupt data and does not contradict the pinned oracles' engine logic, but it does contradict their *browser-level* interpretation ("survives the number-input sanitizer", "validation surfaced" / "browser-covered") and leaves a silent failure in the real UI — recorded as a repair-candidate for the next builder cycle, not a gate blocker for this review-only round.
