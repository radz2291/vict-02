# Iteration 2 integration candidate

Owner requested all six improvements described in the implementer's review. Implementation, rationale and retained builder failures are recorded in DESIGN.md. Branch remains codex/ui-foundation-u2-inspector-ux; this iteration starts at 7f9ab3e22c75ba6b33dfe8b753f7a4ddb9f15931. Original foundation base remains 83ba87f7aa112a1d93e7236c9c3ec2f4505f6cff. Neither compiler acceptance nor U2 closure is inferred. Owner experience acceptance PENDING.

## Mounting changes

Public Inspector/Layers props and EditorLabels remain compatible; no new public export. Inspector now owns overflow inside a bounded-height parent and dynamically measures sticky selection-header height to reserve native focus/scroll space. Existing host overflow can remain, but the Inspector itself is the active scroll container. Layers owns its flexible tree scrolling; search is local UI state, not document data. Preserve the same bridge, renderer scope, selection and readEffective refresh wiring from the previous handoff.

Typography starts with Text size. Click a property's Preview/Source/Override information disclosure to inspect Browser now and source explanations or create an explicit Override. Differences stay visible when authored and measured values disagree. Base/normal condition editing controls start collapsed; the summary always names the editing destination. Expanded shared-scope help explains authored counts and wrapper limits. Changing a field creates its owned override through the existing builders.

Padding/margin diagrams support independent sides or linking. Numbers without units use px; expressions such as auto/calc remain textual. Linked changes apply all four explicit values in one transaction; Undo restores them together. Reset removes editable owned side declarations and retains attached sources. Binding-owned sides disable linking and remain individually locked. Alignment/direction/wrapping buttons carry accessible value labels. The review fixture has no live backend.

Transparent/alpha colors use checkerboard previews and an opacity percentage. Picker changes retain opacity. Named/HSL colors resolve independently in the browser; context-dependent/unsupported formats retain text and show an unavailable swatch, not a guessed value. Selecting a new solid color deliberately replaces that authored value. No document bytes are changed by parsing, measurements, search or resizing.

Layers search shows matching rows with ancestors, including collapsed component content. Search does not rewrite expansion history or source; clearing it restores the normal tree. Search ArrowDown enters the tree; tree arrows/Enter preserve exact occurrence selection; Escape clears search while the search field is focused. Full long names and provenance remain in tooltips and Selection details & provenance.

## Builder checks and evidence

- Root TypeScript and design-proof TypeScript PASS.
- Renderer 123/123 PASS, including ten editor UX tests.
- Design-proof 12/12 PASS; production build PASS, existing renderer/workbench accessibility warnings retained.
- Broad Svelte check remains FAIL: 23 errors / 4 existing warnings in unchanged files. Full current output: broad-svelte-check.txt.
- Scoped supported TS/JS formatting PASS; Svelte formatter is not bundled, as previously disclosed.
- Builder real Chrome journey PASS: mobile Text size visible on first screen, sticky header retained, linked four-side edit/Undo/Redo, translucent shared fill/save/reload/reopen, exact search selection/clear, 1440/1024/390/480 selected captures, no page exceptions. builder-journeys.json is implementer evidence; independent candidate verdict pending.

Screenshots: heading-1440.png, heading-390.png, spacing-1440.png, alpha-control-1440.png, search-selection-1440.png, selected-1024.png, selected-390.png and container-480.png. Compare with the retained previous screenshots and historical Before capture in the parent directory.

## Three-minute walkthrough

1. Select the heading, open Style, and change Text size near the top. At 390 the same control stays on the first screen; scroll and confirm selection/scope remain visible.
2. Expand Research service in Layers and select Service card. Read Shared · 3 authored instances, change Background and its Opacity. Switch This instance and compare the single wrapper's result.
3. Open Size & spacing, link Padding sides and enter 29. Undo/Redo to see all sides recover together. Open a source badge, create an override and Reset it.
4. Search Layers for Card description, select a matching occurrence and clear search. Confirm Inspector/canvas refer to that exact instance. Try arrow keys/Enter and full-name provenance details.
5. Save, reload and Reopen saved. Changes survive. Preview widths and searches leave the source clean.

The independent verifier will challenge the exact pushed candidate before a final verdict. The overall U2 manager owns integration and combined verification. No main merge, deployment or publication. Actual human founder observation is prepared in FOUNDER-EXERCISE.md and remains pending a participant.
