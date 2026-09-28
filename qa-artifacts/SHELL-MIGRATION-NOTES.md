# Legacy shell migration — input notes (QA observations, no restyle performed)

Recorded from the `/projects` vertical QA passes (branches
`qa/ui-foundation-p1`, 2026-09-25). These are **renderer-shell (legacy
`VitApp` chrome) concerns**, deliberately NOT restyled in the UI
foundation QA scope. They belong to the later shell migration.

## 1. Oversized legacy mobile header

Observed (380px and 320px viewports, `refapp-projects-mobile.png`,
`refapp-projects-320.png`):

- The `vict-header` band renders the `☰ Menu` toggle and the screen `h1`
  in a tall band (~150–160px before the breadcrumb/content area starts),
  consuming roughly the first 20% of a phone viewport before any
  application content.
- The header persists as a separate block from the nav; on phones the
  nav collapses behind the menu button but the header band itself keeps
  desktop-scale paddings/type.

Input for the shell migration: compress the mobile header band (smaller
toggle + tighter vertical rhythm) and consider merging the breadcrumb row
into the header on phones.

## 2. Repeated "Projects" heading

Observed on `/projects` at every width (desktop and phone):

1. Header `h1` — "Projects" (screen title, rendered by the shell).
2. Breadcrumb trail — "Home › Projects".
3. Table card `h2` — "Projects" (the table's `intent.title`, currently
   derived in `@victframework/ui` `deriveUiPlan` from the SCREEN title,
   not the surface).

Three stacked repetitions of the same word at consecutive levels.
Input for the shell migration:

- Either the table intent's `title` should default to something other
  than the screen title (surface-level label, or no heading when the
  screen title already names it) — this is a `@victframework/ui` contract
  question to settle BEFORE the shell migration, since `UiTableIntent.title`
  is derived presentation intent;
- or the shell should omit the screen `h1` when the first surface already
  carries the same title.

## Boundary

These are observations only. The legacy shell (`VitApp.svelte`,
`vict-header`, breadcrumb, nav) was NOT modified in this QA pass, and no
Application Definition field was added or changed.