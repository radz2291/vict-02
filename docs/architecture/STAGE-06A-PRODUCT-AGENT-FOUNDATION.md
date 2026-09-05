# VICT Stage 06A — Product-Agent Foundation

> **Authority:** `docs/VICT-SYSTEM-REFERENCE.md` v0.3.1 and
> `docs/architecture/MASTRA-ARA-INTEGRATION.md` (normative for Stage 06).
> **Status:** Implemented (Stage 06A increment). Not Verified — Stage 06A
> awaits a fresh independent audit; Stage 06B has not begun.
> **Scope:** the neutral ProductAgent boundary, the strict agent-profile
> schema and deterministic `agentProfileVersion`, immutable activation
> snapshots, the pinned `@vict/mastra` adapter foundation with a
> deterministic offline model fixture, adapter-native pure helper tools,
> dedicated memory/storage separation, the local data-protection baseline
> (MSTR-011), the version-upgrade conformance harness (MSTR-002), and the
> AUDIT-F1 scaffolder test-hygiene correction.

---

## 1. Package topology

```text
@vict/contracts ─ @vict/sdk ─ @vict/kernel ─ @vict/runtime ─ @vict/store-sqlite
                                    ▲               ▲
                                    └───────────────┼── @vict/mastra (optional adapter)
                                                    └── pinned @mastra/* packages
```

- `@vict/mastra` is a new OPTIONAL adapter package. It imports the neutral
  VICT packages and the pinned Mastra packages. **No neutral package imports
  `@vict/mastra`, and no neutral source, declaration, or emitted `.d.ts`
  mentions Mastra** (AI-002). Verified by packed-consumer declaration scans
  and workspace source scans in `verify:stage6a`.
- Neutral placement follows the established responsibilities:
  - `@vict/contracts`: the normalized `vict.agent-stream@1` event contract
    (in-process surface; transport belongs to Stage 06B, OPEN-015 stays
    open);
  - `@vict/sdk`: the profile authoring vocabulary (`AGENT_PROFILE_SCHEMA`,
    `defineAgentProfile`) with a strict, non-invoking canonical capture;
  - `@vict/kernel`: the profile compiler — closed schema, strict
    canonical-input boundary, and the deterministic identity;
  - `@vict/runtime`: the artifact/profile registries, immutable activation
    snapshots, turn pinning, credential boundary, and the governed
    deletion/export services with their durable store;
  - `@vict/store-sqlite`: an ADDITIVE migration (version 3) plus the SQLite
    `AgentGovernanceStore` implementation (same operational database
    domain, disjoint `vict_agent_*` tables).
- No empty placeholder packages were created and no existing public API
  moved. All prior graph, activation, capability, and application identity
  vectors are byte-for-byte unchanged.

## 2. Public neutral APIs (summary)

- `@vict/contracts`: `AGENT_STREAM_SCHEMA` (`vict.agent-stream@1`), the
  `AgentStreamEvent` union (`response.started`, `text.delta`,
  `content.completed`, `tool.requested`, `tool.started`,
  `tool.awaiting_approval`, `tool.completed`, `tool.failed`,
  `memory.updated`, `usage.updated`, `response.completed`,
  `response.failed`, `response.cancelled`) with per-stream monotonic `seq`
  and full identity context on every event. No raw provider or adapter
  chunk type is representable; reasoning content is never carried.
- `@vict/sdk`: `AgentProfileAuthoring` and friends, `AGENT_PROFILE_SCHEMA`
  (`vict.agent-profile@1`), `defineAgentProfile` (frozen deep capture
  guarded by a strict canonical walk that rejects accessors by descriptor
  inspection without invoking them).
- `@vict/kernel`: `compileAgentProfile` → `CompiledAgentProfile`
  (`profile`, `manifest`, `manifestJson`, `agentProfileVersion`), issue
  codes (`AGENT_PROFILE_*`), `AGENT_PROFILE_IDENTITY_SCHEMA`.
- `@vict/runtime`: `AgentProfileRegistry` (artifacts, profiles, activation,
  restoration), `ProductAgentPort`, `AgentProfileActivation`,
  `pinAgentTurnRunner`, `AgentGovernanceStore` (+ in-memory impl),
  `ConversationDeletionCoordinator`, `ConversationExportService`,
  `protectCredentialPort`/`requireCredential`, and the agent runtime error
  codes. The neutral surface defines the `ProductAgentPort` signature and
  the `AgentTurnOutcome` shape — no adapter framework type appears in any
  signature (AI-001).

## 3. Agent-profile schema (amendment §6.1)

The profile is strict canonical DATA — closed field sets at every level;
required members are never silently defaulted:

| Component | Shape | Identity class |
| --- | --- | --- |
| 1 schema marker | `vict.agent-profile@1` (exact) | exact |
| 2 agent id + revision | non-empty printable strings | exact |
| 3 instructions | `{ id, revision }` reference | exact |
| 4 model profile | id/revision + `routerModel` + `provider` (+ credential **variable NAME**) | exact |
| 5 generation | explicit record: `temperature` [0,2], `topP` (0,1], `maxOutputTokens` [1,200000], `maxRetries` [0,8] | canonical record |
| 6 turn policy | `maxSteps` [1,64], `maxToolCalls` [0,64], `onLimit: 'fail-closed'` (closed enum) | canonical record |
| 7 memory policy | `{ id, revision }` reference | exact |
| 8 processor chain | ordered `[{ id, revision }]` (order = execution order) | order-preserving |
| 9 guardrail chain | ordered `[{ id, revision }]` | order-preserving |
| 10 structured output | `{ contract: { id, revision } }` when enabled | exact |
| 11 helper tools | set-like `[{ id, revision }]` | canonically sorted |
| 12 capabilities | set-like authority envelope | canonically sorted |
| 13 subagents / workflows | set-like, when enabled | canonically sorted |
| 14 adapter compatibility | adapter id/revision + every runtime-affecting pinned runtime package `name → exact version` | canonical record |

Validation is fail-closed and total: unknown fields rejected at every
level; duplicate set entries rejected; bounds enforced; diagnostics are
structured, path-sorted, deterministic, and non-echoing (stable codes,
paths, and key names — never values). No invalid profile produces a partial
compiled profile or version.

## 4. Identity algorithm

```text
manifest = {
  schema: 'vict.agent-profile-identity@1',
  profile: {
    schema, id, revision,
    instructions: { id, revision },
    modelProfile: { id, revision, routerModel, provider, providerCredentialVar|null },
    generation: { …declared fields only },
    turnPolicy: { maxSteps, maxToolCalls, onLimit },
    memoryPolicy: { id, revision },
    processors:  declared order | null,
    guardrails:  declared order | null,
    structuredOutput: { contract } | null,
    helperTools:  sorted by (id, revision) | null,
    capabilities: sorted by (id, revision) | null,
    subagents:    sorted by (id, revision) | null,
    workflows:    sorted by (id, revision) | null,
    adapter: { id, revision, runtimePackages: sorted name→version entries },
  },
}
agentProfileVersion = 'v1_' + sha256(AGENT_PROFILE_IDENTITY_SCHEMA + 0x00 + canonicalJson(manifest))
```

- `canonicalJson` is the Stage 01 verified canonicalizer (sorted keys,
  canonical numbers, structural rejection of non-canonical values).
- Forbidden inputs are structurally unreachable: the profile domain accepts
  no functions, dates, BigInts, symbols, accessors, sparse arrays, cycles,
  credentials, timestamps, or random values (amendment §6.3). Function
  bodies never exist to be hashed; implementations are revision-addressed
  artifacts.
- Identity vectors of Stages 01–05 are untouched.

## 5. Snapshot and restoration semantics

- `AgentProfileRegistry.activateAgentProfile` resolves EVERY revisioned
  component to its EXACT revision (instructions, memory policy, each helper
  tool, each processor/guardrail, each workflow, each sub-agent profile,
  and capability-envelope existence), deep-captures a frozen VICT-owned
  snapshot, and derives an `activationVersion` over the pinned artifact
  fingerprint set (`vict.agent-activation@1`).
- Missing artifacts fail closed; a current definition never substitutes for
  a pinned older revision (`VICT_AGENT_ARTIFACT_REVISION_MISMATCH`).
- Function references (helper `execute`, processor `transform`, guardrail
  `check`) are bound by reference into the frozen snapshot — never hashed,
  never serialized.
- `pinAgentTurnRunner(port, activation)` refuses a port bound to a
  different profile identity; a pinned runner captures the snapshot for its
  whole lifetime. Barrier-controlled tests prove mid-run registry mutation
  and re-activation cannot affect an in-flight turn.
- Restart model (Stage 02 discipline): the durable record is the identity
  record (`vict.agent-activation-record@1` — canonical manifest JSON plus
  the sorted artifact reference list), never executable code.
  `restoreActivation` re-resolves every artifact in the fresh process and
  compares BOTH the profile version and the derived activation version;
  any mismatch returns a structured fail-closed result (record missing,
  profile mismatch, artifact missing/revision mismatch, corrupt record).

## 6. Actual adapter construction (`@vict/mastra`)

