# PV-12: parser observations are not tool attempts

2026-10-24. Builder repair candidate `06830b68ba6ce4250d3caaf3e8217b9481c8bfbc`, branch `codex/studio-observation-truth`; pushed and remote SHA verified. This is scoped source/offline/DOM evidence, not actual-provider or independent product acceptance. The live root runtime at 722 was not changed by this isolated repair.

The stage manager and independent verifier confirmed that two malformed edit calls in the actual 722 writing-desk continuation each displayed the authoritative failed call plus duplicate `Operation schema refused before invocation` cards. Input contract parsing runs more than once and lacks the authoritative tool-call identity. Treating every parser evaluation as a failed attempt was a Studio projection error; no new framework stream or tool-bridge defect is inferred.

The repair keeps actual hub `tool.started` and `tool.failed` call identities as attempt and metric authority. Read/edit contract validation emits a separate Studio-only `schema-diagnostic` observation. Exact tool-plus-diagnostic payload hashes reuse a bounded diagnostic identity, with an observed parser-evaluation count and first/last elapsed timestamps. These are not call counts. No tool name/timing heuristic attaches them to an actual call, and identical payloads across distinct calls do not merge those calls. Existing bounded diagnostic details and edit `lastValidation` in the next overview remain available; the latter explicitly disclaims call assignment. Known canonical leaf projection is unchanged.

AgentChat renders the diagnostic using the public generic expandable activity detail, labeled **not a tool attempt**, without attempt stages or an `Attempt receipts` list. It neither settles active calls nor updates metrics. The existing CoreAuthoringShowcase timeline includes an explicitly simulated standalone example; its diagnostic does not add to the three simulated tool calls. No new UI chrome, provider execution or authoring authority is introduced.

Changed source: `apps/studio/src/lib/server/designer-agent.ts`, `AgentChat.svelte`, `CoreAuthoringShowcase.svelte`. The public Conversation/package schemas, framework stream, bridge, admission, acknowledgement, cancellation, history and source guards are unchanged.

## Scoped checks

From `apps/studio`, using installed workspace dependencies and serial workers:

```text
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism tests/ui/core-schema-diagnostics.test.ts tests/designer-agent-mastra.test.ts tests/ui/completion-timeline.test.ts -t "keeps real same-pass|makes bounded precise|settles parallel reads"
```

3 passed, 25 unselected; 82.56s. The actual pinned offline executor receives two explicitly distinct malformed model call IDs in one provider pass, followed by a valid overview. Real parser callbacks repeat; their identical diagnostic payload produces one separate diagnostic record. Actual outcomes remain two failed IDs and one completed read: 3 calls, 2 refused, 1 completed, zero proposals/source changes. The complete schema guidance remains in actual model tool results/next overview. Actual AgentChat renders three attempts plus one clearly separate diagnostic, with expandable paths and observed parser-evaluation count. Parallel-read projection keeps both calls running while diagnostic updates arrive; each later result settles only its own ID. This is real pinned execution with an offline model and DOM transport, not a network provider or physical browser interaction.

```text
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism tests/designer-agent-mastra.test.ts -t "keeps actual malformed read|makes bounded precise|does not mistake|groups|fences"
```

3 passed, 17 unselected; 33.04s. Includes actual malformed-read parsing and corrected-read recovery: 2 calls, 1 refused, 1 completed, unchanged source/history and no uncorrelated validation attempt. Also preserves precise edit-schema guidance and the existing negative against treating a refused invocation as recovery.

```text
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism tests/ui/core-schema-diagnostics.test.ts
```

2 passed; 40.11s. Rechecks actual pinned-executor-to-chat path and the newly added public showcase diagnostic. Overlapping cases across commands are not summed: 6 unique tests passed. Existing renderer/Svelte initial-plan and accessibility warnings remain; no new warning-causality claim is made.

Final Studio TypeScript (`node ../../node_modules/typescript/bin/tsc --noEmit --project tsconfig.json`) and `git diff --check` passed. No build, package installation, provider request, root source edit, server restart, owner-tab mutation or milestone advancement occurred. No failed product test was relabeled; these focused runs passed. Earlier documentation preparation hit a Windows command-length rejection and a row-matcher assertion before writing; the corrected matcher retained all 101 baseline cells exactly. Those were documentation tooling errors, not product checks.

## Required next proof

Integrate this exact code commit into a new committed/pushed candidate, rebuild/seal that candidate and let the independent verifier recheck actual malformed calls, separate expandable diagnostics, true call/refusal metrics, subsequent correction and unchanged confirmed source. Preserve actual 722 duplicate-card evidence. Stop/parallel/late-event guards remain required regressions. Candidate source checks do not close CA-09/PV-12 or the broader product gate; final finding dispositions and owner acceptance remain with their respective authorities.
