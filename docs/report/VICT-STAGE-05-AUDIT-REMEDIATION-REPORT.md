# VICT Stage 05 — Independent Audit Remediation Report

## Outcome

**STAGE 05 AUDIT REMEDIATION COMPLETE — READY FOR FOCUSED INDEPENDENT RE-AUDIT**

Both gating findings (HIGH-05-A, MED-05-A) and the two bounded Low findings
assigned to this pass (LOW-05-C, LOW-05-D) are corrected with permanent
regression evidence that reproduces the real user tasks. Negative controls
demonstrate the new blocker regressions fail against `03a04a9` and pass after
the correction. The full verification ladder, the complete test suite
(3 consecutive runs), the targeted regressions (5 consecutive runs), the
built reference application as a real process, and desktop/tablet/mobile
browser checks all reproduce green. Stage 06 and the Mastra/ARA amendment
were NOT begun.

## Starting and final SHAs

| Item | SHA |
| --- | --- |
| Required starting SHA (`origin/main` at start) | `53a8ec1b1e4ee4db7578681502de1d7559e04a7b` |
| Original Stage 05 implementation (in ancestry) | `03a04a96a3c11be641305bf035033a83d6ef82f0` |
| Original Stage 05 report tip (in ancestry) | `f1589550d5d499c4404f3eff76e9e0e05ed73deb` |
| Implementation commit (this remediation) | `d346badd1d042afb61f6e36847b0716116bc4dd7` |
| Documentation commit (this remediation) | *(this commit)* |

The independent audit document
(`docs/report/VICT-STAGE-05-INDEPENDENT-AUDIT.md`) and the original
`docs/report/VICT-STAGE-05-REPORT.md` remain **byte-identical to `53a8ec1`**
(verified before each commit via `git status` and content checks).

## HIGH-05-A correction

**Root cause.** `FormSurface.svelte` prefilled every field through
`String(value)` into a string-typed map (`Record<string, string>`) and
submitted `{ ...formValues }` verbatim. Svelte's number-input coercion only
runs on user input events, so an untouched numeric prefill was dispatched as
a string (`budget: "42"`). The declared contract correctly rejected it
(`CONTRACT_REJECTED`), and the renderer showed only the screen-level
validation alert with no field-level indication — a normal "change the name
and save" edit failed for every numeric-bearing record.

**General type policy (no field-name inference, no per-field special cases).**
A new centralized, framework-neutral form-value model
(`packages/renderer-svelte/src/form-values.ts`) is now the single canonical
value-normalization policy shared by create AND edit forms:

- The declared `widget` metadata is the ONLY type source
  (`text | number | boolean | date | json`; unknown widget hints fail safe
  as `text`). The renderer never infers types from field names, and nothing
  depends on an input event having occurred.
- **Prefill** (`prefillFormState`) converts the stored record into the
  declared widget-boundary state: finite numbers round-trip exactly through
  a strict decimal grammar (so `42` is submitted as `42` without user
  interaction); `0` stays `0` (distinguishable from empty/absent); booleans
  carry their documented domain (`false` is a value, and boolean controls no
  longer carry a native `required` that would force `true`); string domains
  (text/date/json) stay strings; absent or hostile stored values become the
  empty display state and are NEVER echoed (`String(value)` is gone).
- **Submit** (`toSubmitPayload`) converts the raw widget-boundary state into
  the canonical typed payload. Invalid numeric text can never become `NaN`,
  infinity, or a silently coerced value: the strict grammar rejects it, the
  value never dispatches, and a renderer-generated, field-associated error
  (`aria-invalid`, `aria-describedby`, per-field message, form-level
  `role="alert"`) appears instead. Required-empty fields fail locally the
  same way. Optional empty numbers follow the declared absent semantics (key
  omitted — never dispatched as `''`); optional empty string-domain values
  are dispatched as `''`, matching the declared contract semantics.
- Conversion failures remain local to the form: no malformed mutation is
  ever dispatched, no contract issue is provoked, and the existing
  contract-issue sanitizer is untouched. The number control uses an explicit
  `value`/`oninput` binding (Svelte's implicit numeric coercion no longer
  decides the submitted type).

