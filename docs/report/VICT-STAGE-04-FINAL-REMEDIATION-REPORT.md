# VICT Stage 04 — Final Remediation Report

## Outcome

**STAGE 04 FINAL RE-AUDIT BLOCKER REMEDIATION COMPLETE — READY FOR FOCUSED
INDEPENDENT CLOSURE AUDIT.**

Both blockers from `docs/report/VICT-STAGE-04-INDEPENDENT-RE-AUDIT.md` are
closed — **HIGH-04-D** (authority caches were capability-lifetime scoped,
not invocation-scoped) and **RE-AUDIT MED-04-G-R** (the release binding
cross-check was opt-in) — together with all four actionable Low residues
(LOW-RE-1, LOW-RE-3, LOW-RE-4 closed in code; LOW-RE-2 closed by the
accurate counts in this report). Every verification command passes, the
new regression suites are genuine negative controls against `77e4dee`,
and the complete ladder was reproduced in a fresh clone with no
pre-existing `dist`.

Stage 04 remains **NOT independently verified**: the system reference does
not mark Stage 04 `Verified`, and Stage 05 has not begun. Only an
independent closure audit can authorize that transition.

## Starting and final SHAs

| Item | SHA |
| --- | --- |
| Required starting commit (focused re-audit, `origin/main`) | `a124f3756a1bcbff5ab8169c5306784d1260a011` |
| Remediation target under audit (in ancestry) | `77e4deeae33389c3ccef084d29e03f7278d44fc1` |
| Final implementation commit (pushed) | `29c5a9d63f95de3e6df8f5c48767c340761401e4` |
| Final documentation commit | this report's commit — see the push output / `git log` |
| Final remote `origin/main` | the tip of the pushed chain after the normal fast-forward push |

## HIGH-04-D correction

**Root cause.** `gateCapabilityInvoke` (packages/runtime/src/authority.ts)
declared `configCache`/`secretCache` — and their resolver closures — in
the outer gate closure, outside the returned per-invocation function. The
wrapped invoke is captured once at registration (and pinned into
activations), so the caches persisted for the LIFETIME of the
capability: rotated configuration/secret values were never re-read, a
rejected secret promise was cached permanently (one transient provider
outage permanently disabled the capability), and concurrent invocations
shared one cache.

**Corrected cache lifetime.** The value caches (`configCache`,
`secretCache`) and the `resolveConfiguration`/`resolveSecret` resolver
functions now live INSIDE the returned per-invocation function — the
per-invocation execution boundary. Moving only the maps was insufficient;
the resolvers are per-invocation too. Semantics now, all directly tested:

1. every invocation creates its own private caches;
2. required eager resolution and handler reads share that invocation's
   caches (one consistent read);
3. repeated reads of one name within one invocation call the provider at
   most once (the `{ value }` wrapper keeps a resolved `undefined`
   distinguishable from 'not yet read');
4. a subsequent invocation calls the provider again (rotation observed);
5. concurrent invocations never share cached values or promises;
6. a provider failure affects only the current invocation;
7. a later invocation recovers after the provider recovers (no poisoned
   gate on any engine);
8. provider errors remain sanitized — raw messages and resolved values
   never enter events, traces, or retained history;
9. authority declarations, activation identity, pinned definitions, and
   least-authority enforcement are unchanged.

Permanent suite: `packages/runtime/test/invocation-scoped-authority.test.ts`
(28 tests) exercised through the sequential runtime, the durable in-memory
orchestration, AND the SQLite orchestration, including rotating required
configuration, rotating required secrets, eager-plus-repeated reads,
optional lazy reads, config-provider throw then recovery, rejected
secret-promise then recovery, optional-secret rejection then recovery,
barrier-controlled concurrent invocations, and canary scans of events,
errors, traces, and retained history.

## Release-binding correction

`compileApplicationRelease` (packages/application/src/release.ts) now
REQUIRES `CompileReleaseContext` as an explicitly supplied argument; the
`{}` default is removed. An omitted, partial, or invalid context fails
closed with the new stable `RELEASE_BINDING_CONTEXT_REQUIRED` diagnostic
(never throws, never a misleading mismatch code, no echo of hostile
values). Required-binding rules:

- `renderer` and `dataAdapter` actual identities are ALWAYS required
  (every valid release declares them) and always cross-checked;
- `componentRegistry` (identity snapshot + exact component identity list)
  is required when the release declares `components`; a supplied-but-
  invalid optional field also fails closed;
- `selectedActivationVersion` is required for an exact activation
  reference (stale references still fail with
  `RELEASE_ACTIVATION_MISMATCH`); activation selection policies keep
  their documented behavior and require nothing.

Matching live bindings compile deterministically to the same
`releaseVersion`; release immutability and defensive capture are intact.

**Trust boundary (documented in the code and in the architecture §5):**
release manifest declarations are NOT trusted as proof of deployed
identity; deployment composition must source context descriptors from the
actual selected renderer, the component-registry identity snapshot, the
application-data adapter, and the activation selection; callers must not
copy context values back out of the manifest; VICT verifies equality
against supplied snapshots and cannot prove that hostile tooling supplied
truthful ones. The SvelteKit proof now compiles its release through
`examples/application-proof/src/lib/application/release.ts` using its
ACTUAL renderer (`src/lib/host/proof-renderer.ts`), registry identity,
adapter, and activation — verified by a tampered-context negative control
in the proof tests. `@vict/application` remains browser-safe (no runtime,
Svelte, or Zod imports added; `CompileReleaseContext` is now exported
from the package index).

Permanent suite: `packages/application/test/release-binding-context.test.ts`
(13 tests) plus a new release-context block in the proof tests.

## Low-residue corrections

- **LOW-RE-1:** `packages/runtime/test/dbg3-out.txt` removed; a repo scan
  found no similar committed debugging outputs (`dbg*`, `*.out`, `*.log`).
- **LOW-RE-2:** this report records OBSERVED counts — 48 unit files /
  535 unit tests, 1 integration file / 4 integration tests, 49 files /
  539 tests total. The previous remediation report's test totals (487
  unit, 491 total) were correct, but its test-FILE counts (38/39) were
  not (45/46 observed); neither audit document is rewritten.
- **LOW-RE-3:** direct public `registerCapability` is now atomic: it
  stages the capability and its embedded contracts through the SAME
  registry staging mechanism used by pack installation
  (`CapabilityRegistry.installBatch`), committing only when every
  validation and collision check succeeds. A capability-identity,
  input-contract, output-contract, or both-contracts collision leaves the
  registry semantically unchanged; the corrected registration is
  retryable; activation never observes a partial definition; atomic pack
  installation is preserved with no nested staging. Permanent suite:
  `packages/runtime/test/direct-registration-atomicity.test.ts` (7 tests).
- **LOW-RE-4:** the reference application-data adapter closes the
  query-request schema at runtime (unknown top-level fields →
  `DATA_INVALID_REQUEST`, never echoed) and runtime-enforces the declared
  filter type: exactly `string`, finite canonical `number` (no `-0`), or
  `boolean`; objects, arrays, `null`, `undefined`, non-finite numbers,
  functions, BigInt, and symbols are rejected with safe diagnostics that
  never echo hostile keys or values; malformed `filters` containers are
  rejected; primitive-equality query semantics, authorization-before-
  access, and defensive isolation are preserved. Permanent evidence: new
  shared conformance scenarios 14–15 in
  `packages/application/src/data-conformance.ts`
  (`runApplicationDataAdapterSuite`), so every conforming adapter
  inherits them.

## Files changed

**Runtime**
- `packages/runtime/src/authority.ts` — HIGH-04-D: per-invocation caches + resolvers
- `packages/runtime/src/registry.ts` — LOW-RE-3: atomic direct registration via staging
- `packages/runtime/test/invocation-scoped-authority.test.ts` — new permanent HIGH-04-D suite
- `packages/runtime/test/direct-registration-atomicity.test.ts` — new permanent LOW-RE-3 suite
- `packages/runtime/test/dbg3-out.txt` — deleted (LOW-RE-1)

**Application**
- `packages/application/src/release.ts` — RE-AUDIT MED-04-G-R: mandatory context,
  `RELEASE_BINDING_CONTEXT_REQUIRED`, trust-boundary documentation
