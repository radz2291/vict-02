# Graph component provenance and presentation finding

2026-10-28. Owner concern confirmed by source inspection and actual Studio DOM. Presentation acceptance is HELD. This is a diagnosis and bounded repair checkpoint, not a redesign or milestone verdict.

## What actually renders

The retained actual-agent source instantiates registered `vict.flow.editor@1`; it does not synthesize a separate HTML graph. `packages/ui-flow-svelte/src/authoring/implementations.ts` resolves that identity to `authoring/FlowEditor.svelte`, which delegates to `editor/GraphEditor.svelte` with the canonical graph, host history and presentation bridge. `GraphEditor.svelte` imports SvelteFlow/Background/Controls/MiniMap from `@xyflow/svelte` and uses `RichGraphNode.svelte` for graph cards. Graph geometry, ports and dragging legitimately belong to that graph renderer.

Integration is partial, not absent:

| Surface | Actual rendering | Consequence |
| --- | --- | --- |
| Canvas, edges, handles, minimap, zoom controls | Actual SvelteFlow components and CSS | Graph-specific rendering; not a Bits UI replacement for the graph engine. |
| Node select, toggle, slider, action fields | `GraphFields.svelte` resolves `catalogImplementations`; select/switch use actual Bits UI roots, button uses public VICT Button | Real component reuse, but requires the catalog's CSS scope. Dependency presence alone was not used as evidence. |
| Graph text/number/list/textarea fields | Native controls with local `.vict-graph-field` rules | Bypasses shared FormField presentation/recipes. Blur commits and drag isolation are functional and must survive any integration repair. |
| Toolbar, inspector controls, connection selectors | Native button/select/input/details in GraphEditor | Custom chrome, not shared VICT catalog controls. |
| Node shell, collapse/trace controls | Custom RichGraphNode article/header/buttons, plus real MediaIcon | Necessary graph shell, but independent visual recipe. |
| Theme | Graph rules use `--vict-flow-node/text/border/input/focus` with hardcoded fallbacks | Shared `--vict-color-*`, font, radius and focus choices do not automatically control all graph chrome. Explicit flow overrides should remain possible while defaults inherit shared tokens. |

## Confirmed missing scope in the actual product

`Designer.svelte` imports foundation/catalog/Rhea CSS and wraps the outer workspace in `ControlScope class="vict-rhea"`. `ApplicationViewport.svelte` mounts the actual renderer in a separate iframe and copies its stylesheets. DOM ancestors do not cross that boundary. `ViewportContent.svelte` originally supplied only `class="vict-rhea"`.

Actual browser DOM on saved Foundation Graph, final built product `234b8b83223ce2a05ccde7b0a6d2788e5620de4d`, showed the real catalog switch:

- `data-testid="catalog-switch"`, child `data-switch-root`, `role="switch"` and `data-switch-thumb`: actual Bits UI implementation.
- `.closest('.vict-rhea')`: true; `.closest('.vict-controls')`: false.
- Computed root width32px, height18px, borderRadius0px, background`rgb(240, 240, 240)`.

`catalog.css` requires `.vict-controls [data-switch-root]` for the rounded base paint and thumb layout. Rhea's dimension overrides still applied, yielding the visibly incomplete switch. This is a product integration defect, not an agent bypass or merely an opinion about appearance. Independent read-only review confirmed the same causal path.

## Separate fixture defect

`apps/studio/tests/graph-capture-browser/App.svelte` originally imported XYFlow CSS, AI styles and Rhea, but omitted public foundation/catalog CSS and ControlScope. The native-versus-JPEG comparison remains valid evidence for the repaired SVG MiniMap paint and zero mutations; it was never complete design-system fidelity proof. The fixture's sparse appearance amplified the problem.

The owner's supplied Library screenshot could not be fully materialized on Windows: the current approved transfer helper downloaded but failed before atomic installation because Python Windows has no `os.setxattr`. No metadata-free replacement or alternate download bypass was attempted. Diagnosis therefore uses independently observed current native browser pixels and actual DOM/source, not a claim that the attached image was read locally.

## Smallest correction and evidence boundary

1. Restore `.vict-controls` on the existing iframe content root, retaining `.vict-rhea`, existing contexts and explicit owned portal targets. This two-class change is implemented in the working tree; it does not add a wrapper or redirect portals to Studio chrome.
2. Correct the capture fixture's public CSS order and add real `ControlScope class="vict-rhea"`. Implemented in the working tree.
3. Reuse public VICT controls/shared field presentation for graph chrome where available; bridge graph defaults to shared semantic color/font/radius/focus tokens while retaining explicit flow overrides. This is recommended next work, not implemented or passed by the class repair.
4. Rebuild and compare the same saved actual-agent graph in Studio and a public consumer: checked/unchecked switch, opened select, keyboard/focus, theme propagation, ownership, native/captured appearance, manual/agent edits and history. Scope and fixture repairs require their own current-build observation before any visual PASS.

Do not replace SvelteFlow, add a demo-only appearance patch, or claim full shadcn composition merely because Bits UI is installed. Agent-output/capture success, presentation consistency, independent verification and owner acceptance remain separate.
