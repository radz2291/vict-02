# Independent tool completion repair — PASS WITH NON-BLOCKING FINDINGS

Exact pushed product: `3c54f5e525827b66abcee9ac03acc68642b9e8c3`, branch
`codex/studio-cycle-1-1-tool-completion-repair`.
Studio tree: `d806ebf394c50bd7bf2c0307b2fc89c147a8ea0c`.
Main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`.
Audit branch: `codex/studio-cycle-1-1-tool-completion-verification-final`.

This independent verifier did not author the implementation. The repository
entry, canonical reference, Stage 9 state/architecture/handoff and current Studio
state/handoff were read. The separate authorized verifier checkout was reused;
a new branch starts at the exact candidate. Product source remained byte-equal
to that candidate throughout. Only verification documentation and drivers were
authored. No owner browser, 5591 server, screen, chat, draft, saved data or
credential file was modified or accessed by this verifier. Main and the product
branch were remote-compared before and after checks.

## Retained baseline failure and demonstrated cause

[Baseline FAIL](BASELINE-FAILURE.md) is independently pushed at
`a8895c96eccce2dcfdbe3d20989a6a11b1d24c68`. The exact plain owner prompt
exhausted 4000 output tokens entirely during reasoning, emitted no visible text
or tools, and Studio falsely returned completed/0. That is a captured runtime
failure, not an inference about the owner's original truncated JSON usage.
The original owner run did not retain token usage, so its exact consumption is
not invented. Historical revision/layout gates remain scoped evidence.

The new real-provider [compact trace](candidate-provider-trace.json) proves:

- Actual request JSON uses `max_tokens: 131072`, streaming enabled, and **no
  `reasoning_effort` field**. Default provider thinking is preserved.
- First step uses **5053 output tokens: 4464 reasoning + 589 text/tool content**,
  exceeding the old cap before the first valid edit. It finishes normally with
  normalized `{unified: tool-calls, raw: tool_calls}`.
- Five complete valid JSON edit transactions are acknowledged by the canonical
  EditorBridge. Six model steps end with a normal stop, completed/5.
- Total captured output is 7954 tokens (4637 reasoning, 3317 text/tool content).
  The full output allowance permits completion; it does not force consuming it.
- No hidden reasoning text, credential, authorization header or raw provider
  exception is retained. Only counts, finish usage and safe request fields are
  recorded. The exact user prompt receives no batch/revision/palette coaching.

The independently read [official Z.ai model specification](https://docs.z.ai/guides/vlm/glm-5.3-flash)
advertises 128K maximum output, streaming and tool calling, with thinking enabled.
The product's 131072 allowance matches that output window; the host retains Stop
and a 30-minute whole-turn deadline. The full duration limit was inspected, not
waited out. No forced low-effort configuration remains.

## Independent checks

| Check | Result and evidence |
| --- | --- |
| Full Studio suite | **159/159 PASS**, 26 files, 102.07 seconds; [log](full-suite.log) |
| TypeScript | PASS; [log](check.log) |
| Scoped ESLint | 0 errors; existing ignored `.svelte` file warning explicitly retained, not claimed as Svelte lint coverage; [log](lint.log) |
| Exact production build | PASS, adapter completed, server build 43.06 seconds; [log](production-build.log) |
| Real full Mastra/plain-prompt trace | PASS, five acknowledged batches, 149.06-second test; [probe](candidate-provider.test.ts), [log](candidate-provider.log) |
| Production plain prompt, blank run 1 | PASS, eight batches, 217.597 seconds, first edit 130.740 seconds; [initial record](production-plain-browser-initial.json) |
| Production plain prompt, blank run 2 | PASS, six batches, 209.392 seconds, first edit 100.379 seconds; [record](production-plain-browser.json) |
| Production same prompt, saved nonempty screen + failed history | PASS, six batches, 166.382 seconds, first edit 96.132 seconds; same [record](production-plain-browser.json) |
| Targeted selected heading | PASS, one edit, 33.864 seconds; only `existing-heading-text` changes; same [record](production-plain-browser.json) |
| Real selected footer removal | PASS, one edit, 19.754 seconds; exactly selected seven-node subtree plus parent edge removed; [record](production-remove-browser.json) |
| Undo/Redo/save/reopen | PASS on every complete plain journey, selected change and removal; exact canonical comparisons in browser records |
| Actual stale document | PASS, real proposal refused `UI_DOC_STALE_REVISION`, zero agent effects, manual edit retained; [record](browser-fences.json) |
| Actual unapplied source draft | PASS, real proposal refused `STUDIO_AGENT_DRAFT`, zero effects, draft retained; same [record](browser-fences.json) |
| Genuine router/provider refusal | PASS, real Z.ai endpoint with deliberately invalid fixture credential on isolated 5594; safe failed/0 result and unchanged canvas in 1.009 seconds; [record](real-provider-refusal.json) |
| Production failure UI | PASS for output limit, incomplete edit and provider failure, explicit no-effects copy and unchanged canvas; **test-only transport fixtures**, not live-provider acceptance; [record](production-failure-feedback.json) |
| Artifact identity | 202 file hashes, exact producing product, no escaping runtime imports; [manifest](artifact-manifest.json) |
| Activation runtime dependencies | Eight external imports plus native/Markdown checks resolve to same physical files at intended destination; [record](runtime-dependencies.json) |
| Credential isolation | 44 client files, actual selected credential matches 0, server-only marker matches 0; [record](credential-isolation.json) |
| Cleanup | Own 5592 and 5594 listeners stopped, product artifact preserved; [record](cleanup.json) |

The full suite includes fail-closed malformed tool JSON, normalized/string
length finish, unfinished EOF, failure with zero edits, earlier valid edits
remaining undoable, failed edit followed only by a successful read staying
failed, valid corrected edit recovery, and legitimate zero-edit conversation.
Canonical editing/history/save code is unchanged by this repair. Current real
journeys exercise **all four operations**: 143 adds, four modifies and one move
in the three completed plain journeys/selected follow-up, plus the explicit
real footer removal. The saved placeholder heading is moved into the hero and
repurposed; it is not left as old placeholder content.

## Exact natural requests and failed-history recovery

Every landing request is exactly:

> Pls create a landing page for an Ai platform like chatgpt, called Quellight.

Runs use isolated browser contexts and normal chat UI. The saved case begins
with an ordinary manually authored heading, saved twice and reopened at `r1.r2`.
Two **test-only UI transport fixtures** first create the owner's observed history
shape: completed/0, then a partial Batch 1 assistant reply with incomplete-edit
failure. The subsequent provider request is real and contains those four prior
user/assistant messages. Its prompt is unchanged and receives no fresh-go,
new-screen, token, palette or batching instruction from the test. It succeeds
on that same saved document with zero refusals.

The follow-up is `Change the selected heading to "Quellight — think clearly,
build faster".` The request contains the actual selected heading occurrence;
only its literal text child changes. It is independently undoable, then saved
and reopened. `Remove the selected footer.` uses a real selected footer child;
the agent correctly resolves the containing footer and removes its entire
subtree. No product source is changed to make these demonstrations pass.

