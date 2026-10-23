# Cycle 1.3 Designer coverage

Audit baseline: accepted Cycle 1.2 delivery `1bc56b1da30279baa6ca9dff21a56ec2baf2bd52`; implementation authority: `CYCLE-1-3-HANDOFF.md`, recorded at `61e3874`. This records source inspection, not an independent product verdict.

## Separate baseline inventories

| Surface | Actual baseline |
| --- | --- |
| Public catalog | 38 Bits UI family subpaths: 30 styled families and eight direct-composition families; PIN Input, Rating Group and Time Range Field remain deferred. Bits UI is exactly 2.19.3. |
| Canonical descriptors | 80 registrations in `ui-svelte/src/catalog/components`: B1 8, B2 11, B3 11, B4 35, B5 15, covering 38 families plus AppShell. Variants and context-owned parts explain the difference from family count. |
| Renderer | Matching implementations are registered by Studio's `application.ts` and passed to EditorCanvas and finished application compilation. Required slots, ABI markers and implementation identities are checked. Registration does not make every part independently mountable. |
| Manual palette | Ten recipes: Section, Row, Heading, Text, Text input, Button, Checkbox, Switch, Dialog, Separator. Only five catalog families are directly insertable. |
| Inspector | Descriptor-driven property editors and output connections for all registered components already present in source. Slots use Composer/composition navigation. Scalar/date/time literals and compatible references are supported; list/array properties were binding-only. Slot-owned labels are explicitly described as fallbacks. |
| Agent | The same ten insert recipes; scalar property/attribute/style edits and add/move/remove only. No property-reference or output-binding authoring operation. Agent context filters descriptors to the five inserted catalog families. |

## Bounded expansion

Retain existing recipe IDs and saved component identities. Add useful seeded compositions for supported standalone families, including their required slots. Add context-owned item/trigger/panel/group recipes with explicit compatible parent/slot restrictions shared by manual and agent insertion. A menu item, select item or tab panel must not be offered as an independent screen component.

Expose scalar literals, typed local-state list values, bounded reference bindings, and declared component output connections through existing `replaceDocument`, `bindExpression` and `setOutputBinding` commands. The frozen expression literal vocabulary stays scalar/null. No operation creates an action, capability, resource, arbitrary expression evaluator or backend. Output bindings can target compatible local state or declared action inputs; unavailable data declarations remain explicit.

Radio Group and AppShell currently require array-valued application data (`options` and `navigation`) without a slot-based item authoring alternative. Studio's screen has no declared view data. Their renderer/Inspector availability is retained; do not insert empty misleading controls or manufacture a product-data source. They remain source/data integration surfaces in this cycle. PIN Input, Rating Group and Time Range Field retain the foundation's explicit product-contract deferrals.

## Canonical constraints

`vict.application@3` attaches `vict.ui-document@1` source through `screenApplication`/`compileScreen`. UI source affects application identity. Selection/diagram position/viewport are ephemeral and excluded. Source IDs remain document ID plus node ID; occurrence selection additionally preserves instance, repeat and portal provenance. Do not treat repeated DOM instances as separate source nodes or graph edges as executable workflow meaning.

All authoring goes through one `EditorBridge` and the existing atomic validated command engine. Agent proposals retain document ID, working revision, canonical digest and epoch checks, result digest comparison, pending-draft refusal and acknowledgement after successful commit. Undo/Redo advances the session revision, save uses expected stored revision, and source metadata revision is not the working revision token.

Reference basis: `VICT-SYSTEM-REFERENCE.md` APP-019 (one canonical source), UI-foundation `PRODUCT-ARCHITECTURE.md` A-01–A-10, `CONTRACTS.md` §§1–8, accepted `U4-STUDIO-HANDOFF.md`, `FOUNDATION-CATALOG.md`, `CATALOG-USAGE.md`. No prior frozen record is rewritten. SSR/performance and prior portal-depth/loading-width observations remain unclaimed/retained.

## Verification plan

Check every seeded recipe through real `applyUiEdit` plus `compileScreen`; reject incompatible context parts without partial source changes. Check manual recipe insertion and agent insertion parity, list/reference/output validation, wrong output/state type and missing action refusals, atomic undo/save/reopen, and legacy recipes/documents. Product browser evidence must separately demonstrate usable controls and inspector/slot connections; compiler success is not a browser interaction claim.

## Implemented candidate surface

The shared palette now contains 83 recipes: 78 catalog registrations and five semantic element recipes. Manual and agent insertion use the same recipe list and `canInsertRecipe` placement restrictions. Studio still registers all 80 original descriptors/implementations. Existing IDs and saved source schemas are unchanged. New Dialog insertion includes a body; existing saved empty/invalid slots still produce the same required-slot diagnostics.

