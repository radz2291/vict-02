# VICT Stage 07 — Quellight Minimum Workable Product

> **Authority:** `docs/VICT-SYSTEM-REFERENCE.md` v0.4.0 (this document is the
> accepted v0.4.0 Quellight rebaseline amendment; see §0.11 of that
> reference) and the canonical input
> `The-Persistent-Cognitive-Partner-Agent-Context-v1.3-CANONICAL.md`
> (§1 below). It supersedes the previous Stage 7 target ("Real Mastra-backed
> ARA product") as the governing Stage 07 design. The historical Mastra/ARA
> amendment record remains normative for everything it decided that this
> document does not change (`docs/architecture/MASTRA-ARA-INTEGRATION.md`,
> read with its 2026-09-09 Quellight supersession note).
> **Status:** Accepted architecture amendment — Stage 07 is rebaselined and
> permitted. **Stage 07 implementation has NOT begun.** **Stage 07A** (see
> `docs/handoff/VICT-STAGE-07A-QUELLIGHT-CONSUMER-FOUNDATION-HANDOFF.md`)
> is the next permitted implementation increment. No Quellight capability
> is Verified by this documentation task; every new `QLT-*` requirement is
> Planned, and no Stage 01–06 Verified status is changed by this document.
> **Stage 06 remains formally closed** (2026-09-09, reference v0.3.4).
>
> **Status update (2026-09-09, reference v0.4.2, §0.13): Stage 07A is
> implemented, independently verified, and FORMALLY CLOSED.** The
> independent verification (audit at commit `cb9d74b…`) returned `VERIFIED
> WITH NON-BLOCKING ISSUES — FORMAL CLOSURE PERMITTED`; the formal-closure
> action performed the audit-sanctioned F-1 verifier self-match correction
> (fix commit `e45bdec…`), marked N-1 CLOSED-in-Stage-07A and `ARCH-012`
> Verified, and recorded `docs/report/VICT-STAGE-07A-FORMAL-CLOSURE.md`.
> Disposition: `STAGE 07A VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY
> CLOSED`. **Stage 07B is PERMITTED and NOT BEGUN.** Stage 07 remains In
> Progress until the §13 exit gate passes an independent audit; every
> `QLT-*` requirement remains Planned; the Quellight repository has not
> been created or touched; the published release set
> `vict-release-set@1/0.1.0` is immutable and unchanged.
> **Scope:** product identity and repository boundary; the corrected
> memory/identity model; the Shared World record and storage decision; the
> exact Minimum Workable Quellight scope and exclusions; the canonical
> first vertical; the Q0–Q5 roadmap; requirement traceability and ARA
> compatibility; open constitutional decisions; security and retention
> boundaries; the Stage 07 exit gate; genuine risks and limitations.

---

## 1. Authority and source hash

The canonical Quellight input is the attached architecture context file,
read completely before this amendment was authored:

| Property | Value |
| --- | --- |
| File | `The-Persistent-Cognitive-Partner-Agent-Context-v1.3-CANONICAL.md` |
| Version | `1.3` |
| Date | `2026-09-07` |
| Status | `CANONICAL — conceptual architecture frozen` |
| SHA-256 | `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331` |

Rules of engagement with the canonical input:

- The v1.3 canonical architecture is **Quellight's long-term governing
  product architecture**. It defines the product's law (`P01–P18`),
  structure (`C1–C9`, `SH1–SH5`, `E1–E7`, `MS1–MS6`, `L0–L5`), behavior
  (`S1–S7`, `A1–A5`, `G1–G5`, `D1–D5`+`ESC`, `H-*`, `F1–F5`),
  invariants (`INV-01..INV-17`), build order (`B1–B6`) and open
  constitutional questions (`OQ1–OQ6`).
- Stage 07 does **not** claim the v1.3 architecture is implemented. It
  delivers a truthful **Minimum Workable Quellight** (§7) whose central
  product claim — persistent shared-world continuity with governed
  durable meaning — is proven end to end (§8). Everything not in the
  minimum remains canonical roadmap (§9).
- Where the canonical document and this amendment disagree about
  **sequencing**, the canonical build order (`B1–B6`) remains the
  long-term order and this amendment maps Stage 07 onto it truthfully
  (§9, roadmap-stage mapping); where they disagree about **meaning**, the canonical document
  wins. Any deviation from canonical meaning would require a formal
  versioned constitutional change, which this amendment does not make.

Repository context at authoring time:

| Property | Value |
| --- | --- |
| VICT `origin/main` expected and confirmed | `c6d2a5a3e4745bfed44c204c6a9c1674e57e03c7` |
| Stage 06 status | Formally closed, verified with non-blocking issues (reference v0.3.4, §0.10) |
| Stage 07 status | Permitted; rebaselined by this amendment; **not begun** |
| All `@victframework/*` package manifests | version `0.1.0`, `private: true`, Node `>=22.13.0` |

---

## 2. Product identity and repository boundary

### 2.1 The governing product decision

The product previously called **ARA** is now named **Quellight**.

```text
VICT       — the reusable application framework, runtime and control system.
             This repository. Provides execution, identity, durability,
             governance, application delivery, and the product-agent
             integration boundary (Mastra behind @victframework/mastra).
Quellight  — a SEPARATE product repository and EXTERNAL CONSUMER of
             released VICT packages. VICT's first flagship consumer and
             reference product. A persistent cognitive partner, not a
             renamed chatbot.
```

Naming rules:

- **Future-facing product language MUST use "Quellight."** New documents,
  requirements, code, UI text, and reports name the product Quellight.
- **Historical ARA evidence and identifiers remain historically
  truthful.** Existing `ARA-*` requirements, Stage 01–06 reports,
  evidence chains, and the phrase "ARA proof" (the 13-event offline
  walking proof) keep their historical names and are never silently
  renamed or repurposed (§10.4).
- Quellight is a **persistent cognitive partner** per the canonical
  v1.3 architecture: it persists between conversations, holds a shared
  world with its user, keeps commitments and open loops, and recovers
  continuity across restarts and model swaps. A chat transcript with a
  database is not Quellight; the shared world is the product.

### 2.2 What the boundary means concretely

| Rule | Consequence |
| --- | --- |
| Quellight never imports VICT through mutable relative paths or source copies | A clean Quellight clone installs immutable, pinned VICT release artifacts (handoff, work items 3–5) |
| Quellight-specific product semantics live in the Quellight repository | Shared World semantics, the conversation workspace, context assembly, retention policy, and product requirements are Quellight-owned (§6) |
| VICT never imports Quellight | No VICT package depends on, references, or contains Quellight code or requirements |
| Quellight's structured product surface uses the VICT Application Layer | Routes, navigation, forms, tables, safe states and renderer composition come from Application Definitions (`APP-001..APP-016`); bespoke conversation surfaces are explicit versioned custom-component islands (`APP-014`) |
| Quellight's durable meaning-making crosses VICT governed capabilities | Every Shared World write from the conversation path crosses the VICT capability boundary — actor/authority check, contract validation, effect/approval policy (`AI-006`, `MSTR-004`, §5.4) |
| The Builder Agent stays out of Quellight's conversation path | `AGNT-007` unchanged |
| The declared deployment envelope is inherited, not extended | Local-first, single actor, single application process, non-multi-tenant, file-backed (`MSTR-012`); no multi-process, multi-tenant, protected-cloud claim |

### 2.3 Truthful current state

As of this amendment there is **no Quellight repository, no Quellight
product code, and no Quellight capability**. Stage 07 must create both
the release-consumption mechanism in VICT (Stage 07A, handoff) and the
Minimum Workable Quellight in the new repository (Stage 07B and onward
within Stage 07). Until the Stage 07 exit gate passes an independent
audit, no Quellight behavior may be described as delivered or Verified.

---

## 3. VICT-readiness matrix

What the closed Stages 01–06 give Quellight, and what is still missing.
Statuses quote the authoritative reference tables.

| Capability needed by Quellight | VICT state | Status |
| --- | --- | --- |
| Durable, restart-safe execution with pinned identity | Kernel/runtime activation, run pinning, SQLite stores, restart reconciliation | Verified (Stages 01–03) |
| Governed capability execution with effect/approval policy | Runtime authority gating + `@victframework/control` ChangeSets/approvals | Verified (Stages 01–06) |
| Neutral product-agent boundary, agent-profile identity, immutable snapshots | `ProductAgent` port, `agentProfileVersion`, activation snapshots | Verified (Stage 06) |
| Mastra composition: pinned versions, offline fixture, tool bridge, streaming | `@victframework/mastra` adapter, nine-step bridge, `vict.agent-stream@1` + resumable SSE | Verified (Stage 06); **offline fixture only — no live provider ever exercised** |
| Credential isolation, retention bounds with executed pruning, governed deletion/export, canary leakage tests | Stage 06A/06B data-protection baseline | Verified within the declared local envelope (`MSTR-011`); **real-use proof (`MSTR-012`) is Stage 07 work** |
| Application delivery: renderer, scaffolder, SQLite domain adapter, conformance | `@victframework/renderer-svelte`, `@victframework/scaffolder`, `@victframework/appdata-sqlite` | Verified (Stage 05) |
| Actor boundary, versioned HTTP commands, idempotent commands, CLI | `@victframework/server`, `@victframework/cli` | Verified (Stage 06) |
| **Consumable release artifacts for an external repository** | All `@victframework/*` are `0.1.0` and `private: true`; no publish mechanism, no compatible release-set identity, no clean external consumer proof | **Missing — Stage 07A (handoff)** |
| **One real model-provider profile with protected credential resolution** | Provider binding is composition-supplied; offline fixture only | **Missing — Stage 07 work** |
| **Quellight Shared World store (threads, epistemics, commitments, loops, lineage, retention)** | `@victframework/application` data port is flat single-resource CRUD (§6) — not sufficient | **Missing — Quellight-owned store (§6.3)** |
| **Conversation-first workspace with visible shared-world objects** | Renderer and code-island mechanism exist; no conversation workspace exists | **Missing — Quellight product surface** |
| **Context assembly from thread + commitments + open loops** | Nothing in VICT assembles product meaning | **Missing — Quellight product logic** |
| **Live-provider proof and MSTR-012 real-use evidence** | Never performed in any stage | **Missing — Stage 07 work** |

The matrix is the honest gap list Stage 07 closes for its bounded
minimum. It also explains the Stage 07 delivery split: Stage 07A closes
the consumption foundation inside VICT first, because nothing in the
Quellight repository can truthfully consume VICT before it exists.

---

## 4. Canonical-to-VICT ownership mapping

How each canonical component lands on VICT machinery, Quellight product
code, or deferral. "Quellight" below means the Quellight repository.

| Canonical ID | Component | Minimum owner and mapping |
| --- | --- | --- |
| `C1` Shared World | The single durable truth | **Quellight-owned store** (§6.3), written through VICT governed capabilities; exposed to structured surfaces through Application Layer bindings |
| `C2a` external ingress integrity | Source validation before shared-world records | **Deferred** — no ingestion sources in the minimum; the only external ingress is the conversation input, which crosses VICT contract validation |
| `C2b` kernel I/O integrity | Controlled, audited kernel↔world crossings | **VICT capability boundary** (`AI-006`, bridge, actor/authority/contract/effect/approval) is the enforced `C2b` analog; Quellight kernel reads/writes cross it |
| `C3` Agent Kernel | Constitution, models, projections | **Split:** the reasoning substrate composition lives in `@victframework/mastra` (Verified); the three living models and projections are Quellight product state rebuilt from `C1` (§5) |
| `C4` Constitution | Durable identity/invariants | **Quellight-owned durable record** (versioned, user-visible). Hard-regime enforcement (`L0–L2`, grants, invariants) rides VICT deterministic gates (`INV-16`); semantic regime (`L3–L5`) is mandatory loop policy in the Quellight agent instructions/processors |
| `C5` Cognitive Loop | `S1–S7`, event-activated | Mastra agent loop inside the bounded AI subsystem. **Minimum activation source: user interaction only.** Event/time/ingestion activation deferred (§7.2). `S5` maps to the model's constitution check plus the VICT deterministic gate — the gate is authoritative for `L0–L2` and authority grants |
| `C6` Adaptation Engine | `A1–A5` lawful speeds | `A1` surface behavior and `A2` working context operate naturally in conversation; **`A3–A5` learning/adaptation deferred** — no automatic pattern learning in the minimum |
| `C7` Authority & Consent | `G1–G5`, `D1–D5`, `ESC` | VICT control plane + Quellight UI. Default posture (`OQ5`): knowledge/inspection of the user's own Shared World granted; **no external execute/decide authority**; `D1–D3`-style surfacing happens only in response to user interaction; autonomous initiative and `ESC` interruption deferred (`OQ3`) |
| `C8` Recovery & Continuity | Failure states, rollback, rehydration | VICT restart/reconciliation semantics (Verified, SIGKILL-proven) + Quellight rehydration: projections and context rebuilt from `C1` after restart or model change (`P18`, `F5`) |
| `C9` Reasoning Substrate | Replaceable LLM | Mastra pinned provider/model profile (`OQ4`: one pinned preferred profile; rotation deferred). Identity never lives here (`TEN-1`, `INV-01`) |
| `SH1–SH5` | Sharing contract | Quellight UI renders the same objects the agent reasons over; inspection/correction/deletion are user-visible operations (§7.1, `QLT-012`) |
| `E1–E7` | Epistemic types | Quellight Shared World record typing (§5.2, §8); no auto-`E2` promotion (`QLT-004`) |
| `MS1–MS6` | Memory split | §5.1 — Mastra owns transient/replaceable caches; `MS2–MS6` are Quellight projections over `C1`; durable living-model state resolves to `C1` |
| `SYNC` | Synchronization state | **Deferred beyond the bounded minimum** as a full computation; the minimum keeps the relationship record truthful through inspectable history only (§7.2 exclusions) |
| `L0–L5` | Authority hierarchy | Quellight constitution records the hierarchy; `L2` contents belong to the user alone; amendment is explicit and versioned (`INV-15`, `QLT-010`) |
| `B1–B6` | Canonical build order | Stage 07 covers the `B1`+`B2` equivalent (shared-world store + minimal inspector parity + kernel persistence) plus the consumer/conversation minimum; `B3` (event-activated runtime) starts at `Q3`; see §9 (roadmap-stage mapping) |

This mapping is additive: it assigns homes; it does not redefine any
canonical meaning.

---

## 5. Corrected memory and identity model

This section is the normative ownership reconciliation required by the
rebaseline. It amends every earlier statement that contradicts it
(§5.5) and binds the Mastra/ARA ownership matrix (amendment §3, §8) to
the canonical invariants `TEN-1`, `TEN-2`, `P02`, `P03`, `P04`, `P18`,
`INV-01`, `INV-02`.

### 5.1 The single durable truth

```text
Mastra memory   — raw conversation transcripts, in-flight working memory,
                  and replaceable/rebuildable reasoning or retrieval caches.
Quellight C1    — every durable partnership-material fact, interpretation,
                  commitment, open loop, relationship state, authority
                  record, and learned procedure.
VICT stores     — what the software executed: runs, attempts, effects,
                  approvals, stream milestones, audit events. Operational
                  truth, never semantic Shared World.
```

Normative rules:

1. **Mastra MAY own** raw conversation transcripts (messages), working
   memory in flight, and rebuildable caches (semantic-recall state,
   working-memory templates, observational-memory artifacts if ever
   enabled). These are conversation machinery (`MS1` transient state and
   caches), and they are governed by the MSTR-011 retention/deletion
   machinery already Verified.
2. **Mastra memory MUST NOT become Quellight's canonical identity or a
   second durable semantic reality** (`INV-02`). If a partnership-material
   meaning exists only in a Mastra thread, that is a defect: it must be
   resolved into `C1` or it does not exist as product meaning.
3. **Every durable partnership-material record resolves to Quellight's
   Shared World (`C1`)**: facts, self-reports, interpretations,
   hypotheses the partnership will act on, commitments, open loops,
   relationship state, authority records, and learned procedures
   (`MS4`-class procedural learning included, per v1.3 §6.4).
4. **`MS2–MS6` and all durable living-model state are rebuildable from
   `C1`.** This is the standing proof that no second durable reality
   exists, and it is what makes restart and model-swap recovery work
   without transcript archaeology (`P18`).
5. **VICT `agentProfileVersion` identifies a pinned executable agent
   configuration** (profile schema, instructions revision, model
   profile, policies, adapter versions). It is **not** Quellight's
   persistent personal identity. Quellight's identity continuity lives
   in `C1`, its constitution, and its durable records — never in an
   agent profile hash (`TEN-1`, `INV-01`, `P18`).
6. **VICT operational events record what the software executed.** Run
   records, tool milestones, approvals, and audit events are operational
   history with safe summaries. They are **not** themselves Quellight's
   semantic Shared World; partnership meaning first-class lives in `C1`
   and only references operational facts by correlation ID.
7. **Quellight Shared World writes cross typed, governed VICT
   capabilities.** The conversation path never writes the Shared World
   store directly: each consequential write is a VICT capability with a
   declared contract and effect class, enforced through the same
   authorization path as every other caller (`AI-006`, `SEC-002`,
   `APP-010`). This is the enforced `C2b` interface.
8. **A new Mastra thread with no prior transcript MUST still recover
   relevant continuity from `C1`.** Context assembly draws from the
   Shared World (thread, commitments, open loops, corrections) — not
   from transcript retrieval. Losing or rotating Mastra threads loses
   conversation machinery, never the partnership (`P06`, `P18`,
   `QLT-008`).

### 5.2 Epistemic discipline of the boundary

- A user utterance is **data**, not automatically a fact about the
  world: it is recorded with its truthful epistemic type. A statement
  about the user's own experience or intention is an `E2` self-report
  (privileged within its domain); a statement about external reality is
  recorded as a claim requiring evidence (`E1`/`E3` discipline); the
  agent's readings are `E4–E7` and never silently promoted (`INV-05`,
  `P04`, `P05`).
