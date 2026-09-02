# VICT Stage 04 — Capability and Application Authoring Report

## Outcome

`READY FOR FRESH INDEPENDENT AUDIT`

Every mandatory regression test and verification command succeeds (the full
ladder was reproduced three times for the full suite; see Verification
evidence). Stage 04 is NOT marked `Verified` — only an accepted independent
audit can do that. Stage 05 has not begun.

## Starting and final SHAs

| Item | Value |
| --- | --- |
| Required starting commit | `9678b260eb8477a7616bdf9cc3f038066dbcdbb5` (== `origin/main` after fetch; local main fast-forwarded from `810144f` through the two owner doc commits `d2ca3b4`, `9678b26`) |
| Stage 03 disposition at start | VERIFIED WITH NON-BLOCKING ISSUES — STAGE 04 PERMITTED |
| Implementation commit | `5897c69` — feat(stage-04): capability and application authoring foundation |
| Fixture commit | `882e4ff` — fix(stage-04): include the SQLite parser-throw close/reopen fixture (the staging pass initially missed this one new test file; caught by the fresh-clone count reconciliation) |
| **Final remote SHA** | **`882e4ff32ed427a0959816cecdde956791e20a30`** (== `origin/main` == local HEAD after push) |
| Owner worktree changes | PRESERVED untouched: moved documents (root `VICT-STAGE-02-*` → `docs/report/`, `docs/nightly/*` → `docs/report/`), `docs/handoff/VICT-STAGE-02-INDEPENDENT-VERIFICATION-HANDOFF.md`, `docs/handoff/VICT-STAGE-03-HANDOFF.md`, `VICT-v0.2.0-architecture-update.zip`. No reset, no discard, no history rewrite, fast-forward pushes only. |

## Architecture implemented

Exactly the Stage 04 scope of `docs/VICT-SYSTEM-REFERENCE.md` v0.2.0
(§23 Stage 4 "Includes"), plus the three authoring-boundary Low closures.
Full normative detail: `docs/architecture/STAGE-04-CAPABILITY-APPLICATION-AUTHORING.md`.

- Stable authoring-focused `@vict/sdk` (authoring ABI; contracts-only
  dependency; optional `./zod` subpath preserved).
- Capability-pack model: manifest + separately supplied bindings, pure
  validator, local explicit loading, least-authority configuration/secret
  resolution, permission gating before handler invocation, doubles and
  simulation policy, evaluations.
- Framework-neutral Application / Resource / Release Definitions
  (`@vict/sdk` types + frozen factories) with a compiling layer
  (`@vict/application`): validation with structured deterministic
  diagnostics, immutable Application Plans, canonical `applicationVersion`,
  release manifests with distinct release identity, renderer contract +
  versioned component registry + application-data adapter contract with
  shared conformance fixtures, and an in-memory reference data adapter.
- One minimal real SvelteKit vertical proof
  (`examples/application-proof`).
- Closure of the three Stage 03 Low findings (throwing parsers, unknown
  authoring fields, wait/delay bounds).

Excluded exactly as mandated: Stage 05 component suite, production
application-domain SQLite, full application-host scaffolding, React or a
second renderer, visual authoring, remote pack registries, untrusted plugin
execution, control plane/public API, the real ARA product, Builder Kit,
Studio, speculative YAML/domain languages. No Stage 05 work was started.

## SDK dependency correction

Before: `@vict/sdk` was a facade depending on contracts + kernel + runtime
and re-exporting the runtime composition API. After:

```text
@vict/contracts
        ↓ (imported by)
@vict/sdk
        ↓ (imported by)
@vict/kernel   (+ @vict/application which imports contracts + sdk)
        ↓ (imported by)
@vict/runtime
        ↓ (imported by)
@vict/store-sqlite
```

- `packages/sdk/package.json` dependencies: `@vict/contracts` only
  (optional `zod` peer for `./zod`). `@vict/kernel` and `@vict/runtime`
  dependencies REMOVED.
- Authoring definitions (graph language, capability vocabulary,
  effect/execution modes, retry limits, capability definition/context/
  doubles) moved to `@vict/sdk`; kernel and runtime import them from there
  and retain convenience re-exports (acyclic).
- Runtime composition APIs are imported explicitly from `@vict/runtime`
  (examples, tests, benchmark, and the packed consumers were updated).
