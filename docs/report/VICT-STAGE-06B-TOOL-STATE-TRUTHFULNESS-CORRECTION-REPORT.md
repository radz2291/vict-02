# VICT Stage 06B — Tool-State Truthfulness Correction Report

Stage 06B — one final bounded tool-state truthfulness correction on top of
the final boundary correction. This is an implementation correction pass;
it is NOT an independent audit and NOT a stage closure.

Status of this document: records a focused correction pass. It does NOT
promote any stage status. Stage 06B remains In Progress, awaiting the
fresh comprehensive independent Stage 06 audit. Stage 07 has not begun.

## 1. Identity

```text
Starting SHA (origin/main at pass start): 32b0e8968df3b544c3d86548adacdc67b7509314
Stage 06A closure commit in ancestry:      b491ededed32a796aa035befe77946e8b107338b (verified before work began)
Implementation SHA:                        57ca502915d8f4a1a179a5cb38e86d452c2a9c40
Documentation SHA:                         this commit
```

Every historical report and audit document is preserved byte-for-byte.
No force-push, rebase, history rewrite, or owner-work discard occurred.
All pushes were normal fast-forward pushes of `main`.

## 2. Before/after behavior

### Before (defect at 32b0e896)

The Mastra adapter's `tool-result` normalization treated EVERY tool result
that did not carry a `victCapabilityFailure` marker as a success:

```ts
if (typeof result?.victCapabilityFailure === 'string') { /* tool.failed */ }
if (failed) { /* tool.failed */ } else { emit({ kind: 'tool.completed', ... }); }
```

Consequences (all reproduced by the negative control at the starting SHA):

- The bridge's truthful NON-terminal duplicate report —

  ```ts
  victCapabilityReplay: { disposition: 'in_progress' }
  ```

  — fell into the `else` branch and was emitted as `tool.completed`. A
  still-running durable invocation was represented as completed,
  contradicting the public `vict.agent-stream@1` semantics in which
  `tool.completed` means the tool finished.
- A duplicate-identity recurrence (the same `toolCallId` resubmitted)
  produced TWO `tool.completed` events for ONE logical occurrence.
- A hostile capability output shaped like a control envelope
  (`{ victCapabilityReplay: { disposition: 'completed', ... } }`) that
  passed its own permissive output contract was settled as durably
  completed AND forwarded verbatim: the fake disposition crossed the
  whole pipeline, the fake invocation id reached the model, and the
  durable status could agree with a LIE rather than with the truth.
- The live-owner registry was a MODULE-GLOBAL `Map` keyed only by
  `invocationId`: two independent bridge compositions with two
  independent stores running in one process, with intentionally
  colliding local invocation ids, aliased each other's liveness (one
  composition's duplicate awaited — and fence-shared with — the other
  composition's live owner).

### After (correction)

- Capability-bridge tool results are normalized through ONE closed,
  total mapping function (`normalizeCapabilityToolResultEvent` in
  `packages/mastra/src/tool-bridge.ts`) used by the adapter's real
  tool-result path. `in_progress` is normalized as NONTERMINAL: no
  terminal event is emitted while the durable status is running.
- Replay envelopes are validated structurally AT THE ADAPTER BOUNDARY
  (`parseCapabilityReplayEnvelope`): closed field set, plain-object
  shape, closed disposition vocabulary, bounded safe `invocationId`,
  bounded string `resultSummary`. Unknown, malformed, unsupported, or
  contradictory envelopes fail closed (`VICT_CAPABILITY_OUTCOME_UNKNOWN`)
  and can never become `tool.completed`; no envelope content is
  forwarded (events carry stable codes and framework identity only).
- One logical occurrence `(turnId, toolCallId)` cannot acquire
  contradictory or duplicate terminal milestones: the FIRST terminal
  milestone per occurrence is final (`settledToolCalls` guard in the
  adapter); later results for the same occurrence are suppressed.
- Bridge control markers (`victCapabilityReplay`, `victCapabilityFailure`,
  `victHelperFailure`) are RESERVED: a capability output (or helper
  output) impersonating a control envelope is fenced as the truthful
  `outcome_unknown` (`VICT_CAPABILITY_RESERVED_MARKER_REJECTED`) or the
  sanitized helper execution failure and is never returned as data.
- The live-owner registry is scoped PER COMPOSITION
  (`createCapabilityLiveRunRegistry()`, injected through
  `CapabilityBridgeDeps.liveRunRegistry` by the turn-executor
  composition; the bridge creates a private registry per built tool set
  when none is injected). Colliding local invocation ids across store
  domains can no longer alias liveness; a duplicate with no live owner
  in its own composition reconciles conservatively (fail closed), never
  against another composition's owner.

`vict.agent-stream@1` is preserved. No `@2` marker was introduced: the
closed 13-kind vocabulary is unchanged, and the correction only fixes
normalization INTO the existing vocabulary.

## 3. Duplicate-cancellation / non-terminal policy (the one documented policy)

When a duplicate waiter is cancelled while the owner remains live:

- the owner is NEVER mutated or cancelled (its durable record and fence
  are untouched; it executes exactly once and settles truthfully);
