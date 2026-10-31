# G1 resize — independent repair recheck

**QUALIFIED OFFLINE PASS: G1 resolved.** This clears the bounded responsive
ancestor-scale invalidation finding. Native packed geometry, whole integrated
candidate/protocol acceptance, owner acceptance and Stage9 closure remain HELD
or outside this verdict. This report supersedes the initial `INDEPENDENT.md`
FAIL only for the exact repaired geometry source; the red evidence is preserved.

Reviewed builder repair `a9ce673cb21a67649522103ab82abd7308ecd21d` as integrated
at exact `760b3d02f6525e9884d840f9f598609def1e073f`. New isolated branch
`review/ancestor-coordinate-resize-20261031` starts directly at that integrated
commit. The prior review branch and original failure commit
`7a2fdc5690198899856bad7fa864c06eed910224` remain intact. Starting tree was clean;
origin/main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. The other track's
uncommitted PortRow/descriptors/metadata changes were neither imported nor edited.

## Bounded source audit

Relative to the failed integrated b865 source, production geometry changes add
only a resize event subscription to the measured frame's own
`ownerDocument.defaultView` and matching removal using the same callback. Both
events use the existing coalesced scheduler. Teardown marks the observer dead
before disconnect/removal, so an already queued measurement does not publish.
No polling, private engine field, global store, native-event mutation, remount,
new bounds, changed camera policy or source/history authority was introduced.

The integrated `flow-coordinate-frame.ts` blob matches the repair builder's
`f778cecd` blob exactly. The original two-case independent test is byte-unchanged
from7a2, not weakened. Its responsive0.5→0.25 computed-scale/window-resize case now
passes. The new builder lifecycle case additionally checks coalescing, listener
identity removal and queued/post-destroy silence. The public provider-local
min/max and viewport APIs, scale conjugation, logical source units and integrated
GraphViewport edge-v3 appearance projection remain as previously inspected.
This is not an independent acceptance of that appearance protocol or its adapter.

## Independent execution

At exact760b, from repository root:

```
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/coordinate-independent-observer.svelte.test.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/flow-coordinate-frame.svelte.test.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts
```

**22/22 PASS, four files, exit0**, `resize-independent-green.log`.
This includes the original responsive and queued-teardown/sibling tests, new
resize coalescing/removal case, pinned-engine screen pan/node movement/wheel
anchor/clamp/recovery, depth3 products, parent zoom preserving logical camera and
the same focused input/value, own-provider sibling isolation, handle coordinate
algebra and unsupported initial rotation/nonuniform/reflection refusal. Existing
Svelte warnings remain visible. The earlier independent43-case baseline and
builder46/type/lint results retain their recorded scopes; these overlapping
batches are not summed as unique tests. A broader rerun solely for a timestamp
was not performed after this four-line lifecycle change.

## Remaining native boundary

HappyDOM supplies explicit rectangles/computed dimensions and fixture-only
auto-pan settings. These checks cannot replace real painted-browser layout,
port/edge paths, source-backed connection/reconnection, native fit/minimap or
actual application persistence/history proof. Root must associate the exact fresh
packed artifact with native screen delta, cursor anchor, node/port geometry,
changed parent zoom/depth2/depth3, focus and source/history results before awarding
the complete camera repair. The earlier actual native geometry failure remains.

The active-gesture supported→unsupported-frame transition remains the previously
disclosed source concern: it has not been reproduced as an end-to-end canonical
write and is not claimed fixed or certified here. Static unsupported-frame refusal
passes. No additional defect is inferred from that uncertainty alone.

Verifier changes are this report and retained output only. No root worktree,
browser, dist, serving process, owner source, provider, security setting or remote
was modified. Next allowed action is integration of this local scoped evidence
and the already authorized native packed recheck; no push or closure follows.