- No compatibility facade recreates the forbidden direction. The packed
  consumer checks prove: `@vict/sdk` installs and authors
  contracts/capabilities/graphs/packs/applications/resources/releases
  WITHOUT `@vict/runtime` (and without Svelte/Zod); its emitted
  declarations contain no runtime/kernel/svelte/zod references.
- ARA, orchestration proof, benchmarks, and all tests updated accordingly
  (behavior unchanged: ARA 13 events, bench 10 events/run).
- Migration table for the intentional pre-1.0 import changes: architecture
  doc §1.1.

## Capability-pack model

- Manifest `vict.capability-pack@1` (closed schema): pack id + semver,
  `victCompatibility` range, capability declarations (id/revision/effect/
  exact contract id+revision references/idempotency/retry/permissions/
  configuration/secret requirements/ambiguity), contract declarations,
  permission descriptors, configuration descriptors (names only), secret
  REFERENCE descriptors (names only — value-like fields rejected with
  `PACK_EMBEDDED_SECRET_VALUE`), double declarations, evaluations,
  documentation, provenance. Serializable manifests never contain handlers
  or resolved secret values.
- Bindings (handlers + neutral contracts) are cross-validated against the
  manifest by the pure `validateCapabilityPack`: missing, duplicate, extra,
  revision-mismatched, and contract-mismatched bindings fail with stable
  `PACK_*` diagnostics (path-sorted). Compatibility ranges are evaluated
  against `VICT_RUNTIME_COMPAT_VERSION` and fail with
  `PACK_COMPATIBILITY_UNMET`.
- `installCapabilityPack(runtime, pack)` is explicit and LOCAL — no remote
  loading, no package installation, no marketplace, no untrusted execution.
- Least authority: grants/ports live on the runtime
  (`authority` option); the registry wraps `invoke` at registration so the
  gate is captured by activations and enforced identically on the
  sequential and durable engines. Missing grants fail BEFORE handler
  invocation (`VICT_RUNTIME_PERMISSION_DENIED`, default-deny). Required
  configuration/secrets resolve before invocation
  (`VICT_RUNTIME_CONFIGURATION_UNAVAILABLE` /
  `VICT_RUNTIME_SECRET_UNAVAILABLE`). Scoped readers expose ONLY declared
  names; undeclared names are unavailable (structured errors). No service
  locator, stores, registry, or unrestricted mutation in the context.
- Two offline workspace packs pass the SAME shared conformance suite:
  `packs/notes-pack` (pure/read) and `packs/ledger-pack` (keyed write with
  permissions, required configuration + secret, declared ambiguity, and a
  simulation double). Evidence includes: mismatch/compat/duplicate/unknown
  rejection, mutation-after-capture isolation, double-runs-without-real-
  write (invocation-delta probe), undeclared access denial, and
  secret-canary non-leakage into manifests/events/results/history.

## Application and resource model

- `vict.application@1` and `vict.resource@1` closed schemas with explicit
  revisions everywhere identity depends on them. Applications declare
  ordered navigation routes, screens with named ordered regions and
  ordered surfaces, typed views, contract-validated forms (ordered
  fields), five action kinds, resource references, component references,
  loading/empty/validation/denied/failure state declarations,
  compatibility declarations, and a theme reference. Resources declare
  identity, an explicit field catalogue, explicit contract references,
  relationships, supported query/filter/sort/pagination/projection,
  permitted mutations (effect, contracts, idempotency, permissions),
  presentation hints, and authorization/effect metadata. Resource
  definitions do not grant storage authority.
- `compileApplication` produces a deep-frozen immutable Application Plan
  or structured deterministic diagnostics (duplicate ids; unknown root or
  nested fields; unknown routes/screens/regions/surface roles; navigation
  to missing routes; unknown view/form/action/field/resource/component
  references; unknown or revision-mismatched contracts (exact id/revision
  compatibility where pinned), capabilities, and components; undeclared
  mutations; embedded configuration/secret values where only references
  are allowed; invalid release bindings). Nothing is silently skipped.
- Presentation metadata is separate from base validation contracts and is
  validated against the explicit resource field catalogue — no schema-
  library introspection anywhere.
- Unimplemented surface roles are reported honestly by the proof renderer
  (`RENDERER_UNSUPPORTED_ROLE` structured diagnostics); they are not
  silently omitted and not falsely claimed as delivered.

