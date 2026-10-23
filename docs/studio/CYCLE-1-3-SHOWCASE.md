# Cycle 1.3 complete UI showcase

## Additional owner request

On 2026-10-23 the owner requested: “Make sure all UI you newly created/modified in cycle1.3 are in the showcase so I can see them after.” This adds a review surface, not execution authority or a Stage 9 gate verdict. The existing authenticated Studio request boundary remains unchanged.

## Review entry points

- `/showcase#ai-patterns`: the public `PatternShowcase`, covering all 21 AI patterns.
- `/showcase#building-blocks`: the public `PrimitiveShowcase`, covering 19 shared AI component families and their composition parts.
- `/showcase#flow`: the public Flow canvas with node selection, drag, connections, controls and minimap.
- `/showcase?recipe=slider#designer`: all 83 actual Studio recipes, searchable and selectable one at a time.

The packed standalone consumer imports only public packages and generated recipe metadata. Its recipe links open the authenticated Studio route. It has no Studio source imports or aliases.

## Actual authoring surfaces

`StudioShowcase.svelte` composes the public `EditorCanvas`, `Inspector`, `SelectionPalette`, `Composer`, `Layers`, `CompositionNavigator`, `StateInitialEditor`, and `StateValuesPanel`, plus the actual Studio `StructureView`. It does not copy their editor implementations. Docked Inspector exposes properties, styles, typed bindings and outputs; the optional floating palette exposes Format/Insert/Arrange/Connect. Authoring data and temporary preview data are separately inspectable.

The pure `createShowcaseFixture(recipeId)` helper returns `{ document, targetNodeId, parentFocus? }`. It inserts every recipe through `insertRecipe` and `applyUiEdit`. For context-owned parts it walks declared placements, constructs the necessary ancestors first, then inserts the target in its valid slot. Stable source identities allow selecting the target directly. Context-part examples initially show their parent composition; Interact returns to the whole screen so primitive popup and input behavior can be exercised normally.

`showcaseCatalog` is the exact 83-entry recipe index. `examples/studio-ui-consumer/src/cycle13-catalog.json` is a generated array of `{ id, label, description, category, placements }`, with a focused test checking equality against the actual index. Regenerate explicitly with `VICT_REGENERATE_SHOWCASE_CATALOG=1` when running `tests/showcase.test.ts` from `apps/studio`.

## Isolation and command boundary

A fresh `EditorBridge` is created on mount and each recipe switch. Its `screenStore` adapter uses a fresh private `Map<string,string>`, never browser storage. It has the same `screenPlacementIssues` validation hook as Designer. Selecting/resetting a recipe or refreshing the page discards that example. Save and reopen operate only on the selected in-memory demo; reopen discards working edits and clears history through the ordinary bridge operation. Neither owner screens nor the current Designer screen are read or written.

Undo/redo, Inspector, Composer and Layers edits use canonical transactions. Structure moves use the same `structureMove` revision, draft, source identity and placement guards as Designer. Graph layout remains transient. Pending property/data drafts block selection, recipe changes, mode changes, history and structure moves. Subscriptions and the local simulation are cleaned up on unmount. Bridge initialization and URL query reading occur in `onMount`, so SSR does not access browser storage or globals.

Interact uses the existing local `createScreenSimulation` / `screenDispatcher` adapter for declared demo actions. It makes no provider or target-service calls. AI patterns demonstrate controlled host presentation states; approval-looking UI does not grant backend authority.

## Scope limits

The full Designer workspace chrome and AgentChat integration remain available through the explicit `/design` link. That existing workspace has its normal persistence semantics; it is not silently embedded in the disposable gallery. Provider execution, login/session handling, persistence and deployment are host services, not mocked gallery effects. RadioGroup and AppShell remain outside the existing 83-recipe palette; the showcase does not invent registrations for unsupported recipes. Shared primitive provider/portal/context parts are demonstrated through their valid family compositions rather than orphan renders.

## Validation

