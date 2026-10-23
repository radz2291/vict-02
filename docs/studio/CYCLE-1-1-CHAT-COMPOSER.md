# Cycle 1.1 compact composer — in progress

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
