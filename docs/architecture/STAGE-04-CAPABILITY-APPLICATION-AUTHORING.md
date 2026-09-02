# Stage 04 — Capability and Application Authoring Foundation

> **Authority:** `docs/VICT-SYSTEM-REFERENCE.md` v0.2.0 (Stage 04 implements
> the accepted Application Layer amendment and OPEN-003/OPEN-004 decisions)
> **Scope:** the stable external authoring boundary for executable behavior
> (contracts, capabilities, graphs, capability packs) and for application
> structure (Application/Resource/Release Definitions, canonical identity,
> renderer and application-data ports), plus a minimal SvelteKit vertical
> proof.
> **Status:** implemented; NOT independently verified. Stage 04 is not
> marked `Verified` in the system reference — only an accepted independent
> audit can do that.

Stage 03 proved durable orchestration and permitted Stage 04 with three
authoring-boundary Low findings. Stage 04 closes those findings, corrects
the SDK dependency direction, and proves — with a real SvelteKit vertical —
that one neutral definition can describe both executable behavior and the
structure of a usable application without coupling the canonical model to
the runtime, SQLite, Svelte, or any schema library.

## 1. Public dependency direction

The verified dependency direction is now exactly the accepted target:

```text
@vict/contracts
        ↓  (imported by)
@vict/sdk
        ↓  (imported by)
@vict/kernel   (+ @vict/application, which imports contracts + sdk)
        ↓  (imported by)
@vict/runtime
        ↓  (imported by)
@vict/store-sqlite
```

Formal statement:

- `@vict/sdk` is a lightweight **authoring ABI**. It depends on
  `@vict/contracts` only (plus an optional `zod` peer for the `./zod`
  subpath). It does NOT depend on, re-export, or mention `@vict/runtime`
  anywhere in its exports. Capability-pack authors can install `@vict/sdk`
  without the runtime (proven by packed-consumer isolation).
- `@vict/kernel` and `@vict/runtime` CONSUME public authoring declarations
  (graph language, capability vocabulary, effect/execution modes, retry
  limits) from `@vict/sdk`; they no longer own author-facing definitions.
  Convenience re-exports remain in the kernel/runtime indexes (sourced from
  `@vict/sdk`), which keeps the graph acyclic.
- `@vict/application` (new) is the framework-neutral application
  model/compiler. It depends on `@vict/contracts` and `@vict/sdk` only —
  never on the runtime, a UI framework, or a schema library. It is
  browser-safe by construction (identity hashing uses an in-package
  pure-TS SHA-256 cross-checked against `node:crypto`, not `node:crypto`
  itself), so renderer hosts can compile and inspect plans.
- The SvelteKit proof imports public application + runtime APIs. Svelte
  never enters the base SDK or application declarations (structural scan
  enforced in the proof tests and the isolated packed consumers).
- Runtime composition APIs (`createRuntime`, stores, orchestration) are
  imported explicitly from `@vict/runtime`.

### 1.1 Migration table (intentional pre-1.0 import changes)

| Before (≤ Stage 03)                          | After (Stage 04)                                    |
| -------------------------------------------- | --------------------------------------------------- |
| `createRuntime` / `VictRuntime` from `@vict/sdk` | import from `@vict/runtime` explicitly          |
| `RunResult` type from `@vict/sdk`            | import from `@vict/runtime`                         |
| `KernelEvent` type from `@vict/sdk`          | import from `@vict/kernel`                          |
| `ApplicationGraphDefinition`, node/edge/wait types, `RetryPolicy`, limits, `EffectClass`, `ExecutionMode`, `CapabilityDefinition`, `CapabilityContext`, `DoubleInvoke` re-exported from kernel/runtime | authoritative home is `@vict/sdk` (kernel/runtime still re-export them for convenience) |
| `@vict/sdk` package deps                     | `@vict/contracts` only (+ optional `zod` peer); `@vict/kernel` and `@vict/runtime` dependencies REMOVED |

There is no compatibility facade recreating the old direction: the facade
itself was the forbidden dependency.

## 2. SDK authoring ABI

The base SDK surface is schema-neutral, framework-neutral, and frozen at
the factory boundary:

