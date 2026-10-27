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

## Node-based application review - owner minimum is Studio Structure parity

2026-10-27 follow-up, clean local/remote report baseline `c18decffd2fb89aa5da3a2fc2accb626a4ed2d8e`; same branch, main and preview product as above. The owner reports that dragging one node moves the entire generated Node Nuke graph. The owner clarified: **at minimum an agent-authored node UI should offer the capability already demonstrated by Studio's Structure tab**. This is an expectation and investigation request, not implementation authority. Application-specific computation is a separate layer; a Nuke image-processing engine is not the minimum requirement.

Evidence: [rendered Source and live Flow DOM](cycle-1-4/agent-output-review/node-capability.json), [current Node Nuke workspace](cycle-1-4/agent-output-review/node-capability.png). The new tab has13 individual `vict.flow.node` declarations and11 `vict.flow.edge` declarations inside `vict.flow.canvas`, with distinct IDs and x/y positions. One DOM sample had only `shuffle1` selected, not all nodes. No Flow diagnostic was rendered. The graph surface measured approximately222CSSpx wide with Document open; fitting a wide graph into it also makes labels very small. The owner changed workspace mode during the read-only review; screenshot and initial DOM sample are different moments. No gesture was replayed, no mode/drawer/source changed by the reviewer, and no provider request, Save or reload occurred. The cause below is source-confirmed and consistent with the report, not a claimed recorded drag experiment.

### AR-13 - Agent-authored Flow is a diagram viewer, below the owner's editor minimum (P1, confirmed contract gap)

The [authoring adapter](../../packages/ui-flow-svelte/src/authoring/FlowCanvas.svelte) sets `nodesDraggable={false}` and `nodesConnectable={false}` globally and also `draggable:false`, `connectable:false`, `deletable:false` on each projected node. Delete is disabled. Svelte Flow's installed default is `panOnDrag=true`; its node wrapper applies `nopan` only to draggable nodes. Consequently a drag originating on these non-draggable cards can pan the viewport, making every node appear to move together while individual graph coordinates remain fixed. These are distinct nodes, not a single authored group. Switching to Interact cannot enable a capability hard-disabled in the adapter.

The [descriptor](../../packages/ui-flow-svelte/src/authoring/descriptors.ts) explicitly promises read-only topology/positions and ephemeral pan/zoom/selection, with no workflow execution. Its node contract has only id/label/x/y, no child-content slots; its edge contract has id/source/target/label. Every Flow descriptor has `outputs:[]`. There is no exposed position-change, selection-change or connection-change output to bind into an authored application. Adding an unsupported `draggable` prop would not override these implementation flags.

Proposal: make reusable interactive graph presentation available through a versioned supported authoring contract, preserving the current read-only contract for existing consumers. Independent node movement, stable camera/layout, selection and inspection are baseline capabilities. Merely flipping a drag boolean would leave reactive updates, persistence and selected-item integration unresolved.

### AR-14 - Labeled pipes and live-looking properties overstate the actual integration (P1, confirmed)

[Visible node composition](../../packages/ui-flow-svelte/src/authoring/FlowVisibleNode.svelte) supplies one generic left target and one right source; handles are inert/hidden. There is no authored port ID, port type, multiplicity or per-edge sourceHandle/targetHandle contract. The generated A/B/mask values are edge labels, not separate Merge sockets. Node content is a fixed label, so arbitrary fields/controls/custom node bodies are not exposed by this registration.

In this document, graph positions and labels are literal props. Four sliders write local number-list states, but no graph declaration consumes those states. The Properties heading and Blur/Grade/Transform sections are static source content; Flow has no selection output to select a matching properties view. The invert checkbox reads a local state but has no authored output binding. This proves the missing source integration, not a tested claim about every control's immediate internal visual feedback. The viewer is authored decorative content, not a connected processing result. Two declared nodes, read2 and const1, have no incident edges in the actual11-edge topology; labels/counts alone do not prove a working compositing pipeline.

