# Foundation contracts — U0 design candidate

Status: Proposed contracts to be locally reconciled, independently reviewed and frozen in U0.
All schema names and APIs below are design targets, not existing exports.
These specifications deliberately establish semantics before implementation syntax.

## 1. Canonical application attachment

Baseline SDK accepts vict.application@1 and vict.application@2. Its compiler rejects unknown fields and supports versioned identity. Release compilation checks the computed applicationVersion. The new UI source cannot be attached through an ignored ad-hoc property.

Default amendment:

- Introduce a versioned vict.application@3 authoring shape and matching vict.application-identity@3 marker after verifying these names are unused locally.
- Each @3 screen declares exactly one authored presentation mode: a legacy region layout or a uiDocument reference. Mixed simultaneous roots are invalid.
- A uiDocument reference contains documentId and revision; resolved content is supplied as explicit compile input, not fetched implicitly from a process-global registry.
- compileApplication receives a UI document catalog and extension metadata catalog. It validates document closure and its product references, then computes identity from canonical authored data and resolved dependency digests.
- UI document files can be independently edited, but no dangling, mismatched revision or cycle is accepted. Unknown schema versions fail with source-linked diagnostics.
- New identity semantics are versioned. Existing @1/@2 acceptance and identity bytes are not silently changed.
- Release identity continues to bind the compiled applicationVersion, renderer and adapter. Change release schema only if the local inventory demonstrates a need; do not add a redundant second UI identity authority.

This is an additive opt-in authoring version, not a migration requirement for existing consumers. APP-019 is amended in the current system reference only by the later explicitly scoped integration work; the U0 decision record explains how its “same canonical Application Definition” rule is satisfied.

Identity excludes editor selection, zoom, transient history, DOM handles, compiled CSS and scenario seeds. It includes semantic tree order, styles/conditions, component source dependencies, binding/action references and authored asset digests where those assets are part of the source bundle. Code extension internals retain the existing explicit component revision boundary; do not claim their source code is automatically hashed.

Canonicalization treats ordered child/rule/action sequences as ordered and registries as keyed sets. Competing explicit catalog entries, or a document compared with an explicitly supplied immutable pin, for the same (documentId, revision) must have equal content digests; otherwise compilation rejects the collision. A pure compiler given one current document and no prior pin cannot infer a historical collision. Authoring save/session boundaries explicitly advance revisions and enforce expected stored revisions; any historical artifact pin is supplied by the consumer, not read from hidden global state. Identity tests must show changed UI source changes applicationVersion and an old frozen release no longer matches.

## 2. UI document

Schema candidate: vict.ui-document@1.

| Field | Meaning |
| --- | --- |
| schema, id, revision | Explicit document identity |
| root | Stable root node ID |
| nodes | Registry of discriminated node records |
| componentDefinitions | Reusable visual definitions with roots, props, slots and variants |
| styleSources, tokens, conditions | Authored presentation data with stable IDs |
| assets | Explicit asset identities/digests or registered external references |
| localState | Typed local presentation state with serializable defaults |

Node kinds: element, text, component, slot, repeat, conditional, portal. Component references distinguish visual definitions from registered code extensions.

An element stores its semantic browser tag, compatible attributes and ordered children. Text stores literal or expression content. Repeat stores collection expression, stable key expression, lexical item name and template root. Conditional stores predicate and branch roots. Portal stores logical child ownership and a declared overlay/portal target. Component stores ID/revision, typed prop expressions, variant and named slot fillings.

Validate unique IDs, reachable ownership, ordered references, acyclic containment and component dependency closure. A definition is stored once and can have many occurrences. A node does not acquire multiple source parents merely because a component is instantiated twice. Detached inactive conditional branches and slot defaults remain valid authored source.

Semantic element/attribute checks use an extensible registered web-element metadata boundary. Do not equate model breadth with silently rendering unsupported element behavior. No raw embedded JavaScript or arbitrary event-attribute execution is introduced.

## 3. Presentation and conditions