- `defineContract` (re-exported from `@vict/contracts`), `defineCapability`,
  `defineGraph`, `defineResource`, `defineApplication`,
  `defineApplicationRelease`, `defineCapabilityPack`.
- Every official factory returns a DEEP-FROZEN DEEP COPY. Function values
  (handlers, parsers) are captured by reference; frozen objects and
  contract-like objects (with a `parse` callable) are captured atomically so
  shared contract identity is preserved exactly as authored. Mutating an
  author's original object after definition cannot alter captured semantics
  (tested).
- Capability declarations may carry least-authority requirements
  (`permissions`, `configuration`, `requiredConfiguration`, `secrets`,
  `requiredSecrets`) enforced by the runtime before handler invocation.
- Base declarations contain no Zod, no Svelte, and no runtime implementation
  references (declaration scans in the packed consumers prove it). The
  optional Zod adapter stays under `@vict/sdk/zod`.

## 3. Capability packs

A capability pack is one serializable manifest plus separately supplied
executable bindings.

- Manifest schema marker: `vict.capability-pack@1` (closed). Declares:
  stable pack id, semantic version, Vict compatibility range
  (`victCompatibility`), capability declarations (id, revision, effect,
  exact input/output contract id+revision references, idempotency, bounded
  retry, permission/configuration/secret requirements, declared ambiguity
  policy), contract declarations, permission descriptors, configuration
  descriptors (names, never values), secret REFERENCE descriptors (names,
  never values — value-like fields are rejected with
  `PACK_EMBEDDED_SECRET_VALUE`), double declarations, evaluations,
  documentation, provenance.
- Bindings carry the handlers and the neutral contract objects. Loading is
  explicit and local: `installCapabilityPack(runtime, pack)` cross-validates
  manifest ↔ bindings (missing, duplicate, extra, revision-mismatched, and
  contract-mismatched bindings fail deterministically with `VICT_PACK_*`
  issues), checks the compatibility range against the runtime's
  `VICT_RUNTIME_COMPAT_VERSION`, and only then registers contracts and
  capabilities. No remote loading, no package installation, no untrusted
  execution.
- Validation is pure (`validateCapabilityPack`) and lives in the SDK so
  packs can be validated without a runtime; diagnostics have stable
  `PACK_*` codes and safe paths, sorted by path.
- Both offline workspace packs pass the SAME shared conformance suite
  (`runCapabilityPackConformanceSuite` in `@vict/runtime/testing`):
  - `packs/notes-pack` (`vict.example.notes`) — pure/read behavior;
  - `packs/ledger-pack` (`vict.example.ledger`) — keyed-idempotent write
    with declared permissions, required configuration and secret, declared
    ambiguity (`keyedRetry`), and a declared simulation double.

### 3.1 Least-authority configuration/secret resolution

- Grants and ports live on the RUNTIME
  (`createRuntime({ authority: { grants, configuration, secrets } })`).
- The registry wraps every capability's invoke with a gate at registration
  time; the WRAPPED invoke is what activations capture, so enforcement is
  identical on the sequential and durable engines.
- Declared permissions must be granted or invocation fails BEFORE the
  handler runs (`VICT_RUNTIME_PERMISSION_DENIED`). Default-deny: a
  definition declaring requirements is gated even with no authority
  configured.
- Required configuration/secret names resolve eagerly BEFORE invocation
  (`VICT_RUNTIME_CONFIGURATION_UNAVAILABLE` /
  `VICT_RUNTIME_SECRET_UNAVAILABLE` when absent or unprovisioned).
- Handlers receive SCOPED, name-checked readers (`context.config`,
  `context.secrets`); undeclared names throw structured authority errors —
  they are unavailable, never silently empty. Capabilities that declare
  nothing receive no readers at all.
- The capability context never exposes a service locator, stores, a
  registry, or unrestricted mutation.
- Structured authority failures keep their stable codes through both
  engines (`classifyInvocationFailure`); any other handler throw remains
  the sanitized `VICT_RUNTIME_CAPABILITY_THREW` class.

## 4. Application and Resource Definitions

