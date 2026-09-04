# Stage 05 — Application Delivery

> **Authority:** `docs/VICT-SYSTEM-REFERENCE.md` v0.2.3 (Stage 05 implements
> the Application delivery layer defined in §17 and stage-gated in §23;
> OPEN-013 and OPEN-014 are decided here through evidence).
> **Scope:** the canonical SvelteKit renderer and generic application host,
> the one-time application-host scaffolder, the complete neutral surface
> vocabulary (`vict.application@2`), the theme/design-token system, the
> versioned Svelte custom-component registry model, the production SQLite
> application-domain adapter with its separate migration API, safe generated
> CRUD, and the complete reference application proof of §17.10.
> **Status:** Verified with non-blocking issues (formal closure 2026-09-04).
> Final audited implementation target: `070147eedb23c3f9857a62509a41412bd703357d`.
> Final independent closure audit: commit `2f8233c`
> (`docs/report/VICT-STAGE-05-FINAL-INDEPENDENT-CLOSURE-AUDIT.md`), which is
> authoritative for the closure disposition. See §16 for the final
> independent disposition.

Stage 04 proved the neutral authoring foundation (authoring ABI, capability
packs, `@vict/application` identity/compilation, renderer/data ports, and a
minimal vertical proof). Stage 05 turns that foundation into complete,
responsive, customizable application delivery: one neutral definition plus
explicit bindings produces a full runnable application without hand-authored
routes or page shells.

## 1. Package and dependency structure

```text
@vict/contracts
       ↓
@vict/sdk                 (framework-neutral Application/Resource/Release definitions)
       ↓
@vict/kernel
       ↓
@vict/runtime
       ↓
@vict/store-sqlite        (Vict OPERATIONAL stores — unchanged)

@vict/contracts + @vict/sdk
       ↓
@vict/application         (neutral model, compiler, identity, ports, conformance suites)
       ↓                  ↓
@vict/renderer-svelte     @vict/appdata-sqlite      @vict/scaffolder
(Svelte renderer/host)    (SQLite app-data adapter) (one-time host scaffolder)
       ↓
examples/reference-app    (complete §17.10 reference proof)
```

New packages and their boundaries:

| Package | Responsibility | Depends on |
|---|---|---|
| `@vict/renderer-svelte` | Canonical Svelte renderer: generic `VitApp` host, built-in role components, responsive navigation, theme tokens, accessible defaults | `@vict/application`, `@vict/sdk`, `svelte` (peer) |
| `@vict/appdata-sqlite` | Production SQLite application-domain adapter + separate versioned application-domain migrations | `@vict/application`, `@vict/contracts`, `@vict/sdk` (built-in `node:sqlite`) |
| `@vict/scaffolder` | One-time deterministic SvelteKit host scaffolder | (none — pure Node) |

Boundary rules enforced and tested:

- `@vict/application` remains framework-neutral and browser-safe. Its
  declarations reference NO Svelte, SvelteKit, SQLite, Zod, runtime, or
  kernel types (the Stage 04 structural scans continue to pass).
- Svelte dependencies exist ONLY in `@vict/renderer-svelte` (and the SvelteKit
  application examples, which are consumers).
- SQLite dependencies exist ONLY in `@vict/appdata-sqlite` (the operational
  `@vict/store-sqlite` remains below the runtime, untouched).
- Renderer components receive only: the immutable plan, the supplied
  component registry, the action dispatcher, route data, and declared
  primitive props. No renderer component receives runtime instances, stores,
  secret providers, or unrestricted registries.
- Application-domain persistence is physically and logically separate from
  Vict operational persistence (see §10).

## 2. Neutral application schema and version compatibility

### 2.1 Schema markers

- `vict.application@1` — canonicalization, identity, ordering semantics and
  accepted SHAPES unchanged. Stage 04 definitions compile with their exact
  Stage 04 identity vectors
  (`APPLICATION_IDENTITY_SCHEMA = vict.application-identity@1` remains
  byte-identical; the existing identity tests pass unchanged, and the Stage 05
  final-correction test suite pins both the `@1` and `@2` identity vectors to
  the exact bytes produced before the correction). One validation change
  applies to BOTH markers (see §2.3): members the authoring model has ALWAYS
  declared required are now enforced by the runtime compiler — this is a bug
  fix against the declared schema, not a new schema version, so the schema
  markers themselves are unchanged and `vict.application@3` does not exist.
- `vict.application@2` — NEW. The Stage 05 delivery vocabulary. The schema
  marker is validated and participates in application identity, so a @2
  definition can never alias a @1 identity.
- Identity markers: `@1` definitions hash under
  `vict.application-identity@1`; `@2` definitions hash under
  `vict.application-identity@2`. The canonicalization algorithm is the same
  stable sorted-key form; the explicit marker documents that the accepted
  manifest SHAPE is materially extended.

### 2.2 The @2 surface vocabulary

