# VICT Stage 06A — Product-Agent Foundation Report

## Outcome

**PASS** — implementer claim, submitted for fresh independent audit. All
mandatory Stage 06A requirements are implemented with permanent automated
evidence; every verification-ladder command passed; the three-run full-suite
repeat and the five-run Stage 06A targeted repeat passed. Nothing in this
increment is claimed as Verified — that determination belongs exclusively to
the independent auditor.

## Starting and final SHAs

| | SHA |
| --- | --- |
| Required starting commit (verified `origin/main`) | `e2c2b523756ffc98daa47ea37a31e1d48a174b16` |
| Stage 05 closure commit (in ancestry, untouched) | `6ed4d42` |
| Final implementation SHA | see the commit list in §16 (final `docs` commit) |
| Final remote SHA | pushed to `origin/main` at delivery (see §16) |

Environment: Windows 11, win32-x64, Node v22.13.1, npm 10.9.2. Node 24 and a
second operating system were NOT available for this increment (environmental
limitation, recorded honestly; see §15).

## Implemented

- **Neutral ProductAgent boundary** (AI-001/AI-002): `vict.agent-stream@1`
  normalized event contract in `@vict/contracts`; profile authoring in
  `@vict/sdk`; profile compilation + deterministic identity in
  `@vict/kernel`; registries, immutable activation snapshots, turn pinning,
  credential boundary, and governed deletion/export services in
  `@vict/runtime`. Neutral packages contain no `@mastra/*` dependency and
  their base emitted declarations contain none of `@mastra/`, `Mastra`,
  `LibSQLStore`, `ZodType`.
- **Strict agent-profile schema** (`vict.agent-profile@1`): closed field
  sets at every level; all fifteen runtime-affecting components of
  amendment §6.1 explicitly represented; canonical-data-only input boundary
  (accessors rejected by descriptor inspection without invocation; hostile
  proxies, sparse arrays, cycles, exotic prototypes rejected); path-sorted,
  deterministic, non-echoing diagnostics; no partial compiled output.
- **Deterministic `agentProfileVersion`** (AI-003): versioned SHA-256 over
  the canonical manifest; set-like collections canonically sorted;
  processor/guardrail chains order-preserving; every pinned runtime package
  version participates; forbidden inputs (function bodies, secrets, time,
  randomness, framework/schema-library internals, memory contents,
  payloads) structurally unreachable. Cross-process determinism proven with
  real child processes.
- **Registry, activation, and snapshot semantics** (AI-004): atomic direct
  registration and atomic batch installation; duplicates fail without the
  explicit `replaceProfile` API (which pins the expected previous
  revision); activation resolves EVERY revisioned component exactly,
  deep-captures a frozen snapshot, binds function references without
  hashing/serializing them; missing/mismatched artifacts fail closed;
  registry maps are never exposed; persisted identity records restore
  exactly or fail closed (no substitution by newer definitions).
- **Real pinned adapter** (`@vict/mastra`): REAL pinned `Agent`, `Memory`,
  `Mastra`, `LibSQLStore`, `Observability`, `MastraStorageExporter`,
  `createTool` — no fake look-alike. Deterministic offline model fixture
  (LanguageModelV2-structural, locally declared wire types), real stream
  chunk normalization to `vict.agent-stream@1`, sanitized terminal failures,
  no network (offline guard) and no provider credentials.
- **Adapter-native helper tools** (§6.5): pure-only (non-pure rejected
  before activation), versioned, neutral input/output contracts with
  authoritative VICT validation at the boundary, sanitized failure handling,
  frozen snapshot binding, inclusion in `agentProfileVersion`, outputs
  untrusted.
- **Memory/storage separation** (MSTR-003): dedicated file-backed
  `LibSQLStore` (`mastra_*` tables) physically separate from VICT
  operational (`vict_*`) and application-domain (`appdata_*`) stores;
  eager schema initialization; close/reopen and fresh-process persistence
  proven; actor/thread isolation with no cross-user access.
- **Local data-protection baseline** (MSTR-011): protected-only just-in-time
  credential resolution (no caching, sanitized failures, no poisoning);
  payload-safe tracing with explicit sampling, mandatory input/output
  hiding, and exporter-level error redaction (verified against STORED
  records and raw database bytes); explicit retention bounds with an
  actually executed prune (injectable as-of clock; idempotent); governed
  conversation deletion across stores with durable intents, per-step
  receipts, forward-only state, injected-failure and real-SIGKILL recovery,
  receipt deduplication, and truthful partial status; actor-scoped export
  with deterministic ordering and no retention; public-root separation,
  traversal rejection, honest Windows permission documentation; normative
  data-classification table.