- `packages/application/src/index.ts` — export `CompileReleaseContext`
- `packages/application/src/data.ts` — LOW-RE-4: closed query schema, strict filter values
- `packages/application/src/data-conformance.ts` — shared scenarios 14–15 (LOW-RE-4)
- `packages/application/test/release-binding-context.test.ts` — new permanent suite
- `packages/application/test/compile-identity.test.ts`,
  `packages/application/test/audit-remediation-identity.test.ts` — updated
  for the mandatory context (including a fail-closed exact-activation probe)

**SvelteKit proof**
- `examples/application-proof/src/lib/host/proof-renderer.ts` — new: the ACTUAL
  renderer + component-registry factories shared by the page, the
  conformance suite, and the server-side release compile
- `examples/application-proof/src/lib/application/release.ts` — new: release
  compilation from actual deployment objects (trust boundary)
- `examples/application-proof/src/lib/application/server.ts` — compiles and
  exposes the deployment's release
- `examples/application-proof/src/routes/[...vict]/+page.svelte` — uses the
  shared registry factory
- `examples/application-proof/test/proof.test.ts`,
  `examples/application-proof/test/renderer-conformance.test.ts` — use the
  shared factories; new release tests

**Scripts & docs**
- `scripts/verify-stage4.mjs` — packed application consumer supplies the mandatory context
- `docs/architecture/STAGE-04-CAPABILITY-APPLICATION-AUTHORING.md` — §3.1
  invocation-scoped caching/recovery/concurrency, §4/§5 mandatory release
  context + trust boundary + direct-registration atomicity + strict query
  semantics, §9 proof release compilation, new §9.2
- this report

## Permanent regression evidence

| Suite | Tests | Runs |
| --- | --- | --- |
| `invocation-scoped-authority.test.ts` | 28 | 5× identical pass |
| `release-binding-context.test.ts` | 13 | 5× identical pass |
| `direct-registration-atomicity.test.ts` | 7 | 5× identical pass |
| `conformance.test.ts` (adapter suite incl. new scenarios 14–15) | — | 5× identical pass |
| updated `audit-remediation-identity` + `compile-identity` | — | 5× identical pass |

The five targeted suites total 78 tests, passed 5 consecutive runs,
zero flake. `npm test` passed 3 consecutive runs with identical counts
(49 files / 539 tests).

## Negative controls

Temporary worktree at `77e4dee` (fresh `npm ci`; built-free — vitest
resolves package sources; the worktree was probed and then removed; the
historical checkout was never modified):

| Suite at `77e4dee` | Result |
| --- | --- |
| `invocation-scoped-authority.test.ts` | **15 of 28 fail** — rotating config, rotating secrets, rejected-promise poisoning (required + optional), and the barrier concurrency cases fail exactly as the re-audit predicted (stale values; `VICT_RUNTIME_SECRET_UNAVAILABLE` forever; shared cache). One-read-per-invocation, canary, and unchanged-enforcement tests pass at both revisions (pre-existing invariants). |
| `release-binding-context.test.ts` | **6 of 13 fail** — omitted, `undefined`/`null`/non-object, `{}`, partial, exact-activation-without-selected, and invalid-shape contexts all compile at `77e4dee` (the defects). Matching-bindings and mismatch tests pass at both (already enforced when a context is supplied). |
| `direct-registration-atomicity.test.ts` | **5 of 7 fail** — input/output/both contract collisions leave the capability REGISTERED at `77e4dee` (partial mutation observable through activation), and the retry fails with a duplicate. Capability-identity collision and the pack test pass at both (already atomic). |
| temporary query-strictness probe (3 tests, since removed) | **2 of 3 fail** — unknown top-level query fields and hostile filter values accepted at `77e4dee`; primitive-equality filtering passes at both. |

Total: 28 of 51 new-economy tests fail at `77e4dee`; ALL pass at the
corrected implementation. Every temporary worktree and probe file was
removed afterwards.

## Verification evidence

