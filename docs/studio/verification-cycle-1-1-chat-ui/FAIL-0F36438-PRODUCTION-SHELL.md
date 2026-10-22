# Superseding verdict: FAIL — actual production shell details containment

Exact product `0f36438f8c8a7f25f9878f7ff626b86f4e25afae`.
This new observation supersedes the earlier PASS WITH NON-BLOCKING FINDINGS
in FINAL-VERIFICATION.md, retained unchanged as the earlier decision.
No implementation or artifact bytes were modified by the verifier.

The parent requested one final challenge against the actual production shell
rather than the fixture's simplified top label. The original real-provider
driver had closed its isolated browser at completion, so this challenge launches
a fresh independent headless profile at the same production origin 5592.
It replays the already recorded provider text plus eight explicitly labeled
activity messages by intercepting ONLY the browser POST response. It does not
contact the provider, apply a new edit, or claim additional live-agent proof.
Its purpose is deterministic populated layout inside the actual production
Designer toolbar/footer/ControlScope. Existing real-provider acceptance evidence
remains unchanged and separate.

At 1280×500, actual production details measures x=8, right=368, width=360;
the chat panel ends at x=320. The details bottom is y=378, while composer
top is y=369 (textarea starts y=380). This spills 48 px into the canvas and
overlaps the composer by 9 px. The screenshot was viewed directly. The isolated
fixture measured 280 px wide and did not show this failure.

The production ControlScope activates the more specific shared rule
`.vict-controls [data-popover-content]:not(:has(...))` in catalog.css, which
overrides the less specific `.studio-chat-details` width/padding rules.
The actual shell also has a 44.1875 px toolbar and 24 px footer instead of
the fixture's 36 px label. A bounded Studio CSS specificity/height correction
must be independently rebuilt and checked at an exact pushed candidate before
artifact activation. The existing manifest describes the failed candidate and
is not approved for activation by this superseding report.

[Actual-shell driver](production-shell-layout.mjs), [record](production-shell-layout.json),
[log](production-shell-layout.log), [short screenshot](production-shell-replay-1280x500.png).

All prior tests, safe formatting, real agent edit, history/save proofs and
nonblocking reference-image finding remain retained. Only the demonstrated
chat details containment claim fails. Owner acceptance, whole Stage 9 closure
and Cycle 1.2 remain outside scope.