## Version and release identity

- `applicationVersion = v1_sha256(...)` over a versioned canonical form of
  the application manifest plus referenced resource/view/action revisions
  and component id/revision pairs under the `vict.application-identity@1`
  schema marker. Set-like collections are sorted; meaningful UI sequences
  (navigation order, region order, surface order, form-field order) are
  ordered semantics. All required properties are directly tested
  (determinism, insertion-order independence, sequence-order sensitivity,
  revision sensitivity for resources/views/actions/components, topology/
  presentation sensitivity, renderer-revision independence, and the
  absence of function text/timestamps/framework internals from the hash).
- `releaseVersion` is computed by a distinct versioned scheme over the
  closed release manifest; renderer/data-adapter revision changes alter
  release identity WITHOUT changing `applicationVersion` (tested).
  Resolved secrets, timestamps, and machine paths never enter either
  identity; unsafe provenance fields are rejected
  (`RELEASE_EMBEDDED_VALUE_FIELD`).
- Hashing uses an in-package pure-TS SHA-256 (byte-identical to
  `node:crypto`, vector-cross-checked) so `@vict/application` — and hence
  the renderer host — has no node builtin dependency.

## Renderer and data-adapter boundaries

- Framework-neutral `ApplicationRenderer` contract (browser-safe
  `@vict/application/renderer` subpath) consuming an immutable plan plus
  explicitly supplied bindings; structured `RendererDiagnostic` vocabulary
  (`RENDERER_UNSUPPORTED_ROLE`, `RENDERER_UNKNOWN_COMPONENT`,
  `RENDERER_COMPONENT_RESOLUTION_FAILED`, `RENDERER_INVALID_PLAN`);
  safe action/result/error mapping; no implicit authorization from
  visibility/disabled state (the proof demonstrates a visible action
  denied below the UI).
- Versioned component registry (`createComponentRegistry`): trusted local
  implementations registered OUTSIDE the serializable definition, exact
  id/revision resolution, frozen identity snapshots for releases.
- Shared conformance fixtures shipped in `@vict/application/testing`:
  `runRendererConformanceSuite` (role honesty, plan immutability,
  idempotent teardown, unknown component/revision before unsafe rendering,
  hostile-action canary) and `runApplicationDataAdapterSuite`
  (deterministic queries, declared mutations only, authorization before
  data access, keyed idempotent create reconciling to one row,
  caller-definition immutability). The real SvelteKit host passes the
  renderer suite; the in-memory reference adapter passes the data suite.
- Application adapters cannot touch `VictStores`: `@vict/application` has
  no runtime dependency (structurally checked), and the reference adapter
  exposes no store surface. The production SQLite domain-data adapter is
  NOT implemented (Stage 05).

**Package boundary decision:** `@vict/application` is one cohesive public
package (model + compiler + identity + release + renderer/data contracts +
conformance fixtures). Separate renderer/data/component packages were NOT
created — the responsibilities share one semantic model and the
implementation shows cohesion (ARCH-011/ARCH-015: no placeholder packages).

## SvelteKit vertical proof

`examples/application-proof` — real SvelteKit (Svelte 5, SvelteKit 2,
adapter-node), fully offline:

- one neutral definition (no Svelte) produces one navigable route (`/`),
  a typed resource view (declared projection columns), one
  contract-validated form (declared field order; contract rejection
  surfaces the declared validation state), one local presentation action,
  one real VICT capability action (`createRuntime().activate/run` across
  the declared input contract and effect policy — a durable run IS
  created), one boundary-denied admin action, one custom Svelte component
  (`Badge.svelte`, registered in a versioned registry OUTSIDE the
  manifest), and safe loading/empty/validation/denied/failure states;
- generic host/catch-all rendering boundary: the ONLY `+page.svelte` in
  the app is `src/routes/[...vict]/+page.svelte` (structural test) — no
  manual page shell was added for the declared screen;
- every action crosses the `/api/act` server boundary where the
  authorization profile lives; the local action creates zero durable runs;
  the denied action is refused server-side although its button renders
  (visibility ≠ authorization);
