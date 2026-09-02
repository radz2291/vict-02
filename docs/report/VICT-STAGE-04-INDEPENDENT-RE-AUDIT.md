# VICT Stage 04 — Focused Independent Re-Audit

## Verdict

**NOT VERIFIED — STAGE 05 BLOCKED**

## Stage 05 readiness

**NO**

The remediation is substantial and high-quality: all three original High
findings were re-verified as closed with fresh adversarial probes, the
capability/pack/doubles/canonical-identity/application-data/renderer
remediations all reproduce, the full ladder passes (491 tests, three
consecutive identical runs), and the permanent remediation suites behave as
genuine negative controls (49 of 77 of their tests fail against `0f84d2e`,
all 77 pass at `77e4dee`). However, the re-audit found **one new High
defect introduced by the remediation itself** — the authority invocation
caches that replaced the TOCTOU defect are scoped to the capability's
lifetime, not to the invocation, so required configuration/secret values
are resolved at most once per capability LIFETIME (stale values across
invocations) and a rejected provider promise is cached permanently
(transient provider failure permanently disables the capability) — plus
one Medium residue on MED-04-G (the release binding cross-check is opt-in;
a release claiming false renderer/registry/adapter identities and a stale
exact activation still compiles whenever the binding context is omitted).
Stage 05 builds directly on the authority boundary and the release
pipeline, so these must close first.

## Audited SHA and environment

| Item | Observed |
| --- | --- |
| Repository | `https://github.com/radz2291/vict-02` (fresh clone, new audit workspace; the owner worktree was never used for testing) |
| Required remediation target | `77e4deeae33389c3ccef084d29e03f7278d44fc1` — exact checkout after `git fetch origin`; `git status --short` clean |
| Original audited implementation | `0f84d2eddebe1edf9a66f1751a6483abf7464dfe` — in ancestry (temporary worktree, built, probed, removed) |
| Original audit commit | `4ed8686bdd864123ac31433325055aff33b60d51` — in ancestry; `git diff 4ed8686 77e4dee -- docs/report/VICT-STAGE-04-INDEPENDENT-AUDIT.md` is **empty** (byte-identical) |
| Pre-existing `dist` artifacts | none (verified by directory listing before `npm ci`) |
| OS / architecture | Windows 11 Pro, MINGW64_NT-10.0-26200, win32-x64 (AMD64) |
| Node / npm | v22.13.1 / 10.9.2 (satisfies `>=22.13.0`; Node 24 and a second OS remain unavailable — environmental limitation, consistent with prior stages) |
| Session discipline | fresh clone, fresh probes written from source; the original audit's adversarial knowledge was reused only as a checklist, never as cached results |

Documents read in full: system reference (Stage 4 section + invariants),
Stage 04 architecture document (post-remediation), Stage 04 report, the
original independent audit, and the audit remediation report. The complete
remediation diff `4ed8686..77e4dee` (6 commits, 72 files, +9818/−1059) was
inspected.

## Executive conclusion

The remediation is genuine and deep, not cosmetic. Fresh independent
probes confirmed:

- **HIGH-04-A closed:** pack installation is a registry-level staged batch;
  collisions on the first/middle/final capability, contract collisions,
  batch-internal duplicates, repeat installations, and double collisions all
  leave the registry semantically unchanged (probe: no capability of the
  failed pack is registrable/activatable, the pack's contract is absent),
  and a clean installation of the same pack succeeds fully.
- **HIGH-04-B closed:** the component registry uses structural
  (componentId → revision) keys; the audit's exact `('a','1@2')` /
  `('a@1','2')` probe coexists, resolves to different implementations, and
  appears verbatim in the frozen `identity()` snapshot. Whitespace and
  empty ids/revisions are rejected.
- **HIGH-04-C closed:** authority declarations are validated, copied, and
  frozen at registration; mutating the raw permission array after
  registration and after activation no longer changes enforcement on the
  sequential, in-memory durable, and SQLite engines. Changed declarations
  change `capabilitySetVersion`/`activationVersion`; changed grants do not.
- MED-04-A/B/C/D/E/F/H and the adjacent Low closures verified closed with
  fresh probes (details below).

But adversarial probing of the remediation itself found that the
LOW-04-H (TOCTOU) fix overcorrected into a **cross-invocation cache**:
`gateCapabilityInvoke` declares its value caches in the gate closure rather
than inside the per-invocation function, so "invocation-scoped" is factually
wrong in both directions — values are sticky for the capability's lifetime
and provider failures poison every later invocation. The remediation's own
tests only ever run one invocation per runtime, so the defect is invisible
to them. This is a new **High** finding (HIGH-04-D) and it blocks.

## Verification ladder

Fresh clone at `77e4dee`, no pre-existing `dist`, clean tree. Every exit
code observed directly:

| Command | Exit | Observed result |
| --- | --- | --- |
| `git fetch origin` + checkout | 0 | HEAD == `77e4dee` == `origin/main` |
| `git status --short` (pre-install) | 0 | clean; no `dist` |
| `npm ci` | 0 | clean workspace install |
| `npm run typecheck` | 0 | strict, before build |
| `npm run format:check` | 0 | Prettier-clean |
| `npm run lint` | 0 | 0 problems |
| `npm run build` | 0 | all six packages build |
| `npm run test:unit` | 0 | **45 files / 487 tests passed** (remediation report claims 38 files — count slip, see LOW-RE-2) |
| `npm run test:integration` | 0 | **1 file / 4 tests passed** |
| `npm test` | 0 | **46 files / 491 tests passed** (claims 39 files); **3 consecutive identical runs** |
| `npm run verify:consumer` | 0 | packed neutral + Zod + SQLite orchestration consumers |
| `npm run verify:stage2` | 0 | Stage 02 closure intact |
| `npm run verify:stage3` | 0 | Stage 03 closure intact (six real-process restart fixtures included) |
| `npm run verify:stage4` | 0 | build + suites + proof + isolated packed consumers |
| `npm run example` | 0 | ARA proof: exactly **13 ordered events** (00–12, counted) |
| `npm run bench` | 0 | `bench-three-node-pure`: **10 events per completed run** |
| `npm run example:application` | 0 | SvelteKit proof builds (adapter-node) + **15/15 tests** |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` (after ladder) | — | only the auditor's temporary probe dir (removed before commit) |

Test-count claims: 487 unit / 4 integration / 491 total are **accurate**;
the file counts (38/39) are **inaccurate** (observed 45/46 — the seven new
remediation suites appear not to have been counted). Same class as the
original LOW-04-J; recorded as LOW-RE-2.

Repetition: the seven remediation suites
(`audit-remediation-pack`, `-authority`, `-capability-boundary`,
`-wait-scheduling`, `-capture`, `-identity`, `-canonical`; 77 tests) were
run **five consecutive times — 77/77 each, zero flake**. The built
adapter-node server was executed as a separate process (port 4599).

## Original finding closure matrix

| Finding | Disposition | Independent evidence | Severity |
| --- | --- | --- | --- |
| HIGH-04-A (pack atomicity) | **Closed** | Fresh probes: first/middle/final collisions, contract collision, batch-internal duplicate, repeat install, multi-revision co-install, failure-after-prepared-entries — all leave the registry unchanged (activation probes + contract-presence probes); clean install runs `PACK-IMPL`. Staged-batch source reviewed: no live-map mutation before the callback succeeds; commit order deterministic. | Closed |
| HIGH-04-B (component identity) | **Closed** | `('a','1@2')` + `('a@1','2')` coexist; each resolves to its own implementation; `identity()` reports both verbatim; snapshot frozen and immune to later registration; whitespace/empty ids/revisions rejected. No delimiter parsing remains (structural two-level maps, source-verified). | Closed |
| HIGH-04-C (authority pinning) | **Closed** | Raw-definition mutation (emptying `permissions`) after registration AND after activation no longer flips `VICT_RUNTIME_PERMISSION_DENIED` → completed on in-memory AND SQLite engines; new revision recaptures changed declarations; changed declarations change capabilitySet/activation versions; extra runtime grants do not. | Closed |
| MED-04-A (CONT-001 / proof output contract) | **Closed** | Missing input/output, malformed contract, and `VICT_RUNTIME_MISSING_CONTRACT` enforced for plain JS objects; the proof's `proof.summarize` output is kernel-validated (probe: hostile output → run `failed` with `VICT_KERNEL_CONTRACT_REJECTED`, nothing exposed). | Closed |
| MED-04-B (declared doubles) | **Closed** | Pack doubles install automatically; run in eligible modes only (`test`-only blocks in `simulate` and vice versa; never in `normal`); real handler untouched when the double runs; missing/extra/duplicate/wrong-target/wrong-revision double bindings reject the pack (`PACK_DUPLICATE_DOUBLE`, `PACK_EXTRA_BINDING`, `PACK_BINDING_REVISION_MISMATCH`, `PACK_UNKNOWN_DOUBLE_TARGET`); `pack-conformance.ts` no longer registers a substitute lambda (source-verified, negative control included). | Closed |
| MED-04-C (idempotency) | **Closed** | Failed creates do not consume keys (retry creates its own row); same key + same input reconciles; same key + different input is `DATA_IDEMPOTENCY_CONFLICT`; update/delete reject keys (`DATA_INVALID_REQUEST`); concurrent same-key commits one row; contract-rejected mutations never consume keys. | Closed |
| MED-04-D (defensive isolation) | **Closed** | Seeds deep-copied + domain-checked at creation (mutating a seed after adapter creation leaves stored state unchanged); returned rows are defensive deep copies (nested mutation cannot reach stored state); create/update reject unknown fields with one strict policy (`DATA_INVALID_INPUT`); wrong types rejected through the declared contract; no attacker-controlled fields retained (stored row keys verified). | Closed |
| MED-04-E (wait ceiling) | **Closed** | 7d+1ms, 30d, 1 year, and ~8.8e15 ms timers all compile and park runs; `Number.MAX_SAFE_INTEGER − 1` fails structurally at scheduling (`VICT_ORCH_*`), not at compile; retry-backoff and per-attempt-timeout bounds unchanged (`MAX_DELAY_MS_LIMIT` retained in `graph.ts` for retry/timeout fields only). | Closed |
| MED-04-F (canonical identity domain) | **Closed** | `nav.order` NaN/±Infinity/−0/string/function and BigInt/Date/cyclic/throwing-getter/hostile-proxy values all fail with `APPLICATION_NON_CANONICAL_VALUE` / `VICT_AUTHORING_*` — no version produced, no silent coercion (probe). | Closed |
| MED-04-G (local actions + release cross-checks) | **Partial** | Local action: **Closed** — real-DOM click with fetch/dispatch/run/data spies records exactly zero effects; the host executes the declared serializable transition for `kind: 'local'` (kind-driven, not hard-coded); direct HTTP `act.clear` → `UNKNOWN_ACTION`. Release cross-checks: implemented and verified for every mismatch (renderer id/revision, registry id, missing/extra/wrong-revision components, adapter, application id/revision/version) — but the binding context is **optional**: with no/partial context, a release declaring false renderer/registry/adapter identities and a stale exact activation still compiles (see RE-AUDIT MED-04-G-R). | Partial |
| MED-04-H (closed capability schema) | **Closed** | Unknown fields, misspelled authority fields, invalid effects (`wriite`, `teleport`), unsupported idempotency, non-array/duplicate authority names, whitespace ids/revisions all rejected with stable codes; a misspelled write effect can never downgrade write safety. | Closed |
| MED-04-I (immutable captures) | **Closed** | Frozen intermediates deep-copied (canary mutation does not reach captured definition); `parse`-bearing impostors copied (post-definition `parse` swap does not hijack); official branded contracts keep identity; cycles/exotics/bigints/throwing getters fail with structured `VictAuthoringError`; compilers do not freeze or mutate caller-owned objects. | Closed |
| LOW-04-A/B/C/D/E/F/G/H/J (adjacent) | **Closed** (one residue below) | Semver + effect vocabulary + closed fields enforced in the pack validator; standard-semver `^0.x` (0.2.0 against `^0.1.0` rejected, probe); deterministic co-install conflict in both orders (probe); hostile getters → structured diagnostics; provenance bounded; renderer canary mandatory + deep error-surface scan; compilers clone-then-freeze; adapter limits/projections validated; unknown routes return 404 (real server: HTTP 404, no hostile echo). | Closed |

## Atomic pack installation

`CapabilityRegistry.installBatch` stages every contract, effective
capability, and declared double into an overlay; all validation
(closed-schema gate, CONT-001, effect vocabulary, authority pinning) and all
collision checks run against live + staged state; the commit applies
contracts → capabilities → doubles only after the callback succeeds. Probe
results (independent reproductions):

- collision on first/middle/final capability → `VICT_RUNTIME_DUPLICATE_CAPABILITY`; only the pre-existing capability remains registered; the pack's shared contract is **not** present; pack capabilities are not activatable.
- contract collision (same id/revision, different object) → `VICT_RUNTIME_CONTRACT_CONFLICT`; no pack capability registered.
- batch-internal duplicate → `VICT_PACK_INVALID`; nothing registered.
- repeated installation → `VICT_RUNTIME_DUPLICATE_CAPABILITY` (fail-visible).
- new-revision co-install → succeeds; revision 1 remains resolvable.
- clean installation → all three capabilities registered, run completes with the pack's output.

Residue (new, **Low — RE-AUDIT LOW-RE-3**): on the direct
`runtime.registerCapability` path (not the pack path), the capability is
committed before its embedded contracts register; a contract conflict
therefore leaves the capability registered without its contract
(reproduced). Activation then fails on the missing contract, so nothing
unsafe executes; the residue is a partial-mutation wart on a non-pack path.

## Pack doubles

All declared-double semantics verified independently (probe matrix):
`modes: ['test','simulate']` runs in test and simulate and never in normal;
`['test']` blocks in simulate; `['simulate']` blocks in test; the real
handler runs in normal mode with real write-count zero when a double serves
a test/simulate run; missing/extra/duplicate/wrong-target/wrong-revision
double bindings reject the pack atomically; the shared conformance suite
uses the pack's declared double (no substitute lambda; it even contains a
negative control asserting the declared double served the run); irreversible
execution without a double remains blocked (fail-closed) in simulate. Run
snapshots and explicit `replaceDouble` semantics unchanged.

## Authority snapshot and activation identity

Pinning verified on sequential, in-memory durable, and SQLite engines
(mutation of the raw definition cannot change active enforcement; the
denial-side reproduction from the original audit now stays denied after
mutation). Identity sensitivity verified: changed declarations change
capability-set and activation versions; identical declarations with extra
runtime grants keep identical versions. Exact-activation restoration with
authority metadata is exercised by the SQLite suites (passed, including
close/reopen). **However, the invocation-cache semantics are defective —
see RE-AUDIT HIGH-04-D below.**

### RE-AUDIT HIGH-04-D (new, High) — authority caches are capability-lifetime scoped, not invocation-scoped

`gateCapabilityInvoke` (packages/runtime/src/authority.ts) declares
`configCache` and `secretCache` in the **outer closure**, outside the
returned per-invocation function. The wrapped invoke is captured once at
registration (and pinned into activations), so the caches persist across
all invocations of the capability for the lifetime of the runtime — they
are not "invocation-scoped" as claimed by the code comment, the
architecture (§3.1: "Each name is resolved AT MOST ONCE per invocation",
"invocation-scoped cache"), the remediation report, and this re-audit's
mandatory checklist. Fresh probe evidence (sequential engine; identical
mechanism on both durable engines):

```text
A: reads after run1 = 1 | reads after run2 = 1        (required config)
A: run1 output = v1 | run2 output = v1                 (stale value reused)
   VERDICT: CROSS-INVOCATION SHARED CACHE
B: run1 status = failed (provider threw; 1 read)
   run2 status (provider recovered) = failed
   error = VICT_RUNTIME_SECRET_UNAVAILABLE; secret reads total = 1
   VERDICT: REJECTED PROMISE CACHED ACROSS RUNS
```

Consequences, in severity terms:

1. **Stale authority values across invocations** — a rotated configuration
   value or secret is never re-read; every subsequent run of that capability
   (including durable runs restored from the pinned activation) uses the
   value captured on the first invocation. For a long-lived worker this
   silently extends a secret's lifetime past its rotation, which is a
   security-relevant authority-boundary defect.
2. **Permanent poisoning after a transient failure** — a rejected secret
   promise is cached (`secretCache.set` before await); one provider outage
   converts into `VICT_RUNTIME_SECRET_UNAVAILABLE` for **every** later run,
   with no recovery path short of re-activation/restart. On the durable
   engine the poisoned gate is part of the captured activation.
3. Concurrent runs share one cache (the checklist item "concurrent runs do
   not share invocation caches" fails).

The remediation's tests exercise exactly one invocation per runtime
(`audit-remediation-authority.test.ts` LOW-04-H block), so the defect is
invisible to the permanent suites. Correction: move the per-name caches
inside the returned invocation function (per-invocation closure) and add a
permanent two-consecutive-runs regression test with a counting provider.

## Capability contracts and neutral contract

Plain-JS rejection probes (all at `registerCapability`, the single public
boundary): missing input/output contract → `VICT_RUNTIME_MISSING_CONTRACT`;
contract without `parse` → `VICT_RUNTIME_INVALID_CONTRACT`; unknown and
misspelled fields → `VICT_RUNTIME_UNKNOWN_DEFINITION_FIELD`; `wriite`/
`teleport` → `VICT_RUNTIME_INVALID_EFFECT`; unsupported idempotency →
`VICT_RUNTIME_INVALID_CAPABILITY`; non-array and duplicate authority names →
`VICT_RUNTIME_INVALID_AUTHORITY`; whitespace ids/revisions rejected. A
misspelled write effect can never run the real implementation because it
never registers. The proof's capability output is validated by the kernel
before run completion; a hostile output fails (`VICT_KERNEL_CONTRACT_REJECTED`)
before any HTTP/DOM exposure.

### Neutral contract regression (`vict.neutral.json`)

The neutral contract accepts exactly the canonical JSON domain (structural
check, no coercion) and rejects everything else with structured issues.
Edge compatibility treats `neutral` as compatible with anything, **but the
kernel still runs each node's declared input contract at execution time**
(source-verified in `kernel/execute.ts`; probe-verified):
`specific → neutral` and `neutral → specific` edges are accepted at
compile, and a neutral node emitting `{evil:true}` into a
string-contracted input produces a run failure with
`VICT_KERNEL_CONTRACT_REJECTED` — the downstream handler never runs.
Incompatible specific → specific edges are still rejected
(`CONTRACT_INCOMPATIBLE`). Downstream capabilities therefore can never
receive data their own input contract rejects. Assessment: the neutral
compatibility rule is an **intentional, bounded exception** — a routing
permission only, not a data-validation bypass — consistent with the
documented CONT-001 remediation (capabilities with deliberately untyped
boundaries still declare and enforce a contract). It does not weaken the
conservative exact-identity rule for contracts themselves (identity is
still exact; only edge-level compatibility gains the neutral exception,
documented in the architecture and remediation report). Official-contract
branding uses `Symbol.for('vict.official-contract')` (global registry), so
a valid official contract remains branded even when strict package
resolution loads a second physical copy of `@vict/contracts`; branding is
non-enumerable and stamped before freezing.

## Immutable authoring captures

All six factories probed with mutable roots, shallow-frozen roots, frozen
intermediates with mutable descendants, `parse`-bearing impostors, genuine
official contracts, functions, cycles, exotic prototypes, symbols/bigints,
and throwing getters. Results: frozen intermediates are deep-copied
(canary mutation does not reach the capture); impostors are copied (a later
`parse` swap does not hijack captured behavior — the captured impostor still
parses successfully and is not the caller's object); only branded official
contracts keep identity (verified); cycles → `VICT_AUTHORING_CYCLIC_STRUCTURE`;
exotic prototypes/bigints → `VICT_AUTHORING_UNSUPPORTED_VALUE`; throwing
getters/proxies → `VICT_AUTHORING_HOSTILE_INPUT`; functions retain reference
identity; `defineApplication` neither freezes nor mutates the caller's
object and the capture is frozen. Contract identity preservation cannot be
forged: the brand is a non-enumerable, non-writable property stamped by the
official factory and checked together with `Object.isFrozen`.

## Wait bounds

Probed through `runtime.activate` (public boundary):

| Case | Result |
| --- | --- |
| Signal wait with a declared timeout edge but absent `timeoutMs` (`undefined`/`null`) | rejected `TIMEOUT_EDGE_WITHOUT_SIGNAL_TIMEOUT` (Stage 03 HIGH-2 semantics intact) |
| Signal `timeoutMs` = 0 / −100 / 1.5 / NaN / ±Infinity | rejected `INVALID_WAIT_BOUND` |
| Timer delay 7 days, **7 days + 1 ms**, 30 days, 1 year | activated; run parks `waiting` (no seven-day ceiling on durable waits) |
| Timer delay ~8.8e15 ms (largest safely schedulable) | activated; run parks `waiting` |
| Timer delay `MAX_SAFE_INTEGER − 1` (overflow domain) | compiles, **fails structurally at scheduling** with a stable `VICT_ORCH_*` failure — never a persisted unusable timestamp |

Retry-backoff and per-attempt-timeout operational bounds are unchanged
(`MAX_DELAY_MS_LIMIT = 7d` retained for retry `delayMs`/`maxMs` and node
`timeoutMs` in `kernel/compile.ts` — a separate, previously established
operational bound). MED-04-E closed.

## Canonical identity

Every audit collision now fails with structured diagnostics (probe):
`NaN`, `Infinity`, `−0`, string-valued numeric field, function value →
`APPLICATION_NON_CANONICAL_VALUE`; BigInt prop →
`VICT_AUTHORING_UNSUPPORTED_VALUE`; cyclic prop →
`VICT_AUTHORING_CYCLIC_STRUCTURE`; `Date` prop →
`VICT_AUTHORING_UNSUPPORTED_VALUE`; throwing getter →
`VICT_AUTHORING_HOSTILE_INPUT`; hostile proxy →
`VICT_AUTHORING_HOSTILE_INPUT`. No ambiguous `applicationVersion` is
produced in any case (the earlier "NaN vs null same version" collision is
now vacuously impossible — both fail). Hostile top-level graph/application
fields remain closed-schema rejected. Canonicalization hardening (strict
domain, structured diagnostics) did not alter previously verified
identities: a capability graph **without** authority declarations produces
**byte-identical** `graphVersion`, `capabilitySetVersion`, and
`activationVersion` at `0f84d2e` and `77e4dee`
(`v1_b0a7107b…`, `v1_8561c8e0…`, `v1_a9d30d2b…` in a direct cross-revision
probe). Authority-declaring capabilities change identity only when their
declared names change — exactly the documented migration impact. Valid
identities remain insertion-order independent for set-like collections,
order-sensitive for navigation/surface/form sequences, revision-sensitive,
deterministic across processes, and Unicode-safe (retained properties
re-tested by the canonical suite, 77/77 across five runs).

## Component and release identity

The component registry keys structurally; the audit's alias probe
coexists and resolves correctly; `identity()` is a frozen, sorted, verbatim
snapshot that later registrations cannot alter. Empty/whitespace-only ids
and revisions are rejected; exact duplicates rejected; multiple revisions
of one id supported; insertion-order independence holds (identity is
sorted).

Release binding cross-checks (with a full context): renderer id/revision,
registry id/revision, exact component list (missing/extra/wrong-revision
rejected), data-adapter id/revision, application id/revision/version, and
exact-activation staleness are all enforced with stable
`RELEASE_*_MISMATCH` diagnostics (probe). A compiled release is a frozen
defensive capture; later registry mutation does not change it.

**Residue (RE-AUDIT MED-04-G-R, Medium):** `CompileReleaseContext` is
optional, and each of its fields is optional. With no (or partial) context,
`compileApplicationRelease` compiles a release whose renderer id
(`renderer.i-am-not-real@999`), component registry
(`reg.TOTALLY-FALSE@9` with a ghost component list), data adapter, and
stale exact activation reference are all false — no diagnostic. The
architecture's §5 claim that "a release's registry identity is never merely
self-declared text" is therefore only true when the caller supplies the
actual identities. Additionally, the context itself consists of
caller-supplied descriptors: nothing binds them to the live registry
instances, so a buggy or hostile deployment tool can pass false context
values. The intended flow (proof server) supplies `registry.identity()`
directly and is correct, but the guarantee is opt-in rather than
structural. Required correction: make the binding context required for
releases that declare `components`/`renderer`/`dataAdapter` bindings (or
require it whenever the release declares those fields), and document the
trust boundary for context descriptors explicitly.

## Application-data boundary

Direct adapter probes (bypassing the Svelte server): declared input
contract executes (wrong types and hostile unknown fields rejected with
`DATA_INVALID_INPUT`; stored row contains exactly the declared fields);
output contract validated; failed creates never consume idempotency keys;
same key + same input reconciles to one row; same key + different input is
`DATA_IDEMPOTENCY_CONFLICT`; keys rejected on update/delete; concurrent
same-key mutations commit one logical row; contract-rejected mutations
leave the key unconsumed and the retry succeeds. Isolation: seed mutation,
returned-row mutation, and returned-nested mutation cannot reach stored
state (stored values verified unchanged). Queries: negative/fractional/NaN
limits and offsets → `DATA_INVALID_REQUEST`; unknown projection →
`DATA_INVALID_REQUEST`; unknown filter **field** → `DATA_UNSUPPORTED_QUERY`;
malformed resource → `DATA_UNKNOWN_RESOURCE`; hostile `get` identities →
`DATA_INVALID_REQUEST`; diagnostics never echo hostile values
(`DROP TABLE`, `$ne` absent from messages). Authorization (permission and
effect honesty) precedes any data access (`DATA_UNAUTHORIZED`). The shared
conformance suite (scenarios 7–13) independently detects the audit's
idempotency and isolation cases.

Two narrow query-strictness gaps (new, **Low — RE-AUDIT LOW-RE-4**):
unknown top-level query-request fields are silently ignored (the request
schema is not closed at runtime), and filter **values** are checked against
the serializable domain rather than the declared primitive filter type, so
an object value such as `{ $ne: null }` is accepted (harmless: comparison
is primitive equality in memory; no query-language semantics — but the
declared `filters: string|number|boolean` type is not runtime-enforced).

## Local actions and renderer safety

The host executes `kind: 'local'` actions through a kind-driven branch
(`action?.kind === 'local'` → declared serializable `reset-transient`
transition), not an `act.clear` hard-code. The proof's remediation test
clicks the real button under `fetch` and dispatcher spies (both throw
canaries) and asserts zero network calls, zero dispatcher invocations, and
that the declared transient state reset occurred; the server dispatcher
refuses `act.clear` with `UNKNOWN_ACTION` (confirmed over direct HTTP).
Dispatcher failures of every shape (sync throw, rejected promise, nested
cause, delayed rejection, hostile action-result message, hostile
component-resolution message) are caught by `safeDispatch` and mapped to a
renderer-generated safe failure; the shared conformance suite mandates the
hostile-action canary for action-capable renderers, inspects
`message`/stack/`cause`/enumerable details (not just `JSON.stringify`),
requires a real trigger (DOM click in the Svelte fixture), and fails on
unhandled rejections — the Svelte proof passes it (15/15). The documented
macrotask-drain limitation (a ~10 ms window for unhandled-rejection
attribution) is assessed **genuinely Low**: it is a test-harness
observability limit, fail-safe (process-level handlers still catch late
rejections; the canary cannot be hidden from them), and narrow.

## SvelteKit proof

Built (adapter-node) and probed in a separate process (port 4599):

| Probe | Result |
| --- | --- |
| `GET /` | 200; screen, view, form, actions, custom badge component all from the neutral definition |
| `GET /nonexistent-page` | **404** (structured not-found; no hostile path echo, no canary) |
| `POST /api/act act.create {id:'n1',title:'alpha'}` | `ok:true`; row persisted |
| `POST /api/act act.create {id:'',title:42}` | `CONTRACT_REJECTED`; nothing stored |
| `POST /api/act act.summarize` | `ok:true {summary:'hello (5 chars)'}` — real VICT run, output contract validated in-runtime |
| `POST /api/act act.adminDelete` | `DATA_UNAUTHORIZED` — denied below the UI over raw HTTP |
| `POST /api/act act.clear` (local action over HTTP) | `UNKNOWN_ACTION` (no server-side local handler) |
| `POST /api/act act.nope` | `UNKNOWN_ACTION` |
| malformed JSON | HTTP 400 |

## Regression and compatibility

- Stage 01–03 adversarial suites run within the 45-file unit suite plus
  `verify:stage2` / `verify:stage3` (packed consumers, six real-process
  restart fixtures): all green, three consecutive full runs.
- Durable-before-invocation, activation snapshots, exact-activation
  restoration, payload/error sanitization, irreversible simulation,
  waits/signals/timers, retries, fan-out/join, cancellation/fencing,
  operator resolution, and SQLite atomic boundaries: covered by the green
  conformance/fault/race/lifecycle suites on both adapters.
- ARA: exactly 13 ordered events. Benchmark: exactly 10 events per
  completed three-node run. Both re-executed directly.
- Identity comparison across remediation: authority-free definitions keep
  byte-identical versions (probe above); the only intended identity change
  is the documented authority-names fingerprint for capabilities that
  declare authority, plus the removal of the wait ceiling (previously
  ceiling-rejected durations now activate — intended).

## Negative-control assessment

The seven permanent remediation suites (77 tests) were executed at
`77e4dee` (77/77, five times) and, in a temporary worktree built from
`0f84d2e`, against the audited implementation: **49 of 77 fail** at
`0f84d2e`; 28 pass. The remediation report's "38 of 47 scenarios" used a
different scenario granularity (its `it.each` blocks counted once each);
independently reproducing at test granularity gives 49 failures, which is
consistent in substance (its claim that the majority of scenarios fail
against the audited implementation holds). Verified properties of the
controls:

- They exercise public behavior only (`installCapabilityPack`,
  `registerCapability`, `activate`/`run`, `createComponentRegistry`,
  `compileApplicationRelease`, `compileApplication`, the reference data
  adapter, real DOM clicks).
- No remediation-specific bypasses: the pack suite does not register a
  manual substitute double; the authority suite reads provider counts; the
  capture suite mutates live descendants after definition.
- Representative failures reproduced at `0f84d2e` (observed directly):
  the seven-day ceiling rejecting a one-year timer
  (`INVALID_WAIT_BOUND … bounded by 604800000`); the frozen-intermediate
  live alias (`RA4-CANARY-MUTATED` in the captured definition); the
  impostor `parse` hijack; contract-less capabilities registering; partial
  pack registration after mid-install collisions.
- The 28 tests passing at both revisions are pre-existing invariant tests
  (duplicate-identity rejection, multiple revisions, insertion-order
  independence, etc.) — correctly not claimed as remediation evidence.

One test-hygiene issue: `packages/runtime/test/dbg3-out.txt` (a one-line
stale error message) was committed in the remediation chain — a stray
debugging artifact, not a test (new **Low — RE-AUDIT LOW-RE-1**; remove it).

## New findings

| ID | Severity | Finding |
| --- | --- | --- |
| **HIGH-04-D (new)** | **High** | Authority invocation caches are capability-lifetime scoped, not invocation-scoped: required configuration/secret values are resolved at most once per capability LIFETIME (stale values across invocations, including rotated secrets), and a rejected secret promise is cached permanently, so one transient provider failure permanently disables the capability (`VICT_RUNTIME_SECRET_UNAVAILABLE` on every later run) on both engines — contradicting architecture §3.1, the code's own comments, the remediation report, and this re-audit's mandatory invocation-cache checks. Evidence: two-run probe (config read once across both runs; run 2 reused run 1's value; poisoned secret gate never re-reads despite provider recovery). |
| RE-AUDIT MED-04-G-R | **Medium** | The MED-04-G release binding cross-check is opt-in: with an omitted or partial `CompileReleaseContext`, `compileApplicationRelease` compiles releases with false renderer/component-registry/data-adapter identities and a stale exact-activation reference, no diagnostics (probed). The context's descriptors are themselves caller-supplied text with no binding to live registry instances. The architecture's "never merely self-declared text" claim overclaims the guarantee. |
| LOW-RE-1 | Low | `packages/runtime/test/dbg3-out.txt` — a stray debug-output file committed in `3fe7de0`; inert but must be removed. |
| LOW-RE-2 | Low | Remediation report test-file counts are wrong: claims 38 unit files / 39 total; observed **45 unit files / 46 total** (test counts 487/491 are accurate). Same documentation-slip class as the original LOW-04-J; the report is not rewritten here. |
| LOW-RE-3 | Low | Direct `registerCapability` path commits the capability before registering its embedded contracts; a contract conflict leaves a partially registered (non-executable) capability — outside the staged pack path, visible at activation, recoverable. |
| LOW-RE-4 | Low | Reference data adapter: unknown top-level query-request fields are silently ignored (request schema not runtime-closed) and filter values are checked against the serializable domain instead of the declared primitive filter type (`{ $ne: null }` accepted; harmless under primitive-equality comparison). |

## Severity summary

| Severity | Count | IDs |
| --- | --- | --- |
| Critical | 0 | — |
| High | 1 | HIGH-04-D (new) |
| Medium | 1 | RE-AUDIT MED-04-G-R (residue of MED-04-G, Partial) |
| Low | 4 | LOW-RE-1, LOW-RE-2, LOW-RE-3, LOW-RE-4 |
| Informational | 3 | documented trust boundaries (declared-semantics identity; handler-body/implementation mutation responsibility), Stage 03 carry-forwards unchanged; environmental (Node 24 / second OS unavailable) |

Original High findings: HIGH-04-A **Closed**, HIGH-04-B **Closed**,
HIGH-04-C **Closed**. Original Medium findings: MED-04-A/B/C/D/E/F/H/I
**Closed**; MED-04-G **Partial** (local-action half fully closed and
verified; release cross-check closed only when the binding context is
supplied).

## Required corrections

Genuine blockers (must close before Stage 05):

1. **HIGH-04-D** — make the authority invocation caches genuinely
   invocation-scoped (declare `configCache`/`secretCache` inside the
   returned per-invocation function), and add a permanent regression test
   that runs the same capability **twice** with a counting/rotating
   provider and a transient provider failure, asserting one read per name
   per invocation and full recovery after a provider failure.
2. **RE-AUDIT MED-04-G-R** — require the `CompileReleaseContext` binding
   cross-check whenever the release declares renderer/component/data-adapter
   bindings (reject with a stable diagnostic when the context is missing
   for a release that makes binding claims), align the architecture §5
   wording with the actual guarantee, and document the descriptor trust
   boundary for context values.

## Recommendation

**Stage 05 may not begin** until the two blockers above are corrected and
independently re-verified; the corrections are contained
(`authority.ts` + one test file; `release.ts` + diagnostics + one test
file) and require no architectural change. After closure, the Stage 05
scope is unchanged: canonical SvelteKit renderer/component suite, host
scaffolder, theming, the local SQLite application-domain adapter, and the
§17.10 reference proof. The remediation quality is otherwise high — every
original High/Medium reproduction was re-verified closed with fresh
adversarial probes, the negative controls are genuine, and the only
regressions found are the two above.