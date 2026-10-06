# U2 coverage — model, renderer, editor (honest matrix)

Scope: `packages/ui` (model), `packages/ui-svelte` (renderer), `packages/ui-editor`
(editor tooling). Companion to CONTRACTS; anything not listed as supported is
**unsupported**, and unsupported paths surface explicit diagnostics rather than silent
behavior. Generated from the implementation at U2 candidate time.

## Model (`vict.ui-document@1`)

| Feature | Status | Notes / diagnostics |
| --- | --- | --- |
| element / text nodes | supported | semantic tag catalog + declared attributes (`UI_DOC_UNKNOWN_ELEMENT`, `UI_DOC_UNKNOWN_ATTRIBUTE`) |
| component nodes | supported | definitions stored once; instances never gain a second source parent (`UI_DOC_UNKNOWN_COMPONENT`, `UI_DOC_UNKNOWN_PROP` for undeclared props, `UI_EXPR_TYPE_MISMATCH` for typed prop literals) |
| slots | supported | `required` slots must be filled at every instance (`UI_DOC_REQUIRED_SLOT_MISSING`); optional slots render fallbacks |
| repeat | supported | stable key expression; duplicate runtime keys get unique occurrence identities + `UI_RENDER_DUPLICATE_KEY` |
| conditional | supported | named conditions; `localState` conditions evaluate at runtime |
| portal | rendering unsupported | occurrence provenance keeps logical ownership (`portal:<node>:<overlay>` path segments); `UI_DOC_UNSUPPORTED_FEATURE feature:'portal'` |
| component definitions | supported | shared bodies; definition edits affect every instance (tested); expansion cycle bound (`UI_DOC_CYCLE`) |
| variants | declaration-only | `UiVariantConditionRef` stored; `condition:variant` style rules are dropped with `UI_DOC_UNSUPPORTED_FEATURE` |
| styles: local / attached sources | supported | frozen cascade token → componentBase(definition) → source(instance) → local |
| conditions: media | supported | `@media` via style-source `conditionId` (`UI_STYLE_CONDITION_UNKNOWN` for unknown ids) |
| conditions: container | supported | `@container <name> (<query>)`; host declares `container-type/name` |
| conditions: environment | unsupported | conditioned rules dropped with `UI_DOC_UNSUPPORTED_FEATURE feature:'condition:environment'` |
| pseudo states | supported | `hover` / `focus` / `active` / `disabled` selector suffixes on style sources |
| tokens | supported | `--ui-token-*` custom properties; token-referencing style values |
| bindings | supported | attribute/text/prop expressions resolved per scope (view/record/prop/state/repeat) |

## Renderer (`vict.ui-render-plan@1` via DocumentHost)

| Feature | Status | Notes |
| --- | --- | --- |
| one-renderer rule | held | the same DocumentHost renders product routes, the canvas and previews |
| occurrence identity | held | document + source node + component-instance path + repeat record keys (+ portal ownership) |
| interactions | supported | click / submit / change(setState); actions dispatch ONLY through the host boundary |
| style rules | supported | layered CSS with `@media` / `@container` / pseudo selectors; token custom properties |
| unsupported placeholders | supported | portals/extensions render labeled placeholders with children + diagnostics |

## Editor tooling (`@victframework/ui-editor`, exported)

| Module | Status | Notes |
| --- | --- | --- |
| EditorCanvas | exported | compiles + renders the working document through DocumentHost; selection → occurrence keys; exposes the plan + render diagnostics |
| Inspector | exported | text/attributes/styles/interactions; style TARGET selector (base vs declared conditions × pseudo) so preview sizes never silently rewrite base source; provenance (definition path, instance count blast radius, portal chain, record keys); authored-origin vs effective value (host `readEffective`) |
| Layers | exported | occurrence tree from the compiled plan (components, slot fills, repeats, branches, fallbacks, unsupported features) |
| HistoryPanel | exported | undo/redo/save/reopen affordances with revision + dirty state |
| EditorBridge | exported | guarded two-phase save (save-window ownership, `releaseSaveWindow`), stale refusal, reopen |
| createLocalStorageDocumentStore | exported | single `classifyStored` authority for load+save; preservation policy; optional host validation gate |
| transactional commands | exported | insert/move/remove/setProperty/setAttribute/setStyle/setConditionalStyle/bind/fillSlot/connect |

## Declared unsupported (with diagnostics)

- Portal rendering (visual placement) — provenance preserved; `UI_DOC_UNSUPPORTED_FEATURE`.
- Environment- and variant-conditioned style rules — dropped; `UI_DOC_UNSUPPORTED_FEATURE`.
- Registered code extensions — render as labeled placeholders (`EXTENSION_UNAVAILABLE` when unresolved).
- No workflow engine, no live operator controls: the workbench fixture is presentation-only
  (no interactions/actions in its source — regression-tested).