Routes and screens:

- Route paths: static segments and single `:name` parameters only
  (`/projects/:id`), validated by the compiler (`ROUTE_PATH_INVALID`).
- Redirect routes (`redirect: <routeId>`): `screenId` must be absent; the
  target must exist; redirect chains must terminate (`ROUTE_REDIRECT_INVALID`,
  `ROUTE_REDIRECT_CYCLE`). The renderer resolves redirects deterministically
  on both server and client.
- Screens gain `breadcrumbs` (contextual navigation with validated route
  references) and the `stale`/`partial` safe states.

Surfaces (all optional `visibleWhen` condition on every surface):

| Role | Purpose | Key fields |
|---|---|---|
| `text` | Structured content | `level` (heading 1–6) |
| `view` | Simple bound table of view rows | `viewId` |
| `form` | Contract-validated create/edit form | `formId` |
| `action` | Command button | `actionId`, `label`, `disabledWhen` |
| `component` | Custom code-island slot | `componentId`, `revision`, bounded primitive `props` |
| `states` | State-marker surface | `viewId` |
| `list` | Semantic list rendering | `titleField`, `secondaryField`, `emptyMessage` |
| `table` | Searchable/sortable/paginated records table | `columns`, `queryActionId`, `searchFields`, `filterFields`, `pageSize` |
| `detail` | Record detail of the route's resolved record | `fields`, `emptyMessage` |
| `chart` | Accessible SVG chart | `kind` (bar/line), `xField`, `yField`, `summary`, `title` |
| `status` | Semantic status indicator | `value` XOR `field`, `tones` mapping |
| `tabs` | Tabbed content container | ordered `tabs[].{name,label,surfaces}` |
| `dialog` / `drawer` | Overlay interactions with nested content | `title`, `triggerLabel`, `content` |
| `conversation` | Conversation feed + validated input | `messageField`, `authorField`, `participantField`, `sendActionId`, `inputLabel` |

Conditions (`SurfaceCondition`): exactly one of `viewNonEmpty` (viewId),
`viewEmpty` (viewId), `paramEquals` (`{name, value}`). Conditions read ONLY
route parameters and loaded view row counts — no expressions, so no
executable logic can enter the definition. Disabled state
(`DisabledCondition.paramMissing`) is presentation only and NEVER
authorization (APP-012); every action is re-authorized below the UI.

Tables and search: a table declares `queryActionId` (must reference a
declared `query` action) plus `searchFields`/`filterFields` (validated
against the bound view). Search crosses the data port's declared, closed
`search` capability (`{ text, fields }`, bounded plain text, case-insensitive
substring) — never a query language.

Theme: `theme` may be a plain reference string (@1 shape) or a @2
`{ reference?, tokens? }` declaration whose token names come from the closed
`THEME_TOKEN_NAMES` vocabulary (color roles, typography, spacing, radius,
density, elevation, focus ring) and whose values are validated safe strings
(no CSS structure, no `url()`, no `@import`, no `expression()`) — a
definition can never inject executable CSS.

All @2 validation is closed-field: unknown fields at every boundary produce
structured, path-sorted diagnostics; hostile containers fail with structured
diagnostics; compilation never throws for invalid definitions.

### 2.3 Runtime required-member enforcement (final exit-gate correction)

The Stage 05 independent re-audit retained LOW-05-A: the runtime compiler
accepted objects that omit members the public authoring model declares
REQUIRED (an action without its `revision`, a route without its `id`, a
screen without its `title` — identically for `@1` and `@2`). The exit gate
requires malformed definitions to fail with structured diagnostics, so the
compiler now enforces every required member of every public structure that
enters compilation, for BOTH schema markers:

- ids and id-like references (`route.id`, `screen.id`, `surface.id`,
  `view.viewId`, `form.formId`, `action.id`, `resourceId`, `componentId`,
  `form.field.name`, …) must be non-empty, non-whitespace strings
  (`APPLICATION_EMPTY_ID` / `APPLICATION_INVALID_IDENTIFIER`);
- every declared revision (application, action, view, form, resource
  reference, component reference, capability reference) must be a non-empty,
  non-whitespace stable string (`APPLICATION_EMPTY_REVISION` /
  `APPLICATION_INVALID_IDENTIFIER`) — a missing revision is never defaulted;
- required collections (application `routes`/`screens`/`actions`/`resources`,
  screen `layout`, region `surfaces`, form `fields`) must be present arrays
  (`APPLICATION_REQUIRED_MEMBER`);
- required names and labels (screen `title`, `nav.label`, region `name`, form
  field `label`, text `content`, action-surface `label`, list `titleField`,
  chart `xField`/`yField`, conversation `messageField`/`authorField`/
  `inputLabel`, table `columns[].field`, tab `surfaces`) must be present,
  correctly typed and non-empty (`APPLICATION_REQUIRED_MEMBER` or the
  structure-specific `INVALID_*_DECLARATION` code);
