# U0 API and schema specification — exact drafts to freeze

Status: U0 contract candidate artifact. Everything here is a design draft to be implemented in
U1+; nothing on this page claims to exist in code today. Semantics come from
[CONTRACTS](CONTRACTS.md); observed baseline facts come from [RECONCILIATION](RECONCILIATION.md).
This page pins the exact names, shapes, diagnostics and boundaries the implementer must use.

## 1. Conventions

- Schema markers use the existing `vict.<family>@<version>` convention. All six markers below
  were verified unused at base `4d2df03` (see RECONCILIATION §2.1):
  `vict.application@3`, `vict.application-identity@3`, `vict.ui-document@1`,
  `vict.ui-render-plan@1`, `vict.ui-edit@1`, `vict.ui-scenario@1`.
- All documents are JSON with UTF-8 encoding, LF line endings. "Canonical bytes" of a document
  are the UTF-8 bytes of `stableJson(canonicalForm(document))` — the existing stable JSON
  writer in `packages/application/src/compile.ts` (sorted object keys; array order preserved).
- `contentDigest` always means lowercase hex SHA-256 of canonical bytes.
- Diagnostics are structured values `{ code, message, severity, ...details }`; `code` values
  are stable strings from §8. Severity is one of `error | warning | info`. Compilation and
  validation never throw for invalid input — they return diagnostics (matching existing
  application/release/renderer behavior).

## 2. `vict.application@3` — canonical UI attachment

### 2.1 Additive field-level draft

@3 keeps every @2 field and field-set rule unchanged, and adds exactly:

```
ScreenDefinition (v3):
  ...all @2 screen fields, except that exactly ONE presentation mode is present:
  - legacy mode:  layout (+ optional layoutMode/composition), or
  - document mode: uiDocument: { documentId: string; revision: string }
  A @3 screen with both modes, or with neither, is invalid
  (diagnostic UI_APP_PRESENTATION_MODE_INVALID).
  When uiDocument is present, layout/layoutMode/composition MUST be absent.

ApplicationDefinition (v3):
  schema: 'vict.application@3'
  (all other @2 fields unchanged; ui documents are referenced per-screen,
   never inlined into the application manifest)
```

Identity: `identitySchemaFor('vict.application@3') → 'vict.application-identity@3'`. The
schema marker participates in `computeApplicationVersion`, so a @3 identity can never alias a
@1/@2 identity (same mechanism as the existing @1/@2 split).

### 2.2 Explicit compile inputs (no hidden registries)

```
CompileApplicationInput (v3 additions):
  uiDocuments?:  readonly UiDocumentCatalogEntry[]
     // UiDocumentCatalogEntry = { document: UiDocument }
  uiDocumentPins?: readonly UiDocumentPin[]
     // UiDocumentPin = { documentId: string; revision: string; contentDigest: string }
  uiExtensions?: readonly UiExtensionDescriptor[]
     // per CONTRACTS §4: id/revision, prop schema, slots/events, data requirements,
     // style targets, renderer implementation identity, editor representation,
     // declared inspection limits — registered outside serialized source
```

Validation rules (all produce source-linked diagnostics):

1. Every `uiDocument` screen reference resolves to a catalog entry with equal
   `(documentId, revision)`; else `UI_DOC_REFERENCE_DANGLING`.
2. Competing catalog entries for the same `(documentId, revision)` must have equal
   `contentDigest`; a supplied pin for the same key must match the entry's digest; otherwise
   `UI_DOC_REVISION_COLLISION`. A pure compiler given one current document and no prior pin
   cannot detect a historical collision — historical enforcement lives at the
   authoring/save boundary (expected stored revision), never in hidden global state.
3. Referenced documents validate cleanly (`validateUiDocument`); cycles across document
   references (a document referencing a screen/application that references it) are rejected
   with `UI_DOC_CYCLE`.
4. Product references inside documents (actions, routes, views, resources, components) must
   resolve against the same application/resources/contracts/capabilities inputs used for the
   rest of joint compilation (`UI_DOC_UNKNOWN_PRODUCT_REFERENCE` otherwise).
