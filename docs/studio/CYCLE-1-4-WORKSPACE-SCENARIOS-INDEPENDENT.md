# Consistent workspace / Try scenarios — independent review

2026-10-26. **HELD — independent hands-on UI execution not demonstrated.** This is an independent source, remote identity, build-seal and evidence review. It is not technical readiness, owner acceptance, Milestone1 acceptance or Stage9 closure.

## Exact scope and identities

Authority is [the owner amendment](CYCLE-1-4-WORKSPACE-SCENARIOS.md), read with AGENTS.md, the canonical system reference, Stage9 state/architecture/current handoff. Entry delivery is `3e0ae578d592d2afdf734e363553a594b2c58f3f`; remote main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. The final source candidate reviewed is **`b2d4b10552c9237c95b24180323f43b9ad460f70`**, remote-equal on `codex/studio-cycle-1-4-workspace` when checked. It descends from the superseded `227b52fbbfc73e705555e0051141b79728aaa0ee` and `721b1f1d86ce85637abf16d4208230278c602977` candidates.

The verifier used a separate managed checkout, `C:/Users/RZ1/.codex/worktrees/studio-cycle14-workspace-verify/260831-VCT-02`, clean and detached first at `721b1f1`, then at `b2d4b10`. No product edits, dependency installs, tests or builds were performed there. Independent evidence/report writes are confined to the builder's requested documentation paths. No owner `.16:5610` tab, data or predecessor source was touched by this verifier.

The final serial `b2d4b10` production seal and final builder presentation/showcase observations were independently reviewed as recorded below. Earlier observations remain scoped to their named product; the final seal is not substituted into earlier failed build records.

## Methods and execution provenance

- **Independent execution:** read source/tests and exact commit diffs; compared clean checkout and remote refs; ran `seal-production.mjs --verify` against the builder's serial `721b1f1` artifact and hashed its seal. No test/build generation was run after that serial build by this verifier.
- **Independent review of builder execution:** read the named test logs, screenshots, DOM observations and JSON records. These observations are attributed to the builder, not to verifier-operated UI.
- **Independent hands-on UI: unavailable.** `mcp__cua_repl` returned no apps or browsers. A fresh reset and bounded attempt with previously observed/confirmed provider `2` did not recover access. No tab was created and no UI action was executed. Exact calls/errors are retained in [independent-source-seal-audit.json](cycle-1-4/workspace-scenarios/independent-source-seal-audit.json). This environment limitation is not a product failure; it leaves the required independent desktop/small-window execution open.

The builder's continued CUA execution can demonstrate product behavior for independent evidence review. It does not become this verifier's hands-on execution and does not close that missing gate requirement.

## Source challenge ledger — earlier observations retained

| Finding | Original observation | Bounded disposition at final source |
| --- | --- | --- |
| WS-01 — scenario eligibility | Initial projection walked all conditional branches, empty repeat templates, replaced slot fallbacks/local definition bodies and hidden subtrees; arbitrary component props could be counted as visible feedback. Missing action input mappings and permanently disabled controls could still advertise action scenarios. | Projection now conservatively excludes conditional/repeat/slot/local-definition scopes and renderer-controlled component fills, declared hidden/display:none/visibility-hidden subtrees, disabled fieldsets/controls and incompatible submit inputs. Loading requires an actual supported consumer. Complex scopes can truthfully receive fewer or no ready-made scenarios. Source/tests support the repair; this is not a general runtime visibility resolver. |
| WS-02 — choice/reset and async state | Initial selection merged previous scenario values and reset only adapter generation. An old pending action could settle into the newly selected test. A subsequent challenge identified old pending cleanup overwriting a newly seeded Loading value. | Each choice resets preview/session/host generation, clears prior values and flags, waits for host cleanup, then seeds under a monotonically invalidated choice token. Advanced edits use the same fence. The exact `721b1f1` regression includes pending→Loading and checks again after the prior action's delay; that logic remains in `b2d4b10`. |
| WS-03 — side-panel keyboard/focus | Initial window shortcuts could delete/duplicate/reorder canonical selection from Testing/Inspect/Document controls. Chat hide had no visible focus return; Testing→Document return could target the inert canvas toolbar. | Destructive shortcuts exclude side panels; Chat, Document, Testing and Inspect have explicit focus handling and narrow overlay containment. Source repair reviewed. Builder focus records/captures are reviewed below; independent keyboard execution remains open. |
| WS-04 — unsupported feedback absence claim | The intermediate helper's fixed `actionError` check asserted no connected error message. Builder's actual form used custom feedback wiring and visibly rendered permission/service failure. | Final `b2d4b10` copy gives neutral instructions to try Submit and check screen response or Recent activity. It no longer claims absence based on an incomplete consumer detector. |
| WS-05 — readable labels / showcase focus | Hidden literal text leaves caused artificial heading/field ordinals. Closing showcase testing or returning to its canvas lacked reliable focus; raw showcase values did not use the same fencing. | Final delta prefixes text leaves, retains canonical bytes, returns Close/Escape to the disclosure, focuses a canvas control for Try on canvas and fences Advanced changes. Focus/label regressions were added. Final builder presentation/showcase observations support these repairs at the execution limits below. |

No reviewed change expands canonical schema, component ABI, action/effect authority, provider execution or storage/history semantics. Scenarios seed host presentation values or configure the existing declared local adapter. Names and inspection summaries remain projections; exact source stays under Technical details. Floating editing tools remain in the canvas path, with explicit edit handoffs.

## Build and automated evidence

