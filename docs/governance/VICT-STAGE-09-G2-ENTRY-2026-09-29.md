# VICT Stage 09 — G2 ENTRY record (freeze of the accepted controlled-recovery contract), 2026-09-29

## Status: ENTRY FROZEN per owner authorization — the G2 command policy below is contract for the G2 candidate work

## 1. Owner acceptance (verbatim)

> "I accept the G2 proposal's four open defaults: a 10-minute preparation
> TTL, `run.signal` as the new scope, one `POST /vict/v1/confirmations`
> prepare endpoint, and a minimum 90-day retention window for digest-only
> receipt records. Administrators continue to receive new scopes under the
> existing role policy, but receive no confirmation bypass."

The owner further directed (verbatim excerpts): the current proposal head
was NOT to be treated as already reviewed byte-for-byte ("Verify live
refs"); a fresh independent reviewer must challenge everything added after
the reviewed `034281d…`; "especially the five-replacement rule: a same-key,
same-payload retry must not be mislabeled as an idempotency digest
conflict"; an exact-file/SHA caller inventory and an explicit coordinated
version/release migration plan recorded before freezing; a read-only check
of `radz2291/VICT-Quellight` for caller impact; Stage 9's G3 product claim
not silently amended; publication kept a separate decision; fresh
independent verification of the final G2 entry bytes and migration plan.

## 2. Open-item resolution (D-OPEN-1..4 — all ACCEPTED as worded)

| Item | Resolution (ACCEPTED) |
| --- | --- |
| D-OPEN-1 | Prepare receipt TTL: **10 minutes** |
| D-OPEN-2 | New scope name **`run.signal`**; corrected role semantics stand (administrator holds every closed-vocabulary scope BY POLICY via `administrator: [...ACTOR_SCOPES]`; non-administrator classes explicit-grant only; **no confirmation bypass** — the fence governs legacy shapes for every actor class) |
| D-OPEN-3 | Single prepare route `POST /vict/v1/confirmations` |
| D-OPEN-4 | Receipt retention: **minimum 90 days** pre-purge; receipts are digest+identity only |

## 3. Owner-directed amendment (P-23/P-24, replacing the P-22 replacement-limit conflict label)

`VICT_COMMAND_IDEMPOTENCY_CONFLICT` is reserved EXCLUSIVELY for a DIFFERENT
digest on a settled key (Phase 1). A same-key+same-payload (same digest)
prepare retry beyond the five-replacement budget NEVER yields that code: it
replays the latest receipt's truthful status (prepared → same receipt;
expired → the receipt-of-record's truthful status, non-echoing), inviting a
fresh prepare key. A different digest on the same key is never a
replacement attempt — Phase 1 answers `VICT_COMMAND_IDEMPOTENCY_CONFLICT`
first (a changed confirmation is a NEW intent requiring a NEW key). Both
semantics are pinned as proof rows P-23/P-24 in the proposal §6.

## 4. Caller inventory — the four migrated commands, at `main` `c3f9663cadf80206645a62322e5933ff19c108e9`

See §4 table. — the four migrated commands, at `main` `c3f9663cadf80206645a62322e5933ff19c108e9`

Method: fresh `git grep` at the named commit (`origin/main` verified `c3f9663`
via ls-remote 2026-09-29). Writer/dispatch surfaces are migrated in place;
read-only classifiers are re-labeled, not re-shaped.

| Caller surface (exact file, blob SHA at c3f9663) | Commands touched | Migration action |
| --- | --- | --- |
| `packages/server/src/commands.ts` (blob `1e4a7b93…7827`) | `run.cancel`, `activation.select`, `release.select`, `release.rollback` | Registry entries: names/fields/scopes UNCHANGED; consumption requires `confirmation{receiptId}`; legacy shape → `409 VICT_CONFIRMATION_REQUIRED` every actor class; `run.resolve`/`run.signal` added with scopes `run.resolve`/`run.signal` |
| `packages/server/src/http.ts` (blob `21946059…51ec3`) | the four POST routes → confirmation-required; NEW `POST /vict/v1/confirmations`, `GET /vict/v1/confirmations/:receiptId`, `POST /vict/v1/runs/:runId/resolve`, `POST /vict/v1/runs/:runId/signal` | In-place reshape; read routes UNCHANGED |
| `packages/cli/src/commands.ts` (blob `35e22c38…16518`) | `run cancel`, `activation select`, `release select`, `release rollback` → two-step `--prepare` / `--confirm <receiptId> --key <Idempotency-Key>`; NEW `run resolve`, `run signal`, `confirmation get` | Breaking reshape (documented; usage guidance names the two steps; never auto-confirms) |
| `packages/server/test/http.test.ts` (blob `2761a27d…f25c5` — recomputable via `git rev-parse c3f9663:packages/server/test/http.test.ts`) | legacy POST route callers | Re-shaped to prepare→confirm + P-11/P-12 negatives |
| `packages/server/test/authorization-matrix.test.ts` (blob `e1051dcc…62e20`) | scope matrix | Two permanent rows added (P-11 actor+developer; P-12 administrator no-bypass); confirmation-status read both directions |
| `packages/server/test/command-reliability.test.ts` (blob `4074c7f5…`), `packages/server/test/operator-reads.test.ts` (blob `25472f83…`) | idempotency/read suites | Extended for receipt lifecycle; read surface asserted UNAMENDED |
| `packages/control/src/control-plane.ts` (ChangeSet machinery, S9-03 reuse decision at G2 exit, recheck at entry) | — (no shape change) | Recheck only |
| `packages/runtime/src/control-types.ts` (blob `66440157…a3c18`), `orchestration-commands.ts` (blob `90c8a300…1ddb58`), `runtime.ts`, `kernel/src/types.ts` (blob `3d944e4a…d345d6`) | `run.cancel`/resolution DRIVER mechanics (internal executor references, NOT external command callers) | The receipt-gated `run.resolve` command binds the existing internal executor (`resolveBlocked`); `operator.resolve` stream-inspection privilege unchanged |
| `apps/studio/src/lib/shared/contract.ts` (blob `a701028d…958`), `apps/studio/src/lib/server/app-server.ts` (blob `22b7da73…7a6`), `apps/studio/src/lib/server/targets.ts` (blob `b7c7a102…5148`) | READ-ONLY surface — Studio declares NO mutations today | `RESOURCE_BINDINGS` classification unchanged; S9-04 confirmation journeys are the only addition (post-acceptance implementation) |
| `scripts/verify-stage9-inventory.mjs` (blob `797d4209…1178`) | inventory accounting | G2 rows added; G1 read-surface registry bytes asserted UNAMENDED |
| `packages/store-sqlite/test/orchestration-corrective.test.ts` | `run.cancel` driver test (internal mechanics) | Unchanged (driver layer, not the command surface) |
| **External: `radz2291/VICT-Quellight` read-only** (`origin/main` verified live) | **ZERO callers** of any of the four commands or their HTTP paths (grep at current main `7ee427ac` — no matches for `run.cancel`, `activation.select`, `release.select`, `release.rollback`, `runs/cancel`, `releases/select`, `releases/rollback`, `activations/select`) | Documentation-only impact statement: Quellight's target composition must adopt the new contract before any Studio-support claim (its own increment; D-8 unchanged; **the historical Quellight observation and Stage 9's G3 product claim are NOT amended by G2**) |
| `examples/*` (application-proof, reference-app, ui-showcase, ara-proof, orchestration-proof) | NO callers of the four HTTP/CLI mutation shapes (grep-verified) | None |

