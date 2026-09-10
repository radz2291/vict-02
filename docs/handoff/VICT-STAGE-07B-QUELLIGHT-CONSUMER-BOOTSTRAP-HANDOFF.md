# VICT — Stage 07B Handoff: Quellight Consumer Bootstrap and Live Conversation Foundation

> **Reference:** `docs/VICT-SYSTEM-REFERENCE.md` v0.4.2 at issuance; registered as
> **v0.4.3 (§0.14)** by the same documentation commit that records this handoff.
> **Product repository (inception target):** `C:/Users/RZ1/Desktop/RZ/260909-VCT-Quellight`
> ↔ `https://github.com/radz2291/Quellight` (see §4 and §9 for the verified
> pre-re inception state and the exact preflight requirements).
> **Framework repository:** `C:/Users/RZ1/Desktop/RZ/260831-VCT-02` — `origin/main`
> at handoff issuance: `84c32e54bc176f7119586c27b90920bbd585fcae`
> (`HEAD == origin/main`, fetched and verified; linear ancestry; working tree
> clean except the pre-existing untracked `.pi/` material, which MUST remain
> byte-untouched).
> **Immutable release identity consumed by this stage:**
> `vict-release-set@1/0.1.0` — content ID
> `v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d`
> (13 `@victframework/*` packages, all `0.1.0`, public npm registry,
> Apache-2.0, engines `>=22.13.0`; recorded in `docs/RELEASE-COMPATIBILITY.md`).
> **Verified baseline:** Stage 07A — Quellight consumer foundation — is
> implemented, independently verified
> (`VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE PERMITTED`, audit at
> `cb9d74b…`), and FORMALLY CLOSED (reference v0.4.2, §0.13). Stages 1–6
> remain independently verified and formally closed. The Stage 07 governing
> architecture is
> `docs/architecture/STAGE-07-QUELLIGHT-MINIMUM-WORKABLE-PRODUCT.md`
> (canonical input SHA-256 `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331`).
> **Status:** Stage 07B is PERMITTED and NOT BEGUN. This handoff defines its
> complete boundary. No Quellight product code, UI, store, or capability
> exists today; every `QLT-*` requirement remains Planned; no Stage 01–07A
> Verified status is changed by this stage. The implementer MUST NOT mark
> its own work Verified, MUST NOT begin Stage 07C or any later substage,
> and MUST NOT touch the VICT repository's packages, scripts, release
> identity, or historical records.
>
> **Closure status (2026-09-10, reference v0.4.7, §0.16): Stage 07B has
> been implemented under this handoff, independently re-verified, and
> FORMALLY CLOSED.** Authoritative verdict: `VERIFIED WITH NON-BLOCKING
> ISSUES — FORMAL CLOSURE PERMITTED` (re-verification report at Quellight
> commit `1e0c0f53d62cde6d5031f865fe871ac1d41c9a9b`; audited
> implementation `00ca458…`; original audit `45e6aa6…`; remediation tip
> `65f1767…`). Disposition: `STAGE 07B VERIFIED WITH NON-BLOCKING ISSUES —
> FORMALLY CLOSED`; **Stage 07C specification permitted — NOT BEGUN**;
> Stage 07 remains In Progress. The handoff text below is preserved as
> issued; the "NOT BEGUN" statements in it are the truthful issuance-time
> record and are no longer the current status. The semantic-authority
> enforcement principle is registered as `GOV-007` (reference §0.4,
> §0.16.2) and the F-8 `app.data.mutate` payload gap is the binding
> Stage 07C entry gate (reference §0.16.3). The §17 proposed sequence
> (07C → 07D → 07E) remains the accepted remaining Stage 07 sequence;
> each substage still requires its own handoff.

---

## 1. Objective and product outcome

One bounded outcome: **create the separate Quellight repository as a real
external consumer of the released VICT packages, and prove a real, usable
conversation path end to end** — repository inception, release-only
consumption, one pinned live-provider profile, streaming conversation over
persistent threads, transcript persistence and truthful recovery across
reconnect and process restart, and a minimal responsive accessible
conversation-first UI — without claiming any persistent-cognitive-partner
continuity beyond what Stage 07B actually delivers (§6).

When Stage 07B is complete, a real local Quellight application can:

1. install exact public VICT release artifacts (`vict-release-set@1/0.1.0`)
   from the npm registry — no `file:`, `link:`, Git, vendored, or workspace
   dependency on VICT;
2. start from a clean checkout with no VICT source repository present;
3. use ONE pinned real provider profile — **Ollama Cloud, model
   `glm-5.3-flash`** (§7) — resolved through protected operator
   configuration;
4. stream a real model response through the Verified
   `vict.agent-stream@1` resumable-SSE path;
5. create and reopen conversation threads;
6. persist and restore transcripts across process restart;
7. reconnect truthfully after client interruption (cursor replay, no lost
   or duplicated durable content);
8. present a minimal, responsive, keyboard-accessible conversation-first UI
   with honest states;
9. keep credentials out of source, logs, events, serialized output,
   persistence, and build artifacts;
10. pass deterministic offline tests plus ONE bounded live-provider proof
    (§8, §11).

```text
Stage 07B delivers the Quellight consumer bootstrap and the live
conversation foundation.
Stage 07B does NOT deliver durable partnership meaning: no commitments,
no open loops, no epistemic claims, no ceremony, no context assembly
from the Shared World, no MSTR-012 real-use proof, and no continuity
claim beyond conversation persistence (§6).
```

## 2. Normative inputs (read completely before implementing)

1. `docs/VICT-SYSTEM-REFERENCE.md` v0.4.2 (registered at v0.4.3) — §0.11–§0.14,
   §5, §12, §15.3, §16, §17, §21, §23 (Stage 7), §24, §27.
2. `docs/architecture/STAGE-07-QUELLIGHT-MINIMUM-WORKABLE-PRODUCT.md` — the
   authoritative Stage 07 design: product identity (§2), readiness matrix
   (§3), ownership mapping (§4), memory/identity model (§5), Shared World
   storage decision (§6), exact minimum scope and exclusions (§7), first
   vertical (§8), Q0–Q5 roadmap (§9), QLT requirements (§10), OQ1–OQ6 (§11),
   security/retention boundaries (§12), Stage 07 exit gate (§13).
3. `docs/handoff/VICT-STAGE-07A-QUELLIGHT-CONSUMER-FOUNDATION-HANDOFF.md`
   and the Stage 07A reports (implementation, independent verification,
   formal closure) — the consumed release mechanism is their product.
4. `docs/RELEASE-COMPATIBILITY.md` — release-set identity, exact pins,
   install/rollback/integrity rules, supported runtimes.
5. `docs/architecture/MASTRA-ARA-INTEGRATION.md` (read with its dated
   Quellight supersession note) — ownership matrix (§3), agent identity and
   snapshots (§6), tool bridge (§7), memory/storage separation (§8),
   streaming/transport (§9), security composition (§10).
6. The canonical Quellight input
   `The-Persistent-Cognitive-Partner-Agent-Context-v1.3-CANONICAL.md`
   (SHA-256 `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331` —
   verify against the file at
   `C:/Users/RZ1/Desktop/RZ/260909-VCT-Quellight/docs/` during preflight;
   §9). Treat the Quellight rebaseline as authoritative: the product is
   **Quellight**, never ARA; no obsolete ARA product assumption may be
   revived.
