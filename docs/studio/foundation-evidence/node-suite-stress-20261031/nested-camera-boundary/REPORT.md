# Nested Flow camera ownership repair candidate

Owner authorized this bounded package repair after actual Studio clear-area inner pan/wheel gestures failed with all three camera transforms unchanged. Actual evidence remains root-owned (`19-native-inner-pan-zoom.json`, `19-native-inner-camera-clear-area-failure.json`); this checkout neither modifies that source nor claims a repaired native-browser pass. Isolated baseline: da74a9dfa9fccbc5352fa569d5161577018abfc0 on codex/nested-flow-camera-20261031. No activation, browser, provider, application-data change or push. This is a builder candidate pending independent challenge and native follow-up.

## Cause and bounded change

Pinned @xyflow/system dist/esm/index.mjs:2748 uses `event.target.closest(class)` across owning flow roots. Its filter at 2919–2927 rejects a wheel beneath any nowheel ancestor and a pan beneath any nopan ancestor. The outer XYFlow NodeWrapper itself sets class:nopan={draggable}; removing an authored body wrapper's guards therefore cannot restore nested empty-pane panning. The authored wrapper additionally blocks nested wheel zoom through nowheel.

A small internal action translates guards using the existing public SvelteFlow noPanClass/noWheelClass props and unique per-surface classes. Capture listeners inspect only ancestors inside the owning surface. A deeper surface owns its gesture, so enclosing cameras remain guarded. The owning surface still respects its local nopan/nowheel controls, ports, nodes and scroll regions; its next empty-pane gesture clears any preceding control guard. No event is cancelled or redirected, no upstream/private store is used, and no source/graph/history transaction or public authored schema is added. Classes are runtime DOM metadata and listeners are removed on destruction.

The same mounted probe reproduced retained GraphSurface and read-only authored FlowCanvas failure. Their nested teardown also failed because pinned SvelteFlow expected its own provider. Explicit public SvelteFlowProvider wrappers isolate them, matching the existing GraphViewport pattern. With provider isolation alone both retained surfaces still failed camera gestures; that distinct RED is preserved. They now use the same internal guard action. The raw exported FlowCanvas wrapper and explicit caller class policies remain unchanged.

## Checks and retained observations

- Definitive corrected-coordinate baseline: 4 failed composition regressions, 1 unaffected outer-camera pass, 2 compatibility cases deliberately skipped. This includes pan failure with only the mandatory outer XYFlow nopan class and no authored body guards.
- Retained surface provider-only baseline: both editor/canvas camera regressions fail with unchanged transforms (composition cases pass).
- Final candidate: 31/31 tests PASS across nested-camera.svelte.test.ts (7), composition.svelte.test.ts (17) and authoring.svelte.test.ts (7).
- Gesture tests use real pinned XYFlow/D3 through mounted DocumentHost and ordinary synthetic DOM events. Repeated nested siblings preserve independent cameras; wheel/pan changes only the owner; local input gestures leave all cameras unchanged; subsequent empty gestures recover; outer gestures remain usable; no canonical source writes occur. All observed transforms must be finite. Retained surfaces pan/zoom and unmount successfully.
- Svelte-check: 0 errors / 5 inherited ui-svelte warnings. Source/test whitespace check PASS.

Initial probe logs are retained, including an invalid intermediate $props.id placement compile error and HappyDOM WheelEvent's ignored client coordinates. The initial accepted-wheel probes did not assert finite coordinates and are superseded by the definitive finite-coordinate checks, not presented as final validation. The synthetic wheel event now explicitly supplies clientX/clientY; final tests reject NaN/Infinity camera transforms.

Run: `node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts packages/ui-flow-svelte/test/composition.svelte.test.ts packages/ui-flow-svelte/test/authoring.svelte.test.ts`. Types: `node node_modules/svelte-check/bin/svelte-check --tsconfig packages/ui-flow-svelte/tsconfig.json`.

Dependencies are linked to existing installed modules; no installation or root compiled-package mutation. Shared ui-svelte dependency resolves through the earlier isolated capture checkout, while all changed Flow source and tests execute from this checkout. This is source-level mounted proof, not packed-artifact or actual browser proof. No broader suites or production build were run. Next: independent exact-candidate review, parent integration/build and native nested empty-area pan/zoom/control/source ownership follow-up.
