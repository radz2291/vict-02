# Cycle 1.4 - Owner-run agent output and diagnostic review

2026-10-27. **REPORT ONLY / OPEN FINDINGS / NO IMPLEMENTATION AUTHORITY.** The owner explicitly requested a separate report, continued investigation of turns2 and3, and proposals without product changes. Clean local/remote baseline `cf7c7fb7861aac32401866c0fe27854b806bcac8`; report branch `codex/studio-cycle-1-4-agent-output-review`; origin/main unchanged `d7401bef6e48330796c74ec00c86db9622d48cdf`. Reviewed preview product remains `e5bc3cd36aae5e7d2934aa03f293fb49c8ce1006`. Previous bounded quiet-Chat candidate checks remain valid for their own scope; these later owner-run findings are not closed by those checks.

This report concerns VICT capabilities, agent efficiency, verification and communication. Example landing-page content is not evaluated. Findings separate measured behavior, source evidence and unresolved inference. No whole-project quality guarantee or independent gate verdict is claimed.

## Evidence and method

Read the owner's actual three-turn Studio conversation and DOM-backed sanitized tool Input/Result, relevant source/implementation contracts, computed component styles and scroll geometry. No new model/tool request was sent through Studio. No owner-source edit, Save, Apply, Undo, preview restart/reload, workspace-mode change or scroll was performed. Current unsaved work and conversation remain in place.

- [Bounded findings and measured geometry](cycle-1-4/agent-output-review/findings.json).
- [Current visible header gap and failed-observation state](cycle-1-4/agent-output-review/header-gap.png).
- The owner also supplied a screenshot showing scrolled product content above the sticky header. Its display scale differs from CSS pixels; measurements below are CSS pixels from the current DOM.
- Source references: [read query/schema](../../apps/studio/src/lib/designer/agent-reads.ts), [capture guard](../../apps/studio/src/lib/designer/visual-observation.ts), [workspace layout](../../apps/studio/src/lib/designer/workspace.css), [Designer workspace/capture context](../../apps/studio/src/lib/designer/Designer.svelte), [Chat state/history](../../apps/studio/src/lib/designer/AgentChat.svelte), [authoring descriptors](../../packages/ui-ai-svelte/src/authoring/descriptors.ts), [authored conversation](../../packages/ui-ai-svelte/src/authoring/Conversation.svelte), [user-message composition](../../packages/ui-ai-svelte/src/patterns/Message.svelte).

## Turn1 - Polish the authored chat to match the page

Request: polish the authored support chat so it fits the landing-page theme. The actual trace has18calls:10source reads,1contract read,4edit calls/3acknowledged transactions,3observations. First acknowledged edit was approximately255seconds after turn start. At the third observation the receipt reported510seconds elapsed; this is not an exact full-turn duration or a provider-latency measurement.

### AR-01 - Visible component surfaces are not faithfully styleable (P1, confirmed)

All three AI authoring adapters advertise only `styleTargets:['root']`. Their inner presentation still owns real surfaces. The agent changed wrapper backgrounds repeatedly, but the authored conversation's inner background remains `rgb(255,255,255)`. The user bubble's inner background is `rgb(241,243,247)` with near-white `rgb(246,245,242)` text; its wrapper is dark. The composer also retains a pale inner input surface despite a dark wrapper. These are real component surfaces, not editor selection overlays. Root styling alone cannot reliably deliver the intended themed result. Nested padding/width constraints also leave a narrow message region at the reviewed workspace width.

Proposal: semantic styling parts and scoped theme tokens linked to implementation, including surface, bubble, text, composer field and relevant states/layout behavior. Do not expose internal CSS selectors as an agent-maintained dependency. Preserve upstream defaults and explicitly version/pin changed authoring contracts as needed. Validate advertised targets against rendered targets.

### AR-02 - Read scopes are silently ignored and discovery is inefficient (P1, confirmed)

