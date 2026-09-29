# VICT Stage 9 — G0 Candidate Independent Review (2026-09-29)

> **Document type:** independent review record of the PROPOSED Stage 9 G0
> entry pack, filed per the G0 review task defined in
> `docs/handoff/VICT-STAGE-09-STUDIO-HANDOFF.md` ("Current authorization —
> G0 review only").
> **This is NOT a ratification.** G0 remains HELD for owner review. This
> review edits no implementation code, touches no Quellight file, merges
> nothing, publishes nothing, activates nothing, and awards no gate.
> **Reviewed candidate:** `codex/stage9-g0-candidate` at
> `c85af58dca04fa9e61ae77bf06bd933481609f15` (draft PR #2, head verified
> against the live GitHub API). **Base:** `516948ac8bc55bbae8624bb91b3b35de34b3146c`
> (verified identical to live `origin/main`). Quellight observation re-verified
> live: `refs/heads/main == 5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6`.

## 0. Method

The reviewer read all four PR files (`AGENTS.md`,
`docs/architecture/STAGE-09-STUDIO-AND-RECOVERY.md`,
`docs/governance/VICT-STAGE-09-STATE.md`,
`docs/handoff/VICT-STAGE-09-STUDIO-HANDOFF.md`), the Stage 8 owner closure
(`docs/governance/VICT-STAGE-08-G4-CLOSURE-2026-09-29.md`), the follow-up
register (`docs/governance/VICT-STAGE-08-FOLLOW-UP-REGISTER-2026-09-29.md`),
and system reference §23 (Stage 9), §27, §13, §14, §16, §17, §22, §24.3, §0.39
at the base SHA. Every material claim in the pack was then falsified against
the actual code at `origin/main@516948a`:

- `packages/server/src/commands.ts` (closed command registry, idempotency
  engine), `packages/server/src/http.ts` (transport route table, SSE,
  `listenVictHttpServer`), `packages/server/src/auth.ts` (authenticator),
  `packages/server/src/app-remote.ts` (product data/action boundary);
- `packages/cli/src/commands.ts` (closed CLI table),
  `packages/cli/src/client.ts` (durable CLI idempotency-key derivation);
- `packages/application/src/compile.ts` (closed surface grammar @1/@2),
  `packages/application/src/renderer.ts` (renderer contract, host-supplied
  `ActionDispatcher`), `packages/application/src/data.ts` (application-data
  adapter contract and its VictStores separation rule);
- `packages/ui-svelte/src/` (16 built-in roles; zero anchors/hrefs in
  `List.svelte`, `RecordsTable.svelte`, `Detail.svelte`; links only in
  `AppShell.svelte` navigation/breadcrumbs); `packages/ui/src/index.ts`
  (presentation-intent types);
- `packages/runtime/src/control-types.ts` (`ACTOR_SCOPES`, `ROLE_SCOPES`),
  `packages/kernel/src/types.ts` + `packages/runtime/src/orchestration-*`
  (`resolveBlocked` actions), store adapters (`getRun`/`listRuns`/`listEvents`
  present in both in-memory and SQLite adapters),
  `packages/control/src/control-plane.ts` (internal `auditTrail`);
- `examples/reference-app/src/` (the one page-server load + one `/api/act`
  dispatch pattern);
- Quellight `main@5f709a5` (separate repository, read-only): `src/lib/server/
  composition.ts`, `src/lib/sharedworld/inspection-{surface,contract}.ts`,
  `src/lib/application/definition.ts`, `src/routes/vict/[...path]/+server.ts`.

## 1. Identity verification (all PASS)

| Item | Expected | Verified |
| --- | --- | --- |
| Candidate branch tip | `c85af58dca04fa9e61ae77bf06bd933481609f15` | YES (fetched; `git rev-parse origin/codex/stage9-g0-candidate`) |
| Base | `516948ac8bc55bbae8624bb91b3b35de34b3146c` | YES (exists; == live `origin/main`) |
| PR #2 head/base | candidate / `main` | YES (live API; draft: true; exactly the four files) |
| Pack commit | `4bfaf9449bc0ed4474ba983c1862f4ec8ae64772` | YES (adds the 4 files; tip adds a 2-line STATE identity update) |
| Quellight observation | `5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6` | YES (live `ls-remote` on radz2291/Quellight, unchanged) |
| Divergence from base | 4 added files, 146 insertions, 0 deletions | YES (documentation-only, as claimed) |

## 2. Falsification results by review area

### 2.1 Area 1 — Application Definition/Plan + `ui`/`ui-svelte` route (pack §1, D-1)

**VERIFIED (the core claim is genuinely supportable):**

- The renderer contract consumes an immutable compiled plan plus
  host-supplied bindings (`RendererBindings { components, dispatch }`);
  `ActionDispatcher` is a host port (`packages/application/src/renderer.ts`).
  A Studio host can therefore map declared action surfaces onto VICT command
  calls, and can implement `ApplicationDataAdapter` over the versioned HTTP
  command boundary (no `VictStores` import — required anyway by the
  adapter contract's separation rule in `packages/application/src/data.ts`).
- The `examples/reference-app` demonstrates the exact hosting pattern a
  Studio would reuse: one page-server load resolving routes from the plan and
  reading declared views through the application-data port; one `/api/act`
  POST boundary dispatching declared actions below the UI.
- `@victframework/ui-svelte` declares 16 supported roles (`BUILT_IN_ROLES`):
  text, view, form, action, component, states, list, table, detail, chart,
  status, count, tabs, dialog, drawer, conversation. Shell/navigation comes
  from `AppShell.svelte` (group links, breadcrumbs). This covers the pack's
  "ordinary shell, navigation, list/detail, form, table, and action surfaces"
  inventory for presentation.
- Reference §16.5 and APP-018 (Accepted/Planned) support exactly this:
  Studio MAY reuse the Application Definition and renderer where semantics
  fit, with custom operator components where needed. The pack's "Studio is
  also a real VICT consumer" claim is consistent with the accepted
  architecture.

**CORRECTION REQUIRED (B-1):** the run-inspection drill-down wall is real and
is not dispositioned per-screen. Independently re-verified at `516948a`:
`List.svelte`, `RecordsTable.svelte`, and `Detail.svelte` contain **zero**
anchors/hrefs; table columns are `{field,label,sortable,componentId,revision,
props}`, row actions are dispatch-only `{actionId,label,input}`, and
`UiShellLink` renders only menu-level navigation/breadcrumbs. This is the same
auditor-verified impossibility retained as Stage 8's F6 clause-B literal FAIL
(register item FT-1). S9-02 ("From run list to provenance, ordered events,
current node…") inherently requires list→detail navigation; on the shipped
0.4.0-rc.1 grammar it **cannot** be expressed definition-only. The pack's §2
conditional ("If a walkthrough needs a table-cell link or chart window, state
and gate the dependency") never names S9-02 as affected. Until the owner
chooses — (a) a named navigation-only custom island bounded like the D-6
exception, (b) an explicit FT-1 platform dependency gating the affected
walkthrough, or (c) a navigation design using only menu/breadcrumb links —
D-1 is not decidable, and G1 could stall or silently hand-build screens (the
pack's own G0 stop condition: "ordinary-surface proof cannot be expressed
without an unreviewed amendment").

**NOT DEMONSTRATED:** no Studio Application Definition/Plan exists; the
route is architecturally open but unbuilt. Dialog-hosted two-step
confirmation (dialog surface holding the confirm action) is plausible in the
existing grammar but unproven.

### 2.2 Area 2 — Session security, operator identity, loopback, token isolation (pack §3, D-2/D-7)

**VERIFIED:**

- `listenVictHttpServer` binds `listen(0, '127.0.0.1')` — ephemeral loopback
  port, exactly as the pack states. Quellight's composition holds the bound
  port in-process (`victOrigin()` returns `http://127.0.0.1:${port}`); there
  is no discovery surface today. The pack's "explicitly configured,
  discoverable local endpoint" requirement is a real, unmet prerequisite.
- Quellight's `/vict/[...path]` SvelteKit proxy demonstrates the
  server-side-credential pattern the pack requires: "the browser NEVER…
  holds an actor token: the proxy injects the local actor credential
  server-side." Token isolation is precedented, not invented.
- VICT authentication is a bearer token → server-side actor directory
  (`createLocalTestAuthenticator`; "NOT a production identity provider").
  Multiple actors are a configuration matter (token→actorId map), so a
  distinct operator actor/credential is achievable without new machinery —
  but Studio's own human-session layer (login, session, CSRF) has **no
  precedent** in either repository and is genuinely new work.
- Quellight has exactly one actor today (`actor-quellight-local` via
  `createLocalTestAuthenticator({[env.actorToken]: LOCAL_ACTOR_ID})`). The
  pack's "Studio must not use the product agent's token" and "distinct
  operator actor" requirements are therefore real new configuration/work,
  correctly identified.

**CORRECTION (fold into D-2):** the pack says "G0 must choose exact
Studio-session/CSRF and target-token configuration mechanics" but D-2's
recommended disposition omits two items the decision must name: (i) the
target-endpoint discovery/registration mechanism (no stable endpoint exists
today), and (ii) the concrete CSRF mechanism for the Studio JSON action
boundary (SvelteKit's default CSRF protection does not cover JSON POST
endpoints; explicit origin/session checks are required). Also note for
D-7: role→scope policy already exists (`ROLE_SCOPES.operator` includes
`run.read`, `run.cancel`, `activation.select`, `release.select`, `audit.read`,
`operator.resolve`), so a least-privilege operator actor is expressible today.

**NOT DEMONSTRATED:** Studio session auth/CSRF; target allowlist behavior;
the four truthful connection states (connected/rejected/unreachable/absent)
as rendered.

### 2.3 Area 3 — Missing operator commands and CLI parity (pack §2/§4, D-4/D-6)

**VERIFIED (the pack's gap list is exact):**

- `VICT_COMMANDS` is a closed 26-command registry; "a command absent from
  this table does not exist." There is **no** `run.list/get/events/waits`, no
  `run.resolve`, no `run.signal`, no audit search, no activation-history or
  activation/graph-content read at the command boundary. `activation.select`,
  `release.select/rollback`, `run.cancel`, `agent.turn.get`,
  `changeset.*`, and `app.data.query` all exist as the pack says.
- `CLI_COMMANDS` is a separate closed table (25 entries) mapping onto HTTP
  routes; "an operation absent here is absent from the CLI." Parity requires
  explicit entries, exactly as the pack says.
- Feasibility of the proposed reads is grounded: both stores expose
  `getRun`/`listRuns`/`listEvents`; the orchestration adapter lists runs;
  `runtime.resolveBlocked` exists with actions `retry | confirm_applied |
  fail | cancel` (kernel types); the control plane has an internal
  `auditTrail(subject)`. The scopes these reads need (`run.read`,
  `activation.read`, `audit.read`, `operator.resolve`) are **already
  reserved** in `ACTOR_SCOPES`; `activation.read` and `audit.read` are
  currently used by no command. New commands can reuse the closed scope
  vocabulary without widening it.

**CORRECTIONS (N-1, N-3):**

- **N-1 — three-surface divergence precedent.** The pack frames parity as
  registry vs CLI; in fact there are three surfaces and they already diverge:
  `app.data.action` exists in the 26-command registry but has **no HTTP
  transport route** (`POST /vict/v1/app/actions` routes only to
  `app.data.mutate`) and **no CLI entry** (25 CLI entries vs 26 commands).
  The Stage 9 parity gate should therefore add a mechanical
  registry↔transport↔CLI completeness check, not only per-command CLI
  entries.
- **N-3 — read-list completeness.** §4's read list ("run list/get/events/
  waits, activation selection history, release selections, and audit search")
  omits the activation/graph identity-content reads that §1 ("inspect graph
  and activation identity") and S9-02 ("compare versions") imply. G0 should
  either name them (reusing the pre-reserved `activation.read` scope) or
  record them as deliberately deferred. Timer/wait diagnosis through the
  existing driver (no arbitrary timer-fire command) matches the runtime's
  driver-governed timers — correct as written.

### 2.4 Area 4 — Receipts, `activation.select`, `run.cancel`, retry vs spent (pack §4, D-4/D-10)

**VERIFIED:**

- The proposed receipt bindings (actor, command, target, exact
  parameters/content hash, expected revision; preparation and atomic
  consumption; expiry without effect; auditable retention) are consistent
  with the existing durable idempotency engine, which already namespaces
  claims by actor+command+key, binds the request digest, replays settled
  results, and rejects same-key/different-digest with
  `VICT_COMMAND_IDEMPOTENCY_CONFLICT` (`VictCommandService.
  #dispatchIdempotent`). The pack's "same committed request with the same
  idempotency key returns its recorded result with no second effect" is the
  already-shipped semantics; the receipt layer adds the prepare→consume
  two-phase fence on top.
- A durable CLI precedent exists: `deriveCliIdempotencyKey` derives a stable
  key from path+payload, so a CLI retry of the same logical command reuses
  the same key and receives the recorded result — the distinction the pack
  draws between idempotent retry and new-effect is already operator-visible.
- The ChangeSet machinery (content-hash-bound approvals, exact-binding
  approval consumption, applying-saga receipts) is a real two-phase
  precedent; the pack's condition ("may satisfy the two-step requirement
  only after its actor/content-hash/approval-consumption evidence is
  rechecked") is appropriately cautious.

**CORRECTIONS REQUIRED (B-2, B-3):**

- **B-2 — receipt scope silently covers four EXISTING commands.** §4
  proposes receipts for `run.resolve`, `run.signal` (both new), **and**
  `run.cancel`, `activation.select`, `release.select`, `release.rollback`
  (all four existing, one-phase, CLI-exposed today). Only `run.cancel` gets
  an explicit compatibility decision ("choose a compatible command evolution
  or a versioned change… prohibit an unconfirmed operator bypass");
  `activation.select` and `release.select/rollback` receive none, yet D-10
  recommends receipts for "all proposed high-impact selections." Retrofitting
  consumption semantics onto existing commands changes their calling
  convention for every current caller (CLI included). The compatibility
  decision must be extended to all four, with explicit options: (a) receipts
  as an additive layer (new prepare/consume commands; existing commands keep
  their current contract but become Studio-unreachable without a receipt —
  requires a scope/flag mechanism to prevent bypass), (b) new receipt-gated
  command variants with the legacy commands scope-restricted away from the
  operator actor, or (c) a versioned command change with migration.
- **B-3 — the retry/spent discrimination is not yet normative.** The pack
  states both behaviors but does not pin which bound fields constitute "the
  same committed request" for replay versus a spent-receipt rejection, nor
  the distinct stable codes for expired / mismatched-actor / mismatched-
  parameters / stale-revision / spent / absent receipts. It also does not
  state how receipts compose with the EXISTING per-command idempotency
  (a consumed receipt's underlying command still carries its own
  `Idempotency-Key` namespace; two idempotency layers must not conflict) or
  how a CLI operator performs prepare→confirm (the CLI needs a two-step
  expressible flow or receipts break the parity gate). D-10 cannot be
  ratified until these are written down; the pack itself defers this to
  "G0 reconciles them with the existing ABI before freezing" — this review
  confirms the reconciliation is still outstanding.

**NOT DEMONSTRATED:** no receipt machinery exists; dialog-hosted confirmation
against real receipts; negative matrix (missing/mismatched/expired/replayed/
stale) at the command boundary.

### 2.5 Area 5 — Release set, kit boundary, retained issues, Quellight gate (pack §2/§5, D-8/D-3/D-9)

**VERIFIED:**

- 14-member coordinated set: `EXPECTED_RELEASE_PACKAGE_COUNT = 14` and the
  frozen 14-entry `FROZEN_PUBLISH_ORDER` in `scripts/lib/release-set.mjs`
  (`renderer-svelte` removed by the facade-retirement amendment). The
  published set is `vict-release-set@1/0.4.0-rc.1` per the Stage 8 closure.
- Builder Kit is local and outside the set (closure §Boundary: "registry 404,
  outside the published 14-member set"); no G0 publication prerequisite —
  correct.
- Stage 8 closure is PASS WITH ISSUES at the base SHA with FT-1..FT-5
  scheduled and explicitly NOT absorbed by Stage 9 — the pack states this
  correctly, and correctly gates FT-1/FT-2 dependencies instead of silently
  executing them.
- Quellight claims, checked at `5f709a5` (live, unchanged): `qlt.inspection`
  is a real read-only application-data resource (definition declares query
  action `act.queryInspection` → resource `qlt.inspection`); `getTurn` is in
  the closed query-op vocabulary; reads require the `qlt.inspection.read`
  permission; `agent-*` actor identities fail closed; the surface is exposed
  through `app.data.query` via the VICT command boundary (`threadDataPort` →
  `remoteQuery`). "A product-local version string is not a published
  Release" — verified: `APPLICATION_RELEASE_VERSION = 'quellight-local-1'`,
  and no `release.publish`/`release.select` exists anywhere in Quellight's
  composition. Studio showing truthful absence is therefore required and
  well-defined.
- The claim gate's stated prerequisites are accurate and honest: a second
  operator actor/credential does not exist (single-actor authenticator), and
  the inspection permission grant is currently **hard-coded server-side** in
  the composition port (`permissions: ['qlt.inspection.read']` passed
  unconditionally for `qlt.inspection` reads) — so "actor-derived inspection
  permission grants" are genuinely new, separately governed Quellight work,
  and the underprivileged-denial proof is impossible until they exist. The
  pack's option to close Stage 9 with a narrowed VICT-native claim is real.

**CORRECTION (N-4):** "The `renderer-svelte` compatibility facade is not a
second UI architecture" is ambiguous. The facade is retired from the
workspace and absent from the 14-member set, while the published
`@victframework/renderer-svelte@0.3.1` remains on npm. Replace with an
explicit prohibition: Studio MUST NOT depend on the retired published
facade; ordinary surfaces travel only through `@victframework/ui` →
`@victframework/ui-svelte`.

### 2.6 Other verified-accurate claims (sample)

- Workspaces are `packages/*`, `examples/*`, `packs/*` — the pack's "add
  `apps/*` to workspaces only when implementation is authorized" is
  accurate; no `verify:stage9` script exists (WP-7 creates it).
- `agent.turn.get` scope is `run.read`; `stream.inspect` is actor-scoped with
  `operator.resolve` privilege — the pack's "Product-specific diagnostic
  permissions are decided by the product's Application Layer, never by a UI
  label" matches the code's below-transport authorization.
- The reference §23 Stage 9 row is "Planned"; §0.39 explicitly authorizes no
  Stage 9 start; the handoff's claim of a separate owner 2026-09-29 request
  for preparing this pack is consistent with the review authorization under
  which this document was produced, and the pack correctly treats G0 as
  requiring fresh owner ratification. AGENTS.md is a **new** top-level file
  (main has none) whose text properly disclaims implementation authority
  (N-5).

## 3. Prioritized findings

| ID | Severity | Finding | Exact correction |
| --- | --- | --- | --- |
| B-1 | High (blocks D-1 ratification) | S9-02 run list→detail drill-down is impossible definition-only on shipped 0.4.0-rc.1 grammar (FT-1 wall, re-verified: zero anchors in List/RecordsTable/Detail; rowAction dispatch-only; UiShellLink menu-level only); the pack never names the affected walkthroughs. | In §1/§6/D-1: name S9-02 (and any list→detail navigation) as hitting the FT-1 wall; owner selects (a) bounded navigation-only island (D-6-style), (b) explicit FT-1 platform dependency gate, or (c) menu/breadcrumb navigation design; record the choice in D-1 before ratification. |
| B-2 | High (blocks D-10 ratification) | Receipt proposal covers four EXISTING commands (`run.cancel`, `activation.select`, `release.select`, `release.rollback`) but only `run.cancel` has a compatibility decision; retrofitting changes every current caller's contract. | Extend the explicit compatibility decision to all four; choose additive-prepare/consume, receipt-gated variants with scope-restricted legacy, or versioned change + migration; prohibit bypass by mechanism, not assertion. |
| B-3 | High (blocks D-10 ratification) | Retry-vs-spent discrimination is not normative: no pinned replay key (actor+command+target+params digest+receipt id?), no stable code table (expired/mismatched/stale/spent/absent), no stated composition with the existing per-command durable idempotency and CLI derived keys, no CLI prepare→confirm flow. | Write the exact discrimination rule and code table into §4/D-10; state receipt↔command-idempotency composition; define the CLI two-step flow; only then freeze. |
| N-1 | Medium | Three-surface parity: `app.data.action` is registered but has no transport route and no CLI entry — divergence precedent the pack misses. | Add a mechanical registry↔transport↔CLI completeness check to the D-6 parity gate and WP-4. |
| N-2 | Medium | G1 "parallel UI slice" wording can hide that the ordinary-surface read proof consumes WP-1 commands (the Studio data adapter must bridge via the command boundary — the adapter contract forbids VictStores imports). | State the dependency in §7: the UI slice may scaffold first; the G1 "operator read through the real delivery path" criterion is satisfiable only after WP-1 reads exist. |
| N-3 | Medium | §4 read list omits activation/graph identity-content reads implied by §1 and S9-02 ("compare versions"); scopes `activation.read`/`audit.read` are pre-reserved and unused. | Add the reads explicitly (reusing reserved scopes) or record the deferral as a decision in D-4's scope. |
| N-4 | Low | `renderer-svelte` sentence is ambiguous given the retired-but-published facade. | Replace with an explicit prohibition of the published facade dependency. |
| N-5 | Low | AGENTS.md is a new top-level agent-entry file introduced by an unratified candidate. | Owner consciously ratifies its exact text at G0 (or removes it from the pack until ratification). |
| N-6 | Low | No walkthrough exercises a POSITIVE protected-detail path (D-5): only redaction/denial negatives appear. | Add one bounded positive path (authorized operator + distinct scope + per-access audit) to S9-02/S9-04 evidence. |
| N-7 | Info | STATE records the pack at `4bfaf944`; the branch tip is `c85af58` (identity-update commit). | After G0 corrections, refresh the recorded candidate identity to the new tip before freeze (the handoff protocol already requires this). |
| N-8 | Info | Quellight inspection grant is currently unconditional server-side; single actor exists. | No pack change needed — the claim gate already requires the missing prerequisites under Quellight's own governance; keep them named. |

**No material false claim was found.** The pack's §2 observations, the
closed-registry gap list, the port/loopback claim, the 14-member set, the kit
boundary, the retained Stage 8 issues, and the Quellight facts all verified
against the pinned SHAs.

## 4. Decision-ready D-1–D-10 sheet

Legend: **verified** = factual basis checked at the pinned SHAs;
**open** = owner must choose; **ND** = not demonstrated (no implementation
exists; do not treat as proven).

| D | Pack recommendation | Review verification | Consequences of each direction | Owner decision needed before G0 |
| --- | --- | --- | --- | --- |
| D-1 Studio embodiment | Private `apps/studio`, SvelteKit host, genuine Application Definition/Plan + `ui`/`ui-svelte` for ordinary surfaces; explicit custom islands only. | Route is real (renderer contract, host dispatcher/adapter ports, 16 roles, reference-app pattern) — verified. ND: any Studio rendering. Drill-down wall (B-1) unassigned. | (a) island: fast, repeats D-6 pattern, keeps FT-1 untouched; (b) FT-1 gate: cleaner contract, couples Stage 9 to a platform release; (c) nav-only design: no platform change, weaker walkthrough UX. | Choose D-1 + the B-1 disposition (island vs FT-1-gate vs nav design); list expected islands. |
| D-2 connection & session | Configured loopback target, distinct operator actor, server-side token, Studio session + CSRF + allowlist. | Pattern precedented (Quellight proxy); no stable endpoint exists; Studio session/CSRF new. ND: all of it. | Weak CSRF/origin checks → drive-by mutations against loopback target; endpoint discovery hack → arbitrary-proxy risk the pack already forbids. | Pin: endpoint registration/discovery mechanism; session mechanism; CSRF mechanism incl. JSON POST origin checks; token storage. |
| D-3 product-view designation | Prove generic authorized view first; versioned declaration/manifest only if necessary (no `vict.application@3` by assumption). | Verified: Quellight already declares `act.queryInspection`/`qlt.inspection` in its definition — designation-by-declaration exists today for the pilot; no `operator` declaration concept exists in the grammar. | New declaration → ABI/grammar amendment + migration; static config → the pack's own "not a silent substitute" objection; existing-declaration route → no ABI change for the pilot. | Choose the pilot's designation route; defer or require the versioned declaration (couples to D-9). |
| D-4 command compatibility | Additive commands; deliberate migration/version for `run.cancel`; explicit CLI parity. | Verified gaps; B-2 extends scope to 4 existing commands; N-1 adds transport-surface check; N-3 read-list completeness. | Narrow (run.cancel only) → inconsistent receipt semantics across selections; broad → larger migration, more caller churn. | Decide per-command: additive vs variant vs versioned; adopt registry↔transport↔CLI completeness gate; settle N-3 reads. |
| D-5 protected detail | Separate scope, audit, retention, redaction, negative canaries. | Verified: `operator.resolve` precedent (actor-scoped `stream.inspect`); OBS-004 Planned. ND. | Too narrow → walkthroughs can't diagnose; too broad → payload/secret leakage (OBS-002 boundary). | Confirm scope name + retention + canary set; adopt N-6 positive path. |
| D-6 parity proof | CLI and Studio against equivalent isolated targets; same outcomes, no duplicate effects. | Verified sound (matches §23 exit gate; two-target design avoids double-mutation). ND. | Shared-state parity testing would fake equivalence — the pack already forbids it. | Ratify as recommended; add the completeness check (N-1) and CLI receipt flow (B-3). |
| D-7 operator composition | Distinct target actor, scoped credentials, no Studio admin/identity provisioning UI. | Verified expressible (`ACTOR_SCOPES`/`ROLE_SCOPES`, multi-token authenticator); ND. | Provisioning UI scope creep vs operator self-service gap. | Ratify as recommended; name who/what provisions the operator actor per target (config file assumed). |
| D-8 Quellight claim | Narrow real same-turn proof under Quellight's own governance; exclusion allowed with narrowed closure claim. | Verified real and honest: `qlt.inspection` + `getTurn` + agent-refusal exist; second actor + actor-derived grant absent (hard-coded grant today). | Including → Quellight-side governance increment first (new actor model); excluding → Stage 9 closes with "Quellight support unproven." | Choose include/exclude; if include, the Quellight increment needs its own authorized gate before S9-05 pilot. |
| D-9 Release manifest | Couple to D-3 only if product-view discovery needs it; no Release-record expansion by default. | Verified: Release manifest today binds renderer/registry/adapter/SDK/activation — no view-declaration slot. | Expansion → release identity churn + migration; deferral → pilot uses existing declaration. | Decide after D-3; default defer is safe. |
| D-10 confirmation | Receipts for all high-impact selections and run interventions; retain ChangeSet approval if proven; exact retry semantics. | Two-phase precedent exists (ChangeSet approval consumption, applying-saga receipts); B-2/B-3 unresolved; ND. | Ratifying now would freeze ambiguous semantics (replay vs spent; code table; idempotency composition; CLI flow). | Resolve B-2 + B-3, then ratify the normative semantics with the stable code table. |

**Decisions that gate G0 ratification:** D-1(+B-1), D-4(+B-2, N-1, N-3),
D-10(+B-3), plus conscious adoption of AGENTS.md text (N-5). D-2 needs its
two named mechanics added; D-8 needs an in/out choice (both can be decided in
the same sitting).

## 5. Consolidated NOT-DEMONSTRATED register

Nothing below exists today; each is plausibly reachable but must not be
treated as proven by this review or by the pack:

1. Studio rendering of any Application Definition/Plan surface (WP-5/G1).
2. The Studio data adapter bridging views to operator reads via the command
   boundary (depends on WP-1 commands).
3. All proposed operator read commands; `run.resolve`; `run.signal`; audit
   search; activation-history and activation/graph-content reads.
4. Receipt prepare/consume machinery; its negative matrix; its CLI flow;
   its composition with existing command idempotency.
5. Studio human-session auth, CSRF mechanics, target allowlist, the four
   truthful connection states.
6. Stable/discoverable target endpoint registration (none exists; port is
   ephemeral and process-internal).
7. Quellight second operator actor, actor-derived inspection grants, the
   same-turn Studio pairing (S9-05), and Quellight's unchanged-HEAD status
   beyond today's re-check.
8. `verify:stage9`; the parity completeness check; the walkthroughs S9-01–S9-05.

## 6. Review disposition and stop

- **Pack accuracy:** verified against the pinned SHAs; no material false
  claim found. The candidate is a sound basis for the owner's D-1–D-10
  decisions after corrections B-1–B-3 and the named additions (N-1–N-6).
- **G0 status: NOT RATIFIED — remains HELD for owner review.** This review
  confers no implementation authority. The PR is not merged. Nothing is
  published or activated. Quellight is untouched (read-only inspection at
  its own HEAD).
- **Next allowed action:** the owner records dispositions for D-1–D-10
  (minimum gating set above), a documentation-only correction commit folds
  B-1–B-3 and N-1–N-6 into the pack, the refreshed candidate is re-pushed
  and remote-verified, and only then does the owner ratify and freeze the
  exact contract bytes for G1.

*Filed 2026-09-29 by the independent G0 reviewer on
`review/stage9-g0-20260929`. Stop.*
