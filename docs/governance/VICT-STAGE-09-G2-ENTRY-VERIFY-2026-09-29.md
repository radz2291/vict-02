# VICT Stage 09 — G2 ENTRY VERIFY record (fresh independent byte verification), 2026-09-29

- Verified head: `codex/stage9-g2-proposal` @ `089c1bac9650d5652b921db0f25c73f4d8e6b649` (fresh clone; working tree clean; zero modifications to audited bytes).
- Verdict: **PASS WITH NON-BLOCKING FINDINGS** (findings V-1..V-3 below; none alter contract semantics).

## 1. Live remote refs (ls-remote, checked twice: audit start and audit end)

Start and end (identical, no races):
- `refs/heads/codex/stage9-g2-proposal` = `089c1bac9650d5652b921db0f25c73f4d8e6b649` ✅ expected
- `refs/heads/main` = `c3f9663cadf80206645a62322e5933ff19c108e9` ✅ expected
- `refs/heads/review/stage9-g2-entry-20260929` = `8f7501f649dca03f7e2942d531fa262578831533` ✅ expected

## 2. §5 digest of the entry record — RECOMPUTED, MATCHES

`docs/governance/VICT-STAGE-09-G2-PROPOSAL-2026-09-29.md` at `089c1ba`:

- CRLF-content SHA-256 (git blob bytes with CRLF line endings, i.e. `sha256sum` of `git cat-file blob … | unix2dos`, equivalent to `certutil -hashfile` over a Windows CRLF checkout):
  `f270b17cfd97c5a7be60a4bbfff31a4619f1d3ac3e4f03b45f58d72bed16f7c1` ✅ — byte-identical to entry record §5.
- LF-content SHA-256 (same git blob before line-ending conversion):
  `089703525954d7f2826254a7f2edc017c3506ae86c04375f34aadd6cef894954` (noted for future verifiers; §5 pins the CRLF form).
- Same-byte checks: `034281d` → `725084e7…c2372`; `5b9885a`/`8f7501f` (review head) → `626b8fe9…798e`; file is NOT present at `main c3f9663` (consistent).

## 3. Criterion checks

- (b) Owner acceptance §1: verbatim-faithful quote of the four accepted defaults (10-minute TTL; `run.signal` scope; ONE `POST /vict/v1/confirmations`; minimum 90-day digest-only retention) and the no-confirmation-bypass consequence. Cross-checked against proposal §12 (`089c1ba`, lines ~355–364): "prepare TTL **10 minutes**; D-OPEN-2 **`run.signal`**; D-OPEN-3 **one** `POST /vict/v1/confirmations`; D-OPEN-4 **minimum 90 days** (digest-only)… the confirmation fence (never scope absence) prevents any administrator legacy-shape bypass." ✅
- (c) E-1..E-6 fixes:
  - E — consume-path `VICT_COMMAND_IDEMPOTENCY_CONFLICT` scoping with truthful-receipt replay exclusion: present (proposal §5 outcome precedence, `089c1ba`) ✅
  - E — Phase-1 scope limited to consume; prepare side pinned to P-22..P-24 ("the PREPARE side never uses the outcome table at all"): present ✅
  - E — D-OPEN inline ACCEPTED pins: D-OPEN-3 "ACCEPTED (2026-09-29) as worded" ✅, D-OPEN-4 "ACCEPTED (2026-09-29): 90 days" ✅, D-OPEN-1 "ACCEPTED (2026-09-29): 10 minutes — moved here from its 4.4 default statement; the default is now the accepted value" (§4.4 line 114 now carries `default 10 minutes — D-OPEN-1`) ✅, D-OPEN-2 pinned in the summary bullet ("D-OPEN-2 `run.signal` scope name ACCEPTED as worded") ✅
  - E — inventory paths normalized to `apps/studio/src/lib/server/app-server.ts` / `targets.ts` and `packages/server/test/*`: present ✅
  - E — no duplicate `## 4` headings: **NOT satisfied** in the entry record — see finding V-1. (Proposal has a single `## 4` with 4.1–4.6 subsections; no duplication.)
  - E — §5 non-self-referential (anchor is the freeze commit SHA, not a digest of the record itself): satisfied ✅
