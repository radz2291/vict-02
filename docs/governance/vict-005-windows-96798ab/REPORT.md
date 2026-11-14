# VICT-005 independent Windows verification

Candidate 96798ab5dcd526af2868692fd156e360189f0434, tree badf94efb265765f168d7a4c89ffb1146488adfc. Baseline 6b420a3e9eada6f694cc2550debda7753316b5b3. The candidate and baseline share lock blob 66c10fa33529f34eff4008f3c3be2193a067f020. Windows x64 10.0.26300, Node 22.13.1 and npm 11.19.1. Verifier codex-independent-windows-vict005-96798ab.

The exact commit was fetched and checked out in a fresh detached worktree. The verification ran after the TORI qualification to limit memory contention. The product checkout and pinned dependency lock stayed unchanged. This is independent Windows evidence; the Linux builder evidence is at 7fb4fb70715401ace573ad4456dd1a643dd182da.

## Commands

```powershell
npm.cmd ci
foreach ($package in @('contracts','ui','sdk','kernel','runtime','store-sqlite','control','mastra')) {
  npm.cmd run build -w "@victframework/$package"
  if ($LASTEXITCODE) { exit $LASTEXITCODE }
}
& $PinnedWindowsNode scripts/pack-agent-exchange-proof.mjs $FreshPackOutput
# From the resulting consumer directory, with independent-probe.mjs copied in
& $PinnedWindowsNode independent-probe.mjs
# From the candidate worktree
npx.cmd --offline vitest run packages/mastra/test packages/runtime/test packages/store-sqlite/test packages/control/test
```

The first proof invoked npm 10.9.2 because the script locates its npm CLI next to process.execPath. Fresh install and workspace builds used npm 11.19.1. For the pinned proof, the verifier staged the exact same Windows Node executable beside the installed npm 11.19.1 and reran the unmodified pack and consumer script. The package proof extracted eight candidate npm tarballs into a clean consumer populated by pinned transitive packages, confirmed their resolved locations under node_modules and checked Mastra core 1.64.0. Logs retain both attempts. npm ci reported an engine warning for posthog-node and audit counts of 8 low, 14 moderate, 22 high and 3 critical on the frozen dependency set.

## Independent crash result

The documented pending-intent crash path succeeds. On owner loss before receipt settlement, both original turns become Interrupted and the durable receipt becomes outcome unknown. The reserved charge is retained, unconfirmed provider attempts are unknown, the original stream preserves strictly increasing durable sequences, disabled or unrelated actors cannot replay, and a second reconcile dispatches nothing.

The separate commit-before-delivery fault injection uses the public receipt-store port to stop the owner immediately after its SQLite settle transaction commits, before the call returns to the adapter or any tool result is delivered. A separate process kills that owner, reopens both SQLite stores and invokes exchange.reconcileAfterRestart() exactly as documented. The original typed answered receipt replays unchanged with zero additional dispatch and an unchanged asker stream high-water mark of 3. Both original turn rows remain running with no error code. Reconciliation selects only pending receipt pairs, so the already-settled pair is skipped. Expected behavior is for abandoned original turns to become terminal, preserving the answered receipt and avoiding delivery or execution after restart. The exact failure is retained for VICT-004. Run only this reproducer from the installed consumer with node independent-probe.mjs settled-before-delivery-owner-loss.

The other independent checks use synthetic offline models through the packed public exports. They cover the last shared step and zero-step gate, concurrent and settled exact duplicates, altered duplicate, missing and changed pins on both sides, cancellation and deadline in both directions, question projection, outbound answer refusal, revoked actor/scope checks, stable identities and strict monotonic sequences across live observation and replay. Stop/deadline checks require both streams to end in a single cancellation and no accepted answer to reach the asker. They also verify the typed receipt links both original streams.
## Regression and recovery follow-up

The regression command exited 0. Vitest ran 84 files, with 83 passed and the POSIX-only permission file skipped on Windows. Test counts were 950 passed and three skipped. The separate recovery recheck opened a copy of the failed fixture and invoked the installed public AgentTurnService.reconcileAfterRestart(). It converted both abandoned original turns from running to failed with VICT_TURN_INTERRUPTED. The answered receipt stayed identical and the asker stream sequence stayed at 3. This narrows the finding to the documented exchange-only startup procedure. The independent report asks VICT-004 to repair that procedure or document and prove the composed startup recovery.

An orchestration poll intended to trigger the pinned pack ended without launching it. The pinned run was subsequently launched directly using run-pinned-pack.ps1.

## Verdict

FAIL for the independent Windows binding gate. The eight builds and all 12 documented installed-consumer scenarios passed. The independent installed probe passed 12 of 13 scenarios. Both npm pack invocations produced byte-identical archives by SHA-256 and SHA-512, and both reproduced the one post-settlement recovery failure. The eight archive hashes are in archives-pinned.json. No new dispatch was observed during either crash replay. VICT-004 received the failure and the separate successful public turn-service recovery evidence. TORI binding requires a passing independent verdict. The exchange cap remains with Radzi.

Signed 14 November 2026 by codex-independent-windows-vict005-96798ab.