The agent sent `section:'nodes',nodeId:'support'` at offsets0 and20. The schema accepts nodeId, but the nodes branch filters only by query and pages the global node list. The first returned node was the document root, not a scoped support subtree. Subsequent global pages and repeated source previews consumed work before the first edit. A supported query search already exists, but the agent did not use it. Do not attribute the entire255second delay to these reads: the available metrics include model generation, transport and other overhead, not isolated provider latency.

Proposal: section-specific discriminated read schemas; explicit subtree/ID/label/component-role search and bundled relevant source reads; reject unused/unsupported parameters. Compact index first, exact details on demand. Changed host read behavior requires compatible version treatment.

### AR-03 - Edit capabilities are discovered through a rejected batch (P2, confirmed)

A focus pseudo-style on a component node rejected the whole first edit batch: `setConditionalStyle requires an element node`. Atomic refusal correctly prevented partial changes; the agent then dropped the unsupported operation and continued. The capability information/preflight was insufficient to prevent this avoidable invalid proposal.

Proposal: expose effective per-node/part property and state support before authoring and validate a proposed batch before application. Unsupported requests should name the capability/alternative, not trigger blind wrapper experiments.

### AR-04 - Repeated cropped screenshots do not resolve the styling cause (P1, confirmed)

The three successful observations covered648x561px at offsetTop2089 of a roughly3315px-tall source. The composer/card bottom were outside the captured region. `focus` is a text instruction to the image observer; it does not move the viewport or target a DOM part. The model guessed that a white patch might be selection chrome, despite an actual inner background causing the defect. Further wrapper changes did not establish the intended result.

Proposal: targeted, governed observations with explicit owned node/part and coverage, structured computed styles/bounds/style ownership plus pixels, and separate editor/application layers. If a requested part is not visible or an attempted style has no demonstrated effect, explain the limit and choose a supported recovery; do not keep changing the same inaccessible surface. Preserve source/runtime/capture freshness guards.

### AR-05 - Completion and public narration overstate the result (P1, confirmed)

The final assistant answer opens with Done, yet says the composer was not observed and the user bubble still had an unexplained patch. It is long and technical, repeating node IDs, revisions, style values and receipt counts. These are genuine assistant messages, not injected Chat UI summaries. Current backend instructions explicitly request counts in the final summary, contributing to the mismatch with the owner's quiet/nontechnical preference.

Proposal: completion based on the requested outcome, distinguishing applied, verified and needs-attention. Keep evidence/measurements in Chat details; ask for concise human-facing updates/final explanations. Preserve actual assistant messages rather than hiding them afterward or fabricating a condensed transcript. No automatic source save is required merely to claim a visual edit.

### AR-06 - Complete trace inspection is not available (P2, confirmed)

Eleven of the18call results carry a truncation notice. Notices are honest, but the current projection cannot reveal the complete original payload. This is a trace-display limit, not proof that the model received incomplete tool data. In particular the contract response explicitly says `complete:true`; no partial-contract-consumption defect is inferred for this run.

Proposal: retain bounded original sanitized exchange records with explicit retention/expiry and authenticated pagination/artifact references, showing a compact preview in Chat. Never rerun a tool merely to display its old result. Keep redaction and size bounds; avoid replacing the browser stream cap with unlimited payloads.

## Turns2 and3 - Header gap and correction

Turn2 request used the word footer but described a gap above the top menu. The agent prudently read footer, nav and root; it did not edit the ambiguous target. Turn3 corrected the noun explicitly to header. The agent read nav/root again, attempted observation, read hero, and concluded it could not verify the issue. All six source responses across the two turns were complete JSON pages at `r1.r1#3`, with the same digest. There were no edit calls in either turn.

### AR-07 - Host viewport geometry is missing from the diagnostic model (P1, confirmed for current Design viewport)

Current measured geometry:

| Item | Measured state |
| --- | --- |
| Canvas scroll viewport top |82.800003 CSS px|
| Authored nav top |98.800003 CSS px|
| Gap |16 CSS px|
| Host scroll-container top padding |16px|
| Nav position/top/margin-top |sticky /0px /0px|
| Document root top |approximately-1189.2px|
| Canvas scrollTop |1288px|

