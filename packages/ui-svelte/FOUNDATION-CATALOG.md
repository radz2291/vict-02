# Foundation catalog coverage

Audited against the installed **Bits UI 2.19.3**, Svelte **5.57.0**, and @internationalized/date **3.12.4**. The installed Bits family exports and the public VICT subpaths are checked by `node scripts/audit-ui-catalog.mjs`. Dependency versions are unchanged in this cycle.

## Audit and outcome

The baseline catalog was a roadmap: **7 families represented**, 23 more styled families marked Next, eight primitive exports without worked examples, and three explicit deferrals. The old 30/8/3 figures described the intended split, not completed styled coverage.

This cycle delivers **30 styled and usable**, **8 supported direct composition**, and **3 deferred** out of 41 families. Every implemented family has a public granular export, working interactive example, and a named browser check. No planned rows count as coverage. The original seven renderer components remain compatible.

## Public usage and styling

See [CATALOG-USAGE.md](CATALOG-USAGE.md) for supported imports, portal scope, binding, date serialization, registered actions, and examples. Load `styles.css` plus the optional `catalog.css`, then put catalog parts under `ControlScope`. Styled families expose the upstream Bits parts API through VICT-owned subpaths; the shared stylesheet supplies automatic token-based styling. A second wrapper around every Bits part would duplicate prop forwarding without adding useful behavior. `CalendarGrid` is a reusable rendering helper for the date family.

The eight direct-composition families are intentionally assembled by the consuming product: aspect sizing, disclosure content, labels, link previews, desktop menus, scroll containers, separators, and toolbars. Their public subpaths and examples make that a supported path. Common visual rules for menus, focus, and surfaces are still shared. No import reaches undocumented Bits internals.