- Turning conversation into **consequential durable meaning** — a
  commitment, a standing interpretation, a relationship-state change —
  is always an explicit, user-confirmed operation (§7.1, `OQ2`,
  `QLT-005`), never a silent side effect of chat.

### 5.3 Identity model summary

| Object | What it identifies | Is it Quellight's identity? |
| --- | --- | --- |
| `agentProfileVersion` | One pinned executable agent configuration | **No** — executable identity only |
| Activation/agent-run IDs | One pinned execution context | No — operational identity |
| Mastra thread/resource IDs | One conversation-machinery scope | No — replaceable context |
| Quellight Shared World + constitution + durable records | The persistent partner | **Yes** — the only identity that survives model, thread, and process replacement |

### 5.4 Why the tool bridge is the right gate for Shared World writes

The Verified Stage 06 bridge already provides exactly what `C2b`
requires: envelope-derived tools only, authoritative VICT contract
validation, effect/approval policy, durable intent before effect,
exactly-once fenced settlement, sanitized results, and no self-approval.
Quellight's Shared World capabilities (create/update commitment, record
correction, add open loop, apply retention action) are ordinary VICT
capabilities in the agent's pinned envelope; the deterministic VICT gate
— not the model — decides permission (`INV-16`). Proposal/confirmation
ceremony (`OQ2`) is additionally enforced at the product layer: the
model may only propose; the confirming write capability carries the
user's explicit confirmation as a validated input.