5. `ref` paths inside a definition registry resolve `prop.<name>` against that definition's
   prop schema; document-level scopes (view/record, repeat, state, token) are not visible
   inside a definition registry except through typed props (`UI_EXPR_SCOPE_VIOLATION`).

### 2.3 Identity and release behavior (with examples)

`computeApplicationVersion` for a @3 application adds to the hashed payload:

```
uiDocuments: [ { documentId, revision, contentDigest }, ... ]   // sorted by documentId
```

- Example A (identity change): screen S references document D@2 with digest `aaaa…`. Editing D
  and advancing the authoring session to D@3 (digest `bbbb…`) changes the hashed payload, so
  `applicationVersion` changes. Required U1 test: `version(D@2) ≠ version(D@3)`.
- Example B (old release rejected): a frozen release binds `applicationVersion = version(D@2)`.
  After the edit, recompiling yields `version(D@3)`; `compileApplicationRelease` returns
  `ok: false` with `RELEASE_APPLICATION_MISMATCH` (existing release check, verified in
  RECONCILIATION §2.3). No new release diagnostic is introduced.
- Example C (schema aliasing): a @2 application with identical content compiles under
  `vict.application-identity@2`; its `applicationVersion` differs from the @3 form because the
  identity schema marker participates in the hash.

Identity excludes editor selection, zoom, transient history, DOM handles, compiled CSS and
scenario seeds (they are not inputs to the hashed payload). It includes semantic tree order,
styles/conditions, component source dependencies (as declared id/revision references — code
extension internals keep the existing explicit component revision boundary), binding/action
references, and authored asset digests where assets are part of the source bundle.

## 3. `vict.ui-document@1` — document schema draft

```
UiDocument = {
  schema: 'vict.ui-document@1'
  id: string                 // documentId
  revision: string           // advances only at authoring save/session boundaries
  root: NodeId
  nodes: Record<NodeId, UiNode>
  componentDefinitions: Record<DefinitionId, UiComponentDefinition>
  styleSources: Record<StyleSourceId, UiStyleSource>
  tokens: Record<TokenId, UiToken>            // token/custom-property declarations
  conditions: Record<ConditionId, UiCondition> // media/container/environment/local-state/variant
  assets: Record<AssetId, UiAssetRef>          // { kind:'digest', digest } | { kind:'external', href }
  localState: Record<StateKey, UiLocalStateDecl> // typed defaults, serializable
}
```

Node discriminated union (draft):

| kind | fields (draft) | notes |
| --- | --- | --- |
| `element` | `tag`, `attributes?`, `children: NodeId[]` | `tag` validated against the registered web-element metadata catalog; ordered children |
| `text` | `content: { type:'literal', value } \| { type:'expression', expression }` | |
| `component` | `definitionId`, `revision?`, `props?`, `variant?`, `slots?: Record<slotName, { children: NodeId[] }>` | definitionId resolves to a visual definition **or** a registered extension descriptor (distinguished explicitly) |
| `slot` | `name`, `required?`, `fallback?: NodeId[]` | definition-slot placeholders |
| `repeat` | `collection: Expression`, `key: Expression`, `itemName`, `templateRoot: NodeId` | stable, unique keys per rendered scope |
| `conditional` | `conditionId`, `branches: [{ when?: ConditionId, children: NodeId[] }]` | detached inactive branches remain valid authored source |
| `portal` | `target: { overlayId }`, `children: NodeId[]` | logical ownership; rendered via declared overlay/portal target |

`UiComponentDefinition = { id, revision, root: NodeId, props: PropSchema (typed, with
defaults), slots: Record<name, { required?, fallback? }>, variants: Record<name,
VariantConditionRef>, baseStyle?: StyleSourceId }`. A definition is stored once and may be
instantiated many times; instances never acquire multiple source parents.

