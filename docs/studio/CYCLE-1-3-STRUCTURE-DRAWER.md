# Cycle 1.3 — Structure beside the canvas

2026-10-24. **Owner-authorized implementation; candidate pending.** The owner accepted the proposal to put Structure in Document and said “make sure its not too tight… is my preference… do it now.” This supersedes the Structure-as-canvas-mode placement only. The thirteen supplied UI preferences remain the review standard.

## Baseline and boundaries

Entry: clean, remote-equal `84d0e95b06598709acc9e13493834fca04846a78`, branch `codex/studio-cycle-1-3-completion`, existing isolated worktree. Main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. Previous Structure product `dabbe9027e335bab1a405f4a808711d93623b3c5` has independent scoped PASS; that verdict does not cover this new placement. Preserve its evidence and all agent-run failures.

Allowed: Designer Document/Structure composition, presentation/selection/locate and drawer sizing; shared StructureView presentation and showcase parity; affected tests, documentation and evidence. Keep canonical identities, component ABI, source/history transactions, layout engines, runtime state, agent tools and provider semantics. Agent reliability findings remain report-only. No main merge, package publication, deployment, Stage 9 closure or owner acceptance.

## Accepted outcome

- Canvas stays mounted and visible in Design/Interact; Structure is a Document tab alongside Layers/Data/Actions/Source.
- Give Structure a generous independently remembered resizable width. Where side-by-side panes would be cramped, stack the document pane below the canvas. Explicit Expand/Restore is a temporary larger workbench, not a default mode switch.
- Selection synchronizes source highlights without scrolling or switching composition automatically. Explicit Locate on canvas can reveal a composition/scroll target. Existing Inspector remains the editing home.
- Retain graph position, search, disclosure, relationships and selection when hiding/switching drawer sections. In-drawer details use a focused page rather than another adjacent inspection drawer.
- Preserve drafts, runtime values and undo; predictable keyboard/focus/dismissal and bounded small-window scrolling. Opening Structure must not mark the still-visible canvas unavailable to agent capture.
- Showcase the new shared presentation and canvas coexistence. Preserve the owner's active `127.0.0.5:5599` server/tab, unsaved source and chat; build and verify on a new origin with disposable fixtures and existing server-side GLM configuration.

## Gate

Affected component/composition tests, Studio TypeScript/Svelte checks, production build, actual browser journeys on large and smaller windows; source/draft/runtime/selection/camera continuity and canonical move/Undo. Commit and push exact candidate, verify remote SHA, obtain fresh independent challenge, repair and reverify required findings. Save screenshots and aggregate evidence. Next action after scoped verification: owner hands-on review; Stage 9 remains REOPENED / IN PROGRESS.

## Candidate observations

Document now owns Structure; Design/Interact retain the same mounted canvas. Structure has its own session width (560px initial, 440px minimum, bounded to preserve at least 320px of canvas), and stacks below the canvas when the workspace cannot accommodate that pair. Explicit Expand/Restore is a temporary workbench; only that covering state retains the existing source-view capture refusal. Docked Structure does not suppress canvas capture. Graph state stays mounted across drawer dismissal and tab changes. In-drawer inspection is a focused page over the graph rather than a second adjacent panel. The existing Inspector owns edits; Locate on canvas is explicit. The showcase demonstrates the same component beside its live canvas.

Retained builder observations: the first Svelte check found four declaration-order errors for the derived drawer state; moved that declaration after its inputs. The first composition run found a Layers lifecycle regression: mounting Layers while Document was closed changed its initial disclosure context. Only Structure is now kept mounted; other Document sections retain their prior open lifecycle. The existing composition journey then passed. A test-append command initially used the wrong relative directory and made no test-file change; the intended tests were subsequently added at the correct path. No checks are claimed from that failed append.

Builder TypeScript passes. Final Svelte check reports 0 errors / 6 retained warnings in unchanged renderer/editor files. The affected run passed 13 tests (composition 5, Structure 6, projection 2); an additional drawer-specific Escape-scope regression is being run before readiness. Production build and real browser/independent challenge are pending. This is a candidate, not a gate PASS.

Initial candidate `89fc5c9d117984abd9a039a518790e23544c565f` passed full production build and all 14 affected tests. Fresh independent review found SD-01: at 1000×700, stacked Expand kept the drawer `position:static` because the stacked selector had greater specificity; the graph collapsed into an 82.6px implicit row. It also found SD-02: Locate on a hidden composition in Interact changed the breadcrumb although composition rendering requires Design, leaving an unusable half-transition. Both failures are retained. Repairs give Expand the appropriate selector priority and refuse hidden Interact composition location before changing context, with a clear instruction to use Design; runtime state remains intact. Visible targets can still be located without changing mode. Drawer defaults additionally collapse non-root groups with multiple children, keeping first-open labels readable; expansion remains local and deliberate. Exact repaired candidate/build and independent rechecks are required.
