# Centralized control-style audit

Role: read-only independent audit. The owner rejects the current Document > Data > Media and graphics chooser/pill presentation and requires architecture conformance for related new controls. Root AGENTS.md and CF-01 require actual shared-control/style integration; an imported component name alone does not pass it.

Observed reference: `../fresh-integration-20261028/document-media-panel-conformance-before.png`, inspected as a saved image, without browser access. Source review began before the media worker's concurrent repair; its original state and the image are the subject of the findings below. `source-provenance.json` records later read-time hashes and the working HEAD. This is not a final verdict on concurrently changing source.

**Pre-repair verdict: FAIL.** The hierarchy/chooser issues are visible and the bounded source audit identifies shared-style gaps. Final candidate conformance remains unverified.

## Actual public-control provenance

- `MediaAssetLibrary` is exported from `AssetLibrary.svelte`, not a file named MediaAssetLibrary. Its initial import was the public root `@victframework/ui-svelte` Button.
- That root Button renders `button.vict-btn`, using `styles.css`; it is a real existing shared control. Its typed variants are only `primary | secondary | danger`, with no compact size or quiet variant prop. Replacing it merely because it is not named shadcn would be unjustified.
- `catalog/button.ts` publicly re-exports Bits UI Button. Its `Button.Root` gains the scoped `data-button-root` catalog styling under ControlScope. Existing `ui-patterns-svelte/ActionButton.svelte` already composes that public root with `vict-btn` / variant classes. This is an established public composition route.
- `catalog/components/CatalogButton.svelte` is a different registered ABI wrapper around the root legacy Button. These similarly named surfaces must not be conflated.
- The public AI package also exports its pinned upstream shadcn Button with ghost/outline/size variants, but importing the AI package into media solely for ordinary buttons would introduce unnecessary coupling. The existing ui-svelte public button and styles already cover the capability.

## Cascade and scope

Designer imports `styles.css`, `catalog.css`, workspace/designer CSS, then `rhea.css`, `studio-theme.css` and `studio-typography.css`. Its outer ControlScope opts into `vict-rhea`; the document drawer additionally has `studio-type-scope[data-studio-typography]`.

`styles.css` supplies global semantic `--vict-*` tokens and `.vict-btn` / `.vict-input` recipes. `catalog.css` adds scoped Bits control recipes. Rhea deliberately translates the pinned design: control height 32px, base radius 16px, and explicit 14px button text/padding. Those are shared recipe values, not an AssetLibrary-local override or evidence that shared CSS failed to load.

Studio's existing typography profile is 12px/18px UI and 11px/16px metadata, with centralized 4/8/12/16px spacing roles. Its selectors cover Source action typography and various editor controls but not the media library's actions/labels/metadata. AssetLibrary initially adds relative `.875em` label and `.8em` note sizes, producing roughly 10.5/9.6px text inside a 12px panel while shared buttons remain 14px. The mismatch has a concrete cascade explanation.

The shared quiet-class composition `vict-btn vict-btn--quiet` survives the inspected cascade: catalog quiet rules restore transparent background/muted text after the base button rule, whose border is already transparent. Rhea changes matching control geometry/font but has no later quiet paint override. An additional Rhea quiet-color rule is not justified by the source. Native computed-state verification remains required.

## Findings and bounded repairs

| ID | Classification | Evidence and recommended correction |
| --- | --- | --- |
| CS-01 | Native primitive valid; incomplete shared presentation | `input.vict-input[type=file]` receives Rhea's rounded gray container. No `::file-selector-button` rule exists in the inspected shared sheets, so the browser chooser remains visibly nested inside it. A file input is justified; the current recipe is not a coherent uploader. Use a public shared Button trigger plus an appropriately hidden/labeled native file input, preserving synchronous chooser activation, accept/multiple/disabled/reset behavior. Avoid a one-off native chooser skin. |
| CS-02 | Wrong shared variant/hierarchy plus layout pressure | AssetLibrary initially uses secondary Button for filename selection, full `Remove stored asset <filename>` action text, and export alike. The flex row and `overflow-wrap:anywhere` let those competing long controls collapse into multi-line pills. Use quiet selection/removal intent, short visible Remove with a full accessible name, and bounded filename ellipsis/full title in a minmax row. Grid, gaps, truncation and responsive wrapping are legitimate component layout; local radius/color/font duplication is not. |
| CS-03 | Missing host density/typography mapping | Media buttons use shared Rhea defaults but do not match the established compact Studio profile. Centralize chrome-only control font/spacing/density mapping after Rhea, using existing Studio role variables and shared control hooks. Keep paint/focus/disabled/variant behavior in the shared catalog/Rhea system. A reusable library must still work in ordinary consumers without Studio CSS; do not place Studio-specific pixel rules or global button selectors inside AssetLibrary. |
| CS-04 | Raw control bypass | Designer's initial `Attach as` select and `Use on selected media` button have neither shared component wrappers nor shared native-control classes. Reuse the existing public Select and Button paths, preserving values, output bindings, disabled reasons and selection checks. The chosen-asset label also needs bounded long-name layout. |
| CS-05 | Raw bypass and duplicated visual recipe | Apply source / Discard draft / Export are raw buttons. `designer.css` duplicates their padding, border, radius, font and hard-coded white background; typography later overrides only the font. Compose public shared buttons, remove that local visual block, and retain only action-row layout/gap rules. Preserve source revision/draft/history semantics. |
| CS-06 | Related inherited panel duplication, not authority to rewrite Studio | DataEditorHeader's Back/Apply and WorkspacePanelHeader's close control are native buttons with local visual recipes. DocumentPanels also combines local section-header styling with the shared Studio disclosure stylesheet. These explain why component names alone cannot establish centralized conformance. Preserve their accepted interactions/layout; any touched ordinary control should use shared public controls and the same bounded chrome profile. This audit does not authorize a wholesale panel/TORI redesign. |

## Challenge to the proposed central mapping

The root proposal to use a dedicated chrome-only `studio-controls.css`, import it after Rhea, reuse the existing UI/space variables and shared variants, and retain coarse-pointer target sizing is consistent with this audit. Keep `studio-typography.css`'s stated no-colors/radii role.

One scope caution: placing `--vict-radius-base:4px` on every `studio-type-scope` affects menu/popover/card recipes as well as buttons. Apply the mapping on bounded control groups or actual control elements, or use a Studio control-radius role, so the requested media/Source repair does not silently restyle unrelated chrome. No extra quiet-color mapping is needed.

## Theme, density and acceptance limits

Rhea declares a light default palette. The inspected Studio CSS does not establish a complete dark-mode switch; no dark-mode PASS is inferred. Semantic surface/text/border/focus tokens should work when explicitly overridden, and hard-coded white Source button paint is a concrete violation of that property. Do not borrow AI-only `.dark` rules as proof that all Studio controls are themed.

Native verification after the combined candidate must demonstrate the actual drawer at normal and narrow widths with long filenames, short actions, keyboard focus, disabled/busy states and chooser behavior; compare computed shared font/height/radius/variant paint rather than only component tags. Check semantic-token overrides and standalone media consumers. Confirm chrome style selectors do not reach authored iframe content or capture. Preserve upload/import/remove/attachment behavior and save/export/import evidence. Device and dark claims require their own demonstrated scope.

No product source edits, browser/provider/server actions, builds or stage commits were performed in this audit. The media worker owns AssetLibrary repair; root owns Designer and central Studio integration. A fresh exact-candidate challenge and actual screenshots are required before conformance PASS.