- evidence: fresh `npm run build` succeeds; the built adapter-node server
  was executed and exercised with real HTTP calls (create → row persisted,
  summarize → real run + validated output, adminDelete → DATA_UNAUTHORIZED,
  invalid create → CONTRACT_REJECTED); 10 offline DOM-level tests
  (happy-dom) including route-derivation, plan rendering, contract
  validation, run-count deltas, unknown component/revision diagnostics
  BEFORE unsafe rendering, and the no-Svelte/no-runtime scan of base
  declarations; the SHARED renderer conformance suite passes against the
  real Svelte host;
- base SDK and Application declarations contain no Svelte (and no
  runtime/kernel) module references — scan enforced in-test and in the
  packed consumers.

## Stage 03 Low findings closed

| Finding | Correction | Evidence |
| --- | --- | --- |
| LOW-1 throwing contract parsers / hostile issue getters | Parser throws caught at EVERY supported boundary (kernel sequential input/output; durable input; durable output/decision/join; signal payload; operator confirm; sanitizer getter-hardening). Sanitized stable terminal errors (`VICT_KERNEL_CONTRACT_PARSER_THREW`, `VICT_RUNTIME_CONTRACT_PARSER_THREW`); no downstream capability runs; durable engines commit one terminal failed outcome (no reclaim loop, no retry, no error-edge route); close/reopen preserves the terminal result exactly; parsers never run inside store transactions | `packages/kernel/test/authoring-boundaries` companions: `packages/runtime/test/parser-throw.test.ts` (6 tests incl. hostile getters + signal-boundary), `packages/store-sqlite/test/parser-throw.test.ts` (real SQLite close/reopen preserves terminal failure; recovery changes nothing); canaries (`RA4-PARSER-CANARY-*`, nested causes, hostile getters) absent from error, events, run records |
| LOW-2 unknown authoring fields | Closed-field validation for graph root, nodes (per kind, canonical-form aware), edges, wait descriptors, retry/backoff (kernel) with stable codes `UNKNOWN_GRAPH_FIELD/NODE/EDGE/WAIT/RETRY_FIELD`, safe paths, insertion-order-independent (path-sorted) ordering; plain-JS-object tests; closed schemas at application/pack/release boundaries from day one | `packages/kernel/test/authoring-boundaries.test.ts` (Stage 03 probe case now fails with `UNKNOWN_NODE_FIELD` and parse calls stay 0 via contract tests); application/pack/release unknown-field and deterministic-ordering tests |
| LOW-3 wait/delay bounds | One exact rule enforced at graph compilation with stable `INVALID_WAIT_BOUND`: positive finite safe integers within the 7-day bound when present; `undefined`/`null` absent; zero/negative/fractional/NaN/infinite rejected BEFORE activation/persistence (no timer scheduled, nothing persisted); deadline derivation overflow-safe; valid declared timeout behavior unchanged | `packages/kernel/test/authoring-boundaries.test.ts` (13 bound cases); Stage 03 HIGH-2 declared-timeout suites remain green; orchestration activation of invalid bounds fails at compilation on both adapters (shared `compileGraph` path), serialized-manifest regression covered by the canonical-form acceptance test |

## Files changed

**`@vict/contracts` (parser-throw hardening)**
- `packages/contracts/src/issue-mapping.ts` — hostile-getter-proof
  sanitization (`sanitizeContractIssues`, `safeIssueCode`).

**`@vict/sdk` (authoring ABI)**
- `packages/sdk/src/capability.ts` (NEW — capability vocabulary moved +
  Stage 04 authority fields), `graph.ts` (NEW — graph language moved),
  `application.ts` (NEW — Application/Resource/Release definitions),
  `pack.ts` (NEW — pack schema + pure validator + factories),
  `authoring.ts` (frozen factories incl. defineResource/defineApplication/
  defineApplicationRelease), `index.ts` (rewritten authoring surface),
  `zod.ts` (unchanged surface), `package.json` (deps: contracts only).
- `packages/sdk/test/sdk.test.ts` (rewritten: authoring ABI, immutability,
  pack validation).

**`@vict/kernel` (consumes sdk; LOW-2/LOW-3; LOW-1 sequential)**
- `src/types.ts` (moved authoring types → re-exports from `@vict/sdk`; new
  issue codes), `src/compile.ts` (closed schemas + `INVALID_WAIT_BOUND` +
  `isValidMsBound`), `src/execute.ts` (parser-throw terminal handling),
  `src/errors.ts` (+ `VICT_KERNEL_CONTRACT_PARSER_THREW`),
  `src/index.ts`, `package.json` (+ `@vict/sdk`).
