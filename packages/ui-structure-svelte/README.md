# VICT UI Structure explorer

An optional public composition for exploring authored UI source, not application execution graphs. It combines the public Flow canvas with UI-editor source identity and validated source commands. Neither ui-editor nor ui-flow depends on this package; ordinary editors and Flow applications need not install it.

Import `StructureExplorer` from `@victframework/ui-structure-svelte`. Required props: canonical `document`, exact `revision`, `onSelect(occurrence)`, `onMove(request): boolean` and `onNotice(message)`. Optional selection-intent, inspection, navigation and object-command callbacks integrate host panels. No private imports, hidden store or source aliases are needed.

## Ownership

Projection never mutates the canonical UiDocument. Camera, layout, collapse, search and relationship selection are presentation state. Relationship sockets are read-only references. Separate content/container handles request source reparenting; the host applies successful `structureMove` transaction drafts through its existing EditorBridge. Document identity, revision, occurrence ownership, root/cycle rules, descriptors and recipe parent/slot compatibility are checked before a draft is returned. The explorer never applies drafts or creates a second source history. Graph topology grants no execution authority.

`context` accepts descriptors, declared action-state relationships, action/route ids, an optional compiled plan and read-only `presentation` callbacks: `nodeLabels(document)`, `displayName(kind,id)`, `styleName(document,id)`. Product aliases belong in these callbacks, not shared code.

The shared implementation preserves23 relationship roles, definition/repeat/slot scope, grouped/coincident declarations, partial member selection, keyboard/hover tracing, stable placement, measured backward routes and blocked/stale move refusal. Every grouped declaration retains its individual id/path/origin. Search includes hidden text and ancestor paths. Focused views disclose25 items initially and Show more adds24; complete counts remain available and no source is dropped.

## Styles and public modules

The explorer includes scoped card, menu, socket and toolbar styles plus public Flow CSS. No Studio stylesheet is required. VICT theme tokens and optional `--vict-structure-font-ui`/`--vict-structure-font-meta` inherit from the host, with standalone defaults.

Root exports: `StructureExplorer`, `StructureSourceNode`, `StructureRelationEdge` and all helpers. Nonvisual consumers can import `/projection`, `/semantics`, `/behavior`, `/connections`, `/trace`, `/geometry`, `/placement` and `/selection` without loading the explorer. `./styles.css` supports custom compositions.

Studio migration retains thin compatibility reexports and a wrapper supplying product labels/callbacks. Saved schemas are unchanged; no implicit source migration, package publication or execution engine is introduced.
