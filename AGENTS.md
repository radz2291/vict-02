# VICT agent entry

Read `docs/VICT-SYSTEM-REFERENCE.md` for canonical VICT semantics. For Stage 9, read `docs/governance/VICT-STAGE-09-STATE.md`, `docs/architecture/STAGE-09-STUDIO-AND-RECOVERY.md`, and `docs/handoff/VICT-STAGE-09-STUDIO-HANDOFF.md` in that order. A proposed document does not authorize implementation.

Before any Stage 9 task, compare the local branch, clean working tree, and `origin/main` with the exact baseline in the current handoff. Use an isolated branch or worktree; never overwrite another track. The handoff states the allowed paths and gate. If the baseline or authority has moved, stop and reconcile it.

For each completed gate, commit and push the candidate and evidence, verify the remote SHA, and give the owner the branch, full SHA, checks, findings, and next allowed action. A builder's report is a candidate; an independent verifier supplies the gate verdict. Keep failed observations and earlier decisions. Never mark Stage 9 Verified merely because code was pushed.
