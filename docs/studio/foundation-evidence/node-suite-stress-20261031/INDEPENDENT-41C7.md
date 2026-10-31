# Independent limit-removal review — 41c7

31 October 2026. Exact source candidate `41c7b4129ee0c72a80cb7ec29f4a10c4489eef07`, derived from task baseline `04339fa74c529dfe77c8f5c167a2dbd1aa388f3b`. Review branch `codex/independent-limits-20261031`, isolated worktree `C:/Users/RZ1/.codex/worktrees/vict-limits-independent-20261031`. Historical independent branches remain untouched. Local origin/main is `d7401bef6e48330796c74ec00c86db9622d48cdf`; current owner authorizes the local workstream and expressly prohibits push. The source checkout contained only the integrator's untracked workspace-build log; it was preserved. This review changes tests/evidence only, never product source.

## Verdict

**Public async hub conformance FAIL: one confirmed medium finding remains.** Inspected Studio's serial publication path has no demonstrated activation blocker, and the other focused offline checks below pass. This is not an integrated readiness award: the integrator will repair the public defect, supply an exact successor, and associate the production build and actual UI verification. Capture/observer policy disposition is also pending. No claim that every artificial limit is removed is supported by this candidate.

## F-LIMIT-01 — concurrent async subscriber delivery overtakes demand

`packages/runtime/src/stream-hub.ts:421` invokes a subscriber again while an earlier asynchronous delivery is unresolved. The new public promise-returning sink API therefore does not enforce its documented in-sequence delivery/backpressure behavior when callers publish concurrently.

Independent reproduction `packages/runtime/test/independent-limits-ordering.test.ts`:

1. Subscribe an async handler; block response.started sequence1 on an unreleased gate.
2. Publish response.cancelled concurrently while sequence1 remains blocked.
3. Observe handler receipt `[1,2]` instead of `[1]`; sequence2 can complete while sequence1 remains unresolved. The test releases its gate only in cleanup.

The retained `independent-ordering.log` is RED (1/1). This is introduced by supporting asynchronous handlers without an in-flight delivery fence, rather than an archive loss or an independently demonstrated Studio edit violation. Studio's governed executor already serializes its publication chain. Repair should serialize shared delivery at the appropriate stream/subscriber boundary, preserve ledger ordering/failure visibility, and still wake queued or blocked delivery on abort/unsubscribe. The integrator accepted the finding for repair rather than reducing the public claim.

## Independent checks

Fresh `npm ci --ignore-scripts --no-audit --no-fund` installed718 dependencies in the review checkout; no shared dependency directory or copied dist was used. Node22.13.1 produced the retained inherited posthog engine warning. Own `npm run build` completed successfully. Studio tests consume these newly built installed workspace artifacts.

| Check | Result |
| --- | --- |
| Pinned Mastra adapter, compatibility, governed executor, delivery-safe snapshot/proto guards | 73/73 PASS |
| Own later tool.completed blocked-sink abort and late-rejection probe | 1/1 PASS;12 unselected tests skipped |
| Runtime subscriber abort/unsubscribe/ledger failure plus kernel policy identity/validation | 60/60 PASS |
| Shared presentation and safe validation feedback | 20/20 PASS |
| Public Flow unlimited graph suite | 6/6 PASS |
| Installed-dist Studio archive, HTTP, source/import and real host bridge | 44/44 PASS across7files |
| Own concurrent async hub ordering | 1/1 FAIL, retained |

The pinned adapter proves66 real offline Mastra tools/steps; normal completion is explicit rather than the upstream five-step default. Legacy finite policy validation, identity and adapter mismatch behavior remain exercised separately. Cancellation settles and releases its thread before the initial or later tool-result transport gate is released. The independent later-result probe rejects that detached sink afterwards and confirms no completed event or resumed ordinary delivery. Durable publication failure remains failed rather than falsely cancelled; protected effects remain absent.

Snapshot tests exercise large safe values and genuine VM JSON-encoding failure before durable completion, retaining proxy/accessor/nonplain/then/control/proto/cycle refusals and explicit opt-in historical bounds. Presentation captures are owned/frozen without content quotas; exact argument validation still belongs to registered contracts. No Studio replacement execution/validation authority was identified.

Archive coverage includes530 exchanges exceeding32MB without eviction/TTL, complete >4MB Unicode paging, privacy/accessor/proxy negatives and real storage failure. Own additional probe checks the same call's input/result and a different run remain distinct; another session cannot read them after extreme clock advancement; truncating the actual stored original produces an explicit incomplete-storage failure. The archive promise is current-process/owning-session retention, not restart durability.

The actual Studio graph bridge persists manual and agent changes beyond180000 characters, including nested undo/history/save/import. Earlier controlled-owner refusal, private repeated occurrence isolation, deep wrappers and runtime-root revisions remain green. Large source atomic negative edits, typed expression negatives, >500nodes/>200k source, continuation beyond200k, large legacy singleton discovery and cycle refusal remain green. Public Flow retains identity/revision, authored capacity/type and dedup semantics in its unlimited graph tests.

## Exact commands

From review root unless otherwise stated; output logs are under `independent-41c7/`.

```text
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npx vitest run --project mastra packages/mastra/test/adapter.e2e.test.ts packages/mastra/test/turn-executor.test.ts packages/mastra/test/adapter.compatibility.test.ts packages/mastra/test/tool-bridge.delivery-snapshot.test.ts packages/mastra/test/tool-bridge.proto-field.test.ts
npx vitest run --project mastra packages/mastra/test/adapter.e2e.test.ts -t "independent: later"
npx vitest run --project unit packages/runtime/test/stream-subscriber-backpressure.test.ts packages/kernel/test/agent-profile-identity.test.ts packages/kernel/test/agent-profile-validation.test.ts
npx vitest run --project mastra packages/mastra/test/tool-bridge.presentation.test.ts packages/mastra/test/input-validation-feedback.test.ts
npx vitest run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/unlimited-graph.svelte.test.ts
npx vitest run --project unit packages/runtime/test/independent-limits-ordering.test.ts
```

From `apps/studio`:

```text
npx vitest run tests/independent-evidence-identity.test.ts tests/tool-evidence-full-retention.test.ts tests/authoring-foundation-evidence-route.test.ts tests/designer-stream-backpressure.test.ts tests/graph-scoped-bridge.test.ts tests/authoring-limit-removal.test.ts tests/source-import.test.ts
```

Source review read the required canonical Stage9 order, current limits policy, cancellation repair, root checks, feedback report and remaining authored-AI caps report. Rendered capture dimensions/bytes/deadlines, resource scans and Studio observer policies remain separately disclosed for their assigned audit. No browser, provider/account operation, activation, push, main merge, publication, owner acceptance or Stage9 closure occurred in this review. Actual UI verification and exact production association remain integrator-owned and pending.