- `MastraProductAgent.create(activation, config)` builds, from the FROZEN
  snapshot only: a real pinned `Memory` (message window + explicit
  working-memory declaration from the pinned policy), real adapter-native
  tools bridged from the frozen helper bindings, a REAL pinned
  `Agent` (instructions text, model, tools, memory from the snapshot), and
  a `Mastra` instance binding the dedicated store plus the payload-safe
  observability composition. The adapter never touches a live registry.
- `runTurn` maps the real pinned stream chunks (`payload.text`,
  `payload.toolName`, `payload.stepResult.reason`, …) onto the neutral
  event union with gapless per-turn sequence numbers, emits durable
  milestones only after the conversation content is persisted (durable-
  before-terminal ordering), applies guardrails in declared order (fail
  closed), propagates `AbortSignal`, records usage summaries, the Mastra
  `traceId`, and the actually-observed provider/model identity as run
  METADATA, and sanitizes every failure to `VICT_AGENT_TURN_FAILED`.

## 7. Offline model fixture (MSTR-010)

`createDeterministicOfflineModel(script)` implements the AI SDK
LanguageModelV2 surface structurally (locally declared wire types — no
undeclared transitive reliance) and is consumed by the REAL pinned `Agent`:

- fully offline; no credential; no environment variable; the adapter test
  project installs a network guard (`fetch`, `net`, `http`, `https`,
  `dgram`) that fails any unexpected network attempt;
- scripted plain-text and tool-call steps; tool calls fire AT MOST ONCE per
  conversation (the fixture inspects the prompt), so the pinned agent loop
  terminates deterministically;
- model failures are thrown as the stable `VICT_OFFLINE_MODEL_FAILED`
  error — see §11 (provider-boundary sanitization).

## 8. Helper-tool policy (amendment §6.5)

- Definitions carry explicit id/revision/description, `effect: 'pure'`
  (any other declared effect is rejected BEFORE activation), neutral input/
  output contract bindings (id + revision + declarative JSON-Schema
  document + authoritative neutral `parse`), and the pure implementation.
- The bridge wraps each contract into the Standard-Schema-With-JSON shape
  the pinned tools API accepts — validation authority stays with the VICT
  contract. Contract-invalid input NEVER invokes the implementation;
  contract-invalid output fails safely; thrown errors (including nested
  causes and secret-bearing messages) collapse to stable
  `victHelperFailure` codes; raw error content never re-enters the model.
- The bridge accepts only FROZEN snapshot bindings: post-activation
  mutation of a caller definition cannot widen authority metadata or swap
  implementations. Unknown helper-tool fields (e.g. smuggled permission or
  secret lists) are rejected at registration. Helper outputs are data,
  never authority. Effectful work remains exclusively a VICT capability
  path (Stage 06B bridge).

## 9. Memory/store ownership and data classification (MSTR-011)

Four separate storage domains (amendment §8), joined only by correlation
ids; no cross-store atomicity is claimed:

| Category | Owning store | Full content retained? | Default retention | Pruning | Deletion | Export | Traces / operational history |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Conversation messages | Mastra memory (dedicated LibSQL file) | Yes (by design) | explicit `messages` max-age bound | `prune()` executed | governed thread deletion | policy export (text, roles, order) | no (summaries/counts only) |
| Tool arguments/results | Mastra memory (message parts) | Yes (by design) | as above | as above | as above | as above | no |
| Working memory | Mastra memory (thread/resource) | declared template only | with thread | with thread | with thread | template included | no |
| Semantic memory | not enabled (explicit `semanticRecall: false` in this adapter revision) | — | — | — | — | — | — |
| Observational memory | not enabled | — | — | — | — | — | — |
| AI traces/spans | Mastra observability domain (dedicated LibSQL file) | no (input/output hidden; errors redacted) | explicit `spans` max-age bound | `prune()` executed | governed deletion | never exported | correlation ids + metadata only |
| Usage/cost summaries | neutral events + VICT milestones | counts only | per turn | n/a | with conversation | included | yes (counts only) |
| VICT approvals | VICT operational stores (Stage 06B) | n/a | operational retention | n/a | governed | excluded | yes |
| VICT operational summaries | VICT operational stores | safe summaries only | DATA-004..006 | unchanged | unchanged | excluded | yes |
| Provider credentials | protected operator configuration ONLY | never | n/a | n/a | n/a | never | never |
| Exports/backs | caller-provided destination | policy-promised fields | not retained by the service | n/a | n/a | n/a | never |

## 10. Credential boundary

