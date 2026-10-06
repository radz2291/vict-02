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