| Command | Exit status | Observed result |
| --- | --- | --- |
| `git fetch origin` | 0 | `origin/main` == `a124f37` == working HEAD |
| `npm ci` | 0 | clean workspace install |
| `npm run typecheck` | 0 | strict, run before build |
| `npm run format:check` | 0 | Prettier-clean |
| `npm run lint` | 0 | 0 problems |
| `npm run build` | 0 | all six packages build |
| `npm run test:unit` | 0 | **48 files / 535 tests passed** |
| `npm run test:integration` | 0 | **1 file / 4 tests passed** |
| `npm test` | 0 | **49 files / 539 tests passed; 3 consecutive identical runs** |
| `npm run verify:consumer` | 0 | packed neutral + Zod + SQLite orchestration consumers |
| `npm run verify:stage2` | 0 | Stage 02 closure intact |
| `npm run verify:stage3` | 0 | Stage 03 closure intact (six real-process restart fixtures) |
| `npm run verify:stage4` | 0 | build + suites + proof + isolated packed consumers (consumer updated for the mandatory context) |
| `npm run example` | 0 | ARA proof: exactly **13 ordered events** (counted) |
| `npm run bench` | 0 | `bench-three-node-pure`: exactly **10 events per completed run** |
| `npm run example:application` | 0 | SvelteKit proof builds (adapter-node) + **17/17 tests** (2 new release tests) |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` | 0 | only this remediation's files + the owner's pre-existing local deletions of the root-level `VICT-STAGE-02-*.md` copies (preserved, never staged) |

Environment: Windows 11 Pro, MINGW64_NT-10.0-26200, win32-x64; Node
v22.13.1 (npm 10.9.2) — satisfies `>=22.13.0`. **Node 24 and a second OS
were unavailable in this environment**; the Node 24 targeted matrix was
NOT run and is recorded accurately as an environmental limitation
(consistent with prior stages).

### Fresh-clone evidence

The complete ladder was reproduced in a temporary fresh clone of the
PUSHED implementation (`git clone https://github.com/radz2291/vict-02` at
`29c5a9d63f95de3e6df8f5c48767c340761401e4`; clean tree; NO pre-existing
`dist` — verified by directory listing), running `npm run typecheck`
BEFORE `npm run build`, then every remaining ladder command in the
required order with identical counts (535 unit + 4 integration = 539;
ARA exactly 13 events; bench exactly 10 events per completed run; 17/17
proof tests; every verify script exit 0; `git diff --check` clean). The
clone was removed after the run. The documentation commit that carries
this report changes no code.

## Compatibility decisions

- The removal of the `CompileReleaseContext = {}` default is a breaking
  compile-time change to a Stage 04 authoring API (accepted pre-1.0):
  every caller now supplies the verification context. Runtime callers
  passing a context behave identically except that missing required
  bindings now fail closed instead of compiling unchecked.
- `RELEASE_BINDING_CONTEXT_REQUIRED` is added to the release diagnostic
  vocabulary; existing mismatch codes keep their exact meaning (a
  SUPPLIED value that disagrees, not a missing one).
- The HIGH-04-D cache relocation changes no identity, declaration, or
  enforcement semantics; invocations that ran once per runtime observe
  identical behavior, and multi-invocation lifetimes gain correct
  rotation/recovery.
- Direct registration now commits atomically; successful registrations
  are observably identical (same validations, same diagnostics, same
  wrapped invoke); only the failure path changes (no partial state).
- The query-strictness change can reject requests that were previously
  silently narrowed — the documented contract (closed schema, declared
  filter type) is now enforced, matching the declared public types.
- Stage 01–03 behavior is untouched: the full ladder, verify:stage2/3,
  ARA (13 events), and the benchmark (10 events) all reproduce.

## Remaining genuine limitations

- **Informational (accepted trust boundary):** VICT verifies equality
  against SUPPLIED binding snapshots; it cannot prove that hostile
  deployment tooling supplied truthful snapshots. Documented in §5 of
  the architecture and in `CompileReleaseContext`.
- **Informational (unchanged):** identity reflects DECLARED semantics;
  handler bodies and post-registration implementation mutation remain
  the author's/build's responsibility. Provenance prose is length-bounded
  but not scanned for secret-like content.
- **Environmental:** Node 24 and a second OS were unavailable; those
  targeted checks were not run.
- **Stage 03 carry-forwards (unchanged, out of Stage 04 scope):**
  completion-phase store faults after lease lapse; cooperative
  cancellation race.
- The renderer conformance suite's macrotask-drain observability window
  (~10 ms) for unhandled rejections (documented, assessed genuinely Low).

## Ready for focused independent closure audit?

YES