- `test/authoring-boundaries.test.ts` (NEW).

**`@vict/runtime` (consumes sdk; LOW-1 durable; packs; authority)**
- `src/authority.ts` (NEW — least-authority gate), `src/pack-install.ts`
  (NEW), `src/pack-conformance.ts` (NEW shared suite), `src/registry.ts`
  (authority construction + gated captures), `src/runtime.ts` (authority
  option, signal/confirm parser hardening, classified invocation
  failures), `src/orchestration-driver.ts` (`parseSafely`, terminal
  parser-throw commit), `src/errors.ts` (new codes + classification),
  `src/types.ts` (moved types → re-exports; authority option),
  `src/index.ts`, `src/testing.ts`, `package.json` (+ `@vict/sdk`).
- `test/parser-throw.test.ts` (NEW), `test/bench-semantics.test.ts`,
  `test/snapshot.test.ts` (import direction).

**`@vict/application` (NEW package)**
- `package.json`, `tsconfig.json`, `src/compile.ts`, `src/sha256.ts`,
  `src/release.ts`, `src/renderer.ts`, `src/data.ts`,
  `src/renderer-conformance.ts`, `src/data-conformance.ts`, `src/index.ts`,
  `src/testing.ts`.
- `test/compile-identity.test.ts`, `test/conformance.test.ts`,
  `test/sha256.test.ts` (NEW).

**Capability packs (NEW workspace `packs/*`)**
- `packs/notes-pack` (pure/read pack + shared-suite test),
  `packs/ledger-pack` (write pack + shared-suite + adversarial tests).

**SvelteKit proof (NEW)**
- `examples/application-proof/*`: neutral definition + server boundary +
  generic catch-all host + custom component + API route + DOM/conformance
  tests + toolchain configs.

**Tooling & wiring**
- `scripts/verify-stage4.mjs` (NEW), `scripts/isolated-consumer-check.mjs`
  (import direction), `scripts/benchmark.ts` (import direction),
  root `package.json` (workspaces, build order, verify:stage4,
  example:application), `vitest.config.ts`, `tsconfig.json`,
  `eslint.config.js`, `.prettierignore`, `.gitignore`.

**Documentation**
- `docs/architecture/STAGE-04-CAPABILITY-APPLICATION-AUTHORING.md` (NEW),
  `docs/report/VICT-STAGE-04-REPORT.md` (this file), `README.md` (Stage 04
  section + commands).
- Stage 03 audit evidence untouched. System reference NOT marked
  `Verified`; no normative change was required — the implementation
  matches the v0.2.0 accepted target topology (reference §5.2) and
  Stage 4 scope.

## Verification evidence

Environment: Windows 11 Pro, MINGW64 (win32-x64), Node v22.13.1,
npm 10.9.2. Commands run from the working tree at the listed order after
`npm ci`. Fresh-clone verification: see "Fresh clone" below.

