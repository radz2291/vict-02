# U4 component integration design (preparation phase, 2026-10-07)

Design for the representative component-integration proof inside the U4
independent consumer. Smallest reusable solution first; existing
implementations only; no frozen-contract changes. Companion to
[U4-COMPONENT-REUSE-MATRIX](U4-COMPONENT-REUSE-MATRIX.md) (evidence) and
[U4-HANDOFF](U4-HANDOFF.md) (obligations).

## 0. The one decision that shapes everything

The U4 consumer must show **catalog reuse** (bits-ui Checkbox, Select/Dialog)
inside an **authored** surface with **visible business state, action
identities and connections**. Two routes could carry that:

1. **Registered components (P3)** — chosen. The application definition
   (SDK, framework-neutral) declares screens, components (`componentId` +
   `revision`) and actions; the compiled plan is canonical persisted source;
   a versioned local registry supplies the Svelte implementations (catalog
   components composed inside `ComponentSlot`); `useVictActions()` dispatches
   **declared** actions only; undeclared actions are refused before any
   dispatcher call (recorded tests). Business state lives in typed app state
   owned by the registered surface; every action identity and its input
   contract is visible in the persisted definition.
2. Document extensions (P4) — rejected for these proofs: the bridge is
   deliberately props-only; value/event back-connection is a frozen gap (§5),
   and faking it with hidden DOM side-channels would violate source
   ownership.

Document elements (P2) are used **alongside** P3 where they are the native
fit (buttons-with-actions, change→setState fields, form submit), so the
consumer demonstrates both authored-element behavior and catalog reuse
honestly labelled as two patterns.

## 1. The four required proofs, concretely

### 1.1 Button — declared action + disabled/loading/feedback

- **Canonical source**: application definition declares an action
  (`review.approve`, input contract via `defineContract`) and the screen's
  composition references it; the registered surface implements the action
  choreography by composing **public exports only**: `Button` +
  `ActionFeedback` (@victframework/ui-svelte root) and the `actionFeedback`
  result→feedback mapper (@victframework/ui, re-exported from feedback.js) —
  pending "Working…" state with `aria-busy`, disabled-while-pending, focus
  restore. The in-repo reference implementation for this exact choreography
  is `ActionButton.svelte` (NOT publicly exported; it stays internal — the
  consumer re-implements the pattern from the exported pieces, it does not
  deep-import). Plus one document-route button (element +
  `click → invokeAction`) to show authored-element actions.
- **Exposed properties**: label, variant, disabled (expression-bound to
  busy/permission state in documents; prop in P3).
- **Selection/ownership**: P3 surfaces are identified by componentId +
  revision in the persisted definition (never DOM handles); the document
  button keeps `data-ui-node`/`data-ui-occ` occurrence identity.
- **Inspector/save-reload**: the document button's label/action binding is
  Inspector-editable and persisted through the document store
  (`connectInteraction`); the registered surface's internals are declared
  opaque — its action identity stays visible in the definition file.
- **Keyboard/disabled/error**: native button semantics; disabled while
  pending; feedback for ok/denied/failure outcomes (declared feedback text
  validated by `feedback.ts`); refused action keeps state unchanged.
- **Boundary**: dispatch reaches the application's action handler (adapter
  boundary in the consumer's host); negative: undeclared action refused at
  the host (tested pattern), permission denial surfaced as declared feedback.

### 1.2 Checkbox — checked-value binding + meaningful submission

- **Canonical source**: registered surface `reviewChecklist` (componentId
  `u4.checklist`, revision `1`) declared in the application; it composes the
  **catalog `Checkbox`** (bits-ui) under `ControlScope` styling
  (`ControlScope` + `catalog.css` are the public styling contract); checked
  value is component-owned Svelte state; an **Acknowledge & submit** control
  dispatches the declared `checklist.submit` action with
  `{ acknowledged: boolean, noteIds: string[] }` through `useVictActions`.
- **Value connection**: `bind:checked` → component state → submit payload.
  This is the honest catalog-reuse route; a document-route checkbox
  (`input[type=checkbox]` + `change → setState`, `RenderNode.handleChange`)
  is ALSO shown on the same screen and clearly labelled as the authored-
  element variant — the two are visibly different controls.
- **Selection/ownership**: the surface declares its identity; the document
  checkbox keeps occurrence identity.
- **Inspector/save-reload**: the checklist's declaration (labels, which note
  ids, action id) is data in the persisted definition; editing it changes
  the rendered surface after reload. The document checkbox's state binding is
  document source, editable and persisted.
- **Keyboard/disabled/error**: bits-ui checkbox is keyboard-operable with
  ARIA (`role=checkbox`, `aria-checked` — recorded test); submit disabled
  until required acknowledgements are checked; refused submission keeps
  values.
- **Boundary/negative**: submitting with the action absent from the
  definition must refuse visibly (host validation).

### 1.3 Sidebar/AppShell — navigation, active selection, responsive

- **Canonical source**: the application definition declares navigation
  groups/routes (`UiApplicationComposition` / shell groups — declarative,
  persisted); `AppShell` renders brand, groups, breadcrumbs, active path
  selection, responsive drawer (`matchMedia` 720/960, mobile nav).
