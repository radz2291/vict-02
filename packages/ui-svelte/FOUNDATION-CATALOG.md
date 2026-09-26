# Primitive strategy and coverage

Audited 26 September 2026 against Bits UI 2.19.3 and Svelte 5.57.0.

## Decision

Use [Bits UI](https://bits-ui.com/docs/getting-started) for stateful interaction
and accessibility. Its installed peer requirement is Svelte ^5.33.0, compatible
with this repository's locked 5.57.0. The ui-svelte peer floor is now ^5.33.0.
Bits' date peer is supplied by @internationalized/date (locked 3.12.4).
No Tailwind, copied interaction implementation, external font, or separate demo theme.

Native button, input, number, date, textarea, checkbox, select, label and links
are sufficient for the simple controls in this slice. Native select provides
platform keyboard/typeahead behavior; advanced search/multiple selection will
use Bits Combobox/Select rather than extending our own interaction code.

Svelte-independent meaning remains in @victframework/ui. SDK authoring and
compiler validation remain in sdk/application. Components, adapters and styles
remain in ui-svelte. renderer-svelte still only re-exports the canonical package.

The audit found five field widgets, manual tab keyboard behavior, native dialog
plus fallback code, hardcoded stacked regions, unstyled checkboxes, no selection
metadata, and inconsistent spacing between tables/forms/conversations. Existing
type builds did not inspect .svelte files. This slice adds an actual svelte-check
command and removes those tab/overlay interaction implementations.

## Component catalog (all 41 Bits families)

**1** = provide a styled reusable component in the completed foundation.
**2** = expose original primitive for composition; a wrapper adds little value.
**3** = defer the family with the reason shown.

“Next” is scheduled after owner review; it does not claim a styled component
exists now. Original namespaces (except deferred families) are already available
at `@victframework/ui-svelte/primitives`. Styled exports live at the main entry.
The primitive entry follows the installed Bits API and is not a new VICT abstraction.

| Family | Strategy | This slice / remainder |
| --- | --- | --- |
| Accordion | 1 | Next: styled disclosure groups |
| Alert Dialog | 1 | Next: explicit destructive confirmation; regular Dialog is not a substitute |
| Aspect Ratio | 2 | Exposed; layout utility |
| Avatar | 1 | Next: image/fallback component; current conversation initials are presentational |
| Button | 1 | Now: native Button, primary/secondary/danger, pending/disabled conventions |
| Calendar | 1 | Next: locale-aware calendar |
| Checkbox | 1 | Now: native boolean FormField; next: tri-state styled Bits control |
| Collapsible | 2 | Exposed; compose disclosure with existing panels |
| Combobox | 1 | Next: searchable single/multiple choice |
| Command | 1 | Next: command palette with application-supplied commands |
| Context Menu | 1 | Next: styled menu shared with Dropdown Menu |
| Date Field | 1 | Next: segmented locale-aware date input; native date remains available now |
| Date Picker | 1 | Next: field/calendar/popover composition |
| Date Range Field | 1 | Next: typed range presentation |
| Date Range Picker | 1 | Next: range selection with calendar |
| Dialog | 1 | Now: Bits-backed Overlay for both dialogs and right drawers |
| Dropdown Menu | 1 | Next: styled actions/check/radio/submenus |
| Label | 2 | Exposed; native labels used now |
| Link Preview | 2 | Exposed; app-owned preview contents |
| Menubar | 2 | Exposed; desktop menu composition is product-specific |
| Meter | 1 | Next: bounded scalar measurement |
| Navigation Menu | 1 | Next: rich navigation; ordinary application links available now |
| Pagination | 1 | Next: standalone pagination; native table pagination available now |
| PIN Input | 3 | Deferred: specialised authentication UX and autofill need a concrete consuming flow |
| Popover | 1 | Now: styled reusable content popover; table density control |
| Progress | 1 | Next: determinate/indeterminate progress |
| Radio Group | 1 | Next: mutually exclusive choices |
| Range Calendar | 1 | Next: shared date range family |
| Rating Group | 3 | Deferred: specialised rating semantics need a consuming product |
| Scroll Area | 2 | Exposed; native overflow used for tables, tabs and conversation |
| Select | 1 | Now: native finite string Select; next: rich/multiple Bits selection |
| Separator | 2 | Exposed; no need to wrap a separator element |
| Slider | 1 | Next: keyboard-operable numeric range |
| Switch | 1 | Next: immediate boolean setting, distinct from form checkbox |
| Tabs | 1 | Now: Bits roving focus/selection/panels; mounted panels retain state |
| Time Field | 1 | Next: segmented time with explicit locale/timezone policy |
| Time Range Field | 3 | Deferred until single-time/date range conventions are reviewed |
| Toggle | 1 | Next: pressed-state action |
| Toggle Group | 1 | Next: single/multiple toolbar selection |
| Toolbar | 2 | Exposed; compose actions and toggles |
| Tooltip | 1 | Now: named help trigger, description, keyboard focus/Escape |

30 families targeted for styling; 8 primitive-only; 3 deferred. Seven styled
families are represented now: Button, Checkbox, Dialog, Popover, Select, Tabs,
and Tooltip. Native date input does not count as the Bits Date Field. Text and
numeric fields, drawer, feedback, status, app shell, forms, records and
conversations are additional VICT components, not extra Bits families.

Next order: (1) selection/disclosure/navigation and action menus,
(2) command/feedback/progress and reusable avatar, (3) the date/time family.
Feedback, empty/validation/denied/failure states and status badges are styled now.
Toast and richer async feedback are VICT work outside the Bits catalog.

## Application Definition vocabulary is intentionally smaller

No schema role was added for tooltip, popover, checkbox, calendar, menu, or command.
A table owns its display popover and help tooltip. A form maps semantic fields to
controls. Advanced compositions can use the existing trusted component registry.
Primitive availability does not imply every primitive needs a schema node.

The additive @2 metadata in this slice:
- Screen `layoutMode?: 'stack' | 'split'`.
- Region `size?: 'full' | 'main' | 'aside'`,
  `appearance?: 'plain' | 'panel'`, `flow?: 'stack' | 'inline'`.
- Form field `widget: 'select'` with ordered nonempty, unique string
  `options: { value: string; label: string }[]`.

Metadata is compiler-validated, frozen and included in normal application identity.
Existing definitions keep their default stack behavior; @1 rejects the additions.
Selections submit strings, never labels. Optional empty selection is an empty string.
Unknown selection values fail locally. Server input contracts remain authoritative.

Future contracts must be explicit: multi-select needs an array value domain;
combobox needs option-source/query/cancellation semantics; date ranges need
start/end and absence rules; switches need a distinction between boolean form
submission and immediate action; commands need app-supplied action bindings.
These are not silently represented as text or invented schema roles.

## Conventions

One stylesheet: `@victframework/ui-svelte/styles.css`. Teal accent, slate text,
neutral surfaces, system fonts, a spacing scale based on 8px, 7–14px radii,
restrained elevation and three-pixel focus rings. Native mobile fields use 16px
type. `--vict-density` adjusts controls/table rows; the table also offers a local
compact-row setting. Split layouts stack below 1100px; navigation collapses
below 720px. Data tables scroll locally and stay keyboard-focusable.

Dialogs portal into their owning .vict-app to inherit per-app tokens while
avoiding transformed ancestors. Standalone use falls back to the body.
Bits owns traps, Escape, outside interaction and restoration. Focus opens on the
first focusable control; tests assert containment, not a specific panel element.

Current generic surfaces still have limitations: action tone is inferred from
legacy action IDs containing “delete”, server field-level validation is not
provided by ActionResult, and screen layout hints are coarse rather than a
general nested layout language. Future work should address those explicit
contracts instead of special-casing application routes.
