# U4 component-integration amendment — catalog components as canonical authored UI

Status: **PROPOSED — UNDER INDEPENDENT REVIEW (implementation NOT authorized)**
Contract ABI: `vict.ui-component-abi@1` (introduced by this amendment)
Document schema: unchanged (`vict.ui-document@1`, additive optional fields only)
Plan schema: unchanged (`vict.ui-render-plan@1`, additive optional fields only)

## 1. Authority and provenance

The owner selected a stronger requirement than the prepared U4 handoff carried:

> The existing catalog components must participate in canonical VICT UI
> authoring. Their meaningful properties, values and action connections must
> be inspectable and editable through the authoring experience. The proposed
> registered-component proof does not satisfy this requirement when it keeps
> the catalog Checkbox's state/wiring inside Svelte code and demonstrates
> Inspector editing on a separate native control. Registered components
> remain a legitimate integration route. They must not substitute for the
> required document-authored catalog proof.

This authorization covers documentation/design, read-only source
investigation, independent review, bounded design repairs and amendment
freeze. Runtime implementation and U4 implementation remain unauthorized.

Why the stronger requirement: the prepared handoff's representative proof
(recommended route P3 "registered components") demonstrated catalog controls
inside hand-written Svelte surfaces whose state and wiring lived in code; the
Inspector demonstrated editing on separate native controls. That proves
integration, not *authoring support* for the catalog control. The owner
requires the catalog component itself to be the authored thing: selected in
the editor, its meaningful properties and connections edited through the
Inspector, persisted in canonical document source, and replayed by the
finished application.

The prior P3 recommendation is preserved, not erased: it remains recorded in
[U4-COMPONENT-INTEGRATION-DESIGN](U4-COMPONENT-INTEGRATION-DESIGN.md)
history and in [DECISIONS-AND-EVIDENCE](DECISIONS-AND-EVIDENCE.md) as a
legitimate integration route and comparison example. It no longer satisfies
the required proof.

Entry lineage (all verified present before work began):