7. Public package surface (installed at `@victframework/*@0.1.0`):
   `@victframework/server` (`createVictHttpServer`, `listenVictHttpServer`,
   `VictCommandService`, `VICT_COMMANDS`, `remoteQuery`/`remoteMutate`/
   `remoteAction`), `@victframework/runtime` (`operator-config`,
   `ProductAgentPort`, `pinAgentTurnRunner`), `@victframework/mastra`
   (`MastraProductAgent`, `modelFactory`, `createDedicatedMastraStore`,
   `createDeterministicOfflineModel`, `resolveProtectedStoreDir`),
   `@victframework/contracts` (`vict.agent-stream@1` schema and wire
   validation), `@victframework/application` (+ `./testing` conformance
   fixtures), `@victframework/renderer-svelte`, `@victframework/scaffolder`,
   `@victframework/store-sqlite`, `@victframework/appdata-sqlite`,
   `@victframework/control`, `@victframework/cli`.
8. Provider primary documentation (accessed 2026-09-09, recorded in §7):
   `docs.ollama.com` (cloud, OpenAI compatibility, streaming, errors, tool
   calling), the Ollama model-library page for `glm-5.3-flash`, Z.ai
   developer documentation (`docs.z.ai` — devpack overview, usage policy,
   supported tools, GLM-5.3-Flash model page), and the provider registry
   embedded in the pinned `@mastra/core@1.64.0` installed in this
   repository.

## 3. Fixed product decisions (preserved — do not reopen)

* Product: **Quellight**, not ARA. Product role: persistent cognitive
  partner (long-term), per the canonical v1.3 architecture.
* Quellight is a **separate repository** and an **external consumer** of
  VICT; VICT never imports or contains Quellight (`QLT-001`).
* Canonical VICT namespace: `@victframework/*`.
* Initial immutable VICT release set: `vict-release-set@1/0.1.0`, content ID
  `v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d`.
* No `file:`, `link:`, Git, vendored, or workspace dependency on VICT
  (`QLT-002`).
* Conversation machinery belongs behind `@victframework/mastra`; Mastra
  transcripts, in-flight working memory, and replaceable caches are NOT the
  Shared World (Stage 07 architecture §5; `QLT-003`).
* Quellight owns its durable Shared World and its SQLite adapter (§6.3 of
  the Stage 07 architecture).
* No autonomous interruption (`OQ3`); no default external authority
  (`OQ5`); one provider profile for the minimum product (`OQ4`);
  explicit confirmation is required before consequential governed actions
  (`OQ2` — first exercised in a later substage, not 07B).
* `OQ6` remains unapproved unless a later owner decision explicitly
  resolves it; any Quellight constitution material stays Proposed and
  labeled as such (none is created in 07B).

## 4. Repository ownership boundaries

| Repository | Role in Stage 07B | Mutation rules |
| --- | --- | --- |
| `260831-VCT-02` (VICT) | Governance home; issues this handoff | Documentation-only changes approved by THIS handoff package (the handoff file, the reference v0.4.3 registration, the Stage 07 architecture status note). No package, script, manifest, lockfile, release-identity, or historical-file change. |
| `260909-VCT-Quellight` (local) | The product repository under inception | Created and evolved by Stage 07B per §9. The pre-existing canonical input document is preserved byte-for-byte and committed as the first repository content. |
| `github.com/radz2291/Quellight` (remote) | The product repository's origin | Connected as `origin` at inception; fast-forward pushes only. No settings change, no branch protection change, no force-push, no rewrite. |

**Pre-inception state verified at handoff issuance (2026-09-09):**

| Item | Observed value |
| --- | --- |
| Local folder | Exists; NOT a git repository (`git rev-parse HEAD` fails); contains exactly one file: `docs/The-Persistent-Cognitive-Partner-Agent-Context-v1.3-CANONICAL.md` |
| Canonical input SHA-256 | `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331` — matches the value documented in the Stage 07 architecture §1 and reference §0.11 |
| Remote refs | `git ls-remote https://github.com/radz2291/Quellight.git` exits 0 with ZERO refs (empty repository) |
| Remote visibility | Unauthenticated GitHub web/API requests return 404; the owner MUST confirm access/visibility with their own credentials at the implementation-time preflight (§9) |

VICT itself was inspected read-only for this handoff; the Quellight local
folder and remote were inspected read-only and remain unchanged.

## 5. Requirement IDs exercised by Stage 07B

No new requirement IDs are introduced by Stage 07B, and **no requirement's
delivery status is changed by the implementer** (all `QLT-*` remain Planned
until the Stage 07 exit gate passes an independent audit). Stable IDs
implemented or exercised:

* `QLT-001`, `QLT-002` (separate repository; immutable pinned release
  consumption — the repository-existence and consumption halves);
* `QLT-014` (agent profile = executable configuration only; Quellight
  identity never in a profile, thread, or model);
* `QLT-016` (exactly one pinned provider profile; protected credential
  boundary; credentials never in tests/stores/streams/traces/diagnostics);
* `QLT-019` (retention-metadata foundation: per-record retention columns and
  an explicit declared policy skeleton — the full policy is later);
* `QLT-006` (foundational only: "nothing is pending" is not claimed in 07B);
* `AI-002`, `AI-003`, `AI-004`, `AI-005`, `AI-009`, `AI-010`, `AI-011`,
  `AI-014`, `AI-015` (neutral boundary, profile identity, snapshots,
  envelope-derived tools, normalized stream, cancellation, correlation,
  injection containment, server-side Mastra);
* `MSTR-002`, `MSTR-003`, `MSTR-004`, `MSTR-007`, `MSTR-008`, `MSTR-010`
  (pinned versions, dedicated file-backed store under the declared
  envelope, envelope-derived tools only, server-derived request context,
  payload-safe tracing, offline verifiability);
* `MSTR-011` (credential isolation, retention bounds with executed bounds
  configuration, store placement and permissions — as inherited machinery;
  the `MSTR-012` real-use proof is NOT a 07B item);
* `SEC-001`, `SEC-002`, `SEC-003` (authenticated actor, boundary
  authorization, credential scope and non-leakage);
* `DATA-004..DATA-008`, `DATA-013`, `DATA-014` (retention policies, store
  separation, typed authorized mutations);
* `APP-005`, `APP-006`, `APP-009`, `APP-010`, `APP-013`, `APP-014`,
  `APP-015`, `APP-016` (structured surface, accessible/responsive defaults,
  separate domain store, typed action boundaries, SvelteKit renderer,
  code islands, scaffold-once, conformance);
* `API-002`, `API-003`, `API-005` (idempotent commands, resumable cursor
  streaming, ordinary framework components where orchestration is not
  useful);
* `CTRL-004`, `CTRL-007` (approval policy preserved — no approval flow is
  exercised in 07B; audit-attributed operations);
* `GOV-002`, `GOV-004`, `GOV-005`; `TEST-001`, `TEST-002`, `TEST-005`,
  `TEST-006`, `TEST-007`; `DEP-001`, `DEP-002`; `ARCH-012`; `PRD-006`.

## 6. Shared World boundary for Stage 07B

```text
Conversation persistence  ≠  Shared World continuity
```

Transcripts surviving a restart is **conversation machinery persistence**
(Mastra memory + VICT-authoritative turn records). It is NOT Shared World
continuity, and Stage 07B MUST NOT claim any persistent-partner continuity
from it. Context assembly from the Shared World, commitments, open loops,
correction lineage, and ceremony are later substages (§17).

**Decision — the smallest boundary that avoids a disposable chat-only
implementation:** Stage 07B introduces the **Quellight-owned Shared World
store foundation** (§6.3 of the Stage 07 architecture) with its own SQLite
file, its own versioned migration runner and bookkeeping (DATA-013/APP-009
discipline), and per-record retention metadata columns from day one
(`QLT-019` foundation). Exactly ONE durable Shared World record family is
materialized in the vertical slice:

* **The Shared World thread record** (`qlt_thread`): id (Quellight-owned),
  title, canonical state subset (`active` | `dormant`), retention state,
  timestamps, provenance (created by the USER). Canonical thread states
  `waiting` / `resolved` are NOT implemented in 07B (they acquire meaning
  with loops and thread semantics in later substages); the state vocabulary
  is declared closed so later states are additive migrations, never
  semantic overloads. Conversations are linked to Shared World threads by
  an explicit correlation record (`qlt_thread_conversation`: Shared World
  thread id ↔ Mastra thread id); the thread record survives loss of the
  Mastra store, and the UI renders a wiped transcript truthfully (thread
  intact, conversation history absent) — never a fabricated continuity
  claim.

Rules that make this boundary truthful:

1. **The agent/model writes NOTHING to the Shared World in 07B.** All
   Shared World records are user-initiated through the typed Application
   Layer mutation boundary (DATA-014 discipline: contract-validated,
   authorized, idempotent). The first agent-side Shared World writes —
   proposal/confirmation ceremony, commitments, loops, corrections — are
   Stage 07C work crossing governed VICT capabilities (`QLT-005`,
   `QLT-013`, Stage 07 architecture §5.4). A 07B negative control proves
   the conversation path has no Shared World write path (§11, N-12).
2. **The thread list renders from the Shared World store**, not from Mastra
   threads — the product's durable concern list is Quellight-owned from
   day one (`QLT-003` direction; canonical `B1` minimal user-side parity:
   the user sees the only Shared World records that exist).
3. **No Shared World continuity claims.** Product language, README, UI
   text, and the report MUST NOT describe 07B as delivering continuity,
   memory of meaning, or persistent-partner behavior. The in-product
   disclosure states plainly that conversation transcripts are retained
   under bounded retention and that durable partnership meaning is not yet
   implemented.
4. **Extensibility without migration of durable truth.** The store's
   migration framework is real and forward-only; later record families
   (claims/evidence with `E1–E7` typing, commitments, open loops, correction
   lineage, retention tombstones, dependency links) are added as additive
   Quellight-owned migrations over the same store and port — durable truth
   never moves out of Quellight ownership, and no VICT extraction occurs
   without the evidence-first rule of §6.3 (Stage 07 architecture).

## 7. Provider decision (Stage 07B single profile)

**Recommendation (binding for this handoff): Ollama Cloud, model
`glm-5.3-flash`, as the ONE pinned Stage 07B provider profile.**

| Question | Determination | Evidence (primary sources, accessed 2026-09-09) |
| --- | --- | --- |
| Exact model identifier | `glm-5.3-flash` — Mastra model-router string `ollama-cloud/glm-5.3-flash` | Provider registry embedded in the pinned `@mastra/core@1.64.0` installed in this repository (gateway: models.dev): provider key `ollama-cloud` lists `glm-5.3-flash`; the same identifier is live on Ollama's model library page |
| API compatibility | OpenAI-compatible chat completions at `https://ollama.com/v1` (`/v1/chat/completions`) | `docs.ollama.com/api/openai-compatibility.md`; registry entry `url: https://ollama.com/v1` |
| Mastra integration path | Native model-router resolution in the pinned `@mastra/core`; `@victframework/mastra`'s `modelFactory` (invoked exactly once, per the adapter contract) resolves the router string; the credential resolves OUTSIDE factory-visible configuration through the VICT operator-configuration foundation (`requireOperatorCredential`) just in time | `packages/mastra/src/adapter.ts` (modelFactory discipline); `packages/runtime/src/operator-config.ts`; registry `apiKeyEnvVar: OLLAMA_API_KEY` |
| Plan validity for application use | **Valid.** Ollama Cloud API keys are general-purpose application API credentials (hosted cloud inference; no coding-agent scope restriction) | `docs.ollama.com/cloud.md` (direct API access with an API key) |
| Streaming | Supported (`stream: true`; documented streaming semantics; errors mid-stream arrive as error objects after the status has started) | `docs.ollama.com/api/streaming.md`; `docs.ollama.com/api/errors.md` |
| Tool-call support (later-stage relevance) | The model is tool-capable per Ollama's library (`tools` capability badge); Ollama documents standard tool calling. NOT exercised by the 07B bounded proof (text conversation only); relevant from 07C governed-capability work onward — verify against the pinned versions at first use | Ollama model-library page for `glm-5.3-flash` (vision · tools · thinking · cloud); `docs.ollama.com/capabilities/tool-calling.md` |
| Authentication variable name | `OLLAMA_API_KEY` (Bearer authorization header). The VALUE is supplied by the owner directly to the implementation environment at live-proof time and is NEVER requested, recorded, committed, or logged by this stage | Registry `apiKeyEnvVar`; `docs.ollama.com/cloud.md` |
| Rate limits / usage constraints | No hard published numeric quota table; documented `429 Too Many Requests` on limit exceeded. The bounded proof is small enough to be irrelevant to quotas and MUST treat 429/5xx as truthful failures with zero automatic retry storm | `docs.ollama.com/api/errors.md` |
| Error and cancellation behavior | HTTP status codes 400/404/429/500/502 with `{"error": …}` JSON; mid-stream error objects after streaming starts; client cancellation via standard request abort — provider-side propagation is cooperative; VICT records durable cancellation intent and never claims reversal (`AI-010`) | `docs.ollama.com/api/errors.md`; `docs.ollama.com/cloud.md` |
| Privacy note (for product disclosure) | Cloud models are hosted in the United States and Europe with zero data retention under Ollama's cloud privacy policy; conversation content crosses the operator's network boundary to the provider | Ollama model-library page for `glm-5.3-flash` |

**Why not Z.ai for Stage 07B:** the owner's existing Z.ai credential is a
**GLM Coding Plan** key (the owner's own configuration targets the coding
endpoint `https://api.z.ai/api/coding/paas/v4`). Z.ai's usage policy states
that the Coding Plan "may only be used within officially supported tools
and products" — a list of coding agents (ZCode, Claude Code, Codex,
OpenCode, Pi, Cursor, Cline, TRAE, Qoder, Droid, and similar) — and that
unsupported use may result in restricted benefits or risk-control action.
Quellight is a conversational product, not a supported coding tool; using
the Coding Plan key for it is a policy violation and is PROHIBITED. The
documented Z.ai alternative for application use is the pay-per-token
**Model API** (`https://api.z.ai/api/paas/v4`, credential environment
variable name `ZHIPU_API_KEY`, model code `glm-5.3-flash`, streaming and
function calling supported) — which would require the owner to obtain a
separate Model API credential and would be recorded as a profile revision,
not a rotation.

**One precise owner decision question (non-blocking for this handoff; must
be answered before the bounded live proof runs):**

> Do you confirm **Ollama Cloud with model `glm-5.3-flash`** (credential
> environment variable `OLLAMA_API_KEY`, supplied directly by you to the
> implementation environment, never committed) as the single pinned
> Stage 07B provider profile — noting that your existing Z.ai credential is
> a GLM Coding Plan key that must not be used for the Quellight
> application, and that choosing Z.ai instead would require a Model API
> credential and a recorded profile revision?

No provider rotation, fallback, or second profile exists in Stage 07B
(`OQ4`). The offline deterministic fixture remains the verification
backbone; the live provider is exercised ONLY through the bounded seam
(§8, WP-5, §11 N-15).

## 8. Architecture boundary

### 8.1 Repository and workspace structure

Single-package npm project (NOT a monorepo), rooted at the Quellight
repository:

```text
/                                (repository root; package.json private)
├── docs/
│   ├── The-Persistent-Cognitive-Partner-…-CANONICAL.md   (pre-existing; byte-preserved)
│   ├── architecture/           (Quellight-owned product architecture records as they arise)
│   ├── report/                 (Quellight implementation/audit reports, 07B onward)
│   └── handoff/                (Quellight-side records only if they arise)
├── src/
│   ├── lib/
│   │   ├── application/definition.ts      (Application Definition — scaffolder-owned location)
│   │   ├── server/                        (composition: stores, operator config, adapter, capabilities glue)
│   │   └── sharedworld/                   (Quellight Shared World port + SQLite adapter + migrations)
│   ├── routes/                            (SvelteKit routes incl. the /vict proxy endpoint)
│   └── islands/                           (versioned conversation workspace island)
├── scripts/                               (verify:consumer, verify:quellight, verify:live-provider)
├── .env.example                           (variable NAMES only)
├── package.json / package-lock.json       (committed lockfile; private: true)
└── .gitignore
```

The host is created ONCE by `@victframework/scaffolder` (`scaffoldVictApp`
into the repository root; deterministic, non-destructive, refuses on
conflict) and is never repeatedly generated (APP-015). The scaffolder's
generated `.gitignore` and `package.json` are reconciled with the
repository-foundation requirements of §9 in the same work package.

### 8.2 Application stack and versions

* **Node `>=22.13.0`** (the VICT engines floor; observed v22.13.1 / npm
  10.9.2 — record the observed pair in the report).
* **VICT packages:** exactly `vict-release-set@1/0.1.0` — all thirteen
  `@victframework/*` packages at exact `0.1.0` (§3).
* **Mastra (transitively pinned):** `@mastra/core` 1.64.0,
  `@mastra/memory` 1.28.2, `@mastra/libsql` 1.22.3,
  `@mastra/observability` 1.17.5 — pinned by `@victframework/mastra@0.1.0`
  and recorded in the adapter compatibility marker; never overridden.
* **Svelte 5 + SvelteKit + Vite/Vitest:** the versions generated by the
  pinned `@victframework/scaffolder@0.1.0` at implementation time; recorded
  in the report; NO manual framework upgrades during Stage 07B. Svelte 5 is
  the canonical renderer; React is deferred (OPEN-011 discipline).
* Framework or frontend re-selection is out of scope; the existing
  VICT/Svelte architecture is consumed as-is.

### 8.3 Browser/server separation and process model

One Node process, one public origin (the declared local envelope:
local-first, single actor, single application process, non-multi-tenant,
file-backed — `MSTR-012` declaration, unchanged):

* **Public surface:** the SvelteKit host (UI + JSON server endpoints) on
  the operator-configured port.
* **VICT server boundary:** `createVictHttpServer` (versioned HTTP commands
  + resumable SSE for `vict.agent-stream@1`) composed IN-PROCESS on a
  loopback-only listener (ephemeral port on `127.0.0.1`).
* **Proxy rule:** browser calls reach VICT commands/SSE only through the
  SvelteKit server-side proxy endpoint (`/vict/[...path]`), which injects
  the local actor credential server-side from operator configuration. The
  browser never sees a second origin, never holds an actor token, and never
  reaches Mastra or privileged endpoints directly (`AI-015`, `MSTR-007`).
  SSE proxying must stream through without buffering the whole response.
  (Alternative acceptable composition: a custom Node entry hosting the
  SvelteKit handler and the VICT request handling on one `http.Server` —
  permitted only if the above constraints all still hold and are proven.)
* **Stores:** local files under ONE operator-configured data directory
  (§8.6) — never inside any publicly served directory.

### 8.4 VICT package dependency graph (consumer view)

Quellight depends on the released packages exactly as recorded in
`docs/RELEASE-COMPATIBILITY.md` §3 (acyclic; exact pins). Consumer-relevant
surface:

```text
@victframework/contracts   (vict.agent-stream@1 schema + wire validation, contract protocol)
@victframework/sdk         (capability/graph/application authoring ABI)
@victframework/kernel, @victframework/runtime (activation, pinning, operator-config, ProductAgentPort)
@victframework/store-sqlite (VICT operational stores)
@victframework/application (+ ./testing) (Application Definition compile; shared conformance fixtures)
@victframework/renderer-svelte (canonical Svelte 5 renderer)
@victframework/scaffolder  (one-time host generation)
@victframework/control     (actors/scopes/turn governance stores for the server composition)
@victframework/mastra      (the ONLY Mastra-bearing dependency; conversation machinery)
@victframework/server      (createVictHttpServer, VictCommandService, VICT_COMMANDS, remote data/action)
@victframework/cli         (optional operator surface; not required by the product path)
@victframework/appdata-sqlite (NOT depended on by 07B — the Shared World store is Quellight-owned)
```

The consumer lockfile records the SHA-512 integrity of every installed
tarball; `npm ci` reproduces the exact graph. Release-set consistency is
checked by the Quellight-side verifier (§11 N-2).

### 8.5 Mastra integration boundary

* Quellight composes `MastraProductAgent` with a pinned agent profile
  (`vict.agent-profile@1` discipline): explicit agent ID/revision,
  instructions ID/revision (Quellight-owned conversation instructions;
  profile marker `quellight.conversation-instructions@1` or similar — the
  exact declared IDs are recorded in the report), model profile naming the
  router intent `ollama-cloud/glm-5.3-flash`, generation defaults,
  bounded stop/loop policy, memory policy (Mastra message-history window;
  semantic recall OFF in 07B; observational memory OFF), ordered
  processor/guardrail chains (empty chains are declared, not omitted), and
  the adapter compatibility marker. `agentProfileVersion` is deterministic
  (`AI-003`); the activation snapshot is immutable and no live Mastra
  object is consulted in flight (`AI-004`); the observed provider/model
  identity is recorded per turn.
* `modelFactory` resolves the pinned model-profile declaration to the real
  model THROUGH the pinned Mastra model router (`ollama-cloud/
  glm-5.3-flash`). The factory receives NO credential; the credential is
  resolved just in time by the composition via `requireOperatorCredential`
  and injected as the provider environment value visible only to the model
  router resolution path (`QLT-016`, `SEC-003`). In offline mode the
  factory supplies `createDeterministicOfflineModel` — the same
  composition shape, different factory (§8.10).
* Model-facing tools: the pinned authority envelope in 07B contains NO
  capability references — the model has no tools in Stage 07B
  (`MSTR-004` vacuously enforced; the bridge machinery exists Verified and
  is first exercised with Shared World capabilities in 07C). Helper tools:
  none declared.
* Mastra Studio: not used, not exposed, not deployed (`MSTR-009`).
* Mastra request context derives from the authenticated server-side actor
  (`MSTR-007`); the single local actor is mapped deterministically to the
  Mastra `resourceId`.

### 8.6 Data ownership, store locations, and migrations

Five logical storage domains (Stage 07 architecture §6.3 makes it five),
physically separate files under one data directory (default
`.quellight-data/` in the repository root during development; operator
overridable through a bounded relative-path configuration field; URL
schemes, absolute paths, and traversal rejected by the VICT
operator-config foundation):

| File | Owner | Contents | Migrations |
| --- | --- | --- | --- |
| `vict-operational.db` | `@victframework/store-sqlite` | VICT operational records: activations, runs, attempts, turn/stream milestones, approvals (none in 07B), audit events | VICT-owned, versioned, forward-only |
| `mastra-store.db` | `@victframework/mastra` (`createDedicatedMastraStore`) | Mastra memory (threads, messages, working-memory state), workflows snapshots, observability spans | Mastra/pinned-adapter-owned; EXPLICIT retention bounds required at composition (`messagesMaxAgeMs`, `threadsMaxAgeMs`, `spansMaxAgeMs`) — recorded from operator config |
| `shared-world.db` | **Quellight** (`src/lib/sharedworld/`) | `qlt_thread`, `qlt_thread_conversation`; migration bookkeeping `quellight_shared_world_migrations` | Quellight-owned port + versioned forward-only migrations (additive; additive ALTER/CREATE only in 07B) |
| (scaffold-provided static assets/build outputs) | Quellight | not durable state | — |

