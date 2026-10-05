# U0 local reconciliation — inventory of actual VICT contracts

Status: U0 contract candidate artifact. Every claim below was verified against the local
checkout at base `4d2df037d8a82d36c60bf1bff16919650643ce22` (branch `codex/ui-foundation-u0`)
on 2026-10-06. File paths are repository-relative. Proposed names are marked as proposals;
existing exported names are quoted exactly.

## 1. Baseline, remote and isolation (U0-01)

| Item | Verified value |
| --- | --- |
| Repository remote (origin) | `https://github.com/radz2291/vict-02.git` (fetch + push) |
| Live `origin/main` at U0 start (2026-10-06, fresh `git fetch`) | `4d2df037d8a82d36c60bf1bff16919650643ce22` — identical to the pack-observed baseline |
| Stage branch | `codex/ui-foundation-u0`, created at the SHA above in an isolated worktree (`vict-02-u0`); normal push destination; no force-push |
| Working tree | Clean at branch creation; all U0 changes are new files under `docs/ui-foundation/`, a 14-line append to root `AGENTS.md`, and a single docs-index bullet (source-wrapped over two physical lines) in `README.md` |
| Root instructions | Existing `AGENTS.md` Stage 9/canonical-reference rules preserved byte-for-byte; routing block appended per `AGENTS.addendum.md` |

Concurrent-work classification at U0 start: the remote carries Stage 9 review/verification
branches (`review/stage9-g3-*`, `codex/stage9-g3-proposal`, and earlier G0–G2 lineage) and
completed UI tracks (`pi/ui-foundation-p5`, `qa/ui-foundation-p1..p5`,
`codex/ui-foundation-p1..p4`, `codex/ui-composition-slice-1`). None of them is modified by
this workstream. The separate Studio prototype repository used by the Studio agent is outside
this repository and is not touched. No shared path conflict exists: U0 writes only
`docs/ui-foundation/**` plus the two documented root-file lines.

Tooling baseline (inspected, not modified): root `package.json` declares `typecheck`
(`tsc -p tsconfig.json --noEmit`), `check:ui` (`svelte-check`), `format:check` (prettier;
`.prettierignore` excludes `*.md`), `test` (vitest projects) and prior-track scripts
(`foundation`, `test:foundation`, `composition`, `catalog`, `workspace`,
`verify:stage9-inventory`, …). U0 runs read-only baseline checks only; no script is reported
as run merely because it exists (see STATE for actual executed commands and results).

## 2. Application source, identity and release (WP-2, U0-03)

### 2.1 Observed schema constants (`packages/sdk/src/application.ts`)

| Exported constant | Exact value |
| --- | --- |
| `APPLICATION_DEFINITION_SCHEMA` | `'vict.application@1'` |
| `APPLICATION_DEFINITION_SCHEMA_V2` | `'vict.application@2'` |
| `RESOURCE_DEFINITION_SCHEMA` | `'vict.resource@1'` |
| `APPLICATION_RELEASE_SCHEMA` | `'vict.application-release@1'` |
| `APPLICATION_IDENTITY_SCHEMA` (`packages/application/src/compile.ts`) | `'vict.application-identity@1'` |
| `APPLICATION_IDENTITY_SCHEMA_V2` (`packages/application/src/compile.ts`) | `'vict.application-identity@2'` |
| `RELEASE_IDENTITY_SCHEMA` (`packages/application/src/release.ts`) | `'vict.application-release-identity@1'` |

The pack proposal to add `vict.application@3` / `vict.application-identity@3` is therefore a
new version in an existing versioned family, not a new namespace. Availability check: a
`git grep` over tracked sources for `vict.application@3`, `vict.application-identity@3`,
`vict.ui-document`, `vict.ui-render-plan`, `vict.ui-edit` and `vict.ui-scenario` returns no
matches — all six proposed markers are unused (verified 2026-10-06).

### 2.2 Closed schemas and compile inputs (`packages/application/src/compile.ts`)

