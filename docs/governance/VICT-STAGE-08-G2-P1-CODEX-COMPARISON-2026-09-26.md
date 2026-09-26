# Stage 8 G2 — Supplemental Codex P1 Result — Operator Comparison Record (2026-09-26)

> **Document type:** operator/evaluator comparison record for the supplemental
> distinct-host P1 result (reconciliation Option A). NEW FILE — the earlier
> records `VICT-STAGE-08-G2-P1-PROOF-2026-09-25.md` and
> `VICT-STAGE-08-G2-P1-RECONCILIATION-2026-09-25.md` are preserved unedited.
> Claim record, NOT independently authoritative. **This record does NOT
> declare the frozen P1 exit gate satisfied and does NOT declare Stage 8 or
> any BLD requirement Verified. P2 has NOT started.**

## 1. What was evaluated (identity pins, all verified by the evaluator)

| Item | Value | Verified |
| --- | --- | --- |
| Result branch (local, unmerged, unpushed) | `codex/stage8-p1-builder-proof-20260926` | ✔ |
| Branch tip | `7709dbbd4c87171c749aac65de50b3017504be9c` (4 commits) | ✔ |
| Baseline | `B = a746c34173838eb583d85a909207b6a0a7c7c832` (merge-base; clean tree at evaluation) | ✔ |
| Task-card bytes at B | `d6a40c2ee6397cf8b4cccebd602fd3c741ee507a9d692e95e3850d7fef06fbc4` — identical to the card pinned in the G2 record §2 | ✔ |
| Handoff bytes | `4aa83c1510faa4877becaeadd3a4335c87a8b02cc4812e0db93c5ebd737ad3e2` | ✔ |
| Issued task pack | SHA-256 `9dbdaa6a978c05cf95800f8d5cc8355f5c196151ffa0b11d8be0b88ea5956b72`, packId `55c8e3569646b54df976f258560d28e0179cc74178d392f81cc302f579632851` — **byte-identical to the packs issued to both pi hosts** (G2 record §2); preserved at `.builder-kit/prep/issued-task-pack-original.json` (ignored), hash re-verified by evaluator | ✔ |
| Final (successor) task pack | SHA-256 `674c3c4f3740d9fafacdfbdbcb68975396e067c734fe60e36f003f77f6805596`, packId `bb7a198d954449180fac7ce6fbc4d9d42d31804ffa7d8748ae2a3ad0330771b4`, basePackId `47730dd316e8faf406b63328bc78d9a8d3e0a070d5bf68a4ca89f69710241d17`; active at `.builder-kit/packs/vict-stage-08-builder-kit-handoff-4aa83c15/task-pack.json` (ignored) | ✔ |
| Successor identity change | Evaluator field-by-field comparison of preserved-issued vs active pack: **exactly two changed leaf fields — `basePackId` and derived `packId`** — matching the ratified re-derivation rule; intermediate successor `c85f5b27…` (basePackId `df7b636f…`) also preserved in ignored evidence | ✔ |

Commits on the branch: `ce68d3f` (implementation; 10 in-scope files),
`9d6f6b7` (UTF-8 source repair + catalog regeneration; 6 in-scope files,
through the wrapper), `418fd1f` + `7709dbb` (committed evidence). Git author
on all four is the shared automation identity (`Vict Overnight Agent
<vict-agent@localhost>`); the distinct-host identity is attested by the
session setup and the result document, not by git metadata — recorded as an
identity-provenance caveat, weighed by the auditor.

## 2. Evaluator verification of the committed evidence

- `result.json` validates: `npx tsx packages/builder-kit/src/cli.ts validate
  packs/notes-pack/evidence/p1-codex/result.json` → `ok` (reproduced).
- Committed ladder transcript (`evidence/p1-codex/ladder/`, 13 logs +
  `summary.json`): all 13 commands exit 0; root Vitest 2475 passed / 3
  skipped (2478); stage 5 reference app 45 passed; clean-clone 6/6; release
  set 13 packages, 0.3.1, `v1_1c695280d3afec5…`; gate **26/26 ALL CHECKS
  PASSED** — each count re-read from the committed logs, not from the result's
  claims.