Placement and permissions: all store files sit outside every publicly
served directory; `resolveProtectedStoreDir` validation and
`restrictPermissions()` (platform-supported subset; Windows ACL documented
best-effort) are applied — the Verified MSTR-011 machinery is reused, not
reimplemented. Retention metadata: `qlt_thread` carries
`retention_state` (declared closed vocabulary, 07B value set:
`currently-relevant` default | `user-removed`) plus timestamps — the full
policy engine arrives later (`QLT-019`). Mastra-side retention bounds come
from the same operator configuration (bounded positive integers).

Transcript/thread ownership summary:

* **Mastra** owns raw conversation transcripts and working memory —
  reasoning context for the model, replaceable, bounded.
* **VICT** owns turn/stream milestone records — operational truth; the
  VICT record governs the product view on any cross-store disagreement
  (amendment §4 rule 3).
* **Quellight Shared World** owns thread records — the durable concern
  list (§6). Conversation ↔ thread linkage is by correlation record.
* UI transcript restore reads VICT-authoritative completed content
  (`agent.turn.get` / `stream.inspect`; `vict.agent-stream@1`
  `contentRef` discipline) — never Mastra transcript archaeology.

### 8.7 Streaming transport and event lifecycle

* Commands (versioned HTTP, authenticated, idempotent where mutating —
  `API-002`): `agent.turn.start` (with idempotency key per logical send),
  `agent.turn.cancel`, `agent.turn.get`, `stream.inspect`,
  `actor.whoami`, `health.inspect`; thread-resource operations cross the
  typed Application Layer data boundary (`app.data.query` / `app.data.mutate`
  via `remoteQuery`/`remoteMutate` over the Quellight thread-resource
  adapter, release-bound). No other VICT command is consumed in 07B.
* Stream: resumable SSE at `/vict/v1/streams/<streamId>`; events are
  `vict.agent-stream@1` normalized events only (closed 13-kind vocabulary;
  wire-validated client-side with the `@victframework/contracts` validator).
  Lifecycle per turn: `response.started` → `text.delta`* →
  `content.completed` → `response.completed` | `response.failed` |
  `response.cancelled`. No raw provider/Mastra chunk types, no hidden
  chain-of-thought, stable non-echoing codes on failure (`AI-009`).
* Ordering/delivery: monotonic per-stream sequence numbers; at-least-once;
  client dedupes by (stream, sequence). `text.delta` is transient;
  milestones are durable.

### 8.8 Reconnect, restart, cancellation, and failure semantics

* **Reconnect:** the island reconnects with cursor `v1:<streamId>:<seq>`
  (`Last-Event-ID`); completed content is restored from durable milestone
  state, deltas resume without loss or duplication (Verified Stage 06
  semantics exercised in real use — §11 N-8).
* **Process restart:** server restart (including SIGKILL-class fixture)
  resumes or cleanly terminates in-flight turns from durable state; the
  VICT-authoritative view is rendered; no duplicate effects; thread records
  and completed turns survive; an in-flight turn that cannot resume ends
  honestly (`response.failed`/`response.cancelled`), never silently.
* **Cancellation:** the island's stop control issues `agent.turn.cancel`;
  VICT records durable cancel intent, propagates an AbortSignal into the
  AI subsystem, and the stream terminates with exactly one honest
  `response.cancelled`. Already-rendered partial content remains,
  truthfully marked. No reversal is claimed.
* **Provider rejection/timeout:** model-call failures (including 429, 5xx,
  timeout, mid-stream error) surface as `response.failed` with stable safe
  codes — raw provider error content is sanitized at the model boundary
  (the Stage 06A `VICT_OFFLINE_MODEL_FAILED` pattern extended to the live
  provider). Retry is a USER action (a new turn attempt), never an
  automatic retry storm; the bounded live proof performs zero automatic
  retries.
* **Turn deadline:** the profile declares a bounded turn deadline
  (operator-visible); expiry settles the turn honestly per the above.

### 8.9 Minimal conversation UI states

Conversation-first workspace (`OQ1` minimum): thread list (Shared World
records; create, rename, archive/dormant, reopen) + the live conversation
island. Island states: `empty` (new thread), `streaming` (live deltas +
visible stop control), `reconnecting` (truthful indicator during cursor
replay), `completed`, `cancelled` (partial retained, marked),
`failed` (stable safe code + user retry action), `archived`
(read-only thread view). Loading and denied states are honest; no
fabricated content, no fake streaming indicators. Markdown/code rendering
is minimal (safe rendering, no raw HTML injection — conversation content
is untrusted data, `AI-014`); copy actions optional. Responsive
desktop/tablet/mobile with keyboard accessibility and screen-reader
semantics on the baseline flows (live-region announcements for streaming
state; keyboard-reachable stop; focus management on thread switch) — the
Stage 05 accessibility discipline applied to Quellight surfaces. The
thread list may be a structured Application Layer records surface bound to
the thread resource; the live conversation workspace is an explicit
versioned Svelte custom-component island (`APP-014`), receiving only
declared safe data/action surfaces; every non-local action crosses a typed
boundary (`APP-010`); UI state is never authorization (`APP-012`).

### 8.10 Deterministic offline seam and bounded live seam

* **Offline:** every deterministic test composes the SAME conversation
  path with `createDeterministicOfflineModel` scripted fixtures —
  streaming, cancellation, failure, reconnect, restart. `npm test` never
  requires network access or a provider credential, and a negative control
  proves composition fails closed when a live profile is requested without
  a resolvable credential (`VICT_OPERATOR_CREDENTIAL_UNAVAILABLE`).
* **Live:** `npm run verify:live-provider` (scripts/) is the ONLY path
  that touches the real provider. Gates: explicit environment opt-in
  (`QUELLIGHT_LIVE_PROOF=1`) AND the operator credential present. Bounds:
  ≤ 5 turns total; ≤ 256 max output tokens per turn; per-turn deadline
  120 s; first token expected within 30 s; ONE execution per invocation;
  ZERO automatic retries. Assertions: real streaming observed (first-token
  latency recorded), completion observed, cancellation of one live turn
  succeeds honestly, transcript persists and restores across a real
  server restart within the proof. Never part of `npm test` or any
  default script chain. Never run in CI. Provider errors (429/5xx) fail
  the proof truthfully.

### 8.11 Protected operator configuration and credential non-leakage

Quellight composes the VICT operator-configuration foundation
(`@victframework/runtime`): closed field sets, bounded patterns, stable
non-echoing diagnostics (`VICT_OPERATOR_CONFIG_INVALID`,
`VICT_OPERATOR_CREDENTIAL_UNAVAILABLE`), canonical serialization
incapable of carrying a credential value. Configuration surface
(environment/operator file; NAMES only in `.env.example`):

```text
QUELLIGHT_PROFILE          (closed value: ollama-cloud/glm-5.3-flash in 07B)
QUELLIGHT_DATA_DIR         (bounded relative path; default .quellight-data)
QUELLIGHT_RETENTION_*      (bounded positive-integer bounds for Mastra domains + transcript bound)
QUELLIGHT_ACTOR_TOKEN      (local actor bearer token for the loopback boundary; server-side only)
OLLAMA_API_KEY             (provider credential; resolved just in time; never logged/serialized/persisted)
QUELLIGHT_LIVE_PROOF       (live-seam gate; absence = offline only)
QUELLIGHT_PORT             (public port)
```

