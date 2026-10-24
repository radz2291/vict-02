# Structure corrections — independent verification

2026-10-24. Independent verifier, fresh context, no participation in implementation. **Final scoped verdict: PASS — READY FOR OWNER REVIEW**, exact product candidate `dabbe9027e335bab1a405f4a808711d93623b3c5`. Earlier FAIL observations and repair lineage are preserved below. This verdict covers the authorized Structure presentation corrections only.

## Identity and scope

Reviewed exact pushed candidate `130485027d2b999a7458a7424ef8c083b352c348`, branch `codex/studio-cycle-1-3-completion`, main pinned `d7401bef6e48330796c74ec00c86db9622d48cdf`. Entry tree was clean and `git ls-remote` independently matched both SHAs. Authority is the owner's “Can you fix those now?” against SU-01–SU-08 and the supplied thirteen UI preferences, bounded by [the correction handoff](CYCLE-1-3-STRUCTURE-CORRECTIONS.md). Other OR findings remain open/report-only. This does not close Stage 9 or record owner acceptance.

Read root instructions, current canonical/Stage 9 routing, UI-foundation routing, correction handoff, preference file and SU review. Audited the exact diff and surrounding Structure projection, Designer handoff, canonical move path, Flow wrapper, navigation and upstream keyboard selection code. No product source was edited by this verifier.

## Retained initial failures

1. **SV-01 / P1 — keyboard graph selection and inspection disagree.** In the isolated production preview, created a new nine-node source fixture through File → New screen and the canonical Source editor. Pressing Enter on `Element: Right group, source right` changed the graph's selected DOM node to the exact encoded source tuple for `right`. Opening Inspect still showed `Screen`, source `screen`, and its facts. The screenshot visibly showed Right group outlined beside Screen inspection. Structure only synchronized `inspectedId` and shared host selection from `onnodeclick`; upstream Enter/Space calls `handleNodeSelection` without that callback. Contextual inspection/editing can consequently act on the previously selected source. Pointer selection and Find did synchronize correctly. This is a required keyboard/shared-selection gap, not evidence of source corruption.
2. **SV-02 / P1 — low available height clips inspection.** At 640 × 480 with the existing default Chat visible, Structure measured 123.9px high; its 43.8px toolbar left 80.1px for the body. The graph's 140px minimum placed inspection at y486.6, outside the viewport, inside a body with hidden overflow. Inspect reported expanded while the dock and its Close command were clipped. At 800 × 600, graph and dock fitted. At 640 × 480 after explicitly using existing View → Hide chat, graph was 168.5px and dock 132.4px with bounded facts scrolling; its Close and page controls were visible. The correction must account for available height; this finding does not authorize automatically hiding Chat.

The builder was notified promptly of both failures. Initial candidate is not ready for owner review on these criteria.

## Independently reproduced checks

- `vitest run tests/structure.test.ts tests/structure-presentation.test.ts tests/ui/structure.test.ts`: **14 tests PASS**, including real Structure component/menu rendering, draft refusal, deliberate inspection, state handoff, guarded move, exact compact projection and canonical history checks. An initial command also named two nonexistent filename filters; those matched no files and are not counted.
- Separate orientation/composition run: **orientation 1 test PASS**, then V8 terminated with `Fatal process out of memory: Zone` during the full Designer composition transform. Exit 1 is retained; composition is **NOT DEMONSTRATED by this verifier**, not passed. Existing source compiler warnings and shortcut-trigger warnings were observed. No tests were changed or weakened. Further heavy checks paused while the builder completed its isolated build.
- `git diff --check`: PASS at the initial clean candidate.

Production browser review used a NEW disposable IAB tab at `http://127.0.0.5:5599/design`, served from the builder's detached production-build checkout at exact initial candidate. Original owner server `127.0.0.3:5596`, owner tabs/documents, provider configuration and models were untouched. No model call was made. The verifier's fixture `Independent Structure verification` (`screen-9b221b8a-ed7c-4a1d-8591-d390825389b5`) was created, edited and saved only on the isolated preview origin. Its source has two section containers, a literal heading, a dynamic text reference and two standalone text leaves.

Actual production interactions, distinct from the source audit:

| Check | Initial result and evidence |
| --- | --- |
| Compact command ownership | PASS: one Fit View control, compact toolbar, shared View/Object menus; inspection initially closed. |
| Ordinary pointer selection | PASS: exact viewport transform remained `translate(33.9211px, 91.9474px) scale(0.756579)` before/after selecting Left group; `group` search retained; inspection stayed closed. |
| Node disclosure | PASS: Left group collapse reduced visible nodes 8 → 3; expand restored 8. |
| Compact/exact projection | PASS: redundant heading literal leaf initially omitted; dynamic text retained. Find explicitly revealed `title-text`, with exact source ID and literal content in Properties. |
| Contextual Move and Undo | PASS: Find selected `copy`; Object → Move inside → Right group updated edge source to `right.contains.0`. Shared Edit → Undo returned `left.contains.2`; subsequent Source JSON was exactly equal to the pre-move fixture and application identity returned to its pre-move value. |
| Inspection dismissal | PASS: Escape closed dock and restored focus to `Inspect structure`; selection remained available. |
| Mode continuity | PASS: Design → Interact → Structure retained Structure focus scope and source selection. |
| Unapplied source draft | PASS: appending whitespace in Source produced an unapplied JSON draft; Design transition refused with `Apply or cancel your draft first`; Structure remained active and draft text retained. Draft was explicitly discarded in this disposable fixture. |
| Keyboard graph/shared selection | FAIL: SV-01. Exact transform unchanged in tested cases; no separate keyboard camera defect demonstrated. |
| Smaller windows | FAIL with default Chat at 640 × 480: SV-02. PASS bounds at 800 × 600 and at 640 × 480 after explicit Hide chat. Temporary viewport override reset. |

## Architectural assessment and limits

The candidate stays within presentation/interaction scope. Compact projection filters redundant literal leaves without mutating canonical source; dynamic text and binding edges remain represented. Node presentation retains source IDs/occurrences and full facts. Contextual moves still pass through `structureMove`, compatible parent/slot checks, document/revision and draft checks, then the existing EditorBridge transaction/history path. Graph dragging remains presentation position, not reparenting. Existing effect/data/application semantics are unchanged.

This is focused Structure verification, not a general accessibility certification, broad agent-reliability verdict or acceptance of other report findings. Initial verdict remains FAIL pending a new exact candidate and affected challenge.

## First repair challenge

Independently matched clean local and remote branch to `a8cddea20ca15b3ae05f8140b4c5e65fe258b421`; main remained pinned. Audited the narrow repair diff. The builder rebuilt the isolated production preview at this exact SHA; reloaded only the verifier's disposable tab, signed in again and used the same saved fixture. **SV-01 and SV-02 remedied; this candidate still FAIL on SV-03 below.**

- Enter on Right group and Space on Left group now synchronized a single visual selection and exact inspection source (`right` / `left`). Camera remained exactly `translate(24px, 24px) scale(0.85)`. Inspection opened only deliberately.
- Enter on nested Expand Left group disclosed 3 → 8 nodes without changing inspected source; the wrapper-only handler did not treat the disclosure button as a new source selection.
- Find → Agreement displayed state `accepted`; Find → Customer settings text displayed exact `title-text`. No delayed selection overwrite occurred. The builder reports an intermediate generic `onselectionchange` attempt was rejected because delayed programmatic callbacks overwrote Find/state selection; it is **retained as a builder-observed rejected attempt**, not an independently executed verifier failure, and is absent from this repaired candidate.
- At 640 × 480 with Chat visible, Chat occupied 192px width and the workspace 448px. The graph measured 168.5px high; the dock 132.4px, wholly within the viewport; facts had 52.8px bounded scrolling. Design, Interact and Structure each retained identical workspace bounds `{x:192,y:44,width:448,height:412}`. No automatic Chat hiding occurred. SV-02 PASS.
- Rechecked Source draft retention and refused Design transition; draft remained exact. Explicitly discarded the disposable draft. Temporary viewport override reset.

**SV-03 / P1 — graph-focused Escape desynchronizes dismissal and selection.** With Left group selected and inspection open, focused its graph node wrapper and pressed Escape. The dock closed and focus returned to Inspect, but upstream also cleared visual graph selection (`.svelte-flow__node.selected` count 0). Reopening Inspect still showed Left group / `left`; shared inspection retained the source while the graph indicated none. This differs from the passing Escape-from-inspection case. The builder was notified promptly and is preparing a bounded wrapper-Escape repair plus regression. No source/document corruption was observed.

## Escape repair and larger-source challenge

Independently matched clean local and remote branch to `254b9092ac92662239b7b4eaadb5ef9ac8121b95`; main remained pinned. Audited capture-phase wrapper-Escape handling and the regression. Reloaded only the disposable preview tab after the builder's exact production rebuild. **SV-03 remedied at this SHA.**

The preview-origin builder fixture `Structure workspace` (56 source nodes, five groups; expressly authorized for read-only verification) was active after reload. Enter selected its Review group, exact source `group-4`. With inspection open, graph-focused Escape closed the dock and focused Inspect while retaining the visual selection and exact `group-4` inspection identity. After explicitly closing the dock, another graph-focused Escape cleared the visual selection and canonical inspection together: Inspect reopened Find with no selected source and no Object menu. The two dismissal intents are coherent.

