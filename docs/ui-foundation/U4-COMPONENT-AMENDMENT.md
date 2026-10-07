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
Already-supported instance machinery, unchanged: typed `props` (expressions
resolved in the instance scope), `slots` fills (`UiSlotFill`, resolved in
the instance scope, authored via `fillSlot`), occurrence identity
(`UiOccurrenceRef`: `documentId + sourceNodeId + componentInstancePath +
repeatRecordKeyPath`; occurrence keys are logical addresses, never DOM
handles).

**Not unchanged — built by this amendment** (verified absent on the
extension path today; part of the compile delta, §3.3):

1. **Instance revision pinning.** The extension compile branch today emits
   the descriptor's own revision and never reads `node.revision` (the only
   honored node pin is the stored-definition branch), and compile resolves
   descriptors through an id-keyed, last-registration-wins map. The
   amendment makes the compiled extension instruction carry the instance's
   **effective revision** — `node.revision` when pinned, else the
   registered-current descriptor revision at compile time — and resolves
   the descriptor by `(id, effective revision)` fail-closed (§4.1). A pin
   matching no registered revision is a compile diagnostic
   (`UI_COMPONENT_REVISION_UNRESOLVED`), never a silent fallback.

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

- **`outputs?` (new additive optional field)**:

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

  Outputs are granted only by the typed `outputs` field.
- **The compatibility gate rides `events` — chosen from verified legacy
  behavior.** The one fail-closed descriptor interface-field gate the
  current renderer performs — verified on the exact `952d92d…` bytes and
  reproduced at resolver level (§4.3 probe) — is: a descriptor declaring
  any `events` or `slots` entry is rejected with
  `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`. Fields a legacy resolver
  does not read (`abi`, `outputs`) are silently ignored: the probe's
  counterexample case shows an output-wired descriptor being ACCEPTED.
  The gate therefore cannot be a new field; it is the ABI marker
  declared as a capability in the field legacy consumers already
  enforce. A **component-ABI descriptor** (any descriptor declaring
  `abi`, `outputs`, or renderable slots) MUST declare

  ```ts
  events: ['vict.ui-component-abi@1']
  ```

  The marker entry is a capability declaration, not a DOM event:
  component-ABI-aware compilers and renderers treat it as the ABI marker
  and never wire it as an event listener. This repo's legacy consumer of
  descriptor `events`/`slots` — the probed resolver — rejects such a
  descriptor outright with its existing diagnostic (probe case C2) — an
  output-wired instance can never present an apparently
  functional control while its authored wiring is silently dropped.
  Descriptors without the marker keep today's exact behavior: untyped
  non-marker events keep failing closed
  (`UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`, unchanged), and an
  events/slots-free props-only descriptor continues to resolve exactly
  as today (probe case C3).
- **`abi` (new additive optional field, required for component-ABI
  descriptors)**: literal `'vict.ui-component-abi@1'`, consistent with
  the `events` marker — compile validates the pair, and a descriptor
  declaring outputs/capabilities without `abi`, without the marker, or
  with a disagreeing marker/`abi` pair is
  `UI_COMPONENT_ABI_UNSUPPORTED` (§5.1). The bridge refuses output-channel
  delivery when descriptor ABI and implementation ABI differ (Section 5).

Typed inputs: `UiPropDecl {name, type, default?}` as today, with the type
vocabulary additively widened to `UiPrimitiveType | 'array'`. An
array-typed prop is always bound to an expression resolving to an array
(the expression language has no array literal — verified), i.e. a typed
`view.<field>` / `record.<field>` reference declared in the `viewFields`
catalog. Literal/default checks keep their existing shape (literals are
compared against the declared primitive type; `UI_EXPR_TYPE_MISMATCH`
continues to fire for wrong literal types; array-typed props accept only
reference expressions — the diagnostics are specified in Section 5.1 and
built by this amendment for descriptor instances).

### 3.3 Compiled instruction

