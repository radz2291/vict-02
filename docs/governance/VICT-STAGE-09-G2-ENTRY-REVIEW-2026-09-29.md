# VICT Stage 09 — G2 ENTRY freeze review (independent, pre-acceptance), 2026-09-29

Reviewer: fresh independent, paper audit, own clone; did not author any audited bytes.
Scope: delta `034281d255ae07c5fb6127e25b8e144dbff7fec9..5b9885a685324d03ebc15646eaec2788081310a5`
(`docs/governance/VICT-STAGE-09-G2-PROPOSAL-2026-09-29.md` amendments + the NEW
`docs/governance/VICT-STAGE-09-G2-ENTRY-2026-09-29.md`), plus a final coherence
read of the full proposal file as the entry contract.

## Live-ref verification (own tooling)

- `git ls-remote https://github.com/radz2291/vict-02.git`
  `refs/heads/codex/stage9-g2-proposal` = `5b9885a685324d03ebc15646eaec2788081310a5` ✔;
  `refs/heads/main` = `c3f9663cadf80206645a62322e5933ff19c108e9` ✔.
- Audited bytes from own clone at exactly `5b9885a` (no repairs made).
- `VICT-Quellight` `refs/heads/main` = `7ee427ac1abbb864922eef16f81d28a1394f3666` ✔.

## 1. Five-replacement / conflict rules (P-22/P-23/P-24 + entry §3)

The core owner directive is satisfied: on every path the documents describe, a
same-(actor, command, key)-same-digest retry NEVER yields
`VICT_COMMAND_IDEMPOTENCY_CONFLICT` — within budget it issues a replacement
receipt (P-22); beyond budget it replays the latest receipt's truthful status
(P-23); on the CONSUME side it replays the settled recorded result regardless of
receipt state (§5 Phase 1; P-15/P-17/P-18/P-21). A different digest is never a
replacement attempt (P-24), so the budget, keyed per (actor, command, key) as
P-22 words it, can never be diluted by a digest change and needs no explicit
reset rule — a digest change forces a NEW key, which trivially resets the
budget. (a)/(b)/(c)/(e) verified coherent; (d) consistent: §5's Phase
ordering never routes a different-digest same-key request into replacement
logic, because replacement (P-22) requires same-digest + expired receipt, and
a prepared-but-unsettled same key with a different payload is answered by the
existing idempotency digest check (P-1/P-7), not by replacement logic.

Constructed mislabel attempts — all refuted by the documented paths:

- Same payload after budget exhaustion with the latest receipt consumed/spent
  by another key → P-23's generic "truthful receipt-of-record status,
  non-echoing" covers consumed/spent (no conflict code, no echo).
- Same digest consume retry after the receipt was spent by a different key →
  Phase 1 replays (the consume claim is bound to the digest of the COMPLETE
  confirmation request INCLUDING the receipt ID).
- Cross-command key reuse → P-8's `_CONFLICT` (see E-1: wording tension, not a
  mislabel of a retry).

## 2. §12 acceptance-record fidelity

`§12` of the proposal and `§1`/`§2` of the entry record match verbatim on the
owner's four defaults (10-min prepare TTL; `run.signal` scope; ONE
`POST /vict/v1/confirmations`; minimum 90-day digest-only receipt retention)
and on the no-confirmation-bypass consequence ("administrators continue to
receive every scope … the confirmation fence (never scope absence) prevents any
administrator legacy-shape bypass" / entry §2's D-OPEN-2 wording). The claim
"all four open items ACCEPTED" is accurately scoped: §11's D-OPEN-4 carries the
inline ACCEPTED pin, the parenthetical "(All four open items ACCEPTED as worded
at G2 entry — see §12.)" anchors the set, and §12 records the acceptance — no
overclaim. (Minor wording note in E-2.)

## 3. Caller-inventory fact-check (entry §4)