The sticky nav is held near the viewport while the document root has scrolled far above it. The gap matches the host's `.workspace-scroll` top padding. This supports a host-scrollport/inset explanation for the reviewed Design gap; it is not evidence for changing the authored header's top/margin. The exact DOM measurements do not establish behavior in every other mode/viewport.

Proposal: separate the editor's outer mat/insets from the application's actual clipped scroll viewport. Define sticky/fixed/overflow behavior across Design, Interact and saved Run explicitly. Expose read-only host viewport, scroll ancestor, padding, bounds, zoom, composition and authored-versus-host ownership facts to diagnostics. Do not patch the page with a negative top offset to compensate for editor chrome.

### AR-08 - Visibility is discovered late and workspace state is incomplete (P1, confirmed)

The third-turn observation returned `STUDIO_CAPTURE_NOT_VISIBLE` / `visibility` / `preview-covered`. Its actual diagnostics show `covered:true`, `layout:false`, frame/viewport `[0,0,0,0]`, same expected/actual revision, and underlying `mode:'design'`. The capture guard correctly refuses when Structure owns the work area; Designer tracks `workspaceView` separately from the underlying Design/Interact mode. Current Design visibility does not make the historical refusal a false positive. No rasterizer/stale-image defect is established.

The request context does not provide this current workspace visibility/observability upfront. The model spends source/model work, then learns it cannot inspect the preview. The refusal-time metrics show4calls/3successful reads/1refused observation,0confirmed edits,0vision requests, about184seconds elapsed and63ms measured tool-active time. These are overlapping host measurements, not exact provider latency or proof of a single bottleneck.

Proposal: preflight observability before planning visual work, with explicit `workspaceView`, interaction mode, preview availability/target and reason. Keep refusal for a genuinely hidden preview. Give the owner a precise reveal/retry action instead of discovering a predictable visibility condition deep in the turn.

### AR-09 - Source absence is used to justify unsupported visual conclusions (P1, confirmed)

The agent correctly found no authored top margin/inset. It then said the document already pins the header flush to the edge and suggested static Design does not simulate sticky scrolling. The current computed geometry shows sticky positioning active in Design and a host inset, so that generic explanation is unsupported for this reviewed state. Once observation failed, it should have stated the visual cause was unresolved rather than filling the gap with untested explanations about selection chrome or Design behavior.

Proposal: separate source facts, measured host/render facts and hypotheses. Promote a hypothesis only with a discriminating observation; missing authored cause does not prove the output is correct. A blocked observation should preserve uncertainty and identify which evidence is missing.

### AR-10 - Correction handling lacks revision-bound task continuity (P2, confirmed rereads; architectural improvement proposed)

Turn3 re-read nav/root already obtained in turn2 at the same revision/digest. Current history carries bounded public user/assistant text; each run creates a fresh agent thread and does not carry typed prior tool facts as reusable task context. Re-reading can be necessary across a source change, so unconditional cross-turn caching would be unsafe. Here the correction changed the target noun, while the reviewed source facts remained the same.

Proposal: task context separate from individual turns: target/intent correction, exact source cursor/digest, supported capabilities, known read facts and verification status. Reuse only matching, actor-authorized facts and revalidate after source/context changes. A correction can supersede focus without replaying edits or discarding actual historical messages. Do not infer how turn2 ended: its terminal status is not available from the current per-turn transcript.

### AR-11 - Mechanical evidence belongs to only the latest turn (P2, confirmed implementation gap)

Chat retains chronological assistant messages and tool exchanges, but resets progress, diagnostics, lifecycle receipt metadata, metrics and observed-region state when a new turn begins. The current Chat details therefore cannot explain the earlier turn's admission/terminal/cancellation state. Turn2's short response is not enough evidence to call it a crash, cancellation or lost output.