### 5.5 Amended statements

The following earlier statements are corrected by this section (the
underlying documents carry dated notes where their bodies are
historical):

- Mastra/ARA amendment §3 ownership matrix row "Conversation memory →
  Mastra" and §8's "Mastra owns agent memory" are **narrowed**: Mastra
  owns conversation machinery and caches only; durable
  partnership-material meaning is Quellight `C1` (this §5). The
  historical rows remain true for what they said — transcripts and
  agent-internal context — and are superseded wherever they could be
  read as making Mastra memory durable product meaning.
- Reference §20 (ARA reference application) and §20.2's
  "conversation and memory" framing described a chat-oriented assistant
  target; the Stage 07 product target is the persistent-partner minimum
  in §7, and §20 is superseded for Stage 07 purposes by this document
  (historical ARA identity and evidence unchanged).
- Any reading of `MSTR-001`'s "conversation memory … VICT MUST NOT
  rebuild" as placing durable product memory in Mastra is corrected:
  VICT and Quellight do not rebuild Mastra's conversation-memory
  machinery; Quellight's Shared World is product domain state (the
  amendment's own "Domain resources → VICT Application Layer" row
  already owned product records — it now definitively includes
  partnership-material meaning).

---

## 6. Shared World record and storage decision

### 6.1 What the minimum Shared World must hold

| Record family | Minimum content |
| --- | --- |
| Threads | Durable concerns with states (active/waiting/dormant/resolved per v1.3 §5.4); conversations contribute to threads but are never identical to them (`P06`) |
| Claims / evidence | Epistemically typed records (`E1–E7` tiered grounded/derived/working) with provenance (source utterance/observation/correction), timestamps, and honesty states (`H-*`) |
| Commitments | Standing intentions with normative force; created only by explicit confirmation; persist until explicitly released; distinct from open loops (`P10`, `OQ2`) |
| Open loops | Unresolved pending actions / undecided questions / expected events, attached to threads, with the four canonical exits (resolved, superseded, abandoned, transformed) (`P07`, `INV-06`) |
| Correction lineage | Append-only old belief → correction → current state chains; history never overwritten (`INV-10`) |
| Retention metadata | Per-record retention state under an explicit, inspectable, user-correctable policy; tombstones for user-requested removal; expiry; dependency re-evaluation on removal (`INV-17`, §12.2) |

### 6.2 Inspected storage reality (evidence, not documentation)

The generic application-data machinery was inspected at source, not
inferred from documentation:

- `packages/application/src/data.ts` (`@victframework/application`): the
  `ApplicationDataAdapter` port exposes per-resource `list`/`get` with
  **equality-only filters**, substring search, sort, limit/offset, and
  projection; mutations are **single-record** create/update/delete or a
  declared domain verb with contract-validated input and a keyed
  idempotency reconciler. There is **no multi-record transaction
  operation, no relationship/join query, no append-only or lineage
  semantics, no dependency graph, no retention/tombstone concept, and
  no projection-rebuild hook** at the port.
