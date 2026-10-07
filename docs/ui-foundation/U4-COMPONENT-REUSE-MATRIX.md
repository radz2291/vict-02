# U4 component reuse matrix (2026-10-07, amended preparation phase)

**Amendment context.** The owner requires catalog components to be
canonically authorable ([U4-COMPONENT-AMENDMENT](U4-COMPONENT-AMENDMENT.md)).
This matrix records today's source truth AND, in section 5, the support
level of each contract the amendment introduces. Today, every
amendment-specific piece is **C** (contract-only); nothing in section 5 may
be reported as existing until U4 implements and tests it.

**Method and honesty legend.** This matrix was produced by read-only source
inspection of `codex/ui-foundation-u4-handoff` at the U3 closure records
(`16df3bf…`, implementation content of the verified `952d92d…`), cross-cited
against recorded test suites and the U2/U3 verification records. A claim of
the form "tested by `<file>`" means **the recorded suite asserts it** — the
preparation phase ran no new runtime proof. "Unverified at runtime" means the
code path exists and is reasonable but no recorded test asserts it; U4 must
reproduce it. Source inspection alone must never be reported as a U4 reuse
PASS.

Support levels used:

- **A — recorded-test-backed**: a committed automated test asserts the claim.
- **B — source-backed, runtime-unverified**: the code path is complete on
  inspection; U4 must demonstrate it.
- **C — gap**: not expressible today; see the design document's amendment
  section.

---

## 1. The package surface (what exists)

| Package | Consumable as | Build state | Key exports (public) |
| --- | --- | --- | --- |
| `@victframework/ui` | dist (`files: ["dist"]`) | builds clean (root build) | document model (`UiDocument`, `vict.ui-document@1`), expressions, compiler (`compile` → `vict.ui-render-plan@1`), edit ops (`applyUiEdit`, `UiEditCommand*`), diagnostics, scenario |
| `@victframework/ui-svelte` | **source exports** (`exports` → `./src/*`, `files` includes `src`) | n/a (source); `svelte-check` 0/2 retained warnings | **public root exports** (src/index.ts): DocumentHost, DocumentRenderNode, renderVictApplication, createVictRenderer, Button, ActionFeedback, Feedback, Select, AppShell, Tabs, Form, FormField, Overlay, Popover, Tooltip, RecordsTable, Text, StatusBadge, DataView, List, Detail, Chart, Conversation, Count, ComponentSlot, VitApp + registry/diagnostic types; `ControlScope` is public via the `./controls` subpath export. **Internal (not exported)**: ActionButton, FormSurface, OverlaySurface, form-values, document/ internals. `catalog/*` sub-exports: **38 recipe modules** re-exporting bits-ui parts (catalog-coverage.json records **41 families**: 30 "styled and usable", 8 "supported direct composition", 3 "deferred"). Styles: `styles.css`/`catalog.css`. Extension bridge types + resolver |
| `@victframework/ui-editor` | **source-only today**: `files: ["src"]`, exports → `./src/index.ts`; build script is `tsc -p tsconfig.json` with `noEmit: true` (typecheck-only — emits nothing) and **currently FAILS** that typecheck with four TS2307 Svelte-declaration errors (accepted U2 F3, re-confirmed in U3 records V-F2) | ❌ | (source) `EditorCanvas` (extension forwarding), `Inspector` (Content/Style/Behavior; `connectInteraction` authoring), `Layers`, `HistoryPanel`, `commands`, `bridge` |
| `@victframework/ui-preview` | dist | builds clean | preview session orchestration, `PreviewDataAdapterPort` (U3) |
| `@victframework/application` | dist | builds clean | `createComponentRegistry` (versioned trusted-component registry), application compiler, `runApplicationDataAdapterSuite` |
| `@victframework/sdk` | dist | builds clean | `defineApplication` / `defineContract` / `defineResource` (framework-neutral definitions) |

Notes: `ui-svelte` legitimately ships Svelte source inside the package and
consumes it through its public `exports` map — for U4 this is acceptable
package content, provided `npm pack` includes `src` and the declared
dependencies (`bits-ui`, `@internationalized/date`, workspace packages,
`peerDependencies.svelte`). Packed-artifact completeness is a U4-01 check,
not an assumption.

## 2. The five integration patterns (grouped by equivalent mechanics)

### P1 — direct Svelte consumption (native app, no document)

Import any built-in component or catalog recipe in a plain Svelte app; style
via `ControlScope` + `catalog.css` / `styles.css`.

