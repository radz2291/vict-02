# Cycle 1.1 chat controls refinement — IN PROGRESS

2026-10-23, Asia/Kuala_Lumpur. Owner says functionality appears well, then
requests removing “Studio agent,” chat hiding in the top menu, and remaining
chat capabilities at the bottom. This is bounded Cycle 1.1 presentation work;
it does not imply formal acceptance, Stage 9 closure or Cycle 1.2 authority.

## Baseline and scope

Clean remote-equal delivery `14961bebb8e5a2f8cca1eca87b73c9a5b379f60d`, new
isolated branch `codex/studio-cycle-1-1-chat-controls`. Fetched main remains
`d7401bef6e48330796c74ec00c86db9622d48cdf`. Root instructions and canonical
reference/Stage 9 state/architecture/handoff/current Studio state were reviewed.
Accepted Designer and closure ancestry and all prior evidence are preserved.
Only Studio presentation and its tests/evidence change. No shared framework,
agent/server generation, credentials, edit/history/save or palette changes.

The existing View menu already hides the panel using the HTML hidden attribute,
keeping AgentChat mounted. Reuse that mechanism with plain Hide chat/Show chat
labels, with no duplicate panel close entry. Remove the heading and repeated
assistant branding, use Chat/Message accessibility labels, and place document/
selection context, Stop, details/reconnect/activity/record at the bottom.
Details opens upward within the transcript boundary.

## Verification and activation gate

Affected UI tests and TypeScript/build. Fresh independent exact pushed candidate
challenge in the actual shell: top-menu hide/show expands canvas and preserves
draft/feed/pending turn; controls remain at bottom while working; Stop/reconnect
and failure feedback remain usable; details popup stays within the panel and
avoids composer/canvas at desktop, short and mobile sizes. Model and canonical
editing source must remain unchanged. This presentation repair does not need
another paid broad-provider walkthrough; existing exact full-thinking live proof
is retained and new UI transport fixtures must be labeled as such.

Preserve the owner's current canvas/chat/draft. Frontend presentation changes
require a safe fresh page load; do not silently discard unsaved or ephemeral
owner work. Independent artifact identity and current tab state determine the
activation approach. Commit/push candidate and evidence, compare remote SHA,
stop ready for owner review; no main merge or later cycle.
