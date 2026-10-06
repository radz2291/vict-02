# Independent Inspector/Layers experience challenge — round 1

7 October 2026. Verdict: **FAIL — repair and affected independent recheck required.** Owner experience acceptance remains pending; this review does not close U2 or accept the underlying compiler repair.

Candidate: `4d7b0670186a04411a51234d361bb8c9ef65fea1`, branch `codex/ui-foundation-u2-inspector-ux`. Base: `83ba87f7aa112a1d93e7236c9c3ec2f4505f6cff`. Independent detached checkout: `C:/Users/RZ1/Desktop/RZ/vict-02-u2-ux-review`. Remote branch SHA independently matched candidate; remote main remained `4d2df037d8a82d36c60bf1bff16919650643ce22`. Candidate source was never edited. Evidence fixtures/harnesses were authored only under this report directory.

The evaluator did not implement the candidate. Own npm installation, own Vite port 5198, own Chrome processes, separately authored Puppeteer journeys. A supplemental canonical fixture on port 5199 mounted actual candidate Inspector and EditorBridge for declared action/route tests; it did not modify the candidate review route. Governed by the owner's bounded instruction, frozen U0/UI-foundation records, current U2 handoff and retained earlier failures. This is the separate U2 usability slice, not a Stage 9 gate.

## Findings

**M1 — Medium: collapsing an ancestor removes every Layers keyboard entry point.** Select an Introduction child through keyboard, then click Collapse Introduction chevron. `focusKey` remains the hidden selected child and every visible treeitem has `tabindex=-1`. Tab navigation skips the entire tree. Evidence: `journeys.json` records `collapsedTreeTabStops: []`; `collapsed-tree.png`. Repair must keep a visible roving entry point when collapsing and verify tab reentry, arrows and Enter after collapse.

**M2 — Medium: reconnecting navigation silently discards existing route parameters.** In the independent canonical fixture, heading click navigated to route.a with `params.id={op:'literal',value:'keep-param'}`. Behavior → Destination route.b → Connect navigation succeeded, but the resulting interaction contains only on/action/routeId. Existing parameter bindings vanish. Reconnecting declared actions correctly retained input expressions. Evidence: `AdversarialHost.svelte`, `adversarial.mjs`, `adversarial.json`, `behavior.png`. Preserve existing navigation parameters when reconnecting, and test same-route reconnect as well as switching routes.

**M3 — Medium: Browser now values become stale after responsive resizing.** At 390 viewport the heading has actual 32px media styling. Return to 1440 and set Preview width480. Actual heading becomes52px, but the Inspector still says Browser now:32px. `journeys.json` records actual52px in container480; `container-480.png` shows stale32px. Host recomputation is tied to bridge/document version rather than viewport/container dimensions. Refresh measurements after both window resizing and named-container resizing, after DOM styles settle. This impairs the required truthful authored/effective/responsive journey.

**L1 — Low: candidate adds a non-reactive canvas-reference warning.** Production build and broad Svelte check both report editor-review canvas binding is updated without `$state`. Repair within the dedicated host. This warning is distinct from M3; clearing the warning alone is not proof of resize refresh.

## Journeys

