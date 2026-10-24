# Cycle 1.3 — Structure presentation corrections

> Placement update, 2026-10-24: the owner's accepted [Structure-in-Document change](CYCLE-1-3-STRUCTURE-DRAWER.md) now has independent scoped PASS at product `a36793df0f62c002332d66db181310554aaabb05`. The canvas remains visible in the normal drawer presentation. The older mode-placement record below is retained exact-product history; other agent/platform findings remain open.

2026-10-24. **Owner-authorized Structure corrections independently PASS — READY FOR OWNER REVIEW.** The owner's instruction “Can you fix those now?” authorizes the eight Structure findings SU-01–SU-08 in the [UI preference review](CYCLE-1-3-AGENT-STRESS-REVIEW.md#structure-review-against-the-owners-current-ui-preferences). The supplied UI preferences are the design standard. This supersedes the report-only restriction for these presentation/interaction findings only. Agent authoring, menu identity, capture reliability, multi-page delivery and other OR findings remain report-only/open.

## Baseline and scope

Clean, remote-equal starting delivery: `44df18c448ab5d80655d155082e7c3739c79045d`, branch `codex/studio-cycle-1-3-completion`, isolated worktree `C:/Users/RZ1/.codex/worktrees/studio-cycle-1-3-completion/260831-VCT-02`. Remote main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. Historical product/independent PASS `be893f29d44f595a8d9982575c2199636df69597` remains exact-scope evidence, not verification of this new candidate.

Allowed changes: Studio Structure projection/view, its Designer mode/selection handoff and relevant CSS; presentation-only Flow node/control composition; focused regression tests and evidence; this handoff/report and concise current-state pointers. No component ABI replacement, runtime/effect/data semantics, arbitrary scripts, recipe/backend work, package publication, merge, deployment, owner acceptance or Stage 9 closure.

## Delivery criteria

1. Compact Structure toolbar; one primary visible Fit command; occasional view/layout/layer settings use existing menu conventions.
2. Graph uses available workspace; inspection opens deliberately in a predictable dismissible dock with simple Properties/Relationships disclosure and keyboard source navigation.
3. Ordinary selection changes neither camera nor filters and does not open editing tools. Explicit Find/Focus/Frame commands can reveal and frame their target. Dismissal preserves authored source, drafts and shared selection.
4. Node-local group disclosure and contextual Move task, retaining keyboard alternatives and canonical compatible-slot/stale/draft/history guards. Dragging a visual node must not silently reparent source.
5. Concise node labels and useful summaries; technical details remain available. Optional simplified text projection must preserve exact source identity and technical navigation.
6. Stable Design / Interact / Structure mode labels and shared styling, with existing selection/draft/context protections retained.
7. Available-space sizing, keyboard/focus/dismissal and bounded scrolling work on small/large documents and smaller windows. Keep Chat under its existing View menu control.

## Verification and delivery

Run affected source/projection and real-component regression tests, Studio checks and Flow checks, then a production build and real browser review on an isolated preview. Preserve the existing owner server, browser documents, saved source, drafts, provider configuration and ports. Never reload an owner tab to test a new build; use a separate preview/tab and disposable fixture. Record visual screenshots and actual interactions, including camera stability, source navigation, filter/disclosure state, move/Undo and draft refusal. Commit/push candidate and evidence, verify remote SHA and obtain a fresh independent verifier verdict at the exact candidate. Failed observations remain recorded. Stage 9 remains REOPENED / IN PROGRESS; owner review follows verification.

## Result

Implementation candidate prepared: one compact toolbar with shared View/Object menus; explicit inspection dock with Properties/Relationships/Find; node-local group disclosure and contextual keyboard/handle Move; plain node presentation with optional exact text nodes; stable workspace modes and camera-preserving ordinary selection. Presentation transforms preserve the canonical graph/document, dynamic text bindings and source identities. Background dismissal clears selection only when drafts allow; Escape closes inspection and restores focus.

Builder checks so far: Studio TypeScript PASS; Studio Svelte check 0 errors / 6 existing warnings in unchanged renderer/editor files; Flow Svelte check 0 errors / 0 warnings; 15 focused Structure tests and 4 existing composition/chat tests PASS. An initial new test used an invalid unwrapped text expression: TypeScript caught it, and the fixture was corrected to the canonical `expression` wrapper before the final focused run. No production expression contract was changed.