- (d) Diff `5b9885a..089c1ba`: touches ONLY the two governance docs (`docs/governance/VICT-STAGE-09-G2-ENTRY-2026-09-29.md`, `docs/governance/VICT-STAGE-09-G2-PROPOSAL-2026-09-29.md`) ✅
- Diff-scope sanity `034281d..089c1ba`: same two docs files only; zero production/code changes ✅

## 4. P-23/P-24 semantics — proposal §6 and entry record §3

- Proposal §6 proof rows at `089c1ba`:
  - P-22: prepare-after-expiry replacement budget (max five replacements per actor+command+key) ✅
  - P-23: a same-key+same-digest prepare beyond the budget NEVER yields `VICT_COMMAND_IDEMPOTENCY_CONFLICT` — that code is reserved exclusively for a DIFFERENT digest on a settled key (Phase 1); replays the LATEST receipt's truthful status, non-echoing, inviting a fresh prepare key ✅
  - P-24: a DIFFERENT digest on the same key is not a replacement attempt at all — Phase 1 answers `VICT_COMMAND_IDEMPOTENCY_CONFLICT` before any replacement logic ✅
- Entry record §3 mirrors exactly the same semantics (same-payload retry never mislabeled as a digest conflict; different digest → new intent/new key; truthful receipt replay).
- Coherence: P-22 (budget) and P-23 (budget exhaustion → truthful replay, not a conflict label) are mutually consistent; P-24 orders Phase-1 digest-conflict ahead of all replacement logic. ✅

## 5. Caller inventory blob SHA spot-recompute at `main c3f9663` — ALL MATCH

Recomputed via `git rev-parse c3f9663:<path>` and compared byte-for-byte to the §4 table (15 rows recomputed, exceeding the required 8):

| Path | Recomputed blob SHA at c3f9663 | Match |
| --- | --- | --- |
| `packages/cli/src/commands.ts` | `35e22c38965de0c321b5d4b93d79998eb6f16518` | ✅ |
| `packages/server/src/commands.ts` | `1e4a7b93c1099aaefeb8eb52a251823dfc9d7827` | ✅ |
| `packages/server/src/http.ts` | `2194605953319161bf9cb39b2302f33ed57b1ec3` | ✅ |
| `packages/server/test/http.test.ts` | `2761a27d0d5eb528df3d7dd5bfd142d6690fe5c4` | ✅ |
| `packages/server/test/authorization-matrix.test.ts` | `e1051dccc96ccca7644862254b5c1f201562e20c` | ✅ |
| `packages/server/test/command-reliability.test.ts` | `4074c7f5955d63795292bd99892fcbfcfd07e4f8` | ✅ |
| `packages/server/test/operator-reads.test.ts` | `25472f834aa82fa147943710d4b710afe8f991e7` | ✅ |
| `packages/runtime/src/control-types.ts` | `66440157e333b613d579b8c762251449f3ea3c18` | ✅ |
| `packages/runtime/src/orchestration-commands.ts` | `90c8a3003e82230e3d74485d91caf110863ddb58` | ✅ |
| `packages/kernel/src/types.ts` | `3d944e4a09a02ae34c7e6fc270d345d6c4835719` | ✅ |
| `apps/studio/src/lib/shared/contract.ts` | `a701028de1f266ebbc02becb24b9a542155ac958` | ✅ |
| `apps/studio/src/lib/server/app-server.ts` | `22b7da7323c9dc7bdc77857b989d8b3684d656a6` | ✅ |
| `apps/studio/src/lib/server/targets.ts` | `b7c7a1024953ec739d958b70c83bf5b5c14870c9` | ✅ |
| `scripts/verify-stage9-inventory.mjs` | `797d42092db705b8f970d229e75d72572a071178` | ✅ |
| `packages/store-sqlite/test/orchestration-corrective.test.ts` | `7667a3cfb2bc93bbbaac8495bbeda65e273c1dad` | ✅ (row carries no pinned SHA; recomputed for completeness) |

