# UI P3 — QA Verification Report

- **Codex branch verified:** `codex/ui-foundation-p3` at `89af779f445135f1aac98fd370f6f35796392bda` (local == origin; commit `feat(ui): migrate shared interactions and overlays to ui-svelte`)
- **QA branch:** `qa/ui-foundation-p3` (worktree `vict-02-qa-ui-p3`), based exactly on the P3 SHA
- **Untouched:** `main`, all Stage 8 branches/worktrees, the Codex P1/P2/P3 branches and worktrees
- **Result: P3 is ready for owner visual review** after three bounded QA fixes (details below). No Codex foundation correction is required.

---

## 1. Environment

- Full workspace build + `npm ci` in the QA worktree; all package `dist/` outputs present.
- Real-browser loop: Chrome 153.0.8010.54 (headless, puppeteer-core), consistent with the
  reference app's existing browser-suite discovery.
- Suites: renderer unit project **59/59**, reference-app suite **62/62** (includes the real-Chrome
  browser suite and axe-core scans), full unit suite 2098/2106 (the 8 pre-existing failures are
  dist-dependent store/server tests that need the workspace build first; they pass after
  `npm run build` — not P3-related).

## 2. Defects found and fixed on the QA branch (bounded, presentation/a11y only)

### D1 — Required-field errors never rendered in real browsers (`Form.svelte`)
**Severity: high (a11y + canonical semantics divergence).**
`FormField` sets the native `required` attribute on controls, but the `<form>` did not set
`novalidate`. In any real browser, native constraint validation BLOCKED the submit event for
empty required fields, so the canonical `form-values` required-error model (renderer-generated,
field-associated `FIELD_ERROR_REQUIRED` + explicit `aria-describedby` association) never ran —
users got a native bubble for one field at a time, and screen readers got neither the summary
nor the per-field links. happy-dom does not enforce constraints, so the DOM tests saw the
canonical path while real browsers did not. **This defect pre-exists P2's hand-written form and
was carried into P3's migrated `Form.svelte`.**

**Fix:** `novalidate` on the `<form>` in `packages/ui-svelte/src/Form.svelte` (comment explains
why). The `required` attribute stays (AT announces required state); the canonical model owns
error rendering. `form-values` semantics unchanged.

**Verified in real browsers (harness + reference app):** every required field's error is
field-associated (`aria-describedby` → `vict-field-error-<form>-<field>`, `aria-invalid=true`),
the summary alert renders (`Please correct the highlighted fields.`), and an empty submit
crosses NO boundary (0 dispatches — proven by a dispatch log on-page and by instrumenting
`/api/act` traffic in the reference app).

### D2 — Third+ tabs unreachable at 320/380px (`styles.css`)
**Severity: medium (mobile usability).**
`.vict-tablist` had `overflow-x: visible`; with long tab labels the tab run exceeded the
viewport at 320px while `.vict-main` (overflow-x: hidden, from P2) clipped it — the document
never scrolled sideways, so trailing tabs were visually cut off and unreachable. Screenshot
`shots-harness/h-longtabs-320.png` (pre-fix) shows the third tab reduced to a sliver.

**Fix:** contained horizontal scroll on the tablist (`overflow-x: auto;
overscroll-behavior-x: contain`) — the same pattern as the P2 table scroll region. Desktop
layouts where tabs fit are unchanged; at phone widths every tab is reachable by touch swipe
and by keyboard focus (focus scrolling brings tabs into view; ArrowLeft/Right already move
selection).

**Verified:** `h-longtabs-320.png` / `h-longtabs-380.png` (default) and `-scrolled` variants
show the full run reachable; scrollWidth > clientWidth with contained scroll, document overflow 0.

### D3 — Detail values clipped at 320px (`Surface.svelte` scoped styles)
**Severity: low-medium (mobile usability).**
`.vict-detail` uses `grid-template-columns: 10rem 1fr`; grid items default to
`min-width: auto`, so an unbreakable value (JSON, ids) forced its column ~105px past the panel
edge and was clipped by the page container at 320px (measured live).