- Red-run evidence preserved and attributed in `evidence/p1-codex/history/`:
  pre-build `npm test` red (6 fresh-worktree dist failures), stale-pack gate
  red (3 checks), wrapper commit refusal log, stage-5 UTF-8 mojibake red
  (1 failed / 44 passed), catalog-drift red, evidence-Prettier reds, CLI
  `--help` exit 1, `git diff --check` exit 2 (whitespace only in preserved
  transcripts).
- Scope: every changed file in the four commits is inside the accepted P1
  scope globs (`packs/notes-pack/**`, `examples/reference-app/**`,
  `BUILDER-KIT.md`, `docs/builder-kit/PACK.md`,
  `docs/builder-kit/capability-catalog.json`,
  `docs/builder-kit/context-pack.json`); the gate's baseline-vs-B comparison
  (re-run by evaluator, 26/26) enforces the same conclusion.

## 3. Seven-criteria comparison — identical byte-pinned card, host-a (pi) vs Codex

| # | Criterion | Host-a (pi, `p1/host-a` `5ceb557`) | Codex (`7709dbb`) |
| --- | --- | --- | --- |
| 1 | Final `verify:builder-kit` GREEN, task-pack authority + baseline vs B | ✔ 26/26; issued pack preserved, successor re-derived (2-field rule) | ✔ 26/26 — reproduced by evaluator; issued pack preserved byte-identical (same `9dbdaa6a…` bytes as both pi hosts), successor differs **only** in `basePackId`+`packId` (evaluator-verified) |
| 2 | `notes.readingTime@1` declared, pure read, example, permanent tests | ✔ effect `read`, input `notes.text@1 {title}`, 12 tests, example in 3 surfaces | ✔ effect `pure`, dedicated input `notes.content@1 {content}`, 4 permanent tests (declaration shape, example-through-binding, 200-word boundary, contract rejection), example export + README |
| 3 | Region via Application Definition + permanent renderer test | ✔ 3 surfaces + declared view + declared action on `s.project-detail`; app revision 5→6; dedicated 6-test renderer file | ✔ 2 surfaces (`t.reading-time-label`, `st.reading-time`) on `s.project-detail` overview tab; 1 permanent test in the permanent DOM suite; **app revision left at 5** (minor, gate does not check) |
| 4 | Byte-deterministic regeneration | ✔ reproduced | ✔ — committed no-op logs; evaluator double `kit:generate` → 0 changed paths; base packId `47730dd3…` reproduced |
| 5 | No out-of-scope change | ✔ gate baseline vs B | ✔ gate baseline vs B (re-run by evaluator, 26/26) |
| 6 | Validated result + commits + observed exits + freshness transcript + limitation record | ✔ | ✔ — result validates `ok`; every ladder exit and count observed-and-committed; `LIMITATIONS.md` exhaustive |
| 7 | Honesty of reds/limits | ✔ (5 attempts accounted) | ✔ — initial stop, owner clarifications, wrapper refusal + authorized bootstrap commit, PATH prepend, preflight build, cp1252 corruption → stage-5 red → repair → catalog-drift → regeneration → re-derivation, evidence-Prettier reds, `--help` exit 1, whitespace exit 2 — all disclosed and log-backed |

**Result: Codex satisfies all seven criteria on the same pinned card.**

## 4. Execution-path finding (stated explicitly; attributed to no host)

The card at B required the region to be surfaced **through the Application
Definition**; it did not mandate the Stage 04 pack-installation path. The two
hosts resolved the region's data supply differently, and **neither executes
the pack's own `notes.readingTime@1` capability through a capability
execution path**:

- **Host-a (pi):** declared an app-local duplicate capability
  (`refapp.noteReadingTime`) with bespoke app contracts, registered in the
  runtime and executed through a real Vict graph with contract-checked I/O —
  capability machinery exercised, but the derivation duplicated app-locally
  and the pack's own capability/ids not used.
