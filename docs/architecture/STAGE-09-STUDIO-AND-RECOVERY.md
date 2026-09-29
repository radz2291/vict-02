# VICT Stage 09 — Studio, Diagnosis, and Controlled Recovery

> **Status: PROPOSED G0 candidate, not ratified or frozen.** This document is a reviewable entry contract, not implementation authority. Written against VICT `main` at `516948ac8bc55bbae8624bb91b3b35de34b3146c` (Stage 8 owner closure, 2026-09-29). The separate Quellight `main` was observed at `5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6`; recheck both before G0. Its proposals below require an owner decision. Reference: `docs/VICT-SYSTEM-REFERENCE.md` §23 Stage 9 and §27; predecessor: `docs/governance/VICT-STAGE-08-G4-CLOSURE-2026-09-29.md`.

## 1. Outcome and limits

Deliver a runnable, first-party **VICT Studio** for a human operator. From a connected local target, an operator can inspect graph and activation identity, runs and ordered events, waits/timers, Application Releases, ChangeSets, approvals, and audit; diagnose a failure from safe records; and perform authorized, confirmed, bounded interventions. The CLI reaches the same semantic operations. A fresh operator can complete the walkthroughs in §6 with a browser, without reading a database or source code.

Studio is also a real VICT consumer. It uses the existing Application Definition/Plan and `@victframework/ui` → `@victframework/ui-svelte` delivery path for the ordinary shell, navigation, list/detail, form, table, and action surfaces that the current model can express. SvelteKit hosts the app and its server-side connection boundary. Purpose-built Svelte operator components are allowed for graph/timeline/comparison/confirmation views whose semantics do not fit the Application Layer; each exception must be named and justified in the evidence. The `renderer-svelte` compatibility facade is not a second UI architecture. G0 must confirm with a small representative plan that at least one operator read and one governed action can travel through the real VICT application delivery path; an inability is a contract decision, not an invitation to hand-build all screens.

Stage 9 does not deliver a visual Application Definition editor, an autonomous healer, raw secrets or payloads by default, a Studio-only application model, cloud/multitenant access, or a general Quellight Shared World console. Compensation is guidance unless a separately authorized bounded command exists. Product-domain mutations are not part of the first Studio product view.

## 2. Observed starting point and dependency boundaries

- Stage 8 is formally closed **PASS WITH ISSUES** at the above VICT SHA; retained FT-1/FT-2 UI needs and FT-3/FT-4/FT-5 hygiene remain scheduled in `docs/governance/VICT-STAGE-08-FOLLOW-UP-REGISTER-2026-09-29.md`. Stage 9 does not silently execute them. If a walkthrough needs a table-cell link or chart window, state and gate the dependency.
- The coordinated published set is `vict-release-set@1/0.4.0-rc.1`, **14 members**. `@victframework/builder-kit` remains a local, integrity-recorded artifact outside that set. Neither its publication nor a new VICT release is a G0 prerequisite.
- `packages/server/src/commands.ts` is a closed command registry. Existing `activation.select`, `release.select/rollback`, `run.cancel`, `agent.turn.get`, ChangeSet and `app.data.query` commands do not supply run list/get/events/waits, `run.resolve`, or audit search at the remote command boundary. `packages/cli/src/commands.ts` is a separate closed table; CLI parity requires explicit entries and verification.
- `listenVictHttpServer` binds port `0` on loopback today. Quellight's product process knows its ephemeral port internally. A separately deployed Studio therefore needs an explicitly configured, discoverable local endpoint and a distinct operator identity; no port assumption or unauthenticated product route counts as proof.
- Quellight has no governed VICT control-plane Application Release selected at this observed SHA. A product-local version string is not a published Release. Studio must show truthful absence.

These are observations at the pinned SHAs, not guarantees about future mainline. Revalidate source paths and behavior before ratification and each affected gate.

## 3. Location, composition, and authority

**Recommended initial form:** a private `apps/studio` workspace in VICT, served as a separate local SvelteKit process. Add `apps/*` to workspaces only when implementation is authorized. Studio consumes public VICT application/UI and versioned HTTP command interfaces, not server internals or source aliases. Package publication of Studio is not needed for a local proof. Record the actual local artifact and commit identities. Integrated local evidence precedes any coordinated publication decision.

