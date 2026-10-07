# U4 component integration design (amended, 2026-10-07)

Design for the required catalog-authoring proof inside the U4 independent
consumer, per the owner's decision and the frozen-to-freeze contract
[U4-COMPONENT-AMENDMENT](U4-COMPONENT-AMENDMENT.md) (`vict.ui-component-abi@1`).
Companion to [U4-COMPONENT-REUSE-MATRIX](U4-COMPONENT-REUSE-MATRIX.md)
(evidence) and [U4-HANDOFF](U4-HANDOFF.md) (obligations).

## 0. The decision that shapes everything

The owner requires the **existing catalog components to participate in
canonical VICT UI authoring**: a catalog control must be selectable in the
editor, its meaningful properties/values/action connections inspectable and
editable through the Inspector, persisted in canonical document source, and
replayed identically by the finished application. The previously recommended
route — registered components (P3) with code-owned state and wiring —
remains a legitimate integration route but **does not satisfy this
requirement** and no longer substitutes for the required proof. The earlier
"extension v2 outputs" sketch is withdrawn unresolved and replaced by the
amendment's implementable contract.

Three routes coexist in the amended design, honestly labelled:

1. **Document-authored catalog components (REQUIRED proof)** — a
   `kind:'component'` instance naming a registered catalog descriptor, with
   typed props, authored `outputs` bindings to state/declared actions, and
   authored slot fills; edited through the Inspector; persisted in the
   document; replayed by the same renderer in the finished app. This is the
   amendment's contract and the acceptance requirement.
2. **Registered components (P3, comparison)** — trusted Svelte surfaces
   composing catalog parts with `useVictActions()` (declared actions only;
   undeclared refused pre-dispatch, recorded tests). Kept as a labelled
   comparison example; not a substitute.
3. **Document elements (P2)** — native elements with interactions
   (`click→invokeAction`, `change→setState`, `submit→invokeAction`). Native
   controls appear only as clearly-labelled comparison examples next to the
   catalog proofs.

## 1. The four required catalog-authoring proofs, concretely

Every proof follows the same founder-visible arc — **select the catalog
instance in the editor → inspect/edit its exposed properties and bindings in
the Inspector → undo/redo → save → reload → use it in the finished
application** — on the SAME catalog control (fixtures:
[fixtures/component-contract/](fixtures/component-contract/README.md)).

### 1.1 Button — declared action + disabled/loading/feedback

- **Authored instance**: `vict.catalog.button` (descriptor `abi@1`): props
  `label`, `disabled`, `loading`; output `press` (void intent).
- **Founder edits**: label as a literal; `disabled` bound to an expression
  (e.g. `state.currentNote` emptiness); `loading` bound to
  `state.approving`; `press` connected in the Inspector's Behavior tab to
  the **declared** action `review.approve` with an authored input mapping
  (`noteId ← state.currentNote`).
- **Runtime**: press → bridge maps the output to the host dispatcher
  (declared-action authority, unchanged); feedback via the action's declared
  feedback text; pending presentation driven by the reactive `loading`
  input. The implementation never sees the dispatcher.
- **Persistence**: the binding is document source (`outputs` +
  `bindExpression{kind:'prop'}` edits); survives save/reload and
  `applicationVersion` change (canonical bytes).
- **Comparison (labelled)**: a P3 surface button and a native document
  button (`click→invokeAction`) demonstrate the other two routes.

### 1.2 Checkbox — checked value + meaningful submission

- **Authored instances**: two `vict.catalog.checkbox` instances with
  **distinct** state keys (`ackA`, `ackB`) — state isolation between
  instances is demonstrated, not assumed; `checked` bound to its state key;
  `checkedChange` → `setState(key, $output)`.
- **Founder edits**: labels; the checked binding (rebind one instance to a
  different key and watch isolation); toggle → canvas reflects state.
- **Meaningful submission**: an **Acknowledge & submit** authored control
  dispatches the declared `checklist.submit` action whose input reads the
  checkbox-owned state — the value connection is authored document data, not
  Svelte wiring.
- **Boundary/negative**: toggling writes only the bound key; a rebind to a
  `number`-typed key is refused at author time
  (`UI_COMPONENT_BINDING_INCOMPATIBLE`).
- **Comparison (labelled)**: native `input[type=checkbox]` with
  `change→setState` (`RenderNode.handleChange`).

### 1.3 AppShell/sidebar — navigation, active selection, responsive

- **Authored instance**: `vict.catalog.appshell` with an authored **content
  slot fill** (the review screen content) — authored children inside a
  catalog host.