**Fix:** `min-width: 0; overflow-wrap: anywhere` on `.vict-detail dd` — long values wrap and
stay fully visible at every width; desktop unchanged.

**Verified:** `h-rec-320.png` after fix — the JSON value wraps inside the panel (dd right edge
25px inside the panel boundary, measured live).

### Approved bounded cleanup
- Stale header comment in `ui-svelte/src/styles.css`: “Vict renderer — semantic theme tokens
  (renderer-owned CSS variables)” → now states ui-svelte owns the tokens/presentation and
  `renderer-svelte/theme.css` is a compatibility entry point. No CSS rules changed for this.
- Svelte a11y compiler warning on `RecordsTable.svelte`'s scroll region (`tabindex="0"` +
  `role="region"` — the P2 QA fix for axe `scrollable-region-focusable`): silenced with a
  documented `svelte-ignore` comment; the pattern is intentional and axe-required.

## 3. Form semantics (real-browser, harness + reference app)

All canonical `form-values` behavior confirmed in real Chrome (canonical module untouched):

| Check | Result |
| --- | --- |
| Text input create/edit round-trip | PASS |
| Date input (segmented keyboard entry; dispatched string == control value, `YYYY-MM-DD`) | PASS |
| JSON field remains a textarea (never a code/JSON widget) | PASS |
| Numeric prefill stays numeric with NO edit (dispatched `budget: 320` number) | PASS |
| `0` prefills as visible `0` and survives untouched submit as number `0` | PASS |
| Invalid/garbage numeric typing: browser `badInput` keeps raw state `''`; submit produces a field-local required error and **zero** dispatches (network-observed) | PASS |
| Optional empty numeric → key OMITTED from payload (declared absent semantics), re-filled → number, cleared again → omitted | PASS |
| Required errors associated with the correct control (after D1 fix) | PASS |
| Boolean round-trip: untouched `false` dispatches `false` (not absence); toggled `true` dispatches boolean | PASS |
| Edit prefill resets when identity changes (client-side route change, dirty state discarded, new record prefilled) | PASS |
| Forms inside tabs: state survives tab switches; submit works after tab changes | PASS |
| Forms inside dialog and drawer: prefill + canonical dispatch + identity | PASS |
| Keyboard/focus: labels, error links, tab order, mobile layout | PASS |

## 4. Tabs (real browser)

- ArrowLeft / ArrowRight / Home / End — all select + focus + roving tabindex — PASS
- Wraparound both directions — PASS
- Selected tab `aria-selected="true"`; only the selected tab is in the tab order (others
  `tabindex="-1"`; Tab from the tablist skips to content) — PASS
- `aria-controls` / `aria-labelledby` wiring verified per panel — PASS
- Nested forms/actions keep working after tab changes (state preserved — panels stay in DOM) — PASS
- 320px and 380px: no page overflow; long-label tabs reachable via the contained scroll fix — PASS
- Reference-app detail tabs (Overview/Edit incl. edit form) verified at 1280/380/320 — PASS

## 5. Dialog and drawer (native `<dialog>`; real browser)

- `showModal()` → dialog open, `:modal` (top layer), focus moves into the panel — PASS
- Background inert: real mouse click on a background trigger hits only the top layer (backdrop
  dismisses; nothing behind opens); synthetic-click probe avoided as non-user evidence — PASS
- Tab / Shift+Tab cycling (12 cycles): focus never reaches interactive background content.
  One nuance, verified inherent to Chromium's native `<dialog>` with a minimal 3-button repro
  (same Chrome build): at the wrap boundary focus passes through `document.body` for one stop
  and returns into the dialog. Nothing operable outside is focusable, and inert remains active —
  **not a containment leak**; per the task's fix policy, no custom focus trap was reintroduced.
