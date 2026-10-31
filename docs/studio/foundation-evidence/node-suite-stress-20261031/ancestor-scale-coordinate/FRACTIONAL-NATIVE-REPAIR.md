# Native false-refusal follow-up — builder candidate

Exact base: `fae2e9e053fe34d3c7d4bf618488538e800318ac`.
Isolated branch: `codex/flow-coordinate-browser-refusal-20261031`.

Root's actual seven-package consumer qSyhak at fae2 refused all three frames,
including the outer frame with no transformed ancestors. All engines were inert.
The native failure and screenshot are preserved by root commit `acbb15ce`,
`24-native-coordinate-frame-refusal.json/png`; additional ancestor observations
are `24-native-frame-ancestor-transforms.json`. No activation occurred.

The observed outer fresh computed size was 1215.2 by 718.4 and fresh rectangle
1215.2000732421875 by 718.4000244140625. Nested dimensions were 736.8 by 378.4
with rectangle 236.7107391357422 by 121.5680694580078. These pairs satisfy the
existing uniformity test. Ancestor transforms observed by root were ordinary
positive 2D matrices; rotate and individual scale were none. Automation-scope
DOMMatrixReadOnly being unavailable does **not** establish its availability in
the application realm. Actual RO contentRect was not instrumented under the
browser's read-only policy.

The source mixed cached RO contentRect dimensions with a fresh transformed DOM
rectangle. That is independently defective when RO dimensions are stale or
quantized differently. The bounded repair uses fresh owning-window computed
pixel width/height and fresh rectangle together. RO is now only an invalidation
signal. ResizeObserver and DOMMatrixReadOnly are explicitly obtained from the
owning window. Transform and positive/uniformity guards, their tolerances,
public provider-scoped viewport APIs and logical camera policy are unchanged.
No offsetWidth inference, polling, private engine, native-event rewriting or
new size/count bound is introduced.

## Checks

Two controlled regressions use the exact native fresh computed/rect pairs and
deliberately differently quantized RO samples. They fail before the repair
(2/2 RED, `fractional-native-hypothesis-red.log`) and pass afterward. The RO
samples are synthetic, not claimed to be native observations or proof of the
exact native cause. A third test confirms fresh layout sizing during resize
before the next RO callback; cached dimensions would supply a wrong scale.

```text
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/coordinate-fractional-native.svelte.test.ts packages/ui-flow-svelte/test/coordinate-independent-observer.svelte.test.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/flow-coordinate-frame.svelte.test.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts packages/ui-flow-svelte/test/composition.svelte.test.ts packages/ui-flow-svelte/test/authoring.svelte.test.ts
npm run build -w @victframework/ui-flow-svelte
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/coordinate-fractional-native.svelte.test.ts
node node_modules/eslint/bin/eslint.js packages/ui-flow-svelte/src/flow-coordinate-frame.ts packages/ui-flow-svelte/test/coordinate-fractional-native.svelte.test.ts
git diff --check
```

Full focused run: **48/48 PASS**. After adding only the third regression,
fractional tests **3/3 PASS**, yielding **49 unique passing cases** with unchanged
production bytes. Svelte **0 errors / 5 inherited warnings**. Changed TS lint
and diff check exit 0. Logs `fractional-native-focused-green.log`,
`fractional-native-final-three.log`, `fractional-native-types.log`,
`fractional-native-lint.log` retained alongside RED.

This repair is builder evidence, not an independent or native verdict. The exact
cause of the observed native refusal remains qualified until a fresh packed
consumer demonstrates supported frames and correct geometry. Independent source
recheck, actual bbox pan, wheel focal anchor, node/port geometry, parent zoom and
final artifact association remain HELD. The separate unsupported-transition
in-flight drag concern is unchanged. No root worktree/dist, browser, app source,
provider, activation, remote or publication was changed by this agent.