Schemas (closed; unknown fields produce structured diagnostics; any
field named like an embedded value under a reference-only boundary is
rejected with `APPLICATION_EMBEDDED_VALUE_FIELD` /
`RELEASE_EMBEDDED_VALUE_FIELD`):

- `vict.application@1` — id, explicit revision, ordered navigation routes
  (path + screen + optional nav order), screens (named ordered regions of
  ordered surfaces), typed views, contract-validated forms (explicit field
  order = meaningful presentation semantics), actions, resource references
  (with explicit revisions), custom-component references (stable
  id/revision), safe state declarations (loading/empty/validation/denied/
  failure), compatibility declarations, theme reference.
- `vict.resource@1` — identity field, explicit field catalogue
  (type/required/label), explicit input/output contract references,
  relationships, supported query/filter/sort/pagination/projection
  declarations, permitted mutations (effect class, contracts, idempotency,
  permissions), presentation hints, authorization/effect metadata.
- `vict.application-release@1` — application id/revision/
  applicationVersion, renderer id/revision, component-registry identity,
  data-adapter compatibility, public Vict compatibility range, activation
  reference OR explicit `latest` selection policy, provenance (safe fields
  only — machine paths/secret-like fields rejected).

Actions have explicit kinds: `local` (presentation only), `navigation`,
`query`, `mutation`, `capability` (real Vict behavior through the runtime).
Every non-local action declares its resource/capability/contract
references; contract references may pin exact revisions
(`CONTRACT_REVISION_MISMATCH` on drift). Presentation metadata (labels,
field order, widgets) lives in the Application Definition, validated
against the resource's explicit field catalogue — never against schema
library internals, and never inside base contracts.

The canonical model is independent of Svelte and React. Unimplemented
surface roles are reported HONESTLY by the Stage 04 proof renderer
(structured `RENDERER_UNSUPPORTED_ROLE` diagnostics); they are not
silently omitted. The complete forms/tables/charts/component suite
remains Stage 05 scope.

## 5. Validation and diagnostic vocabulary

`compileApplication` (pure, never throws for invalid definitions) rejects:

- duplicate ids: route, route path, screen, region, surface, view, form,
  action, resource reference, component reference;
- unknown root or nested fields (closed schemas at every boundary);
- navigation pointing at missing routes; unknown screens, regions-as-field
  references, surface roles;
- unknown view/form/action references; unknown form submit actions;
- unknown resource references; resource revision mismatches; fields not in
  the explicit catalogue;
- unknown contract references and incompatible contract id/revision
  references (exact identity unless the reference omits revision);
- unknown capability references and capability revision mismatches;
- unknown component references and component revision mismatches;
- mutations used by actions that the resource does not declare;
- embedded configuration/secret values where only references are allowed;
- invalid release bindings (wrong application id/revision/version).

Kernel graph compilation gains the Stage 04 authoring diagnostics:
`UNKNOWN_GRAPH_FIELD`, `UNKNOWN_NODE_FIELD`, `UNKNOWN_EDGE_FIELD`,
`UNKNOWN_WAIT_FIELD`, `UNKNOWN_RETRY_FIELD` (path-sorted, insertion-order
independent; canonical `vict.graph@1/@2` manifest forms are accepted with
their full explicit-null field sets), and `INVALID_WAIT_BOUND`.

Compiled plans are deep-frozen; diagnostics are plain frozen data. Nothing
is silently skipped.

## 6. Canonical identity

```text
applicationVersion = v1_sha256(canonicalJson({
  schema: 'vict.application-identity@1',
  applicationSchema,                      // schema marker
  manifest: canonicalApplicationManifest, // set-like sorted, arrays preserved
  referencedResources,                    // id + resolved revision
  referencedViews,                        // view id + bound revision
  referencedActions,                      // action id + revision
  referencedComponents,                   // component id/revision pairs
}))
```

Properties (all directly tested):

- deterministic across processes (plain JSON + SHA-256, no randomness);
- independent of object insertion order (set-like collections sorted by
  id; object keys sorted recursively);
- meaningful UI sequences are ORDERED semantics: navigation route order,
  region order, surface order within a region, and form-field order change
  the identity when reordered — UI intent is never sorted away;