The `kind:'extension'` plan instruction gains three additive optional
fields, mirroring what the `kind:'component'` instruction already carries
for document-stored definitions:

```ts
readonly outputDecls?: readonly UiOutputDecl[];                      // from the descriptor
readonly outputBindings?: Readonly<Record<string, UiOutputBinding>>; // authored, resolved
readonly slots?: Readonly<Record<string, readonly UiRenderInstruction[]>>; // instance scope
```

compile resolves binding payloads and
target references (state keys against `document.localState`; action ids
against the declared `actionIds` catalog) and emits new diagnostics
(Section 5.1). For every instance resolving to a component-ABI descriptor
(§3.2) the compiler emits `outputDecls` — the declared list, or `[]`
when the author wired no outputs. Presence of this field is the
**compile-artifact marker**: a plan instruction for an abi@1 descriptor
without `outputDecls` was produced by a pre-amendment compiler and is
rejected render-side (§4.3, §5.2) — the old compiler's silent field drop
(verified: the extension instruction carries `propDecls`/`propValues`
only at `952d92d…`) can therefore never surface as a working control
with lost wiring. The compiled `extension` instruction's `revision` field
carries the instance's **effective revision** (node pin, else
registered-current at compile time — §3.1); the descriptor resolves by
`(id, effective revision)` fail-closed, replacing the id-keyed last-wins
map for this path: zero matches → `UI_COMPONENT_REVISION_UNRESOLVED`
(compile, error); more than one matching descriptor surfaces as
`UI_COMPONENT_UNAVAILABLE` at render (§5.2). Slot fills on
descriptor-backed instances compile in the instance scope exactly as
`kind:'component'` slot fills already do — same code path, same scoping
guarantees — **including the undeclared-fill rejection, which the
amendment builds for this path** (today such fills are silently dropped;
§3.7). The plan schema string does not change; consumers that ignore the
new optional fields behave exactly as before on unchanged documents.

### 3.4 Registered implementation (Svelte bridge)

Implementations follow the existing `UiSvelteExtensionImplementation`
identity pattern (extensionId + revision + rendererImplementationId, exact
match, fail-closed on absent/competing registrations) extended to
`UiSvelteComponentImplementation` — declared in full, since the ABI gate
(§4.1) and the slot-capability check (§5.2) require fields this contract
adds:

```ts
export interface UiSvelteComponentImplementation {
  readonly extensionId: string;
  readonly revision: string;
  readonly rendererImplementationId: string;
  /** Must equal the descriptor's `abi`; mismatch is fail-closed (§5.2). */
  readonly abi: 'vict.ui-component-abi@1';
  /** Descriptor slot names this implementation can render (capability).
   *  A declared+filled slot outside this set is `UI_COMPONENT_SLOT_UNAVAILABLE`. */
  readonly slots: readonly string[];
  /** Subset of `slots` the implementation contract requires to be filled.
   *  An unfilled required slot is `UI_COMPONENT_SLOT_REQUIRED` (render-side
   *  for descriptor instances; compile-side for stored definitions, where
   *  requiredness is declared in the definition's slot record). */
  readonly required?: readonly string[];
  readonly component: Component<UiSvelteComponentProps>;
}
```

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
- **Ordering.** Outputs are delivered per occurrence in emission order;
  reactive input re-evaluation and output delivery are independent; the
  bridge makes no cross-occurrence ordering guarantee. Implementations that
  need ordering between an output and a subsequent prop update sequence
  their own emits; the contract does not co-schedule them.
