# VICT Stage 04 — Independent Verification Audit

## Verdict

**NOT VERIFIED — STAGE 05 BLOCKED**

## Stage 05 readiness

**NO**

Stage 04's architecture is broadly sound and the full verification ladder
reproduces cleanly, but the audit found three unresolved **High** findings
inside the Stage 04 deliverables themselves — non-atomic capability-pack
installation with partial registry mutation (HIGH-04-A), a component-registry
identity aliasing that can silently misbind component semantics (HIGH-04-B),
and authority-declaration arrays that are not pinned into activations
(HIGH-04-C) — plus eight Medium findings, including idempotency and
defensive-isolation defects in the reference application-data adapter and a
missing declared pack-double installation that the shared conformance suite
does not detect. Stage 05 (renderer/component suite, component registry
extension, application-data delivery) directly builds on exactly these
mechanisms, so the corrections must land before Stage 05 begins.

## Audited SHA and environment

| Item | Observed |
| --- | --- |
| Repository | `https://github.com/radz2291/vict-02` (fresh clone, new audit workspace; the owner worktree was never used for testing) |
| `origin/main` after `git fetch origin` | `0f84d2eddebe1edf9a66f1751a6483abf7464dfe` — exact match to the required target; `HEAD == origin/main` |
| Implementation chain in ancestry | `9678b26` (accepted architecture baseline) → `5897c69` (primary Stage 04) → `882e4ff` (SQLite fixture correction) → `0f84d2e` (final report addendum) — verified by `git log` |
| Working tree at audit start | clean (`git status --short` empty); no `dist` directories under `packages/*` before `npm ci` (verified by directory listing) |
| OS | Windows 11 Pro, MINGW64_NT-10.0-26200, win32-x64 (AMD64) |
| Node (primary, full ladder) | v22.13.1 (npm 10.9.2) — satisfies `>=22.13.0` |
| Node 24 targeted matrix | **NOT RUN** — Node 24 is not installed in this environment; only Node 22.13.1 (`C:\Program Files\nodejs`) was available |
| WSL / POSIX | **NOT RUN** — WSL is disabled on this machine ("WSL1 is not supported with your current machine configuration", no distributions installed). The audit therefore ran on Windows, the same platform class the implementation agent verified. Recorded as an environmental limitation, consistent with the Stage 02/03 dispositions. |
| Audit workspace disposal | temporary adversarial scripts and probe configs were deleted from the audit clone before this report was written; the audit clone itself is not committed anywhere |

Independence: the implementation report was treated as a set of claims only.
All evidence below comes from source inspection, freshly written adversarial
probes run against the fresh clone, direct execution of existing adversarial
test files, and real-process execution of the built SvelteKit server.

## Executive conclusion

The Stage 04 implementation is substantially real. The SDK dependency
direction was genuinely corrected (`@vict/sdk` depends only on
`@vict/contracts`; verified in package metadata, packed tarballs, and emitted
declarations). The three Stage 03 Low closures are genuine and survive fresh
adversarial probing on the sequential, durable in-memory, and SQLite engines
including real close/reopen. Application identity is deterministic, order
independent, revision sensitive, and the pure-TS SHA-256 is byte-identical to
`node:crypto` across boundary and randomized vectors. The SvelteKit proof is
a real adapter-node application whose route, view, form, actions, and
custom component all come from the neutral definition; denied actions stay
denied over raw HTTP; contract violations are rejected; a real VICT run is
created per capability invocation.

However, adversarial probing of the new Stage 04 surfaces found genuine
defects:

1. **`installCapabilityPack` is not atomic** — contracts are registered
   before capabilities and capabilities sequentially; a mid-install failure
   (e.g. a pre-registered capability collision) leaves earlier capabilities
   and contracts of the failed pack registered and activatable.
2. **Component-registry keys alias distinct identities** — the
   `componentId@revision` string key aliases `('a','1@2')` and `('a@1','2')`,
   and `identity()` mis-parses revisions containing `@` (reports `a@1@2` as
   `a@1`), so a release's registry identity snapshot can misreport what is
   registered.
3. **Authority declarations are not pinned** — mutating a raw (non-frozen)
   capability definition's `permissions` array after registration *and after
   activation* changes the enforcement observed by in-flight runs
   (permission-denied → completed), unlike contracts, which the activation
   pins by binding `parse` by value.
4. The **declared pack double is never installed** by
   `installCapabilityPack` (validated, then silently ignored), the
   **reference data adapter** consumes idempotency keys on failed creates,
   reconciles same-key retries to unrelated rows, leaks nested mutation into
   stored state, and stores hostile unknown fields on create, **CONT-001 is
   not enforced** (contract-less capabilities register, activate, and execute
   with unvalidated input *and* output — the SvelteKit proof's capability
   action has no output contract), and **identity collisions** are reachable
   through unvalidated canonical values (`NaN`/`-0`/`Infinity`/functions
   silently coerce in `canonicalize`).

None of these are Critical: no forbidden side effects, no secret leakage
(canary scans across manifests, events, traces, history, HTTP bodies, and
DOM all came back clean), no durable-execution corruption, and no
authorization bypass on the enforced paths. But per the severity rules, the
unresolved High findings block Stage 05. The required corrections are
contained and small (see Required corrections).

## Repository and command evidence

