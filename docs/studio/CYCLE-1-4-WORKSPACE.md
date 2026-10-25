# Cycle 1.4 — contextual commands and shared inspection

2026-10-25. **Builder candidate; production geometry and independent challenge pending.** This report covers the workspace implementation only. The root stage manager owns the integrated candidate SHA, production build, fresh verifier and final verdict.

## Authority and preservation

Implementation began after the owner-authorized Cycle 1.4 entry/design commit `974d0b7`, on isolated branch `codex/studio-cycle-1-4`, based on accepted delivery `0ac71d64caefaaf4351c43a68b67421a51b76aba`. Local branch, clean tree and `origin/main` (`d7401bef6e48330796c74ec00c86db9622d48cdf`) were checked during read-only entry. The [implementation design](CYCLE-1-4-DESIGN.md) and owner's current preferences govern this work.

The rejected [Cycle 1.3 context/Inspector attempt](CYCLE-1-3-CONTEXT-INSPECTOR-INDEPENDENT.md) remains rejected. This implementation was built from the corrected requirements; those commits were not restored. CI-01 (zero-height graph from generic trigger layout) and CI-02 (lost first secondary-click menu) remain historical failures and explicit regression cases.

No owner preview/tab/document was opened, reloaded or changed by this builder. No dependency installation, server launch, heavy production build, provider call, package publication or source-model change was made by this workstream. Root supplied existing dependencies and isolated framework links. General theme/token and agent changes belong to other explicitly coordinated files.

## Owner request mapping

| Requirement | Implementation |
| --- | --- |
| Right-click authored objects | A scoped secondary-pointer handler runs before the EditorCanvas document-capture selection handler. The menu prepares the exact source target without revealing unrelated floating tools. Inspect, Locate, Edit, Duplicate/Delete and sibling-order/Arrange handoffs reuse existing commands and EditorBridge validation. Root/source/ambiguous targets have bounded capabilities. |
| Empty Design canvas | Fit/tablet/phone view choices and explicit Insert handoff. Opening it clears the prior object selection when no draft blocks selection. It contains no old object's mutation commands. |
| Supported Structure items | The same menu primitive and exact graph identity. Existing Inspect, relationship, group disclosure and canonical Move-inside workflows remain. Direct authored nodes can use the same contextual source commands as the canvas. References do not gain source mutation authority. |
| First secondary click and graph geometry | The menu uses its own zero-geometry virtual anchor; it never wraps the graph/canvas in a catalog trigger. Full pointerdown/up/contextmenu tests cover selecting a different target on the first gesture. Actual rendered dimensions still require production verification. |
| Native menus and Interact | Native input/textarea/select and nearest contenteditable contexts retain browser menus, including Shift+F10. Interact authored-page behavior bypasses editor menus. Scoping is the exact workspace or matching renderer owner for its authored portals, not a global document interception policy. |
| Keyboard, bounds and dismissal | Shift+F10/ContextMenu key target the focused object; existing Bits ContextMenu owns item navigation, Escape/outside dismissal and collision bounds. Focus restoration avoids scrolling, respects an explicit command's focus handoff and does not restore to an unmounted source. |
| Shared inspection below Layers/Structure | New `SourceDetails` renders exact `projectStructure`/`structureFacts` identities, properties and relationships. It opens deliberately, stays below the navigation region and follows selection. Structure delegates facts inspection to this same pane; its Find and canonical Move workflows remain focused graph pages. |
| Floating editing controls retained | Format/Insert/Arrange/Connect remain the existing SelectionPalette/Inspector/Composer on the canvas. The details pane contains no duplicate editing implementation. Edit properties explicitly reveals/focuses those existing controls. |
| Preserve working context | Layers and Structure navigation selection does not implicitly change composition, scroll the canvas or reveal editing tools. Graph/canvas stay mounted. Ordinary details selection creates no source transaction. Existing runtime, draft, history and Save/reopen authorities remain unchanged. |
| Showcase | `StudioShowcase` uses the same context-menu and details components with its disposable memory-backed source. It exposes object/empty-canvas and graph contexts, Layers/Structure details, resize/expand/close and explicit floating editing handoff. Both owned hosts opt in to the shared Rhea ControlScope and stylesheet; root owns global shell/theme integration. |

## Geometry and focus design

The details pane starts at240px and remembers its session height in the host. Pointer resize and ArrowUp/ArrowDown/Home/End use a focusable ARIA horizontal splitter. Normal maximum is the smaller of60% of document-content height and the height remaining after160px of navigation. The normal requested minimum is160px. If the entire content region cannot accommodate those two minima, the details cap falls to120px; explicit Expand provides the useful reading surface instead of silently covering the navigation.

