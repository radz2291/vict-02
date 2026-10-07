# U4 component reuse matrix (2026-07-10, preparation phase)

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
| `@victframework/ui-svelte` | **source exports** (`exports` → `./src/*`, `files` includes `src`) | n/a (source); `svelte-check` 0/2 retained warnings | `DocumentHost`, `RenderNode` (via document/), `renderVictApplication` (generic app host), built-in components (Button, ActionButton, ActionFeedback, Select, AppShell, Tabs, FormField, FormSurface, RecordsTable, Text, StatusBadge, Overlay/OverlaySurface, Popover, Tooltip, …), `ComponentSlot` + `useVictActions`, `catalog/*` (41 bits-ui recipes), `ControlScope`, `styles.css`/`catalog.css`, extension bridge types + resolver, `form-values` |
| `@victframework/ui-editor` | dist declared; **build FAILS** — four TS2307 Svelte-declaration errors (accepted U2 F3, re-confirmed in U3 records V-F2) | ❌ | (source) `EditorCanvas` (extension forwarding), `Inspector` (Content/Style/Behavior; `connectInteraction` authoring), `Layers`, `HistoryPanel`, `commands`, `bridge` |
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
  `ControlScope`/`catalog.css`, not from the recipe itself.

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
- **This is the recommended route for catalog (bits-ui) components inside an
  authored application**: value state lives in the component/app (Svelte
  state), actions dispatch through the declared boundary. See the design
  document.

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
  Scoped amendment proposal: design document §5.

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

| Required proof | Existing implementation | Route | Status | Evidence / gap |
| --- | --- | --- | --- | --- |
| Button with declared action, disabled/loading/feedback | `Button.svelte` (variant/type/disabled/onclick, data-action-* test hooks); **`ActionButton.svelte`** adds pending ("Working…", `aria-busy`, disabled-while-pending), declared-outcome feedback (`actionFeedback`, validated by `feedback.ts`), focus restore | P2 (document button + `click/submit → invokeAction`) or P3 (`ActionButton` inside ComponentSlot) | A/B | A: action bridge tests; ActionButton pending/feedback unit-covered in renderer suites. B: exact disabled/loading/feedback choreography inside the U4 consumer must be reproduced at runtime |
| Catalog Checkbox with checked-value binding + submission | `catalog/checkbox.ts` (bits-ui Checkbox; VICT styling via ControlScope) | **P3** for catalog identity (value = app state; submission via declared action); P2 only gives a native-input checkbox (not the catalog component) | A (binding, native app) / B (submission wiring) | A: "keeps checkbox and immediate switch values independently bound" (`catalog.test.ts:29`). B: checked → declared submit action inside one registered surface — no recorded test; U4 must demonstrate |
| Sidebar/AppShell composition, navigation, active selection, responsive | `AppShell.svelte` (brand/title/path/groups/breadcrumbs, `UiApplicationComposition`), responsive nav via `matchMedia` (720/960 breakpoints, mobile drawer) | P1 (native shell) or P3 (registered); composition data is declarative (`composition.ts`) | A/B | A: `navigation-group-order.test.ts`, shell suites in renderer tests. B: responsive drawer + active selection in the U4 consumer at 1440/1024/390 |
| Rich Select or Dialog (value change / focus / portal) | `Select.svelte` (native select: value/options/invalid/describedBy/onChange); catalog `Select` + `Dialog`/`AlertDialog` (bits-ui: focus/portal/ARIA) | Select: P2 (document `change → setState`) or P1/P3. Dialog: **P1/P3 only** — document `portal` node + Overlay exist but portal+focus behavior with catalog Dialog is P3 territory | A (catalog select/dialog styled+usable; select native component tested) / B (portal+focus in authored surface) | A: catalog coverage file marks Select/Dialog/AlertDialog "styled and usable" with showcase examples. B: focus-trap/portal behavior wired to a declared action — U4 runtime proof |

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
