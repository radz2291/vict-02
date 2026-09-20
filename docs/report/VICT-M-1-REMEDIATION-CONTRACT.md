# VICT-M-1 Remediation Contract (FROZEN)

**Status:** Frozen remediation contract — committed ALONE before any
executable change (L0 freeze discipline).
**Frozen:** 2026-09-21, at VICT release-infrastructure base
`0536d1e4467edd9c6be639eae40ca3dc7b48754a` (`HEAD == origin/main`, clean
tracked tree, linear ancestry) and Quellight base
`1d1c9f6ebb3187f85abea1f7f3db1c3f6976e0e9` (`HEAD == origin/main`).
**Supersession note:** this contract supersedes, for the `qlt.proposal.draft`
capability only, the effect-class disclosure recorded in the Quellight
Phase Q3 freeze (§3) and carried as finding M-1 — the disclosed `read`
class of an effect-ful capability. It changes nothing else in any frozen
contract. Q5 remains formally closed; Phase Q6 remains not begun.

Amendment rule: if a frozen semantic rule below must change, the affected
lane stops, the defect is documented, the contract is amended in its own
separate commit, and the affected work restarts from the amendment. No
silent reinterpretation; no amendment bundled with consuming
implementation.

---

## 1. Exact current defect (truthful statement)

Quellight's single pinned agent capability `qlt.proposal.draft@1` creates a
durable, epistemically inert pending proposal row. Its factual external
impact is therefore a WRITE. Under the ratified 0.2.0 discovery decision
the capability is DECLARED `effect: 'read'` (Quellight Q3 freeze §3), which
is untruthful metadata: the released 0.2.0 bridge policy
(`defaultBridgePolicy`) derives `requiresApproval = effect === 'write' ||
effect === 'irreversible'`, so the false `read` declaration is the only
reason the capability completes in-turn without a separate approval wait.

Three facts are conflated today and must become independently represented:

1. the factual effect class of the capability;
2. whether THIS invocation required a separate approval wait;
3. the stable policy basis that produced that decision.

Today none of the three is durably captured per invocation: the invocation
record carries only the declared `effect`, and no durable field records the
approval decision or its basis. Silent consequence: a future policy change
could reinterpret whether an old invocation required approval.

## 2. Approved authority model (frozen)

* Effect truth and approval policy are INDEPENDENT. The capability declares
  its factual effect; the approval decision is derived by the runtime tool
  bridge from the effect AND a host-owned policy, and is durably recorded
  per invocation.
* Default behavior is UNCHANGED and byte-equivalent when no host policy is
  supplied: `write` and `irreversible` require a separate approval wait;
  `read` and `pure` do not. The default can never become weaker.
* The only new authority path is a HOST-OWNED quiet-write approval policy:
  the composition (trusted host dependency — the same trust channel that
  supplies `resolveCapability`, `invoke`, and the store ports) may supply
  an exact-match policy that permits ONE specific write capability at ONE
  specific revision to execute without a separate approval wait.
* The policy is INACCESSIBLE to: `CapabilityDefinition` (no field exists),
  capability packs, model output, tool input/output, agent profile
  content, and memory. There is no capability-controlled opt-out, no
  wildcard form, no effect-class-wide form, and no path from capability
  code to the policy object.
* An `irreversible` capability can NEVER be exempted (rejected at
  composition/tool-build time). Ordinary writes without an exact matching
  entry keep the default approval requirement.
* No automatic approver, synthetic approval record, hidden approval event,
  or fabricated actor exists anywhere in this remediation.
* The complete governed execution path is unchanged and remains mandatory
  for quiet writes: closed tool-envelope validation, authoritative contract
  validation, durable intent, idempotency, claim/lease, fencing,
  settlement, replay, restart reconciliation, and truthful
  `outcome_unknown`.

## 3. Public type and API shape (frozen)

### 3.1 Durable evidence — `@victframework/runtime` (`control-types.ts`)

```ts
/** Closed vocabulary for the policy basis of one invocation's approval
 * decision. Frozen: new members require a new contract amendment. */
export type EffectApprovalDisposition =
  | 'default-effect-policy'
  | 'host-policy-write-without-separate-approval';

/** Versioned identity of the effect-policy semantics that produced a
 * decision. `vict-effect-policy@1` = the M-1 policy model: default table
 * (write/irreversible approval-required) + exact-match host quiet-write
 * exemption. Historical rows may only ever carry identities documented in
 * current release documentation. */
export const VICT_EFFECT_POLICY_IDENTITY = 'vict-effect-policy@1';
```