Proposal: expose genuine graph/selection events and semantic ports, with explicit domain-owned validation and editable node content/parts where supported. Properties should follow the selected graph item and bind to its actual model. Keep graph visualization independent of execution: connecting two cards must not silently authorize processing, effects or workflows. Advertise unsupported functions honestly rather than suggesting an operating node application from screenshots.

### AR-15 - Studio's own advanced graph UI is not exposed as equivalent agent capability (P1, confirmed parity gap)

The [public code wrapper](../../packages/ui-flow-svelte/src/FlowCanvas.svelte) binds nodes/edges/viewport and forwards upstream props and callbacks. The [package exports](../../packages/ui-flow-svelte/src/index.ts) expose Svelte Flow components, hooks and helpers for coded applications. [Studio Structure](../../apps/studio/src/lib/designer/StructureView.svelte) composes that code API with maintained positions, measured layout, stale-layout fencing, focus/collapse/search, explicit node/edge/port multi-selection and contextual inspection. Its [node composition](../../apps/studio/src/lib/designer/StructuredSourceNode.svelte) supplies semantic icons, ports and tracing. These integrations are not automatically available to the authored canvas.

The [agent knowledge](../../packages/ui-flow-svelte/src/authoring/knowledge.ts) already says no dragging/connecting/deletion/executable nodes and classifies code helpers as host-only. Therefore this is primarily an implemented exposure gap, not missing upstream library functionality and not solvable by a better prompt alone. This review did not inspect the full Node Nuke conversation and does not claim whether the model read or ignored that guidance. Prior Structure verification establishes only its recorded Studio scope, not interactive authored-application parity.

Maturity assessment: useful reusable code foundation and a bounded authored diagram viewer; **agent-authored node-based software is not yet demonstrated as a complete editor**. Coded VICT consumers can compose a richer editor with the public API, but must still supply graph meaning, validation, persistence and integration. No blanket production-readiness verdict for every node application follows.

### Proposed minimum acceptance matrix - use the existing Structure experience as the benchmark

| Owner-visible capability | Studio Structure reference | Current agent-authored Flow | Required evidence for parity |
| --- | --- | --- | --- |
| Move one node | Bound node positions, drag cancels stale layout | Hard-disabled; gesture can pan all | Move one card without moving other cards or camera; preserve its position across unrelated updates |
| Pan/zoom and fit | Retained viewport, fit/focus, guarded layout | Available, but fit into a narrow pane reduces readability | Explicit background pan, readable fit/focus, zoom never silently rearranges nodes |
| Select nodes/connections | Ctrl/Meta selection with coherent node/edge/port tracing | Upstream ephemeral selection; no authored selection output | Single/multiple node and edge selection, add/remove/clear and keyboard parity; useful shared selection information |
| Trace relationships | Hover/click edges or port rows highlight related items | Basic selected-edge appearance; no equivalent port tracing contract | Trace one or several connections from edge or port; consistent highlights and concise relationship narrative |
| Read node identity/content | Shared icons, semantic kind/title/summary and ports | Label-only authored card | Quiet coherent node identity, readable content, meaningful sockets and no redundant labels |
| Navigate a complex graph | Search, collapse, focused neighborhood, arrange/orientation, minimap | Pan/zoom/fit/minimap; no authored search/collapse/focus/layout controls | Representative dense graph, search/focus/collapse and arrange retain selection and camera predictably |
| Integrate inspection | Node/edge/mixed selection feeds actual source inspection | No selection event for authored inspector | Properties and relationship information follow the actual selected graph IDs, single or many |
| Keep changes coherent | Studio maintains presentation state separately from canonical edits | Literal source coordinates; no interactive write path | Clear runtime model versus authored source ownership; intended undo/save/reopen behavior and no hidden writes |