- required cross-references are validated: a form's `submitActionId` must
  reference a DECLARED action (`UNKNOWN_FORM_ACTION` — the previously unused
  code), mutation/capability actions require `inputContractId`, list/table/
  detail surfaces must reference declared views (`UNKNOWN_VIEW_REFERENCE`),
  and provided resource definitions must declare their schema marker, id,
  revision, identity key and field catalogue with typed fields.

Multiple issues are reported together in stable path order; property
insertion order never affects diagnostics; invalid input never produces a
partial plan or an `applicationVersion`; throwing getters, revoked proxies
and hostile enumeration fail closed without raw exceptions or echoed values.

**Compatibility decision.** This is a validation bug fix against the schema
the authoring API always declared — not a new schema version. Schema markers,
canonicalization, ordering semantics, optional-member behavior and renderer
behavior for valid plans are unchanged; valid `@1` and `@2` definitions
compile with byte-identical canonical manifests and identity vectors
(permanent vector tests pin the exact pre-correction bytes). Definitions that
omitted required members were never valid under the declared model; they may
now be rejected. Previously accepted malformed objects therefore fail
compilation at the runtime boundary exactly as the exit gate requires.

Required display strings (screen/dialog/drawer titles, `nav.label`, region
`name`, form-field labels, action-surface labels, text `content`, chart
`summary`, breadcrumb labels, tab labels, conversation `inputLabel`) must be
more than empty: a whitespace-only value is malformed input and reuses the
SAME diagnostic code as an empty value at each site (closure remediation of
audit finding AUDIT-LOW-3; it changes only previously malformed definitions
— no schema marker, canonical byte, or valid definition is affected).

Diagnostic-code policy for surface-level references (audit finding
AUDIT-INFO-1, retained deliberately): an absent surface-level reference id
(`viewId`, `formId`, `actionId`, `componentId`, `sendActionId`) is reported
through the reference codes (`UNKNOWN_VIEW_REFERENCE`,
`UNKNOWN_FORM_REFERENCE`, `UNKNOWN_ACTION_REFERENCE`,
`UNKNOWN_COMPONENT_REFERENCE`) rather than `APPLICATION_EMPTY_ID`, because a
reference key can never resolve from an absent value — enforcement is
structurally guaranteed, the codes carry the more precise failure meaning,
and the behavior is pinned by permanent tests. The codes are NOT cosmetic
noise to be unified.

### 2.4 Canonical input boundary (closure-blocker remediation)

The independent closure audit misclassified two identity-boundary defects as
Low; direct review re-produced them as exit-gate violations (an executable
`local` and `navigation` action sharing ONE `applicationVersion` through
empty canonical declarations, and a non-enumerable action compiling to an
empty partial plan). The remediation establishes ONE strict canonical-input
boundary at the front of `compileApplication` instead of scattered special
cases. Everything that enters compilation — the application definition and
every provided resource/contract/capability/component binding — is
structurally validated as plain canonical data BEFORE any semantic
validation, canonical manifest construction, plan construction, or identity
hashing:

- **Plain objects only.** Accepted objects have `Object.prototype` or `null`
  as their direct prototype. Class instances, `Date`, `Map`, and every other
  exotic prototype are rejected (`APPLICATION_NON_CANONICAL_VALUE`).
- **Own enumerable data properties only.** Semantic members obtained through
  a prototype chain, hidden behind non-enumerable own properties, supplied
  through getters/setters, or keyed by symbols are rejected structurally.
  Accessors are rejected by DESCRIPTOR inspection and are never invoked to
  validate them; hostile or revoked proxies fail closed with structured,
  non-echoing diagnostics (values and thrown messages never enter
  diagnostics). It is impossible for validation to read semantics that
  canonicalization or defensive copying later omits, so two definitions can
  never share one identity through an empty canonical declaration.
- **Dense arrays only.** Accepted arrays have an own element at every
  numeric index below `length`, no unsupported additional enumerable
  properties, and no non-enumerable index descriptors. A real `null` element
  is valid and distinguishable from an absent slot. The sparse-array
  detection defect (AUDIT-LOW-1: `Array.prototype.keys()` yields hole
  indices, so the previous guard never fired and holes silently
  canonicalized to `null`) is fixed in the canonicalization implementation
  itself: holes are detected by own-property presence and rejected, so a
  sparse value can never receive the same identity as its explicit-null
  twin.
- **Canonical numbers.** `NaN`, `±Infinity`, and negative zero are rejected
  anywhere in the input (previously only along identity paths); `BigInt`,
  `symbol`, `function`, and `undefined` array elements are rejected.
  `undefined` object members keep their established meaning (absent).