Fresh clone at `0f84d2e`, no pre-existing `dist`, clean tree. Full ladder in
the required order (every step's exit code recorded):

| Command | Exit | Observed result |
| --- | --- | --- |
| `git fetch origin` | 0 | `origin/main == HEAD == 0f84d2e` |
| `git status --short` (pre-install) | 0 | clean; no `dist` directories exist |
| `npm ci` | 0 | clean workspace install (packages + packs + SvelteKit proof) |
| `npm run typecheck` | 0 | strict, no errors (ran **before** build — no stale-dist dependency) |
| `npm run format:check` | 0 | all files Prettier-clean |
| `npm run lint` | 0 | 0 problems |
| `npm run build` | 0 | all six packages build |
| `npm run test:unit` | 0 | **38 files / 409 tests passed** |
| `npm run test:integration` | 0 | **1 file / 4 tests passed** |
| `npm test` | 0 | **39 files / 413 tests passed** |
| `npm run verify:consumer` | 0 | packed neutral + Zod + SQLite orchestration consumers; declaration scans clean |
| `npm run verify:stage2` | 0 | Stage 02 closure intact |
| `npm run verify:stage3` | 0 | Stage 03 closure intact (suites + offline proof + packed orchestration consumer) |
| `npm run verify:stage4` | 0 | build + suites + proof + isolated packed consumers PASSED |
| `npm run example` | 0 | ARA proof: **13 numbered ordered events** (counted) |
| `npm run bench` | 0 | `bench-three-node-pure (3 nodes, 2 edges, **10 events per completed run**)` |
| `npm run example:application` | 0 | SvelteKit proof builds (adapter-node) + **10/10 DOM tests** |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` (after ladder) | 0 | only the auditor's temporary `probe/` dir (removed afterwards) |

All implementer count claims reproduce exactly (409 + 4 = 413; 13 ARA
events; 10 bench events; 10 proof tests). One documentation slip: the
report's fresh-clone table says "38 files / 413" for `npm test`; the
observed fresh-clone count is 39 files / 413 tests (see LOW-04-J).

Repetition for timing/state leakage (independent auditor runs, not aggregate
scripts):

- `@vict/application` + `packs/*` + `@vict/sdk` unit suites: **3
  consecutive runs, 39/39 each**.
- `examples/application-proof` (DOM + conformance): **2 consecutive runs,
  10/10 each**.
- `parser-throw` (runtime + SQLite) + `orchestration-faults` +
  `durable-lifecycle` + `orchestration-race-conformance` +
  `store-sqlite/test`: **112 tests passed** in a direct targeted run.

## Package dependency boundary

Independently verified from package metadata, packed tarball consumers (via
`verify:consumer` / `verify:stage4`, which pack from `dist` and install into
fresh temp projects), and a manual scan of emitted declarations:

- `@vict/sdk` package.json dependencies: exactly `{"@vict/contracts":
  "0.1.0"}` (+ optional `zod` peer). Installing the packed SDK does not
  install kernel, runtime, Svelte, or Zod (consumer `node_modules` check in
  `verify:stage4`).
- Emitted SDK/Application `.d.ts` files: my grep hits for
  `@vict/runtime|@vict/kernel|svelte|zod` are confined to **comments**
  (e.g. the documented dependency-direction diagram); there are no runtime
  imports of any of them. No `node:` builtins in `@vict/application` dist
  (only a comment mentioning `node:crypto`).
- `@vict/application` deps: exactly `@vict/contracts` + `@vict/sdk`.
- Graph is acyclic: contracts → sdk → kernel → runtime → store-sqlite;
  application → contracts + sdk; kernel/runtime re-export authoring types
  from the SDK without back-dependency.
- Fresh-clone `npm run typecheck` passes **before** build with
  `skipLibCheck: false` in the isolated consumers — typecheck genuinely
  works against emitted declarations in a fresh clone.
- Kernel/runtime convenience re-exports do not produce duplicate nominal
  types (all consumers typecheck strictly against the emitted `.d.ts`).

**Result: dependency direction claim VERIFIED.**

## Authoring ABI and immutable captures

Probed with plain JavaScript objects (not only TypeScript), through all six
official factories:

- Ordinary mutable input: captured deep copies are frozen; post-definition
  mutation of the original has no effect (probe: `captured.note` stays
  `'original'`, added fields invisible).
- Symbol keys are dropped by the capture (safe: no smuggled state).
- A **shallow-frozen root** with mutable nested arrays is safe *through
  `defineCapability`* because the factory spreads the root before
  `frozenCopy`, so the nested objects are still copied.
- **However (HIGH-04-C context, MED items below):**
  - A **frozen intermediate object containing mutable descendants** is
    captured ATOMICALLY BY REFERENCE (`frozenCopy`: `Object.isFrozen(value)`
    → return `value`). Probe: `meta: Object.freeze({ desc })` — mutating
    `desc.secret` after `defineCapability` changed the captured definition
    (`'safe'` → `'RA4-CANARY-MUTATED'`). The architecture doc documents the
    atomic capture for frozen objects/contracts, but the practical effect is
    that `Object.freeze` on any nested object defeats the deep-copy
    guarantee for everything below it (MED-04-I).
  - An object with a callable `parse` property (not a real contract) is also
    captured by reference; replacing its `parse` after definition changed
    captured parsing behavior (`{ok:false, issues:[{code:'HIJACKED'}]}`).
    Intentional for shared frozen contracts, but combined with the frozen-
    intermediate case it means "mutation after definition cannot alter
    captured semantics" holds only for unfrozen, non-`parse`-bearing
    subtrees.
- Getters that throw during capture make `defineCapability` throw a raw
  `TypeError`/`Error` (not a structured diagnostic); proxies that throw on
  enumeration do the same. Low (hostile-input robustness).
- Getters that merely *read* are invoked once at capture; captured values
  are frozen — safe.
- Empty IDs/revisions: rejected at `registerCapability`
  (`VICT_RUNTIME_INVALID_CAPABILITY` / `VICT_RUNTIME_INVALID_REVISION`) and
  at pack/application/release validation. Whitespace-only component registry
  ids are accepted (`' '` passes `length > 0`) — Low.
- **Standalone capability definitions are NOT closed-schema validated**
  (MED-04-F): `registerCapability` silently ignores unknown fields. Probe: a
  capability declaring `permissionsTypo: ['secret.admin']` and
  `requriedSecrets: ['vault']` (misspelled authority fields) registers,
  activates, and runs with **no gate and no diagnostic** — the author's
  intended authority requirements silently vanish. Graph root/node fields
  are correctly rejected (`UNKNOWN_GRAPH_FIELD`, `UNKNOWN_NODE_FIELD`).
- **Effect classes are never validated**: `effect: 'teleport'` registers,
  activates, and runs; `effect: 'wriite'` (misspelled write) activates and
  runs the real handler in test mode where a genuine `write` would require a
  registered double — a silent safety-policy downgrade (LOW-04-E).
- `compileApplication` / `compileApplicationRelease` **deep-freeze
  caller-owned nested objects** (routes/screens/surfaces/release manifest)
  as a side effect of freezing the canonical manifest — an observable caller
  mutation from a documented-"pure" compiler (LOW-04-F). The resulting plan
  is safe (the manifest top-level entries are copies; the freeze is what
  prevents alias mutation).

## Stage 03 Low closures

All three closures were verified with fresh probes plus direct execution of
the implementation's adversarial suites on all three engines.

### Throwing parsers (LOW-1 closure) — VERIFIED

- The shared fixtures (`packages/runtime/test/parser-throw.test.ts`, 6
  tests; `packages/store-sqlite/test/parser-throw.test.ts`, real SQLite
  close/reopen + `recoverOrchestration` + `processDueTimers`) pass, and I
  re-ran them directly (33 tests across the four adversarial files; then
  112 tests across the fault/race/lifecycle files, twice).
- Fresh probes with **new** canaries:
  - decision-node contract parse throw on the durable in-memory engine:
    terminal `failed`, downstream invocation count 0, canary absent from
    error/events/record.
  - input contract returning hostile **Proxy** issues (throws on `get`,
    `ownKeys`, `getOwnPropertyDescriptor`): activation succeeds, run fails
    safely (`VICT_KERNEL_CONTRACT_REJECTED` path), canary absent from run
    record and error.
  - SQLite close/reopen fixture preserves exactly one `run.failed`, recovery
    changes nothing, canaries absent from the persisted event ledger before
    and after reopen.
- Parsers do not execute inside store transactions in the driver paths I
  traced (`parseSafely` wraps every author parser before any store call; the
  throw is converted to a sanitized terminal outcome committed as one
  transition).

### Unknown fields (LOW-2 closure) — VERIFIED for graph boundaries; GAP at standalone capabilities

- Graph root, node (per kind), edge, wait, and retry/backoff unknown fields
  are rejected with stable, path-sorted, insertion-order-independent
  diagnostics (`UNKNOWN_GRAPH_FIELD`, `UNKNOWN_NODE_FIELD`, …) — probed
  directly with plain objects.
- Packs, applications, resources, and releases have closed schemas with
  deterministic unknown-field diagnostics.
- **Gap (MED-04-H):** standalone capability definitions registered via
  `runtime.registerCapability` have NO closed-field validation — see
  Authoring ABI above. The Stage 03 LOW-2 closure therefore does not extend
  to the capability-definition boundary that Stage 04 itself owns.

### Wait/delay bounds (LOW-3 closure) — VERIFIED, with one authorization caveat

Probed through `runtime.activate` with the proper signal-wait graph shape on
both `undefined`/`null` and explicit values:

| `timeoutMs` | Result |
| --- | --- |
| `undefined` / `null` (absent, no timeout edge) | activated |
| `0`, `-100`, `1.5`, `NaN`, `±Infinity` | rejected `INVALID_WAIT_BOUND` |
| `1` | activated |
| `Number.MAX_SAFE_INTEGER` | rejected `INVALID_WAIT_BOUND` |
| `604800000` (exactly 7 days) | activated |
| `604800001` (7 days + 1 ms) | rejected `INVALID_WAIT_BOUND` |
| `9e15` (overflow-scale) | rejected `INVALID_WAIT_BOUND` |
| `null` timeoutMs **with** a declared timeout edge | rejected `TIMEOUT_EDGE_WITHOUT_SIGNAL_TIMEOUT` (Stage 03 HIGH-2 semantics intact) |

MED-04-E (the 7-day maximum): `MAX_DELAY_MS_LIMIT = 604800000` lives in
`packages/sdk/src/graph.ts`. Neither `VICT-SYSTEM-REFERENCE.md` nor
`STAGE-03-DURABLE-ORCHESTRATION.md` establishes any upper ms bound; the
reference's Stage 4 requirement is only that "invalid wait-level
timeout/delay bounds fail at compilation with a real stable diagnostic", and
the Stage 3 carry-forward defines invalid as non-positive/non-finite. The
7-day ceiling is therefore an **unapproved normative restriction**
introduced by the implementation. It is conservative, fail-closed at
compilation before persistence, and documented in the Stage 04 architecture
doc (§10) — so it is safe, but it lacks authority and should be ratified in
the system reference or removed.

## Capability-pack verification

Tested through the real public `installCapabilityPack`, not only
`validateCapabilityPack`.

### Declared doubles — NOT INSTALLED (MED-04-B)

`packages/runtime/src/pack-install.ts` registers contracts and capabilities
but **never touches `pack.bindings.doubles`**. A pack whose manifest
declares `doubles: [{capabilityId, revision, modes:['test','simulate']}]`
with a matching binding double installs cleanly, after which:

- `runtime` has NO registered double for the capability (probe: run in
  `test` mode → `blocked`, remediation text says "Register a test double …
  with runtime.registerDouble()");
- only after a manual `registerDouble(...)` does the test-mode run use a
  double (output `'MANUAL-DOUBLE'`);
- the declared `modes` eligibility is enforced nowhere (no code path reads
  `PackDoubleDeclaration.modes`).

The shared conformance suite (`pack-conformance.ts:238`) manually registers
a fresh lambda after installing the pack — exactly the weakness this audit
was warned about — so the suite does **not** prove that the pack's
declared/bound double is installed. The real handler invocation count
remained zero only because the run *blocked*; with the manual double it is
the manual lambda that runs, not the pack's declared one.

### Atomic installation — NOT ATOMIC (HIGH-04-A)

Reproduction (condensed):

```js
const rt = createRuntime();
rt.registerCapability({ id: 't.cap2', revision: '1', effect: 'pure', invoke: () => 'pre-existing' });
// pack declares t.cap1, t.cap2, t.cap3 (all revision '1')
try { installCapabilityPack(rt, pack); }        // throws VICT_RUNTIME_DUPLICATE_CAPABILITY
catch (e) { /* failed as expected */ }
// post-failure activations:
//   t.cap1: ACTIVE-ABLE   <- from the FAILED pack, still registered
//   t.cap2: ACTIVE-ABLE   (pre-existing)
//   t.cap3: not-registered
```

`installCapabilityPack` registers all binding contracts first, then
capabilities one-by-one; a failure midway leaves every earlier capability
and contract of the failed pack in the registry, activatable and executable.
No documented transactional or preflight guarantee exists (the architecture
doc only claims manifest cross-validation *before* registration). Also
probed:

- contract collision (`VICT_RUNTIME_CONTRACT_CONFLICT` on a differing
  contract object with the same id/revision) — fails, but the same
  non-atomicity applies;
- repeated installation of the same pack fails with
  `VICT_RUNTIME_DUPLICATE_CAPABILITY` (fail-visible, acceptable);
- **installation order dependence:** two packs that each bind their own
  contract object under the same contract id/revision can be co-installed
  in one order but fail (`VICT_RUNTIME_CONTRACT_CONFLICT`) in the other.
  Deterministic conflict detection rather than silent divergence, but
  order-dependent results with no documentation (LOW-04-C).

### Manifest completeness

- `manifest.version` is only checked non-empty: `version: 'not-semver!!'`
  passes `validateCapabilityPack` (`{ok:true}`) — the claimed "pack id +
  semver" is not enforced (LOW-04-A).
- Invalid effect class `'teleport'` in a pack declaration passes validation
  (the validator never checks the effect vocabulary) — LOW-04-A.
- Compatibility ranges: exact, `~`, `>=/<=/</>/=`, combined ranges, invalid
  ranges (`'banana'`, `''`), and prereleases (`^0.1.0-beta`) all behave
  correctly and fail closed. One deviation: `^0.1.0` matches `0.5.0` —
  standard semver caret for `0.x` caps at `0.2.0`; this implementation is
  more permissive for `0.x` (LOW-04-C).
- Manifest contract declarations correspond to executable bindings
  (missing/extra/revision-mismatched/contract-mismatched bindings all fail
  with stable `PACK_*` diagnostics — re-probed).
- Embedded-secret rejection is name-based (`value`, `secretValue`, `token`,
  `password`); value-like content under other names is not scanned (Low,
  consistent with the release-level behavior in LOW-04-D).
- Declared retry/ambiguity policies map to real defined behavior (kernel
  `IRREVERSIBLE_RETRY_DENIED`, `WRITE_RETRY_NOT_IDEMPOTENT`,
  `PACK_AMBIGUITY_NOT_DECLARED`), verified by source trace + pack probes.
- Installed semantics cannot be changed by mutating the original
  manifest/binding objects (pack `defineCapabilityPack` deep-copies; handler
  references are by design).
- See HIGH-04-A for the atomicity verdict.

## Least-authority verification

Probed on the sequential engine through public APIs with fresh identifiers:

- Missing permission → handler NOT invoked, `VICT_RUNTIME_PERMISSION_DENIED`
  (invocation counter stayed 0). Default-deny confirmed (runtime with no
  authority still gates a definition that declares requirements).
- Missing required configuration / secret → handler NOT invoked,
  `VICT_RUNTIME_CONFIGURATION_UNAVAILABLE` / `VICT_RUNTIME_SECRET_UNAVAILABLE`.
- Undeclared names: `context.config.get('cfg.other')` and
  `context.secrets.get('sec.other')` throw structured authority errors; one
  capability cannot read another capability's secret name (`otherCapabilitySecret`
  → `VICT_RUNTIME_SECRET_UNAVAILABLE`); declared names resolve normally.
- Provider exceptions inside a handler secret read are sanitized: the
  provider's canary message never appears in status/error/events
  (`VICT_RUNTIME_SECRET_UNAVAILABLE`-class failure, canary scan clean).
- Capability context exposes exactly: `runId, graphId, graphVersion,
  capabilitySetVersion, activationVersion, nodeId, capabilityId, mode,
  step, invokedVia` — no runtime, registry, store, or escape hatch.
- **TOCTOU (Informational):** the config/secret provider is read **twice**
  per invocation — once eagerly in the gate (value discarded) and again
  inside the handler via the scoped reader (`configReads = 2,
  secretReads = 2`). The preflight value is discarded, so the value checked
  and the value used can diverge if the provider is inconsistent. No
  authorization bypass (presence is still enforced), but check and use are
  not one consistent read.
- **HIGH-04-C:** mutating the RAW definition's `permissions` array after
  registration *and after activation* changes live enforcement:
  before mutation `run.status = 'failed'` with
  `VICT_RUNTIME_PERMISSION_DENIED`; after `def.permissions.length = 0` the
  same run **completes**. The gate (`gateCapabilityInvoke`) snapshots the
  *array references* at registration and reads them on every invocation.
  This contrasts with contract bindings, which the activation pins by
  binding `parse` by value and freezing (`runtime.ts:1032`). Adding a
  permissions array to a definition that had none at registration does not
  install a gate (consistent — nothing was declared at registration), but
  the unpinned mutation path means executable activation is not pinned
  against author-side mutation of raw definitions.

## Application identity and compilation

Independently probed:

- Identical semantics → identical `applicationVersion` across calls; 
  set-like reorder (actions) → identical; meaningful navigation order and
  surface order changes → different identity; resource revision change →
  different identity; provided resource revision wins over the referenced
  revision on mismatch (documented behavior).
- Deterministic across processes (plain JSON + SHA-256; no randomness).
- Pure-TS SHA-256 vs `node:crypto`: **byte-identical** on empty, ASCII,
  Unicode, emoji/surrogate pairs, 55/56/63/64/65/119/120-byte block
  boundaries, and 500 randomized inputs up to 400 chars.
- **MED-04-F:** the canonicalizer silently coerces out-of-domain values
  instead of rejecting them: `NaN`/`Infinity` → `null`, `-0` → `0`,
  `BigInt` → string, `Date` → ISO string, functions → dropped. Through
  reachable fields (`routes[].nav.order` is typed `number` but never
  value-checked; surface `props` accepts numbers): an application with
  `nav.order: NaN` and one with `order: null` produce the **same**
  `applicationVersion`; `-0` vs `0` collide; `Infinity` vs `null` collide;
  `compileApplication` accepts `nav.order` set to a *function* (`ok: true`,
  function dropped from the hash). The compiler's contract — "reject values
  outside the canonical serializable domain rather than silently create
  ambiguous identity collisions" — is not met. Cyclic values cannot enter
  through the closed schemas (all reachable fields are closed), and
  duplicate set-like ids are rejected before sorting can mask them (probe:
  reordering cannot mask duplicates — validation runs first).

## Release and component-registry verification

- Release binds application id/revision/`applicationVersion` exactly
  (`RELEASE_APPLICATION_MISMATCH` on drift); renderer revision change alters
  `releaseVersion` without touching `applicationVersion` (probed); unsafe
  provenance *field names* are rejected.
- **MED-04-G:** the component-registry binding is NOT cross-checked against
  the compiled plan: a release declaring
  `components: { registryId: 'reg.other', revision: '9', components:
  [{componentId: 'cmp.TOTALLY-DIFFERENT', revision: '7'}] }` compiles
  successfully. The release's registry identity is self-declared text; only
  the application binding is verified.
- **LOW-04-D:** provenance *values* are unscanned — `provenance: { author:
  'RA4-SECRET-CANARY-vault9' }` is accepted and enters `releaseVersion`.
  `compileApplicationRelease` can also throw on malicious getters (a
  getter-throwing `renderer` field escaped as a raw exception), contradicting
  its "never throws for invalid releases" header.
- The compiled release deep-freezes the manifest, and later mutation of the
  input object cannot change it — but `compileApplicationRelease` and
  `compileApplication` freeze caller-owned nested objects in the process
  (see LOW-04-F).

### Component registry — HIGH-04-B (identity aliasing)

Reproduction (condensed):

```js
const reg = createComponentRegistry('reg', '1');
reg.register({ componentId: 'a',   revision: '1@2', implementation: implA });
reg.register({ componentId: 'a@1', revision: '2',   implementation: implB });
// second register throws: "Component 'a@1@2' is already registered."
reg.resolve({ componentId: 'a@1', revision: '2' });  // resolves to implA (WRONG)
reg.identity();
// → {"components":[{"componentId":"a","revision":"1"}]}   (WRONG revision)
```

The `componentId@revision` concatenation aliases distinct identities, and
`identity()` splits on `@` taking only the first two segments, so a
revision containing `@` is silently misreported in the frozen identity
snapshot that release manifests bind. A release built from that snapshot
claims `a@1` while the registry holds `a@1@2` — the release identity does
not represent the registered component semantics. Per the audit severity
rules this is an identity collision affecting execution: **High**.

Also verified: duplicate registration rejected; multiple revisions of one
id supported; exact id/revision resolution; mutation of a registered
implementation object after registry identity capture changes rendering
semantics without a revision change (trusted-local trust boundary —
Informational; the identity snapshot only records keys, so nothing detects
it).

## Application-data boundary

`createInMemoryApplicationData` was probed directly (bypassing the proof
server). The header documents that mutation input "must cross the
resource's declared contract upstream" — the adapter itself validates only
required-field presence, not the declared contract, types, or field
catalogue. Observed:

- Wrong field types accepted (`title: 12345`, `count: 'not-a-number'`
  stored) — the declared input contract is not consulted.
- **Create stores unknown/attacker fields verbatim**: `{is_admin: true,
  password: 'hunter2'}` persisted into the row.
- **Update silently discards unknown/hostile fields** (no rejection, no
  policy).
- Invalid limits/offsets do not fail: `limit: 'five'`, `limit: -5`,
  `offset: -99, limit: NaN` all return `ok: true` with empty results.
- Unknown filter fields rejected (`DATA_UNSUPPORTED_QUERY`) — good; unknown
  projection fields silently ignored (return `{}` rows) — Low.
- Authorization (resource-level and mutation-level permission checks plus
  effect honesty) happens before any table access — verified.
- Error messages echo attacker-controlled ids/resource names
  (`Unknown resource 'notes'; DROP TABLE--'`) — Low.

