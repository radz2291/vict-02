# Shared Rhea presentation

VICT's general catalog keeps its existing public Bits parts and canonical
Component ABI. This optional presentation translates the pinned shadcn-svelte
**Rhea** registry at `b10f153250b18abfccf49a06e1c4c68945edffa5` into scoped CSS.
It is not a new primitive implementation or a claim of every upstream API.
The [complete migration matrix](../../docs/studio/CYCLE-1-4-CATALOG-MIGRATION.md)
accounts for all 63 families, including material host/adapter omissions.

```svelte
<script>
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
  import '@victframework/ui-svelte/rhea.css';
  import { ControlScope } from '@victframework/ui-svelte/controls';
  import { Button } from '@victframework/ui-svelte/catalog/button';
</script>

<ControlScope class="vict-rhea">
  <Button.Root>Continue</Button.Root>
</ControlScope>
```

`ControlScope` keeps its existing Bits portal target. For an independent portal
scope, apply `vict-rhea` there too. The stylesheet changes no portal target,
focus ownership, mount lifetime, camera or context-trigger geometry. Importing
the stylesheet alone has no global effect. Existing consumers that keep their
legacy imports and classes keep their accepted default presentation.

The profile uses32px desktop actions,44px coarse-pointer actions,14px system
typography, soft neutral fields, rounded controls/surfaces and explicit focus.
The scoped public `--vict-*` semantic variables remain the theme boundary.
Set overrides on the chosen scope or descendants, including portaled roots.
The AI bridge maps its supported palette and typography variables to the same
scope; AI's source/utility CSS remains package-owned. A host may choose dark
semantic values; automatic operating-system or authored-page theme detection is
not promised. Rhea never paints the canvas root white. Individual surfaces keep
their own explicit surface colors.

## Native source patterns

```ts
import { rheaNativePatterns } from '@victframework/ui-svelte/rhea';
const card = rheaNativePatterns.find(pattern => pattern.id === 'card')!;
const fragment = card.create('my-card');
// Existing canonical insertion/remapping/session APIs consume fragment.nodes.
// Keep fragment.localState for field/input/textarea/native-select recipes.
```

There are 13 native patterns: alert, breadcrumb, button-group, card, empty, field,
input, textarea, kbd, native-select, skeleton, spinner and table. They are normal
canonical elements, classes and typed local state, not 13 new registered
components. Prefix Studio recipe IDs with `rhea-` to avoid existing seed IDs.
All source remains editable with the existing tools. Source fragments use
`classes`; the **explicit `rhea.css` dependency must be present in both preview
and normal product hosts**. These are not inline pixel snapshots. Without that
CSS, the ordinary native semantics remain, but Rhea appearance is not promised.
Authored local styles remain available and can override the profile; verify
actual browser computed values for responsive precedence.

The same public classes support direct Svelte/HTML composition:

```html
<article class="vict-rhea vict-rhea-card">
  <h2>Project overview</h2><p>Your content</p>
</article>
```

All fragments own unique, remappable node IDs. Labels explicitly target fields;
input/textarea/native-select use typed string state and canonical change
bindings. The table has a caption and scoped column headers. Keyboard hints do
not install shortcuts, status/loading visuals do not create work, breadcrumb
destinations must be replaced with declared application navigation, and ordinary
button groups do not execute undeclared actions. Form submission, persistence,
authorization and provider behavior remain host responsibilities.

## Compatibility and maintenance

Existing 80 general registered descriptors, revisions, defaults, slots, outputs
and renderer capabilities remain unchanged. Native `small`, `kbd` and `caption`
are additive semantic metadata. No source migration or dependency installation
is required; old date/time serialization and controlled state remain supported.
The package retains exact Bits 2.19.3. Upstream registry ranges include newer
Bits versions; their presentation is translated onto the already supported API,
not used to silently replace it.

`rhea-upstream-manifest.json` pins all 63registry payloads and 461 source files,
with exact dependency declarations and documented local adaptations. MIT grant:
`LICENSE.rhea`; VICT adaptations remain Apache-2.0. No blocks, fonts, global
preflight, private upstream imports, Tailwind consumer runtime or second Bits
version is included. On upgrade compare the complete pinned registry, update
the matrix/hashes/license, retain legacy descriptors, and recheck actual shell,
portals, responsive/focus states, native fragments and an installed consumer.
Package/source checks alone are not visual or integrated interaction acceptance.