- **Usable directly**: A — `catalog.test.ts` (41-family coverage file
  `catalog-coverage.json`: 30 "styled and usable", 8 "supported direct
  composition", 3 "deferred"; verified by `scripts/verify-ui-catalog.mjs` and
  the `examples/ui-showcase` catalog pages).
- **Edited/persisted**: not a document — nothing to persist unless the app
  does it. Out of VICT authorship.
- **Value/event connections**: plain Svelte props/callbacks. Recorded:
  checkbox/switch independent binding, toggle groups, date segments
  (`catalog.test.ts`).
- **Caveat**: `catalog/*` files are re-exports of `bits-ui` parts (e.g.
  `catalog/button.ts`, `catalog/checkbox.ts`, `catalog/select.ts`,
  `catalog/dialog.ts`); they are headless — VICT styling comes from
  `ControlScope`/`catalog.css`, not from the recipe itself. Dialog-family
  portals render to the **ControlScope root** (`BitsConfig defaultPortalTo`),
  keeping product tokens and catalog styling with the controls — not to
  `document.body`.

### P2 — document element route (authored native elements)

`vict.ui-document@1` element nodes (`svelte:element` in `RenderNode`) with
declared interactions: `click → invokeAction | navigate`,
`change → setState`, `submit → invokeAction`. `handleChange` natively handles
checkbox `checked`, number coercion, string values.

- **Resolvable from documents**: A — document renderer tests
  (`document-renderer.test.ts`, `renderer.test.ts`); used by the U3 product
  documents (`examples/ui-authoring-proof/src/lib/product/documents.ts`
  authors forms with `change → setState` and `submit → invokeAction`).
- **Editable/persistable**: A — `edit.ts` ops (`setProperty`, `setAttribute`,
  `setStyleDeclaration`, `bindExpression`, `connectInteraction`); the
  ui-editor Inspector authors them (Behavior tab "Connect action",
  `Inspector.svelte:202`; navigate wiring at :92–104).
- **Value connections**: A/B — change→setState with checkbox/number handling
  implemented in `RenderNode.handleChange` (B for checkbox specifically:
  implemented and exercised in product forms, no dedicated renderer test
  asserts checkbox `checked` → state; U4 must show it).
- **This route is plain HTML** — a native `<input type="checkbox">` or
  `<select>` in a document is NOT the catalog (bits-ui) component. Catalog
  reuse in an authored surface requires P3/P4.

### P3 — registered components (trusted local code islands in a VICT application)

The application declares components + actions (SDK definition → compiled
plan); a versioned registry (`createComponentRegistry`, exact
`componentId` + `revision`) supplies Svelte implementations; declared
components mount inside `ComponentSlot`; `useVictActions().run(actionId,
input)` reaches the host dispatcher **only for actions declared by the
application** (undeclared → `NO_DISPATCHER`-style refusal before any
dispatch), with `onInvalidate` after success.

- **Usable + connected**: A — `catalog.test.ts` "registered component action
  bridge": dispatches declared actions through the host and invalidates on
  success; rejects undeclared actions without reaching the dispatcher.
  Existing consumers: `examples/application-proof`,
  `examples/reference-app` (registry pattern), ui-showcase agent surfaces.
- **Editable/persistable**: the **declaration** (componentId, revision,
  actions, contracts) is canonical and persistable; component internals stay
  code (opaque by design — declared, not authored).
- **Historical recommendation, superseded for the required proof**: this
  route remains a legitimate integration route and a labelled comparison
  example, but the owner requires document-authored catalog components
  (amendment route, section 5) -- value state and wiring in Svelte code do
  not satisfy the authoring requirement.

### P4 — document extension bridge (props-only)

Document component-instances whose `definitionId` matches an
`UiExtensionDescriptor` compile to `extension` instructions; registered
implementations (`extensionId` + `revision` + `rendererImplementationId`
exact match) render with evaluated props; missing/mismatched →
`EXTENSION_UNAVAILABLE` (compile) / `UI_RENDER_EXTENSION_UNAVAILABLE`
(render, visible safe placeholder); descriptors declaring events/slots →
`UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`.

- **Resolvable from documents**: A — `document-extensions.test.ts`
  (registration matching, diagnostics), U3 combined verifier's forgery
  matrix, and the U3 product's four extensions (`ext.button`,
  `ext.status`, `ext.feedback`, `ext.evidenceViewer`).
- **Editable/persistable**: descriptor identities + evaluated props are
  serialized document data. Whether the Inspector UI surfaces extension-prop
  editing: **B/unverified** — the edit op `bindExpression {kind:'prop'}`
  exists, but no recorded test shows Inspector editing of an extension prop.
