# Application-owned menu composition

`OwnedMenuContent` and the `owned-menu` helpers are reusable coded-consumer infrastructure exported by `@victframework/ui-svelte`. They are not new serialized component identities or an action executor. Existing catalog wrappers and AI ModelSelector compose this same keyboard/layer authority behind their retained contracts. Standard document-scoped Bits composition remains available outside an owned application.

## Content and item contract

The content receives a stable `id`, controlled `open`, the actual `trigger` element, optional explicit `owner`, optional owned `portalTarget`, `scopeClass`, and `onRequestClose(reason)`. Remaining attributes apply to the real menu surface, including canonical part class/style/ownership metadata and `aria-labelledby`. `initialFocus` selects first/last/selected/none; `side` and optional context-menu `point` use the shared Floating UI positioning helper. The default `surface=catalog` supplies shared semantic presentation with low specificity; `surface=custom` retains behavior/geometry while a consumer supplies its existing public surface recipe. The popup must remain inside its actual application owner; there is no owned-mode body fallback.

Children are the actual semantic menu items: `role=menuitem`, `menuitemradio` or `menuitemcheckbox`, with controlled checked/disabled state and their ordinary click callback. Item callbacks decide whether activation closes the menu according to their existing contracts. The shared engine performs keyboard navigation and invokes that click once for Enter/Space; it does not emit a second activation or change checked state itself. Groups, labels and separators retain their real native roles. Editable descendants keep their editing keys.

Use `createOwnedMenuContext({trigger,panel,owner?,parent?,requestClose})` and `OWNED_MENU_CONTEXT` for slot composition. The context provides `close`, `closeAll`, `activateChild` and `releaseChild`. A leaf command can close its tree; checkbox/radio items may remain open. A child menu closes independently for ArrowLeft and source loss. Opening a sibling child dismisses the preceding child without reclaiming focus. Content can accept a context created by a wrapper, so canonical slot children share the same controller.

Trigger keyboard handlers can use `ownedMenuTriggerKey(event,onOpen)`. The trigger carries its real `aria-haspopup=menu`, expanded state and control ID; content names itself through that trigger. Roving focus skips disabled/hidden items and supports arrows, Home/End and bounded typeahead. Tab closes the menu tree and continues into an underlying owned dialog's existing focus boundary. Escape dismisses one owned layer; another application's event is not cancelled.

## Focus, lifetime and styling

Focus return is limited to the actual owned active menu and an active document/embedding chain. It occurs before the host close callback, so synchronous removal cannot lose its target and an intentional host focus change wins afterwards. Closing after focus moves elsewhere does not reclaim it. Source visibility/removal hides the popup even if a controlled host ignores the close request. Unmount disposes owner-local behavior, source observation and positioning.

Shared layer arbitration, source relationships, owner predicates and geometry live in `owned-popup.ts`, also consumed by dialogs and tooltips. Canonical classes, theme scope and dynamic style variables reach the real content. Load the existing foundation/catalog styles and ControlScope in ordinary consumers; AI triggers retain their existing AI style package. No Bits private API, dependency fork, global Escape layer, body scroll/text-selection mutation or parallel ModelSelector engine is introduced.

AI ModelSelector's owned path keeps its existing Rhea menu surface and item spacing/focus utility recipe, public InputGroup button and Lucide checked indicator, together with actual checked/unchecked data states. Its custom surface retains canonical owner scope and the required `vict-ai` ancestor in the real popup outlet. Load both catalog and AI package styles for that composition; a package build is not a native appearance observation. Outside an owned application the previous public Bits composition remains the document-scoped path.

Offline tests support the stated behavior but do not prove native positioning, touch, screen-reader experience or actual Studio-agent output. Browser access remains separately blocked by the saved origin policy; no browser or provider evidence is inferred from these fixtures.