Non-leakage rules (`SEC-003`, `AI-004`, `MSTR-011`): credential values are
never logged, echoed, serialized into any profile/snapshot/stream/trace/
event/persistence, or embedded in build artifacts. The proxy injects the
actor token server-side; the browser never receives any secret. Canary
tests (§11 N-14) prove absence across every observable surface.

### 8.12 Local development and production-build commands

```text
npm ci                 (clean registry-only install from the committed lockfile)
npm run dev            (single-process dev composition)
npm run build          (clean production build; warning-free)
npm run preview        (serve the production build locally)
npm test               (deterministic offline suite; no network, no credentials)
npm run verify:quellight        (aggregate Quellight gate — composition of the checks below)
npm run verify:consumer         (registry-only consumer/install/lockfile probe + no-monorepo-fallback)
npm run verify:live-provider    (bounded live proof; explicitly gated; §8.10)
```

Exact script wiring is reconciled with the scaffolder-generated
`package.json` in WP-2; the aggregate gate is the Stage 07B ladder.

## 9. Repository inception requirements (exact procedure)

1. **Verified empty-state preflight (STOP on any mismatch):**
   * local folder exists; `git rev-parse` fails (not a repository);
   * the folder contains exactly `docs/The-Persistent-Cognitive-Partner-Agent-Context-v1.3-CANONICAL.md`;
   * its SHA-256 equals `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331`
     (the value recorded in Stage 07 architecture §1);
   * `git ls-remote https://github.com/radz2291/Quellight.git` exits 0 with
     zero refs; if refs exist, or authentication is required and
     unavailable, or the repository is otherwise non-empty — STOP and
     request the owner decision. Record all preflight observations in the
     report.
2. **Initialize:** `git init` with default branch **`main`**; add
   `origin = https://github.com/radz2291/Quellight.git`. No other remote,
   no tags (no tag convention exists anywhere in this ecosystem; release
   identity is content-derived).
3. **Initial commit ordering (each commit builds and lints where
   applicable; no commit mixes release-pin changes with product logic):**
   1. `docs: canonical architecture input` — the canonical v1.3 document,
      byte-preserved at its existing path (verify hash again at commit
      time), plus `.gitignore` and `.env.example` (§9.6–§9.7);
   2. `chore: scaffold application host` — `scaffoldVictApp` output
      reconciled with the foundation (merged `.gitignore`, adjusted
      `package.json` name/privacy/license fields), Application Definition
      shell;
   3. `chore: dependencies and lockfile` — exact VICT release-set
      dependencies + generated toolchain deps; `package-lock.json`
      committed;
   4. onward: one focused commit per work package (§10), conventional
      messages (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `verify:`).
4. **Lockfile:** `package-lock.json` committed; `npm ci` is the only
   supported clean-install path; the lockfile is never hand-edited; every
   `@victframework/*` entry resolves to the public registry with
   `sha512-` integrity and version exactly `0.1.0`.
5. **Supported Node/npm:** `engines.node >= 22.13.0` on the Quellight
   package; the observed implementation pair (Node v22.13.1, npm 10.9.2)
   recorded in the report; no engines claim beyond the VICT floor.
6. **Package privacy:** `"private": true` — Quellight is a product and is
   NEVER published to npm; no `publishConfig`.
7. **License status:** Quellight does NOT become Apache-2.0 by consuming
   VICT (VICT's license governs VICT's artifacts). Recommended truthful
   posture absent an owner decision: `"license": "UNLICENSED"` +
   `"private": true`, with a README notice that all rights are reserved by
   the Quellight owner and that the product license/privacy posture is an
   explicit pending owner decision (§16). Do NOT add an Apache-2.0 or any
   other license text — that would invent an owner decision.
8. **`.gitignore`:** node_modules, build/ and dist outputs, `.svelte-kit/`,
   the data directory (`.quellight-data/`), `*.db`, `*.db-wal`, `*.db-shm`,
   all SQLite sidecars, `.env` and `.env.*` EXCEPT `!.env.example`, local
   coding-agent material (`.pi/`), OS/editor junk, test tmp artifacts.
9. **`.env.example`:** variable NAMES only (§8.11 list) with placeholder
   comments; never any value.
10. **No credentials in Git history:** the preflight, every commit, and
    the final history scan MUST show zero credential-shaped values; the
    owner supplies the provider credential only into the implementation
    environment at live-proof time; the actor token is generated into the
    local environment, never committed.
11. **Exact VICT dependency pins:** all thirteen
    `@victframework/*@0.1.0` as exact-version dependencies (no ranges);
    release-set membership re-verified at implementation time against
    `docs/RELEASE-COMPATIBILITY.md` (fetch the live registry metadata and
    compare the content ID algorithm inputs).
12. **Rollback and clean-install proof:** from a fresh clone in a temp
    directory OUTSIDE both repositories: `npm ci` (registry only) →
    typecheck → build → `verify:quellight`; plus the negative control
    N-2 (registry unreachable → truthful failure, no fallback). Rollback
    = pin a prior commit of the Quellight repository; VICT rollback rules
    are the release-set rules of `docs/RELEASE-COMPATIBILITY.md` §5.

## 10. Ordered implementation work packages

### WP-1 — Repository inception and foundation
Execute §9 completely. Deliverable: an initialized local repository with
the canonical input committed byte-exact, foundation files, verified
preflight record, and a fast-forward-pushed `main` whose tip matches the
local tip. Nothing product-related yet.

### WP-2 — Consumer skeleton against the released set
Add the exact release-set dependencies; run `scaffoldVictApp` into the
root (reconciling generated vs foundation files); author the initial
Application Definition (structured shell: routes, navigation, thread-list
records surface, conversation screen with the island slot); render through
`@victframework/renderer-svelte`; register the (initially minimal) island.
Deliverable: `npm run build` green and warning-free; headless renderer
composition check; `verify:consumer` green including the no-monorepo-
fallback negative control.

### WP-3 — Composition and storage foundations
Compose, in one process (§8.3): VICT operational stores
(`@victframework/store-sqlite`), the dedicated Mastra store
(`createDedicatedMastraStore` with operator retention bounds and permission
restriction), the **Quellight Shared World store** (port + SQLite adapter +
versioned migrations; `qlt_thread` + `qlt_thread_conversation`; §6), and
the operator configuration (profile, stores, retention bounds, actor
token, credential name). Wire the loopback VICT server boundary and the
`/vict` proxy with server-side actor injection. Deliverable: stores open/
close/reopen green; placement/permission checks; operator-config canary
tests; the Shared World adapter passes the shared application-data
conformance fixtures (`@victframework/application/testing`) for the
supported subset.

### WP-4 — Conversation path (offline-deterministic first)
Compose the agent profile + `MastraProductAgent` with the offline fixture
factory; implement thread create/rename/archive/reopen through the typed
data boundary onto the Shared World store with conversation-link
correlation; implement turn start/cancel/reconnect against
`agent.turn.start` / `agent.turn.cancel` / `agent.turn.get` /
`stream.inspect` and the resumable SSE path; transcript persistence and
VICT-authoritative restore; server restart reconciliation test (real
child-process SIGKILL fixture). Deliverable: the full offline lifecycle
suite (§11 N-3..N-10, N-13) green end to end with the deterministic model.

### WP-5 — Live provider profile and bounded proof seam
Wire the `modelFactory` to resolve `ollama-cloud/glm-5.3-flash` through the
pinned Mastra model router with the just-in-time credential (§7, §8.5);
implement `verify:live-provider` with all gates and bounds (§8.10);
profile-declared turn deadline; provider-error sanitization checks against
the fake fault seam. **No live call occurs in this work package's tests.**
Deliverable: the seam proven offline (gate-closed behavior, credential-
absent fail-closed, sanitized failure mapping); the live run itself awaits
the owner credential and profile confirmation.