Expand temporarily fills only the Document content region. Its covered navigation becomes inert; the canvas and Document tabs remain available. Restore returns to the same split and focuses Restore/Expand. Close or Escape from details returns to a connected visible initiating control, or the active navigation surface's Inspect control. Ordinary selection does not invoke Locate, Fit, scrollIntoView or composition navigation. Explicit Locate and editing handoffs retain their existing, deliberate behavior.

Actual dimensions, small-window usability, long-property scrolling, zoom, menu collision/focus and graph continuity must be challenged in the exact production build. A DOM existence assertion is not geometry evidence. The physical screen may be too short for both nominal minima; the bounded cap and deliberate expansion are the stated fallback, not a claim of160px graph space at every possible window size.

## Changed implementation files

- `apps/studio/src/lib/designer/WorkspaceContextMenu.svelte`: shared scoped secondary-pointer/keyboard bridge and public Bits menu primitive; separate virtual anchor, portal and focus return.
- `apps/studio/src/lib/designer/workspace-context.ts`: native editing detection and occurrence-based source capabilities using existing editor resolution/ownership helpers.
- `apps/studio/src/lib/designer/SourceDetails.svelte`: shared read-only facts/relationships, explicit editing handoff, bounded resize/expansion and Escape lifecycle.
- `apps/studio/src/lib/designer/Designer.svelte`: workspace command wiring and lower Document composition; existing floating controls retained.
- `apps/studio/src/lib/designer/StructureView.svelte`: exact graph context targets, delegated shared facts inspection and shared inspection selection; existing source graph/layout/move authority retained.
- `apps/studio/src/lib/designer/StudioShowcase.svelte`: real shared workspace interaction examples and theme scope.
- `apps/studio/tests/ui/context-details.test.ts`: actual component/event-handler regression journeys with real canonical commands. Browser layout is explicitly outside happy-dom's proof.

## Builder checks and retained failed observations

Direct tools were used from `apps/studio`; no package-manager install was invoked.

1. Initial Svelte check before generated setup failed because `.svelte-kit/tsconfig.json` was absent. Root-provided SvelteKit sync generated it; no source or dependency workaround was used.
2. Initial new tests passed2/4. One failed assertion counted closed animated menu DOM as an open menu; the other selected the hidden Layers Inspect control rather than the open menu item. Assertions now address open menu state and the exact menu item. These were test-selector failures, not promoted to passing evidence.
3. A subsequent Svelte check found one new showcase TypeScript narrowing error after an early inspector handoff return; its unreachable branch was removed. It also identified the intentionally focusable splitter as a noninteractive separator. The component now carries the same narrowly documented ARIA splitter suppressions as the existing `PanelResizer`; it retains keyboard and value semantics. An unused showcase selector was removed.
4. Affected batch passed **17/17**: context-details5, composition5, Structure7. It exercises changed-target full secondary sequence, actual Duplicate/Undo, empty-target safety, keyboard/native/Interact behavior, shared details, retained graph/canvas/scroll, covered-navigation inertness, floating edit handoff, source-draft refusal and outside-workspace bypass. Existing AgentChat localhost connection-refused messages and Flow shortcut warnings are retained test-environment output; no provider call was made.
5. Svelte check completed **0 errors /7 warnings** at the recorded intermediate integration state: six retained renderer/editor warnings plus a concurrent root CoreAuthoringShowcase initial-value warning, reported to the root manager for its own correction. No new workspace warning remained. The root final integration check supersedes this intermediate scope.

The native Shift+F10 assertion and focus-return hardening were added after the17-test batch. The subsequent focused context-details rerun passed **5/5**. Root source review then identified an inconsistent short-window resize minimum and requested an explicit non-focusable virtual trigger and canvas focus fallback. The resize minimum is now `min(160,maxHeight)` consistently in effective height, pointer, keyboard and ARIA values; a sixth test exercises a240px available region with120px bounds. The trigger explicitly has `tabindex=-1`; un-focusable or removed source targets fall back to the existing focusable canvas/selected graph wrapper. These are builder-review repairs, not independent-verifier findings. The final focused run passed **6/6** (`node ../../node_modules/vitest/vitest.mjs run tests/ui/context-details.test.ts --maxWorkers=1 --no-file-parallelism`,36.74s). Strict UTF-8 decoding passed all seven owned source/test files; changed tracked workspace files pass `git diff --check`.

Final root tests, production build, exact committed identities and independent actual-browser verdict belong in the integrated Cycle1.4 report. None of these builder observations imply owner acceptance, Milestone1 closure, Milestone2 authority or Stage9 closure.