| Command | Exit | Observed result |
| --- | --- | --- |
| `npm ci` | 0 | clean install (workspace incl. packs + SvelteKit proof) |
| `npm run format:check` | 0 | all files Prettier-clean |
| `npm run lint` | 0 | 0 problems |
| `npm run typecheck` | 0 | strict, no errors |
| `npm run build` | 0 | all six packages build (contracts → sdk → kernel → runtime → store-sqlite → application) |
| `npm run test:unit` | 0 | 38 files / **409 tests passed** |
| `npm run test:integration` | 0 | 1 file / **4 tests passed** |
| `npm test` | 0 | 39 files / **413 tests passed — three consecutive runs 413/413** |
| `npm run verify:consumer` | 0 | packed tarballs: neutral consumer (no zod), Zod subpath consumer, SQLite close/reopen orchestration consumer |
| `npm run verify:stage2` | 0 | Stage 02 closure intact |
| `npm run verify:stage3` | 0 | Stage 03 closure intact (suites + offline proof + packed orchestration consumer) |
| `npm run verify:stage4` | 0 | build + unit + integration + proof + isolated packed consumers (author-only SDK, neutral application defs, Zod subpath; strict declarations; package-metadata dependency checks) |
| `npm run example` | 0 | ARA proof: **13 ordered events**, offline |
| `npm run bench` | 0 | bench-three-node-pure: 3 nodes / 2 edges / **10 events per completed run**; durable orchestration sections present |
| `npm run example:application` | 0 | SvelteKit proof builds (adapter-node) + **10/10 DOM-level tests** pass |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` | 0 unexpected | only intended Stage 04 changes + preserved owner changes |

### Isolated packed-package evidence (from `verify:stage4`)

1. **Author-only SDK usage without runtime/Svelte/Zod:** packed
   `@vict/contracts` + `@vict/sdk` tarballs installed into a fresh temp
   project (node_modules contains NO `@vict/runtime`, NO `@vict/kernel`);
   the consumer authors contract/capability/graph/pack/application/
   resource/release through `@vict/sdk` only; strict `tsc`
   (`skipLibCheck: false`) passes; the program runs.
2. **Neutral Application Definition usage without Svelte/Zod:** packed
   `@vict/application` (+ contracts + sdk) consumer compiles an
   application, asserts insertion-order-independent identity, release
   identity distinctness, registry resolution, and the reference data
   adapter; strict `tsc` + runtime pass. `@vict/application` package
   dependencies are exactly `@vict/contracts` + `@vict/sdk`.
3. **Optional Zod adapter with Zod installed:** packed `@vict/sdk/zod`
   consumer with `zod@3` passes strict `tsc` + runtime (frozen contract,
   safe issues).
4. **Svelte proof usage:** `npm run example:application` builds the real
   SvelteKit app and runs its DOM-level suite offline (its own vitest
   project with the svelte plugin + happy-dom).
5. **Emitted declarations complete and clean:** all consumers typecheck
   against emitted `.d.ts` with `skipLibCheck: false`; declaration scans
   prove base sdk/application declarations contain no `@vict/runtime`,
   `@vict/kernel`, Svelte, or Zod module references (comments stripped;
   imports are the dependency).

### Fresh clone (post-push)

A temporary fresh clone of `origin/main` (`882e4ff`) with NO pre-existing
`dist` artifacts (verified by directory listing before `npm ci`) reproduced
the complete ladder on Node v22.13.1 / npm 10.9.2, win32-x64:

| Command | Exit | Observed result |
| --- | --- | --- |
| `git status --short` (at clone) | 0 | clean tree, no artifacts |
| `npm ci` | 0 | clean install |
| `npm run typecheck` (BEFORE build) | 0 | strict, no stale-dist dependency |
| `npm run lint` | 0 | 0 problems |
| `npm run format:check` | 0 | all files Prettier-clean |
| `npm run build` | 0 | all six packages build |
| `npm run test:unit` | 0 | 38 files / **409 tests passed** |
| `npm run test:integration` | 0 | **4 tests passed** |
| `npm test` | 0 | 38 files / **413 tests passed** |
| `npm run verify:consumer` | 0 | packed neutral + Zod + SQLite orchestration consumers |
| `npm run verify:stage2` | 0 | Stage 02 closure intact |
| `npm run verify:stage3` | 0 | Stage 03 closure intact |
| `npm run verify:stage4` | 0 | isolated packed consumers + proof PASSED |
| `npm run example` | 0 | ARA proof: 13 ordered events |
| `npm run bench` | 0 | 3 nodes / 2 edges / 10 events per completed run |
| `npm run example:application` | 0 | SvelteKit proof build + **10/10 DOM tests** |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` (after ladder) | 0 | clean |

The fresh-clone count reconciliation caught and corrected one staging
omission (the SQLite parser-throw fixture, commit `882e4ff`); after the
fix the fresh clone matches the working tree exactly (413 tests).

## Regression matrix

