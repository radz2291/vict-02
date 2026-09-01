# VICT Stage 02 — Corrective Finalization Handoff

## Assignment

Correct and finalize VICT Stage 02 in the existing repository:

- Repository: `https://github.com/radz2291/vict-02`
- Branch: `main`
- Audited baseline: `b2e2ee5d4ad28486026abdbbf902d538671e8f4d`

Work autonomously from inspection through implementation, testing, documentation, commit, and push. Do not begin Stage 03. Do not delegate or create an agent orchestration system. This is a focused corrective pass over the current Stage 02 implementation.

The existing package and brand organization is intentional. Preserve the greenfield VICT organization and the current public packages:

- `@vict/contracts`
- `@vict/kernel`
- `@vict/runtime`
- `@vict/store-sqlite`
- `@vict/sdk`

This is not a rewrite. Keep sound Stage 01 and Stage 02 work, make the smallest coherent architectural corrections, and strengthen the shared conformance suite so both store adapters are held to the same semantics.

## Operating authority

You are authorized to:

- Inspect the entire repository and its Git history.
- Modify source, tests, examples, scripts, and documentation within this repository.
- Install dependencies using the existing lockfile.
- Run all relevant tests, subprocess tests, packaging checks, examples, and benchmarks.
- Add adversarial tests required to prove the corrections.
- Commit the completed correction and push the current branch using already-configured credentials.

Do not:

- Force-push, rewrite history, discard unrelated user changes, or delete material evidence.
- Change public package names or introduce legacy organization from an earlier VICT project.
- Add Stage 03 capabilities.
- Weaken a contract, test, or error condition merely to obtain a green suite.
- claim cross-platform verification for an operating system you did not actually test.

Begin with `git status`, the current branch, and the current HEAD. Pull using a safe fast-forward-only operation if appropriate. If the worktree contains unrelated changes, preserve them and work around them; stop only if they make the task unsafe.

## Sources of truth

Read before changing code:

1. `docs/VICT-SYSTEM-REFERENCE.md`
2. The Stage 02 handoff/specification in the repository
3. `VICT-STAGE-02-REPORT.md`
4. The relevant package contracts and store conformance suite
5. The runtime durability tracker, kernel execution path, SQLite adapter, and restart fixtures

Where prose and executable contracts disagree, identify the disagreement explicitly. Preserve the intended Stage 02 safety invariant: an execution intent must be durable before the corresponding capability is allowed to execute.

## Independent review findings to correct

The existing suite reports 173 unit tests and 4 integration tests passing, but adversarial review found the following gaps. Treat every item in this section as required scope.

### 1. Blocking: capability invocation can precede durable intent

Relevant paths:

- `packages/runtime/src/durable-run.ts`
- `packages/runtime/src/runtime.ts`
- `packages/kernel/src/execute.ts`
- `packages/store-sqlite/test/fixtures/shared.ts`
- `packages/store-sqlite/test/restart.test.ts`

Current behavior:

- The kernel emits `run.started` and `node.started` synchronously.
- `DurableRunTracker.onEvent` places store work on a Promise queue and immediately returns.
- The kernel then invokes the capability without awaiting the queued durable write.
- With a deliberately delayed conforming store, the observed order was:

  1. capability invocation began;
  2. run creation committed;
  3. `node.started` committed.

This violates the Stage 02 write-ahead safety boundary. A synchronous external side effect could happen before its intent exists durably, and a store failure can surface only after the capability has already begun.

Required outcome:

- `run.started`/run creation must be durably committed before the first capability invocation.
- The current node's `node.started` transition must be durably committed before that node's capability invocation.
- Before a subsequent node starts, the preceding node-result transition batch must be durably committed.
- A store rejection at any required pre-invocation boundary must prevent that capability from being called.
- Storage failures must remain structured and deterministic; do not hide or downgrade them.
- Final settlement must still wait for all pending durable work, but an end-of-run drain alone is not a fix. The ordering must be causal at each invocation boundary.
- Preserve deterministic kernel behavior and avoid coupling the kernel directly to SQLite. If an asynchronous lifecycle/event boundary or invocation guard is required, express it as a general port/contract.

You may choose the exact internal design after inspecting the architecture, but document why the chosen boundary proves the invariant. Avoid sleeps, timing assumptions, polling hacks, or tests that pass only because a capability voluntarily waits after it has already been invoked.

Required tests:

1. Use a controllable/deferred execution store. Start `runtime.run()` while `createRun` is unresolved; assert capability call count remains zero.
2. Resolve run creation but hold the `node.started` commit unresolved; assert capability call count remains zero.
3. Resolve the node-start commit; assert the capability is then invoked exactly once.
4. Reject run creation; assert the capability is never invoked.
5. Reject the node-start transition; assert the capability is never invoked.
6. Use a synchronous side-effecting capability so the test cannot be satisfied by placing a barrier inside the capability.
7. Use a two-node graph and prove the second capability cannot begin until the first result batch and second `node.started` transition are durable.
8. Retain a real subprocess hard-kill/restart test, but make clear what ordering it proves.

### 2. Gating: event sequence is compared only with caller input

Relevant paths:

- `packages/runtime/src/in-memory-stores.ts`
- `packages/store-sqlite/src/adapter.ts`
- `packages/runtime/src/store-conformance.ts`

Both adapters accepted a transition with `expectedNextEventSeq: 5` and event `seq: 5` immediately after stored event 0. The implementation verifies that an event matches the caller-supplied expectation, but does not first verify that the expectation equals the actual stored next sequence.

Required outcome:

- In the same atomic transition, compare `expectedNextEventSeq` to the actual durable next sequence.
- The actual next sequence is dense: zero for an empty run, otherwise the preceding sequence plus one.
- Reject a stale, advanced, or otherwise incorrect expectation without changing the run record or events.
- `createRun` must accept only a dense initial batch beginning at sequence zero. Apply this equally to SQLite and in-memory stores.
- If already-persisted records contain a gap, report structured corruption/invalid-record failure rather than building further history on it.
- Preserve concurrency safety: record revision and event sequence checks must participate in the same SQLite transaction.

Add shared conformance tests that run unchanged against both adapters, including rollback assertions.

### 3. Gating: activation, run, selection, and event identity are not fully cross-validated

The stores accepted a run that referenced an existing activation version while supplying unrelated `graphId`, `graphVersion`, and `capabilitySetVersion` values.

Required outcome:

- Publishing an activation must verify that its canonical representation is exactly the canonical representation of the supplied manifest.
- Validate all content-derived identities using the repository's canonical identity functions; do not merely compare a few top-level strings.
- Selecting an activation for a graph must require that the selected activation belongs to that graph.
- Creating a run must require its graph, graph version, capability-set version, and activation version to describe one coherent published activation.
- Every appended event must match its stored run's `runId`, `graphId`, `graphVersion`, `capabilitySetVersion`, and `activationVersion`.
- Identity validation failures must be structured store errors and must leave no partial mutation.
- Reads must continue to detect corrupt durable content rather than silently normalizing it.

Add shared tests for each individual mismatch. Include at least one test where the top-level activation identifiers look valid but canonical binding or graph content differs.

### 4. Gating: in-memory `publishAndSelect` is not transactionally atomic

Current in-memory behavior publishes first and selects second. If selection fails—for example because `expectedSelectionRevision` is stale—the new activation can remain published. SQLite performs this operation transactionally, so the adapters do not share the same contract.

Required outcome:

- Make in-memory `publishAndSelect` atomic from the caller's perspective.
- A failed selection must leave both the activation catalog and graph selection exactly as they were before the call.
- Preserve equivalent-content idempotency and conflict behavior.
- Add a conformance test that attempts to publish a previously absent activation while using a stale selection revision, then proves the activation was not left behind.

### 5. Persisted-value serialization must be honest and lossless within its declared domain

Relevant path: `packages/runtime/src/serialization.ts`

The current documentation says unsupported JSON values are rejected, but the code allows `undefined` and silently changes it during canonicalization. Non-plain objects such as `Map` and `Set` can collapse to `{}`. This is unsafe for full-retention output and identity material.

Required outcome:

- Define and enforce one explicit persisted-value domain.
- At minimum, support JSON primitives, finite numbers, arrays, and plain string-keyed objects.
- If `Date` remains an intentional extension, preserve its explicitly documented ISO conversion.
- Reject `undefined` in objects and arrays, functions, symbols, bigint, NaN, infinities, cyclic values, `Map`, `Set`, and unsupported class instances.
- Never silently drop, replace, or collapse caller data.
- Ensure both adapters behave equivalently and returned snapshots cannot mutate stored state.

Add focused serializer tests and store-level full-retention tests.

### 6. Cross-platform packed-consumer verification