- **Navigation/active/responsive** come from the **existing composition
  semantics** (no new contract): `UiApplicationComposition`
  (`navigation:'sidebar'`, `responsive.navigationAt`) and renderer-resolved
  `UiShellLink.current` ("route IDs and navigation policy stay with the
  renderer"); responsive collapse uses the implemented matchMedia 720/960
  drawer behavior.
- **Founder edits**: shell `title`; the slot fill content (add/remove a
  heading); nav composition is application-manifest data — editable as
  declared data and persisted with the application, not hidden in code.
- **Boundary/negative**: unknown route renders the host's not-found surface.

### 1.4 Select + Dialog — value change / open state / focus / portal

- **Authored Select**: `vict.catalog.select` — `options` bound to an
  array-typed **view-field reference** (the expression language has no array
  literals; options data is application data, typed via `viewFields`);
  `value` bound to `state.region`; `valueChange` → `setState` feeding a
  declared `assignment.assignRegion` input.
- **Authored Dialog**: `vict.catalog.dialog` — `open` bound to
  `state.dialogOpen`; `openChange` → `setState` (covers open requests AND
  Escape/overlay close through one authored binding); a declared **body slot
  fill** containing an authored confirm control
  (`click→invokeAction assignment.confirm`); portal renders to the
  **ControlScope root** (`BitsConfig defaultPortalTo` — tokens and catalog
  styling stay with the controls; NOT `document.body`); focus moves in on
  open and returns on close (bits-ui focus scope — implementation-provided,
  stated as an inspection limit).
- **Sequence proven**: a declared action success opens the dialog
  (`setState dialogOpen`), the Select inside/behind it keeps its authored
  value, confirm dispatches, Escape mutates nothing but `openChange`'s state
  write.
- **Comparison (labelled)**: native `<select>` with `change→setState`.

## 2. Theme/style mounting (all proofs)

Mount `@victframework/ui-svelte/styles.css` once and wrap surfaces in
`.vict-app`; catalog parts additionally use `ControlScope` + `catalog.css`.
No component-specific CSS is hand-copied — styling travels with the
packages. Descriptor `styleTargets`/`inspectionLimits` declare what is
styled internally and what cannot be inspected (e.g. bits-ui focus ring).

## 3. What stays opaque vs visible

- **Opaque (declared)**: component rendering internals — DOM, internal
  styling, bits-ui behavior (focus trap, portal mechanics, ARIA wiring).
  Declared per descriptor via `inspectionLimits`.
- **Visible (canonical)**: everything the proofs require for business
  meaning — instance props and bindings, `outputs` connections (state keys,
  action ids, input mappings), slot fills, descriptor interfaces (typed
  props/outputs/slots, identity, revision), action declarations and
  contracts, composition/nav declarations, full document source. Authoritative
  values and connections are never hidden in Svelte code on the authoring
  route.

## 4. Minimum implementation scope (amendment; separate from the ui-editor F3 repair)

1. **Neutral model/compiler/validation** (`@victframework/ui`, pure data):
   `UiOutputDecl`, `UiOutputBinding`, `setOutputBinding` edit op, descriptor
   `outputs`/`abi` fields, validator + compile rules and diagnostics
   (amendment §5), plan-instruction additive fields
   (`outputDecls`/`outputBindings`/`slots`).
2. **Svelte bridge** (`@victframework/ui-svelte`):
   `UiSvelteComponentImplementation` (+`io.emit`, slot snippets, abi gate),
   generation-gated delivery (stale-drop), catalog wrappers
   (button/checkbox/select/dialog/app-shell) adapting the existing public
   components.
3. **Inspector controls** (`@victframework/ui-editor`): descriptor-driven
   property editors (literal + `bindExpression` binding), Behavior-tab
   output-connection editor (state picker type-filtered, action picker over
   `knownActionIds`, `$output` input mapping), wired through
   `UiEditSession` (transactions, undo/redo, two-phase save).
4. **Identity integration** only where genuinely required: descriptor ↔
   application `components` registration (existing rule), occurrence
   identity (existing), ABI matching (new, render-side).
5. **Consumer evidence**: the four proofs in the packed-tarball isolated
   consumer, with labelled comparison routes.

The **ui-editor packaging repair (F3)** — emitting build + four TS2307
declaration fixes, no behavior change — is a separate in-scope item and must
not be entangled with amendment work.

## 5. Superseded

The previous §5 ("extension v2 outputs" sketch) and §0's P3-only proof
decision are **superseded** by
[U4-COMPONENT-AMENDMENT](U4-COMPONENT-AMENDMENT.md); that text is retained
above only as history (§0) and is not implementable authority. The old
sketch's unresolved details (typed payloads, `$output` scoping, stale
callbacks, ABI matching, slot composition, diagnostics) are resolved in the
amendment's Sections 3–5.

## 6. Owner-authority record

1. **ANSWERED by the owner (this amendment)**: catalog components must be
   canonically authorable; the registered-surface proof does not satisfy the
   requirement. The contract is
   [U4-COMPONENT-AMENDMENT](U4-COMPONENT-AMENDMENT.md); its implementation
   is the amended U4 scope (still gated by the U4 authorization).
2. **ui-editor dist repair (F3)** authorized as in-scope package
   maintenance (emitting build + the four TS2307 declaration fixes; no
   behavior change) — unchanged from the prepared handoff.
3. **Packed-tarball install as the isolation mechanism** and the pack list —
   unchanged from the prepared handoff.