| Required journey | Verdict and observed evidence |
| --- | --- |
| Select heading; recognize/edit text and size | PASS. Canvas click selects exact text occurrence; Content displays literal. Independent founder heading and52px reached actual rendered heading. Meaningful text header, source breadcrumb, no ID-first editing. |
| Card background visible control | PASS. Layers Research service → Service card; Background picker changed all3 cards to rgb(204,221,238). |
| Shared versus instance | PASS. Shared count3; This instance explicitly describes wrapper limit. First card changed to rgb(170,136,51), remaining2 retained shared color. |
| Spacing without CSS names | PASS. Size & spacing → padding top37; all shared cards render37px. Numeric/unit control, no raw property entry. |
| Inherited value; override/reset | PASS. Opened Text color Value origin: page ancestor declares #253346, external winning cascade origin expressly not inferred. Override produced rgb(17,34,51); Reset restored rgb(37,51,70). |
| Layers exact selection and canvas synchronization | PASS. Exact occurrence keys captured for text and component inner card. Inspector and selected Layers row track selection. |
| Undo/redo/save/full reload/reopen | PASS. Padding37→Undo24→Redo37. Saved revision2; browser full reload and Reopen saved retain heading text,52px, shared/instance colors and37px padding. |
| Keyboard, focus, long labels | FAIL M1. Arrows/Enter initially select exact node; collapsed ancestor destroys tab entry. Long selected header supplemental fixture wraps at390; controls/reset remain contained, no page horizontal overflow. |
| 1440×900 /1024×768 /390×844 | PASS for readable selected-state panel layout. Narrow host intentionally switches Canvas/Layers/Inspector; full-page widths equal viewport, visible controls stay within panel. Effective responsive measurement FAIL M3. |
| Established480 container | PASS responsive canvas behavior: cards become one column, actual compact padding16. No silent source edits observed; Inspector effective display FAIL M3. |
| Declared actions/bindings | PASS action picker input preservation; navigation parameter preservation FAIL M2. |
| Condition/reset honesty | PASS bounded observed behavior: selected narrow target displays32 source and separate actual52; editing35 on inactive query leaves actual52; reset returns retained attached32 rather than falsely removing shared source. Full active conditional simulation and forced pseudo-state are not claimed. |

Visual inspection of selected-heading-1440, instance-selected-1440, selected-1024, selected-390, container-480, long-label-inspector-390: coherent neutral panels, restrained blue selection, clear section controls and usable wrapping. Typography/source/breadcrumb metadata stays secondary. Value origin is initially collapsed; required origin journey explicitly opened it. The 1024 canvas is dense because host reserves both panels; panel controls remain intact. Large Layers labels consume scrolling space but do not overlap disclosure/badges.

## Independent checks

- `npm ci --ignore-scripts`: PASS; unchanged manifests/lockfile. Existing engine warning for posthog and npm audit summary retained as environment observations; no dependency repair attempted.
- `npm run build -w @victframework/contracts -w @victframework/ui -w @victframework/sdk -w @victframework/application`: PASS.
- `npx tsc --noEmit`: PASS.
- Relevant unit run `npx vitest run --project unit packages/ui/test packages/ui-editor/test --project integration`:70/70 PASS (filter did not include integration files).
- Separate `npx vitest run --project integration`:4/4 PASS.
- `npx vitest run --project renderer`:119/119 PASS,17 files.
- `npm run build -w ui-design-proof`: PASS; existing renderer click accessibility and workbench separator warnings plus new canvas-reference warning L1.
- `npx svelte-check --tsconfig examples/ui-design-proof/tsconfig.check.json`: **FAIL**,23 errors/5 warnings in5 files. Existing EditorCanvas missing UiRenderPlan, missing generated $app/environment declarations and workbench `$state` naming/type errors; new host warning L1. Do not represent broad check as green.
- Chrome journeys:0 page exceptions in completed primary and adversarial runs. Harness assertions/actions include DOM-driven control events and actual Puppeteer canvas/keyboard actions; they are evidence of real module/runtime behavior, not a human founder acceptance claim.

## Failed observations retained

Initial Puppeteer lookup in advertised bundled top-level node_modules failed; resolved by read-only absolute import from installed implementation dependency. First primary harness used capitalized Padding top while accessible label is lowercase; corrected harness and reran complete journey. First supplemental request was rejected by SvelteKit Vite fs allow-list; independent Vite host created within evidence directory. Supplemental first relative import had one excess parent segment; corrected fixture path. These are harness/environment failures, not candidate product failures. The original first run terminated before persistence; its early screenshots were superseded by the completed fresh run. Candidate defects above remain preserved without relabeling.

Next permitted action: builder repairs M1–M3/L1 within authorized paths, commits/pushes exact next candidate, and supplies its SHA for independent affected recheck. No merge, publication, owner acceptance or U2 closure follows from this report.