Proposal: one typed turn record keyed by run/turn identity, containing terminal status, source boundaries, metrics, diagnostics, observation coverage and call references. Chat details should inspect the selected turn or a turn history, with bounded retention and honest expiry. Do not put mechanical summaries back into the main conversation.

### AR-12 - Recovery is a dead-end explanation rather than a focused continuation (P2, confirmed UI/trace limit)

The third turn safely applied no edits and correctly asked the owner to reveal the preview. The current workspace is now Design and visibly displays the header, but the footer still shows the earlier visibility error and there is no dedicated Retry observation action. The owner must write another prompt; a general new run can repeat discovery/context and may propose edits again. Refusal text is long and technical in the narrow footer.

Proposal: clear, concise failure state plus an explicit observation-only continuation after preview availability is revalidated. Preserve the original task target, current revision and already-applied boundaries. Do not replay prior edits, report success merely because visibility returned, or silently broaden capture/interaction authority. Keep full diagnostics and recovery history in turn-specific Chat details.

## Holistic resolution proposal - not authorized for implementation

A general workflow should be Find target -> Inspect effective capabilities/context -> Prepare valid change -> Apply atomically -> Verify affected surfaces/states -> Report outcome or next required action.

1. **Implementation-linked capability knowledge:** one maintainable manifest describing semantic styling parts, theme roles, properties, states, layout constraints and host requirements. Derive agent knowledge from registrations/implementations and enforce rendered contract tests. Cover native and composed components; preserve compatibility/versioning boundaries.
2. **Typed discovery and task context:** scope-aware read operations, compact indexes and exact bundles; reject irrelevant fields. Keep revision/digest/actor-bound reusable facts and explicit intent corrections, while preserving freshness checks.
3. **Explicit host/application viewport boundary:** external workspace insets, true application scrollport, clear mode/composition/zoom metadata, and defined sticky/fixed/overflow behavior. Diagnose host-versus-authored responsibility before changing source.
4. **Targeted evidence:** owned node/part capture and structured computed styles/bounds/visibility/style provenance. Keep screenshot scope honest, exclude editor chrome and portals as documented, and do not infer bindings/actions from images.
5. **Outcome and recovery discipline:** visible preflight availability, conditional observation-only recovery, no replay of confirmed edits, no repeated edits to inaccessible surfaces, and completion tied to verified requested outcomes.
6. **Turn/evidence records with quiet communication:** preserve public assistant messages and actual calls; concise agent narration; original sanitized exchanges with authenticated paginated access; turn-specific mechanical diagnostics in Chat details rather than repetitive final prose.

Suggested order after separate owner authorization: establish visibility/host geometry and truthful scoped reads; expose/test effective style capabilities; add targeted verification and no-progress recovery; then task continuity, complete evidence access and response policy. A visual wrapper patch alone would leave the larger failure modes intact.

## Future verification matrix

Use diverse components and projects, not a shoes-page-specific recipe. Include nested/native/composed controls, themed message/composer surfaces, normal/focus/disabled/loading states, compact/wide viewports, sticky/fixed headers, nested scroll containers, portals and zoom. Challenge Design/Interact/Structure/Run visibility, genuine hidden-preview refusal, source changes during capture, no edit replay, correction at unchanged/changed revisions, large indexed discovery and trace pagination, cancelled/incomplete turns, and completion claims with unobserved parts. New catalog entries should fail contract tests if advertised targets/states do not exist or do not affect the intended surface.

This can make capabilities, failure reporting and verification more reliable across project types. It does not guarantee perfect creative output or universal project support; unsupported states, hosts and project structures must remain explicit.

## Disposition and next allowed action

All AR-01 through AR-12 are **OPEN / REPORT ONLY**. No product fix, new capability, provider run, source save or preview restart was performed. Existing owner work is preserved. Validation for this documentation/evidence change is `git diff --check` and source-path/evidence checks; no product build or new product test run is warranted. Next allowed action: owner reviews/prioritizes this proposal and explicitly authorizes any bounded implementation; independent verification follows an actual candidate, not this report. No main merge, release, deployment, Stage9 closure or owner acceptance.