Studio's server owns an explicit allowlist of target loopback endpoints and target operator credentials; it does not discover random ports or proxy arbitrary URLs. The browser never receives target tokens. Studio authenticates its own human session and protects state-changing browser requests; the target VICT command boundary independently authorizes the mapped operator actor. A Studio session alone grants no VICT scope. A configured target can be connected, rejected (401/403), unreachable, or absent, with truthful distinct UI states. Cross-host transport and tenant isolation are outside Stage 9.

The target composition must deliberately bind a stable loopback endpoint and map an operator credential to a distinct actor with least-privilege scopes. Studio must not use the product agent's token. Product-specific diagnostic permissions are decided by the product's Application Layer, never by a UI label. G0 must choose exact Studio-session/CSRF and target-token configuration mechanics and test them at the browser and direct API boundaries.

## 4. Operator command plane and confirmation

Expose bounded, paged, scope-checked, safe-summary commands for run list/get/events/waits, activation selection history, release selections, and audit search as required by the walkthroughs. Preserve the exact VICT ledger ordering and provenance. Protected detail, if required, uses a distinct scope, retention checks, per-access audit, and default denial; no protected bytes leak via errors, logs, browser hydration, or generic list responses. The command names and response schemas below are design candidates; G0 reconciles them with the existing ABI before freezing.

Interventions under consideration are blocked-run resolution (`retry`, `confirm_applied`, `fail`, `cancel` where the runtime permits), signal, cancellation, activation selection, and Release selection/rollback. Timers are diagnosed and governed through the existing driver; do not invent an arbitrary timer-fire command. Commands return stable denial, stale-state, and idempotency outcomes. Every exposed Studio mutation has a matching supported CLI operation or a recorded, justified exclusion from the Stage 9 parity gate.

**Proposed high-impact rule:** server-issued, short-lived, durable intent receipts for `run.resolve`, `run.signal`, `run.cancel`, `activation.select`, and `release.select/rollback`. The authenticated actor, command, target, exact proposed parameters/content hash, and expected revision bind at preparation and are checked again at atomic consumption. Scope, a UI dialog, a revision guard, and an idempotency key each serve separate purposes and are not substitutes for confirmation. Existing ChangeSet approval/commit machinery may satisfy the two-step requirement only after its actor/content-hash/approval-consumption evidence is rechecked. Existing `run.cancel` payload compatibility is an explicit G0 decision: choose a compatible command evolution or a versioned change, and prohibit an unconfirmed operator bypass. Product-domain `app.data.mutate/action` are not exposed by the first Studio diagnostic pane.

**Retry rule:** the same committed request with the same idempotency key returns its recorded result with no second effect; a new request attempting to consume a spent receipt is rejected. An expired, mismatched-actor/action/target/parameters, stale-revision, or absent receipt rejects with zero effect. Prepared but unconsumed receipts expire without effect and remain auditable according to retention. This rule must be tested directly against the command boundary, separate from browser dialogs.

## 5. Product-owned views and Quellight claim

Studio may show a narrowly declared, permission-gated product diagnostic through the existing `app.data.query` boundary, clearly labeled as product-provided data. The generic VICT proof uses a two-actor example with allow, safe projection, and non-echoing denial evidence. The product view is not stored in a new Studio-specific model. G0 must choose whether a versioned Application Definition `operator` declaration and Release manifest are necessary to discover such views; do not introduce `vict.application@3` by assumption. Static private Studio configuration is not a silent substitute for a canonical designation contract.

**Recommended Quellight claim gate:** to say "Studio supports Quellight," prove one real read-only pairing for the same turn: `agent.turn.get` plus Quellight's `qlt.inspection` `getTurn` via `app.data.query`. Show only declared, safe diagnostic strings. Prove operator allow, underprivileged denial, and preservation of the agent-identity refusal. This proves one governed view, not source/database access or a Shared World editor. It requires Quellight's separately governed configured endpoint, second operator actor/credential, and actor-derived inspection permission grants. No Stage 9 VICT handoff grants Quellight write authority. The owner may exclude this pilot and close Stage 9 with an explicitly narrower VICT-native claim; the closure must then say Quellight support is unproven.

## 6. Human walkthroughs and acceptance