`protectCredentialPort` wraps the operator-provided provider: names are
validated; every read passes through (no cache — rotation observed, failed
reads cannot poison later ones); provider exceptions collapse to
`AgentCredentialError` (`VICT_AGENT_CREDENTIAL_UNAVAILABLE`) whose message
carries only the credential NAME; `requireCredential` fails closed with the
same stable code. Profiles store credential VARIABLE NAMES at most — never
values. Tests plant a unique canary as the provider value and prove it
appears on no event, outcome, memory message, trace span, or database byte.

## 11. Tracing safety

The observability composition uses explicit sampling (always/never/ratio),
`hideInput`/`hideOutput` (mandatory `true` in Stage 06A — only `true` is
representable in the neutral policy type), and an exporter-level error
redaction formatter, because the pinned observability persists raw error
objects on failed spans even with hiding on. STORED spans (inspected via
the observability domain and raw `mastra_ai_spans` bytes) carry
`input: null`, `output: null`, redacted errors, and only stable correlation
metadata (`victTurnId`, `victActorId`, `victThread`,
`victAgentProfileVersion`, `victRunId`). Compatibility note: any Stage 07
provider wrapper must sanitize provider errors at the model boundary
(`VICT_OFFLINE_MODEL_FAILED` models this in the fixture).

## 12. Retention / pruning / deletion / export

- Retention bounds are explicit configuration on the dedicated store
  (`messages`/`threads`/`spans` max ages). `executeMemoryPrune` ACTUALLY
  executes the pinned store's `prune()` with an injectable as-of instant
  (equivalent max-age computed against the wall clock; future as-of
  rejected). Tests prove eligible aged records are removed, current records
  remain, and repeated pruning removes nothing (idempotent).
- Governed deletion (`ConversationDeletionCoordinator`): durable intent
  BEFORE any store is touched; the application-domain step through an
  injected port; the Mastra thread step through the adapter's
  ownership-scoped deletion port (messages explicitly deleted — the pinned
  schema has no cascading FKs — then the thread); a durable receipt per
  step (idempotent per intent+step); forward-only state transitions;
  `recoverPending()` resumes exactly the missing steps after crash or
  process restart; re-deleting is a no-op; actor mismatch is refused.
  Injected-failure tests cover every material boundary; recovery never
  duplicates receipts, never loses completion, and never resurrects data.
- Export (`ConversationExportService`): explicit and actor-scoped
  (ownership mismatch → stable denial), returns only classification-policy
  fields with deterministic ordering, `retained: false` (the service keeps
  nothing and logs nothing), and structurally excludes credentials, traces,
  registry data, and operational history.

## 13. Local file protection

`resolveProtectedStoreDir` refuses relative inputs, `.`/`..` segments, and
any `public`/`static`/`assets`/`www`/`htdocs` segment (store files are
never web-accessible). `createDedicatedMastraStore` eagerly initializes the
memory/observability schemas, places `mastra/mastra-store.db` inside the
composition-owned data dir, and applies restrictive permissions where the
platform honors them (owner-only POSIX modes; on Windows, POSIX bits are
not honored and ACL configuration is operator responsibility — documented
honestly, never claimed). Backup/export contents and reader responsibility
are operator material per §10 and the classification table.

## 14. Deployment envelope (declared, not exceeded)

```text
local-first · single actor · single application process ·
non-multi-tenant · file-backed
```

The `@vict/mastra` storage composition documents this envelope at its
public boundary (`storage.ts` module contract). It implies NO multi-process,
multi-tenant, protected-cloud, or production-scale guarantee; exceeding it
requires an appropriate supported backend and security profile (MSTR-012,
Stage 07).

## 15. Compatibility decisions and Stage 06B boundary

- Provider binding is composition-supplied (`modelFactory`); Stage 06A
  compositions use the offline fixture. Real providers arrive in Stage 07
  with credentials resolved through the protected port — credential VALUES
  never enter the adapter.
- Semantic recall is explicitly disabled in this adapter revision
  (`semanticRecall: false` required at registration); enabling it requires
  an embedding model and is a later, explicitly governed change.
- Full-payload tracing is NOT available at any price in Stage 06A; the
  neutral policy type only admits `hideInput/hideOutput: true`.
- The pinned observability persists raw error objects on failed spans;
  errors are therefore redacted at export AND provider errors must be
  sanitized at the provider-model boundary. Recorded as a binding
  requirement for the Stage 07 provider wrapper.
- Stage 06B (not begun): ChangeSets/approvals/release governance, the
  authenticated actor boundary, HTTP commands, resumable SSE with the FINAL
  `vict.agent-stream@1` field schema (OPEN-015), the capability tool
  bridge, approval suspension/resume, cancellation durability, cursor
  reconnect/dedupe, cross-store restart reconciliation in full, retention
  and leakage verification at scale, CLI/remote bindings, and adversarial
  security testing.
