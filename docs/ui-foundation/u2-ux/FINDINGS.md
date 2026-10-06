# Findings and failed observations — preserved

7 October 2026, builder observations before first committed candidate:

1. Initial server command failed: npm/Powershell argument forwarding and missing dependencies. Repaired locally by npm ci --ignore-scripts and direct Vite executable, own port 5197. No manifests or lockfile changed.
2. Initial full Svelte check returned 38 errors / 4 warnings. New errors (missing exported pseudo type, breadcrumb inference, missing store format, state name colliding with Svelte $state) repaired in scope. Generated SvelteKit sync run. Root tsc subsequently passed.
3. Existing EditorCanvas.svelte references UiRenderPlan without importing it. Existing workbench names a variable state and triggers $state shadow errors under broad svelte-check. Its check configuration excludes generated SvelteKit ambient types, causing $app/environment errors. These are outside writable scope; no global shim or suppression added. Manager request below. Root check:ui uses renderer-only configuration and reports 0 errors / 2 existing warnings; design-proof tsc passes. Broad Svelte check remains distinct and cannot be reported green.
4. Existing editor tooling tests first failed 3/3 due redesigned section placement/wording and text labels. UX-specific assertions updated to navigate Style, assert explicit browser values, use meaningful labels, and repopulate the selected condition input. All original semantic assertions retained. A bind-select synthetic-event mismatch then failed 1/3; explicit onchange used for condition/scope. Final 3/3 passed.
5. First browser probe targeted a display:contents text span: Puppeteer said it was not clickable. Changed to clicking rendered heading text; this is a harness correction, not a product pass.
6. Actual selection caused effect_update_depth_exceeded in Layers; selected ancestor reveal read and wrote expansion sets. Builder browser journey failed before text editing. Fixed with untracked expansion reconciliation; added exact-selection/loop regression. Re-run no page exceptions.
7. Clicking the center of a card selected its paragraph; the selected name correctly reflected that. Card-style journey uses the card border or the Service card row in Layers, rather than assuming any descendant selects its card.
8. Save/reload browser probe found padding reset to 0px despite saved canonical bytes: the review route initially SSR-rendered the seed's CSS while client-loaded saved source used a new revision. Repaired within the dedicated route by client-mounting the localStorage-backed renderer. Reload/reopen then preserved text, size, background and padding. No renderer or persistence implementation changed.
9. Builder inherited-origin test initially used innerText while Value origin was collapsed, so it could not observe that explanation. Verify by opening Value origin; do not count a hidden-text match as an experience pass.
10. Prettier cannot infer .svelte parser (project has no Svelte formatter plugin). Supported TS/JS/Markdown files formatted; no unrelated dependency installed.

## Precise manager requests

- Add UiRenderPlan to the existing type import from @victframework/ui in packages/ui-editor/src/EditorCanvas.svelte (onPlan prop).
- For broad Svelte checking, fix the existing workbench variable state naming conflict and include generated SvelteKit ambient declarations in the check configuration. These are manager-owned files; this branch deliberately supplies instructions instead of edits.
- Current underlying instance override API styles a component wrapper; per-inner-element occurrence overrides and instance text replacement remain unavailable. The UX exposes this existing limitation honestly; a future schema/API change is a separately governed manager decision.

These findings do not accept the pinned compiler repair or close U2. Owner acceptance remains pending.

11. Final broad check at initial candidate: 23 errors / 5 warnings. All 23 errors are in unchanged EditorCanvas and existing service/workbench paths. One new warning is the review-route canvas ref's non-reactive declaration; it is included in the bounded repair queue. Full output preserved in broad-svelte-check-initial.txt.
12. Root Prettier check after building failed on 44 generated design-proof build files and unchanged packages/ui/test/cascade-n1.test.ts (the pinned compiler repair). Scoped formatting of all edited TS/JS files passes. Generated output and compiler test are outside writable scope; no automatic global formatting run. The manager can extend .prettierignore for examples/ui-design-proof/build and format its compiler-repair test. Markdown is globally ignored by the existing formatter configuration, and .svelte has no bundled parser.

## Independent round-1 findings and bounded repair candidate

Fresh evaluator challenged exact pushed code 4d7b0670186a04411a51234d361bb8c9ef65fea1 in its own detached checkout/Chrome server. Its failed observations are preserved verbatim in independent-review/ROUND-1.md and its supporting evidence.

- M1: Collapsing a selected descendant's ancestor left zero visible Layers tab stops. Repair moves focusKey to the collapsed ancestor and supplies a visible fallback if a focused row disappears. Exact-selection/loop test extended with collapsed-tabstop assertion.
- M2: Reconnecting navigation discarded canonical parameter bindings. Repair keeps existing navigation params, matching action input preservation. New regression changes route.a to route.b and asserts unchanged params through the real UiEditSession.
- M3: Browser now values were stale after viewport/container resizing. Repair refreshes readEffective after preview size changes, window resize, and ResizeObserver callbacks, in addition to source/DOM ticks. Browser resize regression compares displayed font-size with actual getComputedStyle at 390 and 1440.
- Canvas ref non_reactive_update warning repaired with $state; broad Svelte check now 23 errors/4 existing warnings across unchanged files, zero diagnostics in new modules or review route.
- Adjacent in-scope improvements: Advanced attribute field populates from source, named-color swatches fall back to measured RGB, and the existing conditional style command builder is now publicly exported (additive only).

No engine/compiler/renderer/store/workbench/frozen file changed. These are builder repair claims until the fresh evaluator rechecks the exact repair commit.

## Independent round 2 and handoff

The independent evaluator rechecked exact pushed repair d0ba90cfcd5efead2b7c7c82d37a2ed29483d715 in another fresh detached checkout. Verdict: PASS WITH NON-BLOCKING FINDINGS. ROUND-2.md and round2/ evidence are imported verbatim; round 1 remains FAIL in its original report. M1 keyboard reentry, M2 same/new-route bindings, M3 actual/display viewport/container measurements with no dirtying, and L1 warning removal all passed. Attribute population, named-color swatch and additive public export also passed.

Independent renderer 120/120, design 12/12, root TypeScript and production build pass. Broad Svelte check remains red at 23 errors / 4 existing warnings in unchanged files; manager requests above still apply. A failed Vite navigation-context harness run is preserved separately in round2/failed-journeys.json, followed by the completed fresh run with zero page exceptions. No failed observation is discarded or relabeled.

Final evidence-only handoff preserves implementation bytes from the tested repair candidate. Owner experience acceptance, compiler-repair acceptance and U2 closure remain PENDING. The next allowed action belongs to the overall U2 manager: integration and independent verification of the combined candidate.

Final artifact whitespace check reported trailing blank lines in the two imported round-2 evaluator harnesses. These evidence files are retained verbatim; implementation files have no new whitespace errors. This observation does not affect the independently tested implementation bytes.
