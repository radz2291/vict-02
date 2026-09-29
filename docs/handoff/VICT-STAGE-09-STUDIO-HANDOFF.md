# VICT Stage 09 — Proposed Entry and Gate Handoff

> **PROPOSED, NOT RATIFIED.** No Stage 9 implementation, reference amendment, publication, activation, or Quellight edit is authorized by this file. Baseline for this candidate: VICT `main` `516948ac8bc55bbae8624bb91b3b35de34b3146c`; Quellight read-only observation `5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6`. Check remote and clean local state again before work. Read `docs/governance/VICT-STAGE-09-STATE.md` for live status and `docs/architecture/STAGE-09-STUDIO-AND-RECOVERY.md` for the proposed contract.

## Current authorization — G0 review only

The owner's 2026-09-29 request authorizes preparing a Stage 9 development cycle and pushing the reviewable planning pack. Stage 8's closure is a predecessor fact, not automatic permission to start G1. A fresh agent may review and correct this candidate in a documentation-only branch, verify paths and source facts, and push a report. It must not declare the architecture ratified, edit code or Quellight, publish packages, or activate a product. The owner's explicit G0 decision must be recorded before implementation authority is issued.

**G0 review task:** verify VICT and Quellight repository identities and current heads; read reference §23 Stage 9/§27, Stage 8 closure and follow-up register, current command/CLI/UI/application contracts; consolidate the September planning drafts without treating them as authority; check every proposed D-1–D-10 choice and its consequence. In particular, show an executable route for the ordinary Studio screens through a real VICT Application Definition/Plan, identify custom islands, reconcile `run.cancel` compatibility, and verify confirmation/idempotent replay semantics. Return a correction candidate and an owner-decision sheet. Only after the owner chooses and ratifies G0 may the handoff below be made executable with a committed-byte digest.

## Proposed post-G0 bounded work (not yet issued)

| Package | Candidate scope | Evidence and stop |
| --- | --- | --- |
| WP-1 operator reads | Bounded run/event/wait, graph/activation, Release, ChangeSet and audit reads through versioned commands; sanitized by default | Scope matrix, canary, pagination/ordering; stop on protected data leak or unversioned command |
| WP-2 operator authorization | Configured loopback target, distinct actor, server-side credential, authenticated Studio session and mutation protection | Real browser and direct-API allow/deny; no token in browser; stop on actor confusion or arbitrary target proxy |
| WP-3 confirmations/recovery | Proposed server-issued receipts for high-impact commands; fenced, audited bounded recovery | Direct-API missing/stale/mismatch/expiry/replay and same-key retry evidence; stop on bypass or incompatible legacy behavior without ratified D-4 |
| WP-4 CLI parity | Explicit entries for each supported operator command; correct flag/GET encoding | Equivalent isolated targets, same semantic result, no second effect |
| WP-5 Studio consumer | Private SvelteKit app using VICT Application Definition/Plan, `ui`, `ui-svelte` and justified custom operator components | Real browser S9-01–S9-04, empty/denied/stale/disconnected states, accessibility; stop if common screens silently become a parallel hand-built model |
| WP-6 product view | Two-actor permission-gated example; separately authorized Quellight S9-05 if chosen | Allow/safe projection/deny; Quellight claim only after its own governed increment and real proof |
| WP-7 integrated audit | Documentation, `verify:stage9`, independent usability/security review, owner report | Fresh independent verifier at exact pushed candidate; any later fix reruns affected checks |

WP-1 and WP-5 can start in parallel in isolated non-overlapping worktrees after G0, with a single integrator and integrity-recorded local artifacts. WP-3's safety decisions must be frozen first. Work packages are recommendations until G0. Publication is **not** a prerequisite for Studio development; a coordinated package publication and registry-only consumer proof require a separate owner decision after integrated local evidence.

## Gate protocol and pushed report

For every gate, the builder must: (1) state the exact authorized handoff and starting `origin/main` SHA; (2) use an isolated branch/worktree with no overlapping writes; (3) build and run the relevant checks; (4) commit the candidate and full evidence; (5) push the branch and independently fetch/compare the remote SHA; (6) stop and send the owner the branch link, full base/candidate SHAs, changed paths, commands/results, each criterion PASS/FAIL/NOT DEMONSTRATED, remaining risks and next proposed gate. A push alone is not a pass.

A fresh verifier in a separate context/checkout must check the exact candidate SHA, exercise negative paths and the real operator walkthrough, and push its audit record. Report the verifier SHA and any difference from the candidate. If code changes after verification, rerun impacted checks. Preserve failed observations. Use PASS, PASS WITH NON-BLOCKING FINDINGS, HELD, FAIL, or BLOCKED with direct evidence; only the owner records acceptance, amendment, and formal Stage 9 closure.

**Stop and return:** current remote moved; contract/source conflict; scope/authorization gap; security leakage; unable to reproduce baseline; failed check not attributable to the handoff; Studio-only application model emerging; unapproved ABI break; proposed Quellight edit; or publication/production activation. Don't rewrite a red test as a pass or upgrade an agent's recommendation into an owner decision.