**User-visible behavior.** Opening a record, switching to Edit, changing
only the name, and saving now succeeds; the untouched numeric field is
stored and re-displayed as a number; invalid numeric input shows
"Enter a valid number." next to the field and nothing is dispatched.

## MED-05-A correction

**Root cause.** The mobile media query replaced the shell's
`grid-template-areas` with `'header' 'main'` but left the desktop
`.vict-nav { grid-area: nav; }` assignment active. The opened navigation was
therefore auto-placed into IMPLICIT grid columns
(`209.406px 0px 164.594px` at 390×844), rendering the nav beside/below the
fold and squeezing the main content from 374 px to 209.4 px.

**Responsive layout policy.** `theme.css` now declares the mobile shell as
an explicit three-row single-column grid `'header' 'nav' 'main'`. The
navigation is an intentional in-flow panel placed between the header and the
main content; the desktop `grid-area: nav` assignment matches the declared
mobile area name, so no implicit track can ever be created at any
breakpoint. When the menu is closed (`display: none`) its row collapses to
zero height. The desktop/tablet layout (sidebar column `240px` +
`minmax(0, 1fr)`) is unchanged.

**Navigation policy (explicit and tested).** The menu CLOSES when the
application navigates to another screen (the open panel never surprises the
user on a new screen) and stays open while the user interacts within the
current screen. Escape pressed inside the open menu — or on the menu control
— closes it and restores focus to the control. The menu control keeps its
accessible name and `aria-expanded` state; DOM order (header → nav → main)
preserves logical keyboard order.

**Measured behavior (Chrome 151, real process, built app).** At 390×844 the
main content measures **374 px with the menu closed and 374 px with the menu
open** (shell tracks `374px`, a single explicit track; nav opens at
x=8, y=96, 374×306, fully inside the shell and above the fold). Full
viewport matrix in "Browser evidence" below.

## Bounded Low corrections

- **LOW-05-C (heading levels).** `logic.ts` now exposes
  `headingTagForLevel(level)`, mapping declared levels 1–6 onto a frozen
  closed vocabulary `['h1' … 'h6']`; `Surface.svelte` emits that tag via
  `svelte:element`. The tag name can only originate from the
  compiler-validated closed set (out-of-vocabulary levels, non-integers, and
  unleveled text render the documented non-heading `<p>`); no arbitrary
  element injection is possible. Permanent tests assert the actual emitted
  elements for all six levels, the non-heading fallback, and a meaningful
  nested document outline.
- **LOW-05-D (duplicate interface member).** The duplicate identical
  `search?` member was removed from `RecordsTable.QueryPayload`. Emitted
  declarations were re-typechecked (`tsc --noEmit`, strict, plus packed
  consumers via `verify:stage5`); public behavior is unchanged.

## Files changed

**Renderer correction (HIGH-05-A)**
- `packages/renderer-svelte/src/form-values.ts` (new) — centralized
  type-aware form-value model: closed widget vocabulary, prefill
  normalization, typed submit conversion, field-local errors.
- `packages/renderer-svelte/src/FormSurface.svelte` — canonical prefill and
  submit through the model; typed widget bindings (explicit number
  value/oninput, boolean checked); field-associated error markup with
  `aria-invalid`/`aria-describedby`; form-level local-validation alert.

**Renderer correction (MED-05-A)**
- `packages/renderer-svelte/src/theme.css` — mobile shell
  `'header' 'nav' 'main'` explicit grid row for the navigation.
- `packages/renderer-svelte/src/VitApp.svelte` — close-on-navigate policy,
  Escape-with-focus-restore policy (`svelte:window` handler), toggle
  `bind:this` for focus restoration.

**Bounded Low corrections**
- `packages/renderer-svelte/src/logic.ts` — closed heading vocabulary +
  `headingTagForLevel` (LOW-05-C).
- `packages/renderer-svelte/src/Surface.svelte` — declared heading tag
  emission (LOW-05-C).
- `packages/renderer-svelte/src/RecordsTable.svelte` — duplicate `search?`
  member removed (LOW-05-D).

**Permanent regression evidence**
- `packages/renderer-svelte/test/form-values.test.ts` (new, 12 tests) —
  renderer-level coverage of every supported form value type, create/edit
  parity, hostile-prefill fail-safety (DOM level, through the real compiler
  path).
