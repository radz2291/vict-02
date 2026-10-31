# Independent shared-hub repair review

31 October2026. Exact candidate `2ba96b7e804fd2cdea4ac12ec8d76193fe6a851d`, parent `41c7b4129ee0c72a80cb7ec29f4a10c4489eef07`. Isolated review branch `codex/independent-hub-recheck-20261031`, worktree `C:/Users/RZ1/.codex/worktrees/vict-limits-independent-20261031`. Previous verifier branch/commit84833648 and all failed evidence remain preserved. Same independently installed dependencies; changed runtime rebuilt locally. No product source edits, provider/browser operations, activation, push or acceptance.

**F-LIMIT-01 closed on this exact repair; new F-LIMIT-02 remains OPEN. No integrated award.**

## Confirmed repair

The retained independent concurrent async-publication RED now passes. Admission owns a private frozen event before queuing. A per-stream tail serializes durable append and awaited delivery, propagates each caller's own failure, and recovers the tail after failure. Other streams remain independent. Builder's admission mutation, failed append/live-delivery recovery, abort/unsubscribe and cross-stream tests pass independently. Exact retained reproduction plus runtime/backpressure/conformance/real HTTP SSE:45/45 PASS. Runtime build PASS. Pinned Mastra >64-tool completion, initial blocked delivery abort and own later tool-result abort/late-rejection test:3/3 PASS;10 unselected tests skipped.

## F-LIMIT-02 — live registration capture precedes older replay

Medium, confirmed on2ba; subscription handoff source is unchanged from41c7, so this is a newly demonstrated existing race rather than a regression introduced by the publication tail.

Independent test `packages/runtime/test/independent-hub-replay-race.test.ts`:

1. Publish durable response.started sequence1.
2. Subscribe, allowing registration to occur but gate its first ledger.listEventsFrom read.
3. Publish durable response.completed sequence2; it enters the registering subscriber's pending queue.
4. Confirm pull during registration returns an empty array, then release the replay read.
5. Observe deliveries `[2,1,2]`, rather than `[1,2]`.

The replay loop appends historical events to the same pending queue that already contains live2; flush consumes insertion order. A consumer advancing its cursor after2 can discard or fail to recover1. At-least-once delivery does not justify reversal. The independently retained log is RED1/1. Root accepted bounded repair; builder received the full reproduction directly. Required fix: an ordered/deduplicated registration handoff preserving both historical and concurrent live captures, including pull/abort behavior.

## Reentrant callback limit

Strict awaited same-stream delivery cannot also complete a later same-stream publication that its current callback awaits: the later event must wait for that callback to return. The tail makes this dependency cycle explicit. Repository SSE callbacks enqueue frames/return boolean, and governed producer publication is already serialized; no existing awaited recursive sink usage was identified. Public documentation should explicitly require delivery callbacks not to await later publication on their own stream. They may enqueue subsequent work after returning or await another stream. No artificial quota or private Studio scheduling runtime is warranted. This constraint does not explain or excuse F-LIMIT-02.

## Commands and evidence

From the isolated review root, exact logs under `independent-2ba/`:

```text
npx vitest run --project unit packages/runtime/test/independent-limits-ordering.test.ts packages/runtime/test/stream-concurrent-publication.test.ts packages/runtime/test/stream-subscriber-backpressure.test.ts packages/runtime/test/agent-control-conformance.test.ts packages/server/test/sse.test.ts
npx vitest run --project mastra packages/mastra/test/adapter.e2e.test.ts -t "independent: later|before a blocked|more than 64"
npm run build -w @victframework/runtime
npx vitest run --project unit packages/runtime/test/independent-hub-replay-race.test.ts
```

Next allowed action: bounded shared replay-handoff repair and fresh exact-candidate recheck. Full integrated verdict remains held for remaining capture/diagnostic disposition, production build association and actual UI verification. Prior41c7 offline findings/results retain their exact scope; no all-limits-gone claim or owner/Stage9 acceptance is made.
