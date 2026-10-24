# Cycle 1.3 core authoring — finding crosswalk

2026-10-24. **Baseline inventory and planned dispositions; no new repair or verification claim.**

The owner-authorized [core authoring round](CYCLE-1-3-CORE-AUTHORING.md) supersedes earlier report-only restrictions for its bounded core reliability, scalable knowledge and supported authoring scope. This crosswalk preserves the full [stress review](CYCLE-1-3-AGENT-STRESS-REVIEW.md), including later owner additions, and related independent findings. Historical repairs retain their exact evidence scope. They do not close later failures merely because the same subsystem previously passed.

## Identity and status rules

- Reviewed delivery: `f95e2cbe80f7afd421f8224634ebc0cecd61c827`; restored product: `a36793df0f62c002332d66db181310554aaabb05`.
- Architecture checkpoint at inventory entry: `bd9b75368f74697f40cf4616a3bc4d52e0387a7f`, isolated branch `codex/studio-cycle-1-3-core-authoring`. Its independent architecture challenge is pending at this writing.
- Main baseline remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. This report does not change main, owner documents, provider configuration, tabs or running previews.
- **OPEN / planned repair** means work and exact-candidate proof remain. **Historical repaired** identifies a prior scoped verdict only. **Demonstrated limitation** identifies actual unavailable or deliberately refused capability. **Later prerequisite/deferred** names its required stage. No entry below declares a new-round finding repaired.
- Original OR, PR, SU, SV, SD, CI and IV identifiers are preserved. ASR, SF, SR, CK, AU and UI-14 identifiers below are newly assigned crosswalk aliases for previously unnamed findings/requirements, not newly discovered defects. Related rows are cross-references, not additive defect counts.
- Final delivery must replace each planned disposition with repaired evidence, a demonstrated limitation, a named later prerequisite or explicit stage deferral. Missing proof remains missing.

## Later owner-run platform findings