- changed when a referenced resource/view/action/component revision
  changes, and when topology or declared presentation semantics change;
- unchanged by renderer revision alone (the renderer is not an input);
- function text, timestamps, random values, Svelte internals, and
  schema-library internals are never hashed.

**Trust boundary (documented):** authors and build tooling remain
responsible for bumping explicit revisions when implementation semantics
change. Identity reflects DECLARED semantics; it cannot observe handler
bodies (the same accepted rule as capability revisions).

## 7. Application Release

```text
releaseVersion = v1_sha256(canonicalJson({
  schema: 'vict.application-release-identity@1',
  release,   // the closed release manifest
}))
```

Distinct from `applicationVersion`: changing the renderer or data-adapter
revision changes `releaseVersion` WITHOUT changing `applicationVersion`
(tested). Resolved secrets, timestamps, and machine-specific paths never
enter either identity (unsafe provenance fields are rejected).

## 8. Renderer, component, and application-data boundaries

- **Renderer contract** (`@vict/application/renderer`, browser-safe
  subpath): `ApplicationRenderer` consumes an immutable plan plus
  explicitly supplied bindings (component registry + action dispatcher).
  Structured diagnostics (`RendererDiagnostic`): `RENDERER_UNSUPPORTED_ROLE`
  (honest unsupported-role reporting — never silent omission),
  `RENDERER_UNKNOWN_COMPONENT`,
  `RENDERER_COMPONENT_RESOLUTION_FAILED`, `RENDERER_INVALID_PLAN`.
- **Component registry:** versioned (`registryId`, revision), registers
  trusted local implementations OUTSIDE the serializable definition,
  resolves by exact id/revision, exposes a frozen identity snapshot for
  release manifests. No manifest-driven imports; no untrusted code.
- **Shared renderer conformance** (`runRendererConformanceSuite`): role
  coverage honesty, plan immutability, idempotent teardown, unknown
  component/revision diagnostics before unsafe rendering, safe
  action/result/error mapping with a hostile-action canary. The real
  SvelteKit proof host passes this suite (test in the proof package).
- **Application-data port** (`@vict/application`): storage-neutral
  `ApplicationDataAdapter` with an explicit authorization/effect context on
  every call; adapters MUST NOT import, expose, or mutate `VictStores`
  (structural: the package has no runtime dependency; the in-memory
  reference adapter carries no store surface). Shared conformance
  (`runApplicationDataAdapterSuite`): deterministic list/sort/filter/
  pagination/projection, get/unknown identity/unknown resource, declared
  mutations only, authorization enforced before data access, keyed
  idempotent create reconciling to one row, caller definitions never
  mutated. `createInMemoryApplicationData` is the Stage 04 reference
  adapter; the production SQLite domain-data adapter is explicitly Stage 05.

Application data remains separate from Vict operational stores at the
package, port, and authority level (APP-009/DATA-014 direction).

## 9. SvelteKit proof boundary

`examples/application-proof` is a REAL SvelteKit application
(adapter-node, offline, no external services):

- one neutral definition (`src/lib/application/definition.ts` — no Svelte)
  declares one route, a typed resource view, a contract-validated form, a
  local presentation action, a real VICT capability action, a
  boundary-denied admin action, a custom-component reference, and
  loading/empty/validation/denied/failure states;
- the ONLY page component is the generic catch-all
  `src/routes/[...vict]/+page.svelte` (structural test: exactly one
  `+page.svelte` exists); the compiled plan drives the generic host;
- the server boundary (`/api/act` + `+page.server.ts`) compiles the plan,
  reads declared views through the application-data port, and dispatches
  every action with the server-side authorization profile: mutations cross
  the data adapter's authorization/effect boundary, the capability action
  starts a REAL Vict run through `createRuntime().activate/run` crossing
  the declared input contract and effect policy, the local action stays
  local (zero durable runs created), and the admin action is denied by the
  boundary although its button is visible (UI visibility ≠ authorization);
- the custom `Badge.svelte` component is registered in a versioned
  registry OUTSIDE the manifest and resolved by exact id/revision; an
  unknown id/revision fails with a structured diagnostic before any unsafe
  rendering;