Retained failed observation: the optional Vite dev preview initially failed dependency optimization on ELK's optional `web-worker`; a temporary, untracked config excluding that dependency allowed the UI to load but the dev layout import still reported unavailable. No package/config workaround is included in the candidate. Production-build browser verification is pending in a separate checkout so the running owner build is not overwritten. Exact production evidence and fresh independent verdict remain required before readiness.

### Initial production candidate and bounded repairs

Initial pushed product candidate: `130485027d2b999a7458a7424ef8c083b352c348`. The isolated production client/server compiled; the first adapter packaging attempt exited1 without a diagnostic cause while the verifier separately hit V8 out-of-memory. These are retained, not passed. Sequential build with `UV_THREADPOOL_SIZE=1` completed the full production build and adapter successfully. No dependency/config change or safety bypass was used. The isolated checkout reuses installed dependencies through a junction; relevant source dependencies match the pinned candidate. The original owner build/server is unchanged.

Fresh independent production review found two blocking gaps, retained in [the verifier report](CYCLE-1-3-STRUCTURE-CORRECTIONS-INDEPENDENT.md): SV-01 Enter-selected graph source disagreed with inspection/shared selection; SV-02 default Chat plus a 140px graph minimum clipped inspection at 640×480. Other pointer/filter/navigation/collapse/move/Undo/draft journeys passed within that fixture.

Bounded repairs: synchronize actual Enter/Space from the focused graph wrapper, disable automatic focus panning and unsupported multi-selection, and stop nested disclosure keys from becoming graph selection. An intermediate generic `onselectionchange` attempt was rejected after tests exposed two regressions in explicit Find/state and Move navigation; it is not in the delivered source. A new keyboard-selection regression and the original Find/state/move checks pass together. Use explicit authored element names in node presentation. Remove the graph height floor; at short narrow windows keep Chat and workspace side by side consistently across modes, retaining Chat content and its existing visibility control. The repaired candidate still requires a new production build and affected independent browser verification.

Second pushed candidate `a8cddea20ca15b3ae05f8140b4c5e65fe258b421` built successfully. Independent production recheck closed SV-01 and SV-02, including Enter/Space, nested disclosure, exact state/text Find, preserved drafts and identical mode bounds at 640×480 with Chat visible. A further graph-focused Escape failure (SV-03) is retained: upstream deselected its visual node before the dock closed, leaving shared selection intact. The final bounded repair captures Escape only from a focused graph node wrapper before that upstream handler: an open dock closes without deselecting; a closed dock permits deliberate, draft-guarded shared deselection. Other inputs and menu keys retain their own handlers. The real-Flow keyboard regression now asserts both states, highlight, shared callback and focus restoration; all 8 affected Structure/presentation tests pass. Final production rebuild and independent recheck are pending.

Third candidate `254b9092ac92662239b7b4eaadb5ef9ac8121b95` passed full production build and affected independent browser recheck: graph-focused Escape preserved both selection owners while closing the dock, then deliberately cleared both when the dock was closed. Explicit Find and Frame were additionally challenged on a distant text node in the 56-source-node builder fixture; the settled selected node was visible within the graph viewport. The builder fixture remained saved with unchanged application identity. A final one-line integration repair supplies the same guarded deselection callback to StudioShowcase's embedded Structure view; all corrected controls use the shared component there. Final showcase candidate/build and verdict follow below.

## Final verified result — 2026-10-24

