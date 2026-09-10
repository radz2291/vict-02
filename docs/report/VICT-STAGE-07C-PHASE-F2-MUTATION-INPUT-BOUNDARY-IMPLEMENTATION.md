# VICT Stage 07C Phase F2 — Generic Governed Mutation-Input Boundary — Implementation Report

> **Class:** implementer claim per Stage 07C handoff §16 (`NOT independently
> authoritative`). This report is the implementer's claim for **Stage 07C
> Phase F2 only** (the VICT input-boundary implementation). It does NOT
> mark its own work Verified; independent verification is Phase F3.
> Nothing was published; no package version, manifest, lockfile, dist-tag,
> tag, access, or registry state changed; Quellight was not modified and
> Phase Q has not begun.
>
> **Dispositions at completion of this task:**
>
> ```text
> OQ6 RATIFIED — USER REMAINS FINAL SHARED WORLD AUTHORITY
> STAGE 07C PHASE F2 IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION
> No package was published and Quellight Phase Q has not begun.
> ```

## 1. Prerequisites and starting evidence

| Property | Value |
| --- | --- |
| VICT starting SHA (fetch-verified) | `4608ed69ac71d93976be902d280d084fb232c0e3` (`HEAD == origin/main`; tracked tree clean; pre-existing untracked `.pi/` material untouched) |
| Quellight evidence SHA (read-only throughout) | `f25b03a322868b37c9fee732a767d91d3ab63f98` (`HEAD == origin/main`; tracked tree clean; byte-identical at completion) |
| Environment | Windows (win32-x64), Node v22.13.1, npm workspace monorepo |
| Release set in force (unchanged) | `vict-release-set@1/0.1.1`, content ID `v1_e31e8dd60d05e1d6feb08b5ed0874cceae561bdf10e08d8b93e07840de8d9cdf`; manifests at `0.1.1`; registry `latest = 0.1.1` |
| Governing documents read | `docs/VICT-SYSTEM-REFERENCE.md` v0.4.8 (complete); `docs/architecture/STAGE-07-QUELLIGHT-MINIMUM-WORKABLE-PRODUCT.md`; Stage 07A/07B/07C handoffs; Stage 07B formal closure; `docs/RELEASE-COMPATIBILITY.md`; Stage 0.1.0/0.1.1 release, audit, and closure records; every governing source contract listed below |
| No AGENTS.md exists in either repository | verified by filesystem search |

## 2. Work package F2 record

### 2.1 Step 1 — OQ6 owner decision (ratification)

The owner explicitly ratified the recommended authority model of the Stage
07C handoff §11.1 before implementation began. Recorded as:

* **Decision identifier:** `OQ6` (no new identifier required — OQ6 was the
  open constitutional question being answered; no collision).
* **Disposition:** `RATIFIED` as the Stage 07C launch position; the narrower
  formal constitution-custody question reserved in handoff §11.3 remains
  separately open for a later versioned constitution record.
* **Decision commit:** `0845504088b954c6f984300be71ec796500d1c58`
  (`docs(stage-07c): ratify Shared World authority model`), pushed by normal
  fast-forward (`4608ed6..0845504 main -> main`); `HEAD == origin/main` after
  push.
* **Recorded exactly as ratified** (handoff addendum §19, reference §0.18):
  User = constitutional authority and final confirmer; Quellight Shared
  World = durable custodian of confirmed partnership material; Agent =
  proposer and reasoner, never unilateral confirmer; VICT = governance,
  execution, identity, provenance, delivery, and effect-boundary enforcer —
  with the nine binding consequences of the owner's decision (agent cannot
  confirm its own proposal or silently promote inference; explicit user
  decision required for agent-generated proposals; explicit Save on a
  user-authored record = confirmation where the UI clearly identifies it as
  a durable Shared World write; proposals never stale by time alone — stale
  by referenced source/target effective version change, supersession, or
  ineligibility; stale proposals cannot be confirmed unchanged; user's
  decision authoritative on disagreement; corrections and deletion requests
  require user authority with Stage 07D machinery; VICT enforces the
  declared boundary and owns none of Quellight's product meaning).
* **Files changed (documentation-only):** `docs/handoff/…07C…HANDOFF.md`
  (dated owner-decision addendum §19 appended after the issued text; original
  analysis unchanged), `docs/VICT-SYSTEM-REFERENCE.md` (v0.4.8 → **v0.4.9**
  patch per §27.5: evidence/status update without accepted-architecture
  change; new §0.18; header, evidence index, Stage 7 exit-gate note),
  `docs/architecture/STAGE-07…WORKABLE-PRODUCT.md` (dated status-update
  block; closing marker). The System Reference patch bump was required by
  §27.5 because a constitutional owner decision changes recorded status.
