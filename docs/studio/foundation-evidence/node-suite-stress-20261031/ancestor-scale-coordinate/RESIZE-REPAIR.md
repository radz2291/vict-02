# G1 responsive resize repair — builder evidence

The independent RED commit `7a2fdc5690198899856bad7fa864c06eed910224`
was cherry-picked unchanged as `b70c15a4` on isolated
`codex/flow-ancestor-scale-resize-20261031`, following builder candidate
`0225c6678d681972e49b98d4edc66ace13562368`.

Its exact test was rerun before any source repair: **1 FAIL / 1 PASS**,
retained in `resize-builder-baseline-red.log`. A viewport resize changing only
computed ancestor scale from .5 to .25 left the old scale .5 active.

The bounded repair attaches the existing coalesced measurement scheduler to the
frame's own `ownerDocument.defaultView` resize event. Its teardown removes that
same listener; queued measurements retain the existing liveness fence. No
polling, global state, public API changes, new bounds, provider changes, camera
logic, native-event mutation or private XYFlow access was introduced.

Final validation: **46/46 tests PASS**, including the unchanged independent
two-case test, all previous 43 regressions and one new resize listener/coalescing/
queued-teardown case. Existing focused-draft/provider-isolation/source-preservation
checks remain green. Svelte check: **0 errors / 5 inherited warnings**.
Changed TypeScript ESLint and `git diff --check`: exit 0.

```text
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/coordinate-independent-observer.svelte.test.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/flow-coordinate-frame.svelte.test.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts packages/ui-flow-svelte/test/composition.svelte.test.ts packages/ui-flow-svelte/test/authoring.svelte.test.ts
npm run build -w @victframework/ui-flow-svelte
node node_modules/eslint/bin/eslint.js packages/ui-flow-svelte/src/flow-coordinate-frame.ts packages/ui-flow-svelte/test/flow-coordinate-frame.svelte.test.ts
git diff --check
```

Logs: `resize-builder-green.log`, `resize-builder-types.log`,
`resize-builder-lint.log`. The separate source concern about an active node drag
crossing a frame-supported/unsupported transition has not been reproduced or
tested as an end-to-end canonical write; it is unchanged and not claimed solved.

This is a builder repair, requiring independent recheck. Native packed geometry
and integrated acceptance remain HELD. No root worktree, root build output,
browser, app, provider, activation or remote was changed.
