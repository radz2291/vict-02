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

## 2026-10-28 independent ownership FAIL and bounded repair

Independent challenge of `710886572750b00d7f716b8a93f547b88406d872` found that actual Bits Dialog Content is document-modal, while the authored Drawer promises an owned inline application boundary. The earlier 25 passing checks did not establish sibling-application isolation. **Complete Drawer conformance is FAIL; the architectural resolution is HELD for owner decision.**

Six new direct component integration cases in `test/drawer-isolation.test.ts` use the same public Dialog implementation in two application viewports sharing one document. Before repair: **5 FAIL / 1 PASS**, `Temp/vict-patterns-drawer-isolation-before.log`. Two ordinary repairs were then applied: preserve the renderer's dynamic `target('panel').style` variables when adding sheet geometry, and set the documented `preventOverflowTextSelection=false` to prevent body user-select mutation. After those bounded repairs: **3 FAIL / 3 PASS**, `Temp/vict-patterns-drawer-isolation-after-bounded.log`.

| Challenge | Before | After bounded repair |
| --- | --- | --- |
| Deliberate focus into sibling application remains there | FAIL | FAIL |
| Sibling Escape is not cancelled and does not close this drawer | FAIL | FAIL |
| Owned Tab / Shift+Tab and Escape continue to work | PASS | PASS |
| Dynamic panel binding variables update while sheet geometry remains | FAIL | PASS |
| Owned pointer input does not mutate body scroll/user-select | FAIL | PASS |
| Programmatic close does not return focus away from the sibling application | FAIL | FAIL |

The existing 25 cases still PASS in the separate focused regression run `Temp/vict-patterns-drawer-bounded-regressions.log`; this is not a green full package suite because the three required ownership failures are retained as executable failing tests. No assertion was skipped or weakened. Package typecheck remains zero errors/five inherited renderer warnings (`Temp/vict-patterns-drawer-bounded-types.log`). These are DOM harness results, not native browser, actual-agent, device or owner-acceptance evidence.

Installed public API limits were inspected before attempting a shared-adapter implementation. `trapFocus=false` disables both the document focus capture and the library's Tab loop. `escapeKeydownBehavior='ignore'` does not disable the document Escape listener: installed `use-escape-layer.svelte.js` cancels the original event before checking the behavior. It therefore cannot be counted as untouched sibling Escape. No dependency code, private Bits imports, spoofed Root state, new shared adapter or shared index export was changed.

The existing public `ui-svelte/Overlay.svelte` delegates to the same `Dialog.Content`; `OverlaySurface.svelte` traverses into that Overlay. `catalog/components/CatalogDialog.svelte` also delegates to the same Content in its runtime modal path. Reusing these unchanged carries the same global behavior. Its existing inline composition surface supplies presentation, not a complete owned focus/Escape contract.

The owner decision is between (1) a small shared VICT owned-dialog mode that reuses established catalog presentation and public Bits Root/Trigger/Overlay/Title/Close, with an explicitly scoped content/focus/Tab/Escape adapter replacing Content only for that owned mode, or (2) a public upstream dependency extension for scope-aware Escape/focus-manager behavior while retaining actual Dialog.Content. The first is the smaller local correction; it still needs explicit content/ARIA wiring and independent ownership tests. The second retains more library internals but requires upstream/pinned dependency maintenance. Neither is implemented or implicitly accepted. Dependent production work is stopped pending the owner's choice.

## Owner-approved shared adapter continuation

The owner approved the shared VICT adapter on2026-10-28 (trusted continuation relayed by the stage manager; implementation base `d733980b1894b2309d26bd3f408a3e2b7da5e823`). This supersedes the pending-decision statement above only for the bounded owned-dialog extension. A pinned Bits fork was not approved or implemented.

`ui-svelte/OwnedDialogContent.svelte` and `owned-dialog.ts` are public renderer infrastructure. Drawer retains public Bits Root/Trigger/Overlay/Title/Close and existing canonical state/output/parts. The shared content forwards dynamic part bindings and shared catalog presentation, wires explicit label/control IDs, and omits document-wide `aria-modal`. Existing Overlay/CatalogDialog@1 source and pins remain unchanged. Pattern focus exports now delegate to the renderer's single helper authority.

Behavior listeners and nested stacks belong to the actual owner element, never a document/global stack. The same boundary predicate governs events, initial/return focus and portal admission, including nested applications. A real registered catalog Select popup is admitted through exact live source occurrence metadata and ARIA/expanded-role pairing; unrelated/ambiguous/closed/nested/foreign branches are refused. Radio native Tab stops use form/name/tree membership. Automatic focus requires document focus plus its active embedding frame chain; stale child activeElement alone cannot return focus into an inactive iframe.

Retained current-run failures: an initial synthetic HTMLElement.click did not exercise the installed Select's pointer/keyboard opening contract. A subsequent real Enter activation exposed a genuine missing branch relation: Select uses aria-activedescendant rather than aria-controls. The strict pairing implementation was extended and negative ambiguity/closed/foreign-owner checks retained. Fresh independent review then caught unchecked radio siblings being counted as native Tab stops and a checked same-name member outside the panel; source was repaired without editing the verifier's tests. Initial/nested and diagnostic logs remain in `Temp/vict-owned-dialog-*.log`.

Final focused run: **45/45 PASS** across six files (`Temp/vict-owned-dialog-focus-chain-tests.log`, exit0), including the retained six isolation cases, existing25 regressions, shared nested/multiple-owner/iframe cases, actual registered Select portal coexistence and four unchanged independent radio challenge cases. The last four were included in the builder run; a separate independent rerun/verdict belongs to the verifier, not this builder. Types: **0 errors / 5 inherited renderer warnings** (`Temp/vict-owned-dialog-focus-chain-types.log`). These overlapping bounded results are not an additive milestone total.

The iframe test explicitly models standard frameElement/active-frame bookkeeping missing from Happy DOM and spies against return-focus calls while the child activeElement is stale. This is not real-browser evidence. Child Select/Popover implementations retain their existing library policies; the adapter's portal interoperability does not certify every pre-existing popup's cross-application isolation. Native browser, device, full integration and owner acceptance remain separate and pending. No browser/provider call, dependency fork, commit or push was performed by this builder.