This matrix defines an acceptance target, not fresh verification of every existing Structure behavior. Structure's dependency ports are primarily inspection affordances; guarded containment moves do not constitute arbitrary workflow wiring. Full named-port connect/reconnect/delete, custom node editing and domain validation are the next application-editor requirements, separate from reproducing that minimum. Draggable compound subflows and executable processing are not claimed as existing Structure capabilities.

Architecture proposal: extract reusable presentation and interaction primitives from Structure rather than copy its UI-source-specific semantics into generated applications. Keep app graph IDs distinct from canonical UI node/occurrence IDs; supply domain-specific adapters for relationships, selected-item descriptions and validation. Emit typed changes through the component ABI into explicit application state/actions. Define whether positions/viewport are transient or saved by the host, and test reactivity, history and persistence before claiming support. Derive discovery knowledge from that implemented contract and test it across isolated multiple canvases, rerenders, save/reopen, cancelled drags, invalid/stale connections, keyboard use and representative larger graphs. Reuse existing bounded layout/fencing helpers where suitable; do not infer large-graph application performance from Studio's earlier layout benchmarks alone.

## Dropdown follow-up - theming, overlay observation and useful completion

2026-10-27 owner request: investigate the first tab's dropdown turn holistically, including difficulty during work and the off-theme output. Clean local/remote report baseline `b5264415babb1c75bedea373effaad117a867371`; same branch/main/preview product as above. [Sanitized rendered trace, source subset and measured styles](cycle-1-4/agent-output-review/dropdown-review.json); [current open Women menu](cycle-1-4/agent-output-review/dropdown-review.png). This was read-only: no clicks, hover changes, source edits, Save, restart/reload or provider call. The current Source metadata revision is `r1.r1`; the agent transaction cursor advances separately from `r1.r1#3` to `r1.r1#7`. Do not confuse document metadata with the editing token.

### AR-16 - Declared popup styling parts are not addressable by the authoring path, and theme scope is incomplete (P1, confirmed)

The current popup panel computes to white `rgb(255,255,255)` with default light border; the three items compute to `rgb(199,204,214)` (`#c7ccd6`) at14px/600 over transparent backgrounds. Against white this is approximately1.61:1 contrast. The source explicitly assigns that light text to all six items, matching the dark header, but never assigns a dark popup surface. The current triggers have transparent background, no border and zero padding: the trigger cleanup succeeded; the remaining defect is the opened panel/items, not just the closed header.

Unlike the AI adapters in AR-01, the [dropdown descriptor](../../packages/ui-svelte/src/catalog/components/b4-descriptors.ts) and implementation declare **both root and content** style targets. [B4DropdownMenu](../../packages/ui-svelte/src/catalog/components/B4DropdownMenu.svelte) places root on the trigger and content on the portalled menu. However, [RenderNode](../../packages/ui-svelte/src/document/RenderNode.svelte)'s presentation target applies compiled classes/style variables only to the first target; the secondary content target gets ownership/selection metadata but no independent authored style class. The [agent style operation](../../apps/studio/src/lib/designer/agent-edits.ts) and canonical node localStyle carry property/value, not a selectable component part. Thus the named content target does not provide an independently addressable popup-style operation. Applying more root background/border changes continues to change the trigger.

The [catalog CSS](../../packages/ui-svelte/src/catalog.css) derives popup surface and highlighted state from shared semantic tokens. The [portal](../../packages/ui-svelte/src/catalog/components/CatalogPortal.svelte) preserves the document scope class and layer, so authored item classes do survive: this is not wholesale lost CSS. But the popup is physically outside the page's dark nav/main ancestry; its portal scope has the host's light tokens, not a complete authored application theme. The page uses hardcoded dark local backgrounds and light item text, which do not establish a coherent surface/text/hover/focus palette for detached overlays. No claim that every portal or catalog control is broken follows from this one menu.

