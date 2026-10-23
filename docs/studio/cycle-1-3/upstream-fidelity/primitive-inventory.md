# Primitive showcase inventory

2026-10-23. Owner-requested expansion of the Cycle 1.3 showcase, after the core 21-pattern candidate. This is a source inventory and implementation record, not a browser fidelity verdict or gate promotion. The original pattern audit and failed observations remain intact.

Public entry: `PrimitiveShowcase` from `@victframework/ui-ai-svelte`, implemented in `packages/ui-ai-svelte/src/PrimitiveShowcase.svelte`. It takes no props and owns only local demonstration state. `PatternShowcase` continues to cover the 21 AI Elements compositions; the Studio showcase separately covers the 83 canonical Designer recipes and editor surfaces. Those are distinct inventories, not interchangeable coverage counts.

## Exact inventory and count reconciliation

The selected pinned registry closure has **19 visual UI families and 95 unique Svelte components**, including the context/portal components. Inspection of all 19 `upstream/ui/*/index.ts` files with the TypeScript AST yields **95 canonical component export names, 94 component aliases, 11 noncomponent runtime exports and 17 type-only export names**: 217 family-scoped export names, representing 95 components. The earlier 121 count was a whole-package Svelte syntax inventory that also included pattern wrappers and Markdown; it is not a count of unique primitive exports.

Each family below has exactly one `[data-ui-family="family-name"]` section. All 95 canonical components are used in a real composition: 92 directly in the showcase and the three Portal components through the corresponding Content/SubContent wrappers. Portals and Providers do not need visible boxes of their own. Alias names do not require duplicate mounts.

| Family | Unique parts, all covered | Composition / interaction |
| --- | --- | --- |
| attachment (9) | Root, Group, Media, Content, Title, Description, Trigger, Actions, Action | Grouped icon attachments, independent overlay trigger/remove action, restore, idle/uploading/processing/error labels. These are state fixtures, not uploads. |
| badge (1) | Badge | All six variants plus an icon label. |
| bubble (4) | Root, Group, Content, Reactions | All seven variants (default, secondary, muted, tinted, outline, ghost, destructive), plus a local reaction button. |
| button (1) | Root, consumed through its Button alias | All six variants; xs/sm/default/lg and icon-xs/icon-sm/icon/icon-lg sizes; accessible icon labels; disabled state. |
| code-block (8) | Root, Header, Title, Actions, CopyButton, Content, Line, Footer | Numbered lines with default/added/removed/highlighted variants, source-matching clipboard action, metadata footer and destructive output. |
| collapsible (3) | Root, Trigger, Content | Trigger is composed through the upstream child snippet into Button; content remains inside Root context. |
| dropdown-menu (17) | Root, Trigger, Content, Portal, Group, GroupHeading, Label, Item, Shortcut, Separator, CheckboxGroup, CheckboxItem, RadioGroup, RadioItem, Sub, SubTrigger, SubContent | Valid Root/Content ownership, regular/disabled item, checkbox selection, radio selection, nested submenu and keyboard hint. Content and SubContent invoke Portal internally. GroupHeading has its regular/checkbox/radio group context. |
| hover-card (4) | Root, Trigger, Content, Portal | Focus/hover preview; Content invokes Portal internally. No placeholder navigation or remote request. |
| input (1) | Root, consumed through its Input alias | Associated editable label, invalid field with described error and disabled field. |
| input-group (6) | Root, Addon, Button, Input, Text, Textarea | Inline-start/end and block-end addons, local search/inspection actions, field/error/disabled states. |
| item (10) | Root, Group, Separator, Header, Footer, Media, Content, Title, Description, Actions | Bounded list, metadata, icon, supporting copy and local Select callback. |
| marker (3) | Root, Icon, Content | Default, separator and border variants. |
| message (6) | Root, Group, Avatar, Content, Header, Footer | Initials avatar, author/time header, local fixture footer, grouped opposite-alignment messages. No avatar network fetch. |
| message-scroller (6) | Provider, Root, Viewport, Content, Item, Button | Bounded scroll region with stable message IDs, local append, both scroll directions. Buttons are conditionally visible according to actual scroll position. Provider supplies shared context. |
| progress (1) | Root, consumed through its Progress alias | Accessible determinate value with bounded local increase/decrease controls. |
| separator (1) | Root, consumed through its Separator alias | Horizontal and vertical examples. |
| textarea (1) | Root, consumed through its Textarea alias | Editable multiline label, described invalid state and disabled state. |
| tooltip (5) | Provider, Root, Trigger, Content, Portal | Labeled icon trigger; keyboard focus/hover content; Provider owns delay and Content invokes Portal internally. |
| trace (8) | Root, Line, Icon, Title, Description, Collapsible, CollapsibleTrigger, CollapsibleContent | Complete, pending, running and error fixtures with duration and actual error disclosure. |