- Escape closes; explicit Close closes; backdrop click closes; clicks on panel content
  (header, form) do NOT close — PASS
- Trigger regains focus after every close path (Escape / Close / backdrop) — PASS
- Drawer and dialog presentation distinct (right-aligned full-height drawer vs centered
  dialog); both fit and remain usable at 380px and 320px — PASS
- Nested surfaces: forms inside dialog/drawer work; a dialog nested inside a drawer opens both
  in the top layer; Escape closes only the topmost; the parent stays open (matches the P3
  happy-dom regression test) — PASS
- Authorization-denied action inside the dialog: dispatch surfaces the declared denial
  (`role=alert`, warning-toned border) while the dialog stays open — PASS
- Route/data invalidation after a successful nested action: the nested bump invalidates route
  data and the dependent list re-renders — PASS

## 6. Actions, status and feedback (real browser)

- Primary / danger visual distinction verified (screenshot + class assertions); disabled
  actions render `disabled` and non-interactive.
- Note (observation, NOT changed): the renderer maps action variant by
  `actionId.includes('delete')` → danger, everything else → primary — pre-P2 behavior,
  preserved verbatim by P3; the `secondary` variant is currently assigned to no action surface
  (only used internally by the overlay trigger). Changing the mapping would be a presentation
  contract decision for the owner/Codex, not a QA fix.
- Action semantics/dispatch unchanged: action buttons still dispatch through the same
  `run` boundary with `data-action-kind`/`data-action-id`; local actions stay local;
  navigation actions navigate.
- Status tones: all five tones (neutral/success/warning/danger/info) render distinct badges;
  tone mapping from the plan verified on real records (active→success, paused→warning,
  done→neutral).
- Feedback ARIA: error/denied → `role="alert"`; status → `role="status"`; empty → plain state
  text with `data-state="empty"`; stale/partial banners surface with the declared texts;
  success feedback ("Done.") carries `data-last-action`.
- Contrast (computed in-page, light theme): every sampled text/badge/button pairing ≥ 5.67:1
  (WCAG AA 4.5:1) — PASS. Focus rings visible (2px accent outline, verified in the keyboard
  walk in the reference browser suite).
- Long labels and mobile widths: 320/380 verified across form, tabs, detail, drawer, overlays —
  no horizontal page overflow anywhere (D2/D3 fixed the two found violations).

## 7. Styling ownership

- `renderer-svelte/theme.css` is now a compatibility entry point: it `@import`s
  `@victframework/ui-svelte/styles.css` and adds ONLY renderer-specific roles (card, plain
  table, list, conversation, chart). Selector-by-selector comparison: **zero duplicated
  selectors** between the two files; migrated P3 presentation has exactly one implementation
  (ui-svelte).
- The stale "renderer-owned CSS variables" comment in `ui-svelte/styles.css` corrected
  (approved bounded cleanup; no rule changes).
- Theme contracts untouched.

## 8. Packed consumer proof (0.3.1)

- Packed from the QA worktree (including QA fixes): `contracts`, `sdk`, `application`, `ui`,
  `ui-svelte`, `renderer-svelte` — all 0.3.1 (tarballs committed under `packed/` for
  reproduction).
- Two consumers created in a FRESH temp dir **outside the repository** (no workspace
  resolution possible): `consumer-compat` (imports `@victframework/renderer-svelte/theme.css`)
  and `consumer-direct` (imports `@victframework/ui-svelte/styles.css`). Identical app: the
  generic `VitApp` host + the compiled harness plan (compiled through the real SDK compiler) +
  a consumer-side in-memory boundary.
- Per variant: `npm install` from the tarballs — installed versions assert exactly 0.3.1;
  lockfile contains no monorepo leakage; `vite build` succeeds; emitted CSS inspected and
  contains the migrated presentation (btn/tablist/overlay--drawer/status/form) INCLUDING the
  QA fixes (`overscroll-behavior-x` containment, `novalidate` fix active at runtime).
