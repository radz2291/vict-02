# Shared media library control repair

Base reviewed: `1c8f35086ab864af85e63cef81b20657eaed4067`. This is a source/test candidate; native integrated appearance remains the root browser owner's check.

## Provenance

The retained `../fresh-integration-20261028/document-media-panel-conformance-before.png` shows the owner-reported defect at a 320px sidebar. `AssetLibrary.svelte` rendered visible native `input.vict-input` file pickers. Shared Rhea styles give that class full-width text-input background, padding and radius while the browser's native Choose File button remains inside. There is no special file-selector styling. Both row actions already used public VICT Button, but their secondary treatment, the entire repeated filename in the removal label, flex width contention and `overflow-wrap:anywhere` produced large pills and mid-extension wrapping. Studio typography does not establish a broad media-panel button override. This is shared library markup/layout and control-intent misuse, not an upload/store failure.

## Candidate

Only `packages/ui-media-svelte/src/AssetLibrary.svelte` and directly relevant tests changed. Toolbar supply/import now use the public VICT Button to synchronously open hidden named native file inputs. Native accept filters, multi-file supply, busy disable, handlers and clear-after-import behavior remain intact. The filename and removal actions use public `@victframework/ui-svelte/catalog/button` Button.Root with the existing shared `vict-btn--quiet` treatment. Removal has a short visible label and the complete specific accessible name. Filename text remains complete in the control and title; constrained rows truncate visually with ellipsis. Grid columns reserve flexible filename space and an automatic removal column. Metadata uses the shared muted text token. No local font/height/radius, fixed color, per-Studio skin, provider or storage change was added. Root owns any central Studio typography mapping and verification of quiet styling through the actual Rhea cascade.

The shared component is also the registered `vict.media.asset-library` implementation; the repaired controls therefore apply to authored consumers as well as Studio's direct integration. Descriptor revision, declared root/toolbar/list parts and canonical document/archive contracts are unchanged. No other new media library control location was found beyond this shared implementation and Studio's separate selected-reference attachment controls (owned by root).

## Checks and limits

Commands run from checkout root with only task-specific TEMP/TMP set to `C:\Users\RZ1\AppData\Local\Temp\vict-media-portability-check-20261028`; no package installation, build/dist writes, browser, provider or server operations.

- Red regression: `node node_modules/vitest/vitest.mjs run --config packages/ui-media-svelte/vitest.config.ts packages/ui-media-svelte/test/library.svelte.test.ts -t 'opens each native picker'` failed against the prior visible native input (`library-red.log`).
- Targeted library + registered consumer checks: same command with `library.svelte.test.ts consumer.svelte.test.ts`: 10/10 pass (`library-green.log`). Covers actual click forwarding, hidden input naming, specific removal, partial upload/archive failures, namespace changes, declared toolbar authoring paint and public controls.
- The final library-only extension additionally checks explicit selection emits the reference while leaving stored bytes untouched (`library-selection-green.log`).
- Final library selection/removal check: 4/4 pass (`library-selection-green.log`).
- Type check: `node node_modules/svelte-check/bin/svelte-check --tsconfig packages/ui-media-svelte/tsconfig.json`: 0 errors, 5 pre-existing DocumentHost/RenderNode warnings (`media-types.log`).
- First check's asynchronous removal status assertion and two non-reactive bind warnings are retained in `library-first-check-failed.log` and `media-first-types.log`; final source uses reactive element bindings and awaits DOM settling.

Happy DOM tests do not establish native file-dialog appearance, true browser keyboard/focus behavior, pixel layout, mobile or theme conformance. Root must verify Supply media/Import media archive/Export media archive and row filename/Remove at the actual sidebar width, light/dark themes and narrow authored consumer width; confirm no native picker boxes or mid-extension wrapping, focus ring/keyboard activation, busy controls, filename title/accessibility, upload, explicit selection, archive and removal recovery. No source/app/media deletion or canonical fixture replacement was performed by this lane.

Candidate AssetLibrary SHA256: `8efa2622aef77e559b351872b162f0bca37f80f371f266496f0750fbfd3a4557`.

Independent read-only cascade audit from setup_verifier: quiet treatment survives the inspected imports. `styles.css` establishes quiet intent; later `catalog.css` scopes `.vict-controls .vict-btn--quiet` to transparent background and muted text, and the catalog base button sets transparent border. Matching Rhea rules affect geometry/font without overriding quiet background. No additional Rhea paint repair is justified. This is source cascade evidence, with computed native conformance still pending.