Proposal: expose a truthful, compatible component-part styling path and an explicit authored theme contract. Theme roles should include surface/text, border, highlighted surface/text, focus ring, disabled state and elevation; propagate the resolved application theme to every owned portal, while keeping Studio chrome separate. Preserve valid default pairings when no theme is supplied. Capability knowledge must distinguish target ownership metadata from actually editable parts and identify which properties/states affect which surface. Implement/test the contract across renderer, canonical editing and agent schema together; avoid private-selector overrides, body-wide theme changes or a shoes-specific CSS patch. Closing the popup cannot repair its colours.

### AR-17 - The observer cannot inspect the essential open state of the component being authored (P1, confirmed capability gap)

The turn's two successful observations at cursors#5 and#6 cover the closed header. They explicitly say interaction was not verified; the first identifies near-illegible white pills, the second identifies remaining capsule borders. After the final trigger edit, the third observation failed `STUDIO_CAPTURE_STALE` during revalidation with `changed:['rendered-controls']`; source cursor/bounds in those diagnostics match. This is evidence of a transient preview change, not proof of a renderer failure, bad source edit or a particular actor causing it.

The one bounded capture-only retry then failed `STUDIO_CAPTURE_PORTAL_UNSUPPORTED`, reason external-preview-portal, mode Interact. The existing [capture guard](../../apps/studio/src/lib/designer/visual-observation.ts) intentionally refuses visible preview-owned DOM outside its frame. The currently open menu has that ownership and is outside the capture frame. Refusal avoids a false image claim, but means the agent cannot verify the exact open-state output requested. Asking the owner to close the menu enables a closed-trigger capture only; it does not solve open-menu verification. No edit was rejected or replayed during this recovery.

Proposal: add governed observation of owned overlay composition, with trigger and popup together, computed styles/contrast and viewport/anchor/clipping facts. Whitelist the exact preview owner and permitted rendered subtree; exclude unrelated Studio menus, other documents and browser content. Keep source/runtime/geometry freshness fences and explicitly report partial coverage. A separate bounded interaction/preview-state contract is needed to verify open, keyboard focus, choose item, close, Escape, outside dismissal and nested popup behavior; do not silently turn screenshot permission into arbitrary click/action authority. Until supported, explain the open-state verification limit upfront rather than repeatedly changing unseen surfaces.

### AR-18 - Excess work and completion language do not establish useful navigation (P2, confirmed turn evidence)

Actual totals are19calls:3knowledge,8source,4edit and4observation attempts. All four edit batches succeeded; two were trigger-presentation cleanup. First acknowledged edit was about195seconds; the last source receipt was at461seconds, with55seconds tool-active and406seconds outside tools. These are overlapping host receipts and the last receipt precedes the final answer, not an exact full-turn duration. Outside-tool time includes generation/waiting/transport/host overhead, not isolated provider latency. Aggregate token counts include repeated input across requests; no monetary cost is known.

The agent requested the unused submenu contract and finished its continuation before editing. Host retained-knowledge evidence lists all three requested contract bodies complete with zero partial bodies; the continuation response's `complete:false` is not proof the agent failed to assemble earlier pages. Two `section:'nodes',nodeId:'navLinks'` requests repeat the ignored-scoping problem in AR-02. Men and Women were created in separate symmetric batches and then corrected twice after observing default trigger styling. This is useful recovery, but implementation-linked style knowledge and a bounded bundled read/change could reduce discovery and cleanup; no universal2-3-call total is promised.

Both menus have controlled boolean open/openChange bindings. Every menu item's `itemActivate` output is unbound: the source defines labels/values but no category navigation, filtering or action. The user did ask for dropdowns, so open/close may meet that narrower intent; it must not be described as complete working category navigation. The owner screenshot/current DOM demonstrates a menu open, not selection outcomes or keyboard/dismissal correctness. The model correctly discloses no interaction tools and the pinned panel limit, but opens with Done and then asks the user to close the very state that still needs verification. Its long receipt-heavy answer also repeats AR-05's communication problem.