- Real-browser behavior per variant (Chrome, built `vite preview`): host mounts, all widget
  controls render, required errors field-associated, canonical dispatch to the consumer
  boundary (`budget: 88` number), tabs + ArrowRight, dialog modal + focus + Escape + focus
  restore, drawer right-aligned, five status tones, denied `role=alert`, no horizontal
  overflow at 380/320, long tabs reachable (fix present in the packed CSS).
- **42/42 consumer checks passed — both styling paths.**

## 9. Screenshots (committed under `qa-artifacts/qa3/`)

- `shots-harness/` (25): form + validation errors, edit prefills (zero/one), invalid numeric,
  tabs detail, longtabs 320/380 default+scrolled, dialog open/denied/backdrop-close,
  drawer open 1280/380/320, nested overlay, nested invalidation, status tones, action
  variants, stale feedback, forms at 380/320.
- `shots-refapp/` (14): create-form errors, edit tab, invalid numeric, status tones, dialog
  denial, drawer island, projects/detail/create at 1280/380/320.
- `shots-consumer-compat/`, `shots-consumer-direct/` (7 each): form errors, tabs, drawer,
  tones, denied, widgets at 380/320.
- All screenshots were visually inspected; the D2 pre-fix clipping and its fix are captured
  in the longtabs series.

## 10. Drivers (reproducible)

- `qa-harness.mjs` — 58 checks against the harness app (`harness/`, vite dev; plan compiled by
  `harness/scripts/emit-plan.mts` through the real SDK compiler). **58/58.**
- `qa-refapp.mjs` — 26 checks against the BUILT reference application (adapter-node server,
  fresh SQLite per run, network-level dispatch observation). **26/26.**
- `qa-consumer.mjs` — 42 checks (21 × 2 variants) end-to-end: pack → temp install → build →
  CSS inspection → preview → real browser. **42/42.**
- Results JSONs: `harness-results.json`, `refapp-results.json`, `consumer-results.json`.

## 11. Warnings

1. Chromium's native modal wrap passes through `document.body` for one Tab stop at the
   wrap boundary (verified inherent to `<dialog>` via minimal repro). If a future owner
   review requires zero body stops, that is a cross-browser focus-trap design conversation —
   deliberately NOT re-implemented here per the fix policy.
2. Action-variant mapping (`includes('delete')` → danger; `secondary` unused for actions) is
   pre-existing and preserved. Flagging for the owner: if secondary action styling is wanted,
   the plan surface/intent contract needs a declared field — a Codex contract change, out of
   QA scope.
3. The 8 pre-existing dist-dependent unit failures (store/server restart tests) fail on a
   clean checkout without `npm run build` and pass after it; unrelated to P3.
4. Reading-time metric CONTENT rendering is covered by the existing DOM-level suite
   (`reading-time.test.ts`, adapter-seeded notes); the real-browser run verifies the P3-owned
   path (dispatch inside tab, success feedback, region refetch to the correct empty state) —
   the create contract intentionally cannot carry `notes`, so the browser cannot seed them.
5. Windows-only tooling note: `npm.cmd` fails with "stdout is not a tty" when spawned with
   redirected output; `qa-consumer.mjs` invokes npm via its JS CLI entry to stay reproducible.

## 12. Verdict

**Ready for owner visual review.** All P3-migrated behavior (forms, tabs, native
dialog/drawer, actions/status/feedback, styling ownership, packed consumers, mobile) is
verified in real browsers; the three QA fixes are bounded presentation/a11y corrections that
do not touch framework-neutral UI contracts, application authority, `vict.application@2`,
canonical `form-values` semantics, or nested-surface interpretation. Nothing here requires a
Codex foundation correction. Release-set 13→15 work, merge, and publication remain untouched.
