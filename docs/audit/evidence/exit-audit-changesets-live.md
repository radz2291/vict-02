# Live changesets journey transcripts (exit audit)

propose (Studio form): cs-exit-audit-2 draft created
evidence: validation run run-cg05nu4i attached
SELF-APPROVAL negative: author decides -> VICT_ACTOR_SCOPE_DENIED (403), no decision recorded
approver-a decide approved: status approved, contentHash v1_6812d239...
commit: status committed, appliedKinds [select-activation], appliedCount 1
DUPLICATE commit (fresh key): status committed replay, no second effect
MISSING APPROVAL negative: commit of never-approved draft cs-exit-audit-4 -> VICT_CONTROL_CHANGESET_NOT_APPROVED
BASE_STALE negative (also live): commit with stale declared base -> VICT_CONTROL_BASE_STALE, failed closed before any mutation