| Requirement | Pass/Fail | Evidence |
| --- | --- | --- |
| `@vict/sdk` installs without `@vict/runtime` | PASS | verify:stage4 author consumer (node_modules listing) |
| `@vict/sdk` has no runtime dependency or re-exports | PASS | package.json metadata check; declaration scan |
| Author-only external consumer defines contracts/capabilities/graphs | PASS | author consumer runs (+ packs/application/release) |
| Base declarations contain no Zod/Svelte/runtime references | PASS | declaration scans (sdk + application) |
| Optional Zod subpath works when Zod is installed | PASS | zod consumer (tsc + run) |
| Package dependency graph acyclic | PASS | contracts→sdk→kernel/runtime→store-sqlite; application→contracts+sdk; verified by metadata + builds |
| Fresh-clone typecheck works before build | PASS | fresh-clone ladder (typecheck before build) |
| Two offline packs pass shared conformance | PASS | `packs/*/test` via `runCapabilityPackConformanceSuite` |
| Manifest/binding mismatch rejected | PASS | suite + ledger test (`VICT_PACK_INVALID`) |
| Compatibility mismatch rejected | PASS | suite (`PACK_COMPATIBILITY_UNMET`) |
| Duplicate IDs and unknown fields rejected | PASS | suite + sdk tests |
| Original object mutation has no effect after capture | PASS | sdk + suite isolation tests |
| Safe double runs without invoking the real write | PASS | suite invocation-delta probe (ledger counter) |
| Undeclared port or secret unavailable | PASS | gate tests + ledger probe test |
| Resolved secret values never enter manifests/history | PASS | canary scans (suite + ledger) |
| Throwing parser terminates safely (sequential) | PASS | `parser-throw.test.ts` |
| Throwing parser terminates durably (in-memory) | PASS | `parser-throw.test.ts` (no reclaim; recovery no-ops) |
| Throwing parser terminates durably (SQLite) + close/reopen terminal | PASS | `store-sqlite/test/parser-throw.test.ts` |
| Hostile issue getters cannot leak or wedge | PASS | hostile-getter tests; hardened sanitizer |
| Unknown JS node fields fail structurally | PASS | kernel authoring-boundaries tests |
| Unknown nested fields fail structurally | PASS | wait/backoff/form/manifest cases |
| Invalid wait/delay bounds fail at compilation | PASS | 13 bound cases (`INVALID_WAIT_BOUND`) |
| Valid wait/timeout behavior unchanged | PASS | Stage 03 suites green (409 unit incl. all Stage 03 conformance) |
| Identity: identical semantics → identical version | PASS | compile-identity tests |
| Identity: insertion order independent | PASS | set-like reorder test |
| Identity: meaningful sequence order matters | PASS | navigation/surface reorder tests |
| Identity: resource/action/component revision sensitivity | PASS | revision-bump tests |
| Identity: topology/presentation sensitivity | PASS | route-add test |
| Renderer revision does not alter `applicationVersion` | PASS | release tests (renderer is not an identity input) |
| Renderer revision alters release identity | PASS | release tests |
| Function text/timestamps/framework internals not hashed | PASS | identity formula + tests (no function/timestamp inputs) |
| Unknown route/screen/region/field/resource/action/component fail | PASS | compiler diagnostic tests |
| Duplicate IDs fail | PASS | compiler diagnostic tests |
| Contract revision mismatch fails | PASS | `CONTRACT_REVISION_MISMATCH` tests |
| Unsupported renderer role fails honestly | PASS | shared renderer suite + host role gate |
| Compiled plan immutable | PASS | freeze tests |
| No resolved secrets serializable | PASS | embedded-value rejection + canary scans |
| Shared renderer conformance suite passes | PASS | application tests + proof host test |
| Shared application-data conformance suite passes | PASS | reference adapter test |
| Data adapter cannot access operational stores | PASS | no runtime dep (structural) + adapter surface test |
| Local action remains presentation-local | PASS | proof run-count test (zero runs) |
| VICT action crosses runtime authorization/effect enforcement | PASS | proof capability test (durable run via public APIs) |
| Custom component resolves by exact ID/revision | PASS | registry tests + proof tests |
| Svelte proof builds and executes offline | PASS | `example:application` + built-server HTTP exercise |
| All Stage 01–03 tests continue passing | PASS | 409 unit + 4 integration (incl. all shared conformance suites on both adapters) |
| Durable-before-invocation ordering intact | PASS | Stage 03 race/boundary suites green |
| Waits/timers/retries/fan-out/join/cancellation intact | PASS | Stage 03 conformance/join/race/remediation/canary suites green on both adapters |
| ARA deterministic, exactly 13 events | PASS | `npm run example` |
| Three-node benchmark retains exactly 10 events | PASS | `npm run bench` |
| Packed consumers and restart fixtures continue passing | PASS | verify:consumer / verify:stage2 / verify:stage3 (incl. 6 real-process restart fixtures in the unit project) |
| No Stage 03 audit evidence rewritten | PASS | audit documents untouched in this change set |

