# Stage 9 G2 — Independent Verification Record (2026-09-29)

Candidate: `codex/stage9-g2-proposal` @ `56bc20465288c25ca7ffce4590707a4c8553aa61`
Base (frozen entry contract): `737af3826632d5c0c3b169613238ffc15311b5f7` (origin/main)
Verifier: fresh, independent; did NOT build the candidate and performed no repairs.
Method: live remote verification + direct code reading + executed suites at the candidate.

## Verdict

**PASS WITH NON-BLOCKING FINDINGS**

## 0. Live linearity

- `ls-remote` live: `codex/stage9-g2-proposal` = `56bc204…` (head), `main` = `737af38…`.
- Lineage SHAs recomputed and all contained (merge-base checked): b640b58 (core),
  c9bd955 (transport), 61bcf1c (journeys) → 83dfcdb (integration) → c37ecf6 (style) → 56bc204.
- All five builder/candidate branches are pushed, SHA-byte-exact, live on origin
  (`codex/stage9-g2-core` b640b58, `codex/stage9-g2-transport` c9bd955,
  `codex/stage9-g2-journeys` 61bcf1c, `codex/stage9-g2-proposal` 56bc204).
- Entry-record cited verify branch `review/stage9-g2-entry-verify-20260929` @ `0272f0d` exists live.

## 1. Entry-freeze fidelity — VERIFIED

- `git diff 737af38..56bc204 -- docs/governance/` is EMPTY: the proposal and the entry
  record were not touched by any candidate commit.
- Proposal digest re-derived with the pinned §8 method: after CRLF normalization
  (strip `\r`, re-add CRLF per line) SHA-256 = `f270b17cfd97c5a7be60a4bbfff31a4619f1d3ac3e4f03b45f58d72bed16f7c1`
  — matches the §6 freeze pin and the §8 re-derivation. (The LF git-blob hash
  `08970352…954` differs exactly as §8 warns; the CRLF-normalized method was used here.)
- Entry record §8 verdict text ("PASS WITH NON-BLOCKING FINDINGS") matches the cited
  live verify branch @ `0272f0d`.

## 2. Fence falsification attempts — all REJECTED by the code

Read at head: `packages/server/src/commands.ts` (3178 lines), `http.ts` (1201 lines).

(a) **Legacy fence in the command service, all actors.** `requireConfirmationMember`
(commands.ts:2818) throws `VICT_CONFIRMATION_REQUIRED` inside `#dispatchIdempotent`
for every command in `CONFIRMATION_REQUIRED_COMMANDS` (run.cancel, release.select,
release.rollback, activation.select, run.resolve, run.signal) BEFORE any dispatch.
The check is unconditional on the actor: the administrator all-scopes policy grants
scopes (assertCommandScope passes) but cannot skip the fence. No bypass flag exists
(grep: no `bypass`/`skipConfirmation`/`allowUnconfirmed` in server code). No
transport-only fence: the transport merely bridges and forwards.

(b) **Complete-request digest binding, Phase 1 first.** Phase 1 settled lookup uses
`requestDigest(payload)` where the canonical payload INCLUDES the `confirmation`
member (`receiptId`), so any digest change (including a different receipt id) is a
NEW intent → `VICT_COMMAND_IDEMPOTENCY_CONFLICT` (checked in both the settled-replay
and the raced-claim paths). A settled replay answers for EXPIRED and SPENT receipts
(P-17/P-18, `#settleStoredReceipt` best-effort convergence under fence). P-23/P-24
hold: beyond the CONFIRMATION_REPLACEMENT_BUDGET=5 a same-key+same-digest prepare
replays the latest truthful status (`replayedStatus: true`) and NEVER a conflict;
a changed digest always answers CONFLICT before replacement logic. The semantic
`confirmationReceiptDigest` excludes the confirmation member and, separately, binds
prepared↔consume parameters; the two digests serve distinct pinned purposes.

(c) **Separate stores, no receipt payload bytes.** The receipt store port
(`CommandConfirmationReceiptStore`, packages/runtime/src/control-types.ts) is
distinct from `commandIdempotency`. `CommandConfirmationReceipt` carries
digests + identities only (`payloadDigest`, `subjectId`, ids, fence, budgets) —
no `payload`/`payloadBytes` member anywhere in the record or the InMemory/SQLite
write paths.

(d) **Scope outermost, consistent order.** In the service dispatch the authorization
scope is asserted before the confirmation path is entered (403
`VICT_ACTOR_SCOPE_DENIED` before any confirmation mention); prepare-side P-13 asserts
the same order (denied prepare leaves an EMPTY receipt chain, asserted in the test).

(e) **Non-echoing; hostile containers.** Unknown receipts, other actors' receipts and
wrong-command receipts answer `VICT_CONFIRMATION_UNAVAILABLE` /
`VICT_CONFIRMATION_MISMATCH` with no receipt bytes. `confirmationOf` rejects
arrays/non-objects/malformed containers (bounded receiptId ≤128) → fail closed as
unavailable; the transport additionally validates below transport (http.ts:625/711).

(f) **Composition ports, no invented timer-fire.** `run.resolve` binds the EXISTING
`resolveBlocked` orchestration path (`RunResolutionPort`), `run.signal` binds the
EXISTING durable-signal driver (`RunSignalPort`); both FAIL CLOSED
(`VICT_RUN_STORE_UNAVAILABLE`) when not composed (commands.ts:2369–2410).