- **Bounded primitive component props.** A component surface's `props` is
  absent, or a plain own-enumerable object whose values are exactly strings,
  finite canonical numbers (negative zero excluded), or booleans — the
  domain the public model always declared
  (`Readonly<Record<string, string | number | boolean>>`). `null`/array
  containers, nested objects, arrays, functions, symbols, `BigInt`,
  `undefined`, `NaN`, `±Infinity`, negative zero, dates, sparse arrays,
  inherited/non-enumerable/accessor members, exotic prototypes, and hostile
  proxies are rejected with a stable structured diagnostic carrying a safe
  path; property values are never echoed. Valid primitive props keep their
  exact established canonical bytes.
- **Defensive-copy semantics.** Compilation never freezes or mutates any
  caller-owned object and never retains an accepted caller-owned mutable
  object by reference (the previous `cloneForFreeze` returned non-plain
  caller objects as-is, which `deepFreeze` then froze in place). Plans are
  built entirely from defensive VICT-owned captures that are deep-frozen;
  `plan.toJSON()` serves the same captured copies instead of re-reading the
  caller's live objects, so a later caller mutation can never change a
  compiled plan, manifest, or `applicationVersion`. The plan-level scalar
  identity fields (`applicationId`, `applicationRevision`,
  `applicationVersion`) are likewise captured into immutable local values
  at successful compilation and are the ONLY source used by both the plan
  object and its serializer, so plan scalars, manifest identity, and every
  serialization always agree. Rejected hostile/exotic
  inputs are left unchanged and unfrozen, and no plan or
  `applicationVersion` exists when any capture fails.

`npm`-registry advisories and the npm 10.9.2 arborist crash when installing
`vitest` 4.x devDependencies (audit finding AUDIT-INFO-2) are environmental,
independently attributed to vitest's optional browser-provider peer ranges,
and require no production change; the `--legacy-peer-deps` scoping in
`verify:stage5` remains documented and honestly scoped (the plain
packed-consumer install path needs no workaround).

## 3. Renderer model (`@vict/renderer-svelte`)

- The generic `VitApp` host renders EVERY supported built-in role from the
  immutable plan. There is exactly one generic catch-all host page in the
  reference application (`src/routes/[...vict]/+page.svelte`) and one in
  every generated host; no per-screen route or page-shell source exists.
- Reactivity: every prop-derived value (plan, path, rows, registry,
  viewData, record) is computed through Svelte 5 `$derived`/`$state`
  reactive props. Route/plan/data/registry updates propagate WITHOUT
  remounting; there is no stale route or component resolution. The Stage 04
  `state_referenced_locally` carry-forward is closed at the source: the
  renderer package and the reference application build with ZERO Svelte
  warnings (enforced in `verify:stage5`; warnings fail the build check —
  they are never suppressed or filtered).
- Structural validation (`validatePlanForRenderer`) runs before any
  rendering: unsupported roles fail with `RENDERER_UNSUPPORTED_ROLE`; unknown
  components fail with `RENDERER_UNKNOWN_COMPONENT` /
  `RENDERER_COMPONENT_RESOLUTION_FAILED` before unsafe rendering. On a
  registry/plan UPDATE that no longer resolves, the host renders an explicit
  structured failure panel — never stale content, never silent omission.
- Action dispatch: `kind: 'local'` actions execute entirely inside the
  renderer (zero dispatcher calls — tested); `kind: 'navigation'` performs
  client-side navigation via the supplied `navigate` hook (SvelteKit `goto`
  in the host); query/mutation/capability actions cross the dispatcher where
  authorization/effect policy live below the UI. Dispatcher rejections are
  caught and mapped to safe framework-generated failure states; no unhandled
  rejection exists and no raw error content reaches the DOM.
- Form values are normalized by ONE centralized, type-aware model
  (`form-values.ts`): prefill and submit both convert at the DECLARED
  widget boundary, driven only by the field/widget metadata (the renderer
  never infers types from field names). Untouched numeric prefills stay
  numbers without any input event (`0` stays `0`, distinguishable from
  empty/absent); booleans carry their documented domain; invalid numeric
  input never becomes `NaN`/infinity, never dispatches, and produces a
  safe field-local error instead. Create and edit forms share the exact
  same policy (Stage 05 audit remediation, HIGH-05-A).
- Renderer identity (`renderer.svelte-kit@5.0.0`) participates ONLY in
  release identity, never application identity.

## 4. Built-in roles, states, and theming

The renderer implements the complete Stage 05 vocabulary (§2.2): text with
heading levels, view tables, lists, records tables (search, exact-match
filters, sortable columns with `aria-sort`, pagination), record details,
forms (prefill/edit via route record + identity), charts (renderer-owned
SVG), status indicators (semantic tones), tabs (roving-tabindex keyboard
model), dialogs/drawers (focus trap, Escape, focus restore), conversation
(distinct participant roles), custom component slots, breadcrumbs, and the
`states` marker.

Safe states: `loading`, `empty`, `validation`, `denied`, `failure` (declared
per screen, renderer-generated fallbacks otherwise), plus `stale` and
`partial` (@2), rendered as live-region announcements.