* **Historical evidence preserved:** the handoff's original §11 "UNRATIFIED"
  text, the architecture §11 OQ6 row, and reference §0.17 are unchanged as
  the historical record; the supersession is recorded by dated addendum.

### 2.2 Step 2 — independent F-8 reconfirmation (reproduced before any change)

F-8 was reproduced at the starting tree (code surfaces byte-identical to the
`0.1.0` release source `7e5908e…` — verified: `git diff 7e5908e HEAD` over
`packages/server/src/app-remote.ts`, `packages/server/src/commands.ts`,
`packages/application/src/data.ts` is EMPTY). Disposable probes (removed
after the run; no residue) produced results identical to handoff §4.2.1:

| # | Probe | Result |
| --- | --- | --- |
| P1 | `remoteMutate` with caller input carrying `op`/`id`/`idempotencyKey`/`input` | adapter received EXACTLY `{"kind":"mutate","resourceId":"…","releaseVersion":"…","actorId":"…","expectedRevision":"0","actionKind":"mutation"}` — mutation input fields carried: NONE (input lost at the transport layer) |
| P2 | `remoteAction(actionKind:'mutation')` | delegates to the same identity-only request; no released action path carries a payload |
| P3 | `VictCommandService.dispatch(app.data.mutate payload carrying op/input)` | rejected `VICT_COMMAND_PAYLOAD_INVALID` — "The command payload declares an unknown field for 'app.data.mutate'" |
| P4 | the identity-only four-field payload | passes the closed-field check and reaches the adapter — the closed set is exactly `resourceId`/`releaseVersion`/`expectedRevision`/`actionKind` |

The current repository matches the Stage 07C source analysis exactly, and
the required correction remains semantically confined to
`@victframework/server` (the definition layer, compiled plan, and data port
are complete and were NOT changed). No broader architectural change was
required; no stop condition applied.

## 3. Selected architecture and exact source delta

**Path 3 (handoff §5.3/§6): the smallest generic correction — a closed,
optional, plan-resolved, contract-fenced mutation envelope on the
`app.data.mutate`/`app.data.action` command payload.** All production-code
semantics are inside `@victframework/server`:

| File | Change |
| --- | --- |
| `packages/server/src/commands.ts` | (1) the closed payload field sets of `app.data.mutate` and `app.data.action` gain the optional members `actionId`, `expectedActionRevision`, `mutation` (§6.4); everything else in the registry, envelope capture, idempotency machinery, and replay projections is unchanged. (2) `canonicalPlainPayload` now REJECTS an own `__proto__` key in any own form at any depth with `VICT_COMMAND_PAYLOAD_INVALID` (§6.8; see §6 below — required because the previous `result[key] = value` assignment silently DROPPED scalar-valued own `__proto__` keys and silently PROMOTED object-valued ones into the captured container's prototype, so the rejected-form requirement can only be enforced at this single capture path). |
| `packages/server/src/app-remote.ts` | The governed mutation envelope: closed envelope capture (`op`/`id`/`input`/`idempotencyKey` only; accessors, symbol keys, inherited/non-enumerable members, exotic prototypes, hostile proxies → `VICT_COMMAND_PAYLOAD_INVALID`); compiled-plan resolution (`VICT_APPDATA_ACTION_UNRESOLVED` for missing/unresolvable actionId, uncomposed resolver, non-mutation kind, stale `expectedActionRevision`, resource mismatch, envelope op ≠ plan op); bounded envelope fields (op ≤ 32; id/key ≤ 128 → `VICT_APPDATA_FIELD_INVALID`); delivery-safe input domain with depth ≤ 8, serialized size ≤ 64 KiB, arrays ≤ 1,000 per level, keys ≤ 128 chars, and the dedicated own-`__proto__` rejection (all `VICT_APPDATA_MUTATION_INPUT_INVALID`); optional contract-resolver first fence (`VICT_APPDATA_INPUT_CONTRACT_REJECTED`; unresolvable declared contract → `VICT_APPDATA_CONTRACT_RESOLVER_UNAVAILABLE`); forwarding EXACTLY the conforming `ApplicationDataMutationRequest` shape `{ resourceId, op, input?, id?, idempotencyKey? }`. New additive exports: `ResolvedApplicationAction`, `resolveAction`/`resolveInputContract` options, and the closed bound constants. `remoteQuery`, `remoteAction` delegation, the legacy identity-only adapter request, and the hostile-container containment are unchanged. |
| `packages/server/src/index.ts` | Additive public exports only (new types + closed bound constants). |
| `packages/server/test/mutation-envelope.test.ts` | NEW permanent suite: 29 tests (positive path + VC matrix; §7 below). |

**Unchanged packages:** `@victframework/application` (port, compiled plan),
`@victframework/sdk` (authoring ABI), `@victframework/contracts`, all other
packages, HTTP transport routing (`/vict/v1/app/actions` POST already maps to
`app.data.mutate`; body ≤ 256 KiB unchanged), CLI, manifests, lockfile. The
semantic production scope is exactly `@victframework/server` as required.

## 4. Compatibility analysis

* **Strictly additive:** payloads without `mutation` take the unchanged
  legacy path and produce the byte-identical legacy adapter request
  (`{kind, resourceId, releaseVersion, actorId, expectedRevision,
  actionKind}`) — permanent test asserts exact shape; `app.data.query` and
  `remoteQuery` are untouched; emitted declarations are additive-only
  (`.d.ts` regenerated from source; no removed or retyped members).
* **Closed-field discipline preserved, not weakened:** unknown top-level
  fields still fail (`VICT_COMMAND_PAYLOAD_INVALID`); the corrected envelope
  is itself a closed record; the pre-correction F-8 attempt shape (top-level
  `op`/`input`) is STILL rejected (VC-1 permanent regression fixture).
* **The one behavioral narrowing beyond the envelope path:** own
  `__proto__` keys in any command payload are now rejected instead of being
  silently dropped (scalar values) or silently prototype-promoted (object
  values). This is a strict security narrowing of previously undefined
  accidental behavior, implements handoff §6.8 at the single capture path
  (Stage 07A N-1 discipline), and no existing test or documented behavior
  relied on the old forms (verified: full suite green; no prior test
  referenced `__proto__` payloads).
* **Consumer compatibility:** Quellight's pinned `0.1.0` behavior (composed
  fail-closed stub) is reproduced exactly by the legacy path against a
  conforming adapter (permanent test). Consumers of `0.1.0`/`0.1.1` are
  unaffected until they adopt the new set.
* **Effect boundary:** one dispatch ⇒ at most one adapter mutate. No second
  execution trigger, no route-local retry, no parallel effect path, no
  ambient state, no hidden side channel, no `Record<string, unknown>` escape
  hatch (the forwarded request is constructed field-by-field from the closed
  envelope; a permanent test asserts the exact key set).

## 5. Identity, provenance, idempotency, and effect-boundary behavior

* **Execution/user identity:** the command actor remains server-derived
  (never client-supplied); `app.data.write` is asserted below the transport
  (VC-11 permanent control); the envelope path additionally asserts an
  authenticated server actor before dispatch.
* **Compiled-plan identity:** `actionId` + optional `expectedActionRevision`
  resolve against the composed plan; tamper guards (unknown action, kind
  mismatch, stale revision, resource mismatch, op mismatch) all fail closed
  with `VICT_APPDATA_ACTION_UNRESOLVED`.
* **Capability identity:** unchanged — capability/signal kinds remain
  `VICT_APPDATA_ACTION_UNAVAILABLE` on the data boundary (VC-7); no
  capability shortcut was introduced.
* **Idempotency:** the existing durable command idempotency machinery
  (claim → lease → fenced settlement) is unchanged and governs the dispatch;
  permanent controls prove one-adapter-call replay (VC-8), durable-conflict
  discipline (VC-9), and durable failed-disposition replay for rejected
  input (VC-5). The envelope's domain key reaches only the adapter's
  existing keyed reconciliation (same key + same input reconciles; same key
  + different input → `DATA_IDEMPOTENCY_CONFLICT`), preserving the
  single-effect boundary at both fences; the single-key composition
  discipline (domain key derived from the command key, handoff §6.13) is a
  Phase Q composition convention recorded for adoption, not a new VICT
  effect mechanism.
* **Safe retention:** the durable receipt retains the existing safe
  projection (identifiers only); a permanent control proves a credential
  canary in mutation input appears in NO receipt byte and NO error message.