The focused `apps/studio/tests/showcase.test.ts` covers all 83 fixture compiles, canonical source selection, valid ancestor placement, deterministic fixtures, index equality, typed-list editing, undo/redo, memory save/reopen/reset, and supported/refused Structure moves. The two new Svelte files also receive a lightweight syntax compile. Production build, type checks, all-83 browser selection/render, visual review and final independent disposition are coordinated by the root agent against the next sealed candidate; source compilation alone does not claim those checks passed.

Builder observation, 2026-10-23 18:17 MYT: `npx vitest run tests/showcase.test.ts --maxWorkers=1 --no-file-parallelism` with the explicit metadata regeneration environment passed 4/4 tests (all 83 fixtures in the first test), one file, 24.01 seconds. Existing imported DocumentHost, RenderNode and StateValuesPanel emitted their already-present Svelte warnings. No browser or production build was run by this builder during this addition.

Preserved first combined strict-check failure: `docs/studio/cycle-1-3/upstream-fidelity/designer-check-complete-showcase.log` reported ten implicit-any callback parameter errors in the new `StudioShowcase.svelte`. The imported component declarations did not infer those callback types. The bounded repair adds explicit `boolean`, `string`, `UiValue` / `UiValue | undefined`, `UiRenderPlan`, and diagnostic object annotations at the affected callbacks. It changes no runtime behavior or public API and uses no suppressions. The root agent coordinates the strict-check rerun and next build; the original failed log remains evidence.

Final builder replay on product `748d9a6fa4ca9b2dee0445fa06b55b4e56ab8467`: the repaired strict Designer check passed with zero errors and six pre-existing warnings in three imported files. The AI package check passed 1,148 files with zero errors/warnings; the AI CSS build, Studio production build and separate packed-consumer production build passed. The first ten-error log remains retained. The new production manifest seals 271 files; the separate consumer uses the newly packed artifact with SHA-256 `ca7964e2f2ba4639d7c3d456e1abe8f168f4288266d29b8024b7db8531960e82`, no workspace links/aliases. Its install was an incremental artifact update in the previously isolated consumer, not a fresh-install claim. The final Studio composer replay passed 26/26 assertions using explicitly deterministic transport fixtures; earlier real-provider evidence remains separately labelled in the delivery report. See `cycle-1-3/upstream-fidelity/` final logs/metadata and the independent report for the combined runtime gate.

Independent final-showcase review on `748d9a6fa4ca9b2dee0445fa06b55b4e56ab8467` passed all83 live fixtures, canonical selected-source rendering, actual numberList draft/apply/history/memory save/reopen, unchanged owner storage,19 primitive families and native clipboard/portal/menu/scroller interactions. It then found one real mobile containment failure: the recipe select expanded to right421 at viewport390. The failed run `independent-showcase-2026-10-23T10-32-23-844Z` and diagnostic-only `independent-mobile-cause.json` remain evidence. Explicit minimum/maximum widths and border-box sizing on this new component's own labels/inputs/selects are the bounded repair in `8eb96dd8bcf7cfadd973e1f4fae7d11706a32797`. It changes no imported component, data flow, callback, public package or backend behavior. The earlier successful functional checks carry by that exact CSS-only diff; production rebuild and independent affected mobile/selection recheck must pass before readiness. Test injection itself is not a production pass.

Final independent disposition: **PASS — READY FOR OWNER REVIEW** on `8eb96dd8bcf7cfadd973e1f4fae7d11706a32797`. The rebuilt native selector is contained without injected styles at320/390/768/1440, with live recipe switching and no browser errors/backend calls (17/17). All83 live fixtures, private typed editing/history/save/reopen and19-family primitive checks pass or carry across the exact two-line sizing-only diff. See `UPSTREAM-FIDELITY-INDEPENDENT.md` for the precise evidence, failed observations, carries, scope limits and final artifact binding. The showcase is ready for the owner's review; it is not owner acceptance or Stage9closure.
