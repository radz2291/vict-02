# VICT-004 startup recovery on Windows

Repair 2ebac8f0e20c19c5731766d0021b0f33ff1ec249, tree 28394bf0a32ca81e37dc15103e767b75859c61ae, based on 7fb4fb70715401ace573ad4456dd1a643dd182da. The lock blob remains 66c10fa33529f34eff4008f3c3be2193a067f020. Windows x64 10.0.26300, Node 22.13.1, npm 11.19.1 and Mastra core 1.64.0.

The previous packed candidate reproduced the VICT-005 failure. It returned the original answered receipt after owner loss at the commit/delivery boundary and left both original turns running. The repair includes settled receipts in the startup lookup by binding and open turn. It checks the original actor, stream and profile, and checks the activation pin when the durable turn row has it. Existing SQLite receipts are indexed in place on open. Recovery uses the existing turn transition, including cancellation when a Stop intent exists. It leaves the settled receipt and stream ledger intact.

All eight package builds and 13 packed public scenarios passed. The two killed-process probes preserve the two original streams at sequences [3,3], the durable rows, and zero redispatch. The pending receipt becomes outcome unknown. The committed answer's stored SQLite JSON is byte-equivalent and authorized replay returns that original typed answer. A repeated recovery preserves terminal turn rows, and unrelated open and terminal turns and a separate binding remain untouched. The previous independent fault probe passed unchanged against the new archives. The legacy database check found the already-written settled receipt under either original turn and deduplicated the pair.

## Reproduction

From a fresh detached worktree at the repair, use npm.cmd ci --prefer-offline with npm 11.19.1 and the pinned lock. Build contracts, ui, sdk, kernel, runtime, store-sqlite, control and mastra in that order with npm.cmd run build -w @victframework/<name>. Launch scripts/pack-agent-exchange-proof.mjs with Windows Node 22.13.1 staged beside npm 11.19.1, because the script resolves npm beside Node. Provide a fresh output directory. In its installed consumer, the two crashes can also be selected with node verify.mjs process-loss settled-process-loss. Run the focused regression suite with npx.cmd --offline vitest run packages/mastra/test packages/runtime/test packages/store-sqlite/test packages/control/test.

The Windows archive manifest includes SHA-256, SHA-512 and byte sizes. This targeted builder evidence goes to VICT-005 for a fresh independent Windows verdict before any TORI exchange binding.


## Regression result

The initial 84-file run recorded one 20-second timeout in the SQLite orchestration conformance case HIGH-3. The same file passed 48/48 in isolation. The full command repeated with --maxWorkers=2 and the original test timeouts passed 950/950 applicable tests. Three POSIX-only permission tests were skipped on Windows. All three logs are retained.
