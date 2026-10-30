# Shared popup ownership decision

## Current architecture reconciliation — 30 October 2026

The owner has resumed Architecture Realignment and Authoring Foundation
Completion. This amendment supersedes the historical paused/in-progress status
and browser-authorization statements below only within that new instruction. It
preserves the approved 28 October choice, original failures and evidence limits.
The inspected starting source is private checkpoint
`4c40cc656328c50d16d28492ae5245bf509ccb6e`; no new integrated popup pass or owner
acceptance is implied by this source review.

| Boundary | Actual implementation and dependency owner | Disposition |
| --- | --- | --- |
| Application-owned input and lifetime | `ui-svelte/owned-popup.ts` owns actual owner/source/occurrence admission, owner-local layer arbitration, source visibility and same-document/embedding focus checks. `owned-dialog.ts`, `owned-menu.ts` and `owned-tooltip.ts` own their respective focus, keyboard, dismissal and hover semantics. | **Keep.** The retained CF-P01/P02 and dialog failures demonstrate why viewport portal placement alone cannot replace this behavior. This shared approved implementation is VICT behavior, not Bits Content behavior. |
| Application-owned popup mounting and geometry | `OwnedMenuContent`, `OwnedTooltip` and `OwnedHoverCard` use public Bits `Portal`; `positionOwnedPopup` uses directly declared public `@floating-ui/dom@1.8.0` offset/flip/shift/auto-update. Drawer supplies its sheet geometry and uses `OwnedDialogContent`. | **Keep.** Upstream owns mounting and floating geometry where suitable. VICT supplies clipping/owner policy, stale-result cleanup and canonical style preservation; it does not copy a second floating engine. |
| Drawer composition | `ui-patterns-svelte/Drawer.svelte` retains public Bits Dialog Root/Trigger/Overlay/Title/Close and shared catalog presentation around VICT owned content. Its dialog is modal within the application, with owner-only scroll/focus control and no document-wide `aria-modal=true` claim. | **Keep.** The hybrid deliberately replaces Content interaction scope while retaining compatible upstream parts. |
| Menus and descriptive/interactive hints | B4 menu wrappers and AI ModelSelector reuse one owned-menu engine. B5Tooltip/MessageAction use OwnedTooltip. Context/InlineCitation use OwnedHoverCard; interactive citation links are not mislabeled as a tooltip. Ordinary triggers retain public controls and existing catalog/AI presentation. | **Keep.** No ModelSelector-specific keyboard engine or separate per-component focus manager is needed. |
| Ordinary document-scoped composition | Unowned B4 menus, B5Tooltip, ModelSelector and relevant AI hovercards retain genuine public Bits interaction parts. Existing CatalogDialog@1 and application Overlay retain document-modal Bits Content. `ControlScope` supplies BitsConfig portal/locale defaults and catalog ancestry. | **Keep, with explicit limits.** Whole-document modality and application-local modality are different supported contracts. A CatalogPortal destination inside a viewport does not make Bits Content owner-local. Do not silently change existing saved dialog semantics. |
| Canonical presentation | Renderer presentation targets carry exact owner/occurrence/part metadata, classes and dynamic variables. Portal wrappers preserve catalog/AI scope and semantic theme ancestry. Reusable packages depend on public packages, not private Studio imports. | **Keep.** Studio iframe and standalone consumers must load the same public styles and rendering path. |

**Change now:** current documentation must describe those actual owners and the
two intentional modes. Preserve serialized identities/pins, truthful upstream
provenance and the original red evidence. Reuse Bits behavior for document-scoped
controls where it satisfies the contract. Retained owner-local behavior requires
the shared hub and regressions; neither a dependency declaration nor matching
classes proves upstream interaction reuse.

**Remove only if demonstrated superseded:** per-component replacements for the
shared hub, private dependency patches, obsolete duplicate implementations or
claims that an owned dropdown delegates its keyboard/focus behavior to Bits
Content. This audit established no new source defect justifying removal of either
supported mode or a new popup framework. Construction-policy differences between
wrappers alone do not justify a refactor without a reproduced transition defect.

Existing executable coverage includes `ui-svelte/test/owned-popup-{core,adopted,
independent}.test.ts`, `owned-dialog-{adopted,focus-capture-independent}.test.ts`,
`owned-menu.test.ts`, `owned-catalog-menus.test.ts`, `owned-tooltip.test.ts`, and
AI `action-model-portal.svelte.test.ts`, `chat-extension.svelte.test.ts` and
`passive-hovercard-isolation.svelte.test.ts`. These cover sibling/nested owners,
iframe adoption, exact child-popup admission, menu/dialog Tab continuation,
disabled/hidden/detached launchers, controlled selection, submenu navigation,
description IDs and geometry/style cleanup. Source inspection is not a fresh
test result; current execution results belong in the accompanying audit evidence.

