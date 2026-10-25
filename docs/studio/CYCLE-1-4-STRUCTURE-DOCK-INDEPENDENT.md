# Cycle1.4 Structure dock — independent verification

2026-10-25. **Final independent technical PASS — READY FOR OWNER REVIEW**, exact product `e98e7b033369ba29a458119b7f8047f405130005`, branch `codex/studio-cycle-1-4-structure-dock`. SDI-01–04 are closed by independent source and actual UI re-verification; their earlier failed observations remain below. No product source was edited by this verifier. The owner-authorized [amendment](CYCLE-1-4-STRUCTURE-DOCK.md) governs this bounded review; Stage9 remains reopened/in progress and owner acceptance remains pending. See the final matrix and limits at the end of this record.

## Initial candidate — HELD

The initial exact product `09055e07631f8a2f53f34342540b7b4944a8850c` was held for two required corrections. Subsequent intermediate-source and showcase findings were also recorded and repaired; neither a push nor a builder report was treated as a gate verdict.

## Identity and limits

Repository `https://github.com/radz2291/vict-02.git`; isolated builder checkout `C:/Users/RZ1/.codex/worktrees/studio-cycle14-structure-dock/260831-VCT-02`, branch `codex/studio-cycle-1-4-structure-dock`. Independent `git ls-remote` matched product `09055e07631f8a2f53f34342540b7b4944a8850c`; main matched expected `d7401bef6e48330796c74ec00c86db9622d48cdf`. Delivery baseline is `09aafcaa7b3ab7620ec75151020075632f78ff18`, preceding product `e76e2fc0f64f5a451edae01f4b0a1c9e7cfc68db`. On entry only the expected new production seal was untracked. Source review used the exact committed diff and verified no engine/provider/package contract/storage/history changes. The root agent supplies additional desktop/runtime/showcase observations, separately attributed below when available.

The verifier opened its own background CUA tab on the isolated production origin `http://127.0.0.16:5610/design`. It did not touch the owner `.12:5606` origin. A fresh unsaved document received a small heading/input fixture through Document→Source. One invalid verifier-created text-node fixture was refused with `STUDIO_SOURCE_INVALID`; correcting it to the canonical text `content` expression compiled successfully. This was probe preparation, not a product defect. Viewport overrides were reset after responsive checks.

Independent production seal verification succeeded: candidate `09055e07631f8a2f53f34342540b7b4944a8850c`,748 inputs/491 outputs. Builder final JSON reports13/13 tests,0 failures; independent source review confirms the mounted graph/canvas, scroll preservation, contextual first-target, JSON draft and short-window splitter assertions. Builder svelte-check reports0 errors/9 retained warnings and production build succeeds. These existing checks do not override the actual failures below.

## Initial findings retained

| ID | Required observation | Initial result and evidence |
| --- | --- | --- |
| SDI-01 | Comfortable small geometry; deliberate larger Structure view | **OPEN / required correction.** At390×640 with default stacked Chat, design stage277.6px high; ordinary dock96px, usable graph45.2px. Expand yields dock126px/graph82.2px and leaves canvas78.8px. A complete source node cannot fit vertically in the graph. [Ordinary screenshot](cycle-1-4/structure-dock/independent-phone-collapsed-space.png), [expanded screenshot](cycle-1-4/structure-dock/independent-phone-expanded.png). A deliberate expanded mode must provide useful graph space on this supported small layout. |
| SDI-02 | Covered content must not remain keyboard active | **OPEN / required correction.** At390×640 with Inspect open, initial focus is Close inspection details. Shift+Tab moves to underlying Restore Structure at x357.6,y585.7,width24.8,height27.4. Read-only `elementFromPoint` confirms the focused control is covered by the inspection drawer. Apply bounded focus/inert behavior in overlay mode while preserving the desktop canvas/graph use. |
| SDI-03 | Expanded Structure must hand editing/Locate back to visible canvas | **OPEN / intermediate repair source challenge.** Intermediate product `c263ce4` deliberately hides/inerts the mounted canvas while expanded, but its inspector/Locate/context editing paths do not restore expansion. Thus the new expanded presentation can suppress the existing floating editing destination. Builder accepted this challenge before final replacement build; no readiness claim was issued for that intermediate commit. Recheck the final exact repair via actual Expand→Inspect→Edit properties and Expand→Locate. |

## Independent checks already passing on09055e0

