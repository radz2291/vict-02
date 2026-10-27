# AE-THINK-01 — public explanations and observations

## Architecture decision recorded before implementation

Owner authority is the 2026-10-27 parallel-agency amendment in the current Stage 9 handoff and AE-THINK-01 in `CYCLE-1-4-AGENT-EFFICIENCY.md`. This isolated candidate starts at `65f92bb4e3b39f0b74013bce97293b4325528912`; clean branch `codex/studio-cycle-1-4-agent-explanations`; local and remote origin/main both `d7401bef6e48330796c74ec00c86db9622d48cdf`.

The frozen `vict.agent-stream@1` deliberately excludes hidden reasoning. It remains byte-identical. Mastra's recognized reasoning chunk types are not proof that a configured provider emits them, and do not establish that their contents are suitable public summaries. We will not forward or relabel that content.

Public assistant explanations already have a compatible route: normal assistant output through the adapter's `text.delta`. Concise approach narration and a final answer use that route. Tool-boundary ordering lets the UI distinguish interim narration from the eventual answer without guessing a private reasoning process. No additional model call, new tool, or reasoning-generation request is needed.

A first local design proposed separate finite-code host activity. The owner's subsequent clarification superseded that proposal before candidate delivery: retain actual assistant text and every real tool call chronologically, with actual sanitized Input/Result; keep mechanical metadata in Chat details. The unused host-activity draft was removed. No such contract is delivered or proposed for transcript injection.

The compatible candidate therefore uses **existing public assistant text** and a separately opted-in Studio presentation projection, `vict.studio-tool-evidence@1`. This is not a new kind in the frozen operational stream or a change to the framework ledger. The request explicitly accepts this exact version; absent opt-in receives the existing vocabulary; unsupported versions are refused. Input means actual **validated** capability arguments, not an invented reconstruction of invalid raw provider arguments. Result means the actual capability return after invocation settles, including canonical refusal. Pre-invocation or thrown failures carry explicit unavailability, never fabricated input/output. Tool bodies are projected through a server-only bounded/redacting serializer into untrusted display data; the existing source/capability/effect authority is unchanged.

Host activity is derived from existing lifecycle events and settled capability results, never inferred from elapsed time or model prose. A successful visual observation means only that the existing capture/inference/revalidation capability succeeded for its stated region; it does not prove interaction behavior or whole-page completeness. Its existing detailed observation remains in the technical tool evidence, not copied indiscriminately into the new channel.

The UI track remains separate. This track changes no Chat component, workspace styling, owner source, preview process, tabs, effect permissions, provider selection, tool/retry budgets or frozen stream contract. Integration must show public assistant narration and actual tool evidence as such, with optional collapsed detail, and keep actionable failures visible. No provider reasoning channel is enabled, regardless of actual provider capability.

## Candidate status

**BUILDER BOUNDED CHECKS PASS — separate candidate for root integration and independent challenge.** No independent verdict, acceptance, merge, release, deployment or Stage 9 closure is claimed. This backend candidate alone does not change the owner's visible Chat; the root UI track owns presentation/integration.

## What is implemented

- `designer-agent.ts` accepts an optional exact `toolEvidenceSchema`. The same authenticated owner/run/capability invocation supplies evidence; no new browser actor, provider, tool, effect or source authority is added.
- `designer/tool-evidence.ts` defines the closed versioned presentation frame, strict structural guard and consumer. Every frame carries the server run ID, monotonic sequence, pinned tool name, real call ID and phase. Input/result remain one chronological call, including when calls overlap.
- `server/tool-evidence.ts` projects actual capability arguments and actual returned values into bounded display text. Nested credential fields, Bearer/key-shaped strings and known server secret values are redacted. Accessors are never evaluated; cycles/deep/oversized data are marked truncated. This is a defensive presentation projection, not a claim of universal application-content DLP. Payloads remain untrusted owner-authorized data.
- Capability invocation supplies actual **validated** Input before the implementation runs. Actual Result is captured after it returns, including `ok:false` refusal/code/diagnostics. Missing pre-invocation data and thrown results are explicitly unavailable. No raw exception, stack, private model reasoning or reconstructed invalid arguments are supplied.
- Each call/phase is emitted once. Each text payload is at most 8,000 UTF-8 bytes; aggregate payload text is at most 160,000 bytes per run. After that, individual phases explicitly report `budget` unavailability rather than silently disappearing or exceeding the existing 2MB transport ceiling. Frame overhead and the original stream remain subject to that original ceiling.
- Stop/fenced runs do not deliver late evidence. Producer closes during cleanup; the existing `done` remains the final transport frame and is not delayed by cleanup. The consumer additionally rejects wrong-run, duplicate, stale and post-close frames.
- Frozen `packages/contracts/src/agent-stream.ts`, Mastra adapter, profiles/instructions/capabilities, private-memory handling, request retries, editor history/storage and canonical execution are unchanged. No additional model request is required for this feature.

## Root UI integration contract

Import `STUDIO_TOOL_EVIDENCE_SCHEMA`, `createToolEvidenceConsumer` and `StudioToolEvidence` from `apps/studio/src/lib/designer/tool-evidence.ts`. Add `toolEvidenceSchema: STUDIO_TOOL_EVIDENCE_SCHEMA` to the admitted POST body. Unsupported version requests fail validation; no opt-in gives old frames only.

