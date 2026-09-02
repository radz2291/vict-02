# VICT Stage 02 — Independent Verification Handoff

## Assignment

Perform an independent, adversarial verification of the corrected VICT Stage 02 implementation.

- Repository: `https://github.com/radz2291/vict-02`
- Branch: `main`
- Commit to audit: use the exact final commit SHA stated in `VICT-STAGE-02-CORRECTIVE-FINALIZATION-REPORT.md`; record and verify it before testing.

This is an audit, not an implementation pass. Work as one autonomous agent. Do not delegate or create an orchestration system. Do not fix production code, weaken tests, or reinterpret requirements to obtain a PASS.

Your job is to determine whether Stage 02 is safe to accept and whether Stage 03 may begin.

## Independence rules

- Begin from a fresh clone or a demonstrably clean checkout of the exact correction commit.
- Treat reports and existing tests as claims, not proof.
- Read the implementation and independently derive test cases from the required invariants.
- You may create temporary external probe scripts and temporary databases.
- Remove all temporary probes and generated files before finishing.
- Do not modify source, existing tests, package configuration, or documentation.
- The only repository file you may add is the final audit report: `VICT-STAGE-02-INDEPENDENT-AUDIT.md`.
- If a source correction is needed, record the finding with a minimal reproduction; do not repair it.
- Do not force-push or rewrite history.
- Use only stage-based terminology in new work.

You are authorized to install from the existing lockfile, run all test/build/package/example/benchmark commands, spawn local subprocesses, deliberately terminate test subprocesses, create temporary SQLite files, and inspect the resulting durable records.

## Sources to inspect

Read at minimum:

1. `docs/VICT-SYSTEM-REFERENCE.md`
2. The Stage 02 specification/handoff
3. `VICT-STAGE-02-REPORT.md`
4. `VICT-STAGE-02-CORRECTIVE-FINALIZATION-REPORT.md`
5. `packages/runtime/src/store-types.ts`
6. `packages/runtime/src/store-conformance.ts`
7. `packages/runtime/src/durable-run.ts`
8. `packages/runtime/src/runtime.ts`
9. `packages/kernel/src/execute.ts`
10. `packages/runtime/src/in-memory-stores.ts`
11. `packages/store-sqlite/src/adapter.ts`
12. Stage 02 restart, transaction, migration, corruption, and consumer checks

Record the exact commit audited. If the checkout does not match the correction report, stop and report the mismatch rather than auditing an ambiguous target.

## Required independent checks

### A. Causal durability before capability invocation — blocking gate

Do not rely only on existing restart fixtures. Build an independent controllable-store probe around a synchronous side-effecting capability.

Verify this exact sequence:

1. Start `runtime.run()` while `createRun` remains deliberately unresolved.
2. Allow JavaScript microtasks/event-loop progress without resolving the store operation.
3. Assert capability invocation count is zero.
4. Resolve run creation, but hold the `node.started` transition unresolved.
5. Again assert capability invocation count is zero.
6. Resolve the node-start transition.
7. Assert the capability is invoked exactly once and only after the durable commit completed.

Then independently verify:

- Rejected `createRun` causes zero capability invocations.
- Rejected first-node `node.started` commit causes zero capability invocations.
- In a two-node graph, node two cannot start until node one's result batch and node two's `node.started` record are committed.
- A synchronous observable side effect cannot precede the corresponding durable intent.
- Final run completion is durable when `runtime.run()` resolves.
- The event history remains dense and correctly ordered.

Capture an explicit ordered trace from the probe, such as store-operation start/commit and capability-invocation markers. Timing alone is insufficient; prove the happens-before relationship.

Any capability invocation before the required durable boundary is an immediate **FAIL / BLOCKING** result.

### B. Store semantic conformance against both adapters

Execute the same independent scenarios against:

- The in-memory adapter
- The SQLite adapter

Verify:

1. After stored sequence 0, a transition claiming `expectedNextEventSeq: 5` with event 5 is rejected.
2. Expectations behind the actual sequence are also rejected.
3. A rejected sequence transition changes neither run record nor event history.
4. `createRun` rejects initial events that do not begin at zero or contain a gap.
5. Concurrent transitions from the same revision yield one winner and one structured conflict without partial writes.
6. Appended events must match the stored run's complete identity.
7. Terminal runs reject further transitions without mutation.

Inspect the SQLite database directly after selected failures to confirm atomicity rather than trusting only adapter reads.

### C. Activation and identity integrity

Independently attempt every mismatch below and require a structured rejection with no partial mutation:

- Manifest object versus different `canonicalManifest`
- Canonical content changed while top-level identifiers are left apparently valid
- Activation selected under a different graph ID
- Run graph ID different from its referenced activation
- Run graph version different from its referenced activation
- Run capability-set version different from its referenced activation
- Event run ID different from the target run
- Event graph ID, graph version, capability-set version, or activation version different from the stored run

Also verify:

- Equivalent publication is idempotent.
- Conflicting content under an existing identity is rejected.
- Reads detect deliberately corrupted canonical content.

### D. Atomic `publishAndSelect` parity

Against both adapters:

1. Establish an existing graph selection.
2. Attempt `publishAndSelect` with a new, previously absent activation and a stale expected selection revision.
3. Require the operation to fail.
4. Prove the new activation was not published and the old selection did not change.

The two adapters must expose equivalent caller-visible semantics.

### E. Persisted-value serialization and immutability

Verify accepted values round-trip without silent change. Verify rejection of:

- `undefined` as an object value
- `undefined` in an array
- `Map`
- `Set`
- Unsupported class instances
- Function
- Symbol
- Bigint
- NaN and positive/negative infinity
- Cyclic objects

If `Date` is intentionally supported, verify the documented stable representation. Verify object-key canonicalization is deterministic. Mutate objects returned by both adapters and prove persisted state does not change.

### F. Process interruption and recovery

Run the real subprocess restart suite and independently inspect its claims:

- Hard-kill a run during a capability after its start intent is durable.
- Start a new process against the same SQLite file.
- Restore the exact activation.
- Recover interrupted runs as blocked without replaying the capability.
- Run recovery twice and prove idempotency.
- Confirm activation mismatch or missing activation fails safely.
- Confirm all durable event sequences remain dense.

Distinguish clearly between “capability was invoked” and “capability performed no work because it blocked internally.” The restart test does not replace the pre-invocation durability probe in section A.

### G. Migrations and corruption

Verify:

- Clean database initialization
- Reopen at the current schema version
- Supported forward migration behavior
- Rejection of an unknown newer schema without mutation
- Malformed/invalid durable records produce structured errors
- Foreign-key and transaction guarantees are enabled as intended
- WAL/recovery behavior matches the documented durability mode

Hash or byte-compare the database where the test claims a rejected operation leaves it unchanged, accounting correctly for SQLite WAL files.

### H. Real packed-consumer boundary

Run `npm run verify:consumer` and inspect the script rather than relying only on its exit code.

Verify that it:

- Packs all five public packages using unambiguous local paths.
- Creates a clean temporary consumer outside the workspace.
- Installs tarballs rather than resolving workspace source.
- Imports only public package exports.
- Activates and executes a graph.
- Persists to SQLite.
- Terminates the first consumer process.
- Starts a new process, restores the activation, and reads durable state.
- Cleans up temporary artifacts.

Run on every OS genuinely available. Record exactly which operating systems were tested. Do not infer a Windows or POSIX PASS from testing only the other.

## Standard verification matrix

Use a supported Node version (`>=22.13.0`) and record exact environment details. Run:

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

Run the independent probes separately and record their exact commands and outputs. Do not alter repository scripts to work around a failure. If an environmental restriction prevents a command, report it as **NOT VERIFIED**, give the precise reason, and do not silently count it as PASS.

After testing, run `git status --short`. Apart from the audit report, the repository must remain unchanged.

## Severity and disposition

Classify findings:

- **Blocking:** side effect/durability ordering, replay safety, data-loss or corruption risk, false Stage 02 guarantee.
- **High:** major identity, atomicity, recovery, or public-package failure.
- **Medium:** meaningful conformance, portability, or operability failure that should be corrected before acceptance.
- **Low:** documentation or ergonomic issue without semantic risk.

Final disposition rules:

- `PASS — STAGE 03 PERMITTED`: all blocking requirements and required commands pass; no unresolved Blocking, High, or Medium findings.
- `FAIL — STAGE 03 NOT PERMITTED`: any Blocking, High, or Medium finding remains, or required durability evidence is absent.
- `INCOMPLETE — STAGE 03 NOT PERMITTED`: environmental or target ambiguity prevents a conclusive audit.

Do not issue a conditional PASS for an unresolved semantic or packaging defect.

## Audit report

Create `VICT-STAGE-02-INDEPENDENT-AUDIT.md` containing:

1. Final disposition using one exact phrase above
2. Repository, branch, and exact commit audited
3. OS, architecture, Node, npm, and SQLite/runtime details
4. Verification matrix with command, result, duration, and evidence summary
5. Independent probe design and ordered traces
6. Findings by severity with code locations and minimal reproduction
7. Store-conformance results for both adapters
8. Restart/recovery evidence
9. Packed-consumer evidence
10. Worktree cleanliness statement
11. Clear recommendation on whether Stage 03 may begin

You may commit and push this audit report as a report-only commit using already-configured credentials. If you do, state both:

- the implementation commit that was audited; and
- the later report-only commit containing the audit.

Suggested report-only commit subject:

`docs(stage-02): add independent verification audit`

## Final response format

Return only the decision-critical summary:

- Exact disposition
- Implementation commit audited
- Audit-report commit and push status, if created
- Required command results
- Findings by severity
- Whether Stage 03 is permitted
- Path to `VICT-STAGE-02-INDEPENDENT-AUDIT.md`

Do not fix discovered defects during this assignment.