| Artifact | SHA |
| --- | --- |
| Prepared U4 handoff records (this amendment's base) | `cfbd6d31b1e670034f9d94a0ac9a52b017756731` |
| U3 closure records | `16df3bf155fa2a8c9ca0de67996dc6d73450f659` |
| Verified combined implementation | `952d92da5131d6ab595b45b3bf18bc7ce3b3466d` |
| Frozen amended U0 authority | `9ec87f3e7eb8eb7793f972111258940aac635346` |

U0–U3 remain closed. The original freeze bytes at `9ec87f3…` are not
rewritten; Section 2 enumerates exactly what this amendment supersedes.

Isolated branch: `codex/ui-foundation-u4-component-amendment` from
`cfbd6d3…` (the prepared handoff lineage).

## 2. What this amendment supersedes — and what stays governing

Superseded (documents only; no frozen byte is rewritten):

1. The prepared [U4-HANDOFF](U4-HANDOFF.md) representative-proof definition
   (registered-component surface with code-owned state/wiring as the
   component proof) and its §12 authorization prompt. Both are replaced by
   this amendment's contract and the revised prompt. A missing required
   catalog-authoring interaction or editing path is **FAIL** or **NOT
   DEMONSTRATED** — never a non-blocking finding.
2. The prepared handoff's disposition of the props-only extension bridge gap
   ("scoped extension-v2 amendment proposed, not implemented"). That sketch
   is **withdrawn unresolved**; this amendment replaces it with implementable
   schema/API drafts (Sections 3–5). No text of the old sketch is adopted
   without resolution here.
3. Nothing else. Every one of the seven frozen U4 criteria
   (STAGES-AND-VERIFICATION §6, U4-01…U4-07 at `9ec87f3…`) stays governing
   with its original evidence requirements, as do packaging/packed-tarball
   isolation, public-export consumption, preview/production parity, bundle
   separation, declared-action runtime authority, preview fencing, the
   unfamiliar-agent exercise, the independent final gate and the founder
   checkpoint. The ui-editor packaging repair (F3) remains a separate,
   unchanged in-scope maintenance item.

## 3. The component contract — complete path

The smallest reusable contract that makes an existing catalog component a
canonical authored component:

```
canonical component instance            (component node in vict.ui-document@1)
  → compiled instruction                (extended `extension` plan instruction)
    → registered implementation         (exact-identity Svelte wrapper, abi@1)
      → typed output                    (declared, bounded, validated emit)
        → authored state/action         (setState / invokeAction — existing channels)
          connection
```

Every arrow below is specified against the actual repository contracts.
Framework-neutral pieces live in `@victframework/ui` (pure data, no Svelte or
Bits UI types); the Svelte bridge and wrappers live in `@victframework/ui-svelte`;
editor surfaces live in `@victframework/ui-editor`.

### 3.1 Canonical component instance (document source)

A catalog component instance is an existing `kind:'component'` node whose
`definitionId` names a registered component descriptor (the same deferred
resolution catalog extensions already use: document-level validation reports
`UI_DOC_UNKNOWN_COMPONENT` as a compiler-deferred code, and
`compileUiDocument` resolves the node through the registered descriptor map).
Already-supported instance machinery, unchanged: `revision` pinning, typed
`props` (expressions resolved in the instance scope), `slots` fills
(`UiSlotFill`, resolved in the instance scope, authored via `fillSlot`),
occurrence identity (`UiOccurrenceRef`: `documentId + sourceNodeId +
componentInstancePath + repeatRecordKeyPath`; occurrence keys are logical
addresses, never DOM handles).

**One additive optional node field** (the only document-model change):

```ts
/** Authored connection of a component instance's declared outputs. */
export type UiOutputBinding =
  | {
      readonly setState: {
        readonly key: StateKey;
        /** Payload expression; `$output` resolves to the emitted payload. */
        readonly value?: UiExpression;
      };
    }
  | {
      readonly invokeAction: {
        readonly actionId: string;
        readonly input?: Readonly<Record<string, UiExpression>>;
      };
    };
```

placed on the component node kind as
`outputs?: Readonly<Record<string, UiOutputBinding>>` (output name → binding).
Product-specific state keys, action ids and input mappings live here — in the
authored instance — never in global catalog metadata. Descriptors declare the
reusable interface; instances declare the product wiring. When the field is
absent the document is byte-identical to today's model (Section 4.3).

### 3.2 Descriptor — the declared reusable interface

Registered catalog components reuse the existing `UiExtensionDescriptor`
shape (id, revision, `props: UiPropDecl[]`, `rendererImplementationId`,
`styleTargets?`, `inspectionLimits?`) with two changes:

- **`outputs?` (new additive optional field, replaces reliance on the
  untyped `events?: string[]`)**:

  ```ts
  export interface UiOutputDecl {
    /** Declared output name (the `outputs` map key on instances). */
    readonly name: string;
    /** `'void'` for pure intent (no payload), or a primitive payload type. */
    readonly payload: 'void' | UiPrimitiveType;
    /** Editor-facing description of when the output fires. */
    readonly description?: string;
  }
  ```

  The untyped `events?: string[]` field keeps its current meaning and its
  current fail-closed renderer behavior (Section 5.2): declaring `events`
  without `outputs` remains `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`.
  Outputs are granted only by the typed `outputs` field.
- **`abi` (new additive optional field, required for output-capable
  descriptors)**: literal `'vict.ui-component-abi@1'`. A descriptor that
  declares `outputs` MUST declare `abi`; the bridge refuses output-channel
  delivery when descriptor ABI and implementation ABI differ (Section 5).

Typed inputs: `UiPropDecl {name, type, default?}` as today, with the type
vocabulary additively widened to `UiPrimitiveType | 'array'`. An
array-typed prop is always bound to an expression resolving to an array
(the expression language has no array literal — verified), i.e. a typed
`view.<field>` / `record.<field>` reference declared in the `viewFields`
catalog. Literal/default checks keep their existing shape (literals are
compared against the declared primitive type; `UI_EXPR_TYPE_MISMATCH`
continues to fire for wrong literal types; array-typed props accept only
reference expressions — new validator rule, Section 5.1).

### 3.3 Compiled instruction

The `kind:'extension'` plan instruction gains three additive optional
fields, mirroring what the `kind:'component'` instruction already carries
for document-stored definitions:

```ts
readonly outputDecls?: readonly UiOutputDecl;                       // from the descriptor
readonly outputBindings?: Readonly<Record<string, UiOutputBinding>>; // authored, resolved
readonly slots?: Readonly<Record<string, readonly UiRenderInstruction[]>>; // instance scope
```

Compilation resolves prop values against `propDecls` exactly as the
component-instruction path does today; compile resolves binding payloads and
target references (state keys against `document.localState`; action ids
against the declared `actionIds` catalog) and emits new diagnostics
(Section 5.1). Slot fills compile in the instance scope exactly as
`kind:'component'` slot fills already do — same code path, same scoping
guarantees. The plan schema string does not change; consumers that ignore
the new optional fields behave exactly as before on unchanged documents.

### 3.4 Registered implementation (Svelte bridge)

Implementations follow the existing `UiSvelteExtensionImplementation`
identity pattern (extensionId + revision + rendererImplementationId, exact
match, fail-closed on absent/competing registrations) extended to
`UiSvelteComponentImplementation`:

```ts
export interface UiSvelteComponentIO {
  /** Emit a declared output. Only declared names are delivered. */
  readonly emit: (output: string, payload?: string | number | boolean) => void;
  /** Declared slot fills as rendered snippets (instance scope). */
  readonly slots?: Readonly<Record<string, import('svelte').Snippet>>;
}

export interface UiSvelteComponentProps extends UiSvelteExtensionProps {
  /** Evaluated input props (existing behavior) + the IO contract. */
  readonly io?: UiSvelteComponentIO;
}
```

Rules (all enforced by the bridge, not by wrapper discipline):

- **Emit-only authority.** An implementation receives `emit` and nothing
  else: no `dispatch`, no adapters, no application data beyond evaluated
  declared props. `useVictActions()` remains available only to registered
  component *surfaces* (the P3 route, unchanged); the authoring route's
  implementations never receive the dispatcher. Whether an output results in
  a state write or a declared action run is decided solely by the authored
  `outputs` binding in the document.
- **Declared-only delivery.** `emit(name, …)` for a name absent from
  `outputDecls` is dropped by the bridge; the payload type is checked
  against the declared `payload` and dropped on mismatch. Drops carry a
  dev-only diagnostic (`UI_COMPONENT_OUTPUT_REJECTED`, Section 5.1) — never
  a silent wrong-type write and never an undeclared dispatch.
- **Reactive inputs.** Input props are the existing evaluated-prop channel:
  expressions re-evaluate on scope changes and flow one-way into the
  implementation. There is deliberately no two-way binding; the loop closes
  only through declared outputs (state → props in, outputs → state/action
  out).
- **Stale safety.** Each emit is stamped with the occurrence key and the
  renderer's document/plan generation. The bridge drops emissions from
  unmounted occurrences and from instances of a superseded document/plan
  (after save/reload, undo past the instance, or navigation) — Section 5.3.
- **Slots.** Declared slot fills arrive as rendered Svelte snippets resolved
  in the instance scope; the implementation renders them where its public
  component takes content (`children`, Overlay `content`). Undeclared slot
  fills are already rejected at validation/compile
  (`UI_DOC_UNKNOWN_COMPONENT`, definition 'declares no slot'); a declared
  slot filled by the author but unsupported by the implementation's ABI is a
  fail-closed render diagnostic (`UI_COMPONENT_SLOT_UNAVAILABLE`).

### 3.5 Typed output → authored connection

When a declared output fires, the bridge resolves the instance's authored
binding for that output name and executes it through the existing channels —
the same `setState` handler the `change→setState` interaction path uses, and
the same host `dispatch` the `click→invokeAction` path uses (declared-action
authority, contract-checked inputs, unchanged):

- `{setState:{key, value?}}` — write the payload (or `value` evaluated with
  `$output` in scope) into the declared local-state key. The target key must
  exist in `document.localState` and its declared type must equal the
  output's payload type (validator + compile check,
  `UI_COMPONENT_BINDING_INCOMPATIBLE` otherwise).