## 3. Executed suites (exact counts)

| Suite | Result |
|---|---|
| `npx vitest run --project unit` run 1 | 120 files: 119 passed, 1 failed — single 20s timeout in `packages/store-sqlite/test/orchestration-conformance.test.ts` HIGH-3 |
| `npx vitest run --project unit` run 2 (per TWICE protocol) | **120 files / 2404 tests PASSED** — run-1 failure classified LOAD-CONTENTION (import 192.81s), not real |
| `npx vitest run` (apps/studio) | **50/50** (7 files) |
| `packages/server/test/confirmation-matrix.test.ts` | **29/29** (within unit run 2; isolated rerun also green) |
| `node scripts/verify-stage9-inventory.mjs` | **INVENTORY OK — G1 reads on all three surfaces UNAMENDED**; classification counts pre-existing 20 / legacy-mutation 4 / stage9-g1-read 11 / shared 1 / g2 6; single prepare route (D-OPEN-3) accounted |
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | clean |
| `npm run format:check` | clean |
| `npm ci` + `npm run build --workspaces --if-present` | success; store-sqlite/server/runtime dists present |

## 4. Proof-matrix coverage

- All 24 P-rows exist as NAMED tests (`it('P-n: …')`) in
  `packages/server/test/confirmation-matrix.test.ts`; 29 tests pass (24 + 5 extras).
- Spot-read (P-13, P-17, P-19, P-21, P-22, P-23): assertions are truthful, not
  tautological. P-19 asserts fail-closed expiry AT THE CLAIM (`startConsumption` at/after
  expiry is rejected; a granted claim completes under its fence). P-23 asserts the
  truthful expired replay (`replayedStatus: true`, chain length pinned at 6 original+5)
  and NO conflict code anywhere on the same-key+same-digest path. P-22 asserts a NEW
  replacement receipt with incrementing `replacementAttemptNo` and the original's audit
  state. P-21 asserts the receipt store settles `consumed` under the consuming key,
  exactly ONE effect, and replay returns the recorded success (the Phase-1 replay path
  exercises the idempotency store; see F-4 for the minor assertion-scope note).

## 5. Studio journey

- Route declared in the application definition (`apps/studio/src/lib/application/definition.ts`:
  route `confirmations` / path `/confirmations` / screen `s.confirmations`, island
  `cmp.confirmation-review`); `tests/app-definition.test.ts` asserts the G1 invariants
  unchanged (additive only).
- Confirmed consumption shape is the ONE canonical versioned envelope: semantic fields
  inside the closed payload + top-level `confirmation{receiptId}` (transport seam injects
  it into the canonical payload exactly once; no fabricated success when the capability is absent).
- Journey relay: target-aware, server-held credential (`credentialRef` resolved server-side;
  the selector/credential is never forwarded to the target), absent/under-credentialed
  targets fail closed before any fetch; `expectedRevision` parsed to number|null below
  transport with no fetch on malformed input.
- `qa-artifacts/stage9-g2/journey-plan.md` exists; `s904-confirmations-journey.png`
  exists and renders a real /confirmations page (journey sections + review panel — see F-3).

## 6. Scope / exclusions

- Diff 737af38..56bc204 (32 files): NO Quellight edits (grep: zero matches), NO FT-1
  anchors (no run-detail route navigation; FT-1 text intact in docs), no package.json
  version/publication changes, no product-activation claims, no docs/governance changes
  at all — STATE file untouched (asserts nothing beyond G2-pending / "NOT AUTHORIZED",
  consistent with the pending gate).

## Findings

- **F-1 (non-blocking)**: first full unit run contained ONE parallel-load timeout
  (sqlite `orchestration-conformance.test.ts` HIGH-3, 20s). Direct clean rerun of the
  identical suite passed 2404/2404 → classified load-contention (consistent with the
  retained FT-4 load-sensitive timeout pattern already in the STATE record), not a
  candidate defect.
- **F-2 (non-blocking)**: dead transport bridge branches with `TODO(integrator)`
  comments remain in `packages/server/src/http.ts` (the `confirmationCapability ===
  undefined` arms). They are UNREACHABLE in the integrated candidate (the command
  service always exposes `prepareConfirmation`/`getConfirmationStatus`) and both fail
  closed anyway. Hygiene item only.
- **F-3 (non-blocking)**: the journey screenshot `s904-confirmations-journey.png`
  renders the real /confirmations page but shows the review panel in its truthful EMPTY
  state ("No confirmation receipt is being reviewed"), so the image evidences the page/
  panel mechanics rather than a populated human-review card.
- **F-4 (non-blocking)**: P-21 asserts the receipt store settlement and exactly-one
  effect directly; the idempotency-store side of convergence is exercised through the
  Phase-1 replay rather than asserted as a direct store read. No tautology; note only.

Findings F-1..F-4: NO BLOCKERS. No material new owner choice discovered; the candidate
is faithful to the frozen entry contract and the proposal §4/§5/§6 matrix.

## Recommendation

Proceed to the G2 owner gate decision; the candidate is verified as-is. The G2 gate
state remains G2-PENDING until the owner accepts; nothing here authorizes publication,
activation, FT-1 work, or any Quellight edit.