Validation (`validateUiDocument(document, catalogs)`): unique node IDs
(`UI_DOC_DUPLICATE_NODE_ID`), reachable ownership from root, ordered reference integrity,
acyclic containment (`UI_DOC_CYCLE`), component dependency closure
(`UI_DOC_UNKNOWN_COMPONENT`), expression typing/scoping (§5), element/attribute checks against
the semantic catalog (`UI_DOC_UNKNOWN_ELEMENT` / `UI_DOC_UNKNOWN_ATTRIBUTE`), unknown schema
version (`UI_DOC_UNKNOWN_SCHEMA`). No `eval`, `Function`, or raw event-attribute execution
exists anywhere in the model.

## 4. `vict.ui-render-plan@1` — compiled plan draft

```
UiRenderPlan = {
  schema: 'vict.ui-render-plan@1'
  documentId, revision, sourceDigest        // provenance of the exact source bytes
  diagnostics: UiDiagnostic[]               // non-fatal notes; fatal ones abort compilation
  structure: RenderInstruction[]            // resolved tree; component deps resolved to plans
  style: { rules: StyleRule[]; layers: CascadeLayer[] }
  dynamic: { bindings: BindingInstruction[]; repeats: RepeatInstruction[];
             conditions: ConditionInstruction[] }   // live instructions, NOT frozen DOM
  extensions: ExtensionRef[]                // declared implementation identities only
  sourceMap: SourceMapDescriptor[]          // occurrence provenance (see below)
}
```

Occurrence identity (persisted in `sourceMap`): `documentId + sourceNodeId +
componentInstancePath + repeatRecordKeyPath` (+ logical portal ownership). DOM annotations and
handles are renderer implementation details and are never persisted as application source.
Occurrence-aware mapping is what lets selection/editing address definition, instance and
record separately (A-07).

## 5. Expressions, styles and conditions — draft summary

- Expression tree (finite, declarative): `literal | ref | compare | boolean | conditionalValue
  | op`. `ref` namespaces: `view.<field>` / `record.<field>`, `repeat.<itemName>.<field>`,
  `prop.<name>`, `state.<key>`, `token.<id>`. `op` invokes a registered pure operation with a
  declared type signature and version. Validation is lexical-scope-aware before rendering
  (`UI_EXPR_UNKNOWN_REFERENCE`, `UI_EXPR_TYPE_MISMATCH`, `UI_EXPR_SCOPE_VIOLATION`).
- CSS declaration: `{ property, value }` with `value = { type:'text', value } | { type:'token',
  id } | { type:'binding', expression }` (the last only where explicitly supported). CSS
  values are presentation data, never JavaScript. Unknown-but-valid browser properties are
  accepted (`UI_STYLE_PROPERTY_UNSUPPORTED` is a warning-class diagnostic only when the
  renderer cannot honor them).
- Cascade layers, innermost last (later wins within equal specificity): token defaults →
  component base → component variant → attached reusable style sources → instance-local style
  sources. Generated rules use a single normalized class selector; condition rules keep
  explicit authoring order. Conditions are named, persisted, ordered records — no hard-coded
  breakpoint vocabulary.

## 6. `vict.ui-edit@1` and `vict.ui-scenario@1` — protocol drafts

### 6.1 Edit transactions

```
UiEditTransaction = {
  requestId: string
  expectedDocumentRevision: string
  reason?: string                     // human-safe
  commands: UiEditCommand[]           // ordered
}
UiEditCommand (discriminated): insert | move | remove | setProperty | setAttribute |
  setStyleDeclaration | setConditionState | bindExpression | connectInteraction |
  createComponentDefinition | updateComponentDefinition | fillSlot
```

- Atomic: all commands applied to a snapshot, then full validation; any failure rejects the
  whole transaction with no partial mutation (`UI_EDIT_VALIDATION_FAILED` carries the
  per-command diagnostics). Destructive `remove` also checks remaining references
  (`UI_EDIT_REFERENCE_REMAINS`).
- Idempotency: same `requestId` + identical payload reconciles to the recorded result; same
  `requestId` + different payload is a conflict (`UI_EDIT_REQUEST_CONFLICT`) within the
  session's identity scope.
- Revisions: accepted transactions (including undo/redo) advance the session revision
  monotonically; restoring old content never rewinds the revision. Undo/redo revalidates
  against current revisions (`UI_EDIT_UNDO_CONFLICT` if the current source diverged).