Proposal: define the requested behavior before completion: disclose open/close-only versus category action, use supported state/action/navigation bindings where available, and explicitly flag unavailable behavior. Apply a reusable checklist for composed controls: trigger appearance, opened surface, normal/highlighted/focused/disabled items, useful selection outcome, dismissal and responsive positioning. Prefer small relevant contract bundles and scoped source reads, reuse current revision-bound facts, and normally author symmetric siblings together within existing atomic limits. Stop blind styling trials when the required part is unsupported. Finish with concise applied/verified/remaining statements; retain counts and technical recovery in turn-specific Chat details.

Resolution order for this class of failure: (1) truthful part/theming capabilities and resolved portal theme ownership; (2) owned-overlay observation plus explicitly authorized interaction verification; (3) outcome-aware authoring/closure and efficient discovery. Test dropdown, select/combobox, context menu, popover, tooltip, dialog and nested layers across independent light/dark authored themes, multiple simultaneous documents, widths, zoom and save/reopen. Include focus/hover/disabled contrast, clipping/stacking, stale captures and isolation of Studio's own overlays. Extend the same mechanism across components rather than maintain one bespoke theme fix per menu. These are proposals only; no repair or new gate verdict is claimed.

## Gallery and sale-popup follow-up - successful styling with remaining gaps

2026-10-27 owner asks whether the latest first-tab turn is fine and observes that its sale popup does match the theme. Clean local/remote baseline `1d18c6e0b1c71c8c50447b399aa7bfb96fc0af9a`; same branch/main/preview product. [Source subtrees,32call trace and notes](cycle-1-4/agent-output-review/gallery-sale-review.json). The popup was already closed when reviewed; no reviewer interaction, source change, Save, restart/reload or new provider call occurred. Its reported appearance is the owner's observation; the explanation below is confirmed by source/implementation, not a new reviewer screenshot of an open dialog.

### Positive counterexample - why this popup can match the theme

[CatalogDialog](../../packages/ui-svelte/src/catalog/components/CatalogDialog.svelte) places `presentation.target('root')` on the visible **Dialog.Content panel**, while its launcher is the secondary trigger target. `saleDialog.localStyle` supplies a dark panel background, light text, border, radius and shadow; its body contains individually styled lime/copy/code elements. Unlike dropdown root-on-trigger/content-secondary, the primary authored class therefore reaches the very popup surface the agent wants to style. Both use CatalogPortal: a portal does not inherently prevent theme styling. This narrows AR-16: the inconsistency is target meaning/addressability plus theme propagation, not that all popup surfaces are unreachable. Do not replace this successful dialog treatment with an unnecessary one-off repair. Document which physical surface each semantic part controls and support consistent explicit trigger/panel styling across component families.

### AR-19 - Recovery spends work on incorrect causes despite useful validation (P2, confirmed)

The actual32attempts contain13edit calls:9successful transactions and **4rejected edits**, plus1rejected contract continuation and1refused observation. The final response says5edit batches were corrected, conflating categories. Last visible metrics at call30 show first acknowledged edit at about580seconds and elapsed935seconds, including30seconds tool-active and905seconds outside tools. These precede the final two calls/answer and are not full-turn duration or isolated provider latency. The final tool Result is explicitly unavailable because the evidence budget was reached, so no exact final receipt metrics are claimed; current source order and the Chat status separately support9applied transactions.

The first rejected batch inserts `galleryHead` as kind element **without a tag**. The successful retry adds `tag:'div'`. The agent instead speculates that reading section/div details may be required before insertion and spends three catalogue/detail reads; reads do not unlock native insertion. The current handler returns the same broad `STUDIO_AGENT_ELEMENT` message for absent and unknown tags, without identifying the failing node/operation, contributing to misdiagnosis. Proposal: conditional schema/preflight for element insertion plus exact missing-field/node/operation diagnostics, and recovery explanations tied to the actual changed arguments.

