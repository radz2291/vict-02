# Studio Cycle 1.2 — candidate, independent verification pending

2026-10-23. [Owner Cycle1.1 closure](CYCLE-1-1-OWNER-CLOSURE.md) is committed
and remote-equal at `da1144c3332a0141aa778fcef26be1b8f6636b85` on
`codex/studio-cycle-1-1-owner-closure`. Stage 9 remains reopened. Current
implementation branch `codex/studio-cycle-1-2` descends from that closure.
Accepted delivery `de71260e…` and designer/closure lineage are preserved;
origin/main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`.

## Audit and bounded changes

[Requirement/evidence map](CYCLE-1-2-AUDIT.md) records existing capabilities
before code changes. Fresh context, canonical validation/history/save,
manual-edit protection and server refusal fences already work and are reused.
Only `AgentChat.svelte` product source changes:

- Turn-local cancellation, run ID and applied/refusal tracking replace shared
  async state. Stop feedback is immediate; its cleanup cannot overwrite a
  subsequent request's status.
- Queued frames after cancellation are discarded before handling proposals,
  progress or terminal counts. Already-applied changes remain undoable.
- A browser refusal is acknowledged and its already-fenced turn is cancelled.
  The composer settles promptly with the actual refusal and next action. Only
  a fresh user request reads refreshed context; no automatic replay or weakened
  revision/digest/epoch/draft guard is introduced.

Accepted interface, component palette, VICT/Mastra host, provider configuration,
full output/default thinking, shared Conversation, editing contracts, canonical
document/history, storage and credentials are unchanged.

## Builder checks

Full Studio **165/165 PASS**, 28 files,67.15s; TypeScript and ESLint pass.
Five new focused handoff tests exercise delayed Stop cleanup/new request,
real canonical stale/draft/digest refusal, fresh context and late-frame counts/
undo. The prior four red observations and initial EOF harness mistake remain
in `cycle-1-2/`; no failed run was erased or relabeled.

No production build was run in the owner-serving checkout. Its202 accepted
artifact files still match product9ae exactly; listener PID71088 and original
provider files remain. Three owner tabs were only read and retained; their
canvas/chat/draft hashes are recorded without copying content into evidence.
No reload, Save, provider replay, auth renewal or server restart occurred.
This remains a pending candidate until fresh independent verification passes.

## Required independent proof and delivery boundary

Exact pushed candidate in a separate context/checkout. Continuous real-provider
build → manual change/selection → agent continuation → interrupt → inspect/
Undo/Redo → Save/reopen → continue editing, plus targeted stale/draft/invalid/
failure checks and new lifecycle races. Distinguish transport fixtures, timing
seams and actual provider events. Reuse unchanged valid evidence rather than
repeat broad palette/auth/framework tests without cause.

Preserve owner5591 and its serving build; use an isolated production origin.
After verification provide a separate preview if activation would disturb
owner sessions. Commit/push evidence and compare remote SHA. No main merge,
publication, owner acceptance of1.2 or Cycle1.3.
