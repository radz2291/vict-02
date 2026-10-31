# Shared stream concurrent-publication repair

31 October 2026. Builder candidate, not an independent verdict. Isolated branch
`codex/stream-order-repair-20261031`, checkout
`C:/Users/RZ1/.codex/worktrees/vict-stream-order-repair-20261031`, exact parent
`41c7b4129ee0c72a80cb7ec29f4a10c4489eef07`. Local origin/main remains
`d7401bef6e48330796c74ec00c86db9622d48cdf`; current owner instructions authorize
this local repair and prohibit push/activation. Other checkouts remain untouched.

Independent finding F-LIMIT-01 and its RED reproduction are preserved in
`INDEPENDENT-41C7.md` / verifier commit `84833648` (integrator cherry-pick
`de2e50e6`). Builder's separate pre-repair test also fails: the second terminal
publication settles while the first async subscriber remains blocked.
`limits-policy-order-builder-baseline-red.log` retains that observation (1 failed,
4 passed).

## Change

Each stream now reserves its publication position synchronously, then serializes
durable append and awaited delivery. This enforces both ledger sequence admission
and completion of an earlier async delivery before a later event reaches a
subscriber. Separate streams remain independent. Event bytes are privately
captured at admission so caller mutation while queued cannot change the stream
identity or content that was validated.

Each caller receives its own publication success or failure. The internal tail
observes rejection without turning that caller's failure into success or
poisoning later admission. Existing abort/unsubscribe wakes the active delivery
wait, allowing queued publications to finish without releasing the detached
sink. Late transport rejections remain observed. Durable append is fully awaited
and its failure remains visible even when a transport is cancelled.

The existing recoverable replay and subscriber pending bounds, coalescing,
registration handoff, overflow/reconnect behavior and durable row format remain
unchanged. No schema, policy, identity or public method signature changes, new
quota/deadline, task framework, provider setting or service is introduced.

## Checks

- Final runtime ordering/cancellation plus existing agent-control conformance and
  real HTTP SSE: **44/44 PASS**, `limits-policy-order-final-runtime-sse-green.log`.
  Six new cases cover concurrent ordered completion, signal/unsubscribe before
  sink release, late rejection, failed append and independent-stream progress,
  live delivery failure recovery, and owned queued bytes.
- Verifier's exact reproduction copied byte-for-byte from its checkout and run
  against final repaired source: **1/1 PASS**,
  `limits-policy-order-final-verifier-reproduction-green.log`. The test source is
  already integrator-owned and is not duplicated in this repair commit. This
  builder rerun is not fresh independent re-verification.
- Actual pinned offline Mastra adapter and governed turn executor: **16/16 PASS**,
  `limits-policy-order-mastra-green.log`. Includes >64 steps/tools, cancellation
  before sink release, and failed durable cancellation publication. This batch
  preceded the final private admission-copy refinement; final runtime/SSE and
  exact verifier reproduction exercise that refinement.
- Final runtime TypeScript build: PASS,
  `limits-policy-order-final-runtime-build.log`.

Dependencies are a junction to the integrator checkout's existing node_modules;
no fresh dependency-install or clean-consumer claim is made. Vitest resolves the
changed runtime directly to this isolated checkout's source. The runtime build
uses existing dependency artifacts, writes only this checkout's runtime dist,
and is not an integrated production build.

Reproduction commands from this checkout:

```text
npx vitest run --project unit packages/runtime/test/stream-concurrent-publication.test.ts packages/runtime/test/stream-subscriber-backpressure.test.ts packages/runtime/test/agent-control-conformance.test.ts packages/server/test/sse.test.ts
npx vitest run --project mastra packages/mastra/test/adapter.e2e.test.ts packages/mastra/test/turn-executor.test.ts
npm run build -w @victframework/runtime
```

Next allowed action: integrator cherry-picks the local repair, obtains fresh
independent verification of the exact successor, and associates its integrated
build. No provider/browser calls, owner-data changes, activation, push, main
merge, publication or acceptance occurred in this repair.
