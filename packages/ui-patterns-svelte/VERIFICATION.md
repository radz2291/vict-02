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