* **Release binding:** the stale-release check is unchanged and applies to
  both paths.

## 6. Validation and security behavior (bounds in force)

All bounds are declared closed constants exported from the public surface
and carry stable rejection codes: envelope fields closed
(`VICT_COMMAND_PAYLOAD_INVALID`); op/id/key bounds
(`VICT_APPDATA_FIELD_INVALID`); input depth ≤ 8, serialized size ≤ 64 KiB
(`MUTATION_INPUT_MAX_BYTES = 64 * 1024`), arrays ≤ 1,000 per level, keys ≤
128 chars, prohibited own-`__proto__` key at any depth
(`VICT_APPDATA_MUTATION_INPUT_INVALID`); contract first fence
(`VICT_APPDATA_INPUT_CONTRACT_REJECTED` / `VICT_APPDATA_CONTRACT_RESOLVER_UNAVAILABLE`);
plan identity (`VICT_APPDATA_ACTION_UNRESOLVED`); whole-payload canonical
depth bound of 8 and the 256 KiB HTTP body bound unchanged
(`VICT_COMMAND_PAYLOAD_INVALID`). Failures are non-echoing (codes and bounded
messages only); the command path's canonical-plain capture is the single
serialization form (no second serialization form, no side channel).
`constructor`/`prototype` string keys remain plain own data (permanent
positive control per handoff §6.8).

## 7. Tests and negative controls (permanent, independently auditable)

New permanent suite: `packages/server/test/mutation-envelope.test.ts`
(29 tests). Positive path: full field carry-through value-for-value (direct
dispatch, `app.data.action`, direct `remoteMutate`/`remoteAction`); nested
delivery-safe input preserved; legacy identity-only behavior byte-for-byte;
HTTP (`POST /vict/v1/app/actions`) and direct invocation agreement with the
real server; durable-key replay (one effect) and durable-conflict discipline;
adapter-level keyed deduplication and conflict; server-derived identity
denial (VC-11). Negative controls: VC-1 (pre-correction shape STILL
rejected), VC-3 (unknown field at both levels, non-echoing), missing op,
missing required input with durable replay safety (VC-5), invalid input type
(VC-5), unknown input field under the closed schema, oversized input
(VC-4), excessive nesting (both the declared input bound and the stricter
whole-payload command bound), array/key bounds, own-`__proto__`
scalar/object/deep forms (VC-4 — with explicit controls proving the
pre-hardening silent-drop and prototype-promotion forms are now REJECTED),
`constructor`/`prototype` plain-data positive control, non-serializable
values (function/Date/BigInt/NaN/Infinity/symbol/exotic prototype), hostile
proxies and getters, action-schema mismatch (VC-6), tampered plan guards
(stale revision / resource mismatch), unregistered action and uncomposed
resolver (VC-6/VC-10), unresolvable declared contract (VC-10), unregistered
capability kind (VC-7), post-compilation injection attempts at both levels,
credential-canary non-persistence (N-C1 discipline), and malformed HTTP body.
The existing suites (`app-remote.test.ts` legacy behavior; the full ladder)
all remain green.

## 8. Verification ladder (observed on the implementation tree)

| Command | Result |
| --- | --- |
| `npm ci` | exit 0; `package-lock.json` unchanged (verified by git before/after) |
| `npm run format:check` | exit 0 (all files) |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0 — 118 files: **117 passed / 1 skipped; 2213 passed / 3 skipped** (first-run green; baseline was 2184 passed / 3 skipped → +29 new Phase F2 tests) |
| `npm run build` | exit 0 (all 13 packages; emitted declarations regenerated) |
| `npm run verify:stage7a` | exit 0 — ALL GATES PASSED |
| `npm run verify:release-set` | exit 0 — 13 packages, 0.1.1, `v1_e31e8dd60d05e1d…` (the unchanged published set is still identified) |
| `npm run verify:n1` | exit 0 |
| `npm run verify:stage2` / `stage3` / `stage5` / `stage6b` | exit 0 (ARA 13 events and benchmark 10 events re-confirmed inside the stage ladders) |
| `npm run verify:consumer` | exit 0 — ISOLATED CONSUMER CHECK PASSED |
| `npm run verify:release-consumer` (tarball mode) | exit 0 — ALL CHECKS PASSED |
| `npm run verify:clean-clone` | exit 0 — ALL GATES PASSED |
| `npm run test:integration` | exit 0 — 4/4 |
| `git diff --check` | clean |

