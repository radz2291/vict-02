# PV13 positioned-root crop repair candidate

Base: `2753605bc8bce77a6d77615c9b1ac54151d58b88`, with public package runtime
bytes unchanged from `7228ee3ccae4364da63a346c46010dde19b1992d` before this fix.
Branch: `codex/studio-positioned-capture-crop`.

The independently generated raw full and crop JPEGs and paired actual DOM
measurements are retained here. The full image is correct, including the runtime
`Raster final proof` name and one-line date. The 420 × 460 crop reports source
642 × 732 and offsets 30 × 221, but visibly starts near full-image offset
60 × 441. The root has `position:relative;left:-30px;top:-220px` in the actual
fixture. Those external source-position offsets survive cloning and are applied
again before the SVG viewBox crop. The specialist viewed both original JPEGs.

The public helper now passes zero left/top and auto right/bottom insets to
html-to-image's clone-only root style override. Measured source bounds already
account for the external root position. Root position mode remains intact so
descendant containing-block behavior is preserved. Descendant styles, source
DOM, canonical fixture, returned bounds/crop metadata and pixel/byte budgets
are unchanged. The positioned fixture is intentionally retained.

`regression-before.log` records two new regression failures before the fix,
with the original two tests still passing. Both relative and absolute root
cases retained `left:-30px`. `regression-after.log` records all four passing
after the fix. The tests model the upstream clone-only root style application,
assert the exact scaled viewBox/crop, preserve descendant offsets and source
DOM, and retain budget coverage. Their image encoder is stubbed; they do not
establish browser raster fidelity. Targeted TypeScript check passed (`types.log`).

Actual raw full/crop fidelity must be rechecked using the newly packed public
helper and the same positioned fixture before acceptance. That evidence is
recorded separately; this initial commit is a builder candidate, not a verdict.