The final independent seal check returned `verified:true`, **751 inputs / 491 outputs**, candidate **`b2d4b10552c9237c95b24180323f43b9ad460f70`**. SHA-256 of `production-seal.json` is **`5ffb354eece36f66f64ba1f92b78ec304895446ca114a1749adb25891e2aefe2`**. The verifier ran the seal script in verification mode and separately hashed the seal; no build/check generation followed the serial build. See [the final audit](cycle-1-4/workspace-scenarios/independent-final-b2-audit.json).

The earlier independent serial `721b1f1` seal check also returned `verified:true`, 751 inputs / 491 outputs. Its seal SHA-256 was `14e19acddaad63f6ac5804821ec120e3628d253168e6f4ef63546356616fa3d8`. See [the retained earlier audit](cycle-1-4/workspace-scenarios/independent-source-seal-audit.json). This earlier result remains scoped to that superseded artifact.

Final builder `tests-final.log` reports **7 files / 37 tests passed**. Builder reports final types passed (empty successful log); `svelte-delivery.log` reports **0 errors / 5 existing warnings in 2 files**; `build-b2d4b10-serial.log` is the final successful production build record. These checks ran before the final serial build. The verifier read test bodies and logs but did not rerun them. Earlier `tests-721b1f1.log` reports 3 files / 12 tests, including pending→Loading; still earlier 7-file/33-test evidence belongs to `227b52f`. No earlier test count is represented as a final run.

The failed build observation is retained: overlapping SvelteKit generation produced mismatched client/server globals and blank pages with `Cannot read properties of undefined (reading 'data')`. The bad seals, browser screenshot, DOM text and console errors remain under `workspace-scenarios/`. A subsequent serial `721b1f1` build mounted successfully in builder CUA. The failed artifact is not relabeled as a passing build.

## Reviewed builder UI observations — exact `721b1f1` scope

The builder used a disposable `.17:5611` screen through ordinary Source and Save UI. These are reviewed observations, not independent hands-on UI:

| Behavior | Evidence reviewed and bounded conclusion |
| --- | --- |
| Unsupported screen / plain testing | `serial-empty-scenarios.png` shows a truthful zero-choice empty state, temporary-test explanation and collapsed Advanced. |
| Sample, reset and source preservation | `serial-long-content.png` shows the sample with quiet active indicator. `sample-reset.json` records length 330 and reset value **empty string**. The screenshot's “Jordan Lee” is a placeholder, not saved/runtime data. `source-test-preservation.json` records equality. |
| Simulated denied/failure/recovery | `serial-permission-denied.png`, `serial-action-failed.png`, and `serial-action-recovered.png` visibly show simulated denial, service failure, then a successful local simulated result. |
| History, drafts and Save/reopen | `draft-guard.json` records blocked scenario/edit commands and retained draft. `history.json` records exact undo/restoration and redo title. `save-reopen.json` records `r1.r2`, exact reopened source and empty runtime reset. Direct artifact comparison of saved/final source differs only in revision `r1.r1`→`r1.r2`, consistent with explicit Save. |
| Panels and shared inspection | `serial-readable-inspect.png` shows readable shared Inspect, collapsed Technical details and retained bottom Structure. `serial-phone-inspect.png`, `phone-focus.json` show a bounded narrow inspector and Testing dismissal returning focus to visible Layers. |
| Mounted expanded Structure | `serial-phone-expanded-structure.png` and `phone-expanded.json` show a mounted graph with zero-height covered canvas and `canvasInert:true`. Builder noted unsupported DOM property reads; observed `inert` attributes are the applicable evidence. |
| Resize/context | `chat-size.json` records 240–400. `structure-preservation.json` records 180–421, camera unchanged and retained “Full name” search. These are observed values, not claims of pixel-exact rounding. |
| Explicit floating editing handoff | `serial-floating-edit-handoff.png` and JSON show mounted canvas/Structure and floating Format/Insert/Arrange/Connect after the explicit handoff. The earlier zero count from querying the wrong “Format” label was a selector error; the corrected tools observation was positive. |

## Final candidate presentation/showcase recheck — builder execution

Final fresh builder CUA tabs 20/21 used the serial `b2d4b10` artifact at `.17:5611`. Independently reviewed `final-b2-scenarios.png/.txt` shows neutral submit-response instructions without the unsupported absence claim. `final-b2-layers.txt` shows readable field labels; `final-b2-canvas.png` shows active Long content and canvas input focus. Direct reading of `final-b2-facts.json` confirms `onbNameInput` focus, sample length **330**, reset value **empty string**, and no reported console errors. The builder's earlier message saying 318 was corrected by the retained JSON value; no 318-character result is claimed here.

`final-b2-showcase-focus.json` records Close and Escape each returning to `SUMMARY` / “Try scenarios”, then Try on canvas focusing the “Continue” button, with no reported console errors. `final-b2-showcase.png` confirms the actual canvas/layer composition. These final rechecks cover the changed copy, labels and showcase focus; unchanged earlier phone/action/history journeys retain their explicit `721b1f1` scope.

## Current disposition and next allowed action

**HELD.** Independent source/remote identity and final build-seal verification pass at `b2d4b10`. Builder UI evidence demonstrates the listed behavior at its stated product/provenance limits. No additional concrete product blocker was identified in those reviewed observations. The remaining gate gap is independent hands-on desktop/small-window execution through a working CUA surface.

Obtain fresh independent desktop/small-window hands-on verification through a working CUA surface. Preserve these observations and the missing demonstration. Do not claim readiness for owner review, owner acceptance, main merge, publication/deployment, Milestone2 or Stage9 closure from this report.
