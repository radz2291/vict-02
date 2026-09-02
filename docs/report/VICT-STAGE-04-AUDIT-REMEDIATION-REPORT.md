# VICT Stage 04 — Independent Audit Remediation Report

## Outcome

**STAGE 04 AUDIT REMEDIATION COMPLETE — READY FOR FOCUSED INDEPENDENT RE-AUDIT.**

All three High findings (HIGH-04-A, HIGH-04-B, HIGH-04-C) and all nine
Medium findings (MED-04-A … MED-04-I) of
`docs/report/VICT-STAGE-04-INDEPENDENT-AUDIT.md` are closed, together with
the adjacent Low findings that share the same files and semantics. Every
verification command in the ladder passes; every permanent regression
scenario added for an audit reproduction fails against the audited
implementation `0f84d2e` and passes after remediation.

Stage 04 remains **NOT independently verified**: the system reference does
not mark Stage 04 `Verified`, and Stage 05 has not begun.

## Starting and final SHAs

| Item | SHA |
| --- | --- |
| Required starting commit (audit report only) | `4ed8686bdd864123ac31433325055aff33b60d51` |
| Audited implementation (in ancestry) | `0f84d2eddebe1edf9a66f1751a6483abf7464dfe` |
| Final remediation SHA (remote `origin/main` after push) | the tip of the pushed chain — see the outcome report and the commit chain in the remediation summary (the report is part of the chain it documents) |

## Findings closed

