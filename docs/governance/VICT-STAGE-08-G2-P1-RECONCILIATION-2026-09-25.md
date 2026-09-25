# G2/P1 Reconciliation — Original Host Results, the Corrected Integration, and the Remaining Host-Diversity Proof

> **Document type:** governance evidence note (new file; the filed G2/P1
> record `VICT-STAGE-08-G2-P1-PROOF-2026-09-25.md` is NOT edited). Claim
> record, NOT independently authoritative. **Stage 8 remains NOT Verified;
> the frozen P1 exit gate is NOT declared satisfied — by anyone, including
> this note.**

## 1. What the two original host results actually prove — and do not

The G2/P1 proof ran two fresh, isolated `pi` sessions (host-a
`p1/host-a = 5ceb557`; host-b `p1/host-b = 8fae474`, local-only) over
identical card bytes, identical issuance values, and separate worktrees
with no shared conversation, files, or context.

- **What they prove: isolated repeatability.** Two independent process
  executions of the same agent, seeded only by the card and the issuance
  pack, each produced a complete, gate-green, honest result that satisfied
  all seven acceptance criteria, with independent (non-identical but
  equivalent) implementations. That is genuine evidence the card is
  executable as written and the gate holds the scope.
- **What they do NOT prove: different-host equivalence.** Both sessions ran
  the SAME agent and model on the operator's own harness (the
  owner-authorized substitution after the ratified D-2 hosts proved
  unavailable). Shared training, shared tooling habits, and shared failure
  modes are NOT controlled for. The ratified intent — two DIFFERENT hosts —
  remains unproven. The filed G2 record already carries this caveat (§1,
  §5); this note makes the boundary explicit.

## 2. The original results stand; `main` has moved past them

The operator's bounded correction on `main` (this reconciliation pass)
changed the INTEGRATED implementation after integration:

- The reference application now executes the capability pack's OWN
  `notes.readingTime@1` through `installCapabilityPack` (the Stage 04
  supported registration path); the app-local duplicate capability and its
  bespoke contracts were removed; the declared action binds the pack's
  contract ids; a permanent capability-identity/execution-path suite pins
  the pack installation.
- The `upsertMetric` repair was independently reviewed and retained on
  negative evidence (adapter-rejection replay proves the pre-repair code
  could never persist a metric; the repaired upsert persists, updates in
  place, and never duplicates).
- A task-pack re-derivation rule was specified and tested.

**These corrections do NOT retroactively alter either host result.** The
host branches remain the byte-exact evidence of what each session produced
under the card. The correction is itself part of the audit surface: the
hosts' duplicate-calculation interpretation of the card's "connect" step
was operator-accepted at selection time and is now superseded on `main` by
a stricter reading. The gap between the host results and the corrected
integrated state is recorded here — it is evidence the evaluator and
reviewer layers add value, and it is exactly the kind of finding the
independent audit (reference §27.3) should weigh.

## 3. Remaining proof: host diversity (required before any P1 exit claim)

To complete the ratified two-host intent, one of:

- **Option A — a genuinely different agent host, when available.** Re-run
  the identical card (bytes at `d6a40c2e…`, issuance values pinned in the
  G2 record §2) on an INDEPENDENT agent product — e.g., Codex CLI or
  Claude Code once installed/credentialed, or another provider's coding
  agent — in a fresh worktree from the baseline, under the same D-2 rules
  (no push, no self-integration, evidence under `.builder-kit/`). Model-
  level diversity is then real. Selection, integration, and filing follow
  the same evaluator procedure as G2.
- **Option B — the contract's agent-plus-human option.** A human builder
  executes the card manually (fresh clone or worktree at the baseline,
  card + issuance pack only), with the human's session log, ladder
  transcript, and evidence filed the same way. A human builder is maximally
  diverse from the pi sessions and directly satisfies "different host"
  without new tooling.

Either option closes the diversity gap. Until one of them is executed and
evaluated, the P1 proof remains: two-session isolated repeatability PLUS a
corrected integrated implementation — not two-host equivalence.

## 4. Explicit non-claims

- This note does NOT declare the frozen P1 exit gate satisfied.
- This note does NOT declare Stage 8, or any BLD requirement, Verified.
- The corrected integrated implementation has NOT been executed by two
  independent hosts either; it is operator-corrected work verified by the
  gate, the full ladder, and permanent tests — recorded for the audit to
  review, not as a substitute for the host proof.
