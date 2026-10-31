# Public Flow navigation scope review

Read-only review of root fd279110 and 0a03e415818eb93c339e0d7932e9d49a33fa026b on 2026-10-31. The root moved between those commits while reading; the Flow package diff between them was empty. This note preserves a source audit, not native-browser proof or an independent gate verdict. No product changes, rebuild, browser interaction, activation or push.

## Existing supported behavior

- Authored `vict.flow.viewport@1/@2` accepts `height` and `label`, not camera action props: `packages/ui-flow-svelte/src/composition/descriptors.ts:13–15` (same implementation for both revisions).
- `GraphViewport.svelte:70–71` defaults height to 480px and clamps it to 160–2000px; camera zoom is 0.1–2. `:12` restores occurrence presentation state; `:27` remembers viewport changes; `:81` requests initial fitting only without a restored viewport. Later source edits do not continuously refit the camera.
- Pinned XYFlow defaults supply background-drag pan, wheel zoom, double-click zoom and pinch zoom: installed `node_modules/@xyflow/svelte/dist/lib/container/SvelteFlow/SvelteFlow.svelte:57–63`. Shift drag selects; node dragging is separate from background panning.
- `packages/ui-flow-svelte/src/FlowNavigation.svelte:20` initially fits with zoom 0.15–1.1 and padding 0.2. `:30–44` waits for viewport readiness and every node's measured size. Explicit requests at `:45–54` can fit selected IDs or the graph, using zoom 0.35–1.1 and 200ms animation. These minimum zoom choices mean a sufficiently spread-out graph is not guaranteed to fit completely.
- `packages/ui-flow-svelte/src/index.ts:3,6` exports `FlowCanvas` and `FlowNavigation` for code consumers. `FlowCanvas` supports bound viewport; `FlowNavigation` must be within the public Svelte Flow context. Neither creates a declared authored-workspace fit/focus/zoom action.
- `packages/ui-flow-svelte/src/composition/GraphWorkspace.svelte:66–73` handles content outputs `operation`, `undo`, `redo`; other names emit `applicationAction`. A guessed `fit` or `focus` output does not navigate the viewport. `:78,92–94` stores occurrence viewport/selection through host presentation controllers; this is retained presentation state, not a reactive camera command. See `src/editor/host.ts:46–72`.

## Practical existing-contract guidance

Use a generous main viewport around 700–1000px and compact nested three-step viewports around 400–600px, sized with their cards. Arrange nested graphs compactly left-to-right and choose readable spacing. App-owned summaries/toggles can reduce expanded body size. Choose explicit `vict-graph-drag-handle` elements and `nodrag nopan nowheel` on native controls or scroll regions (`packages/ui-flow-svelte/README.md:79–80`). Ordinary authored buttons may invoke valid graph `moveNodes`, Undo or Redo operations, but canonical repositioning must not be presented as a camera-only Fit action. No new toolbar API is proposed.

For actual native verification: pan on empty canvas, then zoom using wheel/pinch; separately verify wheel and typing inside ordinary controls. Initial fit and camera retention are different observations from authored position/history changes. Do not assume a workspace automatically refits after additions or on every source echo.

## Policy distinction

The 2000px viewport-height upper clamp is an arbitrary **visual presentation restriction**, not a graph/source content quota, evidence truncation, security boundary or work budget. The 160px minimum and positive zoom range are chosen usability/camera geometry policy, likewise not count or work admission limits. This finding is recorded separately from the removed content/evidence/transport quotas; this audit changes neither height nor zoom policy. It makes no universal claim that all limits have been removed. Actual application source and current live Studio remain unchanged.