The stale/draft controls delay the real proposal only at a test transport seam;
proposal bytes, validation, browser editing and acknowledgements stay unchanged.
The genuine provider-refusal server uses a clearly invalid fixture key. The
owner's actual key is neither changed nor sent for that negative control.

## Retained test observations and bounded reruns

1. The initial production driver completes blank run 1, then interrupts run 2
   after eight valid acknowledgements while it is still streaming. Generic
   Puppeteer `Waiting failed` occurs at about 180 seconds; its original cause
   was not captured. Pinned Puppeteer `Connection.js:37` defaults CDP calls to
   180000 ms, and WaitTask wraps its cause in that generic error. This is a
   probable harness timeout, not a proven product failure. All original
   [driver](production-plain-browser-initial.mjs), [log](production-plain-browser-initial.log),
   [record](production-plain-browser-initial.json) and
   [screenshot](plain-browser-initial-interrupted.png) remain. The observation
   is **INCOMPLETE**, neither product PASS nor FAIL. Increasing only the test
   CDP timeout allows the exact same product to complete the 209-second rerun.
   The closed isolated browser cancels its request; final own-server shutdown
   also fences any abandoned host run. Its exact terminal event was not observed.
2. Initial removal actually succeeds (valid remove/1 acknowledgement), but a
   test assertion expects selection of the footer container itself. A normal
   center click selects its `footer-tag` child instead. The agent correctly
   removes the containing footer. The overstrict test then exits before history
   checks. This [initial record](production-remove-browser-initial.json),
   [driver](production-remove-browser-initial.mjs), [log](production-remove-browser-initial.log)
   and [image](remove-browser-initial-assertion.png) remain. The fixture assertion
   is corrected to accept its footer descendant; a new real request then proves
   exact subtree scope, Undo/Redo/save/reopen. No implementation is repaired here.

## Visual review and remaining findings

I inspected the actual production [first visible edit](plain-first-visible-update.png),
[completed landing page](plain-run1-complete.png),
[saved existing-screen page](plain-run3-complete.png),
[selected saved result](plain-selected-saved-reopened.png),
[footer removal saved](real-selected-footer-removed-saved.png), and
[genuine provider failure](real-provider-refusal.png).
At 1280×720 the chat is compact, the canvas has priority, transcript/composer/status
remain separate, Stop stays available while building, and failures plainly say
that no edits were applied. Generated landing pages are coherent palette-backed
previews. This repair does not change the accepted panel layout; fresh responsive
coverage is the existing full UI tests plus retained layout-gate evidence, not a
new claim of production screenshots at every viewport.

Non-blocking findings:

- Default thinking has visible latency: first canvas edits take 96–131 seconds
  and complete natural builds take 166–218 seconds in these samples. Stop and
  progress remain available. No speed or determinism guarantee is made.
- Generated assistant prose can be verbose and mention node IDs/revisions or
  editing tokens. This is a copy-quality finding against the owner's preference
  for quiet plain language; functionality and validation remain correct.
- A loaded owner tab retains its previously loaded JavaScript until a new page
  load. The backend fix is compatible with that tab, but new code-specific
  failure copy requires loading the new UI. Preserve the unsaved owner screen
  and chat; use a fresh review tab rather than silently reloading it.

No blocking product findings remain in this bounded repair. **Cycle 1.1 is ready
for owner review** once the manager activates the exact verified artifact and
reports its delivery SHA. This independent verdict does not mark owner
acceptance, close all Stage 9 work, begin Cycle 1.2, merge main, publish packages
or authorize application/backend authoring.
