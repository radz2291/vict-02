# VICT — Stage 07C Handoff: Quellight Shared World Meaning and Confirmation Ceremony

> **Reference:** `docs/VICT-SYSTEM-REFERENCE.md` v0.4.7 at issuance; registered as
> **v0.4.8 (§0.17)** by the same documentation commit that records this handoff.
> **Product repository (read-only for this specification; implementation target of
> Stage 07C):** `C:/Users/RZ1/Desktop/RZ/260909-VCT-Quellight` ↔
> `https://github.com/radz2291/Quellight` — evidence point verified at issuance:
> `HEAD == origin/main == f25b03a322868b37c9fee732a767d91d3ab63f98`, tracked tree
> clean.
> **Framework repository:** `C:/Users/RZ1/Desktop/RZ/260831-VCT-02` — `origin/main`
> at handoff issuance: `1fd98060254bd4789cdb559b7952d414d6b51a6b`
> (`docs(stage-07b): formally close Quellight consumer bootstrap`; fetch-verified
> `HEAD == origin/main`; no conflicting Stage 07C work exists anywhere in either
> repository's history).
> **Verified baseline:** Stage 07B — Quellight Consumer Bootstrap and Live
> Conversation Foundation — is implemented, independently re-verified
> (`VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE PERMITTED`, re-verification
> at Quellight commit `1e0c0f53…`), and FORMALLY CLOSED (reference v0.4.7, §0.16).
> Stages 1–6 and 07A remain independently verified and formally closed. The
> governing Stage 07 architecture is
> `docs/architecture/STAGE-07-QUELLIGHT-MINIMUM-WORKABLE-PRODUCT.md` (canonical
> input `The-Persistent-Cognitive-Partner-Agent-Context-v1.3-CANONICAL.md`,
> SHA-256 `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331`
> re-verified read-only at this handoff's evidence point).
> **Immutable release identities in force:** Quellight is pinned to
> `vict-release-set@1/0.1.0` (content ID
> `v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d`); the
> published `vict-release-set@1/0.1.1` (content ID
> `v1_e31e8dd60d05e1d6feb08b5ed0874cceae561bdf10e08d8b93e07840de8d9cdf`) is live
> but NOT adopted by Quellight.
> **Status:** Stage 07C is PERMITTED — SPECIFIED (HANDOFF ISSUED) — EFFECTFUL
> IMPLEMENTATION NOT BEGUN. The Stage 07C entry gate (reference §0.16.3) REMAINS
> BINDING: no Shared World proposal, confirmation ceremony, correction,
> commitment, open loop, or other durable meaning write may be implemented until
> the F-8 resolution recorded here (§5–§6: the minimal generic VICT correction,
> path 3) is implemented, independently verified, released as a new immutable
> package set, and adopted by Quellight through a controlled compatibility
> change (§13, Phase F → Phase Q). This handoff itself changes no code, no
> manifest, no release identity, and no historical record; the implementer MUST
> NOT mark its own work Verified; Stage 07D and 07E MUST NOT begin.

---

## 1. Objective and product outcome

One bounded outcome: **Quellight begins behaving like a persistent cognitive
partner** — its conversation can produce durable, user-confirmed Shared World
meaning — without pretending that transcripts are memory and without pretending
that the agent may silently decide what is true.

When Stage 07C is complete, a real local Quellight application can:

1. persist **durable Shared World meaning** in the Quellight-owned store
   (`C1`): epistemic claims, commitments, open loops, correction lineage, and
   the proposal/confirmation ceremony records that govern them — each with
   provenance, retention metadata, and versioned identity;
2. let the **agent propose** meaning during conversation (drafted proposals,
   epistemic claims, candidate commitments and open loops, corrections) through
   governed VICT capabilities — the first real exercise of the Verified tool
   bridge for Shared World writes;
3. require the **user's explicit decision** before any proposal becomes
   canonical: confirm, reject, amend, or withdraw — a visible, idempotent,
   crash-safe ceremony, never a silent side effect of chat, streaming,
   display, or persistence;
4. represent **epistemic claims** with their truthful type (`E1–E7`), honesty
   state, uncertainty, and source provenance — never as unqualified "facts";
5. keep **commitments and open loops** as distinct durable record families with
   the canonical exits;
6. record **correction lineage** as append-only history — the original record
   stays attributable; nothing is silently overwritten;
7. assemble **conversation context from confirmed Shared World material only**
   — a fresh thread with no transcript still recovers relevant continuity from
   `C1`, and what was used is inspectable;
8. give the **user inspection** of every Shared World object the agent reasons
   over (minimal inspector parity, canonical `B1`);
9. route **every effectful write** across a governed, attributable, idempotent
   VICT boundary — the corrected released `app.data.mutate` command surface
   (§6) for user-initiated writes, the Verified tool bridge for agent-side
   proposal writes — with direct-route writes and undeclared effects
   structurally impossible (§12).

```text
Stage 07C delivers the minimum truthful Shared World meaning vertical and
its confirmation ceremony.
Stage 07C does NOT deliver: retention enforcement (tombstone policy engine,
export, dependency re-evaluation at policy scale), the MSTR-012 real-use
proof, conflict identification and amendment-vs-execution semantics beyond
the bounded ceremony, transcript-derived continuity claims, autonomous
initiative, ingestion, delegation, learning, or any Stage 07 exit-gate
closure (§7.2, §18).
```

## 2. Normative inputs (read completely before implementing)

1. `docs/VICT-SYSTEM-REFERENCE.md` v0.4.8 (registered at issuance of this
   handoff) — §0.11–§0.17, §5, §6, §7, §12, §15.3, §16, §17, §21, §23 (Stage 7),
   §24, §26, §27.
2. `docs/architecture/STAGE-07-QUELLIGHT-MINIMUM-WORKABLE-PRODUCT.md` — the
   authoritative Stage 07 design: product identity (§2), readiness matrix (§3),
   ownership mapping (§4), memory/identity model (§5), Shared World storage
   decision (§6), exact minimum scope and exclusions (§7), first vertical (§8),
   Q0–Q5 roadmap (§9), QLT requirements (§10), OQ1–OQ6 (§11),
   security/retention boundaries (§12), Stage 07 exit gate (§13).
3. `docs/handoff/VICT-STAGE-07B-QUELLIGHT-CONSUMER-BOOTSTRAP-HANDOFF.md` and
   the Stage 07B reports (Quellight-side: implementation report, independent
   verification, remediation, re-verification, formal closure) — the consumed
   conversation foundation and the `/api/act` accommodation's exact recorded
   scope (Quellight audit §12, decision register D-4/D-8).
4. `docs/RELEASE-COMPATIBILITY.md` — release-set identity, exact pins, install/
   rollback/integrity rules, publication order, supported runtimes.
5. `docs/handoff/VICT-STAGE-07A-QUELLIGHT-CONSUMER-FOUNDATION-HANDOFF.md` and
   the Stage 07A reports (implementation, independent verification, formal
   closure) — the release/consumer mechanism and its evidence chain.
6. The canonical Quellight input
   `The-Persistent-Cognitive-Partner-Agent-Context-v1.3-CANONICAL.md`
   (SHA-256 `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331`)
   — §5.2 (SH1–SH5), §5.3 (E1–E7), §5.4 (threads), §5.5 (commitments, `P10`),
   §5.6 (open loops, `INV-06`), §6 (constitution and `OQ6`), §10 (invariants
   `INV-05`, `INV-06`, `INV-10`, `INV-15`, `INV-17`), §15 (open questions).
   Where the canonical document and this handoff disagree about meaning, the
   canonical document wins; this handoff makes no constitutional change.
7. Released public package surface (Quellight currently installs
   `@victframework/*@0.1.0`): `@victframework/server`
   (`createVictHttpServer`, `VictCommandService`, `VICT_COMMANDS`,
   `remoteQuery`/`remoteMutate`/`remoteAction`), `@victframework/application`
   (`ApplicationDataAdapter`, `ApplicationDataRequestContext`,
   `ApplicationDataMutationRequest`, `compileApplication`, `./testing`
   conformance fixtures), `@victframework/sdk` (`defineApplication`,
   `defineResource`, action/contract declaration fields), `@victframework/mastra`
   (`MastraProductAgent`, tool bridge, offline fixture), `@victframework/runtime`
   (operator config, actor context), `@victframework/contracts`,
   `@victframework/control`, `@victframework/store-sqlite`,
   `@victframework/renderer-svelte`, `@victframework/scaffolder`,
   `@victframework/cli`.
8. Quellight source, read-only (at the evidence SHA above): `src/lib/server/
   composition.ts` (the fail-closed `app.data.mutate` wiring),
   `src/lib/server/application-server.ts` (the `/api/act` dispatch), `src/lib/
   application/definition.ts` (thread resource and declared mutations),
   `src/lib/sharedworld/*` (port, SQLite adapter, migrations), `src/routes/
   api/act/+server.ts`, `docs/decision-register.md` (D-4, D-8), `docs/
   system-reference.md`, `docs/database.md`.

## 3. Fixed product decisions (preserved — do not reopen)

* Product: **Quellight**, not ARA; separate repository; external consumer;
  VICT never contains Quellight (`QLT-001`).
* Consumption: immutable, pinned release artifacts only; no source copies, no
  mutable-main resolution, no local VICT checkout dependency (`QLT-002`).
* Canonical namespace `@victframework/*`; YAML is optional notation and is
  neither required nor sufficient for conformance (`GOV-007`).
* The Shared World store is **Quellight-owned** (`shared-world.db`, own
  versioned migrations); conversation persistence is NOT Shared World
  continuity (`QLT-003`); no VICT extraction without consumer evidence (§6.3 of
  the Stage 07 architecture).
* One pinned provider profile; no rotation or fallback (`OQ4`); no autonomous
  interruption (`OQ3`); no default external authority (`OQ5`).
* **OQ2 (commitment ceremony): explicit confirmation — binding.** The agent may
  only propose; a commitment exists only after a user-visible confirmation
  operation. Stage 07C implements the ceremony; it does not loosen it.
* **OQ6 (constitutional custody) remains UNRATIFIED.** §11 of this handoff
  presents a recommended authority model and ONE precise owner decision; it
  does NOT record `OQ6` as decided. No Quellight constitution material is
  created in Stage 07C; if constitution-like material arises it stays Proposed
  and labeled as such.
* The declared deployment envelope is unchanged: local-first, single actor,
  single application process, non-multi-tenant, file-backed (`MSTR-012`
  declaration; its real-use proof is Stage 07D).
* No YAML authoring is introduced; the authoritative representation remains
  the typed Application Definition plus the compiled plan.

## 4. Phase 1 — F-8 source analysis (the entry gate)

The entry gate (reference §0.16.3) requires the handoff to resolve F-8 — the
released `app.data.mutate` payload gap — through one of the three authorized
paths. This section reproduces the limitation from source, independently.

### 4.1 The exact definition and invocation contracts

The released application-action surface has three layers. The **definition
layer and the data port are complete; the transport layer is the defect.**

1. **Authoring ABI (`@victframework/sdk`).** A mutation action is declared
   with `kind: 'mutation'`, `id`, `revision`, `resourceId`,
   `inputContractId?`, `inputContractRevision?`, `outputContractId?`,
   `outputContractRevision?`, and `op` — the declared mutation operation
   (`packages/sdk/src/application.ts`; `ResourceMutation` carries `op`,
   `effect`, `inputContractId`, `outputContractId`, `idempotency?: 'keyed'`,
   `permissions`). The typed authoring surface for action input already
   exists.
2. **Compiled plan (`@victframework/application`).** `compileApplication`
   emits immutable plans whose `actions[actionId]` entries preserve
   `kind`, `op`, `resourceId`, and the declared contract references for
   mutation actions (closed field sets per action kind in
   `packages/application/src/compile.ts`). The compiled-plan representation of
   typed action input already exists.
3. **Data port (`@victframework/application`, `src/data.ts`).**
   `ApplicationDataMutationRequest` is
   `{ resourceId, op, input?, id?, idempotencyKey? }` — the adapter port
   carries the operation id, the target identity, the typed input, and the
   keyed idempotency key. The runtime invocation target already exists and
   validates input against the resource's or mutation's declared contract,
   with keyed in-transaction idempotency (`DATA-014`).
4. **Transport layer (`@victframework/server`) — the released gap.** The
   command registry (Stage 06B, `packages/server/src/commands.ts`) declares a
   CLOSED payload field set for `app.data.mutate` and `app.data.action`:

   ```text
   'app.data.mutate': { scope: 'app.data.write', mutation: true,
     fields: ['resourceId', 'releaseVersion', 'expectedRevision', 'actionKind'] }
   ```

   `#assertPayloadFields` throws
   `VICT_COMMAND_PAYLOAD_INVALID` ("The command payload declares an unknown
   field for 'app.data.mutate'") for any field outside that set — so a caller
   cannot even declare `op`, `input`, `id`, or `idempotencyKey` on the payload.
   The HTTP routes `/vict/v1/app/mutate` and `/vict/v1/app/actions` map to
   `app.data.mutate` (`packages/server/src/http.ts`), so no released HTTP
   command path can carry mutation input either.

### 4.2 Where mutation input is lost

Two independent structural barriers, verified by probe (§4.2.1):

1. **Command payload closed-field check** — `op`/`input`/`id` are unknown
   fields; the payload fails closed before dispatch. There is NO released
   field in which a consumer may place mutation input.
2. **`remoteMutate` field list** — even for a payload that passed the schema
   check, `remoteMutate` (Stage 06B, `packages/server/src/app-remote.ts`)
   constructs the adapter request from a FIXED list —

   ```ts
   return await options.data.mutate({
     kind: 'mutate', resourceId, releaseVersion,
     actorId: actor.actorId, expectedRevision, actionKind,
   });
   ```

   — and has no parameter through which `op`, `input`, `id`, or
   `idempotencyKey` could reach the adapter. The caller's mutation payload is
   silently dropped between the command layer and the data port.

   Note also the shape mismatch on the forwarded request: the released
   `remoteMutate` forwards `kind`/`actionKind` envelope fields, while the
   conforming `ApplicationDataMutationRequest` port expects `op`/`input`/`id`/
   `idempotencyKey` — the adapter request the transport builds is not the
   port's mutation request at all.

#### 4.2.1 Independent reproduction (temporary probe; removed after the run)

A temporary probe against the workspace's built package output — byte-identical
to the released tree for these surfaces (verified: `git diff 7e5908e… HEAD` over
`packages/server/src/app-remote.ts`, `packages/server/src/commands.ts`, and
`packages/application/src/data.ts` is EMPTY) — produced four results:

```text
P1  remoteMutate(caller input carrying op/id/idempotencyKey/input)
    → adapter received EXACTLY
      {"kind":"mutate","resourceId":"qlt.threads","releaseVersion":"release-1",
       "actorId":"probe-actor","expectedRevision":"0","actionKind":"mutation"}
    → mutation input fields carried: NONE  ⇒ input lost at the transport layer
P2  remoteAction(actionKind:'mutation') → delegates to the same identity-only
    request ⇒ no released action path carries a payload either
P3  VictCommandService.dispatch(app.data.mutate payload carrying op/input)
    → rejected: VICT_COMMAND_PAYLOAD_INVALID — "unknown field for
      'app.data.mutate'" ⇒ input cannot even be declared at the command layer
P4  the identity-only payload (resourceId/releaseVersion/expectedRevision/
    actionKind) passes the closed-field check ⇒ the closed set is exactly
    those four fields; op/input are not among them
```

This matches and extends the Quellight Stage 07B audit's released-source
disposition (audit §12; decision register D-4), including the composed
fail-closed negative control (`QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED`).

### 4.3 `remoteMutate` trace

```text
browser/UI → /vict proxy (token injection, byte pass-through)
→ POST /vict/v1/app/mutate  (or /vict/v1/app/actions → same command)
→ command 'app.data.mutate'
→ captureCommandEnvelope → canonicalPlainPayload → #assertPayloadFields
   [BARRIER 1: op/input/id/idempotencyKey are unknown fields → fail closed]
→ assertCommandScope('app.data.write') → durable idempotency claim/lease
→ #execute → requireAppData(...).mutate(actor, payload)
→ remoteMutate(actor, options, payload)
   [BARRIER 2: constructs the adapter request from a fixed field list;
    no op/input/id/idempotencyKey parameter exists]
→ adapter.mutate({kind:'mutate', resourceId, releaseVersion, actorId,
                  expectedRevision, actionKind})   ← NOT a conforming
                  ApplicationDataMutationRequest
→ a conforming adapter (e.g. @victframework/appdata-sqlite, or Quellight's
  Shared World adapter) has no mutation input to validate or store
```

### 4.4 Affected public packages

| Package | Affected released surface | Effect |
| --- | --- | --- |
| `@victframework/server` | `app.data.mutate`/`app.data.action` closed payload field sets (command registry); `remoteMutate`; `remoteAction` (mutation delegation); HTTP routes `/vict/v1/app/mutate`, `/vict/v1/app/actions` | The command boundary structurally cannot carry mutation input. |
| `@victframework/application` | `ApplicationDataMutationRequest` port (NOT deficient — it already carries `op`/`input`/`id`/`idempotencyKey`); compiled-plan action declarations (NOT deficient — `inputContractId`/`op` already declared) | No correction required in the port or the plan for the data boundary; the transport must be made to speak the port's request shape. |
| `@victframework/sdk` | Action/contract authoring fields (NOT deficient) | No change required for the data-action correction. |
| `@victframework/cli` | No `app.data.*` command surface exists | Unaffected. |
| `@victframework/contracts` | Command envelopes are validated server-side (captureClosedRecord/canonicalPlainPayload), not in contracts | Unaffected. |

### 4.5 Does VICT 0.1.1 change the result?

**No.** The `0.1.1` coordinated set carries only the navigation-group-order
renderer correction (reference v0.4.5, v0.4.6). The F-8-relevant surfaces are
byte-identical between the `0.1.0` release source (`7e5908e…`) and the current
release tree (`HEAD`), verified by git diff (empty) — so the limitation is
identical in both published sets, and a released-boundary proof (path 1) fails
against every published set.

### 4.6 Missing generic facility vs Quellight-specific semantics

F-8 is NOT a Quellight-specific gap. The compiled plan already declares typed
action input (`op` + `inputContractId`) for mutation actions, and the data
port already consumes typed mutation requests; the only missing piece is a
**generic application-action facility at the transport layer**: the released
command boundary cannot carry a typed, closed, validated mutation/action input
from a caller to the declared data boundary. That is framework scope
(Appendix C of the reference: it "defines stable framework-neutral application,
resource, action … meaning shared by multiple products" and "protects an
effect, authority, identity, or durability boundary"). Quellight's Shared World
schemas, ceremony, epistemics, lineage, retention, and context assembly remain
entirely Quellight-owned product semantics (§7) and MUST NOT enter generic VICT
packages (§5, §12).

## 5. Architecture decision — the three authorized paths

### 5.1 Path 1 — existing released public VICT boundary: FAILS (evidence)

§4 proves both barriers: the closed payload schema rejects mutation input
(`VICT_COMMAND_PAYLOAD_INVALID`), and `remoteMutate` cannot forward it. The
capability/run action kind is likewise unavailable (`remoteAction` throws
`VICT_APPDATA_ACTION_UNAVAILABLE`; no released composition supplies capability
handlers on the application-action boundary). Every published release set
(0.1.0, 0.1.1) has the identical limitation. Path 1 is NOT available.

### 5.2 Path 2 — registered consumer capability extension: REJECTED

Path 2 (a formally defined, registered, governed consumer capability extension
providing the required input and effect boundary) is rejected because:

1. **No released extension point exists.** The released application-action
   boundary has no registered consumer-extension mechanism (§4.4): building
   one would itself be a VICT change — with strictly MORE surface than the
   minimal correction, because it would add a new extension concept to the
   framework, not merely carry typed input across the existing declared
   boundary.
2. **Second effect path.** A consumer-registered extension that parallels the
   released command boundary creates a second, product-flavored write path
   beside the governed one — precisely the shape GOV-007 forbids ("a consumer
   MUST NOT recreate, shadow, bypass, or silently replace VICT-owned
   semantics").
3. **Consumer portability.** A Quellight-registered extension could not be
   consumed by any other application; the generic need (typed action input
   through the declared Application Layer boundary) is framework-shaped
   (§4.6).
4. **Audit discipline.** An unproven custom effect boundary is treated as
   blocking by GOV-007 regardless of whether the application appears to work.

### 5.3 Path 3 — minimal generic VICT correction + new immutable release: SELECTED

The handoff's architecture decision is **path 3**, per the entry gate's third
authorized form:

```text
VICT is corrected (smallest generic change),
independently verified,
released as a NEW immutable coordinated package set,
and Quellight adopts that exact set through a controlled compatibility change.
```

Justification against the governing criteria:

| Criterion | How path 3 satisfies it |
| --- | --- |
| GOV-007 (VICT semantic authority) | The correction repairs VICT's OWN released semantics (the declared Application Layer action boundary) so the governed command path can carry what its own data port already defines. No consumer-side semantics are invented; the released boundary remains the single effect path. |
| Compatibility | Strictly additive: the new payload member is optional; payloads without it behave byte-identically to today (§6.12); the data port and compiled plan are unchanged; emitted declarations gain only additive types. |
| Security | The correction NARROWS the effective gap: today typed input can only cross ad-hoc consumer paths; after the correction it crosses the closed, idempotent, scope-checked, release-bound, canonical-data-validated command boundary with size/depth/prototype bounds (§6.7–§6.10). |
| Exactly-once effects | The existing durable command idempotency machinery (claim → lease → fenced settlement) governs mutation commands; the mutation envelope ties the adapter's keyed domain idempotency to the command key (§6.9). One command dispatch ⇒ at most one effect. |
| Consumer portability | Any consumer of the Application Layer can carry typed action input through the same released boundary; no Quellight-specific field, verb, or semantics exists anywhere in VICT. |
| Framework scope discipline | The change passes the compact architecture test (§4.6): it defines stable framework-neutral action meaning and protects an effect/authority boundary; no Shared World concept enters VICT. |
| Evidence-first discipline | The correction is demanded by a real consumer finding (D-4, audit §12, F-8), not speculation — the same trigger pattern as the v0.4.4 navigation correction. |

### 5.4 The prohibited path (restated)

```text
UI or ordinary product route
→ custom mutation shortcut
→ direct durable write
```

is FORBIDDEN as the Stage 07C write architecture. The existing Stage 07B
`/api/act` accommodation (Quellight audit §12; decision register D-4) remains
the recorded, fail-closed-labeled Stage 07B behavior for the thread record
family ONLY: it is frozen at its 07B scope, no Stage 07C action is added to it,
and the Stage 07C conformance gates (§12.3) fail if any Shared World meaning
write (proposal, ceremony transition, claim, commitment, open loop, correction)
crosses `/api/act` instead of the governed VICT boundary. Its migration out of
the write path is part of the Quellight adoption work package (§13, WP-Q2).

## 6. The required VICT correction — input-boundary design (Phase F specification)

This section specifies the correction precisely enough for a separate
implementation-and-audit task (Phase F, §13). The correction is
**transport-level and generic**; it introduces no product semantics.

### 6.1 Affected public contracts and packages

| Package | Change |
| --- | --- |
| `@victframework/server` | Command registry: the `app.data.mutate` and `app.data.action` closed payload field sets gain the optional closed fields `actionId`, `expectedActionRevision`, and `mutation` (the mutation envelope). `remoteMutate` gains the typed input path (§6.3–§6.4) and forwards the conforming `ApplicationDataMutationRequest` shape. `remoteAction` keeps delegating mutation-kind actions to `remoteMutate`. |
| `@victframework/application` | NO semantic change. The existing `ApplicationDataMutationRequest` port, `ApplicationDataRequestContext`, and compiled-plan action fields are the contract the transport now speaks. Additive: exported type for the composed input-contract resolver (§6.5) MAY live here; if added, it is additive-only. |
| `@victframework/sdk` | No change (authoring ABI already declares `op`/`inputContractId`). |
| All 13 packages | Bump together as one coordinated release set (exact internal pins), per `docs/RELEASE-COMPATIBILITY.md`. |

### 6.2 Typed authoring ABI (unchanged, referenced)

No authoring-schema change is required: a mutation action already declares
`op`, `inputContractId`, `inputContractRevision`, `outputContractId`,
`outputContractRevision`, `effect`, `idempotency?: 'keyed'`, and
`permissions` on the resource's mutations. The correction makes the released
command transport carry input for such declared actions; it does not widen the
definition vocabulary.

### 6.3 Compiled-plan representation (unchanged, consumed)

The compiled plan remains the closed action inventory. The server composition
MUST resolve every `actionId` it accepts against a composed compiled plan; the
plan's declared `op`, `resourceId`, `inputContractId`, and contract revisions
are the authority for what the envelope may carry. A plan-resolving
composition MUST reject an `actionId` not present in the plan, a mismatched
`expectedActionRevision`, or an envelope `op` differing from the plan's
declared `op` (`VICT_APPDATA_ACTION_UNRESOLVED`).

### 6.4 Runtime invocation representation (the corrected payload)

```text
app.data.mutate / app.data.action — corrected closed payload field set:
  resourceId            (as today)
  releaseVersion        (as today; stale-release check unchanged)
  expectedRevision?     (as today; bounded string, default '0')
  actionKind            (as today; 'mutation' | 'query'; 'local' still denied)
  actionId?             (compiled-plan action identity; NEW, optional)
  expectedActionRevision? (stale-action guard; NEW, optional, bounded string)
  mutation?             (NEW closed mutation envelope; REQUIRED for typed
                         input, ABSENT for the legacy identity-only shape):
      op                (required when the envelope is present; must equal the
                         plan-declared op for the resolved actionId)
      id?               (target identity for update/delete/delete-class verbs)
      input?            (the typed mutation input; canonical plain data;
                         validated against the action's declared input
                         contract when a contract resolver is composed,
                         and always re-validated by the adapter)
      idempotencyKey?   (keyed-create domain key; §6.9)
```

Closed-field behavior: the payload's top-level field set AND the `mutation`
envelope's field set are both closed; any unknown field at either level fails
closed (`VICT_COMMAND_PAYLOAD_INVALID`) exactly as today. `query`-kind actions
are unchanged.

### 6.5 Action-specific input schema / validator ownership

* **Contract implementations are product-owned.** VICT never owns the meaning
  of a product's action input. The composition supplies an OPTIONAL
  input-contract resolver — `actionId → Contract` — built from the product's
  own contract implementations (the same neutral `Contract` protocol used
  everywhere; Quellight's `/api/act` composition already binds exactly such a
  map from its definition).
* **Validation at the server boundary (defense in depth, first fence):** when
  the composition supplies a resolver and the request resolves to an action
  with a declared `inputContractId`, `remoteMutate` parses `mutation.input`
  through that contract BEFORE forwarding; rejection →
  `VICT_APPDATA_INPUT_CONTRACT_REJECTED` (stable, non-echoing, paths only).
* **Validation at the adapter (authoritative, second fence):** the conforming
  adapter keeps its existing declared-contract validation
  (`ApplicationDataMutationRequest` → resource/mutation `inputContractId`).
  The correction never weakens either fence; a consumer that composes no
  resolver keeps exactly today's adapter-only behavior.
* The framework does NOT own product contracts and MUST NOT embed any
  Shared World schema.

### 6.6 Closed-field behavior

The envelope is a closed record: `op`, `id?`, `input?`, `idempotencyKey?` only.
`op` MUST be a bounded string (≤ 32 chars) matching the plan-declared verb;
`id` MUST be a bounded safe identifier; undeclared envelope fields, symbol
keys, inherited members, accessors, and exotic prototypes fail with the
existing envelope discipline (`captureClosedRecord` semantics extended to the
envelope).

### 6.7 Delivery-safe value constraints

`mutation.input` crosses as canonical plain data under the EXISTING
`canonicalPlainPayload` discipline (own enumerable string-keyed data only;
JSON scalars, plain objects, arrays; accessors, hostile proxies, non-finite
numbers, and excessive depth rejected). The corrected boundary MUST reuse that
single capture path — no second serialization form, no ambient mutable state,
no hidden side channel, and no `Record<string, unknown>` escape hatch: the
envelope is a closed, typed representation.

### 6.8 Prototype and special-key safety

Own `__proto__` keys in any own form at any depth inside `mutation.input` are
REJECTED with a dedicated closed reason (the Stage 07A N-1 discipline: a
specialized reason surfaced through the existing durable code family
`VICT_APPDATA_MUTATION_INPUT_INVALID`), consistent with the delivery-snapshot
`proto-field` precedent. Null-prototype containers without prohibited keys
remain accepted; `constructor`/`prototype` string keys remain plain own data.

### 6.9 Size, depth, and key bounds

* Depth: the existing envelope depth bound (8) applies to the whole payload
  including `mutation.input`.
* Size: the canonical serialized form of `mutation.input` MUST be bounded by a
  declared constant (recommended 64 KiB, ≤ the 256 KiB command body limit);
  exceeding it fails closed with a stable non-echoing code.
* Keys: bounded length (≤ 128 chars, consistent with the existing
  `bounded()` discipline); array lengths bounded (≤ 1,000 entries per level).
  Exact numeric constants are implementation-recorded, MUST be declared
  closed, and MUST have stable rejection codes.

### 6.10 Credential and secret non-persistence

The command layer MUST NOT echo rejected input values; failures carry codes
and bounded paths only (existing safe-failure discipline). VICT-side
operational records (command outcome, audit event, idempotency receipt) retain
identifiers, codes, sizes, and digests — never mutation input content. The
mutation input itself becomes product domain data ONLY inside the product's
own adapter/store under the product's retention policy (Quellight Shared World
disclosure; full retention enforcement is Stage 07D). Credential-shaped
canaries planted in operator configuration and actor material MUST remain
absent from every command digest, audit event, log, and error surface
(§14, N-C1).

### 6.11 Deterministic serialization

Canonicalization reuses the existing canonical JSON discipline: the command
digest (`vict.command@1` over the canonical payload) is deterministic for the
same logical request regardless of key insertion order; no timestamps, random
values, or function text enter the digest.

### 6.12 Backward compatibility

* Payloads WITHOUT `mutation` (the legacy identity-only shape) behave exactly
  as today: same closed-field acceptance, same adapter request shape, same
  outcomes — including the composed fail-closed behavior of consumers whose
  adapters require input. Existing definitions without input need no change.
* `app.data.query` is untouched.
* Emitted declaration compatibility: additive `.d.ts` surface only; no
  removed or retyped public members; `vict.command@1`-envelope consumers are
  unaffected; old consumers of the new set remain able to pin prior sets
  (§6.18).

### 6.13 Idempotency-key relationship and exactly-once effect boundary

* The command envelope's durable `idempotencyKey` governs the COMMAND effect:
  one namespaced claim (actor + command + key), durable lease, fenced
  settlement — a replayed command settles from the durable record and never
  re-executes (Stage 06B machinery, unchanged).
* For a keyed mutation (`idempotency: 'keyed'` on the declared resource
  mutation), the adapter's domain `idempotencyKey` MUST be derived
  deterministically from the command's durable idempotency key (single-key
  discipline: `domain key = command idempotency key`), recorded in the same
  transaction as the row (the reference adapter behavior). A retried or
  double-clicked command therefore produces exactly one durable effect at BOTH
  fences. A conflicting domain key with different canonical input fails with
  the existing `DATA_IDEMPOTENCY_CONFLICT` discipline.
* One dispatch ⇒ at most one adapter mutate; the mutation envelope MUST NOT
  introduce any second execution trigger (no implicit re-dispatch, no
  route-local retry).

### 6.14 Execution identity, user identity, and provenance

* The command actor (`actor.actorId`, server-derived, never client-supplied)
  remains the execution identity crossing into the adapter context.
* The payload gains `actionId` + optional `expectedActionRevision` (compiled
  plan identity). The composition resolves the action from its composed plan
  and fails closed on unknown/stale identity.
* Provenance recorded with every effectful mutation (audit event + command
  outcome): applicationId, releaseVersion, resourceId, actionId, action
  revision, declared inputContract id + revision, actorId, command
  idempotency-key digest, outcome code, and (product-side, in the domain row)
  the product-mapped author identities (e.g. `confirmedBy`). VICT records
  operational provenance; Shared World author semantics stay in Quellight's
  records (§7).
* Capability identity is NOT part of the data-action boundary in Stage 07C:
  agent-side proposal writes cross the Verified tool bridge (AI-006) where
  capability id/revision/input contract are already enforced; the data-action
  boundary carries the declared application action identity only. No
  `Record<string, unknown>` capability shortcut is introduced.

### 6.15 Audit-event requirements

Every effectful `app.data.mutate` dispatch (envelope present or not) MUST
continue to settle through the existing durable idempotency machinery and emit
the existing audit-event discipline; the corrected path adds the provenance
fields of §6.14 to that record. No new audit vocabulary beyond additive,
closed fields.

### 6.16 Browser/server separation

The browser reaches the command boundary only through the SvelteKit server-side
`/vict` proxy (token injection server-side; body ≤ 256 KiB upstream;
unbuffered SSE pass-through unchanged). The corrected mutation envelope is a
request-body field of the EXISTING command envelope — no new endpoint, no
second origin, no browser-held credential, no direct-to-adapter browser path.

### 6.17 Negative controls for the correction (Phase F must implement)

| # | Control | Expected |
| --- | --- | --- |
| VC-1 | Baseline reproduction: payload with `op`/`input` on the pre-correction boundary | `VICT_COMMAND_PAYLOAD_INVALID` (negative control at the defective baseline commit) |
| VC-2 | Post-correction: same payload with a valid closed envelope | exactly one adapter mutate carrying the conforming request shape; legacy identity-only shape byte-identical to today |
| VC-3 | Unknown envelope field / unknown top-level field | fail closed, non-echoing |
| VC-4 | Oversized input, over-deep input, hostile getter/proxy, own-`__proto__` key (scalar/object/depth), sparse array, function/symbol/BigInt/Date value | stable `VICT_COMMAND_PAYLOAD_INVALID` / `VICT_APPDATA_MUTATION_INPUT_INVALID` (proto specialization), zero content echo |
| VC-5 | Input contract mismatch (resolver composed) | `VICT_APPDATA_INPUT_CONTRACT_REJECTED`; no adapter call; command settled failed; replay of the same key does NOT re-execute |
| VC-6 | Unresolved actionId / stale expectedActionRevision / envelope op ≠ plan op | `VICT_APPDATA_ACTION_UNRESOLVED`; no effect |
| VC-7 | Unregistered capability kind on the data boundary | unchanged `VICT_APPDATA_ACTION_UNAVAILABLE` (no capability shortcut introduced) |
| VC-8 | Replay of the same command idempotency key with identical input | exactly one effect; first outcome replayed |
| VC-9 | Replay with a different payload under the same key | durable idempotency conflict discipline (no second effect) |
| VC-10 | Uncomposed adapter / uncomposed contract resolver | fail closed with stable codes; no silent success |
| VC-11 | Identity mismatch (actor without `app.data.write`) | `VICT_ACTOR_SCOPE_DENIED` |
| VC-12 | Legacy consumers: definitions and payloads without input across all three published-set behaviors | byte-identical behavior to the prior set |

### 6.18 Release-set and rollback requirements

* The correction ships as a NEW immutable coordinated release set — all 13
  `@victframework/*` packages at one exact new version with exact internal
  pins (per `docs/RELEASE-COMPATIBILITY.md`; no partial sets, no mixed pins).
* **Expected release sequence (recorded; NOT executed by this handoff):** the
  registry currently holds `0.1.0` and `0.1.1`; the repository manifests sit at
  `0.1.1`. The correction is an ADDITIVE public contract extension (a feature
  of the public command boundary), not a behavioral fix; the coherent next
  release identity is therefore **`vict-release-set@1/0.2.0`** — all 13
  packages at `0.1.2` would understate an additive contract change, and 0.x
  minor bumps are the established vehicle for additive-plus releases in this
  ecosystem. The implementing task MUST re-derive the next available version
  from the registry and manifests at implementation time and MUST NOT publish
  a version that exists; publication follows the recorded dependency-topological
  candidate-dist-tag procedure (§6 of RELEASE-COMPATIBILITY) with
  `verify:release-consumer -- --registry` green and a fresh-cache external
  consumer proof BEFORE `latest` advances.
* Rollback: consumers pin the prior immutable set (`0.1.0` for Quellight's
  current state, or `0.1.1`); nothing is ever unpublished, republished, or
  mutated. The correction MUST NOT alter any published artifact of `0.1.0`
  or `0.1.1`.
* The Quellight adoption (Phase Q) must record the adopted set identity
  (content ID recomputed) in its report and re-run the full consumer
  verification from a clean clone.

## 7. Stage 07C product boundary

### 7.1 Durable record families (Quellight-owned, additive migrations)

All families live in the Quellight-owned Shared World store
(`shared-world.db`, own versioned forward-only migrations — additive
`CREATE TABLE`/`ALTER TABLE` only, per the closed 07B foundation), behind the
same typed port discipline, with per-record retention metadata from day one
(`QLT-019` foundation) and with the Stage 07D retention machinery explicitly
NOT implemented yet. Stable identifiers below are the closed vocabulary of
this handoff; additions are additive migrations, never semantic overloads.

Common field discipline for every family:

```text
id                    — Quellight-owned stable identifier (QLT-prefixed, server-generated)
version               — monotonic integer per record (lineage increments)
status                — the family's closed lifecycle vocabulary (below)
provenance            — proposedBy | confirmedBy | correctedBy (identity mapping)
source                — source thread id + conversation correlation + turn reference
createdAtMs/updatedAtMs/effectiveAtMs — server clock
retentionState        — the closed 07B/07C vocabulary ('currently-relevant' default)
lineage               — explicit references (supersedes/supersedesBy/corrects/correctedBy)
```

| Family | Purpose | Closed lifecycle vocabulary | Key content structure | Uniqueness / idempotency |
| --- | --- | --- | --- | --- |
| `qlt_proposal` (ceremony record) | A drafted meaning the agent proposes; never canonical while pending | `proposed` → `awaiting_decision` → `confirmed` \| `rejected` \| `amended` \| `withdrawn` | proposal kind (claim/commitment/loop/correction), proposal content, proposedBy (agent identity + profile/turn correlation), proposedAt, decisionBy, decidedAt, source (thread/turn), links to created records on confirm | one open proposal per (thread, proposal kind, source turn) at a time; duplicate ceremony calls idempotent by command key |
| `qlt_claim` | Epistemic claim with type, uncertainty, provenance | `active` → `superseded` \| `retired` (Stage 07D adds expiry/removal states) | epistemicType (`E1–E7` closed), honestyState, confidence (bounded enum: `stated`/`qualified`/`uncertain` — never a bare unqualified "fact" field), statement, evidence refs, source utterance/turn ref | content-stable re-submission of the SAME proposal resolves to the same record (idempotent confirm) |
| `qlt_commitment` | Standing intention with normative force; distinct from loops | `active` → `released` \| `superseded` \| `amended` (Stage 07D adds released-by-retention) | statement, normative basis (the confirmed proposal id), thread link, amendment lineage | one active commitment per commitment key; creation ONLY via ceremony (§8) |
| `qlt_open_loop` | Unresolved pending action / question / expected event | `open` → `resolved` \| `superseded` \| `abandoned` \| `transformed` (canonical four exits, `INV-06`) | loopKind, subject, attached thread, exit reason, resolution provenance | "nothing is pending" remains a positive verifiable claim (`QLT-006` direction); the exits are exactly the canonical four |
| `qlt_correction` | Append-only lineage record (old → correction → current) | `recorded` (append-only; no state machine beyond explicit Stage 07D removal) | subject record ref, prior content ref (hash), correction content, reason, correctedBy, source | one correction per (subject, correction key); retry cannot create duplicate successors |
| `qlt_source_link` | Provenance link binding any Shared World record to its source (conversation turn/message, confirming operation, or prior record) | immutable link records | fromRecord, toKind (turn/message/proposal/record), toRef, relation | one link per (from, to, relation); append-only |
| retention metadata | Per-record retention state + timestamps (columns on every family table) | closed 07B/07C vocabulary (`currently-relevant` \| `user-removed`) — `expired`/tombstone semantics and dependency re-evaluation are Stage 07D | — | `user-removed` is set only by an explicit user operation (Stage 07D flow); 07C only preserves the columns and never blocks later deletion |

Validation and size bounds per family: statement/content bounded (≤ 4 KiB
canonical serialized content unless the implementing record documents a
different declared bound), title/label ≤ 200 chars, identifiers safe-pattern
bounded, enum fields closed-vocabulary, all timestamps server-clock integers.
Every family enforces closed field sets at its declared input contracts; size
bounds carry stable non-echoing product codes (`QLT_*`), consistent with the
07B port discipline.

Record versions: content changes create new versions or successors through the
correction path (§10); in-place mutation of a confirmed record's meaning is
prohibited. Transitions are the ONLY allowed state changes; unknown states are
structurally impossible (closed vocabularies, additive migrations only).

### 7.2 Explicit exclusions (do not build in Stage 07C)

The deferred full `D1–D5` initiative exposure and `ESC`; `G1–G5` external
delegation; autonomous learning (`A3–A5`), pattern learning, and ingestion
(`C2a`); broad evidence-dependency propagation and the general inference
engine; full `SYNC` computation; semantic retrieval/embedding recall;
multi-tenant or multi-process operation; the retention policy engine,
tombstones, export, and dependency re-evaluation (Stage 07D); the MSTR-012
real-use proof (Stage 07D); constitution material (`OQ6` unratified);
provider rotation; voice; any Stage 07 exit-gate claim.

### 7.3 Meaning and epistemic safety — the six distinctions

The agent may propose meaning but may never silently make it canonical. The
product MUST maintain and enforce exactly these distinctions:

```text
conversation transcript  — Mastra-owned conversation machinery; reasoning
                           context; NEVER durable meaning; never a context-
                           assembly source of record truth (§9)
proposal                 — an agent-drafted record in `qlt_proposal`, visible
                           and inspectable, epistemically inert: it asserts
                           nothing about the world
confirmed Shared World record — a claim/commitment/loop whose lifecycle
                           reached `confirmed`/`active`/`open` through the
                           user's explicit ceremony operation; the ONLY
                           material eligible for context assembly
superseded/corrected record — a former canonical record explicitly replaced
                           by a correction; excluded from context assembly;
                           fully attributable in lineage
rejected proposal        — a proposal the user declined; retained as history;
                           NEVER presented as established truth and never
                           re-proposed as if fresh without disclosure
deleted/retention-ineligible record — Stage 07D state machine; in Stage 07C
                           the vocabulary and columns exist, enforcement does
                           not, and no code path may present removed material
                           as truth
```

Normative consequences:

1. Unconfirmed, rejected, withdrawn, superseded, or (later) deleted material
   MUST NOT appear to the model as established Shared World truth — neither in
   assembled context, nor in prompt text that asserts it as fact, nor in any
   UI surface that presents Shared World state.
2. Epistemic claims carry type (`E1–E7`), honesty state, bounded uncertainty,
   and provenance (source + evidence refs). There is no unqualified "fact"
   field; an `E1` fact is stored WITH its verification procedure reference
   (canonical §5.3), and self-reports are `E2` (privileged within their
   domain, never auto-promoted — `INV-05`, `QLT-004`).
3. The agent's readings (`E4–E7`) are labeled readings; a hypothesis never
   enters a confirmed record by generation, display, streaming, or persistence
   as a pending proposal.
4. A transcript is never a durable record; no Shared World meaning may be
   derived from transcript persistence alone (07B boundary preserved).

## 8. The confirmation ceremony

### 8.1 Ceremony state machine (smallest closed vocabulary)

```text
proposed → awaiting_decision → confirmed | rejected | amended | withdrawn
```

* `proposed`: the agent's proposal record exists (tool-bridge write); it is
  visible, inspectable, and epistemically inert.
* `awaiting_decision`: the proposal is presented to the user (product may
  treat `proposed` and `awaiting_decision` as one visible pending state
  internally, but the durable vocabulary is the four above plus the initial
  `proposed`; exactly this vocabulary, closed).
* Terminal/branching states:
  * `confirmed` — the user's explicit confirm operation created the target
    record(s) atomically (§8.5); the proposal record links to them.
  * `rejected` — nothing canonical changed; the record retains the rejection
    and reason; it can never be confirmed later (a new proposal would be a
    new record).
  * `amended` — the user edited the proposal; the amendment flow creates a
    NEW proposal (the amended content is a new `proposed` record whose
    provenance links to the original); the original closes as `amended`.
    Confirming an amended proposal confirms the NEW record. An edit NEVER
    silently confirms.
  * `withdrawn` — the agent (or product policy) withdrew the proposal before
    decision (e.g. superseded by its own re-proposal); truthfully recorded;
    nothing canonical resulted.

### 8.2 What each party may do

* **The user sees:** every pending proposal (content, kind, epistemic type,
  source conversation/turn link, provenance), the confirm/reject/edit/
  dismiss controls, and the resulting record with its full lineage.
* **The agent may propose:** drafted claims, commitments, open loops, and
  corrections, each with its truthful epistemic type and source.
* **The agent may NEVER:** confirm, reject, or amend its own or any proposal;
  create a commitment, claim, or open loop outside the ceremony; promote a
  hypothesis to a grounded type; write any canonical Shared World record
  except a pending proposal (its pinned capability envelope contains the
  proposal-draft capability and nothing ceremony-authoritative; the
  deterministic gate denies everything else).
* **How the user acts:** explicit UI operations, each crossing the corrected
  released `app.data.mutate` command boundary with a declared domain verb and
  a declared input contract (`qlt.confirmProposal`, `qlt.rejectProposal`,
  `qlt.amendProposal`, `qlt.withdrawProposal` — the exact IDs are recorded in
  the implementation report). A user-authored record (the user types meaning
  directly) enters through the SAME ceremony: the Save action IS the visible
  confirmation of the user's own drafted record — the user is the confirmer;
  no separate confirm step is added for user-authored content, and the record
  still carries `confirmedBy` = the user actor with the Save action's
  idempotency key (this is the §11 recommendation; see the owner decision).
* **Editing:** creates a new proposal version (above); the amended proposal
  awaits its own decision. No in-place edit of a pending proposal's content.
* **Retries and double-clicks:** every ceremony action is a keyed, idempotent
  command; the same key replays the first outcome (one confirm, one
  rejection, one successor); duplicate clicks produce exactly one durable
  effect.
* **Crash behavior:** before confirmation — the pending proposal is durable
  and simply remains pending (crash loses nothing; a restart re-presents it);
  during the atomic confirm commit — the single transaction either fully
  commits (proposal closed + target records created + links written) or fully
  rolls back (proposal remains pending; the UI truthfully re-presents it);
  after commit but before the response — the command outcome is durable
  (fenced settlement); a reconnect/replay resolves the truthful final state
  (the confirmed records exist exactly once; a re-click with the same key
  replays, never duplicates).
* **Transaction boundary:** one ceremony operation is ONE SQLite transaction
  in the Quellight store (the Quellight-owned adapter's domain-level
  atomicity, the reason the store is Quellight-owned per Stage 07 architecture
  §6.3): proposal state change + commitment creation + open-loop creation +
  thread touch + source links, committed atomically with keyed idempotency.
* **Conflict handling:** confirming a proposal that is no longer
  `awaiting_decision` (already decided) fails closed with a stable product
  code; the truthful current state is returned; nothing is double-created.
* **Stale proposals:** a proposal carries its creation context; assembly and
  the UI treat proposals older than the declared bounded staleness window
  (operator-configurable, bounded positive integer) as stale — stale pending
  proposals are visibly marked and MUST be explicitly re-confirmed or
  withdrawn before they can act as decisions (the agent re-proposing is the
  normal path).
* **Links back:** every confirmed record links to its proposal (`provenance`
  refs) and, through the proposal, to the source thread/turn; the confirming
  operation's command identity (idempotency-key digest, actor, timestamp) is
  recorded on the target records.
* **Accessible responsive UI:** the ceremony surfaces follow the Stage 05
  accessibility discipline (real-browser keyboard completion, axe-clean
  baseline flows, live-region announcements for proposal state changes,
  focus management on decision, desktop/tablet/mobile responsive layout).
* **Truthful failure and recovery:** every failure state is truthful
  (validation failure, stale conflict, store unavailability); no fabricated
  success; the pending proposal survives every failure mode except an
  explicit rejection/withdrawal.

### 8.3 The load-bearing invariant

```text
A proposal MUST NOT become canonical merely because it was generated,
displayed, streamed, or persisted as a pending proposal.
```

Canonical Shared World truth arises ONLY from a `confirmed` ceremony
transition executed by the user through the governed boundary. Negative
controls N-C7/N-C8 (§14) prove the agent cannot self-confirm and that
unconfirmed material is excluded from assembly.

## 9. Context assembly (from C1, deterministically)

Context assembly is the Stage 07C replacement for transcript-only continuity:

1. **Eligibility:** ONLY confirmed, currently-effective Shared World records
   (claims `active`, commitments `active`, open loops `open`) from the
   relevant threads. Pending proposals, rejected/withdrawn proposals,
   superseded records, and retention-ineligible material are excluded
   structurally (the query layer exposes only eligible records; a negative
   control proves unconfirmed/superseded exclusion, §14 N-C10/N-C11).
2. **Deterministic selection and ordering:** declared, auditable rules —
   thread-scoped first; then open loops, active commitments, current-effective
   claims; fixed ordering (recency within class, then stable id tie-break);
   NO semantic retrieval, no embeddings, no autonomous learning — declared
   deterministic filtering is sufficient for Stage 07C and is REQUIRED.
3. **Explicit bounded budgets:** bounded record counts per class and a
   bounded total context size (operator-configurable, bounded positive
   integers with declared defaults); the assembly block records the budget in
   force.
4. **Provenance retained:** every assembled item carries its record id,
   epistemic type, thread, and origin ref INTO the assembled context, so the
   model-facing text can attribute meaning truthfully and the inspection UI
   can show exactly what was used.
5. **No transcript-only continuity claim:** assembly never reads Mastra
   transcripts as durable meaning; a fresh thread with no transcript still
   recovers from `C1` (`QLT-008`); losing a Mastra store loses conversation
   machinery only.
6. **No hidden second source:** assembled context is derived per-turn from
   `C1` through the Quellight store; there is no hidden mutable memory, no
   cached second durable reality (`INV-02`).
7. **Transparency:** the product records WHICH records were assembled for
   each agent turn (an inspectable correlation record) and the inspection UI
   can display it (`SH1–SH5` direction).
8. **Proofs:** a deterministic offline proof (fixture: confirmed + pending +
   rejected + superseded records ⇒ assembled context contains exactly the
   eligible set, in declared order, within budget) and a restart proof
   demonstrating reconstruction from `C1` after a real SIGKILL-class restart
   with the Mastra store deleted (continuity intact, transcript absent).

## 10. Correction lineage

Corrections never silently overwrite history:

1. The original record remains attributable: its row is never mutated in
   meaning; it transitions to `superseded` with a link to its successor.
2. A correction creates a NEW record (new version/successor) whose provenance
   links the original (`qlt_correction` + `qlt_source_link` records).
3. The relationship is explicit and inspectable: the user can open any current
   record and see what it replaced and why (the correction reason is a
   declared, bounded field).
4. Current-effective resolution is deterministic: the newest non-superseded
   record per subject, by declared ordering — the same rule assembly and the
   UI use.
5. Stale context assembly excludes superseded meaning (exclusion is a query
   property, proven by N-C11).
6. Rejected corrections change nothing canonical: a rejected correction
   proposal leaves the original effective and records the rejection.
7. Retry cannot create duplicate successors: correction submission is a keyed
   idempotent mutation; the same key reconciles to one successor
   (`DATA_IDEMPOTENCY_CONFLICT` on conflicting input).
8. User inspection shows what changed and why (lineage view).

Hard deletion and full retention enforcement remain Stage 07D; Stage 07C
record schemas carry retention columns and tombstone-compatible lineage
references so later truthful deletion is structurally possible (no schema
or lineage decision in 07C may make a later content-free tombstone
impossible).

## 11. OQ6 — recommended authority model (UNRATIFIED — owner decision required)

`OQ6` remains open. This section develops a concrete recommended authority
model for owner review and ends with ONE precise owner decision. **Nothing in
this handoff records OQ6 as decided.**

### 11.1 The recommended role allocation

| Role | May | May NOT |
| --- | --- | --- |
| **User** (constitutional authority and final confirmer) | Confirm, reject, amend, or dismiss any proposal; author Shared World records directly (explicit Save = visible confirmation of their own record); correct any confirmed record with lineage; request removal; ratify or amend the constitutional custody model itself; inspect everything the agent reasons over | Delegate final confirmation to the agent; ratify meaning by silence (inaction never confirms); be impersonated by any automated path |
| **Quellight Shared World** (durable custodian) | Hold ONLY confirmed partnership material as canonical truth; preserve append-only lineage; exclude superseded/rejected/unconfirmed material from canonical standing; enforce closed vocabularies and transitions; carry retention metadata | Hold unconfirmed proposals as truth; lose or silently rewrite history; serve as a bypass around the ceremony; keep a second hidden durable reality |
| **Agent** (proposer and reasoner) | Propose drafted meaning during conversation with truthful epistemic typing; reason over assembled confirmed context; identify conflicts and ask; propose corrections; withdraw its own pending proposals | Confirm, reject, or amend any proposal (its own or the user's); promote an inference, hypothesis, or observation into grounded standing; write canonical Shared World records outside its governed capability envelope; treat a transcript as durable meaning |
| **VICT** (governance, execution, identity, provenance, delivery, effect enforcer) | Enforce actor identity, scopes, closed payload schemas, contract validation, durable idempotency, fenced exactly-once settlement, audit provenance, release binding on every effectful write; carry typed action input through the corrected boundary; provide the tool-bridge gate for agent-side writes | Decide what is true; own or interpret Shared World semantics; hold product meaning; act as confirmer; expose Quellight-specific fields or vocabulary |

### 11.2 Specific resolutions this model implies

1. **User-authored records:** the user's explicit Save action on the product's
   authoring surface IS the visible confirmation ceremony for their own
   record (one visible operation: draft content shown, Save = confirm with
   `confirmedBy` = user actor). No agent confirmation step is inserted; the
   agent MAY subsequently propose corrections like any other proposal.
2. **Corrections and deletion requests are authorized by the user's explicit
   governed actions** (correct-with-lineage; removal requests recorded as
   Stage 07D's governed operation — the UI makes both visible operations).
3. **Agent–user disagreement:** representable, never silently resolved
   (`P05`): the agent's `E5`-typed reading and the user's `E2` self-report
   coexist as distinct records; conflict identification may challenge with
   provenance; resolution requires the user's explicit amendment/confirm
   operation — never the agent's persistence or repetition.
4. **Why the agent cannot silently promote inference into shared truth:** the
   agent's only write path is its pinned capability envelope (proposal-draft;
   write effect; contract-validated input; tool-bridge gate
   `AI-006`/`MSTR-004`); the proposal record is epistemically inert by
   construction; the deterministic VICT gate (not the model) decides what the
   envelope contains; the ceremony transition to canonical standing is a
   user-typed command the agent has no authority to issue (`INV-16`); and a
   negative control proves an agent self-confirmation attempt fails
   structurally (§14, N-C8).

### 11.3 The exact owner decision (the only unresolved constitutional question in this handoff)

> **OQ6 owner decision requested — ratify or amend the Stage 07C role
> allocation:** Do you ratify the authority model of §11.1 — **User:
> constitutional authority and final confirmer (Save-on-your-own-record =
> confirmation); Quellight Shared World: durable custodian of confirmed
> partnership material with append-only lineage; Agent: proposer and
> reasoner, never a confirmer, never a silent promoter of inference; VICT:
> governance/execution/identity/provenance/delivery/effect enforcer holding
> no product meaning** — for Quellight's Stage 07C ceremony and record
> families, and do you direct that this model be treated as the binding
> launch position for the minimum (while `OQ6`'s formal constitution-custody
> question — who holds constitutional-owner custody of Quellight's
> constitution and what ceremony makes a constitution version valid — remains
> separately open for a later versioned constitution record)? If you amend any
> part (for example requiring a distinct visible confirmation step even for
> user-authored records, or a different stale-proposal policy), the Stage 07C
> implementation MUST follow your amended model instead of §11.1.

Until the owner answers, Stage 07C implementation of the ceremony proceeds
only under §8's structural invariants (which hold under any ratifiable
variant): user-typed confirmation through the governed boundary; agent
propose-only; no silent promotion. **`OQ6` is NOT recorded as decided by this
handoff.**

## 12. Definition-driven enforcement — action provenance

### 12.1 Action-provenance table (every effectful Stage 07C user action)

| UI action | Application Definition node/action | Input schema | Capability/action handler | Identity and governance | SQLite transaction | Result/event |
| --- | --- | --- | --- | --- | --- | --- |
| Confirm proposal | declared mutation action `act.confirmProposal` → resource `qlt.sw` op `confirmProposal` | declared contract `qlt.proposal.confirm.input` | `/vict` proxy → released `app.data.mutate` (corrected envelope) → `remoteMutate` → Quellight Shared World adapter domain verb | command scope `app.data.write`; release binding; actor = local user; closed payload + envelope + contract fences | ONE `BEGIN IMMEDIATE` transaction: proposal → `confirmed`, commitment/claim/loop created as applicable, source links, keyed idempotency row | mutated row(s); durable command outcome; audit event with §6.14 provenance |
| Reject proposal | `act.rejectProposal` → op `rejectProposal` | `qlt.proposal.reject.input` | same path | same | one transaction (proposal → `rejected`) | same |
| Amend proposal | `act.amendProposal` → op `amendProposal` | `qlt.proposal.amend.input` | same path | same | one transaction (original → `amended` + NEW `proposed` record) | same |
| Withdraw proposal | `act.withdrawProposal` → op `withdrawProposal` | `qlt.proposal.withdraw.input` | same path | same | one transaction (→ `withdrawn`) | same |
| User authors a record (Save) | `act.authorClaim` (and siblings) → declared create ops | declared contracts (`qlt.claim.create.input`, …) | same path | same | one transaction (record created `confirmed` with `confirmedBy` = user) | same |
| Correct a record | `act.correctClaim` → op `correctClaim` | `qlt.clause.correction.input` | same path | same | one transaction (original → `superseded` + successor + `qlt_correction` + links) | same |
| Agent proposes (draft) | model tool selection → pinned capability `qlt.proposal.draft` | capability input contract (bridge-validated) | Verified tool bridge (nine-step order, durable intent, fenced settlement) → Shared World adapter write | `AI-006` boundary: authority, contract, effect/approval policy; model is NOT the command actor for ceremonies | adapter transaction (proposal row `proposed`) | durable proposal; tool outcome; turn correlation |
| Open/close a loop (user) | `act.resolveLoop` / `act.abandonLoop` / declared loop ops | declared contracts | corrected `app.data.mutate` path | same as confirm | one transaction (loop exit + provenance) | same |
| Resolve loop (canonical exits) | resolved \| superseded \| abandoned \| transformed — each a declared op with its contract | — | — | — | — | — |

Presentation-only actions (opening panels, listing views, focus, local
layout, inspection browsing) remain local UI behavior with no governance
requirement, per GOV-007.

### 12.2 Registered product actions and ownership

* All Stage 07C effectful actions are declared in Quellight's Application
  Definition (resource + mutation ops + input contracts) and cross the
  released corrected command boundary; the agent-side proposal capability is
  registered in the pinned agent envelope via the tool bridge.
* Quellight owns every contract implementation, every Shared World schema, and
  the domain verbs. No Shared World field, verb, type, or policy appears in
  any `@victframework/*` package.

### 12.3 Permanent conformance gates (fail the build/audit if violated)

A permanent Quellight conformance gate (aggregate script, e.g.
`verify:stage7c`) MUST fail when:

1. any SvelteKit route or island code writes Shared World tables directly
   (static scan + runtime probe: every durable write crosses the composed
   adapter via the governed boundary);
2. an undeclared action performs an effect (static: every effectful handler
   maps to a declared Application Definition action; dynamic: unknown
   `actionId` fails closed);
3. a handler uses ambient mutation input (static: no handler reads module
   state, ambient globals, or request objects outside its declared validated
   input; dynamic: a planted ambient-field attempt has no effect);
4. the agent confirms its own proposal (structural: no confirm capability in
   the pinned envelope; dynamic: the model path's confirm attempt fails
   closed);
5. a proposal becomes canonical without a user ceremony operation (structural:
   the only transition writers to `confirmed` are the user-command domain
   verbs; dynamic: N-C9);
6. a custom stream or execution path bypasses VICT (static scan: no second
   HTTP command surface, no raw provider path, no direct SSE construction;
   dynamic negative control);
7. framework-owned semantics are copied into Quellight (no `@victframework`
   internal import, no copied IR/compiler/bridge code; import-classification
   scan as in the 07B audit);
8. the product depends on a local VICT checkout (lockfile registry-only
   resolutions; no `file:`/`link:`/workspace/git specifiers; realpath probe);
9. YAML presence is treated as proof of governance (the conformance suite is
   definition/behavior-based; YAML absence is never a finding and YAML
   presence confers nothing — `GOV-007`).

## 13. Work packages and sequencing

Stage 07C is expressed as two phases of the ONE Stage 07C substage (no new
permanent architecture layer; `Phase F` and `Phase Q` are sequencing names
only):

```text
Stage 07C Phase F — VICT input-boundary correction and release  (VICT repo)
Stage 07C Phase Q — Quellight Shared World meaning and ceremony (Quellight repo)
```

Hard sequencing rule: **no Phase Q work package begins before its Phase F
prerequisite is satisfied**; no work package begins before its stated
prerequisite.

| # | Work package | Repository | Prerequisite | Outcome |
| --- | --- | --- | --- | --- |
| F1 | F-8 source proof and architecture decision (§4–§5) — ALREADY PERFORMED by this handoff | VICT (read-only) | Stage 07B closure | This handoff §4–§6 |
| F2 | VICT input-boundary implementation (§6) with all VC-* negative controls and permanent suites | VICT | F1 (this handoff registered) | corrected released-behavior tree; full ladder green |
| F3 | Independent verification of the VICT correction | external audit | F2 | verdict: correction verified (fail-closed matrix, compatibility, canaries) |
| F4 | Immutable VICT release and consumer compatibility proof (`0.2.0` per §6.18, re-derived at implementation) | VICT | F3 | coordinated set published with candidate dist-tag discipline; `verify:release-consumer -- --registry` green; release record under docs/report/ |
| Q1 | Controlled Quellight adoption of the exact release set (manifest + lockfile pin update, fresh-clone consumer proof, `/api/act` thread mutations migrated to the corrected boundary, legacy fail-closed stub retired) | Quellight | F4 | Quellight pinned to the new set; 07B behavior preserved (thread CRUD re-verified); adoption record |
| Q2 | Shared World schema and migrations (record families of §7.1; additive, versioned, retention columns) + adapter domain verbs | Quellight | Q1 | migrations forward-only; conformance fixtures green |
| Q3 | Registered product actions and the ceremony (proposal-draft capability via tool bridge; confirm/reject/amend/withdraw/user-author/correct domain verbs via the corrected command boundary) | Quellight | Q2 | ceremony works end-to-end offline; provenance table (§12.1) complete |
| Q4 | Context assembly (§9) with budgets, provenance, inspection record | Quellight | Q3 | deterministic offline proof + restart proof |
| Q5 | Inspection and correction UI (proposal cards, lineage view, context inspection) with responsive/accessibility discipline | Quellight | Q3 | real-browser checks green |
| Q6 | Deterministic, restart, browser, and bounded live verification (§15 ladder; the bounded live ceremony proof runs LAST, after all offline gates, with the owner credential) | Quellight | Q4, Q5 | full offline ladder green; live subset green |
| Q7 | Independent Stage 07C audit (Phase F + Phase Q evidence in one audit or two; audit dispositions per §17) | external | Q6 | authoritative verdict |

Stop conditions and prerequisites: Phase Q work packages MUST NOT soften any
Phase F fence; if during Phase F or Q the correction proves insufficient for a
genuine Shared World need, the implementer STOPS and records a new
framework-change proposal (GOV-007) — no product-side workaround.

## 14. Tests and negative controls (acceptance matrix)

All deterministic and offline unless marked live. The offline deterministic
model fixture remains the verification backbone; no credential is ever
required by `npm test`.

| # | Control | Expected |
| --- | --- | --- |
| N-C1 | Credential canaries (operator credential name/values, actor token) planted in a test composition | absent from command digests, audit events, logs, stream frames, VICT durable rows, Mastra bytes, Shared World bytes, build artifacts |
| N-C2 | Registry-only clean install of the adopted set; no monorepo fallback (unreachable-registry negative control) | install green; failure truthful with zero fallback |
| N-C3 | Baseline F-8 reproduction at the pre-correction release (tarball probe or composed fail-closed stub, as VC-1) | input rejected/dropped exactly as §4.2 |
| N-C4 | Invalid / missing / oversized / over-deep / special-key (`__proto__`, accessors, exotic prototypes) / non-serializable action input at the corrected boundary | stable non-echoing rejection; zero effect; zero content echo |
| N-C5 | Schema mismatch (input rejected by the action's declared contract, both fences) | `VICT_APPDATA_INPUT_CONTRACT_REJECTED`; command settled failed; replay safe |
| N-C6 | Tampered compiled plan (plan identity check; stale `expectedActionRevision`) | fail closed; no effect |
| N-C7 | Unregistered capability kind on the action boundary | unchanged `VICT_APPDATA_ACTION_UNAVAILABLE` |
| N-C8 | Agent self-confirmation attempt (model tool path; confirm capability absent from the pinned envelope; hostile prompt injection attempting ceremony abuse) | structurally denied; no canonical write; `AI-014` containment proven |
| N-C9 | Confirmation without user action (pending proposal left pending; assembly run; UI read) | no canonical record exists; pending material absent from assembled context |
| N-C10 | Unconfirmed-context exclusion (assembly with proposed/rejected/withdrawn records present) | assembled context contains ONLY confirmed records |
| N-C11 | Superseded-context exclusion (correction recorded; assembly rerun) | successor present, predecessor absent; lineage intact and inspectable |
| N-C12 | Confirmation replay / duplicate click (same idempotency key, repeated clicks) | exactly one durable ceremony effect; first outcome replayed |
| N-C13 | Crash before confirmation (SIGKILL mid-pending) | proposal remains pending and truthful after restart |
| N-C14 | Crash during the atomic confirm commit (fault-injected SQLite transaction boundary) | all-or-nothing: either the full ceremony commit or none of it; no half-ceremony |
| N-C15 | Crash after commit, before response | reconnect/replay shows the confirmed truth; re-click replays, never duplicates |
| N-C16 | Stale proposal (pending beyond the declared bounded window) | flagged stale; cannot act as a decision without an explicit re-decision |
| N-C17 | Correction conflict (two concurrent corrections of one record; one wins by durable order) | one successor; the loser fails closed truthfully; lineage shows exactly what happened |
| N-C18 | Duplicate correction (same key replayed) | one successor |
| N-C19 | Transcript-only recovery attempt (Mastra store deleted; fresh thread; assembly run) | continuity reconstructed from `C1` only; no fabricated continuity claim; UI renders truthfully |
| N-C20 | Direct-route database-write attempt (a probe route touching `shared-world.db` directly) | conformance gate fails; probe rejected structurally (gate proven, probe removed) |
| N-C21 | Identity mismatch (actor without `app.data.write`; forged actor field in the payload) | `VICT_ACTOR_SCOPE_DENIED` / field rejected; server-derived identity only |
| N-C22 | Empty-registry/local-checkout negative control (release-set pins with the registry unreachable; realpath probe) | truthful failure; no local VICT dependency |
| N-C23 | Responsive browser and accessibility proof (desktop/tablet/mobile; keyboard-only ceremony flow: read proposal → confirm → inspect record; axe-clean baseline) | green; live-region announcements verified |
| N-C24 | Bounded live-provider ceremony proof (LIVE; after ALL offline gates) | statement → proposal (real model via tool bridge) → real-user confirmation action → confirmation durable → fresh-thread recovery from `C1`; ≤ 6 turns, ≤ 256 max output tokens/turn, per-turn deadline 120 s, ONE execution, ZERO automatic retries; credential absent from every observable surface; 429/5xx fail truthfully |
| N-C25 | Aggregate gate: `verify:stage7c` composes N-C1..N-C23 and the permanent suites; green from a clean worktree; `git diff --check` clean | exit 0 |

Every important semantic assertion above has an independently auditable
negative control (the auditor re-runs or re-derives each marked control; §17).

## 15. Verification ladder and stop conditions

### 15.1 Verification ladder

**Phase F (VICT repository):** `npm ci` → `npm run build` → `npm test` (full
suite, first-run green) → `npm run lint` → `npm run typecheck` →
`npm run format:check` → `verify:stage2` … `verify:stage6b`, `verify:stage7a`,
`verify:n1` (regression ladders unchanged) → `verify:release-set` →
`verify:release-consumer` (tarball mode) → post-publication
`verify:release-consumer -- --registry` → ARA proof exactly 13 events,
benchmark exactly 10 events.

**Phase Q (Quellight repository):** `npm ci` → `npm run build` (warning-free) →
`npm test` (offline, deterministic) → `verify:consumer` → `verify:quellight`
(07B aggregate preserved green) → **`verify:stage7c`** (new aggregate:
§12.3 gates + N-C matrix offline items + §15.1 offline proofs) → real-browser
suite → the bounded live ceremony proof (gated, once, owner credential, after
all offline gates) → history/artifact hygiene scans.

### 15.2 Stop conditions (STOP and request an owner decision when)

* any Phase F fence cannot be implemented without widening beyond §6's minimal
  scope, or a released surface must break (non-additive change needed) —
  the correction re-enters governance with the new evidence;
* the registry/manifest state differs from §6.18's recorded expectations
  (version conflict or a newer owner-side release exists);
* Quellight's repository has advanced with conflicting Stage 07C work (never
  duplicate; report);
* a release-set identity mismatch or lockfile integrity failure appears;
* the canonical input hash no longer matches
  `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331`;
* the owner's answer to §11.3 amends the ceremony or authority model (implement
  the amended model; do not silently reconcile);
* the owner credential or §8 profile confirmations are withheld (the live
  proof waits; everything else proceeds);
* any `QLT-*` or canonical-invariant conflict is discovered (record; do not
  decide beyond scope);
* any work would need to touch Stage 01–07B verified records, historical
  reports, or the `.pi/` directory (never).

Do not start Stage 07D or 07E. Do not mark your own work Verified. Do not
record `OQ6` as decided.

## 16. Implementation-report template

`docs/report/` (VICT: `VICT-STAGE-07C-F-CORRECTION-IMPLEMENTATION-REPORT.md`;
Quellight: `QUELLIGHT-STAGE-07C-IMPLEMENTATION-REPORT.md` — implementer
claims, NOT independently authoritative):

```text
# Stage 07C <Phase> — Implementation Report
> Class/authority statement; starting and final SHAs (both repositories);
> environment (OS, Node, npm); release-set identity produced/consumed (content ID).

## 1. Prerequisites — handoff registration, entry-gate status, fetched baselines
## 2. Work packages (F1..F4 / Q1..Q7) — what was done, files, deviations (none silent)
## 3. VICT correction record (Phase F) — exact contract diffs, closed field sets,
     bounds in force, stable codes, audit-event fields, compatibility evidence
## 4. Release record (Phase F) — frozen artifacts, publication order, dist-tag
     discipline, post-publication consumer proof (metadata; no credentials)
## 5. Adoption record (Phase Q) — new pins, lockfile integrity, migration list,
     retired /api/act wiring, re-verified 07B behavior
## 6. Shared World record families — schemas, closed vocabularies, bounds,
     migration versions; ceremony state machine as implemented
## 7. Ceremony and provenance — action-provenance table realized; identity fields
## 8. Context assembly — selection rules, budgets in force, inspection record
## 9. Verification ladder — exact commands, exit codes, observed counts
## 10. Negative controls — N-C1..N-C25 evidence pointers (N-C24 live metadata only:
      turn counts, latencies, codes, bounds — NO conversation text, NO credentials)
## 11. Documentation deliverables — README/UI disclosure updates, operator reference
## 12. Known limitations and explicit deferrals (§18) — truthfully listed
## 13. Explicit stop point — what was NOT done (live proof if pending; OQ6 answer
      if withheld; Stage 07D items)
```

## 17. Independent-audit requirements

The Stage 07C audit (after Phase Q, covering the Phase F correction as a
prerequisite that was itself independently verified at F3):

1. re-derives the F-8 analysis from the CURRENT released set and confirms the
   corrected boundary closes it (VC-2) with all VC-* negative controls;
2. verifies the release-set identity (content-ID recomputation), the exact
   pins, the registry truth, and the no-monorepo-fallback control from a clean
   clone outside both repositories;
3. verifies the Shared World schemas, closed vocabularies, ceremony state
   machine, and lineage semantics against this handoff and the canonical
   input (meaning-level conformance; sequencing differences are reported, not
   silently accepted);
4. independently executes the ceremony matrix: confirm/reject/amend/
   withdraw, replay/dedupe, crash before/during/after commit, stale
   proposals, conflicts, agent self-confirmation denial, unconfirmed/superseded
   context exclusion, transcript-only recovery failure;
5. verifies the action-provenance table end to end (UI → definition → schema →
   boundary → identity → transaction → result/event) and runs the §12.3 gate
   suite including its negative controls;
6. verifies context-assembly budgets, determinism, provenance retention, and
   the inspection record; verifies the restart-from-C1 proof;
7. verifies credential canaries across every observable surface and the
   truthful live-proof metadata (the bounded live ceremony proof is executed
   by the auditor with the owner-supplied credential — never inherited from
   the implementer's record);
8. verifies documentation truthfulness (no deferred capability claimed;
   `OQ6` language unchanged as unratified; GOV-007 preserved; no report
   modified) and confirms Quellight remains a pinned consumer with zero VICT
   source dependence;
9. classifies findings per reference §27.4 and issues the authoritative
   verdict. Stage 07C is NOT Verified until this audit passes.

## 18. Explicit deferrals and the Stage 07D boundary

Stage 07C excludes ALL of: the retention policy engine's enforcement
(tombstones, expiry, dependency re-evaluation at policy scale, removal flows)
— Stage 07D (`QLT-011`, `QLT-019` full); governed deletion/export with
cross-store reconciliation — Stage 07D; conflict identification and the full
amendment-vs-execution distinction (`QLT-009`, `QLT-010`, `INV-15` in full;
Stage 07C delivers the bounded amendment flow of §8.1 only) — Stage 07D
completes them; `MSTR-012` real-use proof — Stage 07D (`QLT-017`);
`MSTR-012` real-use data-protection evidence; the full §8 first-vertical
steps beyond the 07C-scoped subset (conflict-with-challenge and
amendment-vs-execution scenarios) — Stage 07D; autonomous initiative,
ingestion, delegation, learning, full `SYNC` — later milestones per the Stage
07 architecture §7.2/§9; the Stage 07 exit gate — Stage 07E. The Stage 07C
boundary is chosen so that none of its durable schemas, vocabularies, or
write paths makes Stage 07D's truthful deletion, tombstoning, or retention
enforcement impossible.

---

*End of the Stage 07C handoff. Stage 07A and 07B remain formally closed;
Stage 07 remains In Progress; **Stage 07C is PERMITTED — SPECIFIED by this
handoff — EFFECTFUL IMPLEMENTATION NOT BEGUN**; the F-8 entry gate is resolved
on paper by §4–§6 (recommended path 3) and remains BINDING until Phase F's
correction is implemented, independently verified, released as a new immutable
set, and adopted; Stage 07D and 07E have not begun; every `QLT-*` requirement
remains Planned; `OQ6` remains UNRATIFIED and is presented for owner decision
in §11.3, not decided by this handoff; the canonical input remains
byte-identical (SHA-256 `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331`); no VICT package, script, manifest, lockfile, or registry
state was changed by this specification.*