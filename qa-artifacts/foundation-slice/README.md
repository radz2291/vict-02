# VICT UI foundation — owner checkpoint

**FOUNDATION SLICE READY FOR OWNER VISUAL REVIEW**

This is an implemented first slice, not visual acceptance. No merge or publication.

## Reproduce the review

From the new worktree:

```powershell
cd C:\Users\RZ1\Desktop\RZ\vict-02-ui-foundation-slice
npm run foundation
```

For a fresh checkout, install once with `npm ci` first (Node >=22.13).
The one launch command builds the eight required package dependencies and starts
the existing SvelteKit host in foundation mode. It uses a fixed port and fails
if 5178 is occupied rather than silently opening a different URL.

- [Requests / records and form](http://127.0.0.1:5178/records)
- [Conversation / workspace](http://127.0.0.1:5178/workspace)
- The root URL redirects to Requests.

The original P6D showcase remains runnable in its existing worktree. In this
branch, `npm run dev -w ui-showcase` still loads its original definition;
`VICT_FOUNDATION=1` selects the two-screen review definition.

## Repository facts

- P6C integration: `e441157209812c929be26ad8f67e177922b6d99b`.
- Verified P6D baseline: `9456342ddeb237ecb9784b4817e651cd9a16e048`.
- Initial fetched `origin/main`: `c633229d4041c0a88d2184e2a3ee834cfbbcfee8`.
- Current `origin/main` at checkpoint: `7307f2fee01b1ca3b7cb048ab8b2b75b4973d3b1` (advanced independently during implementation).
- Branch: `codex/ui-foundation-slice-20260926`.
- Final commit: the commit containing this report (`git rev-parse HEAD`); the
  exact pushed SHA is also supplied in the owner handoff.

P6D contains P6C. No baseline discrepancy was found. ui-svelte is the canonical
implementation, renderer-svelte is the compatibility facade. Neither main nor
any existing worktree was edited.

## What is implemented

A shared slate/teal token system, type and spacing hierarchy, focus rings,
disabled/pending states, density, responsive region composition, navigation,
status and feedback. Real controls include native buttons, text/number/date/
textarea fields, boolean checkbox and string selection; Bits tabs, dialog,
drawer, content popover and tooltip. Records, forms and conversation use those
same production components.

The records view pairs a searchable/sortable/paged table with an inline form.
The workspace prioritises a conversation with tabs and a supporting context panel.
The records display popover actually changes row density. Tooltips work on focus.
Dialogs/drawers have focus containment, Escape, outside dismissal and restoration.
Nested overlays use a scoped portal, so app tokens survive and parent transforms
do not interfere. Server-backed actions inside a modal present their result inside that modal.
Form submissions suppress duplicate sends while pending. Conversation sends
follow new messages while preserving manual reading position away from the end.

[The 41-family coverage catalog](../../packages/ui-svelte/FOUNDATION-CATALOG.md)
records the strategy for every Bits UI family: 30 targeted for styling,
8 exposed without wrappers, and 3 specifically deferred. Seven family treatments
are implemented now. Selection/disclosure/menus, commands/progress and date/time
families remain scheduled after visual review. Exposed raw primitives are not
claimed as finished styled components.

The chosen library is Bits UI 2.19.3, compatible with installed Svelte 5.57.0.
ui-svelte now requires Svelte ^5.33.0. Primitive composition is available from
`@victframework/ui-svelte/primitives`. The compatibility facade still re-exports
the one canonical implementation; no duplicate components or CSS were added.

## Definition and data boundaries

All visible UI in both review routes comes from a normal Application Definition,
compiled into the Application Plan and interpreted by VitApp. **Zero custom slots**,
zero page-specific CSS. The host only wires route data, dispatch and navigation.
The popover and tooltip are ordinary reusable table controls, not bespoke schema nodes.

Additive, validated **@2-only** contract changes:
- Screen `layoutMode: stack | split`.
- Region `size: full | main | aside`, `appearance: plain | panel`,
  `flow: stack | inline`.
- Form `widget: select` with ordered, unique, nonempty string options.

Defaults preserve existing stacks. Invalid metadata/options are rejected. Options
participate in application identity. Select values remain strings, numeric zero
remains a number, and boolean false remains a boolean. Server contracts remain
authoritative. No visual editor or generative UI system was introduced.

The host reuses P6D's in-memory data adapter and deterministic capability reply.
Six initial requests and three initial messages are fixed constants. A discovered
create defect was fixed: generated request IDs are now unique, so repeated
submissions are not accidentally treated as one idempotent request.

## Verification

- Focused ESLint and `git diff --check`: passed.
- `npm run typecheck`: passed. The SvelteKit showcase now has its own typecheck
  scope, like the existing SvelteKit examples; root tsc no longer mis-resolves $lib.
- `npm run check:ui`: 0 errors, 0 warnings. This newly checks actual .svelte files,
  catching pre-existing rune-name collisions and missing types skipped by tsc.
- `npm run check -w ui-showcase`: passed.
- All eight prerequisite package builds and production showcase build: passed.
- Renderer/component/facade tests: **73 passed**.
- Application compiler tests, including the added contract tests: **944 passed**.
- Focused foundation and original showcase definition/server tests: **10 passed**.
- `npm run test:foundation`: **10 browser checks passed** against the built server.

Browser checks cover both definitions, no document overflow, axe serious/critical
violations, mobile navigation, search/sort/empty state, popover/tooltip keyboard
behavior, nested modal containment and restoration, tab arrows/Home/End,
mobile overlay bounds, local/server form validation, exact submitted value types,
repeat creates and real conversation action/reply/focus.

Inspected widths: **1440, 768, 390, 320 pixels**. Captures are in this directory:
[desktop records](records-1440.png), [desktop workspace](workspace-1440.png),
[mobile records](records-390.png), [mobile workspace](workspace-320.png),
[drawer](drawer-1440.png), [mobile dialog](dialog-390.png).
[Machine-readable checks](verification.json) lists the completed browser assertions.

happy-dom was updated at the root to 20.14.5 for Svelte/Bits DOM compatibility.
Tests now exercise accessible roles and real keyboard events rather than native
dialog implementation details. Browser evidence remains primary for focus behavior.

## Known limitations for review

- This is the early design direction. Most planned styled families are unfinished.
- Split/stack regions are intentionally coarse; arbitrary nested layout composition
  is not yet in the schema.
- The native select is single-value/string-only. Async options, multiselect, date
  ranges and commands need the explicit contracts described in the catalog.
- Server validation exposes a form-level safe error; field-addressed server issues
  require an ActionResult contract extension.
- Action tone still follows the legacy “delete” ID heuristic; explicit action
  emphasis/destructive semantics should replace that in a later contract change.
- Data is local/in-memory and resets on restart. Replies are deterministic
  capability outputs, not a live AI connection. Request creation is a demo workflow.
- The chat composer is single-line. Large-history virtualisation, dark theme,
  localisation and a screen-reader-device audit are not part of this slice.
- Wide tables retain local horizontal scrolling at 320px. Supporting panels stack
  beneath the primary work below 1100px, so the mobile form is below the table.
- The full P6D scenario matrix, release machinery, trust and publication were
  intentionally outside this cycle. Shared styling changes need broader visual
  regression review after the owner accepts a direction.