- `packages/appdata-sqlite` (`@victframework/appdata-sqlite`): a production SQLite
  adapter of that flat port — real `BEGIN IMMEDIATE` transactions, keyed
  idempotency recorded in the same transaction as the row, separate
  application-domain migrations (`vict_appdata_migrations`). Its
  guarantees are exactly the port's guarantees; it does not add
  semantic-lineage machinery.

### 6.3 Decision: Quellight-owned Shared World store; no premature VICT extraction

**Decision:** Stage 07 uses a **Quellight-owned Shared World store and
port inside the Quellight repository**, implemented as a
Quellight-owned SQLite adapter, exposed through VICT Application Layer
bindings only where structured surfaces need them. The generic
`@victframework/application` data port is **not** the Shared World and is not
stretched to fake it. A generic VICT abstraction (e.g. a "semantic
domain store" package) is **explicitly deferred** until real consumer
evidence from at least Quellight's use demonstrates the reusable
semantics — the same evidence-first discipline as `ARCH-015`, `ECO-005`
and the renderer decision (`OPEN-011`).

Rationale, requirement by requirement:

| Shared World need | Generic adapter verdict |
| --- | --- |
| Append-only correction lineage | Not expressible: mutations replace rows; no lineage chains. **Quellight store** |
| Atomic semantic updates (commitment + generated open loop + thread touch as one durable fact) | Port is single-record per mutation; no multi-record domain transaction. **Quellight store** (SQLite transactions with domain-level atomicity) |
| Provenance and evidence relationships | No joins/relationships at the port. **Quellight store** (typed references between records) |
| Dependency invalidation (ghost-derivative prevention, `INV-17`) | No dependency graph or re-evaluation hook. **Quellight store** |
| Retention / tombstone behavior | No retention states or tombstones. **Quellight store** (per-record retention under the user-inspectable policy) |
| Projection rebuilding (`MS2–MS6`) | No rebuild semantics; projections are Quellight product logic over the Quellight store |

Boundary consequences:

- Quellight's Shared World is **application-domain state** in the VICT
  sense (`DATA-013`, `APP-009` discipline): its store, schema,
  migrations, and retention are Quellight-owned and kept structurally
  separate from VICT operational stores and from Mastra storage. The
  four-domain storage map (amendment §8) becomes **five**: VICT
  operational, VICT application-domain (generic structured surfaces),
  Quellight Shared World, Mastra memory, Mastra observability — joined
  by correlation IDs, with no claimed cross-store atomicity
  (`AI-008` unchanged).
- Structured surfaces that merely display Shared World objects may bind
  through the Application Layer's typed data/action boundaries; the
  conversation path's writes always cross VICT capabilities (§5.4).
- If a second real consumer later needs the same semantic-store
  semantics, extraction into VICT becomes an evidence-backed
  architecture change under `GOV-005` — not before.

---

## 7. Exact minimum scope and exclusions

### 7.1 The Minimum Workable Quellight — what Stage 07 must deliver

1. **A separate Quellight repository** consuming immutable, pinned VICT
   release artifacts through the mechanism Stage 07A builds (§2.2; handoff
   work items 3–5):
   no source copies, no mutable-relative imports, lockfile-pinned
   exact versions, one compatible release set.
2. **One real model-provider profile with protected credential
   resolution** (`OQ4`): a pinned provider/model profile in the
   `agentProfileVersion` discipline; credentials resolved only through
   the Verified protected-credential port; credentials never in tests,
   stores, streams, traces, or diagnostics (`SEC-003`, `AI-004`).
3. **Streaming conversation and persistent thread handling:** the
   Verified `vict.agent-stream@1` resumable SSE path in real use;
   thread create/rename/archive/delete/search as product resources;
   markdown/code rendering with the renderer's accessible defaults.
4. **Restart and reconnect recovery:** cursor reconnect against
   authoritative turn state and process-restart reconciliation — the
   Verified Stage 06 semantics exercised for real (`F5`-class recovery),
   plus Shared World continuity (a restart loses no commitment, loop,
   or correction).
5. **A minimal Shared World containing threads; epistemically typed
   claims/evidence; commitments; open loops; correction lineage; and
   retention metadata** — the record families of §6.1, in the
   Quellight-owned store of §6.3.
6. **Explicit proposal/confirmation before consequential durable
   meaning** (`OQ2`, `QLT-005`): the agent proposes; a user-visible
   confirmation creates the commitment/standing record. Silent
   promotion of conversation into durable meaning is prohibited.
7. **Context assembly from the relevant Shared World thread,
   commitments and open loops** — not from transcript retrieval; a
   fresh thread recovers relevant continuity from `C1` (`QLT-008`).
8. **User-visible inspection, correction and deletion** of Shared
   World objects: the 1:1 contract (`SH1–SH5`, `P02`) at product
   minimum — the user can open what the agent reasons over, correct
   with lineage, and delete under the retention policy.
9. **A conversation-first workspace with visible shared-world objects**
   (`OQ1`): the primary surface is the conversation; commitments, open
   loops, threads and corrections render as inspectable objects beside
   it (minimal inspector parity — the canonical `B1` rule that user-side
   parity exists from day one, `P02`).
10. **VICT-governed internal read/write capabilities** for the Shared
    World (§5.4): the only write path, with contracts, effects, and
    approval policy where warranted.
11. **Real-use retention, deletion, export and credential-leakage
    proof required by `MSTR-012`:** retention/pruning/deletion/export
    exercised end to end with real data; store files not web-accessible;
    secret canaries absent from every retained and observable surface;
    informed-user retention disclosure; documented backup/recovery
    limitations.
12. **Responsive, accessible baseline UI:** responsive desktop/tablet/
    mobile layout, keyboard accessibility and screen-reader semantics
    on the baseline flows, using the Verified renderer defaults — the
    Stage 05 accessibility discipline applied to Quellight's surfaces.
13. **Deterministic offline verification plus a small bounded
    live-provider proof:** all invariants and the first vertical (§8)
    verifiable offline against the deterministic fixture; one small,
    explicitly-bounded live-provider scenario proving the real provider
    path end to end (never in the standard test suite; never with
    committed credentials).

The central product claim these items prove: **Quellight persists
durable partnership meaning in a user-inspectable shared world that
survives restarts, thread loss, and model replacement — and it refuses
to turn conversation into consequential durable meaning without the
user's explicit confirmation.** That is the persistent-partner claim,
not the chatbot claim.

### 7.2 Explicit exclusions (deferred; mapped to §9 milestones)

The following are **outside** the Minimum Workable Quellight. Their
absence is a design statement; the minimum must not violate canonical
invariants merely because they are missing:

- Autonomous background cognitive cycles; the loop's non-conversation
  activation sources (event/time/ingestion/reflection activation).
- Full `D1–D5` initiative exposure and `ESC` interruption behavior
  (conversation-embedded surfacing only).
- Full `G1–G5` external delegation (no external execute/decide rungs;
  `OQ5`).
- Email, calendar, device, and third-party ingestion (no `C2a` sources).
- Complete `SYNC` computation (the minimum keeps inspectable history;
  the full synchronization-state structure with scoped sub-states and
  alignment fields is later-milestone).
- Automatic pattern learning and full `A1–A5` adaptation (no `A3`–`A5`;
  no learned-procedure writes from ordinary experience).
- Broad evidence dependency propagation beyond the bounded minimum
  (dependency re-evaluation is implemented for the first vertical's
  correction/removal paths, not as a general inference engine).
- Full provider-rotation/fallback policy and model-swap certification
  (one pinned profile; the version-upgrade harness exists and is used
  on change, but rotation policy is deferred).
- Voice (and with it `OPEN-018`'s second transport).
- Multi-user, multi-process, multi-tenant, or protected-cloud claims
  (`MSTR-012` envelope unchanged).
- Builder Agent in the conversation path (`AGNT-007`).

Nothing in the exclusions list may be implemented by silent shortcut
inside the minimum: e.g. "no ingestion" must not be implemented as an
ungated file reader; "no full SYNC" must not produce false alignment
claims in the UI.

---

## 8. Canonical first vertical

The primary Stage 07 product proof is the end-to-end acceptance
scenario built on:

> "I will not leave my current job without a clear pathway and
> established base."

This single scenario exercises the epistemic, commitment, continuity,
conflict, correction, retention, and recovery semantics of the minimum.
Its verified behavior:

1. **Truthful epistemic standing.** The statement is represented only
   with the standing it truthfully has: an `E2` self-report of the
   user's intention (privileged within its domain), linked to the
   career thread. It is **not** automatically promoted into a verified
   fact or an automatic commitment — not every user utterance is an
   `E2`-grade durable self-truth, and nothing durable happens without
   ceremony.
2. **Proposal, not silent creation.** Quellight proposes a commitment
   ("hold: do not leave the current job without a clear pathway and an
   established base") as a user-visible proposal object. No
   commitment record exists yet.
3. **Confirmation creates commitment + open loop.** On explicit user
   confirmation, one durable operation creates the commitment record
   **and** the related open loop — "determine whether a stable base
   exists" — atomically, attached to the career thread, with
   provenance pointing at the confirming operation (not at the raw
   transcript).
4. **Both records visible and inspectable.** The commitment and open
   loop render as shared-world objects in the workspace: current
   state, provenance, epistemic type, retention state.
5. **Cross-conversation recovery from `C1`.** In a later, separate
   conversation (new Mastra thread, no prior transcript), context
   assembly recovers the commitment and open loop from the Shared
   World — verified without depending on transcript retrieval (e.g.,
   transcript absent/pruned; thread fresh; continuity intact).
6. **Conflict identification with challenge permitted (`P12`).** When
   the user later proposes a decision that conflicts with the
   commitment (e.g., "let's plan my exit for next month"), Quellight
   identifies the conflict against the standing commitment and **may
   challenge rather than merely harmonize** — it surfaces the
   commitment's provenance and asks, it does not silently comply nor
   silently drop the commitment.
7. **Execution vs explicit amendment (`INV-15`).** Quellight
   distinguishes ordinary execution under the standing commitment from
   an explicit plan/commitment amendment: "help me update my
   portfolio while I stay" executes under the hierarchy; "I've decided
   to leave regardless" is recognized as a candidate amendment and the
   agent asks whether to release/revise the commitment — a versioned
   amendment record, never a silent overwrite.
8. **Correction preserves lineage.** A user correction ("that's wrong
   — the base is already established") records old belief →
   correction → current state as an append-only, timestamped chain;
   dependent open loops are re-evaluated (the "stable base" loop is
   resolved or re-derived explicitly, visibly).
9. **Restart does not lose continuity.** A process restart (real
   SIGKILL-class fixture) preserves threads, commitments, open loops,
   corrections, and conversation state; the product resumes with the
   same durable meaning and honest turn state.
10. **Deletion/expiry truthfulness.** Deleted or expired material no
    longer influences assembled context: context assembly excludes
    removed content, tombstones preserve the fact of removal without
    content where lineage requires it, and dependency re-evaluation
    removes ghost derivatives — all per the minimum retention policy
    (§12.2), with the lineage of the removal itself inspectable.

Verification form: the scenario's invariant core (epistemic typing,
ceremony, atomic commitment+loop creation, recovery from `C1`,
lineage, retention/tombstone behavior, restart continuity) is proven
**offline and deterministically** against the Verified offline model
fixture; the **bounded live-provider proof** repeats a representative
subset (statement → proposal → confirmation → recovery → conflict
identification) against the real pinned provider. Both forms are
Stage 07 exit-gate evidence.

---

## 9. Q0–Q5 vertical/horizontal roadmap

Interleaved vertical/horizontal milestones. VICT Stage 07 covers only
the bounded minimum required to establish **Q0/Q1** and a usable
product baseline; Q2–Q5 remain Quellight's later product roadmap
unless direct analysis proves a specific item indispensable to the
minimum invariant (currently: none).

### Q0 — Consumer and product-composition proof

- **User-visible vertical:** a Quellight application skeleton, in its
  own repository, built and running against published VICT release
  artifacts: structured shell (routes, navigation, theme, safe
  states) from an Application Definition; one conversation screen
  island wired to the VICT server boundary with the offline
  deterministic model.
- **Required horizontal semantics:** the release/consumer mechanism
  (handoff, work items 3–5); immutable compatible release-set identity; clean-clone
  install; CI proof outside the monorepo; H-1 `__proto__` hardening
  and verifier-banner hygiene (handoff, work items 1–2); protected
  configuration foundations (credentials external, env-derived).
- **Canonical IDs exercised:** `TEN-1`, `P02` (minimal), `INV-16`
  (gate present), `B1` groundwork.
- **Explicit exclusions:** no durable meaning yet; no live provider
  requirement at this milestone; no retention semantics.
- **Exit proof:** clean Quellight clone installs pinned artifacts,
  typechecks, builds, renders the composition, and passes a minimal
  runtime/renderer composition check entirely outside the VICT
  monorepo.

### Q1 — Minimum persistent continuity

- **User-visible vertical:** streaming conversation with persistent
  threads; commitments and open loops proposed and confirmed in
  conversation; visible shared-world objects; restart-proof
  continuity; inspection/correction/deletion. The §8 first vertical
  passes offline.
- **Required horizontal semantics:** the Quellight Shared World store
  (§6.3) with typed records, atomic ceremony writes via VICT
  capabilities, context assembly from `C1`, correction lineage,
  minimal retention/tombstone machinery; live-provider profile with
  protected credentials; `MSTR-012` real-use data-protection proof.
- **Canonical IDs exercised:** `P02`–`P07`, `P10`, `P13`, `P14`,
  `P17`, `P18`, `INV-01`, `INV-02`, `INV-05`–`INV-07`, `INV-10`,
  `INV-17`, `SH1–SH5` (minimum), `E1–E7`, `H-*`, `F5`, `B1`–`B2`
  equivalent.
- **Explicit exclusions:** §7.2 list in full.
- **Exit proof:** §13 exit gate (Stage 07). This is where "Minimum
  Workable Quellight" is complete and honestly named.

### Q2 — Truthful decision partnership

- **User-visible vertical:** standing interpretations with honest
  disagreement; the agent challenges with evidence (`P12`) beyond the
  first vertical's single path; explicit mission/plan layers (`L3`/
  `L4`) with visible precedence and amendment operations.
- **Required horizontal semantics:** deeper epistemic machinery
  (patterns/hypotheses with evidence dependency), amendment records
  for all standing layers, correction propagation to derived records.
- **Canonical IDs exercised:** `P05`, `P12`, `INV-15` in full,
  `L2–L5` operations, `A4`.
- **Exclusions:** still no autonomous initiative; no ingestion.
- **Exit proof:** an amendment-vs-execution suite plus a
  disagreement-representable scenario pass offline and in real use.

### Q3 — Event activation and calibrated initiative

- **User-visible vertical:** the partner notices: time- and
  workspace-triggered surfacing (deadline pull on open loops),
  delivered through calibrated `D1–D3` exposure with a conservative
  interruption budget.
- **Required horizontal semantics:** the event-activated loop runtime
  (canonical `B3`) with the deterministic gate enforced from day one;
  `SYNC` structure begins (scoped sub-states, `known_misalignments`,
  repair records); initiative-exposure calibration policy (`OQ3`
  decided with numbers).
- **Canonical IDs exercised:** `P08`, `P14` fully, `P16`, `INV-13`,
  `D1–D3`, `ESC` (bounded), `F2`/`F3`.
- **Exclusions:** no external delegation yet; no ingestion sources
  beyond what Q3's own design adds.
- **Exit proof:** event-activation fixtures; exposure-calibration
  evidence; interruption-budget telemetry.

### Q4 — Bounded external delegation

- **User-visible vertical:** scoped external actions (e.g., calendar)
  under explicit `G3`/`G4` grants with approval cards, revocation,
  and rollback discipline.
- **Required horizontal semantics:** ingestion sources through `C2a`
  ingress integrity; outbound connectors as governed capabilities;
  delegation-ladder ceremonies; before/after/rollback records
  (`F4`).
- **Canonical IDs exercised:** `P09`, `P15`, `INV-07`, `INV-14`,
  `G1–G4` (G5 by explicit ceremony only), `C2a`.
- **Exclusions:** `G5` decide-rung default remains off (`OQ5`
  loosening is an explicit owner decision).
- **Exit proof:** end-to-end delegated execution with approval,
  revocation, and rollback fixtures.

### Q5 — Adaptation, retention propagation, substrate portability

- **User-visible vertical:** the partnership visibly improves how it
  works (procedural learning with inspectable records), retention
  propagates through dependencies at policy scale, and a model swap
  is a rehearsed non-event.
- **Required horizontal semantics:** `A3`–`A5` machinery with lawful
  speeds; full dependency propagation and retention aggregation;
  full `SYNC` computation; rehydration drills (`B6`); provider
  rotation/fallback policy and model-swap certification.
- **Canonical IDs exercised:** `P11`, `P16` full, `INV-09`,
  `INV-11`, `A1–A5`, `F1–F5` full taxonomy.
- **Exclusions:** the agent still never versions its own
  constitution; multi-tenant/cloud remains Stage 11-VICT territory.
- **Exit proof:** adaptation-boundary conformance, dependency-
  propagation audits, and a forced model-swap rehydration drill.

### Roadmap-stage mapping

| Milestone | VICT stage vehicle | Repository |
| --- | --- | --- |
| Q0 | Stage 07A (handoff) + Quellight repo bootstrap | VICT + Quellight |
| Q1 | Stage 07 (remainder) — the Minimum Workable Quellight | Quellight (+ VICT fixes as gaps expose them) |
| Q2–Q5 | Quellight product roadmap (each re-enters VICT governance when VICT-side work is needed) | Quellight-led |

---

## 10. Requirement traceability

### 10.1 Compatibility strategy for historical ARA identifiers

- **Preserved:** every historical `ARA-*` requirement and all ARA
  evidence (reports, audits, the 13-event offline "ARA proof") keep
  their identifiers, statuses, and meaning. No `ARA-*` row is renamed,
  repurposed, or re-statused by this amendment.
- **Introduced:** new Quellight product semantics use a fresh `QLT-*`
  family (§10.3). `QLT-*` IDs are unique across the reference; there is
  no collision with `ARA-*`, `AI-*`, `MSTR-*`, `APP-*`, or any other
  family.
- **Supersession is explicit, never silent:** where a Quellight rule
  supersedes a historical future-facing framing (e.g., "Stage 7 = the
  complete assistant product"), the superseding rule is recorded here
  and the superseded framing carries a dated note in its document.
  Supersession changes **targets**, never historical **evidence**.
- **Status hygiene:** no requirement is simultaneously Planned and
  Verified; all `QLT-*` requirements are **Planned**; no Stage 01–06
  Verified status changes. Historical ARA product rows
  (`ARA-001..ARA-008`, `AI-013`) that pointed at the old Stage 7
  product target now carry an explicit mapping note to their `QLT-*`
  successors (§10.4) while remaining historically intact.

### 10.2 Cross-family VICT requirements Quellight exercises

| Family | IDs exercised by the minimum |
| --- | --- |
| Security | `SEC-001..SEC-004`, `SEC-006` |
| Data/retention | `DATA-004..DATA-008`, `DATA-013`, `DATA-014` |
| Control | `CTRL-001..CTRL-007` |
| Product-agent | `AI-001..AI-012`, `AI-014`, `AI-015`; Stage 07 concerns `MSTR-009`, `MSTR-012` become Q1 exit obligations |
| Application | `APP-001..APP-016` (plus `APP-017` as the real-consumer obligation) |
| Agent separation | `AGNT-005..AGNT-008` |
| Interfaces/API | `API-002`, `API-003`, `API-005` |
| Environment | `DEP-001`, `DEP-002`, `DEP-004`; `ARCH-012` (now given a real consumer), `PRD-006` |

### 10.3 Canonical-to-VICT/QLT mapping (required minimum map)

| Canonical structure | Maps to |
| --- | --- |
| `P01–P18` | Quellight constitution + product rules; enforced jointly by VICT gates (hard regime) and Quellight loop policy (semantic regime). Individual bindings: `P02`/`P03`/`P04` → `QLT-003`, `QLT-004`, `QLT-012`; `P05` → `QLT-004`; `P06`/`P07` → `QLT-006`, `QLT-008`; `P09` → `QLT-013`; `P10` → `QLT-005`; `P12` → `QLT-009`; `P13`/`P14` → `QLT-011`, `QLT-019`; `P17` → `QLT-007`, `QLT-019`; `P15`/`P16`/`P08`/`P11` → deferred scope (§7.2, §9) |
| `C1–C9` | §4 ownership table |
| `INV-01`–`INV-17` | `INV-01` → `QLT-014`; `INV-02` → `QLT-003`; `INV-05` → `QLT-004`; `INV-06` → `QLT-006`; `INV-07` → `QLT-013`; `INV-10` → `QLT-007`; `INV-15` → `QLT-010`; `INV-16` → §5.4; `INV-17` → `QLT-011`, `QLT-019`; `INV-03`, `INV-04`, `INV-08`, `INV-09`, `INV-11`–`INV-14` bind unchanged as product law where the minimum operates |
| `SH`, `E`, `MS`, `L`, `H`, `F` structures | `SH1–SH5` → `QLT-012`; `E1–E7` → `QLT-004`; `MS1–MS6` → §5.1; `L0–L5` → `QLT-010` + Quellight constitution; `H-*` → `QLT-004`; `F1–F5` → §8/§9 (`F5` in Q1, full taxonomy Q5) |
| `G`, `D`, `A`, `S` | `G1–G5` → deferred (`OQ5`; Q4); `D1–D5`+`ESC` → deferred (`OQ3`; Q3); `A1–A5` → deferred beyond A1/A2 (Q5); `S1–S7` → conversation-activated loop in the minimum (Q3 adds event activation) |
| Existing VICT families | §10.2 table; `ARA-*` per §10.4 |

### 10.4 Historical ARA product rows — explicit mapping

These historical rows keep their IDs, maturity, and delivery statuses.
Their future-facing **product target** is succeeded by `QLT-*` as
follows (the rows themselves are annotated by reference, not edited
into contradiction):

| Historical row | Successor binding |
| --- | --- |
| `ARA-001` (real consuming application) | `QLT-001`, `QLT-002` |
| `ARA-002` (no Builder Agent in conversation) | `QLT-015` exclusions (`AGNT-007` unchanged) |
| `ARA-004` (deterministic offline fixtures) | `QLT-018` offline verification form |
| `ARA-005` (per-boundary latency reporting) | Quellight reporting obligation at Q1 exit evidence |
| `ARA-006` (first proving ground for packs) | Quellight roadmap (Q2+; unchanged in kind) |
| `ARA-007` (first real Application Layer product proof) | `QLT-001` + `APP-017` |
| `ARA-008` / `AI-013` (complete user-facing assistant per amendment §11) | `QLT-001`..`QLT-020` — the §11 full-product specification becomes Quellight's long-term target; Stage 07 delivers the §7 minimum, not all of §11 |
| `ARA-003` (meaningful graph boundaries) | Unchanged; binds Quellight durable orchestration |

### 10.5 New QLT requirements (all Planned)

| ID | Requirement | Maturity | Delivery |
| --- | --- | --- | --- |
| QLT-001 | Quellight MUST exist as a separate product repository and external consumer of released VICT packages; VICT MUST NOT contain Quellight product code; historical ARA identity and evidence MUST remain intact. | Accepted | Planned |
| QLT-002 | Quellight MUST consume VICT only as immutable, pinned release artifacts with lockfile integrity, one compatible release set, and recorded Node/runtime support; no source copies, no mutable-main resolution. | Accepted | Planned |
| QLT-003 | Every durable partnership-material record (fact, interpretation, commitment, open loop, relationship state, authority record, learned procedure) MUST resolve to Quellight's Shared World; Mastra memory MUST NOT become canonical identity or a second durable semantic reality (`INV-02`). | Invariant | Planned |
| QLT-004 | Every Shared World claim MUST carry its truthful epistemic type (`E1–E7`) and honesty state (`H-*`); user utterances MUST NOT be automatically promoted into durable self-truths (`INV-05`, `P04`, `P05`). | Invariant | Planned |
| QLT-005 | Commitments MUST be created only through explicit user confirmation of a visible proposal; commitments MUST remain distinct from the open loops they generate (`P10`, `OQ2`). | Invariant | Planned |
| QLT-006 | Open loops MUST persist until resolved, superseded, abandoned, or transformed; "nothing is pending" MUST be a positive verifiable claim (`P07`, `INV-06`). | Invariant | Planned |
| QLT-007 | Every correction MUST record append-only lineage (old belief → correction → current state) and MUST re-evaluate dependent open loops and commitments (`INV-10`). | Invariant | Planned |
| QLT-008 | Context assembly MUST draw from the Shared World (thread, commitments, open loops, corrections); a fresh conversation thread with no transcript MUST still recover relevant continuity from `C1` (`P06`, `P18`). | Invariant | Planned |
| QLT-009 | When a proposed decision conflicts with a standing commitment, Quellight MUST identify the conflict against the commitment's provenance and MAY challenge rather than harmonize (`P12`). | Accepted | Planned |
| QLT-010 | Quellight MUST distinguish ordinary execution under standing layers from explicit, versioned amendment operations; an ambiguous instruction MUST trigger an explicit clarification (`INV-15`). | Invariant | Planned |
| QLT-011 | Context assembly MUST exclude deleted or expired material; removal MUST follow the retention policy with truthful tombstones and dependency re-evaluation — no ghost derivatives (`INV-17`). | Invariant | Planned |
| QLT-012 | The user MUST be able to inspect, correct, and delete Shared World objects through the product (`SH1–SH5`, `P02`); user-side parity with agent-visible durable meaning MUST exist from first delivery. | Invariant | Planned |
| QLT-013 | All Shared World writes from the conversation path MUST cross typed, governed VICT capabilities (authority, contract, effect, approval policy); direct store writes from the conversation path are prohibited (`P09`, `AI-006`). | Invariant | Planned |
| QLT-014 | VICT `agentProfileVersion` MUST be treated as pinned executable agent configuration only; Quellight's persistent identity MUST live in its Shared World, constitution, and durable records — never in an agent profile, thread, or model (`TEN-1`, `INV-01`, `P18`). | Invariant | Planned |
| QLT-015 | Stage 07 MUST deliver exactly the Minimum Workable Quellight scope (§7.1) and MUST NOT claim any §7.2 deferred capability; a deferred capability's absence MUST NOT violate a canonical invariant. | Accepted | Planned |
| QLT-016 | The minimum MUST operate with exactly one pinned provider/model profile whose credentials resolve only through the protected credential boundary and never enter tests, stores, streams, traces, or diagnostics (`OQ4`, `SEC-003`). | Accepted | Planned |
| QLT-017 | Before Quellight is called usable for real cases, `MSTR-012` MUST be proven in real use: retention, deletion, export, and pruning end to end; non-web-accessible stores; absent secret canaries; credentials external to stored data; informed-user retention disclosure; documented backup/recovery limitations. | Invariant | Planned |
| QLT-018 | The canonical first vertical (§8) MUST pass offline deterministically, with a bounded live-provider subset, as the primary Stage 07 product proof. | Accepted | Planned |
| QLT-019 | The minimum MUST carry an explicit, inspectable, user-correctable retention policy with per-record retention metadata; user-requested removal MUST be honored as a visible operation with content-free tombstones where lineage requires (`P14`, `P17`, `INV-17`). | Invariant | Planned |
| QLT-020 | Stage 07 scope MUST be governed by the Q0–Q5 roadmap (§9); Q2–Q5 items MUST NOT enter Stage 07 unless proven indispensable to the minimum invariant. | Accepted | Planned |

---

## 11. Open constitutional decisions (`OQ1–OQ6`)

The canonical open questions are addressed with three distinct
categories. **Decided product scope** is what Stage 07 builds (an
architecture/owner-ratified product decision, recorded here). **Proposed
constitutional defaults** are launch positions this amendment proposes;
they bind the minimum but remain owner-ratifiable. **Still-open owner
decisions** require the constitutional owner and are not fabricated as
decided.

| ID | Category | Recorded position |
| --- | --- | --- |
| `OQ1` Frontend form | Decided product scope (minimum) | **Conversation-first workspace with visible objects** — conversation is the primary surface; commitments, loops, threads, and corrections render as inspectable objects beside it (§7.1 item 9). The canonical alternatives (document space / task space) remain possible later-evolution answers. |
| `OQ2` Commitment ceremony | Proposed constitutional default (binding for the minimum) | **Explicit confirmation.** The agent may only propose; a commitment exists only after a user-visible confirmation operation. Repeated behavior does NOT auto-create commitments; formal grants are not commitments. Stricter or looser future ceremonies are owner decisions. |
| `OQ3` Interruption budget | Proposed constitutional default (binding for the minimum) | **No autonomous interruption in the minimum.** Proactive surfacing and `ESC` behavior are deferred to Q3; the minimum never interrupts unprompted. The numeric budget is a still-open owner decision for Q3. |
| `OQ4` Substrate policy | Proposed constitutional default (binding for the minimum) | **One pinned preferred provider/model profile; fallback rotation deferred.** Rehydration discipline is exercised on profile change via the Verified upgrade-harness path rather than live rotation. Rotation policy remains an owner decision. |
| `OQ5` Delegation defaults | Proposed constitutional default (binding for the minimum) | **No default external execute/decide authority.** The minimum grants no `G4`/`G5` rungs; stronger rungs remain absent or explicitly off until Q4 ceremonies exist. Loosening later is an explicit owner act; tightening after looseness is famously hard. |
| `OQ6` Constitutional custody | Identified proposal — **not decided, not recorded as approved** | The proposed launch custodian is the **VICT product owner (the repository owner governing this architecture)**, acting as constitutional owner for Quellight's constitution, with the proposed ceremony: a versioned, signed, user-visible constitution record in `C1` whose every change is a versioned, attributed amendment. **No constitutional-owner approval has occurred.** This amendment does not record `OQ6` as resolved; the owner must ratify custody and the ceremony before any Quellight constitution version claims validity. Until ratification, the Quellight constitution is a Proposed record and MUST be labeled as such in-product. |

---

## 12. Security and retention boundaries

### 12.1 Security boundary (inherited and extended)

- **Inherited Verified machinery:** authenticated actor boundary with
  default-deny scopes below HTTP/CLI (`SEC-001`, `SEC-002`); protected
  credential resolution with canary-proven isolation (`SEC-003`,
  `AI-004`); human/policy approval for high-impact effects (`SEC-004`);
  prompt-injection containment — conversation content, memory, and tool
  outputs are untrusted data that cannot widen authority (`AI-014`);
  no privileged Mastra routes (`AI-015`); hostile-envelope containment
  and the delivery-safe snapshot boundary (Stage 06, post-H-1).
- **Stage 07 obligations:** the H-1 audit Low N-1 (own `__proto__`
  delivery-snapshot keys) MUST be corrected in Stage 07A **before** any
  live-provider or real-Quellight claim (handoff, work item 1); the live
  provider must sanitize provider errors at the model boundary (the
  `VICT_OFFLINE_MODEL_FAILED` pattern of Stage 06A §11); and the
  `MSTR-012` canary/leakage matrix is re-run with real-provider data.
- **Quellight-specific surfaces:** the Shared World store inherits the
  protected-store placement discipline (outside publicly served
  directories; owner-only permissions; POSIX-proven, Windows ACL
  documented best-effort) and the governed deletion/export machinery
  pattern (durable intent, receipts, cross-store reconciliation).

### 12.2 Retention boundary (minimum policy)

- Every Shared World record carries retention metadata under an
  explicit, inspectable, user-correctable policy (minimum states:
  currently-relevant, retained-for-lineage, expired, user-removed —
  the canonical richer taxonomy is the policy's later evolution).
- **User-requested removal takes precedence over ordinary lineage
  retention:** honored as a visible operation; where lineage must
  remain, only a content-free tombstone remains (`INV-17`).
- Removal/expiry triggers dependency re-evaluation of derived records
  that cited the removed evidence — no ghost derivatives — with the
  changes themselves visible and lineage-preserving.
- Mastra-side conversation machinery retains its Verified retention
  bounds, executed pruning, governed deletion (with cross-store
  reconciliation where the same conversation is deleted), and export
  disclosure (`MSTR-011`), now proven in real use (`MSTR-012`,
  `QLT-017`).
- No cross-store atomicity is claimed between Shared World, Mastra,
  and VICT operational stores; consistency claims are bounded by the
  documented reconciliation rules (VICT-authoritative view on
  disagreement, per amendment §4).

---

## 13. Stage 07 exit gate

Stage 07 is one formal architectural stage (reference §23), delivered
in increments. **Stage 07A** is the first, VICT-side increment with
its own handoff and gate (handoff, Exit gate). The **Stage 07 product exit
gate** (subsequent increments in VICT + the Quellight repository):
the Minimum Workable Quellight is achieved when ALL of:

1. The Quellight repository exists and installs, typechecks, builds,
   and runs from a clean clone against pinned VICT release artifacts,
   proven entirely outside the VICT monorepo (Stage 07A gate carried
   forward).
2. One real provider profile operates end to end with protected
   credentials; the offline deterministic path remains the
   verification backbone (no credentials in any test or store).
3. Streaming conversation, thread handling, reconnect, and restart
   recovery work in real use (Verified Stage 06 semantics exercised
   live, plus Shared World continuity).
4. The minimal Shared World (§6.1) exists in the Quellight-owned
   store, with epistemic typing, ceremony-gated commitment creation,
   lineage, and retention metadata.
5. Context assembly demonstrably draws from `C1` — the §8 vertical's
   cross-conversation recovery proof passes with transcripts absent.
6. The complete §8 first vertical passes: offline deterministically,
   plus the bounded live-provider subset.
7. Inspection, correction (with lineage), and deletion (with
   tombstones and dependency re-evaluation) work from the product UI.
8. `MSTR-012` real-use proofs pass: retention/pruning/deletion/export
   end to end; non-web-accessible stores; absent secret canaries on
   every retained and observable surface; credentials external to
   stored data; informed-user retention disclosure; documented
   backup/recovery limitations.
9. The UI is responsive and accessible on the baseline flows with the
   Stage 05 accessibility discipline (real-browser and axe evidence).
10. No §7.2 deferred capability is claimed; product language uses
    Quellight; historical ARA evidence remains intact; `OQ6` is
    recorded as open/ratification-pending, not decided.
11. Independent product, architecture, security, and
    accessibility audits pass.

Until every item is independently evidenced, Stage 07 is In Progress
and no Quellight capability may be described as Verified.

---

## 14. Genuine risks and limitations

- **First external consumer risk.** Stage 07A is the first time `@victframework/*`
  packages are consumed outside the monorepo. Missing exports,
  workspace-relative assumptions, or packaging gaps will surface; the
  handoff's clean-consumer verification exists precisely to find them
  before the Quellight repository depends on them. Scope discipline is
  required: Stage 07A fixes consumption, it does not redesign packages.
- **Live-provider nondeterminism.** Every proof that matters is
  offline-deterministic; the live-provider proof is bounded and
  representative. Model-behavior variance (proposal phrasing,
  challenge quality) is a product-quality risk, not an invariant risk:
  the invariants are enforced by VICT gates and store semantics, not by
  model virtue. This is the load-bearing reason for §5.4 and `OQ2`.
- **Semantic enforcement is partly deliberative.** `L3–L5` precedence,
  conflict identification, and amendment recognition are mandatory
  loop policy — semantic interpretation, per `INV-16` — and can be
  wrong in ways booleans cannot. The mitigation is lineage: every such
  judgment is a visible, correctable record.
- **The minimum is not the vision.** Without autonomous cycles,
  ingestion, delegation, or full SYNC, Quellight at Q1 is a persistent,
  honest, inspectable partner that acts only in conversation. This is
  the truthful claim; product language must not drift into implying
  the full v1.3 architecture is delivered.
- **Model-swap portability is designed but not yet drilled.** `P18`
  rehydration is structurally supported (identity in `C1`, projections
  rebuildable) but the forced-swap drill is Q5; until then, provider
  changes ride the profile-version path only.
- **`OQ6` is unresolved.** Until the owner ratifies custody and the
  ceremony, the Quellight constitution is Proposed; if ratification
  never occurs, product claims must remain at "proposed constitution."
- **Single-process envelope.** All continuity claims hold only within
  the declared local-first, single-actor, single-process, file-backed
  envelope (`MSTR-012`); any multi-process or hosted future is a new
  architecture decision, not an extension.

---

*End of the Stage 07 Quellight rebaseline amendment. Stage 06 remains
formally closed; Stage 07 is rebaselined, permitted, and **In Progress**;
Stage 07A — the consumer foundation — is verified with non-blocking issues
and formally closed (2026-09-09, reference v0.4.2, §0.13 of the system
reference); **Stage 07B is PERMITTED and NOT BEGUN**; the Quellight product
repository has not been created; no Quellight product capability exists.*