| Family | Classification | Export, working example, test / deferral and future path |
| --- | --- | --- |
| Accordion | **styled and usable** | [accordion](src/catalog/accordion.ts) · [example](../../examples/ui-showcase/src/lib/catalog/ActionsExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Alert Dialog | **styled and usable** | [alert-dialog](src/catalog/alert-dialog.ts) · [example](../../examples/ui-showcase/src/lib/catalog/ActionsExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Aspect Ratio | **supported direct composition** | [aspect-ratio](src/catalog/aspect-ratio.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DirectExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Avatar | **styled and usable** | [avatar](src/catalog/avatar.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DisplayExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Button | **styled and usable** | [button](src/catalog/button.ts) · [example](../../examples/ui-showcase/src/lib/catalog/ActionsExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Calendar | **styled and usable** | [calendar](src/catalog/calendar.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DateExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Checkbox | **styled and usable** | [checkbox](src/catalog/checkbox.ts) · [example](../../examples/ui-showcase/src/lib/catalog/SelectionExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Collapsible | **supported direct composition** | [collapsible](src/catalog/collapsible.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DirectExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Combobox | **styled and usable** | [combobox](src/catalog/combobox.ts) · [example](../../examples/ui-showcase/src/lib/catalog/SelectionExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Command | **styled and usable** | [command](src/catalog/command.ts) · [example](../../examples/ui-showcase/src/lib/catalog/ActionsExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Context Menu | **styled and usable** | [context-menu](src/catalog/context-menu.ts) · [example](../../examples/ui-showcase/src/lib/catalog/ActionsExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Date Field | **styled and usable** | [date-field](src/catalog/date-field.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DateExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Date Picker | **styled and usable** | [date-picker](src/catalog/date-picker.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DateExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Date Range Field | **styled and usable** | [date-range-field](src/catalog/date-range-field.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DateExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Date Range Picker | **styled and usable** | [date-range-picker](src/catalog/date-range-picker.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DateExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Dialog | **styled and usable** | [dialog](src/catalog/dialog.ts) · [example](../../examples/ui-showcase/src/lib/catalog/ActionsExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Dropdown Menu | **styled and usable** | [dropdown-menu](src/catalog/dropdown-menu.ts) · [example](../../examples/ui-showcase/src/lib/catalog/ActionsExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Label | **supported direct composition** | [label](src/catalog/label.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DirectExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Link Preview | **supported direct composition** | [link-preview](src/catalog/link-preview.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DirectExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Menubar | **supported direct composition** | [menubar](src/catalog/menubar.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DirectExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Meter | **styled and usable** | [meter](src/catalog/meter.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DisplayExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Navigation Menu | **styled and usable** | [navigation-menu](src/catalog/navigation-menu.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DisplayExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Pagination | **styled and usable** | [pagination](src/catalog/pagination.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DisplayExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| PIN Input | **deferred** | Authentication UX needs an actual consuming flow, including autofill, paste, password-manager and recovery behavior. Future: an authentication recipe using Bits PinInput; no copied keyboard code. |
| Popover | **styled and usable** | [popover](src/catalog/popover.ts) · [example](../../examples/ui-showcase/src/lib/catalog/ActionsExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Progress | **styled and usable** | [progress](src/catalog/progress.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DisplayExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Radio Group | **styled and usable** | [radio-group](src/catalog/radio-group.ts) · [example](../../examples/ui-showcase/src/lib/catalog/SelectionExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Range Calendar | **styled and usable** | [range-calendar](src/catalog/range-calendar.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DateExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Rating Group | **deferred** | Rating semantics, scale labels and empty/clear behavior require a consuming product. Future: a labelled Bits RatingGroup recipe. |
| Scroll Area | **supported direct composition** | [scroll-area](src/catalog/scroll-area.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DirectExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Select | **styled and usable** | [select](src/catalog/select.ts) · [example](../../examples/ui-showcase/src/lib/catalog/SelectionExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Separator | **supported direct composition** | [separator](src/catalog/separator.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DirectExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Slider | **styled and usable** | [slider](src/catalog/slider.ts) · [example](../../examples/ui-showcase/src/lib/catalog/SelectionExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Switch | **styled and usable** | [switch](src/catalog/switch.ts) · [example](../../examples/ui-showcase/src/lib/catalog/SelectionExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Tabs | **styled and usable** | [tabs](src/catalog/tabs.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DisplayExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Time Field | **styled and usable** | [time-field](src/catalog/time-field.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DateExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Time Range Field | **deferred** | Overnight ranges, timezone/DST and end-before-start rules need an explicit product contract. Single TimeField and date ranges are available; future: compose the same segments with Bits TimeRangeField once those rules are chosen. |
| Toggle | **styled and usable** | [toggle](src/catalog/toggle.ts) · [example](../../examples/ui-showcase/src/lib/catalog/SelectionExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Toggle Group | **styled and usable** | [toggle-group](src/catalog/toggle-group.ts) · [example](../../examples/ui-showcase/src/lib/catalog/SelectionExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Toolbar | **supported direct composition** | [toolbar](src/catalog/toolbar.ts) · [example](../../examples/ui-showcase/src/lib/catalog/DirectExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |
| Tooltip | **styled and usable** | [tooltip](src/catalog/tooltip.ts) · [example](../../examples/ui-showcase/src/lib/catalog/ActionsExamples.svelte) · [browser test](../../scripts/verify-ui-catalog.mjs) |

## Boundaries and integration

Portable layout, action feedback, and application contracts remain in `@victframework/ui`. This cycle adds **no primitive schema roles** and no Bits/Svelte types to neutral packages. All parts, date helpers, styles and Svelte context live in `ui-svelte`; `renderer-svelte` remains a facade.

Requests keeps its compact sidebar; Workspace keeps its top navigation and conversation/context layout. Requests adds `/requests/schedule` as a normal application screen containing `cmp.request-planner@1`. The trusted registry loads that product surface separately. It uses menu templates, rich selection, a date picker, checkbox and accordion, then submits the declared `act.create` through `useVictActions`. The same host dispatch, input contract, server permissions, data adapter and invalidation path apply. No capability is granted by a control or by the component context. Undeclared action IDs are rejected before dispatch.

Action feedback stays beside the action. Passive status, conversation messages and form validation retain the provisionally accepted composition-slice behavior.

## Verification and review

Run `npm run catalog` from the repository root. It builds dependencies and serves port **5180**: `/catalog`, `/requests/schedule`, `/requests`, and `/workspace`. The gallery is a development harness; the request flow uses the generic renderer.

Run `npm run test:catalog` for production-browser family, keyboard, accessibility, responsive and flow checks. Package interaction/action-context tests are in [catalog.test.ts](test/catalog.test.ts). Coverage audits, bundle measurements and existing composition/foundation regressions are recorded in [the owner review report](../../docs/UI-FOUNDATION-CATALOG-COVERAGE.md).

No final visual acceptance, merge, publication, npm trust, or release approval is implied.