| Finding | Correction | Permanent evidence |
| --- | --- | --- |
| HIGH-04-A | `installCapabilityPack` is now a registry-level STAGED BATCH: validate manifest + all bindings, preflight every contract/capability/double against live+staged state, construct effective registrations without mutating live maps, commit the complete batch only after all checks pass. Any failure leaves the registry semantically unchanged. | `packages/runtime/test/audit-remediation-pack.test.ts` (collision on first/middle/final capability, contract collision, double collision, duplicate install, multi-revision conflicts, failure after prepared entries, activation attempts after failure, clean retry) |
| HIGH-04-B | Component registry uses STRUCTURAL identity (nested maps keyed separately by componentId and revision); no delimiter keys. `identity()` reports ids/revisions verbatim; empty/whitespace-only ids/revisions rejected; duplicate exact identity rejected. | `packages/application/test/audit-remediation-identity.test.ts` (the audit's exact `('a','1@2')` / `('a@1','2')` reproduction coexists and resolves correctly) |
| HIGH-04-C | Authority declarations are validated (non-empty, non-whitespace, duplicate-free) and copied + frozen at registration; the invocation gate closes over the immutable snapshots. Applied identically on sequential, durable in-memory, and SQLite paths (the gate wraps `invoke` at registration). | `packages/runtime/test/audit-remediation-authority.test.ts` (post-registration AND post-activation mutation, in-flight enforcement, new-revision recapture, identity sensitivity — both store adapters) |
| MED-04-A | CONT-001 enforced at the public runtime registration/pack-installation boundary for plain JavaScript objects: missing input or output contract rejects registration with `VICT_RUNTIME_MISSING_CONTRACT`. The SvelteKit proof's `proof.summarize` now declares an input AND an output contract; the runtime validates both; invalid capability output fails safely before HTTP/DOM. | `packages/runtime/test/audit-remediation-capability-boundary.test.ts`; `examples/application-proof/test/proof.test.ts` (output-contract scenario) |
| MED-04-B | `manifest.doubles` + `bindings.doubles` install atomically with the pack; declared `modes` eligibility is enforced (`test`-only doubles never run in `simulate`); doubles never run in normal mode; missing/extra/duplicate/wrong-revision/wrong-target double bindings reject the pack. The shared pack-conformance suite now uses the pack's declared double — the manual substitute lambda was removed. | `packages/runtime/test/audit-remediation-pack.test.ts`; `packages/runtime/src/pack-conformance.ts` (strengthened) |
| MED-04-C | Data-adapter idempotency keys are scoped by `resourceId + op + key`, recorded only after a successful commit; failed mutations never consume keys (a retry is a fresh attempt that creates its own row); same key + different canonical request is the stable `DATA_IDEMPOTENCY_CONFLICT`; update/delete reject unsupported keys. | `packages/application/src/data-conformance.ts` (scenarios 7–13) run by `packages/application/test/conformance.test.ts` |
| MED-04-D | The reference adapter deep-copies and validates seeds, retains defensive copies of validated input, returns defensive deep copies, rejects values outside the serializable domain, enforces declared field types, and rejects undeclared fields by one strict documented policy for create AND update. | `packages/application/src/data-conformance.ts` (scenarios 11–12) |
| MED-04-E | The unapproved seven-day wait ceiling (`MAX_DELAY_MS_LIMIT`) was removed from wait-level validation. `undefined`/`null` = absent; present values must be positive finite safe integers. Overflow-producing durations fail structurally at scheduling time (`VICT_ORCH_INVALID_TRANSITION`), not with an arbitrary compile ceiling. Retry-backoff and per-attempt-timeout bounds are retained. | `packages/runtime/test/audit-remediation-wait-scheduling.test.ts` (7d+1ms, 30d, 1 year, largest schedulable, overflow, zero/negative/fractional/NaN/Infinity) |
| MED-04-F | `canonicalize` is strict: NaN, ±Infinity, negative zero, BigInt, Date, functions, symbols, sparse arrays, cyclic structures, unsupported prototypes, and throwing getters/proxies are rejected through structured compiler diagnostics (`APPLICATION_NON_CANONICAL_VALUE`, `CanonicalIdentityError`); no silent conversion to `null`/string/omission. Reachable numeric and component-prop fields are value-checked. | `packages/application/test/audit-remediation-canonical.test.ts` (all audit collisions) |
| MED-04-G | `kind: 'local'` actions are genuinely renderer-local: the host executes the declared serializable local transition (transient form/result reset) with zero network/dispatcher/run/data effects (spies + real DOM clicks); the server-side `act.clear` handler was removed and the dispatcher refuses local action ids. Releases cross-check actual supplied binding identities (renderer, component registry + exact list, data adapter, activation). | `examples/application-proof/test/proof.test.ts` (zero-effect spy scenario); `packages/application/test/audit-remediation-identity.test.ts` (release cross-checks) |
| MED-04-H | Capability definitions are closed-schema validated at `registerCapability` (which pack installation uses): unknown/misspelled fields, invalid effect classes, malformed authority arrays, and unsupported idempotency values are rejected with stable structured diagnostics; plain JS objects tested. | `packages/runtime/test/audit-remediation-capability-boundary.test.ts` |
| MED-04-I | All six official factories (`defineCapability`, `defineGraph`, `defineCapabilityPack`, `defineResource`, `defineApplication`, `defineApplicationRelease`) provide real deep immutable captures: shallow-frozen roots and frozen intermediates are deep-copied, only branded official contracts preserve identity, `parse`-bearing impostors are copied, functions are by reference, cycles/exotics/hostile getters fail structurally. Compilers operate on defensive copies and never freeze caller-owned objects. | `packages/sdk/test/audit-remediation-capture.test.ts`; `packages/application/test/audit-remediation-identity.test.ts` (caller-freeze probes) |

## Atomic pack installation

`installCapabilityPack` now performs a single registry-level staged batch
(`CapabilityRegistry.installBatch`):

1. the SDK manifest cross-validation runs first (pure, fail-closed);
2. inside the batch, every contract, effective capability registration,
   and declared double is validated against the live registry AND the
   staging overlay — batch-vs-registry and batch-internal duplicates are
   both detected before any commit;
3. nothing touches the live maps until the callback returns successfully;
4. the commit applies contracts, then capabilities, then doubles in
   deterministic order.

There is no best-effort rollback because nothing is registered until
success is certain. The atomic unit covers contracts, capabilities,
authority-wrapped invocation definitions, historical revision maps, and
declared doubles with their mode policy. Co-installation rules for two
packs declaring the same contract id/revision are documented in the
architecture document §3 (deterministic `VICT_RUNTIME_CONTRACT_CONFLICT`
for differing objects; free co-installation of the same object).

## Pack doubles and simulation

Declared bound doubles install with the pack; `PackDoubleDeclaration.modes`
is now executable eligibility policy (default eligible in `test` +
`simulate`). The runtime policy denies `useDouble` when the registered
double is not eligible in the current mode, so a `test`-only double blocks
in `simulate` and vice versa; normal-mode execution never consults doubles.
Run-level double snapshots and explicit `replaceDouble` semantics are
unchanged; irreversible simulation remains fail-closed (no double, no run).

## Authority snapshot and identity

Registration now validates every authority name and pins copied + frozen
declaration snapshots; the gate resolves each requested configuration or
secret name at most once per invocation (eager for required names, lazy
and promise-cached for optional names). The capability-set fingerprint
includes the sorted declared names when non-empty:

```text
capabilitySetVersion = v1_sha256(canonicalJson({
  schema: 'vict.capability-set@1',
  bindings: [ { capability, revision, effect,
                input: {id, revision} | null,
                output: {id, revision} | null,
                idempotency?: 'keyed',
                authority?: { sorted permission / configuration /
                              requiredConfiguration / secrets /
                              requiredSecrets NAMES } } ...
  ] sorted + deduplicated }))
activationVersion = hash(graphVersion + capabilitySetVersion + schema marker)
```

Migration impact: stored activations whose capabilities declare authority
names no longer restore byte-identically after changing those
declarations; the exact-activation restoration reports the mismatch and a
deliberate re-activation under the new revision is required — this is the
intended pinning behavior. Resolved secret values and actor grants do not
enter identity (unchanged accepted rule).

## Capability contract boundary

`registerCapability` (the single public boundary; pack installation routes
through it) enforces CONT-001 (both contracts present and contract-shaped),
the closed effect vocabulary, closed definition fields, well-formed
authority arrays, supported idempotency values, and non-whitespace
identities — for plain JavaScript objects, not only TypeScript. The
SvelteKit proof's capability action declares both contracts and the kernel
validates node output before a run completes.

## Component and release identity

The component registry keys entries structurally (componentId → revision →
implementation). The audit's delimiter-alias reproduction now coexists, and
`identity()` lists every `(componentId, revision)` pair verbatim in a
frozen snapshot that later registry mutations cannot change. Releases are
compiled against actual supplied binding identities via the new
`CompileReleaseContext` (renderer, component-registry identity + exact
component list, data adapter, selected activation version); the compiled
release is a defensive cloned capture whose identity cannot be changed by
later input mutation.

## Application-data semantics

The adapter contract now carries explicit contract bindings. The reference
adapter parses mutation input through the declared exact contract, enforces
declared field types, rejects undeclared fields (strict create/update
policy), records idempotency keys only after successful commit, reconciles
same-key/same-request retries, conflicts on same-key/different-payload,
and deep-copy isolates seeds, retained inputs, and returned rows. Invalid
limits, offsets, projections, and malformed requests fail with stable safe
diagnostics that do not echo attacker-controlled values.

## Canonical identity domain

`canonicalize` (kernel) and the application identity canonicalizer reject
NaN, ±Infinity, negative zero, BigInt, Date objects, functions, symbols,
sparse arrays, cyclic structures, unsupported prototypes, and throwing
getters/proxies with structured diagnostics instead of silent coercion.
Insertion-order independence, meaningful-sequence sensitivity, Unicode
correctness, deterministic cross-process hashing, and browser-safe
SHA-256 behavior are retained and re-tested.

## Local action and SvelteKit proof

The proof's `act.clear` is `kind: 'local'` and is handled entirely inside
the renderer boundary: a declared, serializable local transition
(`local: 'reset-transient'`) resets declared form state and transient
result state. Dispatch/network/run/data spies around a real DOM click
record zero effects. The server-side `act.clear` handler was removed; the
dispatcher refuses `act.clear` with `UNKNOWN_ACTION`. The host catches
dispatcher rejections and renders the declared safe failure state.
Unknown routes return HTTP 404 with a safe diagnostic that never echoes
the attacker-controlled path.

## Adjacent Low corrections

- **LOW-04-A:** pack `version` must be a strict semver; the effect
  vocabulary is validated in the pack validator; the dead
  `PACK_BINDING_EFFECT_MISMATCH` / `PACK_BINDING_IDEMPOTENCY_MISMATCH` /
  `PACK_MISSING_CAPABILITY` codes were removed from the diagnostic
  vocabulary.
- **LOW-04-B:** compilers convert hostile getters/proxies/prototypes into
  structured diagnostics (never throw); whitespace-only identifiers are
  rejected; provenance values are length-bounded safe prose (this compiler
  makes no claim that arbitrary prose can be automatically proven
  secret-free); timestamp/machine-path-like fields are rejected from
  reference-only boundaries.
- **LOW-04-C:** caret `^0.x.y` follows standard semver; co-installation of
  same-contract-id packs is deterministic and documented (§3).
- **LOW-04-D:** provenance prose is non-empty, string-typed, and bounded
  (200 chars); the core rule that resolved secrets never enter manifests
  or release identity is preserved and the automatic-provenance claim was
  removed.
- **LOW-04-E:** the renderer action-canary check is mandatory for
  renderers supporting the `action` role; the canary scan inspects
  `error.message`, stacks, nested causes, and enumerable details; the
  Svelte fixture supplies and runs the scenario with real clicks; a
  dispatcher rejection is caught and replaced with a safe result.
- **LOW-04-F:** compilers clone before freezing; caller objects are never
  frozen or mutated.
- **LOW-04-G:** the reference adapter rejects invalid limits/offsets,
  unknown projection fields, and malformed requests; diagnostics do not
  echo attacker-controlled values.
- **LOW-04-H:** removed (TOCTOU) — see above.
- **LOW-04-J:** documentation count/SHA corrections are recorded here:
  the Stage 04 report's fresh-clone addendum said "38 files / 413" for
  `npm test` where 39 files were observed; the "Final remote SHA 882e4ff"
  row was superseded by `0f84d2e`. Both are documentation slips in the
  original report, which is not rewritten. The SvelteKit catch-all now
  returns HTTP 404 for undeclared paths.

## Files changed

**Contracts & SDK (authoring ABI)**
- `packages/contracts/src/define-contract.ts` — official-contract brand + `brandOfficialContract`
- `packages/contracts/src/neutral.ts` — stable neutral JSON contract
- `packages/contracts/src/index.ts` — exports
- `packages/contracts/src/zod/define-zod-contract.ts` — brand official zod contracts
- `packages/sdk/src/authoring.ts` — real deep immutable capture (`frozenCapture`, `VictAuthoringError`)
- `packages/sdk/src/pack.ts` — pack validation hardening (semver, effect vocabulary, CONT-001, caret 0.x, extra-double rejection, whitespace names)
- `packages/sdk/src/graph.ts` — wait-level ceiling removed
- `packages/sdk/src/index.ts` — exports

**Kernel (identity & compilation)**
- `packages/kernel/src/canonical.ts` — strict canonical domain; authority fingerprint in capability-set identity
- `packages/kernel/src/compile.ts` — wait-bound rule without ceiling; authority wired into bindings
- `packages/kernel/src/types.ts` — `CapabilityDescriptor.authority`

**Runtime**
- `packages/runtime/src/registry.ts` — CONT-001/closed-schema/effect/authority registration gate; mode-eligible doubles; staged atomic batch
- `packages/runtime/src/authority.ts` — pinned declaration snapshots; invocation-scoped caches (TOCTOU removal); sanitized provider failures
- `packages/runtime/src/pack-install.ts` — atomic install + declared double installation
- `packages/runtime/src/errors.ts` — new stable diagnostics
- `packages/runtime/src/store-types.ts` — manifest binding authority field
- `packages/runtime/src/runtime.ts` — descriptor authority, `hasDouble`/`getDoubleModes`, batch hook, neutral-compatible edge compatibility
- `packages/runtime/src/orchestration-plan.ts` — scheduling-time overflow guards
- `packages/runtime/src/pack-conformance.ts` — declared-double conformance (manual substitute removed)
- conformance suites (`orchestration-*-conformance.ts`) and tests updated for explicit contracts
- new permanent suites: `audit-remediation-pack.test.ts`, `audit-remediation-authority.test.ts`, `audit-remediation-capability-boundary.test.ts`, `audit-remediation-wait-scheduling.test.ts`

**Application (application model)**
- `packages/application/src/compile.ts` — strict canonical domain; hostile-input safety; defensive (clone-then-freeze) plan capture; identifier checks
- `packages/application/src/release.ts` — binding cross-check context; never-throw; defensive capture
- `packages/application/src/data.ts` — contract enforcement, idempotency semantics, defensive isolation, request validation
- `packages/application/src/data-conformance.ts` — audit reproductions (scenarios 7–13)
- `packages/application/src/renderer.ts` — structural component-registry identity
- `packages/application/src/renderer-conformance.ts` — mandatory hostile-action canary scenario
- tests: `audit-remediation-identity.test.ts`, `audit-remediation-canonical.test.ts`, `conformance.test.ts` updated

**SvelteKit proof**
- `examples/application-proof/src/lib/application/definition.ts` — output contract + capability action binding
- `examples/application-proof/src/lib/application/server.ts` — capability contracts; adapter contract bindings; server-side local handler removed
- `examples/application-proof/src/lib/host/ApplicationHost.svelte` — local-action execution; safe dispatch; action-kind surface
- `examples/application-proof/src/routes/[...vict]/+page.server.ts` — structured 404 for unknown routes
- `examples/application-proof/test/proof.test.ts`, `test/renderer-conformance.test.ts` — remediation scenarios

**Examples, packs, scripts, stores**
- `examples/ara-proof`, `examples/orchestration-proof`, `scripts/benchmark.ts`, `packs/*` tests — explicit contracts on all capabilities (CONT-001 ripple)
- `scripts/isolated-consumer-check.mjs`, `scripts/verify-stage4.mjs` — packed consumers declare explicit contracts
- `packages/store-sqlite/test/*` — fixtures declare explicit contracts; no semantic change

**Documentation**
- `docs/architecture/STAGE-04-CAPABILITY-APPLICATION-AUTHORING.md` — corrected observed semantics
- this report

## Verification evidence

| Command | Exit | Observed result |
| --- | --- | --- |
| `npm ci` | 0 | clean workspace install |
| `npm run format:check` | 0 | all files Prettier-clean |
| `npm run lint` | 0 | 0 problems |
| `npm run typecheck` | 0 | strict, no errors (fresh clone order: before build) |
| `npm run build` | 0 | all six packages build |
| `npm run test:unit` | 0 | 38 files / 487 tests passed |
| `npm run test:integration` | 0 | 1 file / 4 tests passed |
| `npm test` | 0 | 39 files / 491 tests passed (3 consecutive identical runs) |
| `npm run verify:consumer` | 0 | packed neutral + Zod + SQLite orchestration consumers; declaration scans clean |
| `npm run verify:stage2` | 0 | Stage 02 closure intact |
| `npm run verify:stage3` | 0 | Stage 03 closure intact (suites + offline proof + packed orchestration consumer) |
| `npm run verify:stage4` | 0 | build + suites + proof + isolated packed consumers PASSED |
| `npm run example` | 0 | ARA proof: 13 numbered ordered events (counted) |
| `npm run bench` | 0 | `bench-three-node-pure` (3 nodes, 2 edges, 10 events per completed run) |
| `npm run example:application` | 0 | SvelteKit proof builds (adapter-node) + 15/15 DOM tests |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` | 0 | only owner changes + this remediation's files |

Environment: Windows 11 Pro, MINGW64_NT-10.0-26200, win32-x64; Node
v22.13.1 (npm 10.9.2) — satisfies `>=22.13.0`.

### Real built adapter-node server probes (port 3000, separate process)

| Probe | Result |
| --- | --- |
| `GET /` | 200; screen title, view, form, actions, custom component all from the definition |
| `POST /api/act act.clear` (local action) | `UNKNOWN_ACTION` — no server-side local handler (MED-04-G) |
| `POST /api/act act.create {id:'n1',title:'alpha'}` | `ok:true`, row persisted |
| `POST /api/act act.create {id:'',title:42}` | `CONTRACT_REJECTED`, nothing stored |
| `POST /api/act act.summarize` | `ok:true {summary:'hello (5 chars)'}` — real VICT run, output contract validated |
| `POST /api/act act.adminDelete` | `DATA_UNAUTHORIZED` — denied below the UI over raw HTTP |
| `POST /api/act act.nope` | `UNKNOWN_ACTION` |
| `POST /api/act` malformed JSON | HTTP 400 |
| `GET /nonexistent-page` | HTTP 404 (structured not-found, LOW-04-J) |

### Fresh-clone evidence

A temporary fresh clone of the remediation branch (no `dist` artifacts,
clean tree) reproduced the complete ladder in the required order with
identical counts (487 unit + 4 integration = 491; 13 ARA events; 10 bench
events; 15 proof tests; every verify script exit 0). See the final remote
push for the exact branch tip.

### Matrix

Node 24 / a second OS were NOT available in this environment; the ladder
and targeted matrix were run on Node v22.13.1 (Windows x64). This is
recorded accurately as an environmental limitation, consistent with the
Stage 02/03 dispositions.

## Negative-control evidence

The permanent remediation suites were executed against the audited
implementation `0f84d2e` in a temporary worktree (fresh `npm ci` + build).
Across the five targeted suites, **38 of 47 scenarios failed** against the
audited implementation (the remaining 9 assert invariants the audited
implementation already satisfied — e.g. multiple revisions of one
component and duplicate-identity rejection). The failing scenarios
include, verbatim:

- HIGH-04-A: "a collision on the middle/final capability leaves NO
  capability, contract, or double of the pack registered" — failed (partial
  registration was observable); "failure after earlier entries are prepared
  leaves the registry unchanged" — failed.
- MED-04-B: "installing the pack registers the declared double" — failed
  (test-mode run blocked without the manual substitute).
- HIGH-04-C: "mutating the raw permission array after registration AND
  activation does not change enforcement" — failed (mutation changed
  enforcement on the audited implementation).
- MED-04-A/H: "rejects contract-less capabilities", "rejects invalid effect
  values", "rejects unknown definition fields", "misspelled effect can never
  downgrade write safety" — all failed on the audited implementation.
- MED-04-F: "NaN vs null", "Infinity vs null", "negative zero", "function-
  valued field", "BigInt vs same textual string", "Date-valued field" — all
  failed (the audited compiler accepted and silently coerced them).
- MED-04-G: release binding cross-checks and the genuine-local-action spy
  scenarios — failed on the audited implementation.
- LOW-04-J: unknown-route 404 — failed on the audited implementation (200
  with first-route render).

## Regression matrix

| Area | Evidence |
| --- | --- |
| Stage 01–02 semantics | full unit suite green (487), verify:stage2 exit 0 (packed SQLite consumer) |
| Stage 03 durable semantics | orchestration conformance/faults/races/lifecycle/canary suites green on in-memory AND SQLite; verify:stage3 exit 0 (six real-process restart fixtures) |
| ARA 13 events / benchmark 10 events | re-executed directly, counts reproduced |
| Activation identity & snapshots | existing identity/snapshot suites green (with the documented authority-fingerprint addition) |
| Durable-before-invocation, cancellation, fencing | Stage 03 conformance suites green |
| SQLite atomicity & restart | store-sqlite suites green; restart fixtures green |

## Negative-control evidence

See the section above; recorded from a temporary worktree at `0f84d2e`
that was built, probed, and removed (never committed). The audit document
itself was not modified at any point.

## Compatibility and migration decisions

- CONT-001 is a breaking authoring change: contract-less capabilities no
  longer register. All workspace packs, examples, tests, and the SvelteKit
  proof now declare explicit contracts; arbitrary-value boundaries use the
  stable neutral contract `vict.neutral.json` (identity-compatible with
  every contract on graph edges).
- Capability-set identity now includes declared authority names for
  capabilities that declare them; bindings without authority keep their
  historical canonical form. Stored activations for authority-declaring
  capabilities require deliberate re-activation after this change (the
  intended pinning semantics; documented in the architecture §3.1/§11).
- The seven-day wait ceiling is removed; retry-backoff and per-attempt
  timeout operational bounds remain compiler-enforced.
- The component registry's structural keys are an internal representation
  change; registration/resolution semantics for well-formed ids/revisions
  are unchanged, and previously aliased identities are now distinct (the
  audit's exact case).

## Remaining genuine limitations

- **LOW/Informational (accepted trust boundary):** identity reflects
  DECLARED semantics; handler bodies and post-registration implementation
  mutation remain the author's/build's responsibility (unchanged trust
  boundary, documented).
- **Informational:** provenance *values* are length-bounded safe prose but
  are not scanned for secret-like content (name-based value detection
  remains; no automatic prose analysis is claimed).
- **Environmental:** Node 24 and a second OS were unavailable; the Node 24
  targeted matrix was not run.
- **Stage 03 carry-forwards (unchanged, out of Stage 04 scope):**
  completion-phase store faults after lease lapse; cooperative cancellation
  race.
- The renderer conformance suite's unhandled-rejection detection observes
  rejections for a full macrotask; a rejection that surfaces strictly
  later than the drain window cannot be attributed by the shared suite
  itself (process-level handlers still catch it at runtime).

## Ready for focused independent re-audit?

YES