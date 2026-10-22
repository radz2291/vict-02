# Cycle 1.1 existing-screen revision repair — in progress

2026-10-23. Owner reported rejection when requesting a Quellight landing page
directly on the open saved screen, then asked whether agent/system instructions
were responsible. A new blank screen is not a prerequisite.

## Authority and baseline

Bounded owner-observed Cycle 1.1 repair, isolated branch
`codex/studio-cycle-1-1-revision-repair` from clean remote-equal delivery
`8fd417c91916dfa2f6d801306cf89b7a66f713f7`. Refetched main remains
`d7401bef6e48330796c74ec00c86db9622d48cdf`. Accepted Designer and all prior
closure/failed evidence remain. Root instructions and current system/Stage 9
state/architecture/handoff were reviewed. Allowed scope: Studio agent read/edit
context, prompt/schema guidance, truthful argument validation and focused tests,
plus Studio state/evidence. No shared framework, canonical editing/history/save
changes, palette expansion or Cycle 1.2.

## Observed failure and cause

The owner's existing Designer tab had the saved placeholder dialog and two
failed chat requests: the landing-page request, followed by “ok go”. The agent
reported document version `r1.r2`, unchanged content/digest, and repeated
`UI_DOC_STALE_REVISION`. The visible terminal message exactly matches server
`prepareAgentEdit` validation, rather than the distinct browser compare/apply
message. No canvas edits were applied. The original browser tab was read only.
[Observed rejection](cycle-1-1-revision-repair-2026-10-23/owner-rejection.jpg).

The context exposed saved `document.revision` and opaque working
`cursor.revision`, with no matching top-level edit argument. Wrong
`expectedRevision` and a genuinely changed captured document were classified
as the same stale error. Instructions required a new user request after stale
refusal, creating the repeated “go ahead” loop for a model argument error.
Raw original model arguments were not retained by that completed run, so the
saved-version substitution is inferred from the transcript plus exact code
path; deterministic saved-screen reproduction separately exercises it.

There was also an unconditional registration-form instruction. It could bias
a landing-page request toward a form; this is corrected to an example only
when the user requests a form.

## Candidate repair

- Read results now expose top-level `expectedRevision`, matching the edit
  argument; successful edit results return the next token with that same name.
  Guidance explicitly distinguishes it from saved source metadata.
- Wrong revision arguments are refused with
  `STUDIO_AGENT_REVISION_MISMATCH` and the exact expected token. The model may
  re-read/correct that argument within the already authorized request.
- A changed captured document remains `UI_DOC_STALE_REVISION`. Browser
  epoch/revision/digest comparison, canonical validation, acknowledgement,
  sticky refusal fence and draft protection remain in place. No revision is
  silently substituted and no stale edit is applied.
- Actual browser stale/draft refusals still require fresh user direction.
  Bounded schema diagnostics now identify invalid fields rather than the
  unhelpful generic “Invalid edit”.

Gate: independent fresh-context exact-candidate checks, production real z.ai
editing on an existing saved nonempty screen (not just a new blank screen),
multiple batches, Undo/Redo, Save/reopen, and genuine stale/draft rejection.
Preserve owner canvas/chat/draft during activation; no owner acceptance or
Cycle 1.2. Earlier delivery verdicts remain historical within their tested scope.

## Builder checks

Full Studio suite: **145/145 tests, 26 files, 58.06 seconds**. Includes a
saved nonempty document where source and working revisions differ, refusal
with zero effects for a wrong source-version argument, corrected same-turn
execution through the real pinned Mastra host, Undo restoration, and a genuine
manual-edit stale refusal that stays fenced after a re-read/retry. Earlier
epoch/digest/draft/replay protections remain tested. Studio TypeScript check
and scoped ESLint pass. Expected test-local target connection refusals and
inherited Svelte warnings remain in logs.

The first targeted run had two new fixture setup failures: an uncomposed palette
dialog did not pass save validation. The fixture was corrected to a valid saved
nonempty heading before the full run. Its original 10-pass/2-fail log is retained
as a fixture observation, not claimed as a product failure or live provider proof.
[Builder evidence](cycle-1-1-revision-repair-2026-10-23/).

No live owner request was retried, no owner screen was edited, and no owner tab
was refreshed during diagnosis. Exact-candidate independent production and
real-provider proof remain pending.