`AgentToolInvocationRecord` gains three OPTIONAL, INTENT-IMMUTABLE members
(absent on records that predate the remediation, never mutated after
intent):

```ts
/** The approval decision ACTUALLY resolved for this invocation. */
readonly approvalRequired?: boolean;
/** The closed-code basis that produced the decision. */
readonly approvalDisposition?: EffectApprovalDisposition;
/** Versioned policy semantics identity (historical interpretation). */
readonly effectPolicyIdentity?: string;
```

`AgentTurnService.recordToolInvocationIntent` (control) input gains the
same three optional fields and stamps them onto the durable record at
intent time. They are never accepted from, or influenced by, capability
code.

### 3.2 Host-owned policy — `@victframework/mastra` (`tool-bridge.ts`)

```ts
/** One EXACT quiet-write authorization (no wildcards, ever). */
export interface HostQuietWriteApprovalEntry {
  readonly capabilityId: string;
  readonly capabilityRevision: string;
}

/** Host-owned quiet-write approval policy (composition-supplied only). */
export interface HostQuietWriteApprovalPolicy {
  /** Versioned identity of THIS host policy instance (host-chosen,
   * bounded identity pattern; recorded nowhere — VICT records its own
   * disposition basis, not the host's policy content). */
  readonly policyIdentity: string;
  readonly entries: readonly HostQuietWriteApprovalEntry[];
}
```

`CapabilityBridgeDeps` gains ONE optional member:
`readonly quietWriteApprovals?: HostQuietWriteApprovalPolicy`.

`BridgeCapabilityPolicy` gains
`readonly approvalDisposition: EffectApprovalDisposition` alongside the
existing `requiresApproval` (which keeps its name and meaning).

Resolution rule (frozen): for a capability with resolved effect `write`,
if `quietWriteApprovals` contains an entry whose `capabilityId` and
`capabilityRevision` BOTH exactly match the resolved pinned definition,
then `requiresApproval = false` and `approvalDisposition =
'host-policy-write-without-separate-approval'`; otherwise
`requiresApproval` follows the default table and `approvalDisposition =
'default-effect-policy'`. Entries targeting `read`/`pure` capabilities are
dead entries and are rejected at build time (they would silently do
nothing; the disposition for non-write effects is always
`default-effect-policy`).

### 3.3 Exports (frozen)

`@victframework/runtime` exports `EffectApprovalDisposition`,
`VICT_EFFECT_POLICY_IDENTITY`. `@victframework/mastra` exports
`HostQuietWriteApprovalEntry`, `HostQuietWriteApprovalPolicy`. Additive
only; no existing export changes shape or behavior.

## 4. Closed approval-disposition vocabulary (frozen)

Exactly two members, frozen:

| Disposition | Meaning |
|---|---|
| `default-effect-policy` | The decision came from the default effect table (write/irreversible → approval required; read/pure → not required). |
| `host-policy-write-without-separate-approval` | The decision came from an EXACT host quiet-write entry (capability ID + revision match, effect `write`); approval-required resolved false. |

No free-form reason text, no configuration content, no credential or
secret material may ever be stored in any of the new fields.

## 5. Durable evidence shape (frozen)

* Every NEW invocation durably records, at intent time, before any effect:
  `effect` (already existing), `approvalRequired`, `approvalDisposition`,
  `effectPolicyIdentity = 'vict-effect-policy@1'`.
* The fields are IMMUTABLE after intent: no update path (claim, fence,
  settlement, reconciliation, restart) writes them. Retry/replay/restart
  re-read the original record; the idempotent re-record path returns the
  EXISTING record (snapshot preserved).
* A quiet write creates NO approval row, NO approver identity, and NO
  `tool.awaiting_approval` event. Required approvals keep the existing
  durable approval evidence unchanged.
* A quiet write is INDISTINGUISHABLE from an approved execution only by
  its truthful evidence: `effect='write'`, `approvalRequired=false`,
  `approvalDisposition='host-policy-write-without-separate-approval'`.

## 6. Validation and failure codes (frozen)

Host-policy entries are validated at composition/tool-build time (fail
closed, before any model-facing tool exists), with stable non-echoing
`Error` codes following the existing bridge convention:

| Code | Condition |
|---|---|
| `VICT_HOST_QUIET_WRITE_POLICY_MALFORMED_ENTRY` | An entry's `capabilityId`/`capabilityRevision` is not a non-empty bounded identity string, or the policy object/identity is malformed (`policyIdentity` empty or exceeding the bounded identity pattern). |
| `VICT_HOST_QUIET_WRITE_POLICY_DUPLICATE_ENTRY` | Two entries name the same (capabilityId, capabilityRevision) pair. |
| `VICT_HOST_QUIET_WRITE_POLICY_UNRESOLVED_TARGET` | An entry names a capability/revision that does not resolve in the pinned activation envelope. |
| `VICT_HOST_QUIET_WRITE_POLICY_TARGET_NOT_WRITE` | The resolved target's effect is not `write` (covers `read`, `pure`, and — permanently — `irreversible`). |

Codes appear in thrown error MESSAGES (stable prefix); no request data,
policy content, or capability payload is echoed. Registry: the codes are
documented here and in the implementation record; they are build-time
composition errors, not model-visible failure envelopes.

## 7. SQLite migration behavior (frozen)

Migration **10** — `m1-approval-decision-evidence` — following the
established ordered, forward-only, per-migration-atomic conventions:

```sql
ALTER TABLE vict_agent_tool_invocation ADD COLUMN approval_required INTEGER;
ALTER TABLE vict_agent_tool_invocation ADD COLUMN approval_disposition TEXT;
ALTER TABLE vict_agent_tool_invocation ADD COLUMN effect_policy_identity TEXT;
-- one UPDATE backfill, derived ONLY from the effect column:
UPDATE vict_agent_tool_invocation SET
  approval_required = CASE WHEN effect IN ('write','irreversible') THEN 1 ELSE 0 END,
  approval_disposition = 'default-effect-policy',
  effect_policy_identity = 'vict-effect-policy@1';
```

* Preserve every existing column byte-truthfully; never rewrite the
  historical `effect` values.
* The backfill is derivable UNAMBIGUOUSLY for every legacy row because the
  `effect` column is `NOT NULL` with a closed CHECK; the fixed 0.2.0 rule
  (`write`/`irreversible` → approval required) is the only decision basis
  that ever existed. If any row were encountered whose effect is outside
  the closed vocabulary (impossible under the CHECK), the migration fails
  closed instead of fabricating evidence.
* Migration runs inside ONE transaction with its version row (existing
  `runMigrations` discipline): atomic, rollback-on-failure proven.
* Newer/unsupported schema versions refuse with
  `VICT_STORE_UNSUPPORTED_SCHEMA` before any statement runs (existing
  fail-closed gate; behavior preserved).
* In-memory store adapters require no schema change; the conformance suite
  must keep both store implementations equivalent.

## 8. Compatibility defaults (frozen)

* `quietWriteApprovals` ABSENT → behavior byte-for-byte equivalent to
  0.2.0 for every effect class, plus the new truthful evidence fields
  (records gain `approvalRequired`/`approvalDisposition`/
  `effectPolicyIdentity`; `requiresApproval` decisions unchanged).
* All 13 packages move to `0.3.0-rc.1` with exact internal pins (one
  coordinated candidate set). `latest` remains `0.2.0`; stable `0.3.0` is
  NOT published in this task; the candidate tag is the frozen
  `vict-0.3.0-rc`.
* The record shape change is ADDITIVE and optional-member: previously
  stored/returned records remain shape-stable; new members are absent on
  legacy rows only if a legacy database is read without migration (the
  adapter always migrates on open, so post-open rows carry the backfill).
* Quellight repins to exact `0.3.0-rc.1` from the PUBLIC REGISTRY only,
  upgrades `qlt.proposal.draft` to `@2` with `effect: 'write'`,
  `idempotency: 'keyed'`, supplies the exact one-entry host policy, and
  keeps the agent envelope proposal-draft-only. No Q6 or live-provider
  behavior.

## 9. Negative-control matrix (frozen; permanent suites)

