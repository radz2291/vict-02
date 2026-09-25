# Stage 8 G2 — P1 Self-Hosting Proof — Operator Evidence Record (2026-09-25)

> **Document type:** operator/evaluator evidence record for gate G2 (P1),
> filed in `docs/governance/` (the owner-directed permitted location; NO
> existing `docs/report/` file was edited). Claim record, NOT independently
> authoritative. **Stage 8 remains NOT Verified; this record does not assign
> any Verified status. P2 has NOT started.**

## 1. Authority chain and host substitution (owner decisions)

- **Baseline (preflight):** the operator preflight (wrapper authority-gap
  closure; P1-specific narrow accepted scope; byte-pinned task card) was
  committed, ladder-verified (run #7: all 13 commands exit 0), and pushed as
  **P1 baseline `B = a746c34173838eb583d85a909207b6a0a7c7c832`** (local ==
  remote at issuance; tree clean except untracked `.pi/`).
- **Host availability:** the ratified D-2 hosts were unavailable — no Codex
  binary or credentials; no Claude Code CLI. The operator stopped for an
  owner decision per D-2 and the directive.
- **Owner substitution decision (2026-09-25, this session):** the owner
  directed that the two P1 hosts be run as **two fresh, isolated `pi`
  sessions** (pi 0.84.1, the operator's own agent harness) in separate tmux
  windows, separate worktrees, and separate session stores. Recorded as an
  explicit, bounded substitution of D-2's named hosts for THIS proof only.
  **Honest caveat:** both hosts ran the SAME agent and model — the proof's
  diversity is process-level (fresh contexts, independent worktrees, no
  shared conversation or files), not model-level. The audit should weigh
  this when judging what P1 demonstrates.
- Both sessions were externally killed once (2026-09-25T06:53:54+08:00,
  infrastructure event) and resumed with `--continue` on owner instruction;
  both resumed into their original session histories and completed.

## 2. Pinned identities

| Item | Value |
| --- | --- |
| Baseline B | `a746c34173838eb583d85a909207b6a0a7c7c832` |
| Task-card bytes (committed at B) | `docs/governance/VICT-STAGE-08-P1-TASK-CARD.md`, SHA-256 `d6a40c2ee6397cf8b4cccebd602fd3c741ee507a9d692e95e3850d7fef06fbc4` |
| Stage 8 handoff | `docs/handoff/VICT-STAGE-08-BUILDER-KIT-HANDOFF.md`, SHA-256 `4aa83c1510faa4877becaeadd3a4335c87a8b02cc4812e0db93c5ebd737ad3e2` |
| Accepted P1 scope record | `docs/builder-kit/accepted-task-scope.json`, packId `7d75f679f7d4b4641d652c5911b69b96140b51e16ba7b3016b6d78897634067d` |
| Detection ignore manifest | `[".builder-kit/**", ".git/**", ".pi/**", "node_modules/**"]`, digest `ccb292251394fa193658959120d8878ce251a74c1704003a01ef48f0b4c82dda` (deliberately EXCLUDES `docs/report/**` — historical report edits stay detectable) |
| Issued task packs (both worktrees) | byte-identical, SHA-256 `9dbdaa6a978c05cf95800f8d5cc8355f5c196151ffa0b11d8be0b88ea5956b72`, packId `55c8e3569646b54df976f258560d28e0179cc74178d392f81cc302f579632851`, profile `builder.selfhost`, baseTree B |
| Host-a result branch tip | `p1/host-a` = `5ceb55799b1964e69da7d2f565d2374d9e7d567a` (4 commits) |
| Host-b result branch tip | `p1/host-b` = `8fae474` (3 commits; local only — NOT merged, NOT pushed) |
| Final active pack, host-a | re-derived after mandated base-pack regeneration: packId `778ff1f5a21cf4628dbf9736dfcb9eb61a49b8d220a944ba9a997e90dfb749d9` |
| Final active pack, host-b | re-derived likewise: packId `8c74a589a0f189552995762eb7ebc67eb16008eddd013b638d6d5f889c0d4d27` |
| Frozen architecture | committed-byte digest re-verified `ba3fde1b51e9b24b6b9dcef393593fe9fb3e7dc476c87fafd7d6a4fc1ed4c57a` throughout; frozen document untouched |

## 3. Host sessions — what each produced

Both sessions received the IDENTICAL card bytes and issuance values (only
the branch name differed in the surrounding sentence); no shared
conversation, files, or context; each confined to its worktree; neither
pushed; neither integrated its own result.

- **Host-a** (`p1/host-a`, tip `5ceb557`): `notes.readingTime@1` declared
  (effect `read`, input `notes.text@1`, output `notes.readingTime@1`,
  authority-free) with a pure `estimateReadingTime` (200 wpm, ceil, 1-minute
  floor, 0 for empty), example in all three available surfaces (worked
  export, conformance fixture, manifest evaluation), 12 permanent tests;
  reading-time region surfaced on `s.project-detail` (the screen that
  actually displays note content at B) through the Application Definition
  (3 surfaces + declared view + declared capability action, app revision
  5→6), implemented as a contract-checked pure capability through a real
  Vict graph, with 6 permanent renderer-level tests in a dedicated file;
  also repaired a discovered pre-existing persistence defect
  (`upsertMetric` dropped the idempotency key on create — in-scope,
  disclosed, tested); regenerated stable layer byte-deterministic (new
  base-pack packId `e8f8365169ea880f…`); result.json validated
  (`vict.builder.result@1`); ladder transcript ends with a FINAL complete
  run: **all 13 commands exit 0** (2483 passed / 3 skipped of 2486);
  freshness transcript 26/26; thorough limitation record (every red run,
  the external kill, wrapper denials, Windows limitations).
- **Host-b** (`p1/host-b`, tip `8fae474`): equivalent capability
  (named-constant derivation, exported interface), example + conformance
  extension, 10 permanent tests; reading-time region on the notes screen
  with `t.reading-time` + `ls.reading-time` surfaces backed by a dedicated
  declared projection resource, app revision → 6, renderer-level tests added
  to the permanent DOM suite; regenerated stable layer byte-deterministic;
  result.json validated; ladder run 1 (3 reds: fresh-worktree `dist/`
  ordering issue, then superseded) honestly retained and attributed, run 2
  FINAL: **all 13 commands exit 0** (2482 passed / 3 skipped of 2485);
  freshness transcript 26/26; limitation record including the external kill
  and the same task-pack re-derivation finding.

**Task-pack staleness finding (both hosts, independently):** the mandated
`kit:generate` changes the committed base pack's packId, which necessarily
stales the ISSUED task pack's `basePackId` binding (gate checks
`task-pack:base-pack-binding` and `task-pack:regenerate-compare` compare
against the CURRENT base pack). Both hosts resolved it identically and
transparently: re-derived the active pack from exactly the §3.3 inputs
(same handoff, baseTree B, scope, ignore manifest, profile; only
`basePackId` and the derived packId differ), preserved the issued bytes for
the evaluator, and returned the gate to 26/26 green. The gate design makes
this re-derivation inherent for any task whose accepted scope includes the
generated stable layer — formalizing it (e.g., an owner-visible
re-derivation rule) is recorded as an **owner decision for the post-P1
review**; it is not resolved here.

**Card-vs-baseline wording (both hosts, resolved the same way):** the card's
"`notes.summary` and `notes.count` patterns" and "existing notes screen"
named things that do not exist at B (the former existed only on the
unmerged G1 rehearsal scratch branch). Both hosts followed the operative
requirement (same declaration style as the pack's actual capabilities;
the screen that actually displays notes content) and disclosed the
interpretation. Scratch refs were never read.

## 4. Evaluator reproduction (independent, both results)

- Gate: `verify:builder-kit` re-run by the operator in BOTH worktrees —
  26/26 GREEN each (including the eight task-pack authority checks and the
  baseline comparison vs B — proving scope compliance of every changed
  file).
- Full 13-command ladder re-run by the operator in BOTH worktrees, clean
  and sequential: **all 13 commands exit 0 in both** (host-a log
  `p1-evidence/eval-repro2-host-a.log`; host-b
  `eval-repro2-host-b.log`; release-set frozen "13 packages, 0.3.1,
  v1_1c695280d3afec5…" in both).
- Regeneration determinism: double `kit:generate` in BOTH worktrees → zero
  tracked-file changes (no churn) — reproduced.
- result.json validation reproduced via the kit CLI for both (ok).
- **Honest defect in the FIRST reproduction attempt:** the operator's
  initial parallel reproduction was compromised by self-inflicted
  interference (concurrent `kit:generate` during the ladders; both stage5
  suites under parallel load reproducing the documented first-build
  flakiness; one lint race). First-attempt logs are preserved
  (`eval-repro-host-{a,b}.log`) and DISCARDED as evidence; the clean
  sequential reruns above are the reproduction of record. The hosts'
  results were NOT responsible for those reds.

## 5. Comparison against the identical acceptance criteria

| Criterion | Host-a | Host-b |
| --- | --- | --- |
| 1. capability declared/implemented/exampled/tested | ✔ (12 tests; example in 3 surfaces) | ✔ (10 tests; conformance extension) |
| 2. region via Application Definition + permanent renderer test | ✔ (dedicated 6-test file) | ✔ (tests in the permanent DOM suite) |
| 3. byte-deterministic regeneration | ✔ (reproduced) | ✔ (reproduced) |
| 4. scope compliance | ✔ (gate baseline vs B) | ✔ (gate baseline vs B) |
| 5. ladder 13/13 with observed counts | ✔ (2483/3 of 2486) | ✔ (2482/3 of 2485) |
| 6. validated result + transcripts + limitation record | ✔ | ✔ |
| 7. honesty of reds/limits | ✔ (5 attempts all accounted) | ✔ (run 1 superseded + attributed) |

**Equivalence:** both results fully satisfy every criterion; the capability
derivations are semantically identical (200 wpm, ceil, 1-minute floor);
both regions are purely declarative with permanent renderer tests; both
stable layers are internally deterministic; both evidence sets are complete
and honest.

**Selection — SELECTED: host-a (`p1/host-a`, tip `5ceb557`).** Rationale,
on the pinned criteria only (both hosts being the same agent, no
model-diversity signal exists): (a) host-a's renderer tests are a dedicated
permanent file, making the mandated renderer-level proof maximally
visible; (b) its example surface is the most complete (worked export +
conformance fixture + manifest evaluation); (c) its region implementation
exercises the capability through a real Vict graph with contract-checked
I/O rather than a projection alone; (d) it additionally repaired a genuine,
disclosed, in-scope persistence defect its own tests exposed
(`upsertMetric` idempotency-key drop), improving app integrity; (e) its
process evidence is the most exhaustive (every red run attributed,
superseded runs preserved verbatim). Host-b's result is equally valid
engineering and is preserved in full as local evidence; the selection is a
preference among sufficient proofs, not a rejection.

## 6. Integration and repository state

- Integration: `git merge --ff-only p1/host-a` on `main` — **integration
  SHA `5ceb55799b1964e69da7d2f565d2374d9e7d567a`** (fast-forward
  `a746c34..5ceb557`, 9 files, +576/−17), pushed to `origin/main` **only
  after verifying the remote had not advanced** (remote == B at push time).
- Post-integration `p1/host-a`-tip gate on the merged tree was already the
  reproduced-green state (the integration is the same bytes as the host-a
  worktree HEAD; evaluator reproduction §4 applies verbatim to main).
- Unselected result: `p1/host-b` = `8fae474` remains a LOCAL branch with
  its worktree at `260831-VCT-02-p1-host-b` — preserved, NOT merged, NOT
  pushed.
- This record's commit follows on `main`; push is a normal fast-forward.

## 7. Deviations and limitations (no precedent)

1. Host substitution (§1) — owner-authorized, bounded to this proof; both
   hosts same agent/model.
2. External kill + resume (both hosts) — infrastructure event; both hosts
   re-verified state honestly and re-ran complete final ladders.
3. Operator reproduction error (§4) — first parallel attempt compromised by
   the operator's own concurrent commands; discarded and rerun cleanly;
   recorded so the audit can weigh it.
4. Host-a's result.json self-labels its host "claude-code" — incorrect
   assumption by the session (it ran on pi as host-a); operator correction
   recorded here; all other session facts in that result are
   worktree-verifiable and stand.
5. The task-pack re-derivation tension (§3) — inherent gate-design
   consequence; recorded for owner disposition, not self-resolved beyond
   the hosts' transparent re-derivations.

## 8. Stop point

**G2/P1 stops here.** No P2 work (no TaskLedger app, no F1–F8 records, no
restart probe, no browser evidence); no publication; no production
activation; no Quellight access; no Stage 9 work; no `docs/report/` file
touched; `.pi/` never read; scratch refs excluded throughout. **Stage 8 and
every BLD requirement remain NOT Verified** — the independent audit
(reference §27.3) and owner closure are still required.
