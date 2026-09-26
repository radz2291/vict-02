# Building with the VICT catalog

## Start with a visual scope

```svelte
<script lang="ts">
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
  import { ControlScope } from '@victframework/ui-svelte/controls';
  import { Checkbox } from '@victframework/ui-svelte/catalog/checkbox';
  let approval = $state(false);
</script>

<main>
  <ControlScope locale="en-GB">
    <label class="vict-control-row">
      <Checkbox.Root bind:checked={approval} />
      Require approval before handoff
    </label>
  </ControlScope>
</main>
```

Import only the families you use. Each catalog subpath exports a namespace with
the public Bits UI 2 parts API, including its types, snippets, bindable state,
event callbacks and disabled/readonly options. The main VICT entry keeps its
existing higher-level components (`Button`, native `Select`, `Overlay`, forms,
records, conversations and renderer). For example, `catalog/select` is the rich
Bits namespace; the existing main-entry `Select` is the compatible native field.

`ControlScope` supplies locale and a portal target through BitsConfig. Portals
stay in that scope to inherit the application's tokens. Put the scope inside a
landmark and outside clipped or transformed containers. Add the family’s Portal
around floating content; for Date Range Picker use `Portal` from `controls`
(that Bits namespace has no Portal export). Do not put the scope inside an
overflow-hidden card. This is the same portal constraint as the existing shell.
Use `collisionPadding={16}` on floating Content parts to keep a visible viewport
inset on narrow screens; the library owns placement and collision handling.

Catalog CSS is optional and scoped to `.vict-controls`. It uses the existing
semantic tokens. Parts have visible focus, checked/selected, disabled, open,
invalid, range and indeterminate states; reduced motion is respected. CSS utility
classes `vict-control-stack`, `vict-control-row`, `vict-control-panel`,
`vict-control-label` and `vict-control-help` support ordinary product composition.
Existing `vict-btn` variants remain available on Bits buttons and triggers.

## Full working recipes

- [Actions and disclosure](../../examples/ui-showcase/src/lib/catalog/ActionsExamples.svelte): menus with checkboxes/radios/submenus, inline commands, dialog, alert confirmation, accordion, popover and tooltip. AlertDialog's Action is deliberately application-controlled: close `open` after successful work; keep errors in the dialog if the action fails. A command palette is `Command.Root` inside `Dialog.Content`; commands remain application-supplied callbacks and never imply server authority.
- [Selection and settings](../../examples/ui-showcase/src/lib/catalog/SelectionExamples.svelte): single/multiple Select and Combobox, tri-state Checkbox, radio group, numeric range, switch, toggles. Combobox examples filter a small local option list. Remote options require product-owned loading, cancellation and error policy; Bits still owns navigation, focus and selection.
- [Dates and time](../../examples/ui-showcase/src/lib/catalog/DateExamples.svelte): segmented inputs, calendar, range, pickers, minimum/disabled dates, invalid/disabled fields and locale changes. `CalendarGrid` renders month grids using the correct Calendar or RangeCalendar parts. It does not implement date arithmetic, selection or keyboard handling.
- [Navigation and display](../../examples/ui-showcase/src/lib/catalog/DisplayExamples.svelte): avatar fallback, navigation links, pagination, meter, progress and tabs.
- [All eight direct-composition families](../../examples/ui-showcase/src/lib/catalog/DirectExamples.svelte): concrete accessible compositions for AspectRatio, Collapsible, Label, LinkPreview, Menubar, ScrollArea, Separator and Toolbar. A context menu always needs an equivalent visible action path for touch users; preview links must remain useful without hover.

## Date values and contracts

Use `@victframework/ui-svelte/dates` for the supported date constructors, parsers
and types. Applications do not need to reach into a transitive dependency.
`CalendarDate` represents a date without a timezone; `Time` represents local
wall time. `CalendarDateTime` and `ZonedDateTime` are available when the product
explicitly needs them. Supply a locale, timezone label, bounds and validation
appropriate to the task. Do not infer UTC or truncate a zoned date into an ISO date.

The example request flow serializes a `CalendarDate` using `.toString()` into
the existing `YYYY-MM-DD` input contract. It does not add date objects or Bits
types to Application Definitions. Date-range absence/order, DST, overnight ranges,
and remote availability remain explicit application rules. Use `errorMessageId`
and adjacent useful text for invalid segmented fields. As shown in the examples,
also associate Input and Segment parts with `aria-describedby`; clear the message
and association when the value becomes valid.

## Registered product surfaces and actions

The [request planner](../../examples/ui-showcase/src/lib/components/RequestPlanner.svelte)
is declared through a normal `component` surface and versioned registry entry.
It uses shared catalog components and styles, with no gallery styles.

```ts
import { useVictActions } from '@victframework/ui-svelte/component-actions';
const actions = useVictActions(); // call during component initialization
const result = await actions.run(submitActionId, input);
```

This Svelte context is for trusted registered components. It exposes only the
host's existing action path, not the runtime, registry, permissions or data adapter.
The action must be declared in the owning plan; the server still checks contracts
and authorization. Local/navigation actions retain their normal renderer behavior.
Successful dispatch invokes the host's invalidation hook. A component owns its
draft and result lifecycle; use `actionFeedback` from `@victframework/ui` and
the shared `ActionFeedback` component for routine outcomes. Never display raw
caught exceptions. The planner preserves drafts on failure and clears stale
success on edits and new attempts.

## Scope of support

The public parts API follows the installed Bits UI major version. Official API
references: [Bits components](https://bits-ui.com/docs/components/accordion),
[date conventions](https://bits-ui.com/docs/dates),
[child snippets](https://bits-ui.com/docs/child-snippet).
There is no parallel VICT keyboard/focus/positioning engine. Changing a primitive
major requires another compatibility pass over these recipes and tests.

The three catalog deferrals are intentional and do not block the other 38
families. Low-level availability does not automatically expand the generic
manifest form widget vocabulary. Rich product forms should use registered
components until their portable value/source semantics justify a new validated
contract. No toast system or new notification timing policy is introduced here.
