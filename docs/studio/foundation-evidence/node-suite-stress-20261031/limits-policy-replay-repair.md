# Ordered, streaming replay handoff repair

31 October 2026. Builder successor to exact source
`2ba96b7e804fd2cdea4ac12ec8d76193fe6a851d`, isolated branch
`codex/stream-order-repair-20261031` at
`C:/Users/RZ1/.codex/worktrees/vict-stream-order-repair-20261031`.
Current owner authorizes this bounded follow-up; no root/capture/verifier checkout
was modified. Local origin/main remains
`d7401bef6e48330796c74ec00c86db9622d48cdf`. No push is authorized.

## Retained failures

Independent verifier commit `3f1e09386a9bbd05383039512f7ae81cf1c96ca7`
preserves `independent-hub-replay-race.test.ts`, its RED log and
`INDEPENDENT-2BA.md`. A gated first replay read allowed newer live sequence2
to enter the registration queue before older replay1, producing `[2,1,2]`.

Builder baseline `limits-policy-replay-baseline-red.log` independently retains
that exact reproduction plus additional checks: **4 failed / 2 passed**. A fast
subscriber with4100 durable historical events overflowed before receiving any;
a slow historical subscriber likewise made no cursor progress before overflow.
The mixed transient/durable race also failed. Earlier decisions and REDs remain.

## Repair

Registration takes a short per-stream publication barrier to capture a fixed
ledger watermark and owned transient snapshot, including live transient captures
that arrived before the barrier. The latter preserves captures even when the
bounded transient replay buffer has rolled over. Earlier durable append/delivery
finishes before the snapshot; subsequent publications can complete while replay
reads or subscriber delivery wait. The snapshot barrier does not span replay.

Historical durable pages and transient snapshot are streamed in sequence to a
fast subscriber. They are not accumulated in the slow subscriber queue merely
because history exceeds4096 events. Only actual newer live captures and replay
behind a sink that returned false use that bounded queue. Replay/live overlap is
deduplicated by sequence; the ordered pending handoff begins after the fixed
historical interval. The last accepted/pulled sequence also prevents overlap at
the transition to live delivery.

Existing explicit overflow/reconnect and transient recovery policies remain. A
slow historical subscriber now receives its first event before queue overflow,
so reconnecting from its acknowledged cursor can progress. No task/content quota,
deadline, queue inflation, new schema or public method signature is introduced.

Abort/unsubscribe releases blocked replay sink delivery and replay read waits.
Cancelling the read-only snapshot barrier releases it only after earlier durable
publication has finished; it never bypasses an unfinished durable append. Late
read/sink rejection remains observed by the shared cancellation-aware wait.
Subscription failures detach the failed registration and propagate to its caller.
Existing durable publication failure and normal sink rejection behavior remain.

The public subscriber API now explicitly documents strict-order reentrancy:
an awaited sink cannot await completion of a later same-stream publication,
because that publication must wait for the current delivery. Publishing to other
streams or scheduling same-stream work without awaiting it is supported; callers
still own handling their scheduled publication's outcome.

## Checks and reproduction

- **52/52 PASS** runtime/conformance/real HTTP SSE, including verifier's exact
  reproduction: `limits-policy-replay-final-runtime-sse-green.log`.
- **8/8 PASS** final focused replay tests, including an additional pre-snapshot
  transient-buffer rollover case: `limits-policy-replay-final-extra-green.log`.
  Seven of these overlap the52 batch; together these cover53 unique cases.
- **16/16 PASS** actual pinned offline Mastra adapter and governed turn executor:
  `limits-policy-replay-mastra-green.log`. Includes66 tool/step completion,
  cancellation before sink release and truthful failed durable publication.
- Runtime TypeScript build PASS: `limits-policy-replay-final-runtime-build.log`.
  The initial type-only narrowing failure in a closure is retained in
  `limits-policy-replay-first-build-red.log`; binding the narrowed snapshot to a
  local constant corrected it without changing runtime behavior. The8-test final
  focused batch ran after this correction.

```text
npx vitest run --project unit packages/runtime/test/stream-replay-handoff.test.ts packages/runtime/test/stream-concurrent-publication.test.ts packages/runtime/test/stream-subscriber-backpressure.test.ts packages/runtime/test/agent-control-conformance.test.ts packages/server/test/sse.test.ts
npx vitest run --project mastra packages/mastra/test/adapter.e2e.test.ts packages/mastra/test/turn-executor.test.ts
npm run build -w @victframework/runtime
```

The exact verifier test was copied byte-for-byte into this checkout for the
baseline and final combined batch, then the temporary copy removed. Its source
is already integrator/verifier-owned and is not duplicated in this repair commit.
Dependencies reuse the existing integrator node_modules via a junction; changed
runtime tests resolve this isolated source. The build uses existing dependency
artifacts and is not a fresh install or integrated production build claim.

Next: integrator cherry-pick, fresh independent challenge of the exact successor,
then associate the integrated production build. This is builder evidence only.
No provider/browser calls, service activation, owner-data change, push, main merge,
publication or acceptance occurred.