- **Version-upgrade conformance harness** (MSTR-002): installed-version
  checks against the exact pins plus primitive-surface probes, offline.
- **AUDIT-F1 closure**: the scaffolder real-build fixture now generates into
  a UNIQUE per-process `mkdtemp` directory (`.tmp-scaffold-check-<random>`
  inside the repo root — never the shared fixed path), cleaned exactly;
  parallel-process collision regression added; no scaffolder path-safety or
  deterministic-output test weakened.

Explicitly NOT implemented (per scope boundary): ChangeSets/control plane,
HTTP command API, SSE transport, the final field-level `vict.agent-stream@1`
wire schema (OPEN-015 stays open), CLI remote operations, the capability
tool bridge, human approval transport/UI, real provider credentials or
calls, the real ARA product, rich conversation UI, Stage 06B, Stage 07,
Builder Agent, multi-tenant claims.

## Package dependency graph

```text
@vict/contracts
       ↓
@vict/sdk ──────────────┐
       ↓                │
@vict/kernel ───────────┼→ @vict/mastra → pinned @mastra/core 1.64.0
       ↓                │              → pinned @mastra/memory 1.28.2
@vict/runtime ──────────┘              → pinned @mastra/libsql 1.22.3
       ↓                               → pinned @mastra/observability 1.17.5
@vict/store-sqlite
```