- `CompileApplicationInput = { application, resources, contracts?, capabilities?, components? }`
  — there is **no** UI-document input today; the @3 amendment extends this input explicitly
  (see [API-SPEC](API-SPEC.md) §2), never a process-global registry.
- Field sets are closed and version-gated: `APPLICATION_FIELDS` (`schema, id, revision, name,
  routes, screens, views, forms, actions, resources, components, compatibility, theme`),
  `SCREEN_FIELDS_V2` (adds `breadcrumbs, layoutMode, composition`), `ROUTE_FIELDS_V2` (adds
  `redirect`), `STATES_FIELDS_V2` (adds `stale, partial`), per-kind `ACTION_FIELDS`. Unknown
  fields produce structured diagnostics; they are never stripped or ignored. This confirms the
  pack claim that UI source cannot be smuggled in through an ad-hoc property.
- `canonicalApplicationManifest` sorts set-like collections by id and preserves meaningful
  ordered arrays (routes, regions/surfaces, form fields) — ordered vs set-like semantics are
  already distinguished, matching CONTRACTS §1 canonicalization language.
- `computeApplicationVersion` returns `v1_ + sha256(stableJson({ identitySchema,
  applicationSchema, manifest, referencedResources, referencedViews, referencedActions,
  referencedComponents }))` with sorted reference lists. The @3 identity extension adds
  resolved UI-document references/digests as an additional identity input for `@3`
  applications only; `@1`/`@2` identity computation is untouched.

### 2.3 Release binding (`packages/application/src/release.ts`)

- `compileApplicationRelease(release, plan, context)` validates a closed release field set
  (`schema, applicationId, applicationRevision, applicationVersion, renderer, components,
  dataAdapter, victCompatibility, activation, provenance`) and fails closed on a missing
  binding context (`RELEASE_BINDING_CONTEXT_REQUIRED`).
- The binding check `RELEASE_APPLICATION_MISMATCH` fires unless
  `release.applicationId === plan.applicationId && release.applicationRevision ===
  plan.applicationRevision && release.applicationVersion === plan.applicationVersion`.
  **Consequence for @3:** because a UI-document edit changes the computed
  `applicationVersion`, any frozen release bound to the earlier version is rejected with
  `RELEASE_APPLICATION_MISMATCH` — the required old-release invalidation already exists and
  needs no new release schema. Release identity additionally binds renderer, component and
  data-adapter identities (`RELEASE_IDENTITY_SCHEMA = 'vict.application-release-identity@1'`).
- No second UI identity authority is introduced: the @3 marker participates in
  `computeApplicationVersion` via `identitySchemaFor(schema)` extension; release schema stays
  `vict.application-release@1`.

### 2.4 Renderer boundary (`packages/application/src/renderer.ts`)

- `ActionDispatcher.execute(actionId, input?): Promise<ActionResult>` is the only action path
  below the renderer; `RendererBindings = { components: ComponentRegistry; dispatch:
  ActionDispatcher }`; `ApplicationRenderer` declares `id/revision/supportedSurfaceRoles` and
  consumes an immutable `ApplicationPlan`. Renderer diagnostics are structured
  (`RENDERER_UNSUPPORTED_ROLE`, `RENDERER_UNKNOWN_COMPONENT`,
  `RENDERER_COMPONENT_RESOLUTION_FAILED`, `RENDERER_UNKNOWN_REFERENCE`,
  `RENDERER_INVALID_PLAN`, `RENDERER_UNSUPPORTED_PRESENTATION`).
- Components are trusted registrations outside serialized source (`createComponentRegistry`),
  matching CONTRACTS §4 — extension/renderer code is never embedded in documents.

### 2.5 APP-019 disposition

`docs/VICT-SYSTEM-REFERENCE.md` APP-019: "A visual drag-and-drop authoring environment is
deferred; if added, it MUST edit the same canonical Application Definition rather than create
a parallel model." (line ~3785, status Deferred/Not Scheduled.)