- **Exposed properties**: `brand`, `title`, `path`, `groups`, `breadcrumbs`,
  `composition`.
- **Selection/ownership**: active route = `path` prop from the host router —
  declarative, not DOM-derived.
- **Inspector/save-reload**: nav group labels/order are definition data;
  persisted and reloaded (recorded: `navigation-group-order.test.ts`).
- **Keyboard/responsive**: drawer button keyboard-operable; drawer closes on
  desktop breakpoint; active item visible at 1440/1024/390.
- **Negative**: unknown route renders the host's not-found surface (never a
  silent blank).

### 1.4 Rich Select or Dialog — value change / focus / portal

- **Canonical source (chosen: Dialog + Select both, small cost)**:
  - Select: document-route `<select>` (`change → setState`) for the authored
    variant AND the catalog `Select` inside a registered surface for catalog
    identity (value → state → declared action input).
  - Dialog: registered surface using the catalog `Dialog` (bits-ui):
    opens from a declared-action success (`assignment.request`), focus moves
    into the dialog on open (bits-ui focus scope), portal renders to the
    **ControlScope root** (`BitsConfig defaultPortalTo` — product tokens and
    catalog styling stay with the controls; NOT `document.body`), Escape and
    overlay close return focus to the trigger; the dialog confirms into a
    second declared action (`assignment.confirm`).
- **Persistence**: dialog content/labels are definition data; the value the
  dialog submits is persisted via the action's input contract + resource
  update.
- **Keyboard/focus/portal**: bits-ui provides focus trap + portal; U4
  verifies focus restore and portal containment at runtime (B-level today).
- **Negative**: dismissing the dialog mutates nothing; an invalid Select
  value (contract violation) is refused with a visible field error
  (`invalid`/`describedBy` props on the native Select; contract issues on the
  registered route).

## 2. Theme/style mounting (all proofs)

Mount `@victframework/ui-svelte/styles.css` once and wrap surfaces in
`.vict-app`; catalog parts additionally use `ControlScope` +
`catalog.css` (recorded usage in `examples/ui-showcase` catalog pages). No
component-specific CSS is hand-copied — styling travels with the packages.

## 3. What stays opaque vs visible

- **Opaque (declared)**: registered/catalog component internals (DOM,
  internal styling, bits-ui behavior). Their identity, revision and declared
  actions are visible in the persisted definition.
- **Visible (canonical)**: screens/compositions, action identities, input
  contracts, feedback declarations, navigation groups, document sources
  (elements/text/styles/interactions), extension descriptor identities +
  evaluated props.

## 4. Routine implementation choices (manager/agent authority, not owner items)

- SvelteKit vs Vite-only for the consumer shell (recommend Vite + a tiny
  hash router or SvelteKit — either; the plan/registry mounting is
  router-agnostic, `renderVictApplication` takes `path`).
- File layout of the consumer, seed data shape (as long as actions have
  declared contracts), test harness details.
- Order of proofs during implementation.

## 5. The precise gap and a scoped amendment proposal (NOT implemented)

**Gap (C-level, frozen)**: the document extension bridge (`UiExtensionDescriptor`
+ registration) is props-only by design. A registered extension cannot report
value changes or events back into document state/actions. This is correct
for presentation extensions (evidence viewers, status chips — the U3 set)
but means any **interactive catalog component inside a document** cannot be
authored without either (a) wrapping it as a registered component in the
application layer (this design's route; no contract change), or (b) amending
the extension contract.

**Scoped amendment proposal (owner authority required; do not implement in
U4)**: extension contract v2 — descriptors may declare typed **output
callbacks** (`outputs: [{name, stateKey | actionRef}]`), implementations
receive a corresponding `emit(name, value)` prop alongside `props`; the
renderer wires `emit` to the SAME host channels as document interactions
(`setState` / declared-action dispatch with declared input contracts);
descriptors still cannot declare arbitrary events/slots (no children
injection). Consequences to manage: document schema + plan schema minor
version bump (`extensions` descriptor block gains `outputs`), renderer
ignores `outputs` it cannot resolve with a new diagnostic code
(`EXTENSION_OUTPUT_UNRESOLVED`), older documents remain byte-compatible
(optional field), registry matching unchanged. **U4 does not need this** —
route P3 covers the required proofs with zero frozen-contract changes.

## 6. Decisions that DO require owner authority

1. **Catalog reuse via registered components is accepted as catalog reuse**
   for U4-02/U4-05 (components consumed from the packed package's public
   exports, composed in trusted local registered surfaces) — versus requiring
   document-native catalog integration (a contract amendment, §5). The design
   recommends the former.
2. **ui-editor dist repair (F3) is authorized as in-scope U4 package
   maintenance**: an emitting build plus the four TS2307 declaration fixes;
   no editor behavior change — without it
   U4-01/U4-02 editor-module reuse cannot pass.
3. **Packed-tarball install as the isolation mechanism** (`npm pack` the
   closure set; consumer installs from copies — no workspace links, no
   source aliases, no original-example imports) and the pack list in
   [U4-HANDOFF](U4-HANDOFF.md) §Artifacts.
