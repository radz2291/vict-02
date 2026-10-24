# Cycle 1.3 — Structure beside the canvas

2026-10-24. **Independently PASS — READY FOR OWNER REVIEW.** The owner accepted the proposal to put Structure in Document and said “make sure its not too tight… is my preference… do it now.” This supersedes the Structure-as-canvas-mode placement only. The thirteen supplied UI preferences remain the review standard.

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

SD-03 was additionally demonstrated in the showcase: its absolute expanded drawer retained its grid-column restriction, so it grew only vertically inside the original cell. The repair spans the complete editor grid and uses a larger viewport-bounded height, including the stacked example. This is a showcase presentation repair only. Failed initial geometry remains independent evidence; the repaired production result must be challenged afresh.

Repaired candidate `497549f73dce8d869bdb0385ae93d843b629e250` passed all 14 affected tests, TypeScript, Svelte (0 errors / 6 retained warnings) and full production build. Independent actual rechecks closed SD-01 and SD-02 at this candidate. A further SD-04 keyboard failure was observed by builder and independently reproduced: Tab from Inspect entered a covered Flow node while the focused inspection page was open. Flow explicitly marks its children visible, overriding inherited hidden visibility. The covered drawer graph now becomes inert until inspection closes, keeping its layout/viewport mounted while excluding hidden controls from focus and accessibility. Earlier observations remain evidence; exact final candidate/build and affected independent challenge follow.

The SD-03 width repair passed desktop measurement, but independent 800×600 testing found the expanded showcase jumped from its lower stacked row above the page viewport after clicking Expand. Explicit expansion now reveals the enlarged pane and focuses Restore; restoration returns to the preceding page scroll position. This scroll is tied only to the explicit workbench command. Ordinary selection and Document changes retain their camera/scroll behavior. The failed offscreen measurement is retained, not promoted to PASS.

## Final verified result

Exact product `a36793df0f62c002332d66db181310554aaabb05`, branch `codex/studio-cycle-1-3-completion`; main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. [Fresh independent verification](CYCLE-1-3-STRUCTURE-DRAWER-INDEPENDENT.md) is **PASS — READY FOR OWNER REVIEW**. SD-01–SD-04 are closed by their recorded repairs and affected production challenges. Historical pending/failure statements above retain their candidate scope.

The final production client/server and Node adapter built successfully from unchanged exact final source. A preceding build was already transforming when the last showcase remedy was committed; it was never served or counted as final proof, and a complete final build was performed. Root's first repair-test wrapper ran from the wrong directory and matched no tests; the corrected Studio-directory run passed all 14. Final independent Structure tests passed 7/7; final independent Svelte checking passed with 0 errors / 6 retained warnings in unchanged renderer/editor files. The full 14 affected tests and Studio TypeScript passed at `497549f`; the only later product changes are the inert covered graph and explicit showcase workbench scrolling, covered by final tests, Svelte and actual browser challenge. No dependency or validation workaround was introduced.

| Accepted behavior | Demonstrated result |
| --- | --- |
| Canvas priority and comfortable sizing | Canvas remains mounted/visible in the normal dock; Structure starts at 560px, independently resizable with a 440px minimum and remembered session width. 1500px review had 614px canvas plus 560px drawer; root 1280px screenshot has 394px canvas plus 560px drawer. |
| Smaller windows | Stack below canvas when the available workspace is below 860px. Default Chat remains visible. At 640×480 the drawer and focused inspection stay bounded; explicit Expand provides more room. |
| Deliberate selection/navigation | Pointer/keyboard graph selection preserves source identity, graph camera, canvas scroll and composition. Actual canvas outline matches the selected graph group. Locate is explicit; hidden Interact source refuses without changing mode/runtime, with a Design instruction. |
| Stable context | Source/Structure, Data/Structure and drawer close/reopen retain graph search/camera and runtime input. Source and Data drafts refuse unsafe transitions and remain exact. |
| Editing and recovery | Existing Inspector and Data/Actions handoffs; canonical Move and Undo restore exact source. No source transaction is created by opening/resizing/expanding the pane. |
| Focus and expanded workbench | Covered graph controls excluded during focused inspection; closing restores graph keyboard access. Studio expansion stays visible; showcase expansion spans its editor, reveals Restore, then restores exact prior page scroll. |

The existing owner `127.0.0.5:5599` tab, unsaved painting work and chat were not reloaded or edited. Review used a new `127.0.0.6:5600` production origin and disposable saved fixtures. Only the new agent-owned review server was restarted for builds. Existing server-side `zai/glm-5.3-flash` credentials/configuration are reused; the new UI shows Ready. No model request or repair of the reported agent-process failures was performed. Other agent/platform findings remain open/report-only. The source model, effects, component ABI, canonical validation, transaction history and provider semantics remain authoritative.

Saved [evidence manifest](cycle-1-3/structure-drawer/evidence.json), [side-by-side screenshot](cycle-1-3/structure-drawer/canvas-and-structure.png), [focused inspection](cycle-1-3/structure-drawer/focused-inspection.png) and [disposable fixture](cycle-1-3/structure-drawer/fixture.json). The [review launcher](cycle-1-3/launch-structure-drawer-review.ps1) checks product-source parity and refuses an occupied port; syntax and occupied-port refusal passed. This is focused verification, not a universal viewport/accessibility certification or broad agent reliability verdict.

## Owner walkthrough and next action

Open [updated Studio](http://127.0.0.6:5600/design), then **Document → Structure**. The saved **Canvas and Structure** example is disposable review content. Select a group to see its canvas highlight, use its chevron to expand, resize the dividing edge, then try **Inspect**, **Object → Locate on canvas**, and **Expand / Restore**. Closing Document retains graph context. Normal canvas modes are now Design and Interact.

The [showcase](http://127.0.0.6:5600/showcase#designer) has **Document → Structure** beside the recipe canvas and demonstrates the shared focused pages and workbench. Local sign-in remains `operator` / `studio-local-pass`; GLM is configured on the server.

Next allowed action: owner hands-on review of this scoped candidate. Owner acceptance remains pending; Stage 9 stays REOPENED / IN PROGRESS. No main merge, package publication, deployment or Stage 9 closure follows.
