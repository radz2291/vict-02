# Independent coordinate repair source review

The proposed two-file shared Flow repair is suitable for a new frozen candidate,
subject to final installed-artifact and native verification. It does not yet
resolve the independent integration HOLD recorded against source 112.

The captured Social frame is genuinely uniformly transformed, but its independently
quantized rectangle dimensions produce x/y scale ratios differing by
1.859918e-7, just above the former 1.756989e-7 relative allowance. The old observer
publishes unsupported scale 1 for that frame, while its nearly identical Poster
sibling passes. Persistent native mismatch receipts 14/15 are retained.

The repair adds a bounded screen-coordinate precision allowance, converted to
ratio uncertainty separately for each logical dimension. Independent ancestor
matrix and individual CSS scale isotropy checks prevent the broader rectangle
allowance from accepting actual transformed anisotropy. Existing positive/finite,
rotation, reflection, skew and perspective rejection remains. No new source,
history, layout-engine or persistence authority is introduced.

ComposedGraphNode separately tracks its nearest coordinate context and refreshes
its existing public XYFlow handle cache after the existing tick boundary. This
does not replace the content ResizeObserver or share state across sibling graphs.
The mounted guard prevents delayed refresh after destruction.

The builder's targeted tests include the exact captured uniform rectangle and
adversarial matrix/individual-scale mismatches. This reviewer additionally ran
two scoped tests: uniform-to-unsupported-to-uniform observer recovery with teardown,
and destruction before the queued coordinate refresh. Both pass with explicit
Vitest 4.1.11; see independent-precision-lifecycle-explicit-runner.log. These are
source/lifecycle tests, not a substitute for native endpoint measurements.

The initial attempt to invoke pnpm exec unexpectedly bootstrapped dependency
installation and was stopped. Its output is retained in
independent-precision-lifecycle.log and is not counted as a test run. The integrator
restored 15 original moved packages without overwriting destinations and recorded
16-toolchain-originals-restored.json. The explicit-runner test then passed.
package.json, package-lock.json and pnpm-lock.yaml remain unchanged by git diff.

Final acceptance still requires the exact candidate's sealed package/build identity,
all 24 actual-app edge endpoints, containment, typography, and unchanged saved
r1.r18 source/export. The earlier adverse geometry must remain visible.
