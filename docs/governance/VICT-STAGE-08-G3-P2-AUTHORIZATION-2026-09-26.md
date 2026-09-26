# Stage 8 G2→G3 Owner Decision and P2 Authorization (2026-09-26)

> **Document type:** dated owner-decision record. NEW FILE — all earlier
> governance and report records are preserved unedited. Claim record, not
> independently authoritative. **Stage 8 and every BLD requirement remain
> NOT Verified; P2 execution does not change any maturity cell** (that is
> §27.4, post-audit).

## 1. Owner decision recorded (2026-09-26)

The owner ratified the following G2 disposition, recorded here verbatim in
substance:

> **G2 disposition:** I ratify the 2026-09-26 Pi-plus-Codex comparison as
> evidence-complete for P1. The two Pi sessions remain process-repeatability
> evidence. The Codex result stays unselected and unmerged. Neither host's
> result is credited with the later pack-installation correction on `main`.
> This decision permits P2; it does not mark Stage 8 or any BLD requirement
> Verified.

Effect, as recorded by the evaluator:

1. P1 (handoff WP-6) is **evidence-complete** under the ratified two-host
   intent: the integrated pi host-a result (`5ceb557`, integrated on
   `main`) plus the preserved distinct-host Codex result
   (`codex/stage8-p1-builder-proof-20260926` @ `7709dbbd`, UNSELECTED,
   UNMERGED, no remote), evaluated in
   `VICT-STAGE-08-G2-P1-CODEX-COMPARISON-2026-09-26.md`.
2. The pack-installation correction on `main` is the operator's later
   work; no host result claims or is credited with it.
3. The owner decision **permits P2** (handoff WP-7; architecture §5.4;
   gate G3). It does not close the Stage 8 exit gate (owner + independent
   audit, reference §27.3/§27.4) and does not mark Stage 8 or any BLD
   requirement Verified.

## 2. Pre-execution verification (evaluator, 2026-09-26)

- `main` identity at P2 start: `fc742026a45b8b638abfa046152b578f32af10dd`,
  equal to `origin/main`; tracked tree clean (untracked `.pi/` present,
  never read).
- The filed G2 comparison record is present at
  `docs/governance/VICT-STAGE-08-G2-P1-CODEX-COMPARISON-2026-09-26.md`
  (committed in `fc74202`; git blob `5829c81373f6f83167260f1539a1eaa70abc6a8e`).
- Frozen handoff bytes unchanged since P1:
  `docs/handoff/VICT-STAGE-08-BUILDER-KIT-HANDOFF.md` raw-byte SHA-256
  `4aa83c1510faa4877becaeadd3a4335c87a8b02cc4812e0db93c5ebd737ad3e2` —
  identical to the byte pin carried by every P1 task pack.
- Frozen architecture bytes:
  `docs/architecture/STAGE-08-BUILDER-KIT-AND-SELF-HOSTING.md` raw-byte
  SHA-256
  `ba3fde1b51e9b24b6b9dcef393593fe9fb3e7dc476c87fafd7d6a4fc1ed4c57a`.
- Frozen release truth: `vict-release-set@1/0.3.1`, 13 packages, content
  identity `v1_1c695280d3afec5…` (as observed in the committed G1/P1
  ladders and re-observed during P2 preparation).

## 3. P2 execution conditions (per architecture §5.4, handoff WP-7)

- Clean consumer: empty application directory outside the VICT repository
  and every P1 worktree; recorded `package.json`-absent start state.
- Consumption per D-1′: the 13 published platform packages at the frozen
  `0.3.1` release set (registry install, lockfile integrity) plus
  `@victframework/builder-kit` as an integrity-recorded local artifact
  (recorded SHA-256, exact internal pins, no-checkout-leakage probe
  retained). **No publication is performed or required.**
- Builder isolation: a genuinely fresh builder session whose supplied
  workspace and context contain the empty project, the prepared kit and
  its generic documentation, the public documentation shipped with the
  packages, and the verbatim P2 brief — the ONLY product specification.
  The F1–F8 rubric, the claim→evidence table, the handoff, the operator
  instruction, and all P1 material remain OUTSIDE the builder workspace
  and context. Brief and rubric byte-pinned separately for audit.
- Evaluation after the builder stops: F1–F8 scoring, real-browser record
  (narrow phone + laptop widths, keyboard use), definition-driven
  rendering and versioned code-island inspection, governed-action
  negative probe, scripted real-process kill/restart with before/after
  durable state, application-identity stability across a content-identical
  rebuild, applicable negative controls, and `verify --app` (exact
  published-platform consumption, input provenance, bootstrap binding).
- Reproduction and filing: sequential gates when the machine has enough
  capacity (contention is a reason to wait, never to relax timeouts or
  omit gates); evidence with paths, hashes, exits, observed counts; a new
  P2 governance evidence record plus the handoff-named implementation
  report (`docs/report/VICT-STAGE-08-IMPLEMENTATION-REPORT.md`, created
  once — existing `docs/report/` files untouched); the P2 application kept
  as its own repository with a reproducible local commit or bundle;
  governance/evidence integration onto `main` by normal fast-forward only
  after a fresh remote check.

## 4. Standing stop boundaries (unchanged)

No G4 start; no Stage 8 Verified claim; no publication; no production
activation; no Quellight access; no product-agent surfaces; no
`docs/report/` historical edits; `.pi/` never read or written; concurrent
UI work and worktrees untouched. If a required clean-consumer input or a
genuinely fresh isolated builder session cannot be established, the
implementer stops with the precise blocker and the preparation evidence.

**Stop point: this note records authorization and execution conditions
only. P2 execution evidence follows in the P2 evidence record when
complete.**