**MED-04-C (idempotency correctness):**

```
seed: row id='existing'
1) create {id:'existing'} with idempotencyKey 'K1'  -> DATA_INVALID_INPUT (correct)
2) create {id:'brand-new'} with key 'K1' (retry)    -> ok:true, returns the
   'existing' row; 'brand-new' is never created
```

`seenIdempotencyKeys.set(...)` executes BEFORE the duplicate-identity
check, so a failed create consumes the key; the retry with the same key and
a different payload silently reconciles to the unrelated earlier identity's
row. The key map is also **global across resources**: the same key used on
resource `notes` then resource `docs` returns `ok: true` with an empty row
for the `docs` request. `update`/`delete` ignore idempotency keys entirely.
The shared `runApplicationDataAdapterSuite` does not detect any of this.

**MED-04-D (defensive isolation):** seeds are stored by reference (mutating
a seed object after adapter creation mutates stored state: `title:
'MUTATED', nested.v: 999` observed); `create`/`query` return shallow copies
(mutating a returned row's nested `tags` array or `title` mutates stored
canonical state). "None can mutate stored canonical state" is not met for
nested structures.

Concurrent same-key/same-payload mutations behave idempotently (one create,
one reconcile) — acceptable.

## Renderer and SvelteKit proof

- `runRendererConformanceSuite` genuinely enforces role honesty, unknown
  component diagnostics before rendering, plan immutability, and idempotent
  teardown — I re-read its source and the Svelte host passes it.
