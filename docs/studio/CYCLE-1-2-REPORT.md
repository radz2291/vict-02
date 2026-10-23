# Studio Cycle 1.2 — verified, ready for owner review

2026-10-23. [Owner Cycle 1.1 closure](CYCLE-1-1-OWNER-CLOSURE.md) is committed
and remote-equal at `da1144c3332a0141aa778fcef26be1b8f6636b85` on
`codex/studio-cycle-1-1-owner-closure`. Stage 9 remains reopened. Current
implementation branch `codex/studio-cycle-1-2` descends from that closure.
Accepted delivery `de71260e…` and designer/closure lineage are preserved;
origin/main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`.

Current verdict: **PASS WITH RETAINED NON-BLOCKING FINDINGS**, independently
verified exact product `7874c64158b877c574ceff04e1917773bc03afe6`.
Independent evidence `567d6bc2e6028221b4e457e55e6e2521a4fcb3ed` on
`codex/studio-cycle-1-2-verification` is pushed, remote-verified and incorporated
without product changes. [Full independent report](verification-cycle-1-2/FINAL-VERIFICATION.md).
The builder handoff and issued proof below are retained; their completed gate
and protected separate preview are recorded in the final sections.

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
This was pending at builder handoff; the final independent verdict below
supersedes that readiness status without changing earlier observations.

## Issued independent proof and delivery boundary

Exact pushed candidate in a separate context/checkout. Continuous real-provider
build → manual change/selection → agent continuation → interrupt → inspect/
Undo/Redo → Save/reopen → continue editing, plus targeted stale/draft/invalid/
failure checks and new lifecycle races. Distinguish transport fixtures, timing
seams and actual provider events. Reuse unchanged valid evidence rather than
repeat broad palette/auth/framework tests without cause.

Preserve owner5591 and its serving build; use an isolated production origin.
After verification provide a separate preview if activation would disturb
owner sessions. Commit/push evidence and compare remote SHA. No main merge,
publication, owner acceptance of1.2 or Cycle 1.3.

## Completed independent proof

| Requirement | Final result |
| --- | --- |
| Current manual document and selection | PASS: actual public Source Apply plus Layers selection; subsequent real-provider request contains exactly that document/occurrence and preserves the manually authored title. |
| Manual intervention and safe fresh continuation | PASS: actual fifth-provider proposal is delayed only at a labelled timing seam while a manual edit applies. Canonical stale refusal has zero successful effects; Send returns 236 ms after release. Sixth explicit request captures the changed digest/revision/document. No automatic replay. |
| Pending draft | PASS: actual sixth-provider proposal encounters a public Source draft. Correct refusal, zero successful effects, exact draft retained; composer settles in 138 ms. Discard restores the unchanged canonical source. |
| Stop and shared history | PASS: Stop after one actual validated batch, DELETE 200 arrives 49 ms after acknowledgement, no further canonical effects. Three Undo and three Redo cross agent, manual and interrupted entries and restore the exact document. |
| Save/reopen and continued work | PASS: exact saved canonical source at r1.r1 reopens; fourth real-provider request uses it, applies a privacy note and retains manual content. |
| Invalid/interrupted turns | PASS: new independent deterministic acknowledgement-transport failure retains actual local effect and Undo; obsolete buffered frames cannot revive a refused turn or overwrite a newer one; invalid multi-operation proposal refuses atomically without history or replay. |

The first four real z.ai GLM-5.3-Flash turns form one continuous page/profile/
document journey; six explicit real turns in total include targeted stale/draft
challenges. Positive edits are genuine provider proposals through VICT/Mastra
and browser acknowledgements. Timing seams change delivery timing only. Separate
transport fixtures prove UI negatives, not a real upstream outage. Prior genuine
provider rejection/auth/CSRF proof is reused for unchanged boundaries.
[Raw live proof](verification-cycle-1-2/continuous-real-provider.json),
[timings](verification-cycle-1-2/real-proof-summary.json).

Independent full Studio **165/165**, three additional adversarial tests and
**26/26 production UI assertions** pass. TypeScript/lint and exact production
build pass; all202 artifact hashes, physical runtime dependency equality and
credential/client isolation pass. Initial Vite two-root filesystem/config-path
setup failures remain with their corrected reruns; missing files/concurrent
rebuild were disproved diagnoses, not product failures or hidden repairs.

## Protected review preview

The exact independent build was rehashed before launching a separate preview:
[202-file check](cycle-1-2/preview-artifact.json),
[read-only verifier](cycle-1-2/verify-preview.mjs).
It runs at **http://localhost:5593/design** from the verifier checkout:
`C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1-chat-ui-verification/260831-VCT-02`.

The owner instance remains **http://127.0.0.1:5591/design**, PID71088 unchanged,
with all202 accepted1.1 artifact hashes intact. The three owner tabs retain
byte-identical canvas/transcript/chat draft/Source draft/property drafts. No
owner tab reload, login renewal, Save, request replay or cookie replacement
occurred. Provider files have unchanged size/write metadata. Different hostnames
are deliberate: the existing host-only cookie is port-independent; signing into
another127.0.0.1 port would replace its value. Separate localhost avoids that.
[Owner tab checks](cycle-1-2/owner-after.json),
[server/config checks](cycle-1-2/owner-server-after.json).

Visible review tab contains an **unsaved disposable copy** of the real-provider
post-reopen form. It adopts only the fresh preview document id/revision through
the ordinary Source editor; all content is copied from recorded test proof.
Its history/conversation is a fresh review session, not the live journey's
history. Earlier owner histories/conversations remain in their original tabs.
The first import retained an incompatible source revision and was correctly
refused; matching the new document identity/revision then applied normally.
That setup observation is retained in owner-after.json. No owner data changed.
[Review screenshot](cycle-1-2/review-preview.jpg).

To restart the review preview, use PowerShell in the verifier checkout above
with its preserved exact build (do not rebuild or replace the owner5591 build):

```powershell
$env:ORIGIN='http://localhost:5593'
$env:HOST='localhost'
$env:PORT='5593'
$env:STUDIO_AGENT_MODEL='zai/glm-5.3-flash'
$env:STUDIO_AGENT_AUTH_FILE=Join-Path $env:USERPROFILE '.pi/agent/auth.json'
$env:STUDIO_AGENT_MODELS_FILE=Join-Path $env:USERPROFILE '.pi/agent/models.json'
node apps/studio/scripts/launch-agent.mjs
```

## Short owner walkthrough and retained findings

1. In the separate preview, manually edit the form's heading, select an element
   through Document → Layers and ask the agent to change the selection. Your
   manual edit should remain.
2. During another request, apply a manual change or leave a property/Source
   draft. An outdated proposal is refused. Apply/cancel any draft, then send
   a fresh request; current context is read and the old edit is not replayed.
3. Ask for several small additions; press Stop after a visible update. Inspect
   the applied batch, use Undo/Redo, then Save and File → Reload saved version.
   Ask for another edit on the reopened screen.

No new product findings. The accepted1.1 oversized-request socket reset,
precise field selection via Layers, variable provider/cleanup latency, verbose
assistant copy, existing diagnostics and ephemeral-chat/deployment limits remain
retained. New small-form timing samples are35.721s to first proposal/43.734s
to initial completion; these do not replace earlier latency observations or
provide guarantees. No durable chat recovery/multi-user/palette/backend/node
scope is added.

**Cycle 1.2 is independently verified and ready for owner review, not owner
accepted. Stage 9 remains reopened; Cycle 1.1 remains owner accepted/closed.**
No main merge, publication or Cycle 1.3 occurred. Next allowed action: owner review.