## 6. VICT-Quellight ZERO-caller claim — re-derived from a FRESH clone

- Fresh clone of `https://github.com/radz2291/VICT-Quellight.git`; `HEAD == origin/main == 7ee427ac1abbb864922eef16f81d28a1394f3666`.
- `git grep` over ALL eight shapes — `run.cancel`, `activation.select`, `release.select`, `release.rollback`, `runs/cancel`, `releases/select`, `releases/rollback`, `activations/select` — returned ZERO matching files. ZERO-caller claim ✅ confirmed read-only.

## 7. Material new owner choices in the final bytes

Diff `5b9885a..089c1ba` adds only: consume-path scoping + P-22..P-24 pointer (owner-directed amendment §3), inline ACCEPTED pins for already-accepted D-OPEN-1/2/3/4 (with D-OPEN-1's 10-minute value propagated into the §4.4 default statement — the same accepted value, worded as the default), corrected blob `2761a27d…` row (points to the exact `git rev-parse` form), normalized studio paths, §5 freeze-byte pin, and the stray line (V-2). **No material new owner choice beyond the four accepted defaults is embedded.** ✅

## 8. Findings

- **V-1 (non-blocking):** the entry record still contains TWO `## 4` headings (`## 4. Caller inventory…` line 45 and `## 4. Coordinated version / release migration plan…` line 69) at `089c1ba` — the duplicate-heading defect survives into the frozen bytes of the entry record itself (the proposal is clean).
- **V-2 (non-blocking):** a stray, near-garbage line "See §4 table. — the four migrated commands, at `main` `c3f9663cadf80206645a62322e5933ff19c108e9`" was ADDED under §4 in the freeze commit `5b9885a..089c1ba`; it is self-referential cruft with no factual weight.
- **V-3 (non-blocking, method note):** the §5 SHA-256 pin is only reproducible over CRLF-normalized content (`f270b17c…`); the LF git-blob bytes hash to `0897035…`. Future verifiers MUST use the CRLF/CRLF-checkout (certutil-equivalent) method. Not a digest error — the byte-level pin itself matches exactly.

None of V-1..V-3 alters the contract semantics, the owner acceptance, the migration plan, or any pinned SHA.

## 9. Commit and branch of this verify record

- Branch: `review/stage9-g2-entry-verify-20260929` (based on `089c1bac9650d5652b921db0f25c73f4d8e6b649`, pushed upstream).
- This file is the ONLY content of the verify commit.

## Verdict

**PASS WITH NON-BLOCKING FINDINGS** for the VICT Stage 9 G2 ENTRY FREEZE at `089c1bac9650d5652b921db0f25c73f4d8e6b649`:

- §5 proposal digest recomputed and matched exactly (`f270b17cfd97c5a7be60a4bbfff31a4619f1d3ac3e4f03b45f58d72bed16f7c1`, CRLF-normalized bytes).
- Remote refs live-checked twice, zero movement, zero races.
- Owner acceptance §1 verbatim-faithful; four accepted defaults only; no material new owner choice embedded.
- P-23/P-24 semantics present and coherent in proposal §6 and mirrored in entry record §3.
- All 15 recomputed caller-inventory blob SHAs at `c3f9663` match; Quellight `7ee427ac` ZERO-caller claim independently confirmed (eight shapes, zero matches).
- Diffs `5b9885a..089c1ba` and `034281d..089c1ba` are docs-only (the two governance files).
- Findings V-1 (duplicate `## 4` headings in the entry record), V-2 (stray cruft line), V-3 (CRLF vs LF digest method note) are non-blocking byte-cosmetic items.