Heading semantics: a `text` surface with a declared `level` (1–6) emits the
matching `h1`–`h6` element from the compiler-validated closed vocabulary;
unleveled text renders as a non-heading paragraph.

Theme tokens are renderer-owned CSS custom properties
(`--vict-color-accent`, …) defined in `theme.css`; a definition's token
assignments are applied as inline CSS variables on the host element
(scope-safe coexistence with any host page). Reduced motion, visible focus,
AA-contrast tokens, and responsive breakpoints are built in. Below the
720 px breakpoint the shell is a single explicit column
(`'header' 'nav' 'main'`): the opened mobile navigation is an in-flow panel
placed between the header and the main content — never an implicitly
auto-placed grid column — so the main content keeps its full width with the
menu open. The mobile navigation POLICY is: the menu closes when the
application navigates to another screen (and stays open while the user
interacts within the current screen), and Escape inside the open menu (or on
the menu control) closes it and restores focus to the control.

## 5. Component registry and code islands

The Stage 04 versioned component registry is unchanged (structural id +
revision keys, duplicate rejection, frozen identity snapshots). Stage 05
adds the ownership rules:

- Registration requires a stable component id and a non-empty explicit
  revision; resolution is exact (no aliasing) and tested against
  post-registration mutation and revision drift.
- The registry lives OUTSIDE the serializable manifest; the plan carries
  only id/revision references. Changing a component's revision changes the
  registry and release identity while application identity is unchanged
  (tested in the reference application suites).
- Registered components receive ONLY declared primitive props: the compiler
  enforces the bounded `props` domain (plain own-enumerable object of
  strings, finite numbers and booleans — §2.4) and the plan delivers frozen
  VICT-owned copies, so host code can never inject structured data, hostile
  values, or live objects through props. The reference proof's
  `cmp.health@1` island is registered in
  `src/lib/components/registry.ts` (author-owned code island).

## 6. Scaffolder (`@vict/scaffolder`)

One-time SvelteKit application-host scaffolder:

- Deterministic: identical options produce byte-identical files (sorted
  manifest, LF newlines, no timestamps) — directly tested.
- Non-destructive: existing files conflict (`conflict` + explicit file list)
  instead of any overwrite; author-owned code islands
  (`src/lib/components/**`) are never touched — directly tested.
- Path-safe: absolute targets only; traversal and symlink/junction escape
  attempts are refused with structured reasons — directly tested (junctions
  on Windows).
- Idempotent: rerunning without changes reports `unchanged`.
- Ownership: the scaffolder owns the initial generic host; application
  authors own `definition.ts`, `application-server.ts`, and
  `src/lib/components/` islands. Subsequent definition changes render
  dynamically; VICT never regenerates or overwrites ordinary application
  code. No bidirectional round trip is promised.
- Packed verification: `verify:stage5` packs the full renderer stack,
  installs the packed scaffolder in an isolated consumer, generates a host,
  points its dependencies at the packed tarballs, installs, and BUILDS the
  generated project in isolation.

## 7. Action dispatch boundaries

Action kinds and their boundaries (all directly tested):

| Kind | Path | Server dispatcher |
|---|---|---|
| `local` | Renderer-only view transition | NEVER reached (no handler exists; sending one to `/api/act` is an `UNSUPPORTED_ACTION` rejection) |
| `navigation` | Client-side route change via the navigate hook | never crossed |
| `query` | Typed resource read through the data port | authorized read context, closed request schema |
| `mutation` | Typed resource mutation | authorization → contract validation → effect policy → durable transaction |
| `capability` | Real Vict run (`runtime.activate`/`runtime.run`) | declared input AND output contracts crossed inside the runtime |

Every generated CRUD operation follows
`UI intent → typed action/data boundary → authorization → contract
validation → effect policy → durable mutation`. Hidden or disabled buttons
are never enforcement: the reference proof's admin delete is VISIBLE but
denied at the boundary (`DATA_UNAUTHORIZED`), and the renderer's safe-denied
state merely reports it.

Stage 06 signal/operator kinds are NOT implemented; unknown action kinds are
rejected honestly (`UNSUPPORTED_ACTION`).

## 8. Application-data adapter (`@vict/appdata-sqlite`)

- Implements the storage-neutral `ApplicationDataAdapter` port with an
  explicit authorization/effect context on every call.
- Physical mapping: resource rows live in `appdata_<resource>` (validated
  lowercase snake_case mapping), one `identity TEXT PRIMARY KEY` plus a
  canonical-JSON `data` column. Filters, sorting, and search cross validated
  catalogue fields as parameterized `json_extract` expressions; every VALUE
  is bound. No hostile author or caller string ever becomes SQL (injection
  suites prove it).
