# Cycle 1.1 compact composer — verified and locally active

Owner amendment, 2026-10-23: replace Send with Stop during a turn; remove the
repeated screen name; put working status and details on one row below input.
This is a bounded presentation continuation, with no Cycle 1.2 authority.

Clean remote-equal starting delivery `a56ca3aa844a59e76d49748e62bb0cb9a5a1d3b0`,
isolated branch `codex/studio-cycle-1-1-chat-composer`. Fetched main remains
`d7401bef6e48330796c74ec00c86db9622d48cdf`. Original owner checkout stays on
its older main, with its untracked builder-kit archive untouched. Accepted
designer/closure and all previous failure and verification records remain.

Allowed presentation paths extend the previous Studio-only refinement by the
minimal optional `onStop` callback in the existing shared Conversation component
and its composer regression test. This enables the requested single native
button in the existing composer without a second composer, overlay or DOM
relocation. Consumers without the callback retain Send/Sending behavior.
No agent framework, provider/generation, contracts, document editing, history,
save, credentials, dependencies, palette or publication changes.

Studio supplies its existing cancellation handler while busy. The footer holds
one status/details row; detailed progress and selected-object context remain
available in details. Server admission, drafts and cancellation behavior remain.

Gate: affected Studio and shared composer tests, TypeScript and exact production
build; fresh independent exact pushed candidate verification of one Send/Stop
action, cancellation once, return to Send on success/failure/cancel, draft and
active hide/show preservation, status/details alignment, popup bounds at desktop,
short and mobile viewports. New UI transport fixtures must be labeled; no new
real-provider proof is implied by fixtures. Prior real-z.ai proof remains scoped
to unchanged provider/edit paths. Activate only the independently verified build
while preserving current owner documents/chat/drafts and all saved screens.

Stop ready for owner review. No owner acceptance, main merge or Stage 9 closure.

## Independent verdict and activation

Independent **PASS** on exact product `9ae689b487d610e3df0581885660fe096f645a88`.
Evidence `6d6ca50f57a65bcfe1b71601d614108188c47f4a` was pushed and remote-verified
on `codex/studio-cycle-1-1-chat-composer-verification`, then incorporated into
this delivery without product edits. [Independent report](verification-cycle-1-1-chat-composer/FINAL-VERIFICATION.md).

Builder and verifier: shared composer 6/6, affected Studio 10/10, TypeScript
pass. Builder ESLint passes. Independent exact production build and **26 browser
assertions pass**: single action, busy Enter guard, cancellation once even with
repeated immediate clicks, success/failure/cancel returning to Send while
preserving a changed next draft, active hide/show retention, one-row status/
details, three viewport sizes and popup bounds during multiline growth/resize.
No new product findings. Existing unrelated build warnings and inherited
real-provider latency/copy observations remain. UI proof uses explicitly
labeled transport fixtures; no new paid provider request or full-suite claim.
The retained failed npm CLI harness invocation is documented by the verifier;
the final intended Studio Vitest 3.2.7 run passes all ten tests.

All 202 independently built files were SHA256-verified before and after
activation into the builder's ignored build directory. Old hashed client assets
remain available. Runtime dependency equality and client credential isolation
pass. [Activation](cycle-1-1-chat-composer-2026-10-23/activation.json).
Only the idle 5591 listener was restarted using the existing secure launcher;
provider/generation/edit/history/save source and credential files are unchanged.
GLM-5.3-flash keeps its full output window and default thinking.

Both existing tabs retain byte-identical canvas/transcript/draft and original
undo history, with refreshed Ready connections and no reload/request replay.
A fresh visible tab contains the exact current purple Solehaus canonical
document, applied through the existing Source editor and left **unsaved**.
Saved screens were untouched. Existing conversations stay in their earlier
tabs; cross-tab conversation/history persistence remains outside this amendment.
[Preservation proof](cycle-1-1-chat-composer-2026-10-23/owner-preservation.json).

Root visually inspected the independent busy screenshot and the actual 5591
interface at its natural 959×668 viewport. One Send action and the Ready/details
row are visible, with no repeated screen name. Explicit viewport override was
reset. [Current interface](cycle-1-1-chat-composer-2026-10-23/latest-visible.jpg).

## Launch and owner walkthrough

Running at http://127.0.0.1:5591/design from branch
`codex/studio-cycle-1-1-chat-composer` in the isolated builder worktree.
Restart with the existing [secure launcher instructions](CYCLE-1-1-CHAT-CONTROLS.md#launch-and-hands-on-review)
against this branch's verified build. Temporary owner-selected auth/model files
remain server-side; no dependency or framework rebuild is needed.

Use the newly visible tab. Send a request: the same composer action becomes
Stop while it runs, then returns to Send. The lower row shows Working and the
details menu; open details for full progress or selected-element context.
View → Hide chat / Show chat still retains drafts and active work. Keep earlier
tabs for their existing conversations and undo history. Review copy is unsaved;
ordinary Undo/Save behavior is unchanged.

Ready for owner review only. No acceptance, whole-Stage-9 closure, publication,
main merge or Cycle 1.2 work is recorded.
