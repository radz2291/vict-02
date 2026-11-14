# VICT-004 Governed agent exchange

## Owner authorization

On 14 November 2026 Radzi authorized the VICT wrapper selected by the
[TORI Phase 0 and conformance evidence](https://github.com/radz2291/VICT-Tori/blob/3c983fd24709575ade36f22d09c83478e7ddc888/docs/evidence/v1c-run-visibility/EXCHANGE-CONFORMANCE.md).
This is the third entry of the upstream backlog. The other entries remain separate.
Source baseline is `6b420a3e9eada6f694cc2550debda7753316b5b3`.
Mastra core remains 1.64.0 and the package lock is unchanged.
Independent Windows verification precedes TORI binding.

## Public composition

- Resolve both exact agent activations with `AgentProfileRegistry`. Use
  `MASTRA_EXCHANGE_ADAPTER_COMPATIBILITY` (opt-in revision 7). Existing revision 6
  activations continue through the ordinary adapter. Exchange profiles must use the
  existing bounded turn policy and a concrete v2/v3 streaming model instance.
- The trusted host wires one asker and one answerer in
  `createMastraAgentExchange({ binding, stores, receipts, disclosure })`.
  The wire identifies the ask capability and the answerer's holding capability by exact revision.
  The ask capability uses `AGENT_EXCHANGE_ASK_CAPABILITY` with a closed
  `{question: string}` input contract and an answered/refused output contract.
  Put its reference in the asker's activation envelope. The answerer's holding
  capability must also appear in its own activation envelope. The model cannot supply
  or alter a binding, activation, occurrence, actor, or store.
- Pass the same opaque binding and the host's original absolute deadline resolver
  to each `composeMastraTurnExecutor`. Inside the answerer's admitted holding
  invocation, call `exchange.withAsker` and await the asker's original turn. This
  is the first authorized live delegation composition. The exchange itself is
  a request and response between asker and answerer. Wider topologies compose
  wired pairs outside this adapter.
- Disclosure must authorize the exact question, return only permitted context,
  and validate the exact answer. Only that projection enters the tool-free
  Mastra answer step. The answer step has no conversation memory, tools,
  transcript writes, or registered observability exporter. The host must
  supply trusted disclosure callbacks and authenticate the actor before
  calling `exchange.readReceipt(operationId, actorId)`. The adapter checks the
  current actor scopes and disclosure policies again.
- Use `createSqliteAgentExchangeStore` with an explicit file path in the
  deployment's operational store domain. Intent commits before model dispatch
  and receipt commits before tool-result delivery. Each record links both turns,
  the holding and ask invocations, both activation pins, original deadlines,
  the asker tool charge, answerer step reservation and observed answer attempts.
  A denied question leaves a typed receipt with no denied text. Duplicate
  operations reuse the settled result. The same occurrence with changed text is
  refused. The strict `vict.agent-stream@1` schema is unchanged.
- Stop or expiry on either side cancels the linked live scope. On startup after
  confirming loss of the previous single-process owner, call
  `exchange.reconcileAfterRestart()` before accepting work for the binding.
  This interrupts the original turns and fences pending receipts as outcome
  unknown. Provider attempt count is unknown when it was not confirmed before
  the process loss. Replay reads a receipt and performs no execution.
  Restore the deployment's actor directory before authorized replay.

Ordinary and answer model steps use one per-turn balance. Mastra's public
pre-step hook enforces the ordinary loop reservation. The answer step uses
the same gate. Model retries stay within the reserved step and the pinned
retry setting. The UTF-8 text size limit is a receipt/payload bound.
Exchange-count policy is an open owner decision. The adapter sets no count default.

## Reproduction and independent gate

On the exact candidate checkout, use the unchanged lock and Windows
Node 22.13.1 with npm 11.19.1. From PowerShell:

```powershell
npm ci
foreach ($package in @('contracts','ui','sdk','kernel','runtime','store-sqlite','control','mastra')) {
  npm run build -w "@victframework/$package"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
node scripts/pack-agent-exchange-proof.mjs
npx vitest run packages/mastra/test packages/runtime/test packages/store-sqlite/test packages/control/test
```

The package proof runs an isolated consumer using the candidate archives
and pinned transitive dependencies. It covers last and zero step, in-flight
and settled duplicates, changed duplicate, refusal before and after generation,
both Stops, each deadline, revoked actor, exact pins, original stream and process
loss. Record the exact checkout, archive hashes, full test results and any
failures. Independently challenge the shared step reservation, disclosure,
typed durable replay and sequencing. A Linux builder result is candidate
evidence. TORI binding is gated on the independent Windows verdict.
