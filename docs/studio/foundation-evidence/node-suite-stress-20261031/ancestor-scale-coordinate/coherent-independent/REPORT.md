# Independent coherent-coordinate measurement recheck

**QUALIFIED SOURCE/FIXTURE PASS** for exact repair
`4360c8bfdd1d82d6edf727289f7b7ae2a9f17d4b`, based directly on final guidance
candidate `fae2e9e053fe34d3c7d4bf618488538e800318ac`. No new bounded source blocker
was identified. **Native repair success and the actual native cause remain
unproved here.** Packed artifact, activation and whole-candidate/owner acceptance
are not awarded.

Fresh isolated branch `review/coordinate-coherent-measurement-20261031` starts
directly at4360. Earlier review/failure branches remain preserved. The integrator
checkout, dist, browser, native application, provider/security settings and remote
were not modified. This review adds diagnostic tests/evidence only.

## Observed failure versus source hypothesis

The retained native receipt at source fae2/qSyhak shows all three actual exported
r1.r12 frames inert, including the untransformed outer frame. This contradicts
its earlier fixture-only source pass; it must not be relabelled as successful
native geometry. Root recorded the receipt in acbb15ce. The independently copied
`native-observation.json` has SHA256
`60d93b7b57a7156749f8840d5642cc7f740216738a90196242894b916756ccb0`.

All three captured fresh computed CSS width/height and transformed rectangle
pairs satisfy the existing uniformity test. Actual ResizeObserver contentRect
values were not recorded. An unavailable constructor in the automation evaluation
scope does not establish absence in the application's own window. This reviewer
performed no one-shot page instrumentation and makes no stronger native-cause
claim from those records.

The old source did mix cached RO dimensions with a fresh transformed rectangle;
synthetically stale or differently quantized notifications can independently
cause false refusal or wrong scale. Removing that mixed-time measurement is a
valid bounded correction, without proving that this alone explains the native
failure. Fresh packed native verification is still necessary.

## Source assessment

RO now invalidates measurement rather than supplying authoritative dimensions.
Each pass reads current owning-window computed pixel dimensions and current
rectangle together. Owning-window ResizeObserver and DOMMatrixReadOnly replace
ambient constructors. The source retains the exact positive/uniformity tolerance,
rotation/nonuniform/reflection checks, initial hidden/zero-size behavior, window
resize scheduler and teardown/liveness fences. No tolerance relaxation, polling,
offsetWidth inference, private engine/store, native event rewrite, remount or new
quota was introduced. The production diff is only `flow-coordinate-frame.ts`.
Public provider-local viewport synchronization, logical source coordinates,
canonical history and connection authority are unchanged.

## Independent challenge

New `coordinate-coherent-independent.svelte.test.ts` has four cases:

- Reads all three captured frame pairs directly from the retained native JSON,
  not hand-rounded fixture copies. Each publishes supported scale from the fresh
  pair. Delivering deliberately synthetic stale RO dimensions afterward leaves
  that result intact. The synthetic dimensions are not claimed native values.
- Uses a separate iframe document with its own RO/matrix constructors while
  host-window constructor use throws. Supported measurement succeeds, proving
  correct owning-window lookup. A delivered callback after destroy does not
  publish, and the owning observer disconnects.

From repository root:

```
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/coordinate-coherent-independent.svelte.test.ts packages/ui-flow-svelte/test/coordinate-fractional-native.svelte.test.ts packages/ui-flow-svelte/test/coordinate-independent-observer.svelte.test.ts packages/ui-flow-svelte/test/flow-coordinate-frame.svelte.test.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts
```

**29/29 PASS, six files, exit0**, `focused-green.log`. This includes the new4,
builder fractional/stale-layout3, original responsive invalidation/teardown2,
coordinate algebra/handle/unsupported-frame/lifecycle12, pinned D3/focus/provider
case1 and nested-camera7. The pinned mounted sequence retains depth3 pan/node
movement, wheel focal anchor, logical clamp/recovery, changed parent zoom,
same focused input/value and sibling own-provider isolation. Static unsupported
rotation, nonuniform dimensions and reflection still refuse; cleanup/coalescing
checks remain green. All use explicit HappyDOM layout evidence and are not painted
native measurements. Existing renderer warnings remain visible.

New independent test ESLint exits0 (`lint.log`). Builder49 unique checks/types0
errors/5 inherited warnings retain their separate scope; overlapping counts are
not summed. Builder hypothesis RED remains preserved. No production source was
changed to obtain this independent green.

## Remaining boundary

Associate exact fresh built public bytes, then test the actual exported app's
supported frames and measured node bbox deltas, cursor-anchored wheel zoom,
parent zoom/depth2/depth3, ports/painted connections and focus/source/history
preservation. Neither successful captured-pair replay nor synthetic stale RO
reproduction substitutes for that native gate. The separately noted active
supported→unsupported in-flight gesture concern remains unproved and unchanged;
this review does not invent a demonstrated second defect or certify that case.
No activation, push, publication, milestone acceptance or Stage9 closure follows.