- **Codex:** imported the pack's exported pure `estimateReadingTime` by a
  source-relative path and computed the `readingTime` field inline in the
  server's view-data assembly — the pack's own function (single derivation,
  no duplicate), but no capability registration, no dispatcher, no
  contract-checked invocation; the app layer bypasses the capability
  machinery. The host honestly records the cause: the accepted scope excludes
  the root lockfile needed to declare a new workspace dependency
  (`result.json` `knownDebt`).
- The **corrected integrated implementation on `main`** (`installCapabilityPack`
  binding the pack's own contract ids) postdates both host runs, is the
  operator's later correction, and is **not attributable to either host**.
  Per the reconciliation record, it supersedes the hosts' interpretations on
  `main` only and does not retroactively alter either host result. Host-b's
  equivalent standing is unchanged (projection-backed declarative surfaces;
  see the G2 record §3).

## 5. Limitation-record review and classification (Codex)

| Item | Classification |
| --- | --- |
| Initial card stop (`notes.summary`/`notes.count`/existing notes screen absent at B) and owner clarification | **Independence-preserving.** The stop itself demonstrates independent judgment; the clarification resolved the same card-vs-baseline ambiguity all three hosts hit, uniformly, with no cross-host information transfer. |
| Self-preparation of the identical issued pack from pinned inputs (reproduced packId `55c8e356…`) | **Reproducibility-positive.** Independently demonstrates issuance determinism. |
| Wrapper refused the stale-pack bootstrap commit (exit 2); owner-authorized single direct-git bootstrap commit `ce68d3f` | **Scope-neutral** (all 10 staged files verified in-scope), **independence-caveat** (owner granted an exception to wrapper-only mutation, identical in kind to the gate-design tension both pi hosts hit; content is gate- and ladder-verified), reproducibility-neutral. |
| Pre-build `npm test` red (6 fresh-worktree dist failures) + retry, command names and timeouts unchanged | **Honesty-positive; no validity effect.** Attributed, logs preserved. |
| UTF-8 repair: helper decoded Prettier output as cp1252, corrupting in-scope punctuation; detected by the host's own stage-5 red (mojibake in an existing label); repaired; catalog-drift red resolved by regeneration; final pack re-derived; repair committed through the wrapper (`9d6f6b7`) | **Host-specific process defect, self-detected and self-repaired; no validity effect** (post-repair gate 26/26 and full green ladder); **honesty-positive** (full chain of reds preserved). |
| Task-pack re-derivation after mandated regeneration | **Same ratified two-field rule as both pi hosts**; evaluator-verified byte-level two-field diff; **reproducibility-neutral** (deterministic re-derivation reproduced). |
| Windows `ls.exe` PATH prepend for test runs; preflight build before the final ladder | **Environment adaptations, disclosed**; command names and timeouts unchanged. Likely explains environment-conditional test-collection differences (below). |

No cross-host contamination is visible: the Codex evidence never references
the pi results, the worktrees are isolated, and scratch refs were excluded.

**Count-comparability caveat (do not infer equivalence from green counts):**
host-a's final ladder reports 2483 passed / 3 skipped of 2486 with 18 added
tests; Codex reports 2475 / 3 of 2478 with 5 added tests. The totals are not
directly comparable across hosts (different numbers of added tests plus
environment-conditional suites). The evaluator's own rerun reproduced
**exactly** 2475 / 3 of 2478 on the Codex tree, confirming the committed
counts on this machine.

## 6. Independent evaluator reproduction (this evaluation)

All in the Codex worktree at tip `7709dbb`, no code or timeout changes:

1. Gate: `npm run verify:builder-kit` → **26/26 ALL CHECKS PASSED** (run
   twice: before and after the ladder).
2. `result.json` validation → `ok`.
3. Double `npm run kit:generate` → 0 changed paths both times; worktree clean.
4. **Full clean sequential 13-command ladder, one run, all 13 to completion:
   ALL 13 EXIT 0.** format:check 23s; lint 46s; typecheck 34s; test 203s
   (**2475 passed / 3 skipped of 2478 — identical to the committed run**);
   build 99s; builder-kit build 8s; stage5 386s (**45 passed**); stage6a 186s;
   stage6b 256s; stage7a 33s; release-set 2s (13 packages, 0.3.1,
   `v1_1c695280d3afec5…` — frozen set unchanged); clean-clone 476s (ALL GATES
   PASSED); gate 7s (26/26). Post-ladder `git status --porcelain` **empty**
   (no churn, worktree clean). Logs preserved uncommitted under
   `.builder-kit/prep/eval-ladder/` in the Codex worktree.
5. **Deviation (recorded honestly):** the machine was not "verified-quiet"
   per the standard set by the 2026-09-26 verification-only ladder record.
   The evaluator polled ~25 minutes for a quiet window; the owner's other
   active agent sessions kept ambient load at roughly 26–77%, so the ladder
   was run on that warm worktree under moderate ambient load rather than
   waiting indefinitely. Zero flakes occurred and all counts match the
   committed run; the run is corroborative reproduction, and a
   verified-quiet rerun remains available on owner request.

## 7. Owner decision recorded (revised host pairing for the P1 comparison)

Per the owner's direction of 2026-09-26, the two-host P1 comparison is
**Pi plus Codex**: the integrated pi host-a result
(`5ceb557`, merged as the G2 record §6 integration) plus this Codex result
(`7709dbb`) together supply the distinct-host evidence that reconciliation
Option A called for, **replacing the unavailable ratified D-2 named pair**
for this proof. The earlier two-pi-sessions exercise (host-a vs host-b)
remains exactly what the reconciliation classified it: **isolated
process-repeatability evidence**, not host diversity. Consistent with that
direction, the Codex result is **UNSELECTED and UNMERGED** — preserved in
full on its local branch (worktree intact) unless the owner makes a separate
integration decision. No integration, selection, push, publication,
production activation, or P2 start was performed by this evaluation.

## 8. Proposed G2 disposition (for owner ratification; NOT self-executed)

The evidence supports the claim that the supplemental Codex P1 result
satisfies all seven acceptance criteria of the byte-pinned card under
gate-enforced scope, with validated results, honest red-run accounting, and
independently reproduced green state — and therefore that the **distinct-host
evidence required by the ratified two-host intent now exists** (pi host-a
integrated; Codex preserved unmerged), alongside the two-pi
process-repeatability result.

Proposed disposition, for the owner to ratify or amend: record G2's P1
different-host requirement as **evidence-complete** (subject to the
identity-provenance caveat in §1 and the deviations in §4–§6), keep the
Codex branch unmerged pending a separate integration decision, and carry the
open items forward unchanged: independent audit (reference §27.3), owner
gate closure, and the standing non-claims — **Stage 8 remains NOT Verified;
the frozen exit gate is closed by owner + audit action, not by this record;
P2 not started; nothing published; production not activated; Quellight
untouched; no `docs/report/` file edited; `.pi/` never read.**

## 9. Evidence locations

- Codex result + evidence: `packs/notes-pack/evidence/p1-codex/` on
  `codex/stage8-p1-builder-proof-20260926` @ `7709dbb` (result.json,
  LIMITATIONS.md, ladder/, history/); issued-pack preservation and successor
  comparison under the same `history/` directory with bytes in the worktree's
  ignored `.builder-kit/` tree.
- Prior records preserved unedited: `VICT-STAGE-08-G2-P1-PROOF-2026-09-25.md`,
  `VICT-STAGE-08-G2-P1-RECONCILIATION-2026-09-25.md`,
  `VICT-STAGE-08-P1-TASK-PACK-RE-DERIVATION-2026-09-25.md`,
  `VICT-STAGE-08-P1-VERIFICATION-ONLY-LADDER-2026-09-26.md`.
- Evaluator reproduction logs (uncommitted, ignored):
  `260831-VCT-02-p1-codex-proof-20260926/.builder-kit/prep/eval-ladder/`.

**Stop point: end of the supplemental G2/P1 evaluation, for owner review.**
No P2 work; no publication; no production activation; no Quellight access;
Stage 8 and every BLD requirement remain NOT Verified.