On the existing `started` frame create `createToolEvidenceConsumer(runId)`. For each `type:'tool-evidence'`, call `accept(event)` and attach the returned phase to the existing real tool call by **both tool and callId**. The shape is:

```ts
{
  type: 'tool-evidence', schema: 'vict.studio-tool-evidence@1',
  runId, sequence, tool, callId,
  phase: 'input' | 'result',
  availability: 'available' | 'unavailable',
  payload?: { text, redacted, truncated },
  unavailableReason?: 'before-invocation' | 'not-returned' | 'budget',
  status?: 'completed' | 'refused' | 'failed' // result only
}
```

Render payload as plain text/code only, never executable HTML or instructions. The default Input/Result disclosure may be collapsed. Label redaction/truncation honestly; partial JSON is deliberately not promised to parse. For `before-invocation`, explain that validated arguments were unavailable because the call did not enter capability invocation; do not label them as captured raw input. For `not-returned`, say no actual capability result was returned; show the existing normalized failure separately. For `budget`, explain the evidence display limit. Do not create another pseudo tool call for evidence, schema parser evaluations, metadata, receipts or host summaries. Do not change the call's chronological location when evidence arrives.

Close the consumer immediately on `done`, Stop, disconnect or transport failure. A cancelled response need not deliver another Result; pending calls remain honestly stopped/unknown. A later user request receives a new run/consumer. Existing assistant `text` is the only assistant narrative route; preserve all accepted narration chronologically without calling it a private thought trace. Existing actual visual observation content can be found in the observed tool's genuine Result; it still carries its captured-region and interaction limitations. Do not expose a new host summary transcript.

## Controlled provider observation

One separately authorized, non-destructive server-side probe used the same local `zai-key1` endpoint configuration and `zai/glm-5.3-flash` as the preview. It did not use an owner turn/session/source, change thinking options or call a tool. Its sole prompt was “Reply exactly READY.” with a 512-token ceiling. [Reproducible probe](cycle-1-4/agent-explanations/probe-provider.mjs), [retained count/type metadata](cycle-1-4/agent-explanations/provider-probe.json).

At `2026-10-27T08:56:55.876Z` (16:56:55 Malaysia time), the actual SDK stream finished and emitted one reasoning-start, 189 reasoning-deltas totaling 966 characters, one reasoning-end and one public text-delta totaling five characters. No reasoning/public answer text, credentials, raw chunks or provider errors were recorded. This verifies **emission in this bounded probe**, not universal model behavior, safe public-summary support, whole-turn performance or production readiness. It corrects the earlier “provider unverified” report for this narrow observation. The fact that reasoning exists does not authorize forwarding private reasoning; this candidate intentionally keeps it excluded.

## Builder evidence and retained observations

Dependency reuse was read-only through a local node_modules junction to the root's dependency directory. No shared dependencies, manifests, package outputs, preview/server processes or owner tabs were changed. The tested Studio source is this isolated worktree; existing framework packages resolve through their installed delivery path.

- Initial focused evidence suite: **6/6 PASS** ([log](cycle-1-4/agent-explanations/tests-initial.log)). It covers serializer bounds/redaction, version/old-request compatibility, run budget and producer/consumer fences, genuine pinned-Mastra read/refusal results, public text preservation, private reasoning canary discard and Stop/actor boundaries.
- Expanded final batch: **4 files / 32 tests PASS** ([log](cycle-1-4/agent-explanations/tests-final.log)): seven new focused cases, existing pinned-Mastra executor regressions, HTTP terminal-delivery boundary and designer reliability. The added pre-invocation case proves invalid schema data yields explicit unavailable Input/Result with one real call identity, while parser diagnostics remain distinct. These overlap the initial six and must not be summed as unique cases.
- Initial TypeScript check before adding the adversarial fixture passed ([log](cycle-1-4/agent-explanations/types-initial.log)). The expanded fixture then failed static checking because its public offline model type intentionally omits reasoning parts ([retained failure](cycle-1-4/agent-explanations/types-final.log)). Only the test injection seam was widened to `unknown`; production types were not weakened. **Final `tsc --noEmit` PASS** ([recheck](cycle-1-4/agent-explanations/types-recheck.log)).
- The first shell attempt used root-relative paths from the Studio subdirectory and could not locate rg inputs/the kit CLI. It changed no source or data; the correct `../../node_modules` CLI path succeeded. An initial multi-hunk patch failed context matching and changed no source; ordered hunks then applied. These setup failures are retained here, not counted as product check passes.
- Five inherited Svelte warnings appeared during test import; no warning repair or broader UI claim belongs to this backend track. No standalone production build, browser review or live end-to-end owner turn is claimed. Root must build and exercise the integrated candidate after consuming this commit. The live probe establishes provider part emission only; pinned offline tests establish channel/compatibility behavior.

## Next allowed action

Root may integrate this isolated candidate into its quiet Chat UI work, preserve both evidence sets, run the affected integrated checks/build and publish the reviewable exact SHA. A fresh independent reviewer must challenge the final integrated run/cancellation/refusal/redaction behavior and actual UI. The backend candidate alone does not close AE-THINK-01, establish owner acceptance, or permit main merge/release/deployment/Stage 9 closure.