- **Value/event connections**: **C — gap.** The bridge is props-only
  (deliberate; frozen in the experience handoff). A registered extension
  receives `props` + occurrence identity and has **no contract to report
  value changes or events back** into document state or actions.
  Consequence (do NOT assume otherwise): rendering a catalog Checkbox as an
  extension does NOT connect its `checked` value to authored state. Values
  and actions need P2 (document elements) or P3 (registered components).
  The amendment (section 5 below) closes this gap; the earlier sketch is
  withdrawn.

### P5 — editor + preview embedding

`@victframework/ui-editor` canvas/inspector/layers operate on a document
snapshot via edit ops + commands; `EditorCanvas` forwards
`extensionDescriptors`/`extensionImplementations`/`stateValues` (U3).
`@victframework/ui-preview` orchestrates preview sessions incl. the
`PreviewDataAdapterPort`.

- **Usable**: A for the workbench surfaces (U2 records + walkthrough), A for
  preview orchestration (U3 records).
- **Blocker**: ui-editor **dist build fails (F3)** — built-artifact reuse of
  the editor is impossible until repaired (U4-01/U4-02 obligation). Source
  exports exist (`files: ["src"]`, exports → `./src/index.ts`) but the
  packaging criterion requires recorded built contents; repair is in-scope
  U4 package maintenance, not a contract change.

## 3. Per-component status for the required U4 proofs

| Required proof | Existing implementation | Route today | Authored route (amendment) | Status today | Evidence / gap |
| --- | --- | --- | --- | --- | --- |
| Button with declared action, disabled/loading/feedback | `Button.svelte` (variant/type/disabled/onclick, data-action-* test hooks); **`ActionButton.svelte`** adds pending ("Working…", `aria-busy`, disabled-while-pending), declared-outcome feedback (`actionFeedback`, validated by `feedback.ts`), focus restore | P2 (document button + `click/submit → invokeAction`) or P3 (`ActionButton` inside ComponentSlot) | authored `vict.catalog.button`: `press`→invokeAction, `loading`←state | A/B comparison routes; **C** authored | A: action bridge tests; ActionButton pending/feedback unit-covered in renderer suites. B: exact disabled/loading/feedback choreography inside the U4 consumer must be reproduced at runtime |
| Catalog Checkbox with checked-value binding + submission | `catalog/checkbox.ts` (bits-ui Checkbox; VICT styling via ControlScope) | **P3** for catalog identity (value = app state; submission via declared action); P2 only gives a native-input checkbox (not the catalog component) | authored `vict.catalog.checkbox`: `checked`←state, `checkedChange`→setState, distinct keys per instance | A (binding, native app) / B (submission wiring); **C** authored | A: "keeps checkbox and immediate switch values independently bound" (`catalog.test.ts:29`). B: checked → declared submit action inside one registered surface — no recorded test; U4 must demonstrate |
| Sidebar/AppShell composition, navigation, active selection, responsive | `AppShell.svelte` (brand/title/path/groups/breadcrumbs, `UiApplicationComposition`), responsive nav via `matchMedia` (720/960 breakpoints, mobile drawer) | P1 (native shell) or P3 (registered); composition data is declarative (`composition.ts`) | authored `vict.catalog.appshell` with content slot fill; nav/active/responsive from existing composition semantics | A/B; **C** slot fill on the registered path | A: `navigation-group-order.test.ts`, shell suites in renderer tests. B: responsive drawer + active selection in the U4 consumer at 1440/1024/390 |
| Rich Select or Dialog (value change / focus / portal) | `Select.svelte` (native select: value/options/invalid/describedBy/onChange); catalog `Select` + `Dialog`/`AlertDialog` (bits-ui: focus/portal/ARIA) | Select: P2 (document `change → setState`) or P1/P3. Dialog: **P1/P3 only** — document `portal` node + Overlay exist but portal+focus behavior with catalog Dialog is P3 territory | authored `vict.catalog.select` (`options`←array view-field, `valueChange`→setState) and `vict.catalog.dialog` (`open` loop, body slot fill, portal to ControlScope root) | A (catalog select/dialog styled+usable; select native component tested) / B (portal+focus); **C** authored | A: catalog coverage file marks Select/Dialog/AlertDialog "styled and usable" with showcase examples. B: focus-trap/portal behavior wired to a declared action — U4 runtime proof |

## 4. Explicit non-claims

- No family is "fully supported" merely because an export exists: `catalog/*`
  recipes are headless re-exports; styling scope (`ControlScope`,
  `catalog.css`) is part of the integration and must be mounted.