- Session API (proposed): `loadSnapshot`, `applyTransaction`, `inspect`, `undo`, `redo`,
  `isDirty`, `save({ expectedStoredRevision })`, `reopen`. Stale save/edit fails with
  `UI_DOC_STALE_REVISION`; no silent last-write-wins. File-writing agents pass the same
  validation and expected-revision boundary (CLI-shaped batch entry, no embedded
  coding-agent infrastructure).

### 6.2 Preview scenarios and fencing

```
UiScenario = {
  schema: 'vict.ui-scenario@1'
  scenarioId: string
  references: { application: { id, revision }, documents: { documentId: revision } }
  seeds: { domain: SeedSpec; random?: SeedSpec; clock?: ClockPolicy }
  actors: [ { actorId, role, permissions: readonly string[] } ]
  operations: [ { op: { capabilityId | dataOp }, implementation:
                 'simulated' | 'local' | 'external' | 'unavailable',
                 outcome: OutcomeSpec } ]        // coverage is declared per operation
  resetBoundary: 'session'                        // reset creates a NEW session identity
}
```

Execution mapping (exact existing boundaries; see RECONCILIATION §4):

- Capability operations dispatch through the existing runtime registry: doubles registered via
  `runtime.registerDouble(capabilityId, invoke, { modes })`; a run's effective doubles are the
  activation snapshot; a missing required double is a denial (`SCENARIO_COVERAGE_MISSING`
  surfaces it to the preview UI) — never a real-handler fallback.
- Data operations dispatch through a conforming `ApplicationDataAdapter` (registered
  implementations; shared `runApplicationDataAdapterSuite` conformance). Scenario denial or
  mutation failure leaves domain state unchanged and returns the adapter's structured error
  codes.
- Actions from the UI bridge via `ActionDispatcher` → declared application actions; correlation
  + pending + settled success/failure + affected-view refresh are required; late results from a
  replaced/reset session are ignored (`SESSION_STALE`).
- Reset: new session identity; seeds/adapter state/doubles/local UI state reset; caches
  invalidated; in-flight old results fenced. Scenario switches occur between sessions/runs;
  capability snapshots stay immutable within a run.
- Durable replacement proof: same action ID and compatible input/output contracts and
  unchanged UI source/binding digests; only the registered implementation/data adapter changes
  (a deliberately selected local durable session — explicitly not a simulator fallback). The
  proof must survive service restart and pass shared conformance; any required contract/UI
  change must be disclosed rather than falsified.

## 7. Diagnostic catalog (names, payloads, severity — frozen at U0)

Scope: this table freezes the NEW UI-foundation diagnostic classes. Existing VICT diagnostics
(application `APPLICATION_*`, release `RELEASE_*` — e.g. `RELEASE_APPLICATION_MISMATCH` cited
in §2.3, adapter `DATA_*`, renderer `RENDERER_*`, runtime effect denials) remain governed by
their owning modules and are intentionally not duplicated here; the preview layer maps onto
them as specified in §6.2.

Payload base: `{ code, message, severity }` plus the listed detail fields. Source paths and
IDs are always included where the table names them.

