# Structure corrections — independent verification

2026-10-24. Independent verifier, fresh context, no participation in implementation. **Initial candidate FAIL; final disposition pending bounded repair and re-verification.**

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