- `{invokeAction:{actionId, input?}}` — run the declared action through the
  host dispatcher; `input` expressions may reference `$output` and the
  instance scope. Unknown action ids are already rejected at validation
  (`actionIds` catalog); payload expressions are type-checked against the
  action input catalog where the application declares types, and shape
  errors surface `UI_COMPONENT_BINDING_INCOMPATIBLE` at compile.

`$output` in binding expressions: `{type:'ref', path:'$output'}` resolves to
the emitted payload inside `value`/`input` templates only — it is rejected
anywhere else (Section 5.1).

### 3.6 Editor integration (Inspector, history, persistence)

- **Selection** uses existing occurrence identity (Layers/EditorCanvas →
  `UiOccurrenceRef`); registered component instances are selectable like any
  component node — no new identity machinery.
- **Properties** (Inspector Content tab): for a registered instance the
  Inspector renders one control per descriptor `propDecl` — literal editors
  for primitives (with the declared default), expression binding via the
  existing `bindExpression {kind:'prop'}` op for references (including
  array-typed props bound to view fields).
- **Outputs/connections** (Inspector Behavior tab, "Component outputs"
  section): per declared output — choose no binding, *set state* (state key
  picker filtered by payload-type match, optional value template with
  `$output`), or *run action* (picker over `knownActionIds`, input mapping
  editor). Backed by one new closed edit op:

  ```ts
  export interface UiEditCommandSetOutputBinding {
    readonly op: 'setOutputBinding';
    readonly nodeId: string;
    readonly output: string;
    /** `undefined` clears the binding. */
    readonly binding?: UiOutputBinding;
  }
  ```

  added to the `UiEditCommand` union. Everything else is existing machinery:
  atomic transactions with whole-transaction validation, `UiEditSession`
  undo/redo (continuity-checked, `UI_EDIT_UNDO_CONFLICT` on divergence),
  two-phase save with expected-revision checks, save/reload round trip
  through the canonical document bytes.