- At1280×720, graph249.2px high and canvas279.2px high. At820×600 graph remains249.2px/canvas159.2px; Expand gives336.2px graph/canvas79.2px. [Narrow screenshot](cycle-1-4/structure-dock/independent-narrow-820.png).
- Height keyboard Home/End at820×600 gives180/300, matching announced bounds. Expansion and restoration work.
- Inspect is the sole visible right drawer; Document remains hidden and no source-details panel exists under Structure. Opening Inspect focuses Close; Escape closes it and returns focus to Inspect structure.
- JSON draft text, including a trailing space, survives opening/closing Inspect and Structure hide/show exactly. Inspect editing is disabled while the draft is pending; canonical apply remains available on return. The verifier discards its own draft afterward.
- Search `Independent` and the graph viewport transform survive hide/show exactly. Source shows unconditional persistent StructureView/EditorCanvas mounts, while the existing test asserts graph/canvas element identity and canvas scroll retention.
- SourceDetails uses the existing guarded edit handoff to floating canvas tools. Preview values/deny/fail controls were relocated to Document→Preview; dispatch/effect code and canonical storage/history semantics are unchanged by this candidate. Actual runtime and showcase corroboration awaits root evidence review.

## Next allowed action

Builder may make bounded repairs for SDI-01/02, run affected checks, commit/push and reseal a new exact product, then request independent re-verification. This initial HELD record and screenshots must remain. No readiness/owner acceptance/main merge/publication/deployment/Stage9 closure follows from this initial review.

## Replacement re-verification — c9b6d86

Exact replacement product `c9b6d86ebdbef09c5379214208a062bf70753f8e` independently matches the remote branch; main remains unchanged. Independent seal verification again passes748 inputs/491 outputs. Builder exact-replacement JSON reports23/23 tests across six files,0 failures; Svelte check reports0 errors/6 carried warnings, TypeScript check passes and exact committed production build completes. The intermediate `c263ce4` build and its declaration-order Svelte failure are retained and excluded from the final product proof.

The original verifier tab's reload retained its09055e0 ephemeral state/classes and old126px expansion geometry. Those observations were excluded from replacement verification. A **fresh tab** at `/design?verify=c9b6d86` loaded the new `structure-expanded` main class, zero-height hidden canvas and new behavior. It opened the builder's saved disposable form; verification changed selection/presentation and discarded its own temporary JSON draft, without saving or changing the source. [Raw independent replacement observations](cycle-1-4/structure-dock/independent-c9-recheck.json).

| Finding | Exact replacement recheck | Disposition |
| --- | --- | --- |
| SDI-01 | At390×640 with long screen title and default stacked Chat, explicit Expand provides148.2px graph space; canvas remains mounted at0 height, hidden/inert. Explicit Fit View places both complete source nodes inside the graph (50.6/53.7px node heights). [Expanded view](cycle-1-4/structure-dock/independent-c9-phone-expanded-fit.png). | **CLOSED** |
| SDI-02 | Inspect opening makes the covered narrow workspace inert. Shift+Tab from Close now reaches visible Chat details, skipping covered Structure controls. [Inspect view](cycle-1-4/structure-dock/independent-c9-phone-inspect.png). | **CLOSED** |
| SDI-03 | Expand→Inspect→Edit properties restores canvas95.6px/non-inert and visible floating tools, closes Inspect and clears expansion. Expanded Object→Locate also clears expansion and reports `Located on canvas.` [Editing handoff](cycle-1-4/structure-dock/independent-c9-phone-edit-handoff.png). | **CLOSED** |

Additional independent exact-replacement checks: Escape on expanded bar restores ordinary layout; desktop height Home/End gives180/420 within announced bounds; pending JSON source bytes including trailing space survive Inspect and Structure hide/show exactly, and Inspect editing remains disabled. Search `Full name` and the graph camera transform survive hide/show. All temporary viewport overrides were reset.

Capture scope is deliberately narrow: the existing `captureDesignerPreview` visibility guard is unchanged; its caller now passes `structureOpen && structureExpanded`. The actual expanded canvas is hidden/inert with0 height. A fresh provider capture/refusal was **not invoked or claimed**; no capture-authority expansion occurred.

Independent inspection of builder's fresh-c9 raw desktop screenshots/DOM confirms floating Format/Insert/Arrange/Connect return above the bottom graph, Preview values remain under Document→Preview, and local action statuses progress deny→fail-once→recovered simulated submission with retained runtime values. Those actions were executed by the builder and reviewed independently; they are not relabelled as child-executed actions. Final showcase/Save-reopen corroboration remains pending at this checkpoint.

### Later c9 showcase challenge — SDI-04

The builder's [actual showcase screenshot](cycle-1-4/structure-dock/browser/final-showcase-bottom-right.png) and geometry reveal a further required presentation/focus correction: opening Inspect from the visible lower Structure graph focuses Close while the right inspector begins at y=-275.4px. Its header/Close are outside the viewport. The complete showcase contains the new surfaces, but that specific opening path does not provide visible focused controls. **SDI-04 OPEN; final verdict remains HELD until a bounded showcase position/height repair and exact replacement evidence.** A sticky desktop inspector and bounded fixed narrow inspector can keep the header reachable. Core Studio is unaffected by this finding.

Builder's actual Save/reopen evidence is reviewed: `final-reopen-result.json` reports exact saved source equality at r1.r2 and empty runtimeFullName after reopening; authored source persists and temporary runtime resets. `final-history.json` records undo/redo equality. These c9 observations remain valid at their scope and must be carried explicitly if the replacement changes only showcase CSS.

