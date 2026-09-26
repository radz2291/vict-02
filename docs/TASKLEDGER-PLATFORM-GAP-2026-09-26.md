# TaskLedger Platform Gap — branch work record (2026-09-26)

Branch `pi/taskledger-platform-gap`, cut from `dc69768`
(`codex/ui-foundation-catalog-coverage`, verified tip). Isolated worktree:
`C:\Users\RZ1\Desktop\RZ\vict-02-taskledger-platform-gap`. The concurrent
coding-agent workspace proof (`vict-02-coding-agent-workspace`,
`pi/coding-agent-workspace-p1`) is untouched; no merges in either direction.

Authority context: the F6 authority review
(`docs/governance/VICT-STAGE-08-G3-P2B-F6-AUTHORITY-REVIEW-2026-09-26.md`)
stands. The frozen Stage 8 P2 proof on the published 13-package `0.3.1` set
FAILED F6 literally and G3 remains HELD. This branch is the Option B platform
follow-up work: it cannot retroactively pass that proof, and nothing here
amends the frozen rubric, claims F6/G3 passed, merges, publishes, or starts G4.

---

## 1. Gap map (traced)

Trace path: SDK/Application definitions → `@victframework/application`
(compile) → `@victframework/ui` (presentation intents) →
`@victframework/ui-svelte` (Svelte renderer) → `@victframework/renderer-svelte`
(compatibility facade) → `@victframework/scaffolder` (host generator).

### 1.1 What the base branch (dc69768) already supplies

| Capability | Where | State |
| --- | --- | --- |
| Definition-driven table with declared server-backed search, sort, filter, pagination | `Surface` role `table` (`sdk/application.ts`), `RecordsTable.svelte` + `TableAdapter.svelte` dispatching the declared `queryActionId` on every control change | Working |
| Definition-driven create/edit form with contract validation and prefill | `FormBinding` (`forms`), `FormSurface.svelte` (prefill via `identity`/`values`, canonical value conversion, `CONTRACT_REJECTED` field-error mapping) | Working |
| Generic chart | `Surface` role `chart` (`viewId/xField/yField`), `Chart.svelte` with accessible table equivalent | Working |
| Versioned component islands | `role:'component'` + `ComponentRegistry` (id/revision exact match), `ComponentSlot.svelte`, structural pre-render resolution check | Working |
| Facade | `renderer-svelte` re-exports `ui-svelte` only (P5 architecture closure) | Working |
| Phone-width basics | ≤719px: toolbar fields stack full-width, table region scrolls horizontally (`overflow-x: auto`) | Working |

### 1.2 Precise remaining gaps (TaskLedger cannot be authored definition-driven)

| # | Gap | Evidence in base source | F6 review ref |
| --- | --- | --- | --- |
| G1 | No code-island table cells: `TableColumn` = `{field,label,sortable}` only; `RecordsTable` renders `String(row[field])` — a declared badge-in-cell is impossible without replacing the whole table with a custom island | `packages/sdk/src/application.ts` (`TableColumn`), `packages/ui-svelte/src/RecordsTable.svelte` (tbody cell render) | §6.3 |
| G2 | No declared per-row action: the table has no row-action contract, so "Complete" per row requires a behavior-carrying island | same sources (no rowAction anywhere) | §4 (P2B `TaskTable` self-fetched) |
| G3 | No aggregate/count surface: `text` is static, `status` reads the route record or a static value — no surface renders a view's `total` (which `ViewDatum` already carries) | `packages/ui-svelte/src/logic.ts` (`ViewDatum.total` unused except by TableAdapter), `packages/ui-svelte/src/Surface.svelte` | §6.3 |
| G4 | Scaffold `package.json` pins placeholder `0.1.0` platform versions; no release-set selection exists at scaffold time | `packages/scaffolder/src/index.ts` templates | §6.1 |
| G5 | Scaffold host files hardcode the starter domain: `application-server.ts` embeds the `items` resource wiring, hard grants, no contract pre-validation, no capability wiring, sync factory; `[...vict]/+page.server.ts` hardcodes `resourceId:'items'`/`v.items` and ignores route parameters; no documented extension seam — every real app must hand-edit generated host files | `packages/scaffolder/src/index.ts` (templates) | §6.2, §3 |
| G6 | Navigation actions cannot substitute route parameters (a declared `/tasks/:id` route is unreachable from a row context without hand-built UI) | `packages/ui-svelte/src/VitApp.svelte` (`runAction` navigation branch navigates the raw declared path) | — (found during this trace) |
| G7 | Views have no declared static filters or sort, so even a generic host cannot load "open tasks" or a day-ordered projection without per-app server code | `packages/sdk/src/application.ts` (`ViewBinding`), `packages/application/src/compile.ts` (`VIEW_FIELDS`) | §6.2 |

A styled table primitive or a catalog export is NOT a definition-driven table;
without G1–G3 the interactions the TaskLedger brief wants can only exist as
behavior-carrying islands — exactly what F6 clause B forbids.

---

## 2. Design (smallest coherent)

Portable meaning goes in `@victframework/sdk` + `@victframework/application`
(closed, compiled, versioned contracts); presentation intent in
`@victframework/ui`; Svelte behavior in `@victframework/ui-svelte`;
`@victframework/renderer-svelte` stays a pure re-export facade (no source
change needed). No schema-version bump: all additions are optional members on
`@2` definitions, so existing definitions compile byte-identically
(`applicationVersion` unchanged when the new members are absent).

1. **G1 — island cells:** `TableColumn` gains optional
   `componentId`/`revision`/`props` (prop name → row field name). Compile
   validates the reference against `application.components` (exact revision)
   and every prop source against the bound view's projection. The renderer
   resolves the versioned component structurally (pre-render, like
   `component` surfaces) and renders it in the declared cell with props
   derived from the row. The island stays presentational — the slot offers no
   data access, and the app's badge simply does not dispatch.
2. **G2 — row actions:** table surfaces gain optional
   `rowAction: { actionId, label, input? }` (`input` maps input-field → row
   field; default `{ id: 'id' }`). The renderer renders a keyboard-operable
   button per row and dispatches the DECLARED action with row-derived props;
   success flows through the host's existing invalidation (no new refresh
   path). Works for capability/mutation actions AND navigation actions
   (via G6), so "Complete" and "Edit" are both declared, not coded.
3. **G3 — count surface:** new `@2` surface `{ role:'count', id, viewId,
   label? }` rendering the view datum's `total`. Smallest portable aggregate
   binding; no new data path (`ViewDatum.total` already exists). Additive
   role in the closed vocabulary.
4. **G4 — explicit release set:** `scaffoldVictApp` gains REQUIRED
   `platformDependencies` (map of platform package → exact spec). The
   scaffolder never invents versions; the CLI takes `--release-set file.json`.
5. **G5 — app-neutral host:** generated `application-server.ts`,
   `[...vict]/+page.server.ts`, and `api/act/+server.ts` become generic,
   domain-free host files driven by author-owned exports in
   `src/lib/application/definition.ts` (resources, contracts, capabilities,
   grants). The generic server provides: async app factory (host files
   `await` it), contract pre-validation for every declared action input
   BEFORE any run or mutation (the F5-refusal path, generically), query
   actions via the data adapter, mutation actions via the data adapter with
   declared idempotency, capability actions via synthesized single-node
   graphs on the real runtime (activation-cached, output-contract-checked,
   durable stores), and a plan-driven `loadRoute` that resolves ANY route
   (parameters included), loads EVERY declared view of the resolved screen
   with its declared filters/sort/projection, and performs declared-record
   `get`s for parameterized routes. Ownership of every generated file is
   documented in the generated README.
6. **G6 — parameter substitution:** navigation actions substitute declared
   `:name` path parameters from the action input before navigating.
7. **G7 — view filters/sort:** `ViewBinding` gains optional `filters`
   (catalogue-checked static exact-match filters) and `sort` (declared field
   + direction) applied by the generic host loader. This is what lets the
   dashboard count "open tasks" and the chart read a day-ordered completions
   projection with zero app-owned server code.

Limitations recorded (not closed here): no relative-date filter vocabulary
("last 14 days" windows need author-declared data, e.g. a completion day
field, or a future aggregate contract); host-file replacement outside the
generic dispatch model (custom projections beyond declared views) remains an
owner decision, documented as leaving the no-edit path.

## 3. Verification plan (this branch)

- Focused tests: compile diagnostics for all new contracts (unknown column
  component, revision mismatch, prop field outside projection, undeclared
  rowAction action, bad view filters/sort), deriveUiPlan intent derivation,
  renderer DOM behavior (island cell props from row, row action dispatch +
  navigation substitution, count surface), scaffolder (release-set required,
  host files domain-free, determinism kept).
- Prior proofs kept working: Requests/Workspace composition and catalog
  suites, reference-app suite, coding-agent workspace untouched.
- Fresh external consumer (separate directory, packed candidate tarballs,
  nothing published): scaffold → byte-hash host files → author the TaskLedger
  app → re-hash → compare; real-browser laptop + phone-width checks; negative
  action-boundary probe; governed durability + restart persistence.

## 4. Implementation status (updated as work lands)

| Item | State |
| --- | --- |
| G1 island cells | DONE — `TableColumn.componentId/revision/props` (sdk), compile validation (UNKNOWN_COMPONENT_REFERENCE / COMPONENT_REVISION_MISMATCH / prop-projection / orphan-members), `UiTableIntent.columns[].component`, `RecordsTable` island cell render with row-derived props, structural pre-render resolution check |
| G2 row actions | DONE — `TableRowAction` on table surfaces, compile validation (declared action, non-local, projection-checked input mapping), `UiTableIntent.rowAction`, per-row keyboard-operable button dispatching through the renderer's action path |
| G3 count surface | DONE — `@2` `role:'count'` surface (`viewId`, `label`), compile validation, `Count.svelte` rendering the view datum's `total` (aria-live) |
| G4 release set | DONE — REQUIRED `platformDependencies` (validated against the host package set; placeholders impossible), CLI `--release-set`, README documents explicit selection |
| G5 app-neutral host | DONE — domain-free `application-server.ts` (contract pre-validation before any run/mutation, query/mutation dispatch, capability actions as governed runs with durable sqlite stores, plan-driven `loadRoute` with route parameters and declared record gets), generic `+page.server.ts` / `api/act/+server.ts` awaiting the async factory, exact ownership table in the generated README |
| G6 nav params | DONE — `substitutePathParams` in the navigation action path |
| G7 view filters/sort | DONE — `ViewBinding.filters/sort`, compile validation (catalogue fields, closed direction), applied by the generic loader |
| Tests | compile-contract suite (18), renderer DOM suite (6), scaffolder suites extended (release-set refusal, domain-free host, ownership README, CLI release-set) — all green; full unit (1016) + renderer (90) + integration + mastra + reference-app suites green |
| Fresh external consumer + browser evidence | PENDING |

Base-branch observations (pre-existing, not introduced here, not fixed here):
`npm run lint` reports 3 errors in `packages/ui-svelte/test/composition-feedback.test.ts`
and `scripts/verify-ui-composition.mjs`, and `npm run format:check` flags
`examples/ui-showcase/src/lib/application/definition.ts` +
`packages/ui-svelte/src/mount.svelte.ts` — all present on the base commit
`dc69768` and left untouched (no unrelated changes on this branch).

Status will be updated at the bottom as the work lands.