### WP-6 — Conversation UI island and states
Implement the island states, stop control, reconnect indicator, thread
list interactions, safe markdown rendering, responsive layout, keyboard
accessibility, live-region announcements, theme-token use. Deliverable:
real-browser responsive + keyboard/axe checks on the baseline flows;
hydration/runtime warning-free build.

### WP-7 — Hardening, evidence, and documentation
Run and record the complete Stage 07B ladder (§11); build-artifact
hygiene scans (N-17, N-18); README + retention/privacy disclosure +
operator reference (§12); the completion report (§14); history hygiene
scan; push. Deliverable: Stage 07B implementation-complete; the bounded
live proof run remains the final exit-gate item (owner credential + §7
confirmation).

## 11. Tests and negative controls (minimum set)

All deterministic unless marked live. Every test runs offline with no
credential; the offline fixture is the only model in `npm test`.

1. **N-1 Clean registry-only installation:** fresh temp clone outside both
   repositories; `npm ci` installs exclusively from
   `https://registry.npmjs.org/`; every `@victframework/*` lockfile entry
   has a registry `resolved` URL, exact `0.1.0`, and a `sha512-` integrity
   hash matching the registry `dist.integrity`; typecheck + build green.
2. **N-2 No monorepo fallback:** same probe with the registry made
   unreachable (`--registry http://127.0.0.1:9/` or equivalent scoped
   config) — npm fails truthfully, produces no lockfile, installs nothing;
   no resolution from any VICT checkout path, `file:`/`link:`/git
   specifier, or alternate cache.
3. **N-3 Deterministic offline conversation lifecycle:** scripted fixture
   turn — `response.started`, ordered deltas, `content.completed`,
   `response.completed`; completed content durably retrievable; turn
   milestones in VICT stores; sequence numbers monotonic.
4. **N-4 First-token and stream-completion behavior:** first normalized
   event latency recorded; completion only after the final durable
   milestone; no completion claim on truncated streams.
5. **N-5 Cancellation:** `agent.turn.cancel` mid-stream → durable intent →
   exactly one honest `response.cancelled`; partial rendered content
   preserved and marked; retry does not re-execute or duplicate the
   cancelled turn's durable record.
6. **N-6 Provider rejection and timeout:** fixture-injected model failure,
   429-shape failure, 5xx-shape failure, and deadline expiry at the
   model-factory seam → stable safe codes on `response.failed`; zero raw
   provider error content anywhere; zero automatic retries.
7. **N-7 Malformed event rejection:** client-side wire validation rejects
   unknown event kinds, broken envelopes, and non-monotonic sequences with
   structured diagnostics; the stream is marked unhealthy; nothing silent
   is accepted or rendered.
8. **N-8 Client disconnect/reconnect:** drop the SSE connection
   mid-stream; reconnect with the cursor — lossless ordered replay, client
   dedupe of at-least-once duplicates, restored completed content;
   duplicate-delivery handling proven (same frame twice → one rendered
   delta).
9. **N-9 Server restart:** real child-process SIGKILL mid-turn; restart;
   VICT-authoritative reconciliation — no duplicate effects, no fabricated
   completion; completed turns and thread records survive; transcript
   restore shows exactly the durable truth.
10. **N-10 Thread list and reopen:** create → appears in the Shared World
    thread list; rename; archive (dormant); reopen (active); ordering by
    recency; archived threads read-only.
11. **N-11 Transcript ordering and idempotency:** duplicate
    `agent.turn.start` with the same idempotency key → exactly one turn;
    message ordering matches stream sequence; restart re-renders the same
    order.
12. **N-12 Shared World isolation:** the conversation/model path has NO
    write path into `shared-world.db` (probe attempts fail structurally);
    deleting the Mastra store leaves `qlt_thread` records intact and the
    UI renders the truth (thread present, transcript absent); no code
    path derives any Shared World claim from transcript persistence.
13. **N-13 SQLite close/reopen:** all three stores close and reopen; turn
    state, thread records, and retention bounds intact; migration
    bookkeeping versioned and forward-only.
14. **N-14 Credential canary absence:** high-entropy canary values planted
    as `OLLAMA_API_KEY` and `QUELLIGHT_ACTOR_TOKEN` in a test composition;
    asserted absent from: server logs (captured console), command
    responses, SSE frames, error messages/stacks, VICT durable rows (raw
    DB/WAL/SHM bytes), Mastra store bytes, Shared World bytes, serialized
    operator configuration, and build artifacts.
15. **N-15 Bounded live proof (LIVE; §8.10):** the gated script — real
    stream with recorded first-token latency, real completion, one live
    cancellation, restart-and-restore within the proof, bounds enforced,
    truthful failure on 429/5xx with zero retries. Executed ONCE after the
    owner confirms the §7 profile and supplies the credential; evidence
    recorded per §13.
16. **N-16 No implicit Shared World claims:** documentation/UI text scan —
    no continuity, memory-of-meaning, or persistent-partner claim in any
    07B surface; the in-product disclosure states what IS retained
    (conversation transcripts under bounds) and that durable partnership
    meaning is not implemented.
17. **N-17 Clean production build:** `npm run build` green with ZERO
    warnings (including hydration/runtime warnings in a smoke render of
    the built app).
18. **N-18 Build-artifact hygiene:** scan `build/` output — no credential
    canary, no local absolute paths (`C:\Users`, `/c/Users`,
    `260831-VCT-02`, `260909-VCT-Quellight`), no `.env` content, no store
    files.
19. **N-19 Responsive keyboard-accessible UI:** real-browser checks at
    desktop/tablet/mobile widths; keyboard-only completion of the baseline
    flow (create thread → send → stream → stop → reopen); axe scan clean
    on the baseline flows; live-region announcements verified.
20. **N-20 Aggregate gate:** `verify:quellight` composes N-1..N-19
    (excluding the live proof) and is green from a clean worktree;
    `git diff --check` clean.

**Evidence-capture rules (§13 of the completion report):** exact commands
with exit codes; observed counts; SHAs of every proof boundary; store-file
hashes (not contents) at proof boundaries; SSE captures may be retained
only with conversation content replaced by synthetic test content; the
live-proof record contains metadata only (latencies, codes, bounds,
timestamps) — conversation text is NOT committed to the repository;
transcripts from the live proof, if the owner wants them retained, live in
the local data directory only and are covered by the product disclosure.
Provider credentials and the actor token NEVER enter the repository, the
report, or any evidence artifact.

## 12. Documentation requirements (Quellight repository)

* **README.md:** product identity (Quellight — persistent cognitive
  partner as the long-term product; Stage 07B delivers the conversation
  foundation only); the declared deployment envelope (`MSTR-012`
  declaration: local-first, single actor, single application process,
  non-multi-tenant, file-backed); run/verify instructions (§8.12);
  operator configuration reference (variable names §8.11); store map
  (§8.6); license/privacy posture notice (§9.7).