- **The action-canary check (#5) is skipped for the Svelte host**: the
  proof's conformance invocation supplies neither `buildFailingActionPlan`
  nor `serializeOutput`, so the hostile-action canary scenario never runs
  (LOW-04-E). Additionally the fixture's own canary check uses
  `JSON.stringify(error)`, which cannot see non-enumerable `message`
  fields (verified: `JSON.stringify(new Error('x'))` does not contain
  `'x'`).
- Fresh DOM probes against the real Svelte host (happy-dom, dispatch spies,
  actual button clicks):
  - clicking the `kind: 'local'` action (`act.clear`) **invokes the
    injected dispatcher** (`calls = [{"actionId":"act.clear"}]`), which in
    the real app is `fetch('/api/act')` — see MED-04-G;
  - a dispatcher that throws a hostile canary: the canary never reaches the
    rendered DOM; the transient result state does not update and the
    declared `failure` state does NOT render — the throw surfaces only as
    an unhandled promise rejection (LOW-04-E).

### Real adapter-node server (separate process, port 4471)

| Probe | Result |
| --- | --- |
| `GET /` | 200; renders screen title, view, form (`sf.note`), local/VICT/admin actions, custom component — all from the definition |
| `POST /api/act create {id:'n1',title:'alpha'}` | `ok:true`, row persisted (visible in `GET /`) |
| `POST /api/act create {id:'',title:42}` | `CONTRACT_REJECTED`, nothing stored |
| `POST /api/act summarize` | `ok:true, {summary:'hello (5 chars)'}` — real VICT run |
| `POST /api/act adminDelete` | `DATA_UNAUTHORIZED` — denied below the UI over raw HTTP |
| `POST /api/act act.clear` | `ok:true {local:'cleared'}` — handled by the **server dispatcher** (see MED-04-G) |
| `POST /api/act act.nope` | `UNKNOWN_ACTION` |
| `POST /api/act` malformed JSON | `BAD_REQUEST` 400 |
| `GET /nonexistent-page` | **200** — the catch-all renders the application for ANY path (`plan.routes.find(path) ?? plan.routes[0]`), no 404 (LOW-04-J) |

- Exactly one `+page.svelte` exists (`src/routes/[...vict]/`); no
  screen-specific page shell; the host contains no proof-specific markup
  (the shared conformance suite renders *different* definitions through the
  same host, which is my evidence of definition-driven-ness in lieu of a
  second deployed definition).
- The proof's capability action declares `input: undefined, output:
  undefined` on the capability (input is validated via the node-level
  contract override and a manual pre-parse at the server boundary), but the
  **run output is never contract-validated** before crossing to HTTP/DOM —
  see MED-04-A. The report's claim that "the capability declares and
  enforces both input and output contracts" is therefore only half true
  (input yes, output no).

## Security and canary results

All canary scans came back clean on the paths that matter:

- Secret canaries (`RA4-LEDGER-SECRET-CANARY-vault9`-style, fresh
  `AUD04-*` canaries): absent from pack manifests, application manifests,
  plans (`toJSON`), release manifests, compiler diagnostics, renderer
  diagnostics, runtime events/traces, run records/history, SQLite
  operational surfaces (per the fixture, which scans before and after
  reopen), and HTTP response bodies (real-server probes).
- Throwing-parser canaries (message + nested cause + hostile getters +
  throwing proxies): absent from every persisted surface on sequential,
  in-memory durable, and SQLite durable engines.
- Provider exceptions inside handler secret reads are sanitized.
- Embedded secret *values* are rejected by name-based detection in packs
  and releases; provenance value scanning is absent (LOW-04-D).
- `UI visibility ≠ authorization` verified over raw HTTP: `adminDelete`
  denied at the boundary with the button rendered.

## Regression results

- Stage 01–03 adversarial suites executed directly (not via aggregate
  scripts): parser-throw (runtime + SQLite), orchestration-faults,
  orchestration-race-conformance, durable-lifecycle, store-sqlite suite —
  **112 tests, all passing**; plus `verify:stage2` and `verify:stage3`
  (which include the packed consumers and the six real-process restart
  fixtures) exit 0.
- ARA: exactly 13 ordered events. Benchmark: 10 events per completed
  three-node run. Both re-run directly.
- Stage 03 architecture/reference/audit documents: `git diff
  9678b26..0f84d2e` touches none of them (0 files).
- Activation identity, durable-before-invocation ordering, cancellation,
  operator resolution, exact-activation restart, SQLite fault boundaries:
  covered by the passing Stage 03 conformance suites on both adapters; no
  regression observed.

## Claim matrix

| Claim (VICT-STAGE-04-REPORT.md) | Verdict | Evidence | Severity |
| --- | --- | --- | --- |
| Final SHA history (5897c69 → 882e4ff → 0f84d2e) | Verified | `git log`; chain confirmed; owner changes untouched | — |
| File/test counts (409/4/413; 13 ARA events; 10 bench events; 10 proof tests) | Verified | Fresh-clone ladder reproduced exactly | — |
| Fresh-clone `npm test` "38 files / 413" | Partial | Observed 39 files / 413 (count slip in the addendum table) | Low |
| "Final remote SHA 882e4ff" | Partial | Superseded by `0f84d2e` (the report addendum commit itself); no misdirection, but the row is stale | Low |
| SDK depends on contracts only; no runtime/kernel/Svelte/Zod | Verified | package metadata + packed consumers + declaration scan (references are comments only) | — |
| Optional Zod subpath works only with Zod installed | Verified | isolated consumer checks | — |
| Strict typecheck before build in fresh clone | Verified | ladder order | — |
| Capability packs install explicitly with cross-validation | Verified | probes + suite | — |
| Declared pack doubles install and run | **False** | `installCapabilityPack` ignores `bindings.doubles`; test-mode run blocks; manual `registerDouble` required (also in the conformance suite) | Medium |
| Pack installation safe/preflighted | Partial | Validation is preflight, but registration is non-atomic with partial mutation on collision | **High** |
| Full contract validation at the authoring boundary | Partial | Graphs/applications/releases validate; standalone capabilities accept unknown fields and invalid effects; contract-less capabilities execute unvalidated | Medium |
| Immutable deep copies for all official factories | Partial | Unfrozen non-`parse` inputs are safe; frozen intermediates and `parse`-bearing objects are captured by reference and mutable | Medium |
| Local action remains presentation-local | Partial | `act.clear` crosses `/api/act` and the server dispatcher; zero durable runs and zero data ops are TRUE and tested; strict locality is not implemented; the report's own wording ("every action crosses the /api/act server boundary") is accurate, the architecture doc's "stays local" is not | Medium |
| Safe renderer errors / canary | Partial | DOM probes clean; but the shared canary check is skipped for the Svelte host, and a dispatcher throw becomes an unhandled rejection that never shows the failure state | Low |
| Secrets never enter manifests/history | Verified | canary scans (with the LOW-04-D provenance-value caveat) | — |
| Seven-day wait bound | Partial | Enforced exactly as documented, but the ceiling lacks normative authority in the system reference | Medium |
| ARA/bench/regression numbers | Verified | re-executed | — |
| Stage 03 docs untouched; system reference not marked Verified | Verified | `git diff` empty for those paths; reference still shows Stage 4 permitted/not implemented | — |

## Findings

**HIGH-04-A — Capability-pack installation is not atomic; a failed install leaves partially registered contracts/capabilities.**
- Requirement: Stage 04 pack model (architecture §3); audit §7.
- Reproduction: pre-register `t.cap2@1`, install a 3-capability pack binding `t.cap1..t.cap3`; install throws `VICT_RUNTIME_DUPLICATE_CAPABILITY`, after which `t.cap1` from the failed pack is registered and activatable (probe output: `t.cap1:ACTIVE-ABLE`).
- Expected: a failed installation leaves the registry unchanged (or an explicitly documented transactional/preflight guarantee).
- Observed: contracts register first, capabilities sequentially, no rollback.
- Impact: partially installed packs are executable; callers cannot assume install failure implies untouched registry.
- Correction: preflight all registrations against a registry snapshot (or register into a staging map committed on success), or document a strict non-atomic guarantee with a compensating API. 

**HIGH-04-B — Component-registry key aliasing corrupts component identity.**
- Requirement: APP-014, Stage 04 component registry (architecture §8); audit §11.
- Reproduction: register `('a','1@2')` then `('a@1','2')` — collision; `identity()` reports `[{componentId:'a', revision:'1'}]` for a component registered at `1@2`; resolution returns the wrong implementation.
- Expected: key construction/parsing cannot alias distinct identities; the frozen identity snapshot must faithfully describe the registry.
- Observed: string concatenation `id@rev` + `split('@')` parsing.
- Impact: release manifests can misreport the component registry identity; a release claiming one component can resolve different component semantics.
- Correction: reject `@` (or define escaping) in component ids/revisions at registration, and key the map structurally (two-level map) instead of string concatenation.

**HIGH-04-C — Authority declarations are not pinned into activations.**
- Requirement: CONT-008-analogous immutability for executable semantics; architecture §3.1 ("the WRAPPED invoke is what activations capture, so enforcement is identical on both engines"); audit §8.
- Reproduction: register a raw definition with `permissions: ['perm.orig']`, activate, run (fails `VICT_RUNTIME_PERMISSION_DENIED`); set `def.permissions.length = 0`; run again → completes. The wrapped gate reads the live array each invocation.
- Expected: active enforcement semantics remain pinned after registration/activation (as contract parsing is pinned by value).
- Observed: gate snapshots array *references*, not contents.
- Correction: snapshot the declared names (copy + freeze) inside `gateCapabilityInvoke`/`registerCapability`, and/or freeze authority-bearing arrays at registration.

**MED-04-A — CONT-001 is not enforced: contract-less capabilities execute with unvalidated input and output, and the SvelteKit proof's capability action has no output contract.**
- Requirement: CONT-001 (Verified Invariant: "Every executable capability MUST declare input and output contracts"); audit §4/§15.
- Reproduction: `registerCapability` without `input`/`output` (plain object, wrong-typed input, even a bare string) registers, activates, and completes with unvalidated passthrough; a pack capability without contract declarations installs and runs; the proof's `proof.summarize` output crosses to HTTP unvalidated.
- Expected: the authoring ABI/runtime rejects executable capabilities without declared contracts (or the reference documents a bounded exception and the proof validates output).
- Correction: enforce contract presence at registration (or activation), and add an output contract to the proof's capability.

**MED-04-B — Declared pack doubles are never installed.**
- Requirement: architecture §3 ("doubles and simulation policy"); audit §7.
- Reproduction: pack with `manifest.doubles` + matching `bindings.doubles`; after `installCapabilityPack`, test/simulate runs block with "no double registered"; only manual `registerDouble` works; `PackDoubleDeclaration.modes` is dead code.
- Correction: install declared doubles at pack installation (respecting `modes`), or remove `manifest.doubles` from the documented manifest semantics.

**MED-04-C — Reference data adapter: failed mutations consume idempotency keys; cross-resource and cross-payload key reconciliation returns wrong rows.**
- Requirement: audit §12 ("A failed mutation must not consume an idempotency key").
- Reproduction: failed duplicate create with key `K1`, then retry with same key and a different identity → `ok: true` returning the unrelated prior row; the retried row is never created. Same key on a second resource returns an empty row `ok: true`.
- Correction: consume keys only on success; scope keys per (resource, op); define key semantics for update/delete or reject keys there.

**MED-04-D — Reference data adapter: no defensive isolation and no input-field policy.**
- Requirement: audit §12.
- Reproduction: seeds stored by reference (seed mutation changes stored state); returned rows share nested objects (row mutation changes stored state); create persists unknown/attacker fields; update silently discards unknown fields; no type/contract validation.
- Correction: deep-copy seeds/rows at the boundary; define (and document) unknown-field policy for create/update; validate against the declared field catalogue/contracts.

**MED-04-E — The seven-day wait-bound maximum lacks normative authority.**
- Requirement: audit §6.
- Evidence: `MAX_DELAY_MS_LIMIT = 7 * 24 * 60 * 60 * 1000` in `packages/sdk/src/graph.ts`; no such bound exists in the system reference or Stage 03 architecture (both were searched).
- Correction: either add the operational bound to the system reference (with rationale) or remove it; it is otherwise conservative and fail-closed at compilation, which is why this is not blocking on its own.

**MED-04-F — Canonical identity silently coerces out-of-domain values, creating reachable identity collisions.**
- Requirement: audit §9 ("The compiler must reject values outside the canonical serializable domain").
- Reproduction: `nav.order: NaN` vs `null` → same `applicationVersion`; `-0` vs `0` → same; `Infinity` vs `null` → same; a function-valued `order` is accepted and dropped from the hash.
- Correction: type-check numeric fields (and reject non-canonical value types) during compilation, or harden `canonicalize` to report unsupported values as diagnostics.

**MED-04-G — The declared `kind: 'local'` action crosses the server boundary; strict APP-011 locality is not implemented in the proof.**
- Requirement: APP-011 ("Presentation-only interactions MUST remain local…"); audit §14.
- Evidence: clicking the local action invokes the dispatcher (dispatch spy: `[{"actionId":"act.clear"}]`), which posts to `/api/act`; `server.dispatch` handles `act.clear` and returns a constant. No VICT run, no data operation (both verified — the safety-critical half of APP-011 holds, and the report's "zero durable runs" wording is accurate), but the interaction is not renderer-local, and `server.ts` ("local actions never leave the renderer boundary") and the architecture doc ("the local action stays local") overclaim.
- Correction: either implement renderer-local execution for `kind: 'local'` actions in the host (dispatch-free transient state update) or reword the architecture/proof documentation to describe the actual boundary; align the proof with APP-011 in Stage 05's renderer.

**MED-04-H — Standalone capability definitions are not closed-schema validated (unknown fields and invalid effect classes silently accepted).**
- Requirement: LOW-2 closure symmetry; audit §6.
- Evidence: `permissionsTypo`/`requriedSecrets` silently ignored (no gate, no diagnostic); `effect: 'wriite'` silently downgrades effect-policy enforcement (real handler runs in test mode where a real `write` would require a double).
- Correction: validate capability definitions at `registerCapability` (closed fields + effect vocabulary), or validate inside `defineCapability`.

**MED-04-I — Frozen intermediates and `parse`-bearing objects are captured by reference, so captured semantics can change after definition.**
- Requirement: architecture §2 ("Mutating an author's original object after definition cannot alter captured semantics (tested)"); audit §5.
- Evidence: `defineCapability({ meta: Object.freeze({ desc }) })` then `desc.secret = 'RA4-CANARY-MUTATED'` changes the captured definition; a nested object with a callable `parse` is likewise live.
- Correction: deep-copy frozen intermediates that contain unfrozen descendants (preserve identity only for genuinely frozen complete object graphs), or scope the atomic capture strictly to top-level contract fields.

**MED-04-I (note) — `compileApplication`/`compileApplicationRelease` freeze caller-owned nested objects** (observable caller mutation from a "pure" compiler). Reported per the audit brief; the resulting plans are safe. Tracked inside MED-04-I/Low.

**LOW findings:**
- **LOW-04-A:** pack `version` not semver-validated; effect vocabulary unvalidated in the pack validator; `PACK_BINDING_EFFECT_MISMATCH` code defined but unused.
- **LOW-04-B:** `compileApplicationRelease` throws on hostile getters; provenance values unscanned (secret canary accepted into release identity); whitespace-only component ids accepted.
- **LOW-04-C:** caret `^0.x.y` more permissive than semver for `0.x`; installation-order dependence when two packs bind different contract objects under one contract id; no documented co-install rules.
- **LOW-04-D:** provenance value scanning absent (secret canary in `author` enters `releaseVersion`).
- **LOW-04-E:** renderer conformance action-canary check skipped for the Svelte host (no `buildFailingActionPlan`/`serializeOutput` supplied); `JSON.stringify(error)` canary scan misses non-enumerable messages; a dispatcher throw becomes an unhandled rejection and never renders the declared failure state.
- **LOW-04-F:** compilers freeze caller-owned nested objects (caller mutation side effect).
- **LOW-04-G:** reference adapter accepts invalid limits/offsets silently (empty results); unknown projection fields silently ignored; error messages echo attacker-controlled ids.
- **LOW-04-H:** TOCTOU — config/secret providers read once in preflight and again in the handler (values not pinned; 2× provider reads).
- **LOW-04-J:** documentation mismatches: fresh-clone "38 files" vs observed 39; "Final remote SHA 882e4ff" row superseded by `0f84d2e`; the generic catch-all renders the first declared route for unknown paths with HTTP 200 (no 404) — acceptable for the minimal proof but undocumented.

**Informational:**
- Trust boundary (documented): identity reflects DECLARED semantics; handler bodies and post-registration implementation mutation are the author's responsibility (accepted, consistent with prior stages).
- Registry implementation objects are held by reference; mutating a registered component implementation post-release changes rendering semantics without any revision or identity change (trusted-local implementations).
- Stage 03 carry-forwards (completion-phase store faults after lease lapse; cooperative cancellation race) remain unchanged and out of Stage 04 scope.

## Severity summary

| Severity | Count | IDs |
| --- | --- | --- |
| Critical | 0 | — |
| High | 3 | HIGH-04-A, HIGH-04-B, HIGH-04-C |
| Medium | 8 | MED-04-A … MED-04-I (A, B, C, D, E, F, G, H, I) |
| Low | 9 | LOW-04-A … LOW-04-J |
| Informational | 3 | trust boundaries + Stage 03 carry-forwards |

## Required corrections

Genuine blockers (must close before Stage 05):

1. **HIGH-04-A** — make `installCapabilityPack` atomic (preflight/rollback) or document a strict, explicit non-atomic contract with a safe re-installation path.
2. **HIGH-04-B** — eliminate component-registry key aliasing (separator validation or structural keys) so `identity()` and resolution can never misreport or cross-bind components.
3. **HIGH-04-C** — pin authority declarations: snapshot/freeze permission/configuration/secret name arrays at registration so activation semantics cannot change through later mutation of raw definitions.

Strongly recommended in the same remediation pass (they touch Stage 05's
foundation directly, though they are not the sole blocking reason):
MED-04-A (CONT-001 enforcement + proof output contract), MED-04-B
(declared double installation + a conformance probe that does not manually
register the double), MED-04-C/D (adapter idempotency key semantics and
defensive isolation, extended into the shared conformance suite).

## Recommendation

**Stage 05 may not begin** until the three High findings are remediated and
independently re-verified. The corrections are contained (pack-install.ts,
renderer.ts registry, authority.ts/registry.ts, plus targeted tests) and do
not require architectural change. Stage 05's safe scope, once Stage 04 is
re-verified, is unchanged from the accepted Stage 05 boundary: canonical
SvelteKit renderer/component suite, host scaffolder, theming, the local
SQLite application-domain adapter, and the §17.10 reference proof — with the
MED-04-C/D adapter corrections folded in first, since Stage 05 owns the
production data adapter and will otherwise inherit the reference adapter's
idempotency and isolation defects.

Positive note for the remediation: the implementation quality is high
overall. Sanitization, parser-throw closures, least-authority gating on the
enforced paths, canonical identity, and the SvelteKit proof's security
posture all withstood fresh adversarial probing with zero Critical findings
and zero secret leakage.