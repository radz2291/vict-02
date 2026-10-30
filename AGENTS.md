> This is a sanitized public snapshot of paused work. Read [the public pause handoff](docs/studio/VICT-PAUSED-PUBLIC-HANDOFF-20261030.md) before the historical instructions below. Publication does not resume implementation or authorize acceptance.

# VICT agent entry

Read `docs/VICT-SYSTEM-REFERENCE.md` for canonical VICT semantics. For Stage 9, read `docs/governance/VICT-STAGE-09-STATE.md`, `docs/architecture/STAGE-09-STUDIO-AND-RECOVERY.md`, and `docs/handoff/VICT-STAGE-09-STUDIO-HANDOFF.md` in that order. A proposed document does not authorize implementation.

Before any Stage 9 task, compare the local branch, clean working tree, and `origin/main` with the exact baseline in the current handoff. Use an isolated branch or worktree; never overwrite another track. The handoff states the allowed paths and gate. If the baseline or authority has moved, stop and reconcile it.

For each completed gate, commit and push the candidate and evidence, verify the remote SHA, and give the owner the branch, full SHA, checks, findings, and next allowed action. A builder's report is a candidate; an independent verifier supplies the gate verdict. Keep failed observations and earlier decisions. Never mark Stage 9 Verified merely because code was pushed.

## UI foundation workstream

For UI foundation tasks, read `docs/ui-foundation/STATE.md`, `docs/ui-foundation/PRODUCT-ARCHITECTURE.md`, `docs/ui-foundation/CONTRACTS.md`, `docs/ui-foundation/STAGES-AND-VERIFICATION.md`, and `docs/ui-foundation/HANDOFF.md`. Use `docs/VICT-SYSTEM-REFERENCE.md` for existing VICT semantics. Current owner instructions take precedence over historical guidance; record material amendments faithfully.

This workstream builds reusable UI and authoring capabilities for the same VICT Studio. It does not own the complete Studio application. Exact current scope and authority live in STATE and HANDOFF, not in this entry file.

Before work, verify repository, remote, baseline, branch and working tree. Preserve concurrent work. Use an isolated branch/worktree. A proposed contract or a builder report does not count as implementation acceptance.

One stage manager owns the accepted stage through candidate, independent challenge, bounded repair, re-verification and reporting. It may delegate non-overlapping work when useful. A fresh verifier challenges an exact commit, does not silently repair it, and reports missing demonstrations. Preserve failed evidence and earlier decisions.

Proceed autonomously with routine choices and in-scope repairs. Return for a concrete product/authority fork or genuine stop condition. Do not ask the owner to relay every repair. Record tested candidate and verifier SHAs, verdict, findings and next authorized action. Stop at the accepted stage boundary.

Do not edit another track's source, rewrite Stage 9 closure, publish packages, merge to main or activate a product merely because the foundation stage passed. Use the actual scope in HANDOFF.

## Reusable UI architecture conformance

The owner requires every new or changed reusable UI component to follow the established VICT architecture. Read [the component conformance acceptance check](docs/studio/AUTHORING-FOUNDATION-COMPONENT-CONFORMANCE.md). Reuse existing public VICT controls/catalog wrappers and their intended shadcn/Bits interactions where the capability is already covered. Custom specialist geometry or native media primitives need a documented architectural reason; package dependencies alone do not prove integration. Verify semantic tokens/themes, CSS and control scope in isolated consumers/iframes/capture, declared authoring parts/contracts, accessibility, runtime behavior and applicable save/export/import paths. Preserve canonical source/history and existing accepted behavior. Completion requires conformance evidence or an explicit owner-approved exception; agents cannot approve their own exceptions. Ordinary integration repairs remain in scope; material architecture changes require an owner decision.

For AI/chat exposure, also read [AI-EX01](docs/studio/AUTHORING-FOUNDATION-AI-EXPOSURE.md). Intended public reusable capabilities must have real Studio manual and agent authoring contracts, rather than exports alone. Reuse the existing patterns, preserve prior revisions, and justify internal-only exclusions. Reasoning displays consume supplied public summaries or execution receipts, never private chain of thought or fabricated traces. Presentation and typed intent outputs do not grant provider, tool, approval or history authority. Distinguish source/tests from actual-agent and browser evidence.