## Final independent verdict — e98e7b0 PASS

Audited builder raw-evidence delivery `286324b53f15a96bd942232dbe764f7343382628` is pushed and independently remote-equal before this verdict commit. Its product paths are byte-identical to e98e7b0; it contains the final exact seal, build/check outputs, retained failures, root raw browser evidence and amendment report. This independent report/screenshots/observations are committed separately afterward, with no product edits.

Product `e98e7b033369ba29a458119b7f8047f405130005` independently matches the pushed branch; main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. Independent final production-seal verification passes748 inputs/491 outputs. Builder final affected tests report9/9 passes in two files, with the focused narrow focus/Escape regression; Svelte check reports0 errors/6 carried warnings; TypeScript passes and exact production build completes. The six-file23/23 c9 suite remains explicitly carried for unchanged behavior, rather than represented as a fresh full final-product run.

The final diff from c9 changes only `SourceDetails.svelte` (optional focus containment, default false), `StudioShowcase.svelte` (bounded sticky/fixed positioning and viewport-matched containment), and the focused UI test. Designer, StructureDock, StructureView, preview dispatch, storage/history, engine/provider and package contracts are byte-unchanged from c9.

SDI-04 is **CLOSED** by fresh independent actual final-product observations: opening Inspect from the lower showcase graph at1280×720 gives sticky panel y12,height600 and focused Close y17.8–45.8, visibly inside the viewport. At390×640 it gives a fixed panel y12,height600, visible Close at the same y, inert covered preview, and Shift+Tab stays within Inspect. Escape closes and returns focus to Inspect structure; preview interaction is restored. [Desktop proof](cycle-1-4/structure-dock/independent-e98-showcase-desktop.png), [narrow proof](cycle-1-4/structure-dock/independent-e98-showcase-phone.png).

A fresh final Studio tab independently confirms the shared SourceDetails default remains correct: one right Inspect, no lower Inspect, visible initial Close focus, desktop workspace remains interactive, Escape returns to Inspect structure. Expanded Structure still gives536.2px desktop graph with mounted canvas0px/hidden/inert; Escape restores its ordinary presentation. [Raw final observations](cycle-1-4/structure-dock/independent-e98-recheck.json).

| Required amendment criterion | Verdict and evidence scope |
| --- | --- |
| Structure independent bottom toggle; canvas/graph context preserved | **PASS.** Exact source review; independent c9 actual search/camera/draft hide/show; c9 unchanged Designer/Dock bytes carried to final, plus final expansion smoke. Existing tests assert mounted graph/canvas identity and scroll. |
| Shared deliberate source Inspect right, one visible drawer, no lower Inspect | **PASS.** Independent initial/c9/final actual observations, builder desktop raw DOM/screenshots, final default smoke. |
| Contextual command targets and floating editing handoff | **PASS.** Existing affected first-secondary-target/keyboard tests; independent c9 expanded Edit and Locate, builder c9 actual Section selection/edit; final unchanged handoff bytes carried. |
| Keyboard height bounds, Escape/focus and useful small expanded geometry | **PASS.** Independent c9 desktop resize180–420, phone fitted complete nodes, covered workspace skipped, editing restored; final shared default smoke. SDI-01–03 closed. |
| Preview values/deny/fail remain functional without effect expansion | **PASS.** Builder c9 actual retained values, deny/fail-once/recovery raw states reviewed independently; final byte-unchanged dispatch/Designer carried. |
| Draft/history/source Save/reopen | **PASS.** Independent c9 exact draft preservation and disabled editing; reviewed builder actual undo/redo, saved source equality r1.r2 and runtime reset; final byte-unchanged canonical paths carried. Existing stale/guarded-move tests remain. |
| Showcase reflects bottom Structure/right Inspect with visible bounded focus | **PASS.** Fresh independent final desktop/narrow actual observations; SDI-04 closed. |
| Exact source, checks, seal and remote candidate | **PASS.** Independent source/remote/seal challenge; retained initial and intermediate failures; focused final tests/build plus explicitly identified carried coverage. |

Limits retained: default stacked phone layout remains compact and requires deliberate Expand for useful graph space; Fit View/frame selection may be needed after preserving a camera across large size changes. The phone screen-title/header and floating tools retain their existing constrained layout. Capture visibility proof is source-hook plus actual covered/inert DOM, without a fresh provider capture request. No new provider reliability, package-consumer, broad Stage9, deployment or owner-acceptance claim is made by this layout amendment. Initial failed fixture preparation, stale-tab observations, splitter/focus/showcase failures and intermediate failed checks remain preserved.

Next allowed action is owner hands-on review/acceptance decision on the pushed final product and independently committed report/evidence. Cycle1.4/Milestone1 owner acceptance, Milestone2, main merge/publication/deployment and Stage9 closure remain separate.