| ID | Fresh operator task | Positive proof | Negative and truthful states |
| --- | --- | --- | --- |
| S9-01 | Connect and inspect a target | Studio session maps to target operator actor; shows endpoint identity, scopes and selected versions | Missing, unreachable, rejected, and unselected Release remain distinct; no target token in browser |
| S9-02 | Diagnose a failed or blocked run | From run list to provenance, ordered events, current node, safe error and waits; compare versions; explain bounded options | Empty lists, redacted detail, pagination, stale revision and actor denial are clear |
| S9-03 | Review a ChangeSet | Inspect operations, evidence and content hash; separate approver decides; authorized operator commits | Self-approval, changed content, missing approval, and duplicate effect fail closed |
| S9-04 | Recover safely | Prepare and confirm a permitted resolution or rollback; audit shows actor, target, reason, before/after identity | Missing/mismatched/expired/replayed receipt and stale state yield no unintended effect |
| S9-05 | Read product diagnostic | Generic example proves allow and deny; Quellight same-turn pilot only if separately authorized | No declared view and denied view are distinct; product data is a safe projection |

Stage 9 exit evidence must show Studio and CLI produce the same semantic operations on isolated equivalent targets, not execute two mutations against one shared state. A real browser journey must use the application renderer for ordinary surfaces and identify every custom operator component. Include keyboard/accessibility, useful responsive states, direct-API authority tests, restart/idempotency behavior, retention/leakage canaries, and independent usability/security review. A builder cannot award its own independent verdict.

## 7. Proposed gates and decisions

| Gate | Deliverable and stop |
| --- | --- |
| G0 entry | Rebase this architecture and the handoff on current remote state; resolve D-1–D-10 below; owner records ratification and immutable contract identity. Until then documentation only. |
| G1 foundation | Safe operator reads, explicit CLI mappings, least-privilege actor/configuration boundary, and an actual VICT Application Definition/Plan rendered in Studio. Independent proof on a pushed candidate SHA; no automatic G2 authorization. |
| G2 interventions | Bounded confirmation receipts and command/CLI parity; ChangeSet and recovery browser journeys; negative tests and audit. Independent proof at exact pushed SHA. |
| G3 integration and exit | Integrated local-artifact journeys, authorized product-view example, optional separately governed Quellight claim proof, independent usability/security audit, owner closure with exact claims and retained findings. Publication only by a later explicit decision. |

G1's API and UI work may proceed in non-overlapping isolated worktrees after G0; neither publication nor a completed API gate is a prerequisite for beginning the UI slice. A single integrator owns the pushed candidate. Dependencies, sequencing and exact work packages are frozen at G0, not inferred from this table.

| Decision | Recommended disposition for owner review |
| --- | --- |
| D-1 Studio embodiment | Private `apps/studio`, SvelteKit host, genuine VICT Application Definition/Plan plus `ui`/`ui-svelte` for ordinary surfaces; explicit custom operator islands only. |
| D-2 connection and session | Configured loopback target and distinct operator actor; server-side token; authenticated Studio session, CSRF and target allowlist. |
| D-3 product-view designation | Prove generic authorized view first; ratify a versioned declaration/manifest only if necessary, with migration and ABI proof. |
| D-4 command compatibility | Additive commands where valid; choose deliberate migration/version for changing `run.cancel`; CLI parity is explicit. |
| D-5 protected detail | Separate scope, audit, retention, redaction, negative canaries. |
| D-6 parity proof | CLI and Studio against equivalent isolated deployments; same outcomes and no duplicate effects. |
| D-7 operator composition | Distinct target actor, scoped credentials, no Studio admin/identity provisioning UI. |
| D-8 Quellight claim | Require the narrow real same-turn proof for any Quellight support claim, under its own product governance; generic Stage 9 can close with a narrowed claim if excluded. |
| D-9 Release manifest | Couple to D-3 only if product-view discovery needs it; do not expand Release records by default. |
| D-10 confirmation | Receipt for all proposed high-impact selections and run interventions; retain existing ChangeSet approval if proven; exact idempotent retry semantics above. |

**G0 stop conditions:** conflicting current reference/ABI; Studio application's ordinary-surface proof cannot be expressed without an unreviewed amendment; target operator authentication cannot be demonstrated safely; a proposed version/schema break has no migration; a new Quellight requirement lacks its own authority; or an owner decision is missing. Record the conflict and return to the owner with a concrete option. This candidate makes no reference edit or Verified claim.
