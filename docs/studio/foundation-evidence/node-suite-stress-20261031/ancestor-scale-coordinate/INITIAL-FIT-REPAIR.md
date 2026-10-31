# Initial fit / coordinate layout readiness — builder candidate

Base `efa28ff414ab62cc5e3abfed5deeea9c275edb38`, isolated branch
`codex/flow-coordinate-initial-fit-20261031`.

Root's fresh installed sPzwYN native preview at this base cleared all three
guard alerts/inert states. Root measured Social pan exactly +30/+10 screen pixels
and wheel focal error approximately -0.000254/-0.000221 pixels, with enclosing
and sibling cameras unchanged. These are root observations, not this builder's
independent native evidence. Initial nested fit still failed: Crop was beyond
the clipped inner viewport. Root preserved
`25-native-geometry-partial-and-initial-fit-failure.json/png`. No activation.

The public pinned `@xyflow/svelte@1.7.0` binds its own wrapper clientWidth and
clientHeight to its provider store width/height. Public fitView uses those
dimensions. They are explicitly documented advanced fields of
[SvelteFlowStore](https://svelteflow.dev/api-reference/types/svelte-flow-store).
This candidate **reads only width/height**, inside the same owning provider,
without using private engine/context keys or writing store geometry. Existing
documented setMinZoom/setMaxZoom actions and public viewport setter are unchanged.

The internal coordinate frame now publishes its fresh expected engine width and
height (logical CSS dimension times ancestor scale). FlowNavigation waits for
the provider's observed dimensions to match, allowing integer client-dimension
quantization of one CSS pixel. It then captures a layout signature across the
queued public fit: a fit belonging to the preceding coordinate frame cannot
settle initial readiness. Once current dimensions arrive it can retry. After a
successful initial fit, later parent zoom/size changes do not trigger another
fit, preserving camera/user navigation. Restored camera behavior, logical fit
range .15..1.1 and padding .2 remain unchanged. There is no polling, event rewrite,
new task/content bound, replacement fitter or raw exported FlowCanvas change.

## Regression evidence

New navigation-layout tests mock only the public hooks to drive reactive layout
readiness and pending fit settlement. With exact base FlowNavigation temporarily
restored in this isolated checkout they give **2 FAIL / 1 PASS**, retained in
`initial-fit-baseline-red.log`; repaired source was restored afterward.
They now pass all three cases:

- Old 737x378 provider dimensions cannot fit a frame whose actual engine is
  approximately 237x122. Matching dimensions allow exactly one fit; subsequent
  ancestor zoom preserves the same focused input and unsaved value without refit.
- A pending old-frame fit cannot settle after frame units change; retry waits
  for the new 368x189 dimensions before settling once.
- Resolving a pending public fit after teardown cannot settle the destroyed host.

These controlled hook tests do not prove native layout or actual fit placement.
The existing real pinned mounted pan, node drag, wheel focal anchor, clamp,
parent-zoom and sibling-isolation checks were rerun unchanged.

```text
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/navigation.svelte.test.ts packages/ui-flow-svelte/test/navigation-layout.svelte.test.ts packages/ui-flow-svelte/test/coordinate-fractional-native.svelte.test.ts packages/ui-flow-svelte/test/coordinate-independent-observer.svelte.test.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/flow-coordinate-frame.svelte.test.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts packages/ui-flow-svelte/test/composition.svelte.test.ts packages/ui-flow-svelte/test/authoring.svelte.test.ts
npm run build -w @victframework/ui-flow-svelte
node node_modules/eslint/bin/eslint.js packages/ui-flow-svelte/src/flow-coordinate-frame.ts packages/ui-flow-svelte/test/navigation-layout-state.svelte.ts packages/ui-flow-svelte/test/navigation-layout.svelte.test.ts
git diff --check
```

Exact final source: **57/57 PASS**, Svelte **0 errors / 5 inherited warnings**,
changed TypeScript lint and diff check exit 0. Logs `initial-fit-final57.log`,
`initial-fit-final-types.log`, `initial-fit-lint.log` retained. The initial
focused run and navigation-only compatibility runs are retained too.

## Limits / next gate

This source repair covers FlowNavigation callers: composed workspace viewport
and retained editor. The read-only authored canvas still has the existing
upstream built-in fitView path; its analogous readiness risk is unproven and
unchanged. The separate unsupported-transition in-flight drag concern is also
unchanged. This report awards neither those scopes nor a complete camera verdict.

Independent review followed by a fresh installed native preview must establish
initial inner-card visibility, clipping/fit, preserved exact pan and wheel
behavior, node/port geometry, parent zoom, focus/source/history and final artifact
association. The native causal hypothesis remains qualified until that check.
No root worktree/dist, browser, actual app source, provider, activation, push or
publication was changed. This is builder evidence, not an independent verdict.
