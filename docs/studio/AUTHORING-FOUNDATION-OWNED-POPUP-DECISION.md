# Shared popup ownership decision

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