Remaining integrated proof is explicit: open popup appearance and clipping in
the authored application/Studio iframe and installed consumer; keyboard/focus
return across nested layers and sibling applications; current semantic theme and
part propagation; and actual-agent authoring/save/reopen at the new graph scope.
Select and Popover still use upstream interaction paths. An owned dialog's exact
branch-admission test does not certify those children's independent Escape/focus
policies. Challenge their actual owned usage separately before extending a
conformance claim. Physical touch and assistive-technology/device checks remain
distinct from desktop DOM fixtures and narrow preview observations.

## Historical approved decision and implementation record

Status: shared VICT-owned menu/tooltip direction APPROVED by the owner at 2026-10-28 04:28 UTC; implementation and independent verification IN PROGRESS. No browser access, publication or acceptance is implied. The original proposal and failed observations below are retained.

The owner-approved shared dialog repair is saved and independently checked at `15695678492fe0850a5c7b29a131d2578a24ce7f`. Subsequent AI exposure at `b793b0b9843094be71d3ab2a418ebcff24ab7862` reused existing public patterns and exposed two additional executable ownership failures:

| Finding | Actual observation | Retained test |
| --- | --- | --- |
| CF-P01 | An open ModelSelector menu in app A consumes Escape from app B and restores focus to A's trigger. Placement, scope and selection pass. | `packages/ui-ai-svelte/test/action-model-portal.svelte.test.ts` |
| CF-P02 | A hovered MessageAction tooltip in A consumes Escape from focused app B. No focus jump was demonstrated for this tooltip case. | `packages/ui-ai-svelte/test/chat-extension.svelte.test.ts` |

The full current AI check is 60 passing and 2 failing tests, exit1. The public Bits Content paths install document Escape arbitration; changing portal placement or callback handlers does not undo the earlier event cancellation. The dialog adapter's passing child Select interoperability does not certify the legacy popup's own global Escape policy. No private dependency patch, component-specific interaction bypass or ownership exception was introduced.

## Recommended boundary

Extend the reusable VICT owner-scoped layer approach to menus and tooltips, with actual popup semantics and compatible public presentation primitives. Share owner identity, embedding focus-chain checks, exact occurrence/trigger relationships, portal/theme scope and top-layer arbitration. Keep standard document-scoped composition compatible. Do not turn a menu into a dialog merely to reuse its role or focus loop.

Menus need controlled selection, native menu naming and item roles, roving focus, Arrow/Home/End navigation, Enter/Space activation, correct Tab/Escape/dismissal behavior and nested-menu focus return. Closing after focus has moved to another app must not reclaim that focus. Tooltips need hover/focus lifetime, stable description relationships, no autofocus, and Escape handling restricted to their actual application. Hidden or removed source occurrences must not leave detached visible popups. Cross-document and source/capture ownership remain explicit.

Apply the shared correction through reusable catalog/pattern boundaries, including affected existing popup consumers, rather than fixing ModelSelector alone. Preserve authored source/history, revision compatibility and real semantic parts; use new revisions if a serialized contract changes. A scope-aware upstream extension is the alternative, with a larger dependency-maintenance obligation. A pinned fork was not approved for the dialog and is not inferred here.

## Acceptance evidence

Retain the two red tests, then demonstrate sibling/nested applications, iframe focus chains, nested layers, source hide/unmount, keyboard/selection, dismissal/restoration and real part/theme propagation. Rebuild the standalone consumer and Studio. Independently challenge the exact candidate; then perform authorized browser and actual Studio-agent checks. Offline passing tests cannot replace those observations or physical-device proof. All29original findings, CF-01 and AI-EX01 remain open until their own evidence and owner acceptance are established.

## Owner approval — 2026-10-28 04:28 UTC

The owner approved the recommended reusable VICT-owned menu/tooltip extension after the maintenance, accessibility and compatibility trade-offs were explained. Implementation proceeds from clean checkpoint5e4b98ddb04599bb6c1548b745d6a4260a643ff3. Preserve standard document-scoped behavior, existing saved contracts/pins and actual shared styling; no component-specific bypass or Bits fork. Core owner/layer arbitration, menu semantics, tooltip semantics and existing catalog integration have separate builder ownership and require independent challenge.

The implementation reuses the installed and already locked public @floating-ui/dom1.8.0 for shared positioning, now declared as a direct ui-svelte dependency without changing its locked resolution or other versions. This avoids a separate geometry engine. This routine dependency declaration does not imply visual correctness; real browser/agent/device proof remains unrun.

Browser origin access remains denied by a saved permission or managed policy. This architecture approval does not authorize another browser attempt, permission change, reset or alternate browser. The older additional Undo denial also remains separately stopped. No push/publication/merge/deployment or new provider/model/purchase is authorized.