- DOM-level tests (happy-dom, offline) plus the shared renderer
  conformance suite provide the evidence; the built app was executed with
  real HTTP calls against `/api/act` (create, summarize, denied,
  contract-reject).

This proof validates the architecture. It is not the Stage 05 production
component system: forms/tables/charts/conversation components, theming,
the SQLite domain-data adapter, scaffolding, and the complete reference
proof of §17.10 of the system reference remain Stage 05.

## 10. Stage 03 Low findings closed

1. **Throwing contract parsers (LOW-1).** Every supported validation
   boundary catches author parser throws: sequential engine (kernel
   `execute`), durable input parse, durable output/decision/join parse
   (driver `parseSafely`), signal payload validation, and operator
   confirmation. A parser throw becomes a stable, framework-generated,
   sanitized terminal failure (`VICT_KERNEL_CONTRACT_PARSER_THREW` /
   `VICT_RUNTIME_CONTRACT_PARSER_THREW`): the raw thrown message, nested
   causes, and hostile issue-getter values are never retained; no
   capability downstream runs; the durable engines commit ONE terminal
   failed outcome (no retry, no error-edge route, no silent reclaim loop);
   close/reopen preserves the terminal result exactly. Author parsers
   never execute inside SQLite transactions. Adversarial canary tests cover
   sequential, in-memory durable, and SQLite durable (with real
   close/reopen) execution. `sanitizeContractIssues` is hardened against
   throwing getters.
2. **Unknown authoring fields (LOW-2).** Untyped JavaScript authors get
   structured rejections instead of silent stripping at graph, node,
   edge, wait, retry/backoff boundaries (kernel) and at every
   application/pack/release boundary (@vict/application + sdk pack
   validator). Diagnostics carry stable codes and safe definition paths
   and are insertion-order independent (path-sorted). The Stage 03 probe
   (misspelled `outputContractId`) now fails compilation with
   `UNKNOWN_NODE_FIELD` and the declared contract is never silently
   dropped.
3. **Wait and delay bounds (LOW-3).** One exact rule, enforced at graph
   compilation with the stable `INVALID_WAIT_BOUND` diagnostic:
   `timeoutMs`/`delayMs`, when present, must be positive finite safe
   integers within the 7-day operational bound; `undefined`/`null` mean
   absent; zero/negative/fractional/NaN/infinite are invalid. Rejection
   happens before activation/persistence (nothing is persisted, no timer is
   ever scheduled); deadline derivation cannot overflow
   (`now + MAX_DELAY_MS_LIMIT` stays far below 2^53). Valid declared
   timeout behavior is unchanged (Stage 03 HIGH-2 suites remain green).

The Stage 03 audit and re-audit documents are NOT rewritten; the
remediation report's post-re-audit correction stands.

## 11. Compatibility and migration decisions

- Pre-1.0 breaking import changes are accepted and documented in the
  migration table (§1.1). No compatibility facade recreates the old SDK
  facade.
- Stage 01–03 canonical identity is unchanged: capability-only graphs keep
  `vict.graph@1` byte-compatible identity; control graphs keep
  `vict.graph@2`. The kernel's definition types moved to `@vict/sdk` by
  re-export (no semantic change; identity vectors are untouched by the
  move).
- `CapabilityContext` gained OPTIONAL scoped readers
  (`config`/`secrets`) and `CapabilityDefinition` gained OPTIONAL
  authority fields; both are additive and default absent, so existing
  definitions behave identically.
- Registry contract-identity semantics are unchanged: shared FROZEN
  contracts keep their object identity through `defineCapability`; the
  documented guidance is to author contracts with `defineContract` /
  adapters (which freeze).

## 12. Exact Stage 05 boundary

Stage 05 (not started) owns: the canonical SvelteKit renderer component
suite (forms, tables, charts, tabs, dialogs, conversation surfaces), the
one-time host scaffolder, theming/design tokens, the local SQLite
application-domain adapter with separate migrations, generated safe CRUD,
renderer/data-adapter packed verification, and the complete §17.10
reference proof. Stage 04 stops at the authoring foundation, the neutral
contracts with conformance fixtures, and the minimal vertical proof.
No Stage 05 work has begun.
