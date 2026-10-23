# Cycle 1.2 audit before implementation

2026-10-23. Accepted product `9ae689b487d610e3df0581885660fe096f645a88`,
delivery `de71260e07709aef610c028862d3cc5f3251b1df`; owner closure/1.2 authority
`da1144c3332a0141aa778fcef26be1b8f6636b85`. Clean isolated implementation
branch `codex/studio-cycle-1-2` starts from closure. Main remains `d7401bef…`.
No owner walkthrough is repeated. No owner server/build/tab is modified.

## Existing delivery mapped to owner requirements

| Requirement | Existing implementation and valid evidence | Remaining proof/change |
| --- | --- | --- |
| Manual state/selection then agent continues | Designer passes a live getContext callback reading current bridge.document, snapshot revision, epoch and selection on every send. agentContext exposes that exact snapshot. Existing-screen revision repair and real selected-field changes pass in revision/tool-completion verification. | Prove the continuous mixed journey on the1.2 exact candidate; no replacement context system needed. |
| Manual edit during turn survives; stale refuses; refresh without replay | applyAgentProposal synchronously checks epoch/revision/digest and draft guards, then validates/applies via the existing EditorBridge. Server browser refusals are sticky; new read cannot bypass the refusal. Prior real-provider stale/draft probes and canonical undo/reopen-ABA tests pass. | Promptly settle a refused browser turn so fresh requests are available without waiting for further model thinking. Keep refreshed context exclusive to a new user request, never automatic replay or weakening a fence. |
| Stop blocks future edits, preserves applied edits and accurate status | Client abort-checks proposals; server aborts/fences queued capabilities and pending acknowledgements. Local applied counter survives disconnect. Existing host cancellation, real disconnect after applied batches and compact-composer single Stop tests pass. | Isolate delayed Stop cleanup from a newer turn's status; discard queued frames after cancellation so late terminal counts/copy cannot misreport local effects. |
| Shared canonical mixed history, Undo/Redo/Save/reopen | All accepted agent proposals use the same bridge.apply and history as manual edits. Each transaction is atomic/undoable. Store uses expected saved revisions. Existing canonical and real-provider save/reopen/add/move/remove proof passes. | Continuous mixed history and post-reopen continuation proof; no second document/history/store or rewrite needed. |
| Invalid/interrupted turns leave usable editor and next action | prepareAgentEdit validates whole transactions; browser repeats validation/digest checks; incomplete tools, provider failures and interrupted streams retain local edits and clear composer busy on settlement. | Include client-refusal settlement and targeted interrupted/invalid negatives in candidate verification. Reuse prior unchanged auth/credential/schema/provider evidence. |

Evidence reused: `verification-cycle-1-1/FINAL-VERIFICATION.md`,
`verification-cycle-1-1-revision-repair/FINAL-VERIFICATION.md`,
`verification-cycle-1-1-tool-completion/FINAL-VERIFICATION.md`, and
`verification-cycle-1-1-chat-composer/FINAL-VERIFICATION.md`. Their exact
candidate identities and simulated/live distinctions remain unchanged.

## Reproduced remaining gaps

`cycle-1-2/baseline-handoff-red.log` runs four new UI boundary cases against
unchanged accepted product source. All four fail:

1. Stop's awaited DELETE finishes after another request begins and overwrites
   the new turn's status with Stopped. This is a real asynchronous ordering race.
2. A genuine canonical manual-edit stale refusal leaves the composer pending
   until the model/transport ends, despite the host's sticky refusal.
3. A pending draft refusal has the same avoidable wait.
4. A deliberately abort-insensitive transport queues a proposal and completed
   event after Stop. The existing apply guard prevents the late edit, but the
   terminal claims two applied edits when only one applied locally and replaces
   cancellation feedback. This is explicitly a synthetic buffered-frame stress,
   not a claimed observed live-provider failure.

The initial fixture omitted EOF after done. That incomplete harness observation
is retained in baseline-handoff-initial.log; corrected EOF produces the red log
above. The regression uses real EditorBridge/applyAgentProposal for stale,
draft, document preservation and undo. Transport events are deterministic.

## Bounded implementation decision

Change only Studio AgentChat turn bookkeeping and settlement: per-turn abort/
runId/applied/refusal state, immediate local Stop feedback with fire-and-forget
server cancellation, ignore post-cancel frames, and acknowledge then cancel a
browser-refused turn. Keep a clear refusal/next request action. No auto replay,
mid-turn context refresh, new chat control, shared component, canonical editor,
provider/system-prompt/output/thinking, framework, palette, dependency or storage
change is necessary. Valid features remain untouched.

## Candidate gate

New regressions plus relevant Studio suites/TypeScript; exact production build
in a separate checkout. Fresh independent verifier must challenge the exact
pushed candidate, including the continuous real-z.ai journey and targeted stale,
draft, invalid, cancellation and failure paths. Reuse unchanged broad evidence;
label fixtures and transport seams. Keep all owner5591 sessions running, never
reload their tabs or overwrite their serving build. Provide a separate verified
preview if necessary, without replacing owner work. No1.2 acceptance or1.3.