- Operations: list (filters, search, sort, pagination, total), get,
  create/update/delete with declared-contract input/output validation,
  required/type enforcement, one strict unknown-field policy, defensive
  returned copies, atomic `BEGIN IMMEDIATE` transactions.
- Idempotency: keys are scoped `resourceId::op::key`, recorded in the SAME
  transaction as the row they reconcile (`vict_appdata_idempotency`), never
  consumed by failed transactions, never reconciled across different
  payloads or resources; the same key with a different canonical request is
  the stable `DATA_IDEMPOTENCY_CONFLICT`.
- Durability pragmas (WAL, `synchronous=FULL`, foreign keys, busy timeout)
  are applied at open and verified by pragma reads in tests.
- Production default adapter wiring lives in the reference app's
  `application-server.sqlite.ts`; the server core accepts any conforming
  adapter (the port boundary).

## 9. Search capability (data-port extension)

The closed query-request schema gains `search: { text, fields }`:
case-insensitive substring matching on declared catalogue fields, bounded
plain text (≤200 chars, ≤16 fields), wildcard-escaped in SQL
(`LIKE ... ESCAPE '\'`), and primitive-equality semantics preserved for
filters. The in-memory reference adapter implements IDENTICAL semantics; the
shared conformance suite covers search for both adapters.

## 10. Migration model (OPEN-014 decision) and store separation

**Decision:** the reference application-domain adapter implements an
explicit, versioned, transactional migration API that is structurally
separate from Vict operational migrations.

- `ApplicationDataMigration { id, version, name, statements }` — stable id,
  strictly ascending integer version; duplicates (id or version) fail with
  `APPDATA_MIGRATION_CONFLICT`; out-of-order declarations fail.
- Each migration runs in one transaction with its bookkeeping row
  (`vict_appdata_migrations`); an injected failure rolls back cleanly and
  the recorded history stays truthful (directly tested with invalid SQL).
- A database recorded at a version the adapter does not know fails closed
  (`APPDATA_FUTURE_SCHEMA`).
- `migrationsFromResources(resources, version)` derives the common bootstrap
  (CREATE TABLE per resource). Resource-definition changes NEVER silently
  rewrite physical tables: schema evolution is always an explicit new
  migration. Physical schema versions are independent of application
  revisions, resource revisions, and `applicationVersion`.
- Physical namespaces are disjoint from operational tables: application
  tables are `appdata_*`; bookkeeping is `vict_appdata_migrations` and
  `vict_appdata_idempotency`. The reference proof uses a SEPARATE database
  file from any operational store; a test asserts an application-domain-only
  database contains NO operational tables, and migration history never
  enters `vict_schema_migration`.
- Restart safety is proven with REAL process boundaries: a child process
  writes rows and exits; a fresh process reopens the same file, finds every
  row, and reconciles keyed idempotency without duplicates (package test),
  and the built reference application is SIGKILLed and restarted over the
  same SQLite file with all rows intact (HTTP suite).

## 11. Authorization, security, and leakage boundaries

- UI visibility, disabled state, and route guards are presentation only;
  every operation is re-authorized below the UI (adapter context or runtime
  effect policy).
- Hostile input (throwing getters, revoked proxies, enumeration traps,
  cyclic containers, exotic prototypes) anywhere in a query/mutation request
  produces the SAME stable, non-echoing structured diagnostics on BOTH
  adapters — the LOW-C-1 carry-forward is closed with permanent shared
  conformance coverage (scenario 17 of `runApplicationDataAdapterSuite`).
- Canaries (labels, route parameters, form input, validation messages,
  data-adapter failures, SQLite failures, component props, nested causes,
  hostile property names) are asserted absent from HTTP error bodies, SSR
  output, rendered DOM, diagnostics, and persisted metadata. Intended
  application data is distinguished from diagnostic propagation in tests.
- No `{@html}`, no raw-HTML feature, no network/CDN/telemetry dependency:
  rendering is fully offline and deterministic.

## 12. Identity and release model

- `applicationVersion` (identity markers per §2.1) changes when effective
  application declarations change; renderer revisions NEVER affect it.
- Release identity remains distinct: renderer revision, component-registry
  revision/component list, and application-data adapter identity affect ONLY
  the release. The reference release compiles from ACTUAL binding snapshots
  (real renderer instance, real registry identity snapshot, real adapter)
  with the mandatory fail-closed binding context; mismatched real binding
  context fails closed (`RELEASE_COMPONENT_MISMATCH`, adapter/revision
  mismatch, activation-reference checks).
- All distinctions are covered by permanent tests in `@vict/application`
  and the reference application's identity suite.

## 13. OPEN-013 decision (component/chart libraries)

**Decision: renderer-owned native components; no external UI/chart library.**

The built-in roles are implemented as renderer-owned Svelte 5 components
with semantic tokens; the chart is a renderer-owned SVG component with an
accessible `role="img"` summary and a data-table alternative. Evaluation
against the required criteria:

- License/maintenance/weight: zero third-party UI/chart dependencies; no
  supply-chain surface, no bundle weight beyond the renderer itself.
- Svelte 5/SSR compatibility: renderer-owned components compile under the
  Svelte 5 toolchain and SSR by construction (the reference app builds and
  serves server-side).
- Accessibility: the chart carries an accessible summary and a data-table
  equivalent; axe scans of the real rendered application are clean.
- Offline/determinism: no CDN, no telemetry; chart geometry is deterministic
  from data.
- Boundary: NO component- or chart-library types exist anywhere in
  `@vict/application` or `@vict/sdk`.
- Customization/theming: everything is token-driven.
- Packed behavior: the renderer packs and builds in isolated consumers
  (verify:stage5).

## 14. Known limitations and explicit exclusions

- React and additional renderers remain deferred (per the reference).
- The neutral model does not yet express derived/aggregate views; computed
  dashboard summaries are produced by a declared capability into real
  application-domain rows (documented pattern used by the reference proof).
- Table exact-match filters are equality-only; the data port deliberately
  has no query language.
- The scaffolder does not regenerate or upgrade hosts; host upgrades are
  manual (documented ownership model).
- Charts render bar/line kinds only; more encodings require either new
  neutral vocabulary or custom components.
- `prefers-reduced-motion` and focus behavior are covered in CSS and
  real-browser tests on the delivered components; broader automated
  accessibility coverage (screen-reader UX) remains manual.
- No multi-tenancy, remote control plane, or cloud deployment (Stage 6+).

## 15. Stage 05 verification entry points

- Root aggregate: `npm run verify:stage5`.
- Reference application suites: `npm run test -w reference-app`.
- Renderer conformance: `@vict/application/testing` shared suite, run in the
  renderer project of the root vitest config.
- Data conformance: shared suite applied to BOTH adapters (in-memory and
  SQLite) in `packages/appdata-sqlite/test/conformance.test.ts`.
- The authoritative command ladder and observed evidence are recorded in
  `docs/report/VICT-STAGE-05-REPORT.md` (implementer claim) and independently
  verified by `docs/report/VICT-STAGE-05-FINAL-INDEPENDENT-CLOSURE-AUDIT.md`,
  which is authoritative for the closure disposition.

## 16. Final independent disposition (formal closure — 2026-09-04)

**Status: Verified with non-blocking issues. The Stage 05 exit gate is
satisfied and Stage 05 is formally closed.** The authoritative disposition is
the final independent closure audit
(`docs/report/VICT-STAGE-05-FINAL-INDEPENDENT-CLOSURE-AUDIT.md`, commit
`2f8233c`), which audited the final implementation target `070147e`
(`070147eedb23c3f9857a62509a41412bd703357d`) on a fresh clone with snapshot
negative controls against the pre-correction tip `4aead149`, readiness-barrier
probes, and independent restart-recovery probes through the real worker
fixtures.

### 16.1 Exit gate — satisfied

Every §-exit-gate condition is independently evidenced: one Application
Definition plus declared bindings produces a runnable SvelteKit application
without manually authored routes or page shells; the §17.10 proof contains
conversation, records/projects tables, validated create/edit forms, a chart
dashboard, responsive navigation, safe default states, one durable Vict
action, one local action, and one custom Svelte component; application-domain
data survives restart through the separate SQLite adapter without touching
operational tables; changed definitions produce the intended
`applicationVersion` while unchanged definitions build deterministically;
built-in and custom components receive only declared safe data/action
surfaces; malformed definitions and missing revisions fail with structured
diagnostics rather than partial silent rendering; renderer and data adapters
pass shared conformance, accessibility, leakage, packaging, and
fresh-consumer checks; and the independent audit accepted the delivery.

### 16.2 Final observed baseline (prescribed sequential execution)

```text
Unit:         57 files / 1436 tests
Renderer:      3 files / 45 tests
Integration:   1 file / 4 tests
Full suite:   61 files / 1485 tests
ARA proof:    exactly 13 ordered events
Benchmark:    exactly 10 events per completed run
Stage 04 application proof: 17/17
```

The Svelte reference build remains warning-free (Svelte warning checks are
enforced, never suppressed). `git diff --check` is clean.

### 16.3 Principal verified behaviors

- `vict.application@1` compatibility with byte-identical legacy identity
  vectors, and the `vict.application@2` delivery vocabulary.
- Strict required-member and canonical-input validation: only dense, plain,
  canonical data enters compilation; sparse arrays, inherited,
  non-enumerable, accessor, and symbol-keyed members, exotic prototypes,
  and hostile/revoked proxies are rejected structurally with stable,
  non-echoing diagnostics; no partial plan or `applicationVersion` exists
  for invalid input.
- Deterministic, collision-resistant `applicationVersion`; two definitions
  can never share one identity through an empty canonical declaration.
- Immutable, caller-independent compiled plans and serialization: plan
  scalars, manifest identity, serialization bytes, and `applicationVersion`
  are mutually consistent after arbitrary caller mutation; no caller object
  is frozen, mutated, or retained by reference; serializations are
  byte-identical across repeats.
- Canonical Svelte 5 renderer and generic application host: one generic
  catch-all route per host; reactivity through `$derived`/`$state` with no
  stale route or component resolution and no remount-forced updates.
- Routes, navigation, and responsive layouts, including the explicit
  in-flow mobile navigation panel and its close-on-navigate/Escape policy.
- Forms, records, tables, search, charts, tabs, dialogs, drawers, status,
  action and conversation surfaces, with the centralized type-aware
  form-value model (untouched numeric prefills stay numbers; invalid numeric
  input never dispatches).
- Safe loading, empty, validation, denied, stale, partial and failure
  states; hidden/disabled UI is never enforcement — operations are
  re-authorized below the UI (visible-but-denied admin delete proven).
- Theme tokens and versioned custom-component code islands receiving only
  bounded primitive props (frozen VICT-owned copies).
- One-time deterministic non-destructive scaffolder: byte-identical output,
  conflict detection instead of overwrite, path-safety (including Windows
  junctions), idempotent reruns, author-owned code islands untouched.
- Production SQLite application-domain adapter: parameterized `json_extract`
  access (no hostile string ever becomes SQL), strict unknown-field policy,
  defensive returned copies, atomic `BEGIN IMMEDIATE` transactions,
  transactional idempotency keys, and durability pragmas verified by pragma
  reads.
- Application-domain migrations: explicit, versioned, transactional, with
  bookkeeping (`vict_appdata_migrations`) and `appdata_*` namespaces
  disjoint from operational migrations and tables; future-schema databases
  fail closed; evolution is never an inferred destructive rewrite.
- Typed, authorized query/mutation/action boundaries across `local`,
  `navigation`, `query`, `mutation`, and `capability` kinds; Stage 06
  kinds are honestly rejected (`UNSUPPORTED_ACTION`).
- Restart and real-process SIGKILL recovery evidence: each corrected fixture
  emits an exact readiness sentinel only after its fsynced durable
  checkpoint; the partial-fan-out fixture becomes ready only after the
  completed sibling branch is durably recorded; recovery never re-invokes
  completed work, never duplicates durable facts, and keeps event/ledger
  counts exactly-once. No elapsed-time kill trigger remains in the three
  corrected scenarios.
- Warning-free Svelte build (Stage 04 `state_referenced_locally`
  carry-forward closed at the source), real-browser responsive and
  accessibility checks (including axe scans), and packed-consumer plus
  generated-host build verification (`verify:consumer`, `verify:stage5`).

### 16.4 Findings carried at closure (all non-blocking)

- **AUDIT-F1 — Low (test-infrastructure hygiene):** the scaffolder's
  real-build test uses the shared repository-local `.tmp-scaffold-check`
  path and can race if two independent Vitest processes execute that test
  simultaneously in one checkout. The prescribed sequential verification
  ladder passes; the finding never occurred in prescribed execution, does
  not control crash timing, and involves no corrected file. Carried as
  Stage 06 hygiene: switch the test to a unique `mkdtemp` directory per
  process. NOT fixed in this closure.
- **Environmental (AUDIT-F2):** Node 24 and a second operating system were
  unavailable for the final closure audit (all evidence Windows 11 /
  win32-x64 / Node v22.13.1); no cross-platform or Node-24 coverage is
  claimed.
- **Informational (AUDIT-F3):** the unchanged Stage 02 diagnostic sleep is
  not a crash trigger — its kills are poll-gated on durable events.
- **Informational (AUDIT-F4):** Node 22 emits the existing `node:sqlite`
  experimental warning; cosmetic and pre-existing.
- Existing accepted Stage 03 informational limitations remain unchanged.
- Declared revisions, binding provenance, and supplied deployment snapshots
  retain their documented trust boundaries.
- Documented product limitations remain honest (§14): bar/line charts only,
  equality-only filters, manual host upgrades, no second renderer, and no
  claim of manual screen-reader certification.

No Critical, High, or Medium findings remain. Earlier audit findings (the
original application-delivery blockers, the required-member finding, the
canonical-input exit-gate violations, and the live-root serialization
defect) were remediated and independently verified; their reports are
preserved unchanged as historical evidence.

### 16.5 Closure and what comes next

- **Stage 05 is closed** (2026-09-04) as Verified with non-blocking issues.
- **Stage 06 is permitted but has not begun.**
- The next separate task is the **Mastra/ARA architecture amendment**, which
  is governed independently of this closure. A Stage 06 implementation
  handoff must be generated from the amended system reference rather than
  from the pre-amendment Stage 6 description; no Mastra-specific design or
  Stage 06 implementation is authorized until that amendment is accepted.