### Complete alias mapping

Every family except Badge exports aliases for all its canonical components. The exact rule is `Root → PascalCaseFamilyName`; every other part is `PascalCaseFamilyName + PartName`. Thus `Trace.CollapsibleContent` and `Trace.TraceCollapsibleContent` are the same component, `DropdownMenu.Root` and `DropdownMenu.DropdownMenu` are the same component, and `MessageScroller.Provider` and `MessageScroller.MessageScrollerProvider` are the same context provider. Family prefixes are Attachment, Bubble, Button, CodeBlock, Collapsible, DropdownMenu, HoverCard, Input, InputGroup, Item, Marker, Message, MessageScroller, Progress, Separator, Textarea, Tooltip and Trace. Badge exports only Badge. This exhaustively maps the 94 alias names without inventing 94 additional visual controls.

### Noncomponent runtime and type exports

| Family | Runtime exports (not standalone UI) | Type-only names |
| --- | --- | --- |
| attachment | attachmentVariants | AttachmentSize, AttachmentOrientation, AttachmentState |
| badge | badgeVariants | BadgeVariant |
| bubble | bubbleVariants, bubbleReactionsVariants | BubbleVariant, BubbleReactionsSide, BubbleReactionsAlign |
| button | buttonVariants | Props (alias of ButtonProps), ButtonProps, ButtonSize, ButtonVariant |
| code-block | codeBlockVariants, codeBlockLineVariants | CodeBlockVariant, CodeBlockSize, CodeBlockLineVariant, CodeBlockLineToken |
| marker | markerVariants | MarkerVariant |
| message-scroller | useMessageScroller, useMessageScrollerScrollable, useMessageScrollerVisibility | — |
| trace | — | TraceLineStatus |

Variant functions describe the displayed primitive styles; they cannot be mounted as components. Scroller hooks require the appropriate Provider/scroll context and are identified in the rendered inventory, not invoked at module scope or misrepresented as independent widgets. Type-only exports have no runtime appearance. Other families have no additional noncomponent exports in their index.

The two registry utility families **use-highlighted-code** and **highlighter** live under `upstream/hooks` and `upstream/lib`. They are internal, not public standalone visual families. The showcase explicitly lists them in `[data-ui-utilities]` and renders a fenced TypeScript block through the actual safe Markdown → MarkdownCodeBlock → useHighlightedCode → highlighter composition. Markdown also composes CodeBlock.Header/Content/Line/CopyButton. No raw HTML or remote image is enabled for the demonstration.

## Scope, reference and validation boundary

The examples reuse the already vendored `huntabyte/shadcn-svelte@b10f153250b18abfccf49a06e1c4c68945edffa5` primitives. This change adds no dependency or vendor closure. Styles and context behavior stay in those primitives; showcase layout and local fixture text are host composition. Menus, tooltips and hover cards mount only on interaction. The scroller starts with eight local records rather than a large transcript. Clipboard writing is the only browser integration and occurs only when its visible Copy button is pressed.

The source syntax check compiled `PrimitiveShowcase.svelte` with the installed Svelte compiler in client mode and returned zero errors and zero warnings. This is only a lightweight compiler check: type checking, packed-consumer rendering, interaction checks and independent verification are coordinated by root after the source freeze. In particular, visible portal content, keyboard selection, copy, scroll-button behavior, disabled controls and narrow-width layout still require browser evidence. This document does not claim that every possible variant combination or tutorial transport is reproduced.