* **Retention and privacy disclosure (in-product AND README):** what is
  retained (conversation transcripts under explicit bounds; turn records;
  thread records), where (local store files), how to delete (thread
  deletion is a later-substage governed operation — 07B discloses
  truthfully that product-level deletion arrives later and states the
  manual local remediation), that conversation content is sent to the
  configured provider (Ollama Cloud; hosted US/EU; zero data retention
  per Ollama's cloud policy — linked), and that credentials are never
  stored in the product's data.
* **Agent profile record:** the declared profile components and
  `agentProfileVersion` inputs (IDs/revisions — never instructions text
  beyond the declared file's revision reference).
* **`.env.example`** (names only) and the **report** (§14). No new VICT
  documentation is written by Stage 07B; VICT-side registration is already
  performed by this handoff package.

## 13. Commit and push strategy (Quellight repository)

* Conventional, focused commits per WP-1..WP-7 (§9.3 ordering rules).
* Push by normal fast-forward to `origin/main` only; never force-push,
  rebase, or rewrite pushed history; never push credentials, `.env`,
  store files, build outputs, or live-proof transcripts.
* Before each push: full diff inspection; `git fetch` + confirm the remote
  has not advanced; re-run `git diff --check`.
* The VICT repository receives exactly ONE documentation commit for this
  handoff package (already applied before implementation begins); the
  Quellight implementation MUST NOT create any further VICT commit. If
  VICT-side work is discovered as genuinely required — STOP (§15); it
  re-enters VICT governance, it is never patched from Quellight.

## 14. Completion-report template

`docs/report/QUELLIGHT-STAGE-07B-IMPLEMENTATION-REPORT.md` (Quellight
repository; implementer claim — NOT independently authoritative; Stage 07B
is not Verified until an independent audit passes):

```text
# Quellight Stage 07B — Implementation Report
> Class / authority statement; starting and final SHAs (local + remote after push);
> environment (OS, Node, npm); release-set identity consumed.

## 1. Preflight record (§9.1 observations, hashes, remote state)
## 2. Work packages WP-1..WP-7 — what was done, files created, deviations (none silent)
## 3. Provider profile record — profile components, agentProfileVersion inputs,
     router intent, observed provider/model identity from the live proof (metadata only)
## 4. Verification ladder — exact commands, exit codes, observed counts
     (offline suite counts; live-proof metadata: turns, bounds, first-token
     latency, completion, cancellation, restart-restore; NO conversation text,
     NO credentials)
## 5. Negative controls — N-1..N-19 evidence pointers (N-20 aggregate result)
## 6. Store and migration record — files, versions, retention bounds in force
## 7. Build-artifact hygiene results (N-17, N-18)
## 8. Documentation deliverables — README, disclosures, .env.example (names only)
## 9. Known limitations and explicit deferrals (§16) — truthfully listed
## 10. Explicit stop point — what was NOT done (live proof if pending;
      everything in §15/§17)
```

## 15. Autonomy and stop conditions

Permitted without further consultation: all Quellight-repository work
within §6–§12; scaffolder reconciliation; test/script authoring; recording
declared IDs and observed versions.

STOP and request an owner decision before proceeding when:

* the §9 preflight fails in any particular (folder state, canonical hash,
  remote refs, remote access/visibility);
* the §7 provider profile confirmation is withheld or the owner chooses
  the Z.ai Model API alternative (profile revision);
* any `@victframework/*@0.1.0` consumption gap is found (missing export,
  packaging defect, wire mismatch) — record it; do NOT fork, patch,
  vendor, or work around VICT from Quellight;
* a release-set identity mismatch or lockfile integrity failure appears;
* scope pressure arises to add ANY §15/§17 deferral (commitments, loops,
  ceremony, context assembly, deletion flows, rotation, multi-user…);
* any VICT repository change would be needed;
* the working tree or remote state diverges from the handoff's verified
  baseline.

Do not start Stage 07C or any later substage. Do not mark your own work
Verified. Do not create a VICT constitution or ratify `OQ6`.

## 16. Explicit deferrals (Stage 07B excludes ALL of the following)

Autonomous cycles; autonomous interruption (`OQ3`/`ESC`); voice
(`OPEN-018`); broad ingestion (`C2a`); complete `D1–D5` or `ESC`; complete
`G1–G5` external delegation; complete `SYNC`; advanced `A3–A5` learning;
provider rotation or fallback (`OQ4`); multi-user or multi-tenant
operation; cloud-scale claims (`MSTR-012` envelope unchanged); Builder
Agent (`AGNT-007`); live external authority; unrelated VICT framework
expansion; any other consumer product; Shared World semantics beyond §6
(epistemic claims, commitments, open loops, correction lineage, ceremony,
context assembly from `C1`, retention policy engine, deletion/export
flows, dependency re-evaluation); Mastra semantic recall and observational
memory (OFF in 07B); provider tool-calling exercises; `MSTR-012` real-use
proof (07D-level work per §17); thread states `waiting`/`resolved`;
in-product constitution material (`OQ6` untouched).

## 17. Proposed remaining Stage 07 sequence (PROPOSED — accepted only through this handoff process; each substage gets its own handoff)

Derived from the Quellight architecture (§7–§9, §13 of the Stage 07
document). The superseded ARA `07A/07B/07C` breakdown is NOT inherited;
`07A`/`07B` are the already-governed increments, and the boundaries below
are newly proposed and remain PROPOSED until the owner accepts this
handoff.

* **Stage 07C — Shared World Meaning and Ceremony (proposed).** The
  minimal Shared World record families become real: epistemically typed
  claims/evidence (`E1–E7`, `H-*`); commitments and open loops with the
  explicit proposal/confirmation ceremony (`OQ2`, `QLT-005`, `QLT-006`);
  atomic commitment+loop creation through governed VICT capabilities —
  the first real exercise of the Verified tool bridge for Shared World
  writes (`QLT-013`, Stage 07 architecture §5.4); visible shared-world
  objects with minimal inspector parity (`QLT-012`, canonical `B1`);
  context assembly from thread + commitments + open loops — a fresh
  thread with no transcript recovers relevant continuity from `C1`
  (`QLT-008`); correction lineage first delivery (`QLT-007`); §8 first
  vertical steps 1–4 offline.
* **Stage 07D — Retention, Recovery, and Real-Use Proof (proposed).**
  Retention policy with tombstones and dependency re-evaluation
  (`QLT-011`, `QLT-019`, `INV-17`); governed deletion/export with
  cross-store reconciliation; conflict identification and explicit
  amendment vs execution (`QLT-009`, `QLT-010`, `INV-15`; §8 steps 6–8);
  full §8 vertical offline (steps 5–10) including SIGKILL-class Shared
  World continuity; `MSTR-012` real-use proof matrix (retention, pruning,
  deletion, export; non-web-accessible stores; canaries; disclosure;
  backup/recovery limitations — `QLT-017`); the bounded live vertical
  subset (§8 verification form); accessibility/responsive evidence and
  latency reporting (`ARA-005` successor discipline).
* **Stage 07E — Stage 07 Exit Gate (proposed).** Independent product,
  architecture, security, and accessibility audits; Stage 07 exit gate
  (§13 of the Stage 07 architecture) disposition; `QLT-*` status
  reconciliation per §27.4; formal closure record. `OQ6` remains open
  unless the owner explicitly ratifies.

Q2–Q5 remain Quellight's later product roadmap (§9 of the Stage 07
architecture) and are untouched by this proposal.

---

*End of the Stage 07B handoff. Stage 07A remains formally closed; Stage 07
remains In Progress; **Stage 07B is PERMITTED — specified by this handoff —
and NOT BEGUN**; the Quellight local folder and
`https://github.com/radz2291/Quellight` were inspected read-only for this
handoff and remain unchanged; every `QLT-*` requirement remains Planned;
the published release set `vict-release-set@1/0.1.0` is immutable and
unchanged.*

*Closure status (2026-09-10, reference v0.4.7, §0.16): Stage 07B was
implemented under this handoff, independently re-verified
(`VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE PERMITTED`,
re-verification at Quellight commit `1e0c0f53…`), and FORMALLY CLOSED —
`STAGE 07B VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED`; Stage 07C
specification is permitted and NOT BEGUN (entry gate: reference §0.16.3);
Stage 07 remains In Progress. The issuance-time statements above are
preserved unchanged as the historical record.*
