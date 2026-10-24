# Cycle 1.3 — Context menus and shared Document Inspector

> **REVERTED / NOT ACCEPTED — owner request, 2026-10-24.** The owner clarified that the shared bottom panel meant existing Structure inspection details usable from Layers as well; the floating editing tools were already correctly placed on the canvas. The attempted product incorrectly moved the editing controls into the shared panel. The owner then explicitly requested `git revert`. Product commits `ac8b696e048658f163b909eb292827c160d20a79` and `9421543071d604c4c9d5df27ea8150e96c7a76dc` were reverted with history-preserving commits `e727fdb` and `828e3ea5e35ea89a0a499ded686511e4a134b845`. Exact product source/tests/packages match prior independently verified product `a36793df0f62c002332d66db181310554aaabb05`. This reverts both the context menus and attempted shared Inspector. No corrected implementation follows without a further owner request. Earlier authority and failed observations below remain historical.

The [independent report](CYCLE-1-3-CONTEXT-INSPECTOR-INDEPENDENT.md) retains CI-01 (the context trigger's catalog button styling collapsed the graph) and CI-02 (a first secondary pointer selection could open floating tools instead of the menu). The partial repair was pushed but not finally verified or accepted. Earlier builder integration tests and checks did not establish browser geometry or the intended product placement. The owner's correction supersedes the attempted interpretation below. Stage 9 remains REOPENED / IN PROGRESS; no new gate PASS, owner acceptance, merge or publication is claimed.

Rollback delivery: `git diff --exit-code a36793df0f62c002332d66db181310554aaabb05 HEAD -- apps/studio packages` passes. The owner-facing `http://127.0.0.7:5601/design` now serves the prior unchanged production build used by the retained5600 preview. Only the failed attempt's5601/5602 processes were stopped; original5600/5599 tabs were untouched. Before reloading5601, its source was confirmed Saved and conversation empty. The same saved disposable screen reloaded successfully; selecting its heading demonstrates the original floating Format/Insert/Arrange/Connect tools with no bottom Inspector. [Rollback screenshot](cycle-1-3/context-inspector/rollback.png). Verification of the rejected candidate stopped at the owner's request. No further implementation is in progress.

## Owner comments — retained for future review, report only

2026-10-24. Latest owner instruction: “Now just put those whatever I comment on report”. This is documentation-only authority. No further implementation, preview change or verification run is requested. Entry delivery is clean and remote-equal `ff473217d80cb018b487dedc8ca1946fa8f26adc`; main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`.

| Owner comment | Intended direction and disposition |
| --- | --- |
| “Do we support right click? … those object and view could be something that respond on canvas or object right click” | Consider contextual Object/View commands on canvas objects and empty canvas. The restored Studio has no editor context menu; the VICT ContextMenu component exists. The attempted implementation was reverted. Retain this as a proposal, not a delivered feature. |
| “inspect can be something a panel that can be open at the bottom of layer and structure.. because both benefits from it” | Share the existing Structure inspection details between Layers and Structure in an explicitly opened bottom panel. Inspection should benefit both navigation surfaces. Keep the graph or layer list visible above it and maintain the canvas. This is a future proposal following rollback. |
| “I say inspect is usable for both structure and layers.. not the floating tool which already nicely on canvas” | Critical distinction: inspection details and floating editing tools serve different purposes. Existing source facts/properties and relationships are the inspection content under discussion. Do not relocate the existing floating Format/Insert/Arrange/Connect tools, suppress their normal canvas behavior, or treat this comment as a request to redesign those tools. The builder's attempted shared editing pane was a scope/intent mistake. |
| “let me see it first, ill verify myself when you are done” | Make the finished preview available for the owner's direct hands-on review. The owner wants to assess the result personally; do not present builder checks as owner acceptance. |
| “you have git revert?” / “if yes pls revert” | Explicit rollback instruction, completed. Both new context-menu and shared-pane product changes were reverted. Preserve the failed attempt and observations in the report; retain the prior UI. |

The earlier “not too tight” preference continues to apply: any future shared inspection panel should leave comfortable space for the graph/layers and canvas. Resizing, collapse, remembered height and temporary expansion were assistant suggestions for later review, not additional owner comments or a newly authorized implementation specification.

**Current action: report only.** Keep the restored UI and floating canvas tools unchanged. Revisit these proposals only after a further owner instruction; do not resume the abandoned correction round automatically. Other agent/platform findings remain open with their existing dispositions.

2026-10-24. Owner authorized implementation: “OK pls do those update”, accepting the preceding contextual right-click and shared Inspector proposals. This amends the prior focused inspection placement; previous evidence remains historical within its scope.

## Entry and scope

Clean existing isolated branch `codex/studio-cycle-1-3-completion`, local and remote delivery `0877fe5df7f1d4c6ecd41fce07b5c6130d12f0d2`; prior independently verified product `a36793df0f62c002332d66db181310554aaabb05`. Local and remote main remain `d7401bef6e48330796c74ec00c86db9622d48cdf`. No baseline drift observed.

Allowed paths: `apps/studio/src/lib/designer/`, affected `apps/studio/tests/`, scoped documentation/evidence and current-state handoff pointers. Reuse existing VICT ContextMenu, Inspector, canonical commands and transaction validation; no component ABI, package/runtime, backend, provider or agent-tool changes. Preserve owner preview/source/chat. No main merge, publication, deployment or Stage 9 closure.

## Historical attempted interpretation and gate — superseded by owner correction and rollback

- Contextual menus for canvas objects, empty canvas and Structure nodes. Reuse existing commands; select the actual context target first. Preserve native editing menus and Interact page behavior. Provide keyboard invocation and predictable dismissal/focus.
- One shared Inspector below Layers and Structure; deliberately opened, follows selection, resizable/collapsible with remembered in-session geometry. Existing property/style/behavior editors remain the editing authority. Keep graph/layers and canvas visible with useful minimum space; explicit expanded inspection for small windows.
- Draft protection, canonical identity, Undo, runtime and graph/canvas context survive navigation. Showcase all new surfaces using the same components.
- Affected behavioral tests, TypeScript/Svelte checks, production build, actual browser verification on desktop and small windows; commit/push candidate and verify remote SHA, then fresh independent challenge of exact product. Preserve failures and repair/reverify affected scope. Next action after scoped PASS is owner hands-on review; other agent/platform findings remain open/report-only.

Historical status at issuance: implementation authorized; no gate verdict yet. Current status: REVERTED / NOT ACCEPTED; comments retained as proposals only, with no active implementation authority.