## Compatibility decisions

- Pre-1.0 intentional import changes documented with a migration table
  (architecture doc §1.1): runtime composition from `@vict/runtime`,
  `KernelEvent` from `@vict/kernel`, `RunResult` from `@vict/runtime`,
  authoring types authored at `@vict/sdk`.
- No compatibility facade recreates the forbidden direction (the facade
  WAS the violation).
- Additive, default-absent context/definition fields (authority readers,
  permissions, configuration/secret requirements) keep existing
  definitions and identity semantics byte-compatible; canonical graph
  identity (`vict.graph@1/@2`) and activation markers are unchanged.
- Contract-sharing guidance: author contracts via `defineContract` /
  adapters (frozen) so shared identity is preserved through the new
  frozen-factory captures.
- The system reference was NOT modified and Stage 04 is NOT marked
  `Verified`. No normative architecture change was required by the
  implementation: the delivered direction equals reference §5.2's accepted
  target, and the `@vict/application` package name is justified under
  ARCH-011/ARCH-015 as a proven cohesive responsibility (documented in the
  architecture doc, §8 note).

## Security and canary evidence

Unique canaries used across the stage (all verified ABSENT from the
corresponding serialized surfaces):

- resolved secrets (`RA4-LEDGER-SECRET-CANARY-vault9`): absent from pack
  manifests, run results, events, default history;
- capability-thrown messages and nested causes
  (`RA4-PARSER-CANARY-nested-token`): absent from error, events, records;
- throwing contract parsers and hostile getters
  (`RA4-PARSER-CANARY-hunter2`, getter-thrown canaries): absent from
  every observable surface (sequential + durable + SQLite reopen);
- invalid application payloads (embedded `hunter2` secret values):
  rejected with stable codes, value never echoed into diagnostics;
- resource fields (catalogue validation rejects unknown fields);
- custom component binding failures (unknown id/revision diagnostics
  before unsafe rendering; hostile action canary
  `RA4-RENDERER-ACTION-CANARY` never surfaces through renderer output or
  diagnostics).

Serialized surfaces searched: pack manifests, application manifests,
Application Plans (`toJSON`), release manifests, compiler diagnostics,
renderer diagnostics, runtime events and traces, default run history,
SQLite operational surfaces (parser-throw SQLite test scans the run record
and the full event ledger before and after reopen). Secret values and raw
hostile messages are absent from all of them. Caller-owned identifiers
remain only as documented safe identifiers.

UI visibility, route guards, and disabled state are presentation only:
the proof renders a denied-marked surface while the action is re-authorized
(and denied) at the server data/capability boundary below the UI.

## Remaining risks

- The Stage 03 accepted Informational carry-forwards remain unchanged
  (completion-phase store faults surfaced only after lease lapse;
  cooperative in-flight cancellation race semantics). Both are documented
  in the Stage 03 re-audit and were not Stage 04 scope.
- The unit-suite "unsafe write timeout blocks" SQLite case exhibited a
  single timing flake under one heavily loaded combined run; it passed
  standalone, in all three consecutive full-suite runs, and in every
  verify run. No timing dependency was added by Stage 04 (the flake is in
  the pre-existing manual-clock Stage 03 fixture under extreme parallel
  load). Recorded honestly; no test was weakened.
- Full ladder executed on Windows (win32-x64) only; POSIX execution
  remains an environmental follow-up (consistent with Stage 02/03
  dispositions). Node 24 targeted checks were not available in this
  session's environment and remain recorded as an environmental
  limitation, consistent with the Stage 03 re-audit's Node-24 handling.
- The proof's capability action starts a real run per invocation through
  the public runtime; dispatch authorization is enforced at the single
  server boundary (one deployment profile). Multi-actor permission models
  remain Stage 06.

## Ready for independent audit?

YES

## Addendum — fresh-clone verification (post-push)

Recorded after pushing `main`: the temporary fresh clone of `origin/main`
at `882e4ff32ed427a0959816cecdde956791e20a30` reproduced the COMPLETE
ladder from a clean tree with no pre-existing `dist` artifacts — every
command exit 0 (see the Fresh clone table above). The temporary clone was
removed after verification.