Verified acyclic: no neutral package imports `@vict/mastra`; the adapter
imports only neutral VICT packages, pinned `@mastra/*`, and `zod`
(Mastra's peer requirement); no `ee/` import anywhere; no undeclared
transitive reliance (verified by `verify:stage6a` scans).

## Pinned Mastra versions

| Package | Version | License |
| --- | --- | --- |
| `@mastra/core` | `1.64.0` (exact) | Apache-2.0 |
| `@mastra/memory` | `1.28.2` (exact) | Apache-2.0 |
| `@mastra/libsql` | `1.22.3` (exact) | Apache-2.0 |
| `@mastra/observability` | `1.17.5` (exact) | Apache-2.0 (directly required: stored-trace persistence for MSTR-008/MSTR-011) |

`zod ^3.25.76` is declared as the pinned core's required peer channel for
tool-schema bridging (range, matching the workspace). The lockfile records
exact resolved versions; the adapter consumer check proves registry-exact
resolution outside the workspace. NOT installed: `@mastra/client-js`,
`@mastra/deployer`, `@mastra/pg`, `@mastra/upstash`, `@mastra/ai-sdk`,
`mastra` (CLI).

## Neutral product-agent API

- `@vict/contracts`: `AGENT_STREAM_SCHEMA`, `AgentStreamEvent` union
  (13 closed kinds), `AgentStreamContext`, per-event `seq`.
- `@vict/sdk`: `AGENT_PROFILE_SCHEMA`, `AgentProfileAuthoring`,
  `AgentReference`, `AgentModelProfileAuthoring`, `AgentGenerationOptions`,
  `AgentTurnPolicy`, `AgentAdapterCompatibilityAuthoring`,
  `defineAgentProfile`.
- `@vict/kernel`: `compileAgentProfile`, `CompiledAgentProfile`,
  `AgentProfileIssue(Code)`, `AGENT_PROFILE_IDENTITY_SCHEMA`.
- `@vict/runtime`: `AgentProfileRegistry`, `AgentProfileActivation`,
  `AgentActivationRecord`, `restoreActivation`, `ProductAgentPort`,
  `pinAgentTurnRunner`, `AgentTurnRequest/Context/Outcome`,
  `AgentArtifact(+Kind/Binding)`, `AgentHelperToolDefinition/IO`,
  `AgentGovernanceStore`, `InMemoryAgentGovernanceStore`,
  `ConversationDeletionCoordinator`, `ConversationExportService`,
  `protectCredentialPort`, `requireCredential`, `AgentCredentialPort`,
  `AGENT_ACTIVATION_IDENTITY_SCHEMA`, `AGENT_ACTIVATION_RECORD_SCHEMA`.

## Agent identity model

See `docs/architecture/STAGE-06A-PRODUCT-AGENT-FOUNDATION.md` §3–§4.
Summary: `agentProfileVersion = 'v1_' + SHA-256(identity schema + canonical
manifest)`; the manifest covers every §6.1 component; sets are canonically
sorted, chains preserve order; insertion order, function bodies, secrets,
time, randomness, and framework/schema-library internals never participate;
equivalent profiles across processes produce identical versions (proven
across real child processes).

## Snapshot semantics

Activation deep-captures a frozen VICT-owned snapshot of every resolved
component (exact revisions; fail-closed on any missing/mismatched artifact;
no current-definition substitution); function references are bound, never
hashed or serialized; the persisted record is identity only (canonical
manifest JSON + sorted artifact list) and restoration re-resolves and
compares BOTH the profile version and the derived activation version in the
fresh process; in-flight turns are structurally unable to observe registry
mutation (frozen snapshot + barrier-controlled tests).

## Mastra adapter evidence

- Real `Agent` runs the deterministic offline fixture end to end; the same
  input produces the same text, the same event sequence, and gapless `seq`
  numbers (in-process AND packed-consumer AND fresh-process evidence).
- Real helper tool executes through the contract boundary; tool event
  vocabulary (`tool.requested`/`started`/`completed`/`failed`) normalizes
  the pinned chunk stream.
- Terminal model failure is sanitized: the canary thrown inside the fixture
  appears in NO event, outcome, trace span, or database byte; the stable
  `VICT_AGENT_TURN_FAILED` code is the only observable failure.
- Guardrail rejection fails the turn closed with a stable guardrail code.
- `agent.metadata` records the pinned activation identity and the fixture's
  provider/model identity (`offline-fixture/deterministic-1`) as metadata.
- Pinned versions are observable in the adapter marker and proven present by
  the conformance harness and the packed-consumer version checks.

## Helper-tool policy

Pure-only enforcement before activation (`effect: 'write'/'irreversible'`
rejected); authority-widening fields rejected (closed schema); input/output
contract validation with stable non-echoing denial codes; thrown
message/nested-cause canaries never re-enter the model context; in-flight
binding pinned against post-activation mutation; sorted membership in the
profile identity; outputs are data, never authority.

## Memory and store boundaries

Dedicated `mastra/mastra-store.db` (`mastra_*` tables, own bookkeeping) —
physically separate from `vict_*` operational tables (same SQLite
technology allowed; disjoint namespaces, migrations, and authority) and
from `appdata_*` application-domain tables. No shared handle; the
governance tables are additive (`vict_agent_*`, migration version 3) and
the migration test now proves both the additive tables and the untouched
legacy table set. Close/reopen, fresh-process persistence, actor/thread
isolation (cross-actor reads are empty), and no-public-root placement are
all permanently tested. The deployment envelope (local-first, single actor,
single application process, non-multi-tenant, file-backed) is declared at
the composition boundary; no multi-process/multi-tenant/cloud claim is
made.

## Local data-protection evidence

- Credential canary planted at the provider: absent from events, outcomes,
  memory, trace spans, governance tables, and raw database bytes after
  close/reopen.
- Model/provider thrown canary: absent from events, outcomes, STORED
  observability records, and raw database bytes (exporter-level error
  redaction + provider-boundary sanitization requirement documented).
- Helper-tool thrown canaries (message + nested cause): absent from the
  model context; stable denial codes only.
- Hostile object keys: hostile key NAMES may appear in rejection diagnostics
  (established non-echoing discipline: names/paths/codes only); hostile
  VALUES never appear anywhere; no partial compiled profile exists.
- Stored spans carry `input: null`, `output: null`, redacted errors, and
  only stable correlation metadata — inspected via the observability domain
  AND raw `mastra_ai_spans` bytes, not serializers.
- Pruning: aged records removed, current records kept, idempotent repeat;
  injectable as-of clock (future as-of rejected).
- Deletion: success, partial failure at every boundary, real-SIGKILL
  mid-deletion recovery, receipt dedupe (PK intent+step), no lost
  completion, no resurrection, actor-mismatch refusal.
- Export: actor-scoped, deterministic ordering, `retained: false`,
  cross-actor denial, not-found denial.
- Files: public-root rejection, traversal rejection, relative-path
  rejection; owner-only modes applied where honored; Windows ACL limitation
  documented (no POSIX-mode claim on Windows).

## Deletion/export reconciliation

Durable intent before any mutation; per-step idempotent execution;
per-(intent,step) receipts with INSERT-or-IGNORE semantics in both the
in-memory and SQLite stores; forward-only state machine; `recoverPending()`
continues exactly the missing steps (verified across a REAL SIGKILL process
boundary in the restart fixture and in the fresh-process proof of
`verify:stage6a`); re-deletion is a no-op; duplicate receipts impossible;
 truthful partial/blocked outcome on unrecovered failure.

## Files changed

**New — neutral boundary**
- `packages/contracts/src/agent-stream.ts`
- `packages/sdk/src/agent.ts`
- `packages/kernel/src/agent-profile.ts`
- `packages/runtime/src/agent-types.ts`, `agent-registry.ts`,
  `agent-governance.ts`

**New — adapter**
- `packages/mastra/package.json`, `tsconfig.json`
- `packages/mastra/src/index.ts`, `adapter.ts`, `compatibility.ts`,
  `offline-model.ts`, `helper-tools.ts`, `memory.ts`, `storage.ts`

**New — durable governance + tests**
- `packages/store-sqlite/src/agent-governance-adapter.ts`
- `packages/mastra/test/` (offline-guard.mjs, fixtures.ts, adapter.e2e,
  adapter.security, adapter.restart, adapter.compatibility, fixtures/,
  helpers/)
- `packages/kernel/test/agent-profile-identity.test.ts`,
  `agent-profile-validation.test.ts`
- `packages/runtime/test/agent-registry.test.ts`,
  `agent-governance.test.ts`
- `packages/store-sqlite/test/agent-governance-adapter.test.ts`

**New — verification + docs**
- `scripts/verify-stage6a.mjs`
- `docs/architecture/STAGE-06A-PRODUCT-AGENT-FOUNDATION.md`
- `docs/report/VICT-STAGE-06A-REPORT.md` (this file)

**Modified**
- `packages/contracts/src/index.ts`, `packages/sdk/src/index.ts`,
  `packages/kernel/src/index.ts`, `packages/runtime/src/index.ts`,
  `packages/runtime/src/errors.ts`, `packages/store-sqlite/src/index.ts`,
  `packages/store-sqlite/src/migrations.ts` (additive version-3 migration)
- `package.json` (workspaces build chain + `verify:stage6a` script),
  `package-lock.json`, `tsconfig.json` (paths), `vitest.config.ts`
  (aliases + network-guarded `mastra` project), `eslint.config.js`,
  `.prettierignore` (owner-local `.pi/` excluded from lint/format surfaces)
- `packages/scaffolder/test/scaffolder.test.ts` (AUDIT-F1 correction +
  concurrency regression)
- `packages/store-sqlite/test/migrations.test.ts` (additive tables in the
  exact-table-list assertion)
- `docs/VICT-SYSTEM-REFERENCE.md` (Stage 06 status → In Progress:
  Stage 06A implemented, awaiting independent audit; Stage 06B not begun),
  `docs/architecture/MASTRA-ARA-INTEGRATION.md` (§2.4 ledger: generic npm
  `<pkg>` placeholder expanded to exact registry URLs — documentation
  hygiene only)

## Verification evidence

| Command | Exit status | Result |
| --- | --- | --- |
| `npm ci` | 0 | clean install; lockfile exact |
| `npm run typecheck` | 0 | strict, no errors |
| `npm run format:check` | 0 | clean (owner `.pi/` excluded from format surface) |
| `npm run lint` | 0 | clean |
| `npm run build` | 0 | all ten packages build (incl. `@vict/mastra`) |
| `npm run test:unit` | 0 | 62 files / **1519 tests passed** |
| `npm run test:integration` | 0 | 1 file / 4 tests passed |
| `npm test` (unit+renderer+mastra+integration) | 0 | 70 files / **1594 tests passed** — repeated 3 consecutive times, all green |
| `npm run verify:consumer` | 0 | packed neutral consumer, no zod in base declarations |
| `npm run verify:stage2` | 0 | durable stores + packed SQLite consumer (one environmental one-off noted in §15; three consecutive clean reruns) |
| `npm run verify:stage3` | 0 | durable orchestration + offline proof + packed consumer |
| `npm run verify:stage4` | 0 | capability/application authoring gates |
| `npm run verify:stage5` | 0 | reference application warning-free build, real-browser + axe suites, packed scaffolder/generation, required-member probe |
| `npm run verify:stage6a` | 0 | package inspection, neutral packed consumer (no Mastra on disk), adapter packed consumer (registry-exact pins, offline proof), fresh-process store proof |
| `npm run example` | 0 | offline ARA proof — exactly **13** ordered events |
| `npm run bench` | 0 | three-node benchmark — exactly **10** events per completed run |
| `npm run example:application` | 0 | Stage 04 application proof — **17/17** |
| `npm audit --omit=dev` | 0 | **0 vulnerabilities** in production dependencies |
| `git diff --check` | 0 | clean |
| `git status --short` | 0 | only intended stage files + owner `.pi/` (untouched) |

Stage 06A targeted suites repeated **5 consecutive times**, all green:
mastra project 26/26 plus kernel/runtime/store-sqlite/scaffolder targeted
files 93/93 per run.

## Regression matrix

| Requirement | Pass/Fail | Evidence |
| --- | --- | --- |
| Same semantics → same version across runtimes/processes | PASS | `agent-profile-identity.test.ts` (in-process + real child processes) |
| Every declared semantic change → different version | PASS | per-component mutation suite (schema, ids/revisions, model intent, each generation field, each policy field, chains, sets, adapter id/revision, each pinned version) |
| Set insertion order irrelevant | PASS | helperTools/capabilities/generation-key/adapter-package order probes |
| Processor/guardrail order significant | PASS | reorder + membership changes change the version |
| Mastra version change significant | PASS | adapter marker mutation changes the version (identity suite + compatibility suite) |
| Unknown/noncanonical fields rejected | PASS | closed-schema + canonical-boundary suites (top-level and nested) |
| Sparse arrays and exotic objects rejected | PASS | sparse slots, additional array properties, Date/class/Map/BigInt/NaN/Infinity/negative zero, cycles |
| No function-body hashing | PASS | profiles accept no functions; identity is declared-data only |
| No secret/time/random identity input | PASS | credentials absent from the profile domain; canonical determinism across processes/times |
| Caller objects unfrozen and unaliased | PASS | post-compilation caller mutation changes nothing; capture is frozen and distinct |
| Serialized profile immutable and deterministic | PASS | frozen manifest + stable `manifestJson` |
| Post-registration caller mutation has no effect | PASS | `agent-registry.test.ts` deep-capture proof |
| Post-activation replacement has no effect | PASS | new-revision activation vs old snapshot identity |
| Explicit reactivation captures replacement | PASS | new instructions revision captured only on re-activation |
| Mid-run mutation cannot affect execution | PASS | barrier-controlled turn reads the frozen snapshot across a registry mutation |
| Missing artifact fails closed after reopen | PASS | restore suite (missing profile / newer-only registry / missing revision / corrupt record) |
| Registry maps cannot be mutated publicly | PASS | frozen activation surfaces; no map exposure |
| Actual agent runs through offline deterministic model | PASS | `adapter.e2e.test.ts` + packed-consumer proof + fresh-process fixture |
| Deterministic response | PASS | identical text + event order across turns |
| Sanitized terminal failure | PASS | canary-bearing model error → stable code only |
| No network or credentials | PASS | offline-guarded project; credential canary absent everywhere |
| Raw Mastra types do not cross boundary | PASS | neutral event/outcome types only; declaration scans |
| Pinned versions observable in snapshot | PASS | adapter metadata + marker identity |
| Pure helper succeeds | PASS | tool-call round-trip through the pinned Agent |
| Effectful/secret/approval helper rejected | PASS | non-pure + authority-field rejection before activation |
| Input/output contract validation | PASS | contract-invalid input never invokes; invalid output fails safely |
| Thrown canary absent | PASS | message + nested cause canaries collapsed to stable codes |
| In-flight binding pinned | PASS | frozen snapshot bindings; post-activation mutation has no effect |
| Separate databases | PASS | `mastra_*` vs `vict_*` vs `appdata_*` namespaces; no shared handle |
| Close/reopen and process restart | PASS | e2e persist + real-SIGKILL restart fixture + fresh-process proof |
| Actor/thread isolation | PASS | cross-actor thread/message reads empty |
| Retention and actual pruning | PASS | aged removed / current kept / idempotent repeat / injectable as-of |
| Deletion success | PASS | governed two-step deletion with receipts |
| Deletion partial failure and recovery | PASS | injected failures at every boundary + real-SIGKILL resume |
| Export policy | PASS | actor-scoped, deterministic, non-retaining, stable denials |
| Credential isolation | PASS | canary absent from every surface incl. raw bytes |
| Trace safety | PASS | stored spans: null input/output, redacted errors, metadata only |
| Raw-store canary inspection | PASS | `mastra_ai_spans` + memory tables read as bytes after close/reopen |
| Public-directory/path protection | PASS | public-root, traversal, relative-path rejection; layout test |
| Stage 01–05 tests remain green | PASS | 1519 unit + 4 integration; full ladder green |
| All identity vectors unchanged | PASS | no prior identity module touched; Stage 02/05 verification re-run |
| ARA example remains exactly 13 events | PASS | `npm run example` |
| Benchmark remains exactly 10 events | PASS | `npm run bench` |
| Stage 04 application proof remains 17/17 | PASS | `npm run example:application` |
| Stage 05 reference application warning-free | PASS | `verify:stage5` enforced warning-free build + suites |
| Scaffolder deterministic and path-safe | PASS | full scaffolder suite incl. AUDIT-F1 regression |

## Compatibility decisions

1. `@mastra/observability` pinned (1.17.5) because stored-trace persistence
   (`MastraStorageExporter`) is directly required by MSTR-008/MSTR-011
   evidence (inspect STORED records, not serializers).
2. The pinned observability persists RAW error objects on failed spans even
   with `hideInput`/`hideOutput`; the adapter adds exporter-level error
   redaction, and the offline fixture models the provider-boundary
   sanitization (`VICT_OFFLINE_MODEL_FAILED`) that any Stage 07 provider
   wrapper MUST implement.
3. The pinned memory save queue is debounced (~100 ms); the adapter emits
   the `memory.updated` milestone only after a documented quiescence
   barrier, and `savePerStep` flushes message content at each step finish —
   durable-before-terminal ordering is adapter-enforced.
4. The new-format `memory: { thread, resource }` stream option is required
   by the pinned version for message persistence; the deprecated
   top-level `resourceId`/`threadId` is not used.
5. Semantic recall is explicitly disabled (registration requires
   `semanticRecall: false`): enabling it requires an embedding model — out
   of the offline envelope; recorded for a future governed revision.
6. Full-payload tracing is not representable in the Stage 06A neutral
   policy type; a future opt-in requires a new governed revision with its
   own retention policy.
7. `zod` is declared by the adapter because the pinned core requires it as
   a peer for tool schemas; the neutral packages remain schema-free.
8. The governed-deletion memory port deletes messages explicitly before the
   thread (the pinned LibSQL schema has no cascading FKs; cascade ordering
   is the caller's duty — documented in the port).

## Remaining risks

- **Environmental:** all evidence is Windows 11 / win32-x64 / Node
  v22.13.1. Node 24 and a second OS were unavailable (same environmental
  limitation recorded by Stages 03–05). The real-browser gates ran inside
  `verify:stage5` on this environment only.
- **One-off verify:stage2 failure:** the first back-to-back ladder run
  reported one failing step inside `verify:stage2` (its embedded full-suite
  step, while the earlier `verify:consumer` run was still settling);
  three consecutive clean reruns followed. Diagnosed as environmental
  contention of the back-to-back run, not a product defect; the committed
  ladder evidence is the three-run full-suite repeat plus the clean
  verify:stage2 reruns. Flagged for the auditor's attention.
- **Debounced save queue:** message persistence inside the pinned memory is
  debounce-based; the adapter's durable-before-terminal barrier handles it,
  but the auditor should treat any mid-flight (pre-quiescence) memory
  assertion as invalid by construction.
- **Mastra release cadence:** near-daily upstream publishes; the conformance
  harness must re-run before any version bump (MSTR-002). No floating
  range is used for `@mastra/*`.
- Stage 06B remains: control plane, HTTP/SSE transport, the final
  `vict.agent-stream@1` field schema (OPEN-015), the capability tool
  bridge, approvals, cancellation durability, cursor reconnect, and full
  adversarial security testing.

## Ready for fresh independent audit?

**YES**

---

**Commit list:** see §16 of the Stage 06A completion response; pushed to
`origin/main` via normal fast-forward pushes only. **Stage 06B has not
begun. Stage 07 has not begun. All previous audits and reports are
untouched.**