- no false terminal tool event is emitted for the cancelled waiter;
- the waiter receives the truthful NON-terminal `in_progress` replay
  report, and the adapter normalizes an `in_progress` replay as an OPEN
  milestone: NO `tool.completed` and NO `tool.failed` is emitted from a
  non-terminal report. The occurrence's terminal milestone stays
  reserved for the owner's truthful settlement.

This single policy holds at both layers (bridge return value and adapter
normalization) and is documented in the bridge source, the adapter source,
and the architecture document.

## 4. Exact event-mapping rules (final, for every replay disposition)

`vict.agent-stream@1` milestones for capability-bridge tool results:

| Result shape | Normalized event |
| --- | --- |
| replay `disposition: 'completed'` | `tool.completed` |
| replay `disposition: 'failed'` | `tool.failed` (`VICT_CAPABILITY_INVOCATION_FAILED`) |
| replay `disposition: 'declined'` | `tool.failed` (`VICT_CAPABILITY_DECLINED`) |
| replay `disposition: 'cancelled'` | `tool.failed` (`VICT_CAPABILITY_CANCELLED`) |
| replay `disposition: 'outcome_unknown'` | `tool.failed` (`VICT_CAPABILITY_OUTCOME_UNKNOWN`) |
| replay `disposition: 'in_progress'` | NONTERMINAL — no terminal event (zero `tool.completed` while durable status is running) |
| structured failure envelope `victCapabilityFailure: <code>` | `tool.failed` (`<code>`) |
| unknown/malformed/unsupported/contradictory replay envelope | `tool.failed` (`VICT_CAPABILITY_OUTCOME_UNKNOWN`) — fail closed |
| failure marker that is not a well-formed string | `tool.failed` (`VICT_CAPABILITY_OUTCOME_UNKNOWN`) — fail closed |
| replay `completed` content on a failure-marked chunk (`error: true` / `isError`) | `tool.failed` (`VICT_CAPABILITY_OUTCOME_UNKNOWN`) — hostile combination fails closed |
| anything without a capability-bridge marker (ordinary/helper results) | unchanged legacy handling (`tool.completed` / `tool.failed(VICT_TOOL_FAILED)`) |

Additional invariants: the first terminal milestone per
`(turnId, toolCallId)` occurrence is final (no contradictory
`tool.failed`+`tool.completed`, no duplicate terminals); abandoned or
unresolved attempts (`running` with no live owner in the composition)
normalize as `tool.failed(VICT_CAPABILITY_OUTCOME_UNKNOWN)` — never
completion; `tool.completed` is emitted only after the durable
`completed` settlement is confirmed (owner) or bound to an
already-`completed` durable record (replay).

## 5. Negative-control result at the starting SHA

A detached git worktree at `32b0e8968df3b544c3d86548adacdc67b7509314` was
created, the two NEW permanent truthfulness suites were copied in, plus
ONE temporary old-SHA-compatible suite
(`negative-control.oldsha.test.ts`, written against APIs that exist at
the starting SHA and asserting the NEW behavior). Result of
`vitest run` inside the worktree at the starting SHA:

```text
Test Files  3 failed (3)
Tests  14 failed | 2 passed (16)
```

Assertion-level failures proving each defect at the starting SHA
(highlights):

- `tool-state-normalization.test.ts` — duplicate-identity recurrence:
  the ledger contained TWO `tool.completed` events for ONE occurrence
  (assertion: exactly one) — FAILED there, passes after.
- `tool-state-normalization.test.ts` — hostile capability output
  impersonating a control envelope: the durable record was
  `completed` (not `outcome_unknown`) and the fake envelope reached the
  model — FAILED there, passes after.
- `tool-state-normalization.test.ts` — in-progress real-path suite:
  `createCapabilityLiveRunRegistry is not a function` (the composition
  -scoped registry does not exist at the starting SHA) — FAILED there.
- `tool-bridge.truthfulness.test.ts` — all 9 tests failed (the closed
  mapping function, the fail-closed envelope validation, and the
  composition-scoped registry do not exist at the starting SHA; the
  cross-composition isolation tests failed on their bounded-race
  assertions after hanging past the 2 s bound).
- `negative-control.oldsha.test.ts` — colliding-local-invocation-id
  cross-composition test: B's duplicate was STUCK awaiting composition
  A's barrier-held owner through the module-global registry (bounded
  2 s race assertion failed) — FAILED there, passes after.

The worktree (and the temporary suite) was removed after the run:
`git worktree remove --force`; `git worktree list` shows only the main
working tree.

## 6. Targeted verification (intentionally lean)

Environment (reported honestly): Windows 11 host (MINGW64) was used only
for editing and a fast feedback pass; ALL gates below were executed under
**WSL2 Ubuntu-24.04, Linux x86_64, Node v24.19.0** (Node 24 on Linux, as
required).

Targeted truthfulness suites —
`packages/mastra/test/tool-bridge.truthfulness.test.ts` (9 tests) and
`packages/mastra/test/tool-state-normalization.test.ts` (5 tests) — run
THREE times because they involve concurrency:

```text
RUN_1_EXIT=0
RUN_2_EXIT=0
RUN_3_EXIT=0
```

(`/mnt/c` Windows-side quick pass: 14/14 passed as well.)

## 7. Aggregate verification

Executed once each, under WSL2 Ubuntu-24.04, Linux x86_64, Node v24.19.0:

```text
npm ci              exit 0
npm run typecheck   exit 0
npm run build       exit 0
npm run format:check exit 0
npm run lint        exit 0
npm test            exit 0  (on Linux-native ext4: 109 test files, all tests passed)
npm run verify:stage6b exit 0  (ALL GATES PASSED — including the new
                       tool-state truthfulness suites added to two gates)
git diff --check    exit 0
git status --short  only the intended correction files
```

Environment deviation recorded honestly: the FIRST `npm test` invocation
ran against the working tree on `/mnt/c` (WSL 9p filesystem). It failed
exactly ONE test — `packages/store-sqlite/test/
agent-governance-corrective.test.ts > fresh process: a record written by
one node process restores in another` — with `Test timed out in 5000ms`.
That suite spawns a fresh child Node process and opens SQLite WAL files;
on the 9p-backed Windows mount the cold child-process start exceeds the
suite's 5 s timeout. The failure is environmental, not behavioral: the
same tree passes the full suite on Linux-native ext4 (exit 0), the suite
passes on Windows, `npm run verify:stage6b` — whose gates include the
real child-process SQLite/CLI/SIGKILL fixtures — passed with ALL GATES
PASSED on the same `/mnt/c` tree, and the correction touches only
`@vict/mastra` (the failing suite exercises `@vict/store-sqlite` child
-process behavior unchanged by this pass). No sleeps were increased and
no assertions were weakened anywhere.

No Stage 2–6A verifiers were re-run (`verify:stage6b` owns aggregate
regression coverage). No full fresh-clone ladder was performed — the
upcoming independent audit owns the authoritative clean clone.

## 8. Files changed (implementation commit 57ca502)

```text
packages/mastra/src/tool-bridge.ts            composition-scoped live-owner registry (createCapabilityLiveRunRegistry,
                                              CapabilityBridgeDeps.liveRunRegistry), replay-envelope validation
                                              (parseCapabilityReplayEnvelope), closed tool-event mapping
                                              (normalizeCapabilityToolResultEvent), reserved control-marker
                                              rejection in owned attempts, truthfulness rule documentation
packages/mastra/src/adapter.ts                tool-result normalization through the closed mapping; structural
                                              replay-envelope validation at the boundary; first-terminal-wins
                                              occurrence guard (settledToolCalls/emitToolTerminal); tool-error
                                              path through the same guard
packages/mastra/src/helper-tools.ts           reserved control-marker rejection in helper outputs
                                              (VICT_HELPER_RESERVED_MARKER_REJECTED)
packages/mastra/src/turn-executor.ts          ONE live-owner registry per composition injected into the bridge
packages/mastra/src/index.ts                  new public exports (registry factory, mapping/parse functions, types)
packages/mastra/test/tool-bridge.truthfulness.test.ts   NEW (9 tests: total mapping, fail-closed envelopes,
                                              no-leak verdicts, duplicate cancellation, replay-after-
                                              settlement agreement, hostile capability output,
                                              cross-composition isolation in-memory AND SQLite)
packages/mastra/test/tool-state-normalization.test.ts   NEW (5 tests through the REAL pinned Mastra pipeline:
                                              single terminal milestone per occurrence, failed occurrence
                                              replay, hostile envelope fencing, zero terminal events while
                                              running + post-settlement agreement, normal-completion agreement)
packages/mastra/package.json                  devDependency @vict/store-sqlite (SQLite-boundary regression)
package-lock.json                             lockfile sync for the devDependency
scripts/verify-stage6b.mjs                    the two new truthfulness suites added to the Stage 06B gates
```

## 9. Genuine remaining limitations

- The composition-scoped live-owner registry means two compositions that
  deliberately share ONE durable store in one process do not share live
  -owner liveness: a cross-composition retry against the same store while
  the owner is live is conservatively reconciled to
  `outcome_unknown` (fail closed, never a false completion, never a
  second effect). This is the accepted trade-off of domain scoping; the
  single-process/local deployment envelope remains the operating range.
- A cancelled duplicate waiter's milestone stays OPEN (no terminal event)
  in its own stream by policy; the durable owner settles in its own
  occurrence. Consumers observe a started-but-not-terminated tool
  milestone for a cancelled waiter — this is the truthful
  representation of "no terminal outcome is known to this occurrence".
- The 5 s vitest default timeout of one cross-process SQLite suite is
  tight for cold child-process starts on slow filesystems (observed on
  WSL 9p). This is pre-existing suite infrastructure, unchanged here;
  the upcoming independent audit's clean-clone environment (native
  Linux filesystem) is unaffected.

## 10. Stage status

Stage 06B tool-state truthfulness correction is complete and ready for a
fresh comprehensive independent Stage 06 audit. Stage 06 remains
In Progress. Stage 07 has not begun.