- The document renderer resolves **document definitions and registered
  extensions**, not arbitrary npm components; there is no "any-Svelte-component-in-a-document" route today.
- Extension props Inspector-editing: unverified (§P4).
- Document-side portal (`kind:'portal'`) + Overlay components: source-present,
  recorded tests exist for overlay surfaces (`surface-p4.test.ts`), but a
  catalog-Dialog-through-document-portal composition is **not** an existing
  pattern — do not assume it.
- Editor dist reuse: blocked by F3 until repaired.
- All of the above is source/record evidence; **U4 runtime reproduction is
  the only reuse PASS**.

## 5. Amended authoring route — contract support levels (all C today)

[U4-COMPONENT-AMENDMENT](U4-COMPONENT-AMENDMENT.md) specifies the
document-authored catalog route. Every piece below is **C — contract
only; no implementation exists**. The amendment and its fixtures define the
shape; U4 implements and records evidence before any of this may be
claimed:

| Contract piece | Package | Status |
| --- | --- | --- |
| Compatibility gate: ABI marker declared in descriptor `events` (legacy rejection probe-verified on the exact `952d92d…` resolver bytes — original `abi`-field-only claim falsified and replaced); compile-artifact marker (`outputDecls` always emitted for abi@1 descriptors); implementation `abi` match | ui + ui-svelte | legacy half: VERIFIED (resolver-level probe, `abi-compat-probe.json`); new-side checks: C |
| `UiOutputDecl` / `UiOutputBinding`; descriptor `outputs`/`abi`; additive plan fields (`outputDecls`, `outputBindings`, instance-scope `slots`) | ui | C (types documented in the amendment; not in source) |
| Validator/compile rules: declared-output resolution, payload typing, `$output` scoping, state/action target checks; diagnostics `UI_COMPONENT_OUTPUT_UNKNOWN`, `UI_COMPONENT_OUTPUT_PAYLOAD_INVALID`, `UI_COMPONENT_BINDING_INCOMPATIBLE`, `UI_COMPONENT_SLOT_REQUIRED` | ui | C |
| Instance revision-pin resolution: compiled instruction carries the effective revision; descriptor resolves by (id, effective revision) fail-closed; `UI_COMPONENT_REVISION_UNRESOLVED` (today the extension path echoes the descriptor revision and resolves id-keyed last-wins) | ui | C |
| Descriptor-instance prop checking: literal + reference typing against `propDecls` (today literal checks run only for stored definitions); array-typed props reference-only; `UI_EXPR_TYPE_MISMATCH` extended scope | ui | C |
| Undeclared-slot-fill rejection for descriptor instances (today silently dropped; `UI_DOC_UNKNOWN_COMPONENT` compile-raised) + action-input catalog derived from declared contracts for typed output checks (exact integration: `compileUiDocument` catalogs option `actionInputs`, derived + passed at `packages/application/src/ui-attach.ts`; in the later U4 allowed scope) | ui + application | C |
| `setOutputBinding` edit op | ui | C |
| Svelte bridge: `UiSvelteComponentImplementation` (+`abi` gate, `slots` capability, `io.emit`, slot snippets), generation-gated stale-drop, rejected-emit handling | ui-svelte | C |
| Catalog wrappers: button / checkbox / select / dialog / app-shell adapting public components | ui-svelte | C |
| Inspector: descriptor-driven property editors; Behavior-tab output-connection editor (type-filtered state picker, action picker, `$output` mapping) | ui-editor | C |
| Render diagnostics `UI_COMPONENT_UNAVAILABLE`, `UI_COMPONENT_ABI_UNSUPPORTED`, `UI_COMPONENT_SLOT_UNAVAILABLE`; stale `UI_COMPONENT_OUTPUT_STALE` | ui-svelte | C |

Existing mechanisms the amended route builds on (verified this cycle):
typed instance props with declaration closure (`UI_DOC_UNKNOWN_PROP`) plus
literal type checks (`UI_EXPR_TYPE_MISMATCH`); instance `slots` fills
resolved in the instance scope for stored definitions; occurrence identity
(`UiOccurrenceRef`); exact-identity implementation resolution (fail-closed);
canonical digests (`canonicalUiDocument`) folding into
`computeApplicationVersion`; property-based document validation that
tolerates additive optional fields (the schema guard
`UI_DOC_UNKNOWN_SCHEMA` rejects any schema-string change — hence additive
fields inside `vict.ui-document@1`, no version bump); `UiEditSession`
transactions/undo/redo/two-phase save; composition semantics for shell
navigation (`UiApplicationComposition`, renderer-resolved
`UiShellLink.current`).