| Family / variants | Palette, Inspector and tool support |
| --- | --- |
| Button, Checkbox, Switch, Toggle | Existing scalar props; boolean/state or declared action output connections |
| Select, Combobox, Toggle Group; single/multiple | Seeded item slots; contextual item recipes; scalar or typed-list values; declared change outputs. Array options stay reference-only. Select with authored item slots shows the selected value when no external option-label mapping exists. |
| Accordion; single/multiple | Seeded items and content; contextual item recipe; value/change output |
| Slider, Meter, Progress, Pagination | Numeric/list props; slider and pagination output declarations; no invented data paging |
| Date Field, Date Picker, Calendar, Time Field, Date Range Field, Date Range Picker, Range Calendar | ISO scalar props and existing declared outputs; library date objects never enter source |
| Dropdown Menu, Context Menu, Menubar | Valid seeded menus; contextual items, submenus, groups, checkbox/radio groups and separators; declared value/open/activation outputs. Context menu remains a pointer-context surface; a consuming design must retain a visible equivalent action path. |
| Command, Navigation Menu | Seeded valid children; contextual items/groups/submenus/links; only already-declared actions can be connected |
| Avatar, Aspect Ratio, Separator, Label, Scroll Area | Display props and seeded required content; label associations remain authored properties |
| Toolbar, Link Preview, Tooltip, Popover, Alert Dialog, Tabs, Collapsible, Dialog | Required slots seeded; contextual toolbar button/tab trigger/tab panel recipes; existing declared open/value/action events |
| Radio Group | Renderer/Inspector retained; palette/tool insert omitted until Studio has declared object-array data or a canonical item-slot contract |
| AppShell (higher-level) | Renderer/Inspector retained; palette/tool insert omitted because navigation needs declared object-array data |
| PIN Input, Rating Group, Time Range Field | Still explicitly deferred by the foundation product contracts |

List recipes seed typed local presentation state, prop references and their declared change output bindings through shared `insertRecipe`, using an atomic source replacement plus subtree insertion. The Inspector reuses `StateInitialEditor` below a reference-bound list property (and Document → Data) to author its starting values one per line, preserving invalid drafts. Object-array props remain reference-only. Agent list prop updates normalize into the same typed state/ref representation; no array expression literals are introduced. Agent `bind` accepts scalar-literal/reference expressions and `connect` accepts the existing `setState`/`invokeAction` output binding shapes; omission clears the prop override or connection. Every completed candidate is recompiled and error diagnostics in otherwise successful partial render plans are refused. This work creates no backend, route or data-view authoring.

## Retained failed observations and corrections

1. First focused run: all standalone recipes and all context-part recipes compiled, but two test failures remained. One was an incorrect test comparison of post-save digest to pre-save undo history (saving legitimately advances source revision); corrected oracle compares authored nodes across undo/redo and the saved digest on reopen. The second was real: the neutral compiler intentionally retains component type errors in partial authoring plans, and the old agent boundary treated successful compilation as absence of errors. A wrong string list on Slider was accepted. The candidate now inspects final plan error diagnostics before proposing/acknowledging an edit; the negative test is retained.
2. Broader focused run under concurrent root checks exhausted host memory (`Fatal process out of memory: Zone` and an editor-run deserialization OOM). No complete verdict is claimed from those runs. The historical agent test also assumed a new Dialog had no body; Cycle 1.3 deliberately seeds its required body, so the oracle now explicitly removes that body to retain the same required-slot refusal assertion. Existing required-slot tests were green (5/5) before the memory failure.
3. Initial test launch before dependency installation could not find `vitest`. A later direct root Vitest invocation rejected the version-3-only `--minWorkers` flag; retained log `reviews/cycle-1-3/designer-focused.log`. Subsequent Studio tests use its own Vitest 3 executable, serialized to one worker. These are execution observations, not product passes.
4. Serialized focused run 2 exposed a real provider presentation failure: the expanded 83-entry recipe enum exceeded the frozen 64-item schema capture bound, and a nested array item union exceeded depth 8. The equivalent anchored recipe pattern now carries the full vocabulary; shallow list guidance stays within bounds while authoritative Zod/compiler checks retain homogeneous type validation. A direct `capturePresentationSchema` regression guards this. Focused run 3 passed all 29 tests across coverage, editing, required-slot and genuine pinned-Mastra offline-loop suites; it is simulated model evidence, not live-provider evidence (`designer-focused-2.log` preserves failure; `designer-focused-3.log` preserves the pass).
5. Subsequent root typecheck correctly found the canonical expression type still restricts literals to scalar/null, even though some runtime target checks accepted arrays. The initial direct-list-literal implementation was withdrawn; no frozen schema is widened. Final list authoring uses existing typed local-state declarations and references, with the same canonical transaction/history boundary. Root integration verification must test this final representation after the focused-run-3 snapshot.