A CSS declaration has a property name and a value. Values support validated CSS text, token/custom-property references and typed presentation bindings where explicitly supported. Common ergonomic controls use the same declaration representation as the advanced editor. Unknown-but-valid browser properties are not prohibited solely because no preset control exists; unsupported compiler/renderer features are diagnosed.

CSS values are browser presentation data, not JavaScript expressions. Asset URL handling follows the consumer's explicit asset policy.

Named conditions represent media/environment queries, container conditions, local UI-state conditions and component variants. Pseudo states include hover/focus/active/disabled as supported by the element/primitive. Condition identity and authoring order are persisted. No hard-coded mobile/tablet/desktop-only schema is allowed.

Freeze a deterministic cascade contract in U0: token defaults → component base → component variant → attached reusable style sources → instance-local style sources. Within a layer, declaration order and condition rule order are explicit. Normalize selector specificity for generated rules; any advanced selector extension must document how it participates. Browser cascade, inherited values and CSS variables remain visible through inspection rather than falsely described as authored scalar values.

Inspector output distinguishes authored declaration, active condition, origin/layer, inherited/token value and browser-computed value. A computed measurement is diagnostic data; it never silently rewrites source.

Responsive editing records changes in the chosen condition. Reparenting is structural and applies to the document, unless an explicitly supported conditional branch represents a different hierarchy. Changing CSS order is not semantic DOM reordering; keyboard order follows the actual accessible structure.

Dragging in flow/flex/grid modifies ordering, constraints or an explicit layout property. Positioned elements use deliberate positioning controls. Do not infer arbitrary responsive layout from pixels without exposing the resulting source changes.

## 4. Components and extensions

Visual definition: ID/revision, root, typed props with defaults, named slots with requirements/defaults, variants and local presentation behavior. Instance prop/slot overrides remain source data. Detachment creates an explicit authored copy; it must not silently remove required accessible primitive behavior.

Registered extension: ID/revision; prop schema; named slots/events; compatible data requirements; optional named style targets; renderer implementation identity; editor representation; declared inspection limits. Renderer code is registered outside serialized source. It cannot silently introduce undeclared domain operations.

Both kinds accept bindings through their declared property/event contracts. Extension events map to declared interaction sequences, never an opaque hidden action engine.

## 5. Expressions and product bindings

Use a finite declarative expression tree: literal, reference/path, comparison, Boolean composition, conditional value and registered pure formatting/operation. No eval, Function constructor or embedded arbitrary JavaScript. Pure operation registrations declare type signatures and versions.

Reference namespaces: view/record, repeat item, component prop, local presentation state and tokens. Product references carry existing IDs/revisions. Validate available fields, expected types and lexical scopes before rendering; ambiguous/missing references have source-linked diagnostics.

Views are resolved through application data adapters. UI local state cannot write domain state directly. Repeated record keys must be stable and unique within the rendered scope. Missing/duplicate keys are diagnostics and cannot alias editable occurrences.

Data queries retain projection, authorization/effect context and existing contract checks. Cache/invalidation policy is explicit at the runtime adapter boundary; an editor display cannot invent an authorization grant.

## 6. Interaction contract

An event maps to an ordered sequence of typed operations: invoke declared application action, navigate declared route, set local state, open/close declared overlay, submit validated form.

Application action dispatch is the bridge to declared capabilities or data mutations. It uses existing dispatch/authorization/execution machinery. UI event schema does not duplicate domain contracts. U0 fixes the exact adapter interface for the available baseline.

Every async action exposes correlation, pending, settled success/failure and affected-view refresh. Prevent duplicate submit while pending where appropriate. Ignore late results belonging to a replaced/reset preview session. Scenario denial or mutation failure leaves domain state unchanged and presents an actionable error.

Where a product operation requires optimistic concurrency, its input/contract carries an expected domain revision. Do not pretend document revision fencing protects domain state.

Forms use actual contract validation and field mappings. Keyboard submission/focus/error association and overlay return-focus behavior are required on the proof journeys.

## 7. Compilation and source mapping

Proposed neutral API responsibilities:

| Operation | Required behavior |
| --- | --- |
| validateUiDocument(document, catalogs) | Joint structural/style/expression reference diagnostics; no runtime effects |
| compileUiDocument(document, semanticCatalog, extensions) | Resolved render instructions/CSS, retained dynamic operations, dependency closure and source mappings |
| canonicalUiDocument(document) | Deterministic source bytes independent of object insertion order where order is non-semantic |
| applyUiEdit(snapshot, transaction) | Atomic validated source mutation with revision check |
| inspectUiOccurrence(occurrence, source, runtimeProjection) | Explain definition/instance/record/style/binding origin without treating DOM coordinates as authority |

Names may be refined in U0, but semantics and public boundaries remain measurable.

Render plan schema candidate: vict.ui-render-plan@1. It contains source version/diagnostics, structural instructions, style rules, dynamic binding/repeat/condition instructions, extension references and source-map descriptors. Compiled artifacts may resolve component dependencies but must preserve occurrence provenance.

Occurrence identity: documentId + sourceNodeId + component-instance path + repeat-record-key path. Logical portal ownership stays in that identity. DOM annotations/handles are renderer implementation details and never persisted as application source.

## 8. Edit/session protocol

Schema candidate: vict.ui-edit@1. Transaction: requestId, expectedDocumentRevision, ordered commands and optional human-safe reason.

Commands: insert, move, remove, set property/attribute, change style/condition, bind, connect interaction, create/update component, fill slot. Destructive remove also validates remaining references.

Atomicity: apply all commands and validate resulting source; reject the entire transaction on conflict or invalid source. No partial document mutation. Same requestId and payload reconciles to the recorded result; same requestId with different payload is a conflict inside the session's declared identity scope.

Undo/redo uses inverse/source snapshots internally and revalidates against current revisions. Revision advances on accepted changes, including undo/redo; restoring old source content does not rewind the monotonic session revision. Content digests may return to an earlier value.

Session API: load snapshot, apply transaction, inspect, undo/redo, dirty state, save with expected stored revision, reopen. Stale save/edit fails clearly; no silent last-write-wins. Stable node/component IDs survive round trip.

File-writing agents pass the same schema/semantic validation and expected-revision save boundary as visual edits. A CLI/equivalent interface documents batch editing and diagnostics. Embedded coding-agent infrastructure is unnecessary.

## 9. Product-preview session

Schema candidate: vict.ui-scenario@1. Scenario references compatible application/UI source versions, seeds, actor/permissions, operation implementations, declared outcomes and deterministic clock/random policy where used.

Implementation coverage per operation: simulated, locally implemented, externally implemented, unavailable. Presentation-only values are distinguished from product data.

Preview capability dispatch uses existing registered simulation doubles and run snapshots. Data simulation uses a conforming ApplicationDataAdapter. Missing coverage fails; it never silently calls production effects. The proof's locally durable implementation runs in a deliberately selected local proof session; it is not a simulator fallback.

Reset creates a new session identity, resets seeds/adapter state/doubles and local UI state, invalidates caches and prevents in-flight old results from updating the new session. Capability snapshots remain immutable within runs; scenario switches occur between sessions/runs.

A successful approval changes persisted preview domain status, decision/activity and dependent views. Failure/denial/conflict must leave state unchanged. Fixed fixtures must not bypass the actual action/data path.

Durable replacement proof chooses the same decision contract/action ID/input/output schemas and UI source. It changes only the registered compatible implementation/data adapter as documented. Prove survival across service restart and shared conformance checks. If real constraints require contract/UI changes, disclose them; do not falsify the unchanged-UI proof.

## 10. Contract diagnostics and coverage

U0 freezes diagnostic names, payloads and severity; source paths and IDs are always available. Required classes: invalid tree/reference/type/style/condition, unsupported feature/version, extension unavailable, source occurrence ambiguous, stale document/save, simulation unavailable, denied operation, domain conflict and async session stale.

A coverage matrix records separately whether each capability is modeled, validated, compiled, rendered, visually editable and independently verified. A broad schema is not evidence of full rendering/editor support.

U0 emits representative valid/invalid source fixtures and an API/identity specification. U1 implements the smallest complete slice of these contracts; later rows are not marked done by vocabulary alone.