Disposition (also recorded as decision T-01 lineage in
[DECISIONS-AND-EVIDENCE](DECISIONS-AND-EVIDENCE.md)): the proposed `vict.ui-document@1` is a
**referenced authored artifact inside** the canonical Application Definition — attached
through the @3 screen `uiDocument` reference, compiled jointly, and hashed into
`applicationVersion`. There is no parallel model and no ignored side file. APP-019 remains
Deferred in the system reference; this U0 contract does not edit the system reference. The
later, explicitly scoped integration work owns any system-reference amendment, per the pack
README and CONTRACTS §1.

## 3. Neutral dependency graph (WP-2/T-02, U0-06)

Verified from package manifests (all at source version `0.4.0-rc.1`):

| Package | Dependencies |
| --- | --- |
| `@victframework/contracts` | — |
| `@victframework/ui` | — (fully neutral today; no Svelte/DOM/runtime deps) |
| `@victframework/sdk` | contracts, ui |
| `@victframework/application` | contracts, sdk, ui |
| `@victframework/kernel` | contracts, sdk |
| `@victframework/runtime` | contracts, kernel, sdk |
| `@victframework/ui-svelte` | application, sdk, ui (+ `bits-ui`, `@internationalized/date`; peer `svelte ^5.33.0`) |

The observed direction matches T-02: SDK → UI; application → SDK + UI; renderer at the edge.
The U0 module plan in [API-SPEC](API-SPEC.md) §7 keeps `packages/ui` dependency-free, adds
@3 authoring shape types to `packages/sdk` (preserving sdk → ui), keeps joint
compilation/identity in `packages/application`, and adds editor/preview modules strictly above
the application/runtime boundary.

## 4. Execution boundaries: doubles and application data (WP-4, U0-05)

### 4.1 Capability doubles (`packages/runtime/src/registry.ts`, `runtime.ts`)

Exact exported/available surface on the runtime registry (as used by `VictRuntime`):

- `registerDouble(capabilityId, invoke, options?: { modes?: readonly ('test' | 'simulate')[] })`
  — duplicate registration is **rejected**; use `replaceDouble` for explicit replacement.
- `replaceDouble(capabilityId, invoke)` — later runs use the replacement; in-flight runs do not.
- `hasDouble(capabilityId)`, `getDoubleModes(capabilityId)`, `snapshotDoubles()`.
- `installCapabilityPackBatch(install)` — atomic staging of contracts/capabilities/doubles
  (`packages/runtime/src/pack-install.ts`; pack-installed doubles need no manual registration).