Exact final product: `dabbe9027e335bab1a405f4a808711d93623b3c5`, branch `codex/studio-cycle-1-3-completion`; main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. The [fresh independent verdict](CYCLE-1-3-STRUCTURE-CORRECTIONS-INDEPENDENT.md#final-exact-candidate-verdict) is **PASS — READY FOR OWNER REVIEW** for SU-01–SU-08. SV-01, SV-02 and SV-03 are closed by their recorded repairs and production challenges. Historical pending/failure statements above describe earlier candidates and are retained evidence.

The final production client/server and Node adapter build completed successfully in the isolated preview checkout. Final Studio TypeScript passed independently; Svelte check reports 0 errors and 6 retained warnings in unchanged renderer/editor files. The final affected suite passed independently: 8 tests across presentation and real Structure interaction. Earlier focused canonical/orientation checks and 4 existing composition/chat tests passed as builder evidence. The verifier's earlier full composition transform terminated with V8 out-of-memory and was not independently rerun; it remains NOT DEMONSTRATED by that verifier. No dependency/config workaround or reduced validation was committed.

| Finding | Delivered behavior |
| --- | --- |
| SU-01 / workspace | Compact toolbar, deliberate bounded inspection dock, graph fills available space. |
| SU-02 / command homes | Shared View/Object menus, one primary Fit control, editing handed to existing editors. |
| SU-03 / selection | Ordinary pointer/keyboard selection preserves camera and filters; explicit Find/Frame reveals distant exact sources. |
| SU-04 / disclosure | Properties/Relationships/Find pages; close/Escape restore focus; background and closed-dock Escape synchronize graph and host selection. |
| SU-05 / manipulation | Node-local disclosure and contextual compatible Move; canonical draft/stale/slot guards and Undo retained. |
| SU-06 / hierarchy | Concise labels and compact literal-text projection, exact source navigation and dynamic bindings retained. |
| SU-07 / coherence | Stable Design/Interact/Structure controls and shared implementation in the showcase. |
| SU-08 / bounds | Independently exercised keyboard/focus, 800×600 and 640×480 with Chat visible; bounded dock scrolling. This is not a universal accessibility/zoom certification. |

Canonical source, component ABI/catalog, effects, provider behavior, document identity and transaction/history authority are unchanged. No model run was needed. Other OR-01–OR-14 findings remain open/report-only. Owner acceptance and Stage 9 closure are not claimed. Next allowed action: owner hands-on review of this corrected preview.

Saved [evidence manifest](cycle-1-3/structure-corrections/evidence.json), [overview screenshot](cycle-1-3/structure-corrections/structure-overview.png) and [inspection screenshot](cycle-1-3/structure-corrections/structure-inspection.png) pin the final product and aggregate checks. These screenshots contain only disposable review content.

On continuation, ports 5596/5597/5599 were no longer listening and temporary review tabs had closed. Only the agent-owned final production preview on `127.0.0.5:5599` was relaunched; the old owner services and tabs were not restarted or changed. The saved disposable Structure fixture loaded successfully. The preview is UI-only, with no configured model. Historical preservation statements above mean those owner processes/documents were not modified during this work, not that the old services are currently available.

## Try the corrected UI

**Current operational update, 2026-10-24:** at the owner's request, this same preview now uses the existing server-side `zai/glm-5.3-flash` configuration and credentials. Replaced only the agent-owned UI-only Vite preview with the sealed Node production build at the same `127.0.0.5:5599` origin. Refreshed the expired server session in a temporary sign-in tab and used Chat details → Reconnect agent in the original Designer tab, without reloading it. The UI shows the exact model and **Ready**; the owner's unsent request and application identity remained intact. No prompt was submitted and provider response quality was not retested. The earlier inline unconfigured alert belongs to the retained failed draft and may remain until Send retries it. No product source changed. The [repeatable launcher](cycle-1-3/launch-structure-review.ps1) pins the reviewed product, refuses an occupied port, and reads existing credentials through the server-only launcher. Earlier UI-only statements/screenshots are historical observations.

Use the isolated [updated Studio UI preview](http://127.0.0.5:5599/design), local sign-in `operator` / `studio-local-pass`. It contains disposable review fixtures; the original `127.0.0.3:5596` server and owner source were not restarted or migrated. This UI-only preview does not configure or call a model; the original configured provider remains unchanged.

Choose **Structure**, then expand a group with its chevron. Selecting a node keeps the camera and filters in place. **View** contains framing, source finding, layout direction and relationship layers; the graph has one primary Fit control. **Inspect** opens the bounded dock with Properties, Relationships and Find. Escape closes it; with the dock closed, Escape on a graph node clears selection. **Object → Move inside** exposes compatible keyboard destinations and optional graph handles; use the existing Edit → Undo to recover. Ordinary dragging only changes visual position.

The [showcase](http://127.0.0.5:5599/showcase#designer) embeds the same corrected Structure view in its disposable recipe examples. Choose Structure there to try the menus, inspection, disclosure and contextual movement without changing saved owner screens.
