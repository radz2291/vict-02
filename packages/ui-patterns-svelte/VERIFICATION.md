# Package F builder verification

2026-10-27, isolated branch `codex/authoring-foundation`, review baseline `9b0cb3e29c1bfdf13cb6d8721a1b4ac928ace535`. This is builder evidence only; no independent gate or owner acceptance is claimed.

Implemented exact revision-1 contracts for drawer, carousel, adaptive navigation, filtered list and first-visit memory. Production registration uses retained descriptor/capability compatibility pins. Examples compile and run through the public canonical renderer; no generated alternate frontend, private CSS selector patch or additional application execution engine is introduced.

Checks performed:

- Focused `vitest` consumer suite: **14/14 PASS**, one file. Registry and all five authoring seeds; actual drawer open/Escape/Tab/focus-return/backdrop; body scroll isolation; carousel previous/next/swipe; actual navigation selection; actual list filtering/no-results; first-visit dismissal across remount; external popup acknowledgement; campaign/application/session/reset isolation; invalid and unavailable memory; authored CSS preservation; nested viewport lock lifetime and deterministic search/slide boundaries. Only inherited renderer Svelte warnings were emitted.
- Package `svelte-check`: 0 errors / 0 warnings after resolving the retained example and target-attribute typing failures.
- Scope stays in `packages/ui-patterns-svelte/**`; no commits or pushes were made by this builder.

Retained red/setup evidence:

1. The first broad source check ran before core package declaration exports were built. Missing `@victframework/ui` types produced cascading errors. The package now has explicit source paths for its focused source check; final root build remains a separate integration gate.
2. Two example text nodes incorrectly used `text` instead of canonical `content`. Type checking detected them and both were corrected before successful canonical-consumer tests.
3. Initial test collection failed at a transform-cache rename in a sandbox temporary directory outside the intended workspace. No tests collected. Later runs set process-local TEMP/TMP to the package's ignored `.tmp` directory under the permitted workspace.
4. Preserving authored classes initially exposed a TypeScript mismatch after the shared presentation attributes acquired an explicit interface. Optional-target inference corrected it; no cast or validation weakening was needed.
5. The first package patch was automatically rejected against the historical review-only instruction. No write executed. Root supplied the later actual owner approval superseding that instruction; the single authorized retry succeeded.

Remaining integration evidence: install the package into Studio's family registry and package dependency graph; establish the positioned/clipped owned application viewport; compose popup visibility/dismissal intentionally; exercise representative apps and shared history/save/reopen; perform exact-candidate independent verification and real browser/device checks. Unit/DOM tests are not visual geometry, assistive technology, touch-device or production acceptance. No requirement is moved to Milestone 2.

## 2026-10-28 architecture conformance repair

Builder candidate in the same isolated checkout; no commit, push, browser operation or provider invocation by this builder. Earlier evidence and failures above remain historical.

Ordinary pattern controls now compose the public VICT catalog `Button.Root` with existing shared presentation classes. This public primitive preserves icon/label snippets that the label-only public application Button cannot carry. Native search uses the established `vict-input` presentation. No separate palette or application action engine is added.

Drawer uses the public catalog `Dialog.Root/Trigger/Overlay/Content/Title/Close` and its real Bits focus/dismissal machinery. It remains inline inside its owner; global scroll lock is disabled and the existing owned viewport lock is retained. Backdrop part styling applies to the actual shared overlay. Close focus uses the target document's element constructor and visibility, including iframe and external-trigger cases. The exported focus helper excludes hidden/inert/computed-hidden ancestors and disabled fieldsets while retaining their first-legend exception.

Carousel now retains generated slide-part classes and resolves images through shared `MediaImage` and the nearest application asset host. Native image drag cannot consume the carousel gesture; pointer cancellation cannot advance a slide. Canonical props, outputs, revisions, local state, campaign persistence and icon slots are retained.

Final focused checks:

- `npm run test --workspace=packages/ui-patterns-svelte`: **25/25 PASS** across two files (23 registered-consumer cases and two focus cases), log `Temp/vict-patterns-conformance-sealed.log`, exit0. New regressions prove actual shared button identity, authored slide/backdrop paint, managed asset lookup/resolution, non-dismissible Escape, deliberate external-trigger focus return, hidden/inert/disabled focus exclusion, iframe focus identity and gesture cancellation. These overlap historical cases; they are not an additive milestone total.
- `npm run build --workspace=packages/ui-patterns-svelte`: **0 errors / 5 inherited renderer warnings**, log `Temp/vict-patterns-conformance-sealed-types.log`, exit0. The type path now checks the real renderer exports rather than a type-only extension module.
- Scoped `git diff --check`: PASS; Windows reports line-ending normalization for Drawer, not a whitespace error.

Retained current-run failures: initial sandbox test collection failed on a temporary-cache EPERM rename with zero tests collected; one permitted native rerun completed. Initial type check exposed the old type-only renderer alias when media began importing the actual public Button; corrected within the patterns type configuration. A new focus regression initially failed because Happy DOM did not account for a disabled ancestor fieldset; explicit standards-aligned fieldset/legend handling repaired it before final PASS. No assertion was removed or weakened.

Remaining: integrated browser sheet geometry/stacking, current app/native capture, actual-agent output, screen-reader/touch-device behavior, package consumer rebuild and independent exact-candidate challenge. This builder does not grant architecture acceptance or owner acceptance.