| Code | Severity | Detail fields | Class (CONTRACTS §10) |
| --- | --- | --- | --- |
| `UI_DOC_UNKNOWN_SCHEMA` | error | `schema, supported: string[]` | unsupported feature/version |
| `UI_DOC_DUPLICATE_NODE_ID` | error | `documentId, nodeId` | invalid tree |
| `UI_DOC_UNKNOWN_NODE` | error | `documentId, nodeId, missingChildId` | invalid tree (internal ordered reference) |
| `UI_DOC_CYCLE` | error | `documentId, path: string[]` | invalid tree/reference |
| `UI_DOC_REFERENCE_DANGLING` | error | `documentId, screenId?, reference` | invalid reference |
| `UI_DOC_REVISION_COLLISION` | error | `documentId, revision, digestA, digestB, authority: 'catalog' \| 'pin'` | invalid reference |
| `UI_DOC_UNKNOWN_COMPONENT` | error | `documentId, nodeId, definitionId` | invalid reference |
| `UI_DOC_UNKNOWN_PRODUCT_REFERENCE` | error | `documentId, nodeId, kind, ref` | invalid reference |
| `UI_DOC_UNKNOWN_ELEMENT` | error | `documentId, nodeId, tag` | invalid tree |
| `UI_DOC_UNKNOWN_ATTRIBUTE` | error | `documentId, nodeId, tag, attribute` | invalid tree |
| `UI_DOC_UNSUPPORTED_FEATURE` | warning | `documentId, nodeId?, feature` | unsupported feature/version |
| `UI_APP_PRESENTATION_MODE_INVALID` | error | `screenId, found: string[]` | invalid tree |
| `UI_EXPR_UNKNOWN_REFERENCE` | error | `documentId, nodeId, path` | invalid reference/type |
| `UI_EXPR_TYPE_MISMATCH` | error | `documentId, nodeId, expected, actual` | invalid type |
| `UI_EXPR_SCOPE_VIOLATION` | error | `documentId, nodeId, scope` | invalid type |
| `UI_STYLE_PROPERTY_UNSUPPORTED` | warning | `documentId, nodeId?, property` | unsupported feature |
| `UI_STYLE_CONDITION_UNKNOWN` | error | `documentId, conditionId` | invalid condition |
| `UI_EDIT_VALIDATION_FAILED` | error | `commandIndex, diagnostics: UiDiagnostic[]` | invalid tree |
| `UI_EDIT_REFERENCE_REMAINS` | error | `nodeId, remainingRefs: string[]` | invalid reference |
| `UI_EDIT_REQUEST_CONFLICT` | error | `requestId` | stale document/save |
| `UI_EDIT_UNDO_CONFLICT` | error | `expectedRevision, currentRevision` | stale document/save |
| `UI_DOC_STALE_REVISION` | error | `expectedRevision, storedRevision` | stale document/save |
| `EXTENSION_UNAVAILABLE` | error | `extensionId, revision?` | extension unavailable |
| `UI_OCCURRENCE_AMBIGUOUS` | error | `nodeId, candidates: string[]` | source occurrence ambiguous |
| `SCENARIO_COVERAGE_MISSING` | error | `op, implementation: 'unavailable'` | simulation unavailable |
| `OPERATION_DENIED` | error | `op, actor, reason` | denied operation |
| `DOMAIN_CONFLICT` | error | `op, expectedDomainRevision, actualDomainRevision` | domain conflict |
| `SESSION_STALE` | error | `sessionId, supersededBy` | async session stale |

## 8. Proposed public API surface (signatures — design drafts)

Neutral (`packages/ui`, zero dependencies):

```ts
validateUiDocument(document: UiDocument, catalogs: UiCatalogs): readonly UiDiagnostic[]
canonicalUiDocument(document: UiDocument): { bytes: string; contentDigest: string }
compileUiDocument(document: UiDocument, semanticCatalog: SemanticElementCatalog,
                  extensions: readonly UiExtensionDescriptor[]):
  { ok: true; plan: UiRenderPlan } | { ok: false; issues: readonly UiDiagnostic[] }
applyUiEdit(snapshot: UiDocumentSnapshot, transaction: UiEditTransaction):
  { ok: true; document: UiDocument; revision: string; requestId: string }
  | { ok: false; issues: readonly UiDiagnostic[] }
inspectUiOccurrence(occurrence: UiOccurrenceRef, source: UiDocument,
                    runtimeProjection: UiRuntimeProjection): UiOccurrenceReport
```

Authoring shape (`packages/sdk`): `APPLICATION_DEFINITION_SCHEMA_V3 = 'vict.application@3'`,
`ApplicationDefinitionV3`, `ScreenDefinitionV3` (+ `uiDocument` reference type) — preserving
the sdk → ui dependency direction.

Joint compilation (`packages/application`): `CompileApplicationInput` gains
`uiDocuments?/uiDocumentPins?/uiExtensions?`; `compileApplication` performs the §2.2 checks
and feeds document digests into `computeApplicationVersion` (`vict.application-identity@3`).
Names may be refined in U1 within these semantics; the public boundaries remain measurable.

