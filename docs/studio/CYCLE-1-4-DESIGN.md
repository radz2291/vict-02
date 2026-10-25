# Cycle 1.4 — implementation design and acceptance

2026-10-25. **AUTHORIZED / IN PROGRESS.** This records implementation decisions before product edits; it is not a verification verdict.

## Baseline, ownership and limits

The owner's Cycle 1.4 brief supersedes the prepared-only restriction in the prior handoff. [Core owner closure](CYCLE-1-3-CORE-OWNER-CLOSURE.md) accepts delivery `0ac71d64caefaaf4351c43a68b67421a51b76aba`, containing exact verified product `57308f6ffcd5c85415b38d9d68a6f696199ebfa7` and independent verdict `c5ae1e9f718a31930f98a5ef300463f2c1b8db54`.

Live fetched main is `d7401bef6e48330796c74ec00c86db9622d48cdf`, unchanged and an ancestor of accepted delivery; verified product is also its ancestor. Accepted branch was clean and remote-equal. Desktop main is an older separate checkout with an untracked builder-kit tarball; it is preserved. New managed worktree: `C:/Users/RZ1/.codex/worktrees/studio-cycle-1-4/260831-VCT-02`, isolated branch `codex/studio-cycle-1-4`, based exactly on accepted delivery.

Allowed paths: reusable `packages/ui`, `ui-svelte`, `ui-editor`, `ui-ai-svelte`, `ui-flow-svelte`; Studio composition/server agent tooling; associated tests/scripts/installed consumer fixtures/build configuration; scoped Studio documents and current-status pointers. Preserve canonical source, immutable component revisions/defaults, compilation, EditorBridge acknowledgements, explicit Save/reopen, history, drafts, runtime state and Mastra effect boundaries. No Quellight edits, arbitrary code imports, provider/workflow authority, main merge, publication, deployment, Milestone 2 or self-acceptance.

Entry C: headroom approximately2.5GB. Preserve existing listeners `.6:5600`, `.7:5601`, `.9:5603`, `.10:5604`, `.11:5605`; no owner-tab reload/request replay. Inspect headroom/listeners before each build/launch, serialize heavy builds and use fresh origins/disposable data. Shared third-party dependencies may be reused without retargeting another worktree's framework links; delivery proof requires exact package source/build and an independent installed consumer.

## Implementation areas

1. **Catalog and visual foundation.** Reconcile all63 pinned rhea UI families in an explicit migration matrix, separate composed helpers/blocks/fonts/host support from authorable contracts, and record justified omissions. Derive reusable scoped tokens and component presentation from pinned upstream, preserve primitive version and contract bytes, record licenses/adaptations. Studio consumes the same visual language; Flow keeps graph semantics. Missing contracts need explicit compatible additions or documented host/semantic exclusions, never silent parity claims.
2. **Workspace interactions.** Build one context-menu state/command dispatcher for exact authored targets, empty canvas and supported Structure nodes. Resolve selection before action, without opening floating tools. Preserve native editing and Interact. Keyboard invocation, dismissal, focus and viewport bounds use the same menu behavior. Add deliberately opened source-inspection details below Layers/Structure, retaining the graph/list and mounted canvas above/beside. Details report facts/properties/identity/relationships; Edit explicitly hands off to the existing floating controls. Bound sizing and scroll, preserve state and do not auto-locate.
3. **Agent discovery and completion.** Stabilize contract pagination with explicit content/projection identity and invalidation; reuse complete unchanged contracts. Expose seed styles/host dependencies before construction. Encourage meaningful batches and early section observations. Measure call categories, first acknowledged edit, tool-active/waiting intervals and receipt-derived totals; unavailable provider-internal metrics stay unavailable. Source, observed region and exercised behavior remain distinct.
4. **Observation boundary.** Use existing capture metadata/crops truthfully. Add early visual review guidance and coverage reporting first. Any broader offscreen capture/navigation capability requires a precise bounded contract proposal before implementation; no arbitrary click/type/scroll authority or freshness bypass.
5. **Integration and showcase.** Every changed surface/state appears in the shared showcase. Validate actual CSS/container precedence, long content, smaller windows/zoom, portals, mixed edits, AI/Flow presentation, Stop/stale/draft/history/save boundaries. Run real configured-provider form/dashboard/editor journeys on isolated previews, with actual and simulated evidence separated.

Root owns integration, agent reads/progress/server guidance, state/report/build/launch and final verification coordination. Delegated catalog and workspace builders own non-overlapping reusable presentation versus workspace composition files. A fresh independent verifier receives an exact committed candidate and production seal, makes no repairs, and challenges the matrix below. Root repairs required findings and obtains affected re-verification before delivery.

## Acceptance matrix

| ID | Required evidence |
| --- | --- |
| C14-01 | Accepted core closure, exact baseline/remote/isolation, preservation and authorized scope recorded before implementation. |
| C14-02 | All63 upstream UI families have exact counterpart/authorability/presentation/host/compatibility/exclusion dispositions; material omissions disclosed. |
| C14-03 | Coherent reusable tokens/components, actual Studio shell/portals/showcase and separately installed consumer; pinned provenance/licenses; legacy identity/default compatibility checks. |
| C14-04 | First real secondary-click sequence opens correctly targeted object/empty-canvas/Structure menus; keyboard/focus/dismissal/bounds work; native editing and Interact preserved. Retain CI-01 graph-collapse and CI-02 lost-first-menu regressions. |
| C14-05 | Comfortable deliberate inspection details serve Layers/Structure while floating tools and canvas remain; geometry, small-window/zoom, focus, search/selection/camera/runtime/draft preservation demonstrated. |
| C14-06 | Stable paged-contract identity/invalidation, completed knowledge reuse, bounded selected bundles, explicit recipe seed/host information and meaningful negative tests. |
| C14-07 | Earlier visual review and bounded region coverage, actual freshness/recovery preserved; no implied interaction authority. Any proposed observation extension separately documented. |
| C14-08 | Receipt-derived applied totals including cleanup, honest source/visual/interaction status, category/timing/first-edit/waiting measurements; controlled comparison limits retained. |
| C14-09 | Actual provider form/dashboard/editor plus authored AI/Flow journeys; responsive computed styles, mixed manual/agent, Stop, stale/draft, Undo/Redo, Save/reopen; simulations labelled. |
| C14-10 | Appropriate regressions/types/production build, exact seal/installed package provenance, complete showcase, fresh independent verdict and required repairs/rechecks, pushed remote equality, walkthrough/limits. |

Stop at independently verified Cycle 1.4 readiness for owner review. Owner acceptance of Cycle 1.4/Milestone 1 and Stage 9 closure remain separate.