**Pre-existing environmental failures (NOT caused by this work):**
`verify:stage4` and `verify:stage6a` exit 1 on this machine BOTH at the
starting commit and on the implementation tree with byte-identical findings —
stage4: `FAIL: tarball identities` + `ERR_INVALID_ARG_TYPE` in
`scripts/verify-stage4.mjs` tarball-manifest parsing; stage6a:
`FAIL: @victframework/mastra imports no Mastra ee/ path`. Reproduced at the
baseline (changes stashed, baseline rebuild) with the identical finding set;
the full Stage 4/06A unit+integration suites they gate all pass
(`npm test` green, including the stage 4 application proof 17/17 within the
stage5 ladder and the mastra suites). These are environment/verifier issues
independent of Phase F2 and are recorded truthfully for the F3 verifier.

## 9. Anticipated release sequence (documented only — NOT executed)

Registry truth re-derived at implementation time (read-only `npm view`):
`@victframework/*` published versions are exactly `0.1.0` and `0.1.1`;
`latest = 0.1.1`; manifests sit at `0.1.1`. The correction is an additive
public-contract extension of the command boundary, so the coherent next
immutable coordinated release identity is **`vict-release-set@1/0.2.0`** —
all 13 packages at `0.2.0` with exact internal pins — matching the handoff
§6.18 expectation. **Not executed here:** no package version was changed, no
tag/dist-tag/access change, nothing published, no historical record
modified. Phase F4 (release) and Phase Q (Quellight adoption) remain future
work with their stated prerequisites.

## 10. Preservation, cleanup, and confirmation

* Nothing was published; no registry state, tag, dist-tag, access, or
  organization setting changed; no package manifest or the lockfile was
  modified; no historical report or handoff was modified (the Stage 07C
  handoff received only its dated appended addendum).
* Quellight remains byte-identical at `f25b03a322868b37c9fee732a767d91d3ab63f98`
  (`git status` clean; read-only inspection only; no Quellight semantics
  entered VICT — no Quellight identifier, record family, verb, or schema
  appears in any changed file).
* No credentials or authentication files were read; no live model provider
  was contacted; `.pi/` remains untouched; no temporary probes remain (the
  two disposable F-8 probe files were removed after the reproduction run);
  no worktrees, clones, temp databases, or browser artifacts remain (all
  consumer/temp directories were auto-cleaned by the verifiers).
* Genuine limitations: (a) the two pre-existing environmental verifier
  failures above are unresolved on this machine and need independent
  environment confirmation at F3; (b) the corrected boundary is the
  transport layer only — the composed port's request-context actor mapping
  remains the composition's responsibility (unchanged Stage 05/06B
  discipline); (c) audit-event provenance enrichment beyond the existing
  discipline was intentionally NOT added (handoff §6.15 says "existing
  audit-event discipline"; no new audit vocabulary was introduced —
  operationally, command provenance continues through the unchanged durable
  idempotency receipts and the existing audit-event machinery).

## 11. Evidence needed by the independent Phase F3 verifier

1. This repository at the Phase F2 implementation commit (§12 below) plus
   the OQ6 decision commit `0845504088b954c6f984300be71ec796500d1c58`.
2. Re-derivation of the F-8 analysis at the pre-correction commit `4608ed6`
   (or the release source `7e5908e…`) and confirmation that the corrected
   boundary closes it (VC-2) with the permanent `mutation-envelope.test.ts`
   suite and its VC matrix.
3. Independent re-run of the verification ladder (§8), including first-run
   full suite, and independent environment confirmation of the two
   pre-existing verifier failures (stage4/stage6a) recorded in §8.
4. Diff review of the three changed source files plus the new test file;
   confirmation that no other package, manifest, lockfile, historical
   report, or Quellight file changed.
5. Release-identity re-derivation (§9) WITHOUT publication; confirmation
   that registry state, manifests, and lockfile are unchanged.
6. Confirmation that `.pi/` is untouched, no credentials were read, and
   Quellight remains byte-identical at `f25b03a…`.

## 12. Commits

| Commit | Content |
| --- | --- |
| `0845504088b954c6f984300be71ec796500d1c58` | `docs(stage-07c): ratify Shared World authority model` (Step 1; pushed by fast-forward `4608ed6..0845504`) |
| Phase F2 implementation commit | `feat(server): carry governed mutation input` — the implementation, tests, and this report in one commit; its exact SHA is recorded in the completion response and in repository history |