- **Slots.** Declared slot fills arrive as rendered Svelte snippets resolved
  in the instance scope; the implementation renders them where its public
  component takes content (`children`, Overlay `content`). Undeclared slot
  fills are rejected — for stored definitions by today's validation
  (`UI_DOC_UNKNOWN_COMPONENT`, definition 'declares no slot'), and for
  descriptor-backed instances by the compile rule this amendment builds
  (§3.7); a declared slot filled by the author but unsupported by the
  implementation's slot capability is a
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
  instance scope. Unknown action ids are rejected against the declared
  `actionIds` catalog — the existing check for interactions
  (`UI_DOC_UNKNOWN_PRODUCT_REFERENCE`), extended by this amendment to
  output bindings; payload expressions are type-checked against the
  action-input catalog where the application declares input types. The
  catalog is derived by `@victframework/application`, which already owns
  the `actionIds` catalog this check extends: a small pure helper
  (`deriveActionInputCatalog`) resolves each registry action's
  `inputContractId`/`inputContractRevision` against the contracts
  registry the application compile already loads, producing
  `actionId → { inputName → primitive type }`. The derived map is passed
  through `compileUiDocument`'s catalogs option (new additive field
  `actionInputs`) at the application's existing compile call site
  (`packages/application/src/ui-attach.ts` — the same call that passes
  `actionIds`/`routeIds`/`viewFields` today). Minimum affected paths:
  `packages/ui/src/compile.ts` (option + output-binding payload checks)
  and `packages/application/src/ui-attach.ts` (derivation + pass-through);
  this application-package plumbing is explicitly part of the later U4
  allowed scope — not a deferred surprise. No application-schema change;
  `actionIds` semantics, document identity and dispatch authority are
  unchanged. The fixtures' `applicationInputs.actionInputs` blocks
  illustrate the derived shape. Shape/type errors surface `UI_COMPONENT_BINDING_INCOMPATIBLE` at
  compile.

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
snippets (Section 3.4), keeping required/optional semantics: a required
slot left unfilled is `UI_COMPONENT_SLOT_REQUIRED` — compile-side for
stored definitions (existing requiredness semantics), render-side for
descriptor instances via the implementation's `required` capability
(§3.4, §5.1); an undeclared slot fill is rejected — for
stored definitions this exists today (`UI_DOC_UNKNOWN_COMPONENT`,
'declares no slot'), and the amendment builds the same rejection for
descriptor-backed instances at compile (same code, compile-raised; today
such fills are silently dropped — that is one of the gaps this contract
closes).

## 4. Identity, versions, compatibility

### 4.1 Identity matching (fail-closed; the pin rule is built by this amendment)

- Instance → descriptor: `node.definitionId` equals `descriptor.id`, and
  the instance's effective revision — `node.revision` when pinned, else
  the registered-current descriptor revision at compile time — equals
  `descriptor.revision`. This is **built by the amendment** (§3.1: today's
  extension path echoes the descriptor revision and resolves id-keyed
  last-wins): compile resolves the descriptor by `(id, effective revision)`
  fail-closed. Zero matches → `UI_COMPONENT_REVISION_UNRESOLVED` (compile,
  error). More than one registered descriptor with the same `(id, revision)`
  is a registration error surfaced as `UI_COMPONENT_UNAVAILABLE` at render
  (mirroring `UI_RENDER_EXTENSION_UNAVAILABLE`, which already implements
  this discipline on the render side).
- Descriptor → implementation: `extensionId`, `revision` and
  `rendererImplementationId` must all equal; exactly one implementation may
  match. Never guessed by id alone; never a component from a different
  revision.
- ABI: descriptor `abi` and implementation `abi` must be the same literal;
  mismatch is `UI_COMPONENT_ABI_UNSUPPORTED` (fail-closed) — an abi@1
  renderer never feeds an abi@2 implementation, and vice versa. A
  component-ABI descriptor must also carry the `events` ABI marker (§3.2);
  a descriptor declaring outputs/capabilities without the marker — or with
  a marker/`abi` pair that disagrees — is itself
  `UI_COMPONENT_ABI_UNSUPPORTED` at compile (§5.1).
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
- **Compatibility gate chosen from verified legacy behavior.** The first
  freeze (`68e166f…`, superseded) claimed an old renderer rejects
  output-wired instances via the descriptor `abi` field. That claim was
  false: the current resolver reads only `id`, `revision`, `events`,
  `slots` and `rendererImplementationId`; `abi`/`outputs` are silently
  ignored. A resolver-level probe against the exact `952d92d…` bytes
  reproduced the counterexample — the frozen fixture descriptor (`abi` +
  `outputs`, no `events`/`slots`) is ACCEPTED with a matching
  implementation, no diagnostic. The gate is therefore the field legacy
  consumers already fail close on: the ABI marker declared in `events`
  (§3.2), plus the compile-artifact marker (`outputDecls` always emitted
  for abi@1 descriptors, §3.3) and the implementation `abi` field. An ABI
  check added only to the new renderer could never make an old renderer
  reject new artifacts; the marker makes the repo's legacy consumer (the
  probed resolver — and any consumer sharing its interface-field gate)
  reject
  them with its own existing diagnostic
  (`UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`).
