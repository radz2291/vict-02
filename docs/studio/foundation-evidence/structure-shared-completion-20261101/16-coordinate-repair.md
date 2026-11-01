# Nested coordinate repair

Frozen product source: **20e26253f0ec6aab20f480c1b3e537e2282938d8**. This record describes the repair and source checks; native verification is pending at writing.

The earlier post-interaction endpoint pass in `10-live-endpoints.json` remains valid only for that observation. A fresh load of source112 exposed persistent Social-only wire errors up to26.677px horizontally and14.324px vertically (`14-final-geometry.json`, `15-settled-before-fix.json`). Poster and outer edges remained aligned. The adverse observations are retained.

The Social frame had an actually uniform ancestor matrix0.175699. Its736.8-by378.4 computed size and129.454788208-by66.484451294 rectangle produced scale ratios0.175698681064 and0.175698867056. Their difference1.859918e-7 narrowly exceeded the old1.756989e-7 allowance, so the observer incorrectly published unsupported scale1 and displayed the uniform-frame warning (`15-false-unsupported-frame.json`).

The shared observer now adds a screen-edge precision allowance, converted separately by each logical dimension, while retaining the computed-CSS relative allowance. Positive isotropic ancestor matrices and individual CSS scale values are independently required; genuine anisotropy, rotation, reflection, skew and perspective remain refused. ComposedGraphNode also observes its nearest coordinate scale and refreshes the existing public handle cache after the DOM tick, without replacing its content ResizeObserver or touching sibling/source/history state.

Checks are deliberately separate:

- Pre-repair observer snapshot:5 expected failures and3 passes, including the captured Social refusal and anisotropy negatives (`16-coordinate-precision-red.log`).
- Builder affected regression:45/45 across9 files (`16-coordinate-precision-green-restored.log`); Flow build0 errors and5 existing warnings (`16-coordinate-precision-build-restored.log`).
- The parent shortened an equivalent expected numeric literal after ESLint rejected excess precision. Final targeted recheck:8/8 (`16-coordinate-precision-final-literal.log`); failed/final lint logs are retained. These8 overlap the45.
- Independent reviewer:2 separate recovery/teardown tests passed (`independent-precision-lifecycle-explicit-runner.log`, `independent-coordinate-repair-source-review.md`). They are not builder or native endpoint proof.

An independent `pnpm exec` attempt unexpectedly bootstrapped installation and moved original dependencies. It was stopped; the parent restored15 originals without overwriting destinations (`16-toolchain-originals-restored.json`). Builder archival reruns during the interruption failed before execution; those logs remain. The restored successful runs used explicit Node tool paths. No dependency manifest/lock changes were part of this repair.

Required next proof: activate the exact sealed candidate, remeasure all24 actual-app edges after a fresh load, confirm containment/typography and unchanged saved r1.r18 source/export, and obtain the independent final disposition. No native pass or closure is awarded here.