Three more rejected batches omit panels, omit both required slots after a raw component insert, or add two triggers but one matching panel. The agent repeatedly describes staging/seed/atomicity as the obstacle. The complete matching trigger/panel sets are a real semantic rule and refusal correctly prevents partial invalid source; **multi-item construction in one valid batch is supported**. Raw insert does not supply recipe seeds. Proposal: expose compact valid composition examples and structural preflight, clearly distinguish raw insert from recipe add, and prepare a complete paired set before submission. Do not teach an invented requirement to build one slide per transaction. Contract continuation also initially omitted components and was correctly refused; exact continuation tokens/selection should be easier to carry forward.

### AR-20 - Requested behavior is substituted rather than completed (P1 first-visit gap; P2 carousel gap, confirmed)

The sale popup's boolean `saleOpen` starts true and is wired through openChange. That means opening on runtime initialization, not remembering a first visitor. No persisted seen/dismissed record, campaign identity or visitor-memory scope is present. The agent honestly says it will appear on every load, but this remains a missing requested behavior, not successful first-entry-only implementation. Its claim that dismissal lasts for a session is stronger than demonstrated: [DocumentHost](../../packages/ui-svelte/src/document/DocumentHost.svelte) manages local runtime state with explicit reset/reinitialization boundaries, not browser-session persistence. Proposal: define browser/session/visitor scope and reset/campaign policy, provide an explicit supported persistence capability at the appropriate app/host boundary, or clearly offer a demo-only alternative before treating the requirement as complete. Persistence should remain an explicit app-owned capability, separate from popup presentation.

The registered catalogue search found no carousel; the agent uses four controlled tabs/triggers/panels to switch slide tiles and discloses this choice. This is a reasonable supported fallback, **not equivalent to a carousel with previous/next, swipe/drag and carousel accessibility/slide semantics**. Those behaviors are not implemented by the tabs source. The owner may accept a tabbed gallery, but capability discovery and completion should name the substitute and its limits; a generic gallery/slide-navigation capability needs separately scoped implementation if true carousel behavior is expected. The grid is present in source, but narrow-width behavior was not exercised; no responsive-quality verdict is made. Example imagery/copy choices are outside this platform review.

### AR-21 - Open-state verification and quiet truthful closure remain incomplete (P2, confirmed)

One observation verifies the earlier visible tabbed-gallery appearance. The final popup/grid attempt refuses `STUDIO_CAPTURE_PORTAL_UNSUPPORTED` while the new dialog is open, repeating AR-17. The model discloses the missing visual and interaction checks, which is good, but then suggests closing the popup so it can capture the popup's styling: that would remove the state requiring verification. Source alone does not prove focus trapping, Escape/outside dismissal, slide switching, responsive layout or first-visit persistence. The source also introduces the dialog wrapper's automatic `Open First-visit deal inside` launcher at the end of the page; whether a persistent re-open control is wanted should be an intentional composition choice, not incidental recipe output.

Proposal: retain the successfully styled panel; resolve the existing owned-overlay observation/interaction gap, expose intentional launcher/on-entry options where supported, and report three distinct outcomes: applied source, observed appearance, exercised behavior. Public closure should concisely disclose the tabs substitute, absent visitor memory and unverified behaviors; accurate counts/rejections stay in Chat details. The existing safe atomic refusals and refusal to fabricate a popup screenshot should be preserved. This turn is a useful partially successful composition, not universal application completion, and does not close earlier theming/capability findings.

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

All AR-01 through AR-21 are **OPEN / REPORT ONLY**. No product fix, new capability, provider run, source save or preview restart was performed. Existing owner work is preserved. Validation for this documentation/evidence change is `git diff --check` and source-path/evidence checks; no product build or new product test run is warranted. Next allowed action: owner reviews/prioritizes this proposal and explicitly authorizes any bounded implementation; independent verification follows an actual candidate, not this report. No main merge, release, deployment, Stage9 closure or owner acceptance.