Explicit visual navigation was additionally challenged against the final Review group's last literal text `group-4-paragraph-4-text`. After layout status settled, Find displayed the selected `Next steps 5` node inside the graph: node rectangle `{x:516.8,y:354.5,width:246.4,height:83.6}` intersected graph rectangle `{x:320,y:125.8,width:640,height:540.9}`. A settled screenshot visibly showed the selected node. Show whole screen → View → Frame selection independently returned it to that visible rectangle. Initial intermediate screenshot showed `Arranging source…`; only the settled observation is counted as the visibility pass. No async framing failure was demonstrated in these cases.

The builder fixture remained Saved with unchanged application identity `v1_41c340101ac2…`; no source mutation was performed. Returned to the verifier's own saved fixture. A subsequent showcase-host deselection parity amendment is awaiting a new exact candidate; final combined disposition follows that bounded check.

## Final exact-candidate verdict

**PASS — READY FOR OWNER REVIEW** at `dabbe9027e335bab1a405f4a808711d93623b3c5`, branch `codex/studio-cycle-1-3-completion`; main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. Independently verified local and remote full identities. The final change from `254b9092ac92662239b7b4eaadb5ef9ac8121b95` is a guarded `onDeselect` handoff in `StudioShowcase.svelte` plus its guide; core Structure/Designer/Flow implementation bytes are unchanged from the challenged candidate. The only verifier edit is this report. The builder's separate evidence-directory work was left untouched.

Reopened the final production preview in a new showcase tab and reloaded only the existing disposable Designer tab. In showcase's disposable Slider example, Enter → Inspect → graph-focused Escape preserved one selected graph node and the selected Slider layer. With the dock closed, Escape cleared graph and Layers together and the host Inspector displayed `Make a selection`. Selecting again then clicking actual empty graph background repeated graph selection 0, selected Layers 0 and `Make a selection`. This exercises the new host callback, rather than merely checking its presence. A final Designer smoke again retained selected Review / `group-4` when graph Escape closed inspection; reopening inspection showed exact `group-4`. Verifier browser tabs were closed and temporary viewport settings reset.

Final independently executed commands, sequentially at the exact final SHA:

- `npm exec -- vitest run tests/structure-presentation.test.ts tests/ui/structure.test.ts`: **8/8 PASS**, including the repaired keyboard selection and both Escape intents; 2 files passed, exit 0. Existing compiler and shortcut-trigger warnings retained. A previous pending tool handle became unavailable after a tool refresh; no outcome is claimed from that handle. This completed rerun is the final evidence.
- `npm run check` in `apps/studio` (`svelte-kit sync && tsc --noEmit`): **PASS**, exit 0.
- `git diff --check`: **PASS** for the final report.

| Authorized correction | Final scoped result |
| --- | --- |
| SU-01 / work area | PASS: compact toolbar and deliberate dock; low-height repair independently measured with default Chat visible. |
| SU-02 / command ownership | PASS: one primary Fit View; shared View/Object menus and deliberate editor handoffs. |
| SU-03 / selection and camera | PASS: ordinary pointer and repaired keyboard selection retain camera/filter; explicit Find/Frame visibly reveal the exact far-down source after layout settles. |
| SU-04 / disclosure and dismissal | PASS: deliberate Properties/Relationships/Find pages; close-only Escape preserves selection, closed-dock Escape/background clears host and graph coherently; drafts retained/refused where required. |
| SU-05 / node manipulation | PASS: local group disclosure; compatible contextual Move through canonical transaction; exact source restored by shared Undo. |
| SU-06 / information hierarchy | PASS: concise presentation and optional exact text view preserve canonical identity, dynamic text and bindings. |
| SU-07 / consistent modes | PASS: stable Design/Interact/Structure controls; same compact-window workspace bounds across modes; showcase shares the implementation and dismissal semantics. |
| SU-08 / accessible bounds | PASS within demonstrated scope: named keyboard controls, visible focus restoration, bounded scrolling, 800 × 600 and repaired 640 × 480 default-Chat layout. Not a universal viewport/zoom or accessibility certification. |

SV-01, SV-02 and SV-03 are **closed by the recorded repairs and affected re-verification**. No blocking finding remains in this authorized scope. The initial composition-transform V8 resource failure remains disclosed; that full composition suite was not independently rerun or promoted to PASS. Builder checks/build evidence and this independent focused browser/test verdict are distinct evidence tiers.

Next allowed action: commit/push this independent report with the builder's final delivery evidence, verify the resulting remote SHA, then owner hands-on review of the corrected isolated preview. No owner acceptance, main merge, package publication, deployment, whole-Stage 9 closure, broad agent-reliability acceptance or correction of other OR findings follows. Stage 9 remains REOPENED / IN PROGRESS.
