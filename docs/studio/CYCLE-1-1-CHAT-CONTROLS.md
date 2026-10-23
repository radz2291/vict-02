# Cycle 1.1 chat controls refinement — verified, ready for owner review

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

## Retained initial geometry failure and repair

Independent actual-shell challenge of pushed `d23d73144770e7181c9b46febdfdec76f0c554e5`
found the bottom trigger's popup overlapping the composer: at 1280×720 its
y292..612 rectangle covered the y536..611 composer. Transcript collision bounds
alone did not move a floating popup anchored below the composer. Candidate
was not activated; all initial observations are retained by the verifier.

Repair keeps the trigger at the footer but uses the existing Conversation form
as the supported Bits custom anchor. Its top edge is the live transcript /
composer boundary. The popup opens above that edge, with no hardcoded height
offset or duplicate composer. Resize updates remain with the existing floating
primitive. No shared component or server edit. Exact repaired-commit production
geometry, dynamic resize, keyboard and hide/show re-verification is required.

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

## Final independent verdict and local activation

Independent **PASS** on exact product `402dec75c7593fe23e41f3d3c0659ca61a8edc27`.
Evidence `ed75a0f7927e066c5994d5784fe67bc40f540b22` was pushed and remote-verified
on `codex/studio-cycle-1-1-chat-controls-verification-final`, then incorporated
here with the initial failed evidence intact. [Independent report](verification-cycle-1-1-chat-controls-final/FINAL-VERIFICATION.md).
Builder and verifier affected tests pass 10/10; TypeScript passes. Independent
exact production build and 13 production browser assertions pass, including
desktop, short desktop, mobile, pending hide/show, Stop, provider-failure UI,
reconnect, multiline input, dynamic popup growth and viewport resizing.
No new findings. Prior real-provider latency/copy findings remain historical;
no new paid provider call was needed for these presentation-only changes.
Server/provider/edit/history/save sources are unchanged from preceding delivery.

All 202 independently built artifact files were SHA256-verified before and
after copying into the existing ignored build directory. Old hashed assets
were preserved. [Activation record](cycle-1-1-chat-controls-2026-10-23/activation.json).
Only the idle 5591 listener was restarted; unrelated servers were untouched.
The existing secure launcher continues using the owner-selected temporary
z.ai GLM-5.3-flash configuration, full output window and default thinking.
Credentials remain server-side and were not copied into the repository.

The original tab was never reloaded or saved. Its canvas, transcript and draft
are byte-identical; its connection was renewed to Ready without replaying a
request. It retains its original frontend until the owner safely reloads it.
The existing empty review tab was safely reloaded and now shows the new UI
with an exact canonical-source copy of the owner's current Solehaus screen,
applied through the ordinary Source editor and left **unsaved**. No saved
screen was changed. Original conversation/history remain in the original tab;
this presentation patch adds no cross-tab conversation persistence.
[Preservation evidence](cycle-1-1-chat-controls-2026-10-23/owner-preservation.json).

Root also visually inspected the actual 5591 review tab and checked View
Hide/Show: canvas width 908.8→1228.8 px. [Chat visible](cycle-1-1-chat-controls-2026-10-23/review-chat-visible.jpg),
[chat hidden](cycle-1-1-chat-controls-2026-10-23/review-chat-hidden.jpg).

## Launch and hands-on review

Running at http://127.0.0.1:5591/design from the isolated builder worktree.
For restart, use PowerShell in this branch's worktree with its verified build:

```powershell
$env:ORIGIN='http://127.0.0.1:5591'
$env:HOST='127.0.0.1'
$env:PORT='5591'
$env:STUDIO_AGENT_MODEL='zai/glm-5.3-flash'
$env:STUDIO_AGENT_AUTH_FILE=Join-Path $env:USERPROFILE '.pi/agent/auth.json'
$env:STUDIO_AGENT_MODELS_FILE=Join-Path $env:USERPROFILE '.pi/agent/models.json'
node apps/studio/scripts/launch-agent.mjs
```

Use the updated separate review tab. View → Hide chat expands the canvas;
View → Show chat restores it. Type a draft and toggle visibility to check
retention. Context and the details menu sit below the composer; details contains
connection/reconnect and turn activity. Stop appears there during a turn.
Ordinary edits still share manual Undo/Save behavior. Keep using the original
tab for its existing unsaved work/history; do not overwrite its saved source
with the review copy unintentionally.

Next allowed action: owner review. No owner acceptance, whole-Stage-9 closure,
main merge or Cycle 1.2 work is recorded or authorized by this delivery.