Recomputed 17 blob SHAs from own clone via `git rev-parse c3f9663:<path>`.
All inventory blob SHAs verify: `commands.ts 1e4a7b93`, `http.ts 21946059`,
CLI `commands.ts 35e22c38`, `http.test.ts 2761a27d`,
`authorization-matrix.test.ts e1051dcc`, `command-reliability.test.ts
4074c7f5`, `operator-reads.test.ts 25472f83`, `control-types.ts 66440157`,
`orchestration-commands.ts 90c8a300`, `kernel/src/types.ts 3d944e4a`,
`contract.ts a701028d`, `app-server.ts 22b7da73`, `targets.ts b7c7a102`,
`verify-stage9-inventory.mjs 797d4209` (see E-3 for two wrong DIRECTORY
names whose SHAs still match the correct paths).

Own grep for other writers of the four shapes at `c3f9663` (HTTP routes,
command names, CLI shapes) finds no caller MISSING from the inventory; the
remaining grep hits are internal driver/event mechanics (`run.cancelled`,
`run.cancel_requested`, idempotency-store conformance test data) and read-only
paths (`.../selected`, `releases/selections`) — consistent with the inventory's
classification. `examples/*` re-derived: ZERO matches for all four shapes ✔.
Quellight zero-caller claim independently re-derived from a fresh read-only
clone of `radz2291/VICT-Quellight` at `main` `7ee427ac` (live ls-remote verified):
grep over the whole repo for `run.cancel|activation.select|release.select|
release.rollback|runs/cancel|releases/select|releases/rollback|
activations/select` = ZERO matches ✔ (documentation-only impact statement
stands; G3 claim untouched).

## 4. Migration plan (entry §4 second half)

Coherent with D-4: ONE coordinated versioned migration against
`vict-release-set@1 / 0.4.0-rc.1`, "additive-with-fence… legacy shapes break",
NO dual-running window (matches proposal §7.5 and the ratified D-4 meaning);
`run.resolve`/`run.signal` join the same coordinated set; publication kept a
separate explicit owner decision; Quellight documentation-only, its historical
observation and the Stage 9 G3 product claim explicitly NOT amended ✔.

## 5. Internal consistency of the amended proposal

P-22/P-23/P-24 fit the §6 proof matrix and resolve the R/A-N lineage; §4.5/§4.6
now live inside §4 (A-N-3 fixed); the former dangling `§4.6` reference resolves
(§4.5 "see 4.6" → §4.6 exists); `## 6.1`/`## 6.2` demoted to `###` correctly;
D-OPEN-4 added and cross-linked to A-N-2; §11 ↔ §12 cross-reference resolves;
no new overclaim added after `034281d` (the P-23/P-24 wording is stronger than
needed only in the "exclusively" clause — E-1; nothing else overclaims).
Entry §5 honestly states digests are appended to §6 AFTER independent
verification; it does NOT claim already-verified bytes (note E-4 on its
"Recorded immediately below" phrasing). Entry §6 gate 2 covers the digest
recomputation.

## Findings

### E-1 — NON-BLOCKING — "Exclusively … on a settled key (Phase 1)" is over-narrow wording
Evidence: P-23 (and entry §3) state `VICT_COMMAND_IDEMPOTENCY_CONFLICT` is
"reserved EXCLUSIVELY for a DIFFERENT digest on a settled key (Phase 1)". But
the documents themselves pin two other paths that produce the same code: P-1
("a different payload under the same prepare key → `_CONFLICT`" — an UNSETTLED
claim) and P-8 (cross-command key reuse via `findReceiptByActorKey` →
`_CONFLICT` — a different command namespace, not a Phase-1 settled lookup by
(actor, command, key)). Neither is a same-command same-digest retry, so the
owner's actual directive is NOT violated and no retry can be mislabeled; a
literal reading of the exclusivity sentence is just inaccurate about which
paths produce the code. Suggested amendment: reword P-23/entry §3 to "reserved
exclusively for DIFFERENT-digest attempts and cross-command/cross-namespace
key reuse (P-1/P-7/P-8); it is NEVER emitted for a same-key same-digest retry"
— or equivalently scope "settled key" to the same-command namespace and add
"and for a digest mismatch on an unsettled same-key prepare claim (P-1)".

