# Cycle 1.1 existing-screen revision repair — verified and locally active

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
was refreshed during diagnosis.

## Independent final gate

Exact product `4700689bf985c83cd3f944ad4cd324f2bfe8d724` on
`codex/studio-cycle-1-1-revision-repair`: **PASS WITH NON-BLOCKING FINDINGS**.
Fresh independent evidence `192d6380490ab87880e206a27dceffacd51e18c3` on
`codex/studio-cycle-1-1-revision-verification` is pushed and remote-verified.
[Independent report](verification-cycle-1-1-revision-repair/FINAL-VERIFICATION.md).
Studio source tree `2922600773758df5dde65c369d5fdca3f6423b18` stays unchanged
after that product; later delivery changes are documentation/evidence only.

Independent full suite **145/145**, 26 files, 65.10s; TypeScript, scoped lint and
production build pass. Real z.ai used a manually authored, saved-twice, reopened,
nonempty screen. A single Quellight landing-page request produced two accepted
browser-acknowledged batches on the same screen ID, with no refusals, new screen,
fresh-go loop or registration-form substitution:

| Step | Saved source version | Expected and cursor working revision | Acknowledged next revision |
| --- | --- | --- | --- |
| Hero and description | `r1.r2` | `r1.r2#0` | `r1.r2#1` |
| Features and action | `r1.r2` | `r1.r2#1` | `r1.r2#2` |

Turn `turn-ca313149-9705-4c97-bbc7-da08a54049b2` took 91.920s in this sample;
that is not a latency guarantee. Undo/Redo preserved exact canonical source, and
Save/reopen passed. [Observed existing-screen result](verification-cycle-1-1-revision-repair/production-quellight-existing.png).

Two additional real-provider controls delayed an unchanged proposal before actual
Designer consumption: a manual canonical edit caused `UI_DOC_STALE_REVISION`
with zero agent effects and the manual change retained; an unapplied source draft
caused `STUDIO_AGENT_DRAFT`, zero agent effects and the exact draft retained.
The draft control first had a safely refused invalid model operation, followed
by re-read/correction within the same request; that intermediate failure is
retained. The positive saved-screen run had zero refusals. No browser errors
were observed. The selected-credential/client-marker scans pass.

The original raw owner tool arguments remain unavailable, as noted above.
No new gating defect was found. Prior local-preview, chat, selection/diagnostics
and synthetic popover-resize limits remain recorded in earlier reports; this
repair does not claim complete model correctness or general deployment readiness.

## Local activation and owner continuation

The independent 202-file artifact was reused after manifest and same-physical-file
dependency checks. [Activation](cycle-1-1-revision-repair-2026-10-23/activation.json)
verifies every copied file hash, retaining old hashed client assets. Only the
idle owned 5591 server was restarted through the existing secure launcher with
the designated temporary z.ai files. External credential/model files were not
copied or modified. A temporary same-origin login tab renewed the session and
was closed; both loaded Designer tabs reconnected without reload/navigation.

[Preservation record](cycle-1-1-revision-repair-2026-10-23/owner-preservation.json)
confirms identical canvas DOM, chat feed and composer draft in both existing
tabs. Their mounted editors/history remain intact. The original owner's failed
chat stays as history; no owner request was automatically retried, no screen
was created, and no saved source was overwritten. Existing clients use the
repaired server prompt/context immediately because the wire contract remains
compatible. The owner tab shows Ready.

Continue at `http://127.0.0.1:5591/design`: retry the original Quellight landing-page
request directly on the current screen. A blank screen was only an acceptance
walkthrough starting point. For a later fresh launch, use the prepared-checkout
[secure launcher commands](CYCLE-1-1-CHAT-UI-REPAIR.md#launch-and-hands-on-review);
stop the existing owned instance before rebuilding. The provider remains
`zai/glm-5.3-flash`, with credentials held server-side.

Cycle 1.1 is independently verified and ready for owner review. Owner acceptance
is separate; broader Stage 9 remains reopened. No main merge, publication,
Quellight product/backend change or Cycle 1.2 was begun.
