# VICT-005 independent Windows qualification

## Verdict

**PASS** for the exact repaired Windows candidate. The frozen install, eight builds, eight installed-package export checks, 13 official consumer scenarios, exact historical settled-owner-loss reproduction, and 14 independent consumer scenarios all passed. The regression run passed 950 tests across 83 files. Three POSIX-only permission checks in one file were skipped on Windows. The candidate worktree and lockfile were clean after qualification. [All phase exit codes](exit-status.log)

In both crash windows, exchange startup closed both original turns as `VICT_TURN_INTERRUPTED`, kept both stream sequence high-water marks at `[3,3]`, and left both invocation histories unchanged. Pending intent settled to `VICT_EXCHANGE_OUTCOME_UNKNOWN` with an unknown provider-attempt count. The committed answered receipt retained its SQLite bytes and replayed as the same authorized typed receipt. Two additional startup and replay passes left the rows stable and dispatched zero model or capability calls. [Independent recovery log](independent-public-probe.log)

All eight fresh archive sizes, SHA-256 and SHA-512 hashes matched the builder’s published manifest. [Archive manifest](archives.json) · [Comparison log](builder-archive-comparison.log)

This passes the upstream VICT-005 gate and returns the ticket for owner review. The exchange-cap policy and authorization for any TORI binding are separate owner decisions.

## Candidate

| Pin | Verified value |
| --- | --- |
| Product commit | `2ebac8f0e20c19c5731766d0021b0f33ff1ec249` |
| Git tree | `28394bf0a32ca81e37dc15103e767b75859c61ae` |
| Lockfile Git blob | `66c10fa33529f34eff4008f3c3be2193a067f020` |
| Remote branch | `codex/vict-governed-agent-exchange` |
| Windows | NT 10.0.26300.0, x64 |
| Node and npm | 22.13.1 and 11.19.1 |
| Mastra core | 1.64.0 |
| Rolladice Work | VICT-005, attempt 2, run `45e90531-24e5-4e9f-a25c-8014f02c8a05` |

I started from a new detached worktree and verified the remote head, tree, lock and absent `node_modules`. The dependency install and eight sequential builds used the pinned npm CLI. The pack command ran with a copy of the pinned Windows Node executable beside npm 11.19.1 because it resolves npm relative to Node. It copied pinned non-VICT dependencies into a separate directory and installed the eight new VICT archives by extraction. The export probe loaded every package export and resolved its declarations. [Pins](pins.log) · [Install](npm-ci.log) · [Mastra resolution](mastra-version.log) · [Installed exports](installed-exports.log)

## Recovery and replay

The [historical reproduction](historical-independent-probe.mjs) preserves the prior verifier’s exact Git blob. The [expanded independent probe](independent-probe.mjs) kills the owner at the pending intent and committed answer boundaries. It confirms zero tool-result deliveries before owner loss. Each restart uses reopened SQLite stores and the public `exchange.reconcileAfterRestart()` entry point. Both original turn IDs and both durable stream snapshots are compared, including high-water marks. The committed answer is read as SQLite text at the fault marker, then compared with the durable bytes and the typed authorized replay after recovery. Repeated startup and replay must preserve the terminal turn rows, durable stream events and tool invocation records. A recomposed host records model and capability dispatch, and current actor authorization is exercised on replay. A separate binding is exercised before the correct binding to test isolation.

The independent fixture also exercises last-step and zero-step consumption, in-flight and settled duplicates, changed duplicate input, both Stops and deadlines, question and answer disclosure, actor revocation, activation pin rejection and exchanged profile identities. The reference fixture sanity run used the previous builder’s installed archives while the fresh build ran. Qualification results come from the separate fresh pack and regression run. [Historical repro log](historical-settled-loss.log) · [Independent results](independent-public-probe.log) · [Reference fixture sanity log](fixture-sanity-only.log)

## Reproduction

Stage Windows Node 22.13.1 beside `node_modules/npm/bin/npm-cli.js` from npm 11.19.1. With the reproduction scripts and probes in an evidence directory, run the following using the candidate repository as the reference checkout and unused paths for the worktree and pack output.

```powershell
& "$evidence/prepare-qualification.ps1" -ReferenceCheckout $reference -FreshWorktree $worktree -Evidence $evidence -Toolchain $toolchain
& "$evidence/run-qualification.ps1" -Worktree $worktree -Evidence $evidence -Toolchain $toolchain
```

The second script runs the four original regression package groups with `--maxWorkers=2` to limit resource pressure on the host shared with the concurrent TORI Windows qualification. Product test timeouts are inherited from the candidate. [Checkout and build script](prepare-qualification.ps1) · [Qualification script](run-qualification.ps1) · [Full regression log](regressions.log)

The frozen install reported an existing `posthog-node` engine warning, npm install-script warnings and npm audit advisories. The lock and toolchain pins were retained. [Full npm install log](npm-ci.log)

The [failed qualification at 96798ab](https://github.com/radz2291/vict-02/blob/63b5a53c8bb00371e9ebc3c1de64680a4baed6cc/docs/governance/vict-005-windows-96798ab/REPORT.md) and the [builder’s targeted recovery evidence](https://github.com/radz2291/vict-02/blob/da5a8b746aa493829b3b92b5b1e3ed3defe0ab66/docs/governance/vict-004-recovery-windows/REPORT.md) remain separately pinned.