## 9. Module, export and dependency plan (U0-06)

| Directory (exact) | Role | May depend on |
| --- | --- | --- |
| `packages/ui` | Neutral document/style/expression/edit/source-map/plan types, validation, canonicalization, compiler | contracts only (nothing today) |
| `packages/ui-svelte` | General document renderer (render-plan consumer), accessible primitives, declared extension metadata | application, sdk, ui, svelte |
| `packages/sdk` | @3 authoring shape, application authoring types | contracts, ui |
| `packages/application` | Joint compilation, application identity, release checks, data adapter + conformance | contracts, sdk, ui |
| `packages/ui-editor` (new; name frozen here) | Editor session core + canvas/layers/inspector/history modules (Svelte at the boundary) | ui, ui-svelte, application (types) |
| `packages/ui-preview` (new; name frozen here) | Scenario orchestration, session/reset fencing around runtime + adapter boundaries | application, runtime, sdk, ui |
| `examples/ui-authoring-proof` (new) | Native reference host + fictional inspection consumer | built exports of the packages above |
| `examples/ui-design-proof` (new) | Contrasting page + Studio-style composition consumers | built exports |

Rules: the graph stays acyclic (never ui → sdk/application/runtime/DOM/Svelte). Consumers use
public exports and built artifacts — source aliases or deep imports do not count as reuse
(U4-01). Editor/preview modules and scenario infrastructure stay out of the normal application
entry graph (A-04): the normal app imports only the renderer and its declared primitives;
measured bundle bytes and package versions are reported rather than universal size claims.
Package manifests stay at the existing `0.4.0-rc.1` source version line; publication is out of
scope for the whole U-track.

Build strategy: follow the existing per-package workspace build (`npm run build -w
@victframework/<name>`); new packages join the root build chain after `ui-svelte` ordering
requirements are respected; examples consume built outputs (matching the existing
`examples/ui-showcase` pattern used by `test:foundation`).

## 10. Coverage matrix template and fixtures

Coverage matrix (CONTRACTS §10) columns: modeled / validated / compiled / rendered / visually
editable / independently verified. U0 state: rows are **modeled only** (this page + fixtures);
all other columns are NOT DEMONSTRATED and must not be claimed by vocabulary. U1 implements
its slice per [STAGES-AND-VERIFICATION](STAGES-AND-VERIFICATION.md) §3.

Representative fixtures (installed under `fixtures/`, JSON, prettier-clean):

| Fixture | Demonstrates |
| --- | --- |
| `ui-document-valid.json` | Minimal valid document: elements, text, a component instance, repeat, conditional, token, condition, binding, interaction |
| `ui-document-invalid-dangling-component.json` | `UI_DOC_UNKNOWN_COMPONENT` negative |
| `ui-document-invalid-dangling-child.json` | `UI_DOC_UNKNOWN_NODE` negative (internal child reference); `UI_DOC_DUPLICATE_NODE_ID` is a parsed-model rule whose negative cannot be expressed in a JSON object fixture and is exercised in U1 at model level |
| `application-v3-valid.json` | @3 application: one document-mode screen + one legacy screen, document supplied via the explicit catalog (pins are an optional input and omitted here) |
| `application-v3-invalid-mixed-presentation.json` | `UI_APP_PRESENTATION_MODE_INVALID` negative |
| `ui-edit-transaction-valid.json` | Ordered multi-command transaction with expected revision |
| `ui-edit-transaction-invalid-stale.json` | `UI_DOC_STALE_REVISION` negative |
| `ui-scenario-valid.json` | Inspection approval scenario with per-operation coverage |
| `ui-scenario-invalid-missing-coverage.json` | `SCENARIO_COVERAGE_MISSING` negative |
| `application-v3-catalog-collision.json` | two competing catalog entries for the same `(documentId, revision)` with different digests → `UI_DOC_REVISION_COLLISION` |

These fixtures are contract examples for review — they are not executed in U0 and are not
fabricated compile/execution evidence (STAGES §2).