### E-2 — NON-BLOCKING — §11 ordering leaves D-OPEN-3 without an inline ACCEPTED pin
Evidence: proposal §11 now lists D-OPEN-1, D-OPEN-2, D-OPEN-4 (ACCEPTED
inline), then the parenthetical "(All four … ACCEPTED … see §12.)", then the
D-OPEN-3 bullet, which carries no inline ACCEPTED marker. §12 covers it, so
the claim is true, but the list reads as if D-OPEN-3 were still open.
Suggested amendment: move D-OPEN-3 above the parenthetical (restoring
1/2/3/4 order) and add "**ACCEPTED (2026-09-29): single route.**".

### E-3 — NON-BLOCKING — two wrong directory names in the entry §4 caller inventory
Evidence: entry §4 rows cite `apps/studio/src/lib/shared/app-server.ts` and
`apps/studio/src/lib/shared/targets.ts`; at `c3f9663` these blobs
(`22b7da73…`, `b7c7a102…`) live at `apps/studio/src/lib/server/app-server.ts`
and `apps/studio/src/lib/server/targets.ts`. Blob SHAs are correct and
recomputable, so the fact-check still lands; only the recorded paths are
wrong. Suggested amendment: fix both paths in the entry §4 table. (Cosmetic,
same table: the `http.test.ts` row's SHA text is garbled
("_blob 2761a27d…0f25c96→2761a27d prefix; full 2761a27d…_"); replace with the
single verified blob `2761a27d`.)

### E-4 — NON-BLOCKING — entry §5 "Recorded immediately below" phrasing
Evidence: entry §5 says the freeze commit's SHA and digests are "Recorded
immediately below at the freeze commit", yet nothing is recorded below: §5
then correctly says they are appended to §6 by the stage manager AFTER
independent verification. The honesty of §5 (no claim of verified bytes) is
intact; only the first sentence is misleading. Suggested amendment: delete
the sentence fragment "Recorded immediately below at the freeze commit" or
replace with "To be recorded by the stage manager at the freeze commit".

### E-5 — NON-BLOCKING — duplicate "## 4" headings in the entry record
Evidence: entry has "## 4. Caller inventory …" and a second "## 4. Coordinated
version / release migration plan …" (the migration section should be §5, with
the placeholder/gates sections renumbered). Purely structural; all
cross-references inside the entry (§3 → "proposal §6") resolve, and no
§-reference points into the duplicated numbering. Suggested amendment:
renumber the migration heading to §5 and the placeholder/gates to §6/§7.

### E-6 — NON-BLOCKING — §5 Phase-1 blanket wording vs the prepare-replacement rule
Evidence: §5 Phase 1 says a settled same-key/same-digest claim replays the
recorded result and "this PRECEDES every receipt-state check" — but for the
PREPARE namespace (`confirmation.prepare:<command>`), §4.4 and P-22 define
that after the issued receipt EXPIRES, a fresh same-key+same-digest prepare
issues a REPLACEMENT receipt (within budget) rather than replaying the
now-expired receipt. §6 rows P-22/P-23 resolve this correctly; only §5's
blanket "precedes every receipt-state check" sentence can be read to
contradict the prepare-side replacement path. Suggested amendment: scope §5
Phase 1's precedence sentence to "every receipt-state check on the consume
path; the prepare path is governed by the replacement rules of P-22/P-23
(§4.4)".

Challenge-1(e) answer: the budget is pinned as counted per (actor, command,
key) (P-22). No explicit "resets on digest change" rule is needed and none is
given — correctly, because P-24 makes a digest change impossible to be a
replacement at all (it must be a NEW key), so a digest change cannot alter any
budget. Adequately pinned; no severity.

## Verdict

**PASS WITH NON-BLOCKING FINDINGS.** No mislabeling path found for
same-key+same-digest retries on any path the documents describe; §12 matches
the owner's acceptance; the caller inventory and migration plan fact-check
passed under independent re-derivation; the entry §5 placeholder honestly
defers digest recording until after verification. All findings E-1..E-6 are
wording/structure amendments; none blocks the entry contract's semantics.