## 4. Coordinated version / release migration plan (FROZEN for G2)

- The G2 contract change is ONE coordinated versioned migration recorded as
  a release-set candidate note against the current coordinated set
  `vict-release-set@1` / `0.4.0-rc.1` (14 members): the four commands'
  `vict.command@1` envelopes gain the required `confirmation` object (same
  major contract, additive-with-fence semantics per D-4 — legacy shapes
  break, per the ratified coordinated design; NO dual-running window).
- `run.resolve`/`run.signal` and the confirmation surface join the SAME
  coordinated set (no separate interim release).
- **Publication is NOT a G2 implementation prerequisite and remains a
  separate explicit owner decision** at the G2 exit report; local
  integrated evidence precedes any publication decision.
- Because the legacy fence is atomic per target composition, the release
  plan's consumer guidance is: any external consumer of the four commands
  (verified: NONE today, including VICT-Quellight `main` `7ee427ac`) must
  adopt the prepare→confirm flow before calling a Stage 9-capable target.

## 5. Frozen entry bytes (recorded at the freeze commit)

- Coordinated-recovery contract (post-review amended proposal):
  `docs/governance/VICT-STAGE-09-G2-PROPOSAL-2026-09-29.md`, content
  SHA-256 `f270b17cfd97c5a7be60a4bbfff31a4619f1d3ac3e4f03b45f58d72bed16f7c1`. The reviewed baseline was
  `034281d…`; the entry review `8f7501f…` challenged the delta to
  `5b9885a`; the E-1..E-6 wording/fact fixes and this record are the
  freeze commit. This entry record's own integrity is anchored by the
  FREEZE COMMIT SHA (below) rather than a self-referential digest.
- Owner acceptance §1 is quoted verbatim from the owner's authorization
  message (2026-09-29).

## 6. Independent verification gates for the entry freeze (before G2 work starts)

1. Fresh reviewer challenge of EVERYTHING added after the reviewed
   `034281d255ae07c5fb6127e25b8e144dbff7fec9` — the proposal delta
   (`034281d..HEAD`) INCLUDING this entry record: the P-23/P-24 semantics,
   §12 acceptance record, inventory fact-check, migration plan fact-check.
2. Fresh independent byte verification of the final entry commit (digests
   recomputed, owner acceptance quoted verbatim, remote refs live-checked).