- **Compatibility matrix.**

  | Artifact pair | Behavior |
  | --- | --- |
  | Old documents/descriptors → new compiler + renderer | Byte-identical (no marker anywhere) — same props-only resolution, digests and `applicationVersion`; old-document behavior and identity preserved unchanged |
  | New output-enabled documents → old compiler | The property-based old compiler drops the new instance fields (extension instructions carry `propDecls`/`propValues` only — verified at `952d92d…`); the descriptor marker remains → old renderer rejects at resolution (`UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`, probe C2); new renderer rejects the marker-less plan artifact (`UI_COMPONENT_ABI_UNSUPPORTED`, §5.2). Never an apparently functional control with silently dropped wiring |
  | New compiled instructions → old renderer | New instruction fields are unread by legacy code, but resolution rejects via the descriptor marker — `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED` (probe C2 shape; resolver-level result) |
  | Old compiled instructions → new renderer + output-enabled descriptors | The instruction lacks `outputDecls` for an abi@1 descriptor → fail-closed `UI_COMPONENT_ABI_UNSUPPORTED` (§5.2); pre-amendment compile artifacts cannot masquerade as current |
  | Fully compatible new artifacts | Full authored path: compile checks (§5.1), typed delivery, generation-gated stale handling (§5.3) |
  | Missing / mismatched / unsupported implementations | `UI_COMPONENT_UNAVAILABLE` (absent, competing, identity mismatch — existing discipline); `UI_COMPONENT_ABI_UNSUPPORTED` (abi mismatch, malformed marker, or marker-less plan artifact); `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED` (legacy consumers — existing diagnostic) |
  | New document → old validator | Accepted (property-based validation tolerates the new optional fields); semantic misses surface at the failing consumer per the rows above — never silent misbehavior |
  | Props-only extensions | Unchanged — descriptors without the marker keep today's exact resolution semantics; untyped non-marker events keep failing closed |

  Evidence limits, stated plainly: the probe is a **resolver-level**
  reproduction against the exact legacy bytes (external disposable
  harness; production files unmodified) — it is **not** a browser
  rendering test. For the two "old renderer" rows, the evidenced behavior
  is the resolver's outcome at the point of component resolution;
  downstream legacy rendering is out of scope because resolution never
  succeeds. New compiler/renderer rows are contract requirements until
  implemented — they have NOT been runtime-tested, and nothing here
  claims otherwise.

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
  - `@victframework/application`: ONE bounded addition is required and is
    explicitly part of the later U4 allowed scope (§3.5): deriving the
    action-input catalog from the action registry's `inputContractId`/
    `inputContractRevision` via the contracts registry the compile already
    loads, and passing it through `compileUiDocument`'s catalogs option at
    the existing `ui-attach.ts` call site
    (`packages/application/src/ui-attach.ts`). Registration-list plumbing
    (`components`/`uiExtensions`) is existing and suffices. No
    application-schema change; `actionIds` semantics, identity semantics
    and dispatch authority unchanged. Any further application-package
    need is a recorded scope decision at the gate, not a silent expansion
    of the allowed paths.
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
| `UI_COMPONENT_BINDING_INCOMPATIBLE` | validate/compile | error | target state key missing or declared type ≠ payload type; action input shape/type mismatch (against the derived action-input catalog, §3.5); `setState` value expression not type-compatible with the state key; array-typed prop bound to a non-reference or non-array-typed expression |
| `UI_EXPR_TYPE_MISMATCH` | validate (stored defs) / compile (descriptor instances — built by this amendment) | error | literal prop value type ≠ `propDecl.type`; reference prop value resolving to a typed source (state key / view field) whose type ≠ `propDecl.type` |
| `UI_COMPONENT_SLOT_REQUIRED` | compile (stored definitions — existing requiredness semantics) / render (descriptor instances — the implementation's `required` capability, §3.4) | error | a required slot has no fill. The descriptor `slots` field is a plain name list and carries no requiredness marker; descriptor-instance requiredness lives in the implementation contract |
| `UI_COMPONENT_REVISION_UNRESOLVED` | compile | error | instance revision pin matches no registered descriptor revision (§4.1) |
| `UI_COMPONENT_ABI_UNSUPPORTED` | compile (also surfaced render-side, §5.2) | error | component-ABI descriptor malformed: `outputs`/capabilities declared without `abi`, `abi` declared without the `events` marker (§3.2), or marker and `abi` disagree |
| `UI_DOC_UNKNOWN_COMPONENT` | validate (deferred) / compile | error (when unresolved) | definitionId matches neither stored definitions nor registered descriptors (existing behavior preserved); also compile-raised for undeclared slot fills on descriptor instances (§3.7) |
| `UI_DOC_UNKNOWN_PRODUCT_REFERENCE` | validate / compile | error | action id in an output binding absent from the declared `actionIds` catalog (existing code, extended scope) |

Prop typing for descriptor-backed instances (the `UI_EXPR_TYPE_MISMATCH`
compile rows and the array-reference rule) is built by this amendment:
today's literal check runs only for stored definitions; the amendment
extends prop checking to descriptor instances at compile, using
`propDecls` from the resolved descriptor. Array-typed props accept only
reference expressions (the expression language has no array literal); a
literal or non-array reference is `UI_COMPONENT_BINDING_INCOMPATIBLE` /
`UI_EXPR_TYPE_MISMATCH` respectively. Declared limit: `'array'` is
element-untyped (`UiFieldType` carries no element type), so a wrong-shaped
array is not diagnosable by this contract — runtime behavior only, recorded
as an inspection limit.

`$output` is valid **only** inside `outputs[*].setState.value` and
`outputs[*].invokeAction.input` expression scopes; any other occurrence is
`UI_COMPONENT_OUTPUT_PAYLOAD_INVALID` (path-annotated).

### 5.2 Render-time diagnostics (fail-closed, existing pattern extended)

| Code | Raised when |
| --- | --- |
| `UI_COMPONENT_UNAVAILABLE` | zero or multiple descriptors match the compiled identity; zero or multiple implementations match; implementation missing entirely |
| `UI_COMPONENT_ABI_UNSUPPORTED` | descriptor `abi` ≠ implementation `abi`; instruction lacks `outputDecls` for an abi@1 descriptor (pre-amendment compile artifact, §4.3); malformed component-ABI descriptor surfaced render-side (§5.1) |
| `UI_COMPONENT_SLOT_UNAVAILABLE` | implementation ABI cannot render a declared, filled slot |
| `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED` | code and behavior unchanged — any descriptor declaring `events`/`slots` on a legacy consumer; since §3.2 this includes every component-ABI descriptor via the `events` ABI marker (probe-verified on the `952d92d…` bytes) |
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
| Button | `label`, `disabled`, `loading` (literal or bound; `loading` from state drives the pending/disabled presentation — the wrapper adapts the existing `ActionButton.svelte` pending pattern: 'Working…', `aria-busy`, disabled-while-pending; `Button.svelte` itself has no `loading` prop today) | `press` → `invokeAction` (declared action, `$output`-free input mapping) with success/failure feedback | edited label/disabled/loading in canvas; action runs through declared dispatch with feedback; persisted and replayed |
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