- `packages/renderer-svelte/test/heading-levels.test.ts` (new, 4 tests) —
  closed vocabulary mapping, emitted elements, non-heading fallback,
  document outline.
- `examples/reference-app/test/browser.test.ts` — HIGH-05-A real-browser
  edit-save regression (prefill → text-only edit → submit → success →
  reload → SQLite type check → real SIGKILL restart → type survives) and
  MED-05-A layout-integrity regressions at 320×720, 390×844, 820×1180,
  1280×800 with keyboard exercise; `startServer` helper extraction.
- `examples/reference-app/test/dom.test.ts` — DOM-level prefill→dispatch
  typed-payload regression across the real reference application.

**Documentation**
- `docs/architecture/STAGE-05-APPLICATION-DELIVERY.md` — form-value model,
  heading semantics, and mobile navigation layout/policy now documented
  accurately (status line unchanged: still not independently verified).
- `docs/report/VICT-STAGE-05-AUDIT-REMEDIATION-REPORT.md` (this file).

## Permanent regression evidence

Renderer-level (happy-dom, through the REAL compiler path; every currently
supported form value type):

- Prefilled numeric value remains numeric without user interaction (edit
  path, `__identity` preserved).
- Numeric zero survives (`Object.is(payload.qty, 0)`).
- Changed numeric value is dispatched as a number.
- Invalid numeric text (`abc`, `1e999`, canary-bearing text) never
  dispatches, never becomes `NaN`/`Infinity`, and never echoes into the DOM
  or diagnostics; only renderer-generated local messages appear.
- Empty optional numbers are omitted; optional empty strings dispatch as
  `''`; required empties fail locally with a field-associated error.
- Text, boolean, date, and json values retain their declared types
  (including untouched prefills).
- Create and edit paths share the canonical normalization (same payload
  types; edit adds `__identity` only).
- Hostile prefill values (objects containing a canary) fail safely without
  echo (`[object Object]` and canary absent).
- Heading levels 1–6 emit `h1`–`h6` from the closed vocabulary; unleveled
  text stays a paragraph; the outline nests meaningfully.

Real-browser regressions (`examples/reference-app/test/browser.test.ts`,
Chrome 151 against the built server over SQLite):

1. HIGH-05-A: seed a project (`budget: 42`) → open `/projects/edit-e2e-1` →
   switch to the Edit tab → leave the numeric field untouched → change only
   Name → submit → success state visible → captured dispatch payload types
   asserted (`budget` number 42, `__identity` present) → reload confirms the
   edit → direct SQLite read confirms the stored value is a JSON number →
   SIGKILL the built server, restart over the same database → the edit and
   the numeric type survive (HTTP render + SQLite re-read).
2. MED-05-A: at 320×720 and 390×844 — closed-state measurements, open-menu
   visibility, explicit single grid track, main-content width preserved,
   no horizontal overflow, navigate-through-menu policy (menu closes),
   keyboard exercise (Tab → Enter → Escape with focus restore), closing
   restores the closed layout; at 820×1180 and 1280×800 the desktop sidebar
   layout is asserted intact (two explicit tracks, main column untouched).

## Negative controls

A temporary worktree was created at
`03a04a96a3c11be641305bf035033a83d6ef82f0` (detached HEAD, `npm ci` from
scratch, the new browser regression file copied in as a temporary probe and
restored before removal — nothing modified, nothing committed). The new
blocker regressions ran three consecutive times at that SHA:

| Regression | Result at 03a04a9 (3× runs) | Result after correction |
| --- | --- | --- |
| HIGH-05-A: prefilled numeric edit-save (real browser, restart included) | **FAIL ×3** (`act.updateProject` never succeeds; prefill dispatched as string) | **PASS** (5× consecutive runs on the remediation) |
| MED-05-A: mobile 320×720 open-menu layout | **FAIL ×3** (main content 139.4 px; implicit tracks `139.406px 0px 164.594px`) | **PASS ×5** (main content 304 px; single track `304px`) |
| MED-05-A: mobile 390×844 open-menu layout | **FAIL ×3** (main content 209.4 px; implicit tracks `209.406px 0px 164.594px`; nav auto-placed at x=217.4, y=592) | **PASS ×5** (main content 374 px; single track `374px`; nav in-flow at x=8, y=96) |

