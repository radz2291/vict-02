# Fresh integration continuation — 2026-10-28

Baseline: `d7aeecf8176d78f4e7864a386ac1ff207cb4b871`, clean `codex/authoring-foundation`, correct origin. Read-only live remote main verification confirmed `d7401bef6e48330796c74ec00c86db9622d48cdf` after the sandboxed lookup failed (`getaddrinfo() thread failed to start`). No push.

## Observed through supported internal browser

- `http://127.0.0.25:5626/` reached normal login; sign-in and Designer succeeded. No current origin denial or timeout. The externally repaired server was not stopped, restarted or reconfigured.
- This origin's browser library initially held only Untitled screen. Original other-origin storage was not inspected or overwritten.
- Imported `actual-agent-graph-saved-r1r3.json` through File > Import as a separate screen. `retained-graph-import.json` is only a supported import envelope around that complete original source, not a synthetic replacement graph. Original source file SHA256: `0a55e111a44c94087ffd9edeb5625ee790b544242be8f18585681d878da6dc87`.
- Prior manual input `Manual coexistence after reboot` and output `Verified coexistence` appeared unchanged.
- The shared Mode Select opened within actual iframe `vict-rhea vict-controls` ancestry. White panel/text paint and geometry are recorded in `graph-select-open.json`, with open screenshot/DOM. Selected uppercase; canonical saved source records that parameter.
- A reconnection into an occupied single-capacity input refused with `edges.1: Port connection limit would be exceeded.` Existing edges were retained. Selected/deleted the processor-output connection, successfully reconnected the input edge to Output, restored it to Processor, then created Processor→Output (`edge-1`). Both manual values remained intact. No additional Undo was attempted.
- File Save confirmed `r1.r1` in the new imported screen namespace. Reload reset runtime state; Run displayed the saved graph with both manual values and two edges. See `graph-current-saved-source.json`, `graph-run-ready.dom.txt` and screenshot. The earlier `graph-run.*` files preserve the transient initial navigation snapshot, not the completed-page proof.
- Initial narrow browser layout hid the canvas; after wide resize nodes were tiny until Fit all. This is a retained responsive/camera observation, not a verified repair or a claim of mobile usability.

## Reproduced actual-agent blocker and bounded repair

Created and saved a separate `Foundation AI Review` screen. Exact prompt retained in `ai-trial-prompt.txt`, supplied only public graph verification facts and requested new registered AI surfaces; no private reasoning or provider authority. The actual trial failed before generation: `STUDIO_AGENT_SETUP_FAILED`, error type `VictPresentationError`, 0 model requests, 0 tools, 0 edits. Chat details and screenshot retained. No quota limit occurred; no retry/provider switch.

Existing test `designer-agent-mastra.test.ts` / `fits the frozen provider presentation bounds without dropping expanded recipes` independently reproduced the cause at the baseline:

```
VictPresentationError: capability presentation rejected (VICT_PRESENTATION_INVALID): expanded Studio edit.$defs.add.properties.recipe.pattern: a string exceeds the 2048-character bound
```

Source repair replaces the duplicated oversized regex with one exact recipe vocabulary in `$defs.recipe`, partitioned into enum groups of at most 64 entries and referenced from both guidance locations. No Mastra bounds, Zod admission, recipe IDs, component contracts, provider settings or historical pins change. A fresh verifier agreed with the proposed representation before implementation; post-candidate challenge is separate.

Validation: full governed offline agent test file passes 20/20 (`setup-repair-tests.log`). This includes genuine pinned executor composition and admitted source operations with the deterministic offline model, not live provider acceptance. Type check and exact-commit independent challenge follow. No production rebuild has overwritten the running repaired server's files.

## Limits and next action

Live actual-agent composition remains blocked by the running old production build. Load the validated repair using the same supported outside-sandbox launch/environment and unchanged `127.0.0.25:5626`; then retry only the failed zero-edit AI trial. No supported restart has yet been requested or performed. Keep the current server until that narrow handoff is arranged. Broad integrated acceptance is HELD: remaining AI exposure, responsive recovery, media/custom SVG/icon replay, popup isolation/capture, current panel/context challenges and device evidence are not passed by the graph checks. Full responsive canonical source remains unrecovered; transcript fragments were not relabeled as source. Owner acceptance remains separate; no formal finding closure advanced.

A tool attempt to send a progress update to the parent thread was denied by automatic approval review for lack of direct human authorization for cross-thread messaging. It sent no message, was not retried, and does not block local work; final reporting is automatic. Existing server and all user source were preserved.

Type checking initially found a test-only inferred-property annotation error (retained in setup-repair-types.log). A Record annotation fixes that access without changing assertions or runtime source. Recheck passes exit 0 (setup-repair-types-recheck.log).