| # | Control | Permanent proof home |
|---|---|---|
| 1 | Old capability records proposal creation as `read` | one-time reproduction in a disposable Quellight worktree at `1d1c9f6…` (evidence recorded, worktree removed) |
| 2 | Changing only the old declaration to `write` enters the approval-required path | one-time reproduction (same worktree, uncommitted change); permanently mirrored on the new tree (controls 4/8) |
| 3 | Exact host policy records `write` + no-separate-approval truthfully | VICT focused suite + Quellight focused suite |
| 4 | Removing the policy restores approval-required | VICT focused suite |
| 5 | Wrong ID or revision gets no quiet-write disposition | VICT focused suite |
| 6 | Malformed / duplicate / unmatched / read-target / irreversible-target entries fail closed at build | VICT focused suite |
| 7 | A capability cannot self-exempt (no path from definition/invocation to the policy; a hostile self-describing entry still cannot match an unpinned identity) | VICT focused suite |
| 8 | Ordinary writes still require approval | existing suites keep passing (not weakened) + focused suite |
| 9 | Irreversible can never be exempted | VICT focused suite |
| 10 | Quiet write creates zero approval records, zero approver identities, zero awaiting-approval events | VICT focused suite |
| 11 | Full governed chain (intent, idempotency, claim, fence, settlement, replay, `outcome_unknown`) unchanged for quiet writes | existing reliability suites + focused suite |
| 12 | Decision snapshot survives retry and restart (never mutated after intent) | VICT focused suite (incl. SQLite) |
| 13 | Legacy rows migrate preserving every unrelated value | store-sqlite migration suite |
| 14 | Agent still cannot confirm/reject/amend/withdraw/apply proposals | Quellight suites keep passing (not weakened) |
| 15 | Quellight's real composition records the truthful new evidence | Quellight focused suite |
| 16 | Conversation and composer remain uninterrupted (no modal/tray/focus theft from a quiet proposal write) | Quellight browser ceremony + focused suite |

## 10. Lane ownership (frozen)

* **L0** — this contract, committed alone.
* **Lane A (VICT production chain, ONE sequential owner)** — runtime
  record types → control intent path → SQLite migration + adapter →
  Mastra bridge policy → public exports.
* **Lane B (VICT focused tests)** — after Lane A's public shapes stabilize;
  new focused files only; existing suites never weakened.
* **Lane C (VICT release preparation)** — after A+B integrate green: 13
  versions → `0.3.0-rc.1`, exact pins, release-set identity, build, pack,
  scan, release-source commit.
* **OIDC release lane** — push, dispatch `.github/workflows/release.yml`
  (`source_sha`, `version=0.3.0-rc.1`, `npm_tag=vict-0.3.0-rc`), monitor
  to terminal completion, verify registry independently. Local `npm
  publish`, tokens, OTP, and `npm whoami` preflight are OBSOLETE and are
  not used, run, or required.
* **Lane Q (Quellight)** — after all 13 candidates are registry-visible
  and integrity-verified: repin, capability `@2/write`, host policy,
  focused tests, verifier expectations.
* **Documentation lane** — additive evidence in both repositories;
  historical reports and frozen contracts untouched.

## 11. Release and Quellight-repin sequence (frozen)

1. L0 freeze (this commit).
2. Lane A implementation commit; Lane B focused-tests commit.
3. Old-tree negative controls in disposable worktrees at
   `1d1c9f6…` (+ uncommitted declaration flip for control 2); worktrees
   removed afterward; evidence in the implementation record.
4. Lane C: candidate release-source commit (13 × `0.3.0-rc.1`, exact
   pins, release-set identity); local pre-dispatch checks: focused tests,
   typecheck, lint, build, `verify:release-set`, pack + tarball scan,
   `git diff --check`.
5. Fetch; confirm remote did not advance; push the release source
   (fast-forward only); fetch again.
6. Dispatch `release.yml` with the exact pushed SHA, `0.3.0-rc.1`,
   `vict-0.3.0-rc`; monitor to terminal completion; record run ID/URL.
7. Independent registry verification (versions, tags, integrity,
   `latest` still `0.2.0`, no stable `0.3.0`); registry-only
   `verify:release-consumer -- --registry` locally against the
   candidates.
8. Lane Q: Quellight repin from the public registry only (lockfile via
   real registry install), capability `@2`/`write` + host policy +
   verifier expectations; focused suites.
9. Quellight authoritative ladder ONCE (`npm ci`; `verify:consumer`;
   `verify:quellight` incl. the offline conversation/ceremony path;
   `npm audit --omit=dev`; `git diff --check`).
10. Documentation/status commits in both repositories.

Truthful end state: `VICT-M-1 REMEDIATED — AWAITING INDEPENDENT
VERIFICATION`; `latest` remains `0.2.0`; stable `0.3.0` unpublished; Q5
remains formally closed; Q6 not begun.