The ten pre-existing browser tests (desktop keyboard/dialog/theme/axe and
mobile usability) continued to pass at `03a04a9`, isolating the failures to
the two corrected defects. The temporary worktree and all generated
artifacts (build output, SQLite files, measurement script) were removed
afterwards; `git worktree list` shows only the main working tree.

## Verification evidence

Environment: Windows 11 (10.0.26200.8973), win32-x64; Node v22.13.1;
npm 10.9.2; git 2.50.1.windows.1; Google Chrome 151.0.7922.109
(puppeteer-core, headless). Node 24 and a second operating system are NOT
available in this environment — recorded accurately; no Node 24 or second-OS
checks were executed and none are claimed.

`npm run typecheck` ran BEFORE `build` with zero pre-existing `dist`
directories (fresh `npm ci` + removal of all generated artifacts first).

| Command | Exit status | Observed result |
| --- | --- | --- |
| `npm ci` | 0 | clean install, 276 packages (npm-audit dev-toolchain advisories recorded as warnings, as in the original audit) |
| `npm run typecheck` (before build, no dist) | 0 | strict, zero errors |
| `npm run format:check` | 0 | all files formatted |
| `npm run lint` | 0 | no findings |
| `npm run build` | 0 | 9 packages emit cleanly |
| `npm run test:unit` | 0 | 562 tests pass |
| `npm run test:integration` | 0 | 4 tests pass |
| `npm test` (×3 consecutive) | 0, 0, 0 | **57 files / 611 tests**, each run (595 + 16 new) |
| `npm run verify:consumer` | 0 | packed-tarball consumers pass; no Zod leakage in base artifacts |
| `npm run verify:stage2` | 0 | PASSED |
| `npm run verify:stage3` | 0 | PASSED (real-process restart fixtures) |
| `npm run verify:stage4` | 0 | PASSED |
| `npm run verify:stage5` | 0 | ALL checks passed (incl. warning-free reference build inspection, reference suites, packed scaffolder install→generate→install→build) |
| `npm run example` | 0 | ARA proof: exactly 13 ordered events |
| `npm run bench` | 0 | `bench-three-node-pure`: 10 events per completed run, re-validated from SQLite n=500 |
| `npm run example:application` | 0 | Stage 04 proof: 17/17 |
| renderer form suite ×5 | 0, 0, 0, 0, 0 | **45/45** each run (renderer project incl. new form-value + heading suites) |
| reference-app browser suite ×5 | 0, 0, 0, 0, 0 | **13/13** each run (incl. HIGH-05-A + MED-05-A regressions) |
| full suite ×3 | 0, 0, 0 | 611/611 each run |
| `git diff --check` | 0 | no whitespace errors |

Test-count deltas: renderer project 29 → **45** (+12 form-values, +4
heading-levels); `npm test` total 595 → **611**; reference-app browser suite
8 → **13**; reference-app dom suite 10 → **11**. No timeouts, retries,
concurrency settings, or warnings were changed or suppressed; no sleeps were
increased (server readiness uses explicit stdout-barrier waits; UI waits use
selector/function conditions). Every failure encountered during development
was investigated honestly (two test-authoring bugs — a fixture field-name
mismatch and a stale build — were found and fixed; none were dismissed).

## Browser evidence

Chrome 151 (headless, puppeteer-core) against the built reference
application (`node build` + SQLite application data). Exact measurements
(`getBoundingClientRect`, computed grid tracks, `scrollWidth/clientWidth`):

| Viewport | State | nav rect (x, y, w) | main-content width | Shell tracks | Horizontal overflow |
| --- | --- | --- | --- | --- | --- |
| 320×720 | menu closed | — (display none) | 304 px | `304px` (1 track) | none (320/320) |
| 320×720 | menu open | 8, 83, 304 (visible, on screen) | **304 px (unchanged)** | `304px` (1 track) | none (320/320) |
| 390×844 | menu closed | — (display none) | 374 px | `374px` (1 track) | none (390/390) |
| 390×844 | menu open | 8, 96, 374 (in-flow panel below header, above the fold) | **374 px (unchanged)** | `374px` (1 track) | none (390/390) |
| 820×1180 | desktop layout | 8, 8, 240 | 564 px | `240px 564px` (2 explicit tracks) | none (820/820) |
| 1280×800 | desktop layout | 8, 8, 240 | 1024 px | `240px 1024px` (2 explicit tracks) | none (1280/1280) |

Completed user tasks (real browser):

- **Edit a record (HIGH-05-A):** open `/projects/edit-e2e-1` → Edit tab →
  change only Name → submit → success state visible → record shows the edit
  after reload → stored `budget` is a JSON number (direct SQLite read) →
  after a real SIGKILL restart over the same database the edit and numeric
  type survive (HTTP render + SQLite re-read). Dispatched payload types
  captured at the fetch boundary and asserted.
- **Mobile navigation (MED-05-A):** at both mobile widths — open the menu,
  verify visible placement and full-width content, navigate to another
  screen through the menu, verify the close-on-navigate policy, close and
  verify exact layout restoration, and exercise the menu by keyboard
  (Tab → Enter opens → Escape closes → focus restored to the control).
- Desktop/tablet sidebar layout verified untouched at 820×1180 and
  1280×800 (explicit two-track grid, main content beside the nav).

## Compatibility and preservation

- `vict.application@1` semantics untouched; `vict.application@2` identity,
  compiler diagnostics, and identity vectors unchanged (`verify:stage2/4/5`
  and the full suite reproduce; no application-package source changed).
- Renderer reactivity without remount, component-registry identity, prop
  isolation, and local-action confinement are covered by the unchanged
  permanent suites (all green); the renderer changes touch only form-value
  handling, heading emission, and mobile navigation presentation/policy.
- Server-side authorization, contract validation, effect enforcement,
  SQLite application-data semantics, migration behavior, idempotency, and
  operational/application store separation: no source change; all Stage
  03/04/05 verifiers pass.
- Scaffolder: unchanged; generated hosts consume the corrected renderer
  through the packed tarballs (`verify:stage5` packed-consumer build passes).
- XSS/diagnostic sanitization unchanged; hostile canaries planted in invalid
  form input (numeric field) are asserted absent from the rendered DOM, from
  local error text, and — per the unchanged boundary suites — from unsafe
  diagnostics, server logs, VICT history, and stored migration metadata. The
  valid application value (the intentionally stored edit) remains visible
  where entered/stored, as intended.
- Stage 01–04 verified behavior: `verify:stage2/3/4` plus the full-suite
  adversarial suites all reproduce green.
- Owner working-tree changes preserved: the pre-existing unstaged deletions
  of `VICT-STAGE-02-INDEPENDENT-AUDIT.md` and `VICT-STAGE-02-REPORT.md`
  (owner document relocation) were preserved untouched and were NOT staged
  or restored by this remediation.
- `docs/report/VICT-STAGE-05-REPORT.md` and
  `docs/report/VICT-STAGE-05-INDEPENDENT-AUDIT.md` remain byte-identical to
  `53a8ec1`.

## Remaining findings

- **LOW-05-A (declaration-level presence validation)** — left unchanged as a
  documented non-blocking carry-forward for the closure decision (per the
  remediation brief; changing `vict.application@1` validation semantics here
  was out of scope).
- **LOW-05-B (Stage 03 SIGKILL fixture load sensitivity)** — production
  Stage 03 behavior untouched; the finding stands as documented in the
  independent audit (read-only acknowledgment; no fixture redesign in this
  pass). The fixture passed in every full-suite execution of this
  remediation.
- **ARA/Mastra channel** — intentionally not addressed; the custom-island
  action/update channel belongs to the planned post-Stage-05 architecture
  amendment, which was NOT started here.
- Environmental: Node 24 / second OS unavailable; npm-audit dev-toolchain
  advisories; `node:sqlite` experimental warning (all recorded by the
  original audit, unchanged).
- Remediation-specific note: a long-running owner `vite dev` process held a
  native module during `npm ci` and had to be stopped once to complete the
  required clean-install verification; it was not restarted by this
  remediation (owners can restart it at will; no repository state was
  affected).

## Ready for focused independent re-audit?

**YES** — for the affected surfaces (record edit flow + responsive
navigation) with the permanent regression coverage described above. The
independent audit's other conclusions were reproduced unchanged.