Fail-closed behavior: `packages/runtime/src/effect-policy.ts` produces a denial with
remediation `Register a test double for capability '<id>' with runtime.registerDouble().`
when no double is registered in simulation/test contexts — there is no fallback to the real
handler (system reference invariant EFF-003; §11.1 "A missing required double produces a
denial, not fallback to the real handler"). Runs snapshot effective doubles at
activation/creation (`snapshotDoubles`; EFF-004), so mid-run registry mutation cannot change
execution — the U0 preview/session fencing design in [API-SPEC](API-SPEC.md) §6 builds
directly on this.

### 4.2 Application data adapter (`packages/application/src/data.ts`)

- `ApplicationDataAdapter = { id, revision, query(request, context), mutate(request, context) }`
  with `ApplicationDataQueryRequest` (`op: 'list' | 'get'`, resourceId, filters, search, sort,
  limit/offset, projection, id) and `ApplicationDataMutationRequest` (resourceId, op, input,
  id, idempotencyKey).
- `ApplicationDataRequestContext = { permissions: readonly string[]; effect: 'read' |
  'write'; actor?: string }` — authorization/effect/actor context is carried on **every**
  call; the editor cannot invent a grant (CONTRACTS §5).
- Stable error codes: `DATA_UNKNOWN_RESOURCE`, `DATA_UNAUTHORIZED`,
  `DATA_MUTATION_NOT_DECLARED`, `DATA_UNKNOWN_IDENTITY`, `DATA_INVALID_INPUT`,
  `DATA_IDEMPOTENT_REPLAY`, `DATA_IDEMPOTENCY_CONFLICT`, `DATA_UNSUPPORTED_QUERY`,
  `DATA_INVALID_REQUEST`, `DATA_CONTRACT_REJECTED`, `DATA_UNSUPPORTED_VALUE`.
- Shared conformance: `runApplicationDataAdapterSuite(fixture)` in
  `packages/application/src/data-conformance.ts`; reference implementation
  `createInMemoryApplicationData(...)` exported from `packages/application`.

### 4.3 Preview mapping conclusion

The preview/session layer needs **no new execution engine** (A-05): capability dispatch goes
through the existing runtime registry/double snapshot machinery, data goes through a
conforming `ApplicationDataAdapter`, and UI actions bridge via `ActionDispatcher` → declared
application actions. The U0-owned design work is the scenario/session envelope
(`vict.ui-scenario@1`) and its fencing, specified in [API-SPEC](API-SPEC.md) §6 with the
exported names above.

## 5. Current UI surface (context for the new document model)

- `packages/ui` exports the plan vocabulary used by the current closed composition model:
  `UiPlan`, `deriveUiPlan`, `UiPlanSource`, `UiSurfaceSource`, `UiTableIntent`, shell types,
  plus `composition.ts` (bounded stack/split presets: `UiApplicationComposition`,
  `UiPageComposition`, `UiLayoutMode`, `UiRegionPresentation`) and `feedback.ts`. This is the
  "closed stack/split plus semantic presets" surface the pack replaces for authored screens;
  it stays untouched for `@1`/`@2` applications.
- `packages/ui-svelte` renders that vocabulary via `VitApp.svelte`, `AppShell.svelte` and the
  primitive set (Button, Form, List, DataView, Tabs, Overlay, …). The future general document
  renderer (U1+) is additive: new renderer modules for `vict.ui-render-plan@1`, coexisting
  with the existing component set.
- Prior UI tracks left `scripts/ui-foundation.mjs` / `verify-ui-foundation.mjs` /
  `ui-composition.mjs` / `ui-catalog.mjs` / `ui-workspace.mjs` and `examples/ui-showcase`.
  They are **not** this workstream's targets; U1+ adds its own scripts/consumers and does not
  repurpose or weaken the prior tracks' checks.
- `apps/studio` is a SvelteKit application with its own tests (Stage 9 records report a
  studio test suite) and its own `src/lib/application/definition.ts`. It is read-only for
  this workstream (WP ownership in [HANDOFF](HANDOFF.md) §3; A-01/A-04 govern how its future
  integration consumes the foundation without source edits by this track).

## 6. Simulation/proof semantics already established (WP-4/U0-07 inputs)

From `docs/VICT-SYSTEM-REFERENCE.md` (read-only): §11 defines effect modes (read/write/
irreversible × run/simulation/test), §11.1 the double rules (registered against capability ID
+ compatible revision; run-snapshotted; missing double = denial; doubles must satisfy output
contracts), and invariants EFF-003/EFF-004 (fail-closed doubles; snapshot immutability). The
fictional inspection proof in [PROOF-DESIGN](PROOF-DESIGN.md) is expressed strictly within
these rules — no new simulation vocabulary is created.

## 7. Reconciliation verdict

Every load-bearing pack claim checked against local source holds: closed @1/@2 schemas and
versioned identity; release binding that already invalidates old releases when
`applicationVersion` changes; an explicit, context-carrying data-adapter boundary; fail-closed
run-snapshotted doubles; SDK→UI→application dependency direction; and an unused marker
namespace for the @3/UI document/version families. No reconciliation blocker was found; the
exact drafts these observations enable are pinned in [API-SPEC](API-SPEC.md) and exemplified
under [fixtures](fixtures/).