- **EditorCanvas and finished application render through the same compiled
  plan and the same renderer**; the U4 gate demonstrates identical behavior
  (edit → canvas shows it; save → reload → finished app replays it). This is
  the existing preview/production parity requirement, applied to the new
  channel.
- **Theme/styles**: unchanged — hosts mount public styles/themes;
  `ControlScope` supplies the token context (catalog portals render to the
  ControlScope root, `BitsConfig defaultPortalTo`). Descriptor
  `styleTargets` and `inspectionLimits` surface what the implementation
  styles internally and what cannot be inspected.

### 3.7 Composition (slots) — minimum necessary contract

Required, because two of the four proofs compose content into a host
component:

- AppShell proof: the authored screen content is a slot fill (AppShell takes
  a `children` snippet). Declared navigation, active selection and
  responsive behavior already exist as *composition/adapter semantics*
  (`UiApplicationComposition`: `navigation:'sidebar'|'top'|'none'`,
  `responsive.navigationAt`; `UiShellLink.current` is resolved by the
  renderer/adapter — "route IDs and navigation policy stay with the
  renderer", `packages/ui/src/index.ts`). The amendment adds no new
  navigation contract; it requires slot-fill authoring on the registered
  path so the authored content lands inside the shell.
- Dialog proof: the dialog body is a slot fill (Overlay's `content`
  snippet); the confirm control inside it is an authored element with a
  `click→invokeAction` interaction — demonstrating authored children inside
  a catalog host, with focus/portal/Escape semantics provided by the
  implementation (bits-ui focus scope; portal to the ControlScope root).

Slot declaration on descriptors reuses the existing additive optional
`slots?: readonly string[]` field of `UiExtensionDescriptor`; the renderer
currently fail-closes on it (`UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`)
and this amendment upgrades exactly that path to deliver instance-scope
snippets (Section 3.4), keeping required/optional semantics: a declared
required slot left unfilled is a compile diagnostic
(`UI_COMPONENT_SLOT_REQUIRED`); an undeclared slot fill is rejected exactly
as today.

## 4. Identity, versions, compatibility

### 4.1 Identity matching (fail-closed, existing pattern extended)

- Instance → descriptor: `node.definitionId` equals `descriptor.id`, and the
  instance's effective revision (`node.revision` pin, else document
  revision pin semantics already used by extensions) equals
  `descriptor.revision`. Exactly one descriptor may match; zero or >1 is
  `UI_COMPONENT_UNAVAILABLE` at render (mirroring
  `UI_RENDER_EXTENSION_UNAVAILABLE`).
- Descriptor → implementation: `extensionId`, `revision` and
  `rendererImplementationId` must all equal; exactly one implementation may
  match. Never guessed by id alone; never a component from a different
  revision.
- ABI: descriptor `abi` and implementation `abi` must be the same literal;
  mismatch is `UI_COMPONENT_ABI_UNSUPPORTED` (fail-closed) — an abi@1
  renderer never feeds an abi@2 implementation, and vice versa.
- Application registration: the component (componentId + exact revision)
  appears in the application's `components` list — the existing
  application-level rule; the list feeds `computeApplicationVersion`.

### 4.2 Which changes are identity-affecting (verified mechanics)

- Document bytes → `canonicalUiDocument().contentDigest` → the document
  identity entry `{documentId, revision, contentDigest}` → folded into
  `computeApplicationVersion` (which also hashes referenced resource /
  view / action revisions and the application `components` list). Therefore:
  - **Adding/clearing an `outputs` binding, changing any prop expression,
    adding a slot fill, or re-pinning a revision changes canonical document
    bytes**, hence `contentDigest`, hence the document identity entry, hence
    `applicationVersion`. This is by design: authored wiring is semantics.
  - Editing only a descriptor's `description` or `inspectionLimits` (bridge
    metadata, registered outside serialized source) does not change document
    bytes; bumping the descriptor `revision` does (through the instance pin
    and the application components list).
  - The application `components` list is part of `applicationVersion` —
    registering, deregistering or re-revising a component changes it.

### 4.3 Schema/version decisions (no assumptions — verified against source)

- **No schema-string change.** `validateUiDocument` hard-rejects any
  document whose `schema !== 'vict.ui-document@1'`
  (`UI_DOC_UNKNOWN_SCHEMA`, immediate return). The amendment therefore adds
  **additive optional fields inside `vict.ui-document@1` and
  `vict.ui-render-plan@1`** — verified compatible: validation is
  structural/property-based (known fields checked when present; no
  unknown-field rejection sweep exists in `validateUiDocument`), so today's
  validator accepts documents carrying the new optional fields, and today's
  canonicalizer digests them transparently.
- **ABI string, not schema string.** Cross-implementation compatibility is
  carried by the explicit `abi` marker (Section 4.1) — renderer-side
  fail-closed — rather than by mutating the frozen document schema id.
- **Compatibility matrix.**

  | Artifact pair | Behavior |
  | --- | --- |
  | Old document → new validator/renderer | Byte-identical (fields absent); zero drift — same digests, same `applicationVersion` |
  | New document → old validator | Accepted (property-based validation ignores unknown optional fields); any *semantic* miss surfaces later as a fail-closed render diagnostic — never silent misbehavior |
  | New document → old renderer | `EXTENSION_UNAVAILABLE`/`UI_RENDER_EXTENSION_UNAVAILABLE` for unresolvable components (existing fail-closed path). No partial rendering of output-wired instances |
  | Props-only extensions | Unchanged: `events`/`slots` descriptors without typed `outputs` keep failing closed (`UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`) until an author migrates them to `outputs` |
  | Old `UiSvelteExtensionProps` implementations | Continue to resolve for props-only descriptors; output-capable descriptors require abi@1 implementations |

- **Public APIs / module ownership.**
  - `@victframework/ui`: `UiOutputDecl`, `UiOutputBinding`,
    `UiEditCommandSetOutputBinding`, descriptor field additions, validator +
    compile rules. Pure data; no Svelte/Bits UI imports (keeps
    framework-neutral contracts clean).
  - `@victframework/ui-svelte`: `UiSvelteComponentImplementation`,
    `UiSvelteComponentProps`/`UiSvelteComponentIO`, bridge delivery +
    stale-drop, catalog wrappers (button / checkbox / select / dialog /
    app-shell) adapting existing public components. Compiled instructions
    are produced only by `@victframework/ui`; the renderer never invents
    them.
  - `@victframework/ui-editor`: Inspector property/output controls and the
    `setOutputBinding` op surface. No renderer internals imported.
  - `@victframework/application`: registration list plumbing (existing).
  Consumers use public exports only; the U4 packed-tarball isolation
  (no workspace links, no repo source aliases, no original-example imports)
  applies unchanged, and `@victframework/ui-svelte` ships the wrappers from
  its existing source-exports packaging.

## 5. Failure model

### 5.1 Author-time diagnostics (validation/compile — editor-visible)

| Code | Layer | Severity | Raised when |
| --- | --- | --- | --- |
| `UI_COMPONENT_OUTPUT_UNKNOWN` | compile | error | instance `outputs` key is not declared by the resolved descriptor |
| `UI_COMPONENT_OUTPUT_PAYLOAD_INVALID` | validate/compile | error | bound `$output` used at mismatched type; payload expression type ≠ declared payload |
| `UI_COMPONENT_BINDING_INCOMPATIBLE` | validate/compile | error | target state key missing or declared type ≠ payload type; action input shape/type mismatch; `setState` value expression not type-compatible with the state key |
| `UI_COMPONENT_SLOT_REQUIRED` | compile | error | declared required slot unfilled |
| `UI_DOC_UNKNOWN_COMPONENT` | validate (deferred) / compile | error (when unresolved) | definitionId matches neither stored definitions nor registered descriptors (existing behavior preserved) |

`$output` is valid **only** inside `outputs[*].setState.value` and
`outputs[*].invokeAction.input` expression scopes; any other occurrence is
`UI_COMPONENT_OUTPUT_PAYLOAD_INVALID` (path-annotated).

### 5.2 Render-time diagnostics (fail-closed, existing pattern extended)

| Code | Raised when |
| --- | --- |
| `UI_COMPONENT_UNAVAILABLE` | zero or multiple descriptors match the compiled identity; zero or multiple implementations match; implementation missing entirely |
| `UI_COMPONENT_ABI_UNSUPPORTED` | descriptor `abi` ≠ implementation `abi` |
| `UI_COMPONENT_SLOT_UNAVAILABLE` | implementation ABI cannot render a declared, filled slot |
| `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED` | unchanged — props-only legacy descriptors declaring untyped `events` |
| `EXTENSION_UNAVAILABLE` | unchanged — compile-time neither-definition-nor-extension resolution |

Render diagnostics surface through the existing `reportDiagnostic` channel
(the same one `UI_RENDER_EXTENSION_UNAVAILABLE` uses today — recorded in U3
evidence) and never throw across the render boundary.

### 5.3 Stale, reset and unmounted callbacks

Every emission crosses a generation gate before delivery: the bridge stamps
`(occurrenceKey, documentRevision/plan generation)` at dispatch and compares
against the currently mounted plan. Dropped (with dev-only
`UI_COMPONENT_OUTPUT_STALE` diagnostic): emissions arriving after the
occurrence unmounted, after a document/plan replacement (save/reload,
undo/redo past the instance, route change), or after the implementation was
re-resolved to a different revision. Consequently a stale callback can never
write state or dispatch an action authored for a different document
generation. This is renderer-enforced; wrappers cannot opt out.

### 5.4 Preserved guarantees

- **Runtime authorization**: implementations still receive no dispatcher;
  declared-action authority, action input contract checks and feedback
  mapping are unchanged; the P3 surface route keeps its existing
  `useVictActions` semantics, distinct from this channel.
- **Validation**: documents keep validating as whole transactions; new
  fields validate when present; nothing bypasses `validateUiDocument`.
- **Preview fencing**: outputs flow through the same session/preview data
  channels as interactions (`PreviewDataAdapterPort` semantics unchanged);
  no new execution path exists — the bridge maps outputs onto the two
  existing channels (setState/dispatch). **No new execution engine.**

## 6. The catalog proof (required acceptance, replacing the prepared §1 proof)

The later U4 consumer must demonstrate, for each control, **the same catalog
component** being: selected in the editor → its exposed properties and
bindings edited in the Inspector → undo/redo → save → reload → used in the
finished application. A separate native control does not count as proving
authoring support for the catalog control; native elements remain permitted
comparison examples and must be clearly labelled as such.

| Control | Authored inputs (founder edits) | Authored outputs/connections | Founder sees |
| --- | --- | --- | --- |
| Button | `label`, `disabled`, `loading` (literal or bound; `loading` from state drives the pending/disabled presentation) | `press` → `invokeAction` (declared action, `$output`-free input mapping) with success/failure feedback | edited label/disabled/loading in canvas; action runs through declared dispatch with feedback; persisted and replayed |
| Checkbox (catalog) | `label`; `checked` bound to a state key (reactive) | `checkedChange` → `setState` (payload boolean) — plus an Acknowledge/submit control dispatching a declared action consuming the state | toggle in canvas updates bound state; two instances with distinct keys stay isolated; state survives save/reload and drives the finished app |
| AppShell (sidebar) | composition (`navigation:'sidebar'`, `responsive.navigationAt` via application manifest — existing semantics); authored content slot fill | declared navigation links (renderer-resolved `current`), active selection, responsive collapse (720/960 matchMedia behavior already in AppShell) | content authored inside the shell; navigation highlights the active route; drawer below breakpoint — identical in editor canvas and finished app |
| Select + Dialog (catalog) | `options` bound to an array-typed view field; `value` bound to state; Dialog `open` bound to state; authored dialog body slot with a confirm control (`click→invokeAction`) | `valueChange` → `setState`; `openChange` → `setState`; confirm → declared action; Escape/overlay close → `openChange` | choose a value → state updates → dialog opens from a declared-action success → keyboard/focus/portal behavior (bits-ui focus scope, portal to ControlScope root) → confirm dispatches |

Walkthrough requirement (U4-05 evidence): the recorded session must show the
**same** catalog control through
select → edit exposed properties/binding → undo/redo → save → reload → use
in the finished app, for the Checkbox and at least one of Select/Dialog.

## 7. Fixtures (contract examples — not runtime evidence)

Machine-readable canonical document excerpts under
[fixtures/component-contract/](fixtures/component-contract/) (see its
`README.md` manifest): valid checkbox and select connections; declared-action
output with input mapping; multiple instances with distinct bindings;
unknown output; invalid payload; incompatible binding; missing/mismatched
implementation; required-slot composition; dialog/appshell slot fills. Each
invalid fixture carries its expected diagnostic codes. These pin the
contract's shape for the implementer and the reviewer; they execute nowhere.

## 8. Coverage statement (honest)

- **Authoring-supported by the required proofs**: button, checkbox, select,
  dialog/overlay, app-shell compositions (five catalog families), via the
  contract above.
- **Pending** (not covered by this amendment; must not be silently claimed):
  the remaining catalog families (records/data views, charts, conversation,
  tabs/form compositions beyond the proofs, calendar/dates, tooltips,
  popovers) keep today's routes — document elements, registered surfaces
  (P3), or deferred per `catalog-coverage.json` — until amended. Property
  grids for record-valued props beyond the array-reference rule,
  per-option authoring UIs, and visual binding-mapping canvas are editor
  ergonomics explicitly out of scope.
- This amendment must not expand into wrapping every catalog family.

## 9. Non-goals

No new execution engine (outputs ride setState/dispatch). No unrestricted
runtime, adapter, or arbitrary action-dispatch authority to implementations.
No two-way binding abstraction. No document schema-string change. No
Svelte/Bits UI types in `@victframework/ui` contracts. No change to U0–U3
frozen bytes, to the seven U4 criteria, to packaging isolation, to preview
fencing, or to the founder checkpoint.
