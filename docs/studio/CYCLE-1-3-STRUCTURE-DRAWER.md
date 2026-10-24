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
