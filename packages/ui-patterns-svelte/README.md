# VICT application patterns for Svelte

Icon composition is documented in [ICON-COMPOSITION.md](ICON-COMPOSITION.md). Revision-2 navigation, carousel and filtered-list contracts add supplied/custom icon composition while retaining all revision-1 contracts. `vict.pattern.action-button@1` composes authored icon slots with accessible labels and typed activation.

Private, reusable presentation components and exact `vict.ui-component-abi@1` registrations. Install `patternAuthoringPackage` with `patternAuthoringImplementations` in the same registry as the host's other component families. The canonical document, renderer, state bindings, history and save pipeline remain authoritative; these components do not create a second application engine.

| Identity (revision 1) | Useful behavior | Required composition |
| --- | --- | --- |
| `vict.pattern.drawer` | Controlled side/top/bottom sheet, authored trigger/body/footer, Escape/backdrop close, Tab trap and focus return | Bind `open` / `openChange` to one boolean state; an inline owned application viewport provides positioning/clipping. |
| `vict.pattern.carousel` | Real image/text slides, previous/next, indicators and horizontal pointer swipe | Bind `index` / `indexChange` to one numeric state; use string-list source/labels. No autoplay is inserted. |
| `vict.pattern.navigation` | Responsive container-adaptive real buttons and activation payloads | Labels and optional matching values; bind activation to app state or a declared action. Rendering choices alone does not supply routing. |
| `vict.pattern.filtered-list` | Search actually filters provided labels; item activation emits the selected item | Bind `query` / `queryChange`; list is bounded to 1000 entries. Remote search/paging belongs to the application. |
| `vict.pattern.first-visit` | Explicit per-application/campaign acknowledgement, reset key and optional deliberate re-open button | Provide application/campaign IDs. Browser localStorage is the explicit default; scope=session uses sessionStorage. Body content is not a modal by itself. |

Drawer content remains in its rendered owner subtree rather than a body portal. The host must create a positioned/clipped `[data-ui-application-viewport]`; only this viewport is scroll-locked. Public VICT catalog Dialog Root/Trigger/Overlay/Title/Close are retained; the renderer's shared `OwnedDialogContent` replaces document-modal Content for this owned mode. Its per-owner focus/Tab/Escape/dismissal stack leaves sibling applications operable and does not claim document-wide `aria-modal`. Existing document-modal catalog contracts are unchanged. Independently editable targets include panel, backdrop, trigger and body. Trigger content must be noninteractive text/icons rather than a nested button. Runtime ownership and actual device viewport fidelity remain host responsibilities. The public adapter and its limits are documented in `@victframework/ui-svelte/src/owned-dialog.md`.

Ordinary action controls compose the public VICT catalog Button primitive and the shared `vict-btn` presentation. The native search input uses the existing `vict-input` field recipe. Consumers must load `@victframework/ui-svelte/styles.css`, then `catalog.css`, then optional `rhea.css`, and put the patterns beneath `ControlScope` (with `class="vict-rhea"` when opting into Rhea). An isolated iframe needs its own DOM style scope; copying stylesheets cannot copy an outer ancestor. Pattern CSS owns layout, touch target minimums and adaptive geometry rather than a parallel control palette.

Carousel image slides use `MediaImage`, including managed digest references, loading/error output and the nearest `AssetProvider`. Export/import the same byte closure as ordinary media images; a canonical reference alone is not proof of decode or persistence. Previous/next controls, indicators, drag isolation and slide-part classes remain pattern-owned composition around those shared controls.

First-visit means first **unacknowledged** visit. Pressing Dismiss records the campaign in the chosen origin storage and emits `dismissedChange=true`. Changing `resetKey` deliberately starts a new campaign version; `resetCampaign(store, campaignKey(...))` is the explicit coded reset API. No cookie, cross-origin tracking or cross-device visitor identity is introduced. `memoryStatus` emits ready/unavailable/invalid. When storage is unavailable, content can still be dismissed for the current mounted instance but persistence must not be claimed. The component can emit `showChange` to an explicitly composed dialog/drawer; set its `dismissed` prop to true from the composed popup's close outcome to acknowledge the campaign. This keeps popup presentation separate from app-owned visitor memory.

`src/authoring/knowledge.ts` includes compiling seeds with real local state and output bindings. Compatibility pins are retained in JSON; `scripts/pin-contracts.ts` is a deliberate contract-maintenance command, not an install/build side effect.

Focused checks:

```powershell
node node_modules/svelte-check/bin/svelte-check --tsconfig packages/ui-patterns-svelte/tsconfig.json
node node_modules/vitest/vitest.mjs run --config packages/ui-patterns-svelte/vitest.config.ts --maxWorkers=1
```

The consumer tests mount these exact contracts through `compileUiDocument` and `DocumentHost`, then exercise actual controls. Automated DOM tests do not establish touch-device, screen-reader, production geometry or independent acceptance. Studio installation, representative application authoring and shared save/history/reopen checks are integration gates owned by the stage manager.

Retained setup observations: the initial package check ran before core package exports were built and reported unresolved imported package types; source aliases isolate this package's type check. A subsequent check found two malformed example text nodes (`text` versus canonical `content`), which were corrected. The first Vitest attempt failed before collecting tests because its temporary transform-cache rename targeted a sandbox temp directory outside the intended workspace; subsequent checks use an explicit temporary directory inside this writable package.