Relevant path: `scripts/isolated-consumer-check.mjs`

On Linux, `npm pack packages/contracts` was interpreted as GitHub shorthand (`github.com/packages/contracts`) rather than a local path. This occurred under npm 10.9.2 as well as npm 11.

Required outcome:

- Resolve each package from a stable repository-root absolute path, or use an unambiguous explicit local path.
- Do not rely on Windows path separators or the caller's working directory.
- The isolated consumer must install only packed tarballs in a clean temporary project and successfully exercise activation, execution, persistence, process restart, and restoration without workspace-source resolution.
- Keep cleanup reliable on Windows and POSIX.

If only one OS is available, test there and state the limitation. Still add deterministic path-focused coverage or code that is unambiguously portable.

### 7. Documentation and report accuracy

- Preserve the status vocabulary defined by `docs/VICT-SYSTEM-REFERENCE.md`; do not invent decorated status values where the document defines exact values.
- Do not erase the historical Stage 02 report. Add a new correction report named `VICT-STAGE-02-CORRECTIVE-FINALIZATION-REPORT.md`.
- Correct any misleading Stage 02 claim affected by these findings.
- Avoid unresolved placeholders such as `<(this commit)>` in the new report.
- Clearly distinguish what was tested from what was inferred.
- Use only stage-based terminology in new filenames and prose.

## Shared conformance-suite requirement

Do not solve these only with adapter-specific tests. Extend `packages/runtime/src/store-conformance.ts` so the semantic rules are executed against both the in-memory and SQLite adapters wherever applicable. Adapter-specific tests remain appropriate for SQL transactions, migrations, WAL/restart behavior, and physical corruption.

At minimum, shared conformance must now cover:

- Actual-next-sequence enforcement and rollback
- Dense initial event batches
- Activation canonical-content mismatch
- Graph-selection/activation mismatch
- Run/activation identity mismatch
- Event/run identity mismatch
- Atomic `publishAndSelect` failure
- Strict retained-output serialization behavior

Tests must assert both the error and the absence of partial state changes.

## Required verification

Run from a clean installation using the committed lockfile:

```text
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
npm run verify:consumer
npm run verify:stage2
npm run example
npm run bench
```

Also run the newly added focused adversarial tests directly so their names and results are visible in the report.

Use a supported Node version (`>=22.13.0`). Record the exact OS, architecture, Node version, npm version, and database mode. If a command is unavailable or fails for an environmental reason, diagnose it; do not silently omit it. A workaround may provide additional evidence but does not convert a required failing command into PASS.

Before committing:

- Review the complete diff.
- Confirm no temporary databases, tarballs, logs, coverage output, or probe files are tracked.
- Confirm package exports and generated declaration files are correct.
- Confirm the final worktree contains only intentional changes.

## Completion gates

Stage 02 corrective finalization is complete only when all are true:

1. Capability invocation is causally blocked until its durable intent commits.
2. Store failure before invocation proves a zero invocation count.
3. Both adapters reject event gaps based on actual stored history.
4. Activation, selection, run, and event identities are cross-validated.
5. In-memory and SQLite `publishAndSelect` share atomic failure semantics.
6. Persisted values cannot be silently changed by serialization.
7. The isolated packed consumer passes with unambiguous local package paths.
8. All required verification commands pass.
9. The correction report contains evidence and no unsupported claims.
10. The implementation is committed and pushed without force.

If any gate remains unresolved, do not declare Stage 02 complete or ready for Stage 03. Report the blocker precisely.

## Deliverables

1. Corrected implementation and tests.
2. Updated system reference where required.
3. `VICT-STAGE-02-CORRECTIVE-FINALIZATION-REPORT.md`, containing:

   - Starting and final commit SHA
   - Concise root-cause analysis for each finding
   - Architectural correction and why it enforces the invariant
   - Files changed
   - New adversarial tests
   - Complete verification table with exact commands and PASS/FAIL
   - Test counts
   - Environment details
   - Known limitations or untested platforms
   - Final disposition: `READY FOR INDEPENDENT AUDIT` or `NOT READY`

4. A normal Git commit, suggested subject:

   `fix(stage-02): enforce durable execution and store invariants`

5. Push confirmation including branch and commit SHA.

## Final response format

Return a concise summary with:

- Final disposition
- Commit SHA and push status
- What changed
- Tests and verification results
- Any residual limitation
- Exact path to the correction report

Do not propose or implement Stage 03 in this assignment.