Source: [owner-run platform behavior and turn efficiency](CYCLE-1-3-AGENT-STRESS-REVIEW.md#2026-10-24-owner-run-follow-up--platform-behavior-and-turn-efficiency). The reviewed real run had 254 reachable nodes, 47 state declarations, 78 catalog definitions and 36 acknowledged batches. Those counts establish source presence and useful progress, not full behavior or appearance.

| ID | Baseline evidence and concern | This round's proposed disposition / required proof |
| --- | --- | --- |
| OR-01 | Both actual observation attempts refused `STUDIO_CAPTURE_STALE`; no successful image assessment. Exact failed phase/fence not retained. | **OPEN / planned repair, CA-08.** Capture-time phase, revision, mode, visibility/geometry and changed-fence evidence; bounded observation-only recovery; actual fresh model observation and stale negatives. Preserve all freshness checks. |
| OR-02 | Canonical state supports `isoDate`, `isoTime`, `stringList`, `numberList`; agent `declareState` is scalar-only. Seven date/time controls lacked authored outputs after incompatible string-state attempts. | **OPEN / planned authoring parity, CA-05.** Exact canonical types and valid initial values, matching prop/output state, manual/agent/history/persistence proof. No coercion or new runtime semantics. |
| OR-03 | Final explanation claimed multi-value controls were unwired although source already had typed string/number-list prop/output bindings. | **OPEN / planned truthfulness repair, CA-09.** Source-grounded binding/completion facts; clearly distinguish exercised behavior. |
| OR-04 | Canonical refusal showed codes without target/path/property/expected/actual; final preparation reduced errors to five codes. | **OPEN / planned diagnostics repair, CA-09.** Bounded structured downstream compiler diagnostics, retaining authoritative detail and honest operation attribution. |
| OR-05 | Missing recipes/parts noticed late; inventory after batch35 still missed four parts, repaired by batch36. Final source was complete. | **OPEN / planned intermediate coverage, CA-09.** Successive source snapshots against explicit declared scope; do not convert agent-selected manifest into proof of user intent. |
| OR-06 | Engine completed but unresolved observation kept Studio failed; main status said an edit failed despite36 commits and repeated the applied boundary. | **OPEN / planned phase-specific status, CA-08/09.** Name failed tool/phase/code, retain confirmed revision/edits, offer observation-only continuation without replay. |
| OR-07 | Agent has read/edit/observe only, no runtime click/type/scroll/testing tools. | **Demonstrated limitation; separate governed contract prerequisite.** Independent real-browser testing is required now. No in-product interaction-testing claim or implicit new tool authority. |
| OR-08 | Transcript240 entries plus258 compacted;100 progress summaries; no full call/step/timing/usage rollup. | **OPEN / planned bounded metrics, CA-09.** Aggregate actual calls/results/retries/timings and available usage across compaction. Model steps/cost remain unavailable unless observed. |
| OR-09 | Some controls received external and component-owned labels;14 unreferenced declarations included inherited/demo/superseded state. | **OPEN / shared label semantics, CA-02/06; retained legal-state observation.** Label ownership guidance/checks. Safe unused-state reporting; automatic deletion requires provenance/ownership rules and is not assumed. |
| OR-10 | Three sibling menus all `value:"file"`; all opened together. Unique node IDs/labels did not provide unique menu identities. | **OPEN / planned shared semantic repair, CA-02/06.** Sibling uniqueness, paired identities, correct menu-open state semantics, repeated insertion and browser keyboard behavior; preserve saved documents. |
| OR-11 | Agent advertises heading1–6; active default semantic catalogue admits h1–h4, refuses h5/h6. | **OPEN / truthful supported headings, CA-05.** Reconcile active catalogue and advertised operations through valid existing semantics, then validator/render/browser proof. Do not silently alter canonical defaults. |
| OR-12 | Text recipe describes state-bound text; agent exposes literal text and component-only bind, not canonical native text references. | **OPEN / planned native text reference parity, CA-05.** Shared canonical path, typed references, rendering/state update/history/reopen. No script evaluation. |
| OR-13 | Recipe-only, eight operation kinds, three tools, one route/demo action cannot establish whole-spectrum autonomous application delivery. | **OPEN / supported UI exposure this round, CA-05/06.** General supported registered insertion reduces the UI ceiling. Product contracts/effects and arbitrary complete apps remain **Milestone2**, after required1.4 and Milestone1 acceptance. |
| OR-14 | VICT has routes/screens; Studio wraps each saved document as one-screen application; Designer notice/Run no-op navigation; agent has no page/route operations. | **Demonstrated Studio limitation; Milestone2 application-building prerequisite.** Record connected routing, state, URL/history/draft/Save boundaries. No multipage claim from separate screens/tabs/dialogs. |

## Later painting-run findings

Source: [painting-run process review](CYCLE-1-3-AGENT-STRESS-REVIEW.md#painting-run-process-review--2026-10-24), retained aggregate [evidence](cycle-1-3/owner-review-2026-10-24/painting-run-review.json). Fifteen calls produced48 phase cards; six of seven edit attempts committed. One read refusal and one preparation refusal recovered; observation alone remained unresolved. No proved auth, timeout or step-limit failure.

| ID | Baseline evidence and concern | This round's proposed disposition / required proof |
| --- | --- | --- |
| PR-01 | `STUDIO_CAPTURE_NOT_VISIBLE` before image inference; historical transient frame state unknown. Current later-visible geometry is not capture-time proof. | **OPEN / planned CA-08**, linked OR-01; retain distinct refusal code and cause evidence, do not blame provider vision. |
| PR-02 | Status says edit failure despite six confirmed edits and engine `completed`. | **OPEN / planned CA-08/09**, linked OR-06; preserve edit boundary and observation-specific recovery. |
| PR-03 | Component lookup searches catalog descriptors only; native/layout recipes have no same detail path. Refusal omits requested identifier. | **OPEN / planned truthful knowledge, CA-02/03.** Uniform registration kind/detail availability, exact lookup identifiers and bounded selected contracts. |
| PR-04 | Insert index2 out of range plus cascading style-target errors misexplained as unsupported multilevel same-batch nesting. Full rejected arguments unavailable. | **OPEN / planned diagnostic/source-recovery CA-09**, linked OR-04; identify invalid position/parent and cascading failures. Preserve supported sequential preparation. |
| PR-05 | Fifteen calls rendered as48 separate lifecycle cards and repeated generic progress, no timings. | **OPEN / planned grouped attempts/metrics CA-09**, linked OR-08. One actual attempt with expandable ordered lifecycle/receipts; retain failed attempts and chronological prose. |
| PR-06 | Three inputs have independent source state/labels, but reviewer did not type into them; hero CTA/Send have no output binding. No backend submission promised. | **Demonstrated evidence limit; CA-10 independent journeys.** Distinguish source wiring, actual interaction, requested local CTA behavior and out-of-scope backend. No automatic classification of every unbound demonstration control as defective. |
| PR-07 |12 declarations for42 nodes; three superseded `input_*` defaults plus inherited defaults unused. | **Retained legal-source observation**, linked OR-09. Provenance-aware reuse/cleanup needs explicit ownership rules; no blanket state removal. |

## Original stress findings and continued diagnosis

These ASR/SF aliases preserve the original numbered list and later previously unnamed follow-up. Prior [completion report](CYCLE-1-3-COMPLETION-REPORT.md) and [independent verdict](CYCLE-1-3-COMPLETION-INDEPENDENT.md) identify what was repaired at product `be893f29d44f595a8d9982575c2199636df69597`. Later Structure-only changes do not repair later agent-run findings.

| Alias | Original evidence / correction | Baseline disposition and new-round treatment |
| --- | --- | --- |
| ASR-01 | Full screen/palette/catalog reads exceeded4096 delivery values; nodes record also conflicts with128-property bound at accepted500 nodes. | **Historical repaired:** bounded overview/targeted/lossless source/state/registry pages, unchanged snapshot guards; independently checked500 nodes/200000 characters. Preserve scale regressions; CK discovery improvements remain open. |
| ASR-02 | Accepted source lacked intended input/boolean/list/date wiring; compile success mistaken for behavior. | Native independent input/boolean wiring **historically repaired**; OR-02/03/PR-06 remain open distinctions. |
| ASR-03 | Generic provider binding/expression schemas and poor validation led to wrong assumptions/workarounds. | Closed schema/Zod/union diagnostics **historically repaired**; downstream compiler projection remains OR-04/PR-04. |
| ASR-04 | Preproposal refusals missing; only recent8 progress items; completed proposal cards obscured failed attempts/resume boundary. | Ordered public timeline/attempt identity and outcome retention **historically repaired**; lifecycle card grouping/status/metrics remain PR-02/05 and OR-06/08. |
| ASR-05 | Seed content appended; overlay trigger buttons nested; heading hierarchy weak. | Shared untouched-placeholder replacement, new-authoring interactive guard and intentional heading evidence **historically repaired**. Preserve legacy compatibility; OR-11 is a later active-catalog mismatch. |
| ASR-06 | Long-turn completion/continuation under-proven;24steps/32tools then;100000 response versus first6000 history loses tail; exact limit not established. | Tail/boundary retention,64step/tool policy, source-aware continuation and distinct termination **historically repaired**, with synthetic/genuine proof scopes retained. Metrics and later truthfulness remain open. |
| ASR-07 | Extremely low local disk and repeated `derived_inert` warnings. | **Operational concern / retained warnings**, not proved cause of agent failure. Check headroom before heavy work; preserve owner data/evidence; no speculative warning-causality claim. |
| SF-01 | Native input demo binding intentionally stripped but palette falsely claimed connected; native wiring could not be reauthored. | **Historically repaired:** independent typed native wiring and accurate descriptions; preserve independent-field rule. |
| SF-02 | Blanket same-batch add/connect explanation disproved by compatible checkbox and declared button-action probes. | **Demonstrated supported behavior**, preserve tests; not a defect requiring batch splitting. |
| SF-03 | Void press payload cannot directly set boolean even with explicit literal mapping; raw boolean also fails expression schema. | **Demonstrated canonical type limitation.** Preserve no-coercion boundary; any new event-mapping semantics require exact amendment. |
| SF-04 | Switch literal checked plus output to agreement compiles; output alone does not create matching controlled reference/independent state. | Independent wiring **historically repaired**; shared semantic knowledge/control-pair checks planned CA-02/06. |
| SF-05 | Select custom item leaves default First/Second; overlay copy similarly retained. | **Historical repaired placeholder replacement**, explicit append remains available; final custom composition still needs inventory. |
| SF-06 | Original owner source26/78 catalog definitions;52 absent; complete hand gallery did not complete agent page. | Equivalent all83/78-definition source fixture **historically demonstrated**; representative interactions only. OR-05 intermediate intent/coverage remains open. |
| SF-07 | Three real nested button pairs; four section h1s; behavioral consequences not fully exercised originally. | Nested-authoring guard/focus journeys and intentional hierarchy **historically repaired**; no retrospective claim of unexecuted old interactions. |
| SF-08 | Reconnect refreshes config/CSRF, cannot cure deterministic oversized read; unresolved read persists after successful writes. | Read cause **historically repaired**; preserve per-tool unresolved boundary; phase-specific wording/recovery remains OR-06. |
| SF-09 | Individually allowed document/history/prompt exceed aggregate256000 UTF-8 bytes; HTTP rejection appears as connection problem. | **Historical repaired:** shared1200000-byte admission, structured errors and actual HTTP exact/+1/wrong-CSRF proof. Preserve bounds, not unlimited transport. |
| SF-10 | Server stream/client buffer bounds produce generic interruption feedback. | **Historical repaired:** shared bounded transport and structured feedback. Retain deterministic admission/stream regression cases. |
| SF-11 | Last edit/unresolved status masks underlying engine outcome; short/ephemeral trace prevents exact historical call inventory. | Underlying termination now retained **historically repaired**; old missing arguments/order/step/provider/storage evidence is a **permanent historical limitation**, not facts to reconstruct speculatively. |
| SF-12 | Actual rendered visual feedback missing; screenshot cannot share oversized JSON read path or prove behavior. | Separate binary bounded observation **historically implemented/demonstrated**; OR-01/PR-01 reopen reliability, not absence of all capture functionality. |
| SF-13 | Tool block above prose loses true interleaving; owner asks actual observations and thinking/progress visibility. | Ordered public events **historically repaired**; grouping refined by PR-05. Show truthful observations and concise public summaries, never private chain of thought or fabricated reasoning stream. |

## Original Structure review and useful-data expectations

Source: [Structure usability](CYCLE-1-3-AGENT-STRESS-REVIEW.md#structure-usability-and-whole-app-coherence-review---owner-request) and [node/layout direction](CYCLE-1-3-AGENT-STRESS-REVIEW.md#owner-direction---nodes-layout-maturity-and-useful-structure-data). SR identifiers are aliases, not new defects. Prior scoped completion/correction/drawer verdicts cover improvements; full large-scale accessibility/performance and unsupported richer features remain distinct.

| Alias | Original finding | Baseline disposition / boundary |
| --- | --- | --- |
| SR-01 |125-node/172-edge graph unreadable at0.1zoom, fit exceeds viewport. | **Historical scoped repaired:** containment-first collapse/focus and measured layout. Fit overview is navigation, detail still needs focus/zoom. |
| SR-02 | Flat references/text/catalog/state/action clutter; no filters/search/collapse. | **Historical repaired:** relationship layers/search/focus/collapse. Full technical projection remains available. |
| SR-03 | Source selection lacks editor/detail handoff. | **Historical repaired:** explicit facts/editor/Locate handoffs; ordinary selection preserves camera. |
| SR-04 | Reference state/action/catalog cannot reach existing editors. | **Historical repaired:** precise facts and Data/Actions/component handoffs within supported targets. |
| SR-05 | Edges omit originating prop/output and exact binding details. | **Historical repaired:** precise declared-source relationships. Automatic missing-binding diagnosis remains unavailable. |
| SR-06 | Dark surface/raw IDs/names diverge from Studio. | **Historical repaired:** friendly category cards/theme/control hierarchy; IDs secondary. No broad general-catalog standardization claim. |
| SR-07 | Generic handles imply arbitrary wiring; move gesture conflicts with containment arrows. | **Historical repaired:** explicit guarded containment moves and inspect-only relationships. No workflow execution semantics. |
| SR-08 | Structure mode resets Interact and loses graph state on unmount. | **Historical repaired:** preserved runtime/graph context, then Structure placed in Document beside mounted canvas. |
| SR-09 | Global selection, inspection focus and stale notices disagree; dropdown does not locate target. | **Historical repaired:** deliberate inspection/Find/Frame and selection synchrony. Explicit navigation remains separate from ordinary selection. |
| SR-10 | Technical accessibility names/generic handles and126-option navigator; keyboard/performance not fully exercised. | **Historical scoped repaired:** meaningful names/search/keyboard journeys. **Demonstrated verification limit:** no universal accessibility/native-device/500-node browser performance certification. |
| SR-11 | Grid-only auto placement ignores measured dimensions/routing/groups; smoothstep is not a layout engine. | **Historical repaired:** measured ELK through120 visible nodes, Dagre fallback above120, stale result fences/orientation. Exact engine/browser scopes retained. |
| SR-12 | Need actual semantic group/subflow behavior rather than importing examples. | Collapse/focus groups **historically implemented**; draggable compound `parentId` frames remain **explicit limitation**, future separately scoped presentation work, not silently promised. |
| SR-13 | Structure should diagnose value/output coupling, show users/slots and return to same editor/runtime context. | Declared relationship facts/handoffs **historically implemented**. Runtime values/action execution, automatic missing-binding diagnosis and general impact analysis remain **explicit limitations**. |
| SR-14 | Structure should relate agent history/receipts to changed nodes/requested coverage. | **Explicit limitation:** no agent-change overlay. Core round improves transcript/coverage provenance, not a new Structure overlay. Reassess in integrated1.4 planning if required. |

### Later scoped Structure findings and rejected attempt

Sources: [correction report](CYCLE-1-3-STRUCTURE-CORRECTIONS.md), [independent correction verdict](CYCLE-1-3-STRUCTURE-CORRECTIONS-INDEPENDENT.md), [drawer report](CYCLE-1-3-STRUCTURE-DRAWER.md), [independent drawer verdict](CYCLE-1-3-STRUCTURE-DRAWER-INDEPENDENT.md), [reverted attempt](CYCLE-1-3-CONTEXT-INSPECTOR.md) and [failed independent challenge](CYCLE-1-3-CONTEXT-INSPECTOR-INDEPENDENT.md).

| ID | Concern | Baseline disposition |
| --- | --- | --- |
| SU-01 | Work area loses priority to rows/details. | **Historical repaired** at dabbe; preserved by a367 drawer. |
| SU-02 | Capabilities have overlapping command homes. | **Historical repaired:** View/Object/one primary Fit/existing editors. |
| SU-03 | Selection changes camera/filters. | **Historical repaired:** ordinary selection stable, explicit Find/Frame. |
| SU-04 | Disclosure/dismissal incomplete. | **Historical repaired:** deliberate inspection pages/close/Escape/focus. |
| SU-05 | Group/move commands separated from objects. | **Historical repaired:** node-local disclosure/contextual guarded Move. |
| SU-06 | Node information repeats/overexposes implementation. | **Historical repaired:** concise labels/literal projection/exact detail. |
| SU-07 | Different control language and unstable mode organization. | **Historical repaired**, later home amended to Document; current canvas modes Design/Interact. |
| SU-08 | Density and keyboard/small-window bounds. | **Historical scoped repaired**, not global accessibility certification. |
| SV-01 | Enter selection disagrees with shared source/details. | **Historical repaired and independently reverified.** |
| SV-02 | Default Chat plus graph minimum clips details at640x480. | **Historical repaired and independently reverified.** |
| SV-03 | Upstream Escape deselects graph before dock closes. | **Historical repaired and independently reverified.** |
| SD-01 | Stacked Expand collapses graph. | **Historical repaired**, final a367 independent PASS. |
| SD-02 | Hidden-source Locate in Interact changes composition without revealing content. | **Historical repaired:** refuse before transition, preserve runtime. |
| SD-03 | Showcase Expand confined to grid cell, later reveal entirely offscreen. | **Historical repaired:** spans workbench, deliberate reveal/Restore scroll. |
| SD-04 | Covered graph remains keyboard reachable. | **Historical repaired:** inert covered graph, restored access on close. |
| CI-01 | Rejected context-trigger styles collapse graph to0px. | **REVERTED / NOT ACCEPTED**, not current source and not a finally verified repair. Retain failure for1.4 regression design. |
| CI-02 | First right-click on new target opens floating tools and loses menu. | **REVERTED / NOT ACCEPTED**, same boundary. Real pointer sequence required in1.4; contextmenu-only simulation was insufficient. |

Final correction product: `dabbe9027e335bab1a405f4a808711d93623b3c5`; final drawer product: `a36793df0f62c002332d66db181310554aaabb05`. CI product attempts `ac8b696e048658f163b909eb292827c160d20a79` and `9421543071d604c4c9d5df27ea8150e96c7a76dc` were history-preservingly reverted. Preserve canvas floating tools; no corrected panel implementation is authorized in this core round.

## Related completion-verifier findings

These exact IDs and failures remain in the [independent completion report](CYCLE-1-3-COMPLETION-INDEPENDENT.md#failure-to-repair-closure). Their prior repaired status is not new-round verification.

| ID / alias | Retained challenge | Baseline disposition / regression to preserve |
| --- | --- | --- |
| IV-C1 | External portals omitted; matching metadata but changed JPEG could pass. | **Historical repaired:** explicit portal refusal, second capture and SHA256 equality. Open portal appearance remains unsupported; close/fresh retry demonstrated. |
| IV-C2 | Typed native number/checkbox same-batch authoring challenge. | **PASS / no defect established.** Preserve correct typing; actual native-checkbox browser proof was manual, not provider-attributed. |
| IV-C3 | Nested interactive wrapper accepted then inner content silently lost. | **Historical repaired:** new-authoring guard, legacy compatibility, actual refusal/correction and focus journeys. |
| IV-C4 | Stop while capture never settles leaves composer busy. | **Historical repaired:** abort/deadline race and late-upload fence. |
| IV-C5 | Long local-state value cannot be reconstructed losslessly. | **Historical repaired:** bounded stateKey JSON pages. |
| IV-C6 | JSON Schema broader than Zod; mixed lists/extra expression fields and vague union errors. | **Historical repaired:** exact closed schemas and expected-shape diagnostics. |
| IV-C7 | New test implicit-any breaks Studio TypeScript. | **Historical repaired:** annotations and actual Studio check. |
| Builder-D1 | Deadline mislabeled as user Stop. | **Historical repaired:** distinct cancellation reason/termination. |
| Builder-D2 | Requested subset coverage labeled global. | **Historical repaired:** explicit manifest scope. OR-05 intent gap still open. |
| SF-15 | Actual oversize HTTP request destroys socket despite direct-handler PASS. | **Historical repaired:** discard excess bytes and structured real HTTP413. Distinguish handler simulation from actual host proof. |
| SF-16 | Flow orientation changes DOM handles but cached endpoints retain previous side. | **Historical repaired:** refresh internals after DOM update, actual measured endpoints. |
| SF-17 | Hidden empty-src Avatar image breaks large-gallery raster. | **Historical narrowly repaired:** omit only HTML images with display:none on self/ancestor. Preserve visible/broken/zero-size/opacity/visibility-hidden/SVG cases. |

## Knowledge, authoring breadth and professional-readiness concerns

These CK/AU aliases collect all later unnumbered owner additions and recipe/guidance audit areas. They are requirements and risks with evidence scopes, not a claim every component is broken.

| ID | Baseline evidence / expectation | Proposed disposition |
| --- | --- | --- |
| CK-01 | Hundreds of growing components risk separately maintained descriptors/recipes/prompts/examples drifting. | **OPEN / planned CA-02/04:** package-owned companion to existing descriptor/ABI; one derived path, explicit authored semantic guidance. |
| CK-02 |83-recipe catalogue needs at least5 maximum-size palette pages plus one-component details; native detail lookup uneven. | **OPEN / planned CA-03:** compact family/category/query index, bounded selected contract/dependency bundles. No guaranteed2-3 calls or latency saving. |
| CK-03 | Static knowledge reuse lacks explicit contract versions/digests/selective invalidation. | **OPEN / planned CA-03:** exact provenance/digests/unchanged markers; never cache away current source/revision/selection fences. |
| CK-04 | Eligible exports can be omitted, stale schemas/examples advertised without full support. | **OPEN / planned CA-04:** registration/renderer/schema/example/placement checks, explicit helper/unsupported exclusions, add/change maintenance demonstration. |
| CK-05 | Identity uniqueness/pairing, label ownership, controlled mode, host dependencies cannot be inferred from types. | **OPEN / planned CA-02/06**, linked OR-09/10. Author once with package contract; reusable validation/composition rules. |
| AU-01 | Flow family is used internally by Structure but absent from agent-authorable palette/contracts. | **OPEN / planned CA-07:** supported authored Flow composition discovery/insertion/configuration/render/interaction/history/reopen. No workflow execution authority. |
| AU-02 | AI/chat family is used internally by AgentChat but absent from authored screens. | **OPEN / planned CA-07:** supported authored presentation and typed interactions; no implicit provider/backend/subagent/shell authority. |
| AU-03 | Mandatory recipe enum caps native semantic elements and supported registered components. | **OPEN / planned CA-06:** general bounded insertion/composition over existing supported canonical path; recipes remain accelerators. |
| AU-04 | Agent base style text is narrower than canonical tokens/style sources/conditions/pseudo states and manual supported editor. | **OPEN / planned CA-05:** reviewed supported styling parity with actual validation/responsive/state behavior. Basic fluid CSS already exists; do not claim no responsive support. |
| AU-05 | Label/name defaults, repeated parts, ambient busy state and error/empty/loading expectations are not full professional composition contracts. | Shared semantics/dependencies **planned CA-02/06**; realistic representative CA-10 journeys. No arbitrary backend behavior or blanket accessibility claims. |
| AU-06 |83 isolated recipe compilations/counts do not prove repeated-instance, responsive, focus, keyboard, portal, state and persistence quality. | **OPEN / CA-06/10/11 proof matrix.** Independent composed journeys; distinguish simulations, carried evidence and missing demonstrations. |
| AU-07 | Optional patterns may help but can constrain whole-spectrum output if treated as only valid designs. | **Architecture requirement:** exact invariants versus optional examples; general authoring and correct information, not domain-by-domain prompt patches. No controlled experiment proves example prompt caused old failures. |
| AU-08 | Broad autonomous professional-designer quality across arbitrary apps is not demonstrated. | **Explicit limitation**, not aesthetic impossibility. Core foundation and representative proof now; integrated1.4 and later governed application scope remain required. |

The recipe audit also identifies repeats, conditionals, reusable definitions and assets outside the current agent vocabulary. This round's general insertion does not automatically establish complete authoring of those registries. Any remaining unsupported path must be stated as a demonstrated limit or named later prerequisite; no arbitrary scripts/object-JSON escape hatch. Full asset pipelines and product resources/views/actions/workflows are not inferred from presentation metadata.

## Required Cycle 1.4 scope and milestone boundary

| ID | Owner requirement | Disposition in this round |
| --- | --- | --- |
| UI-14-01 | Coherent mature general UI family, beyond AI-only shadcn patterns. | **Required Cycle1.4:** prepare pinned upstream/general/specialist audit, plan, compatibility treatment and explicit exceptions. Broad presentation migration follows core. |
| UI-14-02 | Contextual right-click commands on objects/empty canvas. | **Required Cycle1.4:** define target selection, keyboard invocation, dismissal, native/Interact preservation; retain CI failures. Do not implement reverted attempt now. |
| UI-14-03 | Shared inspection facts/properties/relationships beneath Layers and Structure, adequately spacious. | **Required Cycle1.4:** canvas remains mounted and floating editing tools remain. Corrected scope explicitly excludes relocated editing controls. |
| UI-14-04 | Founder-and-agent integrated experience and owner's own hands-on review. | **Required before Milestone1 acceptance:** realistic integrated journeys, visible review preview and independent verification; owner alone accepts. |

These are committed roadmap requirements before Milestone2 unless the owner changes the plan. This core round prepares their concrete handoff. No main merge, publication, deployment, owner acceptance, Stage9 closure or Milestone2 work follows from this report.

## Reliability implementation ownership and bounded plan

Root-owned product paths are `agent-edits.ts`, `application.ts`, `recipes.ts`, `placement.ts` and `agent-reads.ts`; this inventory makes no changes there. Planned reliability ownership is server `designer-agent*.ts`, `designer-model.ts`, `designer-visual.ts`, `AgentChat.svelte`, `visual-observation.ts`, public capture helper and the affected public conversation timeline/tests. Coordinate shared event/diagnostic shape before editing; do not overwrite concurrent root changes.

1. Extend capture failure receipts with bounded enumerated phase/reason and safe capture-time geometry/visibility/mode/cursor evidence; preserve raster/freshness/portal/pixel fences. Carry structured browser refusals through authenticated upload instead of discarding detail.
2. Retain per-tool last failure and source boundary in terminal public events. Status and continuation identify observation versus edit failure. Retry observation only with a fresh source boundary and bounded recovery; never replay confirmed writes.
3. Correlate governed call IDs with browser proposals/receipts, grouping ordered lifecycle stages beneath their attempt while preserving chronological prose, refusals and compaction.
4. Aggregate real tool/result counts, bounded timings, explicit recovery attempts and provider usage where actually supplied. Canonical `usage.updated` exists but Studio currently ignores it. The adapter can normalize absent token fields to0: absence must not be reported as measured zero. Tool calls and provider requests are not canonical model-step counts. No estimated monetary cost.
5. Coordinate root's bounded downstream diagnostic projection and intermediate coverage snapshots. Source presence and agent-declared manifest remain weaker than user intent, appearance and interaction evidence.
6. Extend affected tests for the meaningful failure/recovery/grouping/compaction boundaries, then real provider recovery/continuation and independent browser observation/interaction/history/persistence on an exact committed candidate. Record missing proof honestly.

Source entry points: `packages/ui-ai-svelte/src/capture.ts`; `apps/studio/src/lib/designer/visual-observation.ts`; `apps/studio/src/lib/server/designer-visual.ts`; `apps/studio/src/lib/server/designer-agent.ts`; `apps/studio/src/lib/server/designer-model.ts`; `apps/studio/src/lib/designer/AgentChat.svelte`; `packages/ui-ai-svelte/src/adapters.ts`; `packages/ui-ai-svelte/src/Conversation.svelte`; `packages/contracts/src/agent-stream.ts`; `packages/mastra/src/adapter.ts`; `packages/ui/src/diagnostics.ts` and canonical compiler detail fields.

**Inventory entry status: architecture challenge pending; no product implementation or new finding closure.**
