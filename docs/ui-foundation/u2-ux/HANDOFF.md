# Integration handoff — Inspector / Layers usability slice

Base: 83ba87f7aa112a1d93e7236c9c3ec2f4505f6cff.
Branch: codex/ui-foundation-u2-inspector-ux.
Owner experience acceptance PENDING. The U2 manager integrates technical repairs and verifies the combined candidate; this slice does not close U2.

## Exact candidate history

- Starting base: 83ba87f7aa112a1d93e7236c9c3ec2f4505f6cff (compiler repair acceptance pending).
- Initial pushed candidate: 4d7b0670186a04411a51234d361bb8c9ef65fea1. Independent round 1: FAIL; original report and screenshots retained.
- Repaired pushed candidate: d0ba90cfcd5efead2b7c7c82d37a2ed29483d715. Remote refs/heads/codex/ui-foundation-u2-inspector-ux matched this full SHA immediately after normal push. Independent round 2: PASS WITH NON-BLOCKING FINDINGS; see independent-review/ROUND-2.md.
- The final handoff commit will add evidence only; its remote SHA is supplied in the owner delivery. The manager must verify the combined integration candidate separately.

## Mounting and additive API

Imports remain Inspector, Layers, EditorCanvas, EditorBridge and createLocalStorageDocumentStore from @victframework/ui-editor. EditorLabels is the new exported type. The existing setConditionalStyle builder is now exported publicly (additive; unchanged canonical command semantics). Inspector accepts optional labels: {nodes, definitions, actions, routes}, each a read-only ID → display name map. It does not persist labels or infer product semantics. Existing props remain supported.

Layers accepts optional document (canonical working UiDocument), labels, and scope (the existing renderer DocumentScope). Pass the same view/record/state/tokens scope as the canvas for actual repeat/conditional selection. Without runtime scope it displays an explicitly labeled template and refuses fake record selection. Pass onSelect and selectedOccurrence to both modules. The new route is the concrete mounting example: examples/ui-design-proof/src/routes/editor-review/+page.svelte and review-document.ts.

Subscribe to EditorBridge and derive fresh working document and snapshot from a version signal. Selection is ephemeral through bridge.select; mutations use onApply → bridge.apply; undo/redo/save/reopen remain bridge-owned. Pass lastIssues from the returned outcome. Save feedback must depend on actual store acknowledgement.

Inspector styleConditions takes declared media/container IDs and friendly query labels. Selecting a condition edits that destination, not preview dimensions; pseudo selection authors a rule without forcing hover/focus. readEffective receives an exact occurrence and property; return actual getComputedStyle measurements or undefined. Refresh it after DOM updates and viewport/container/condition changes; the review route demonstrates window resize plus ResizeObserver. Do not return guessed authored origins. Text selection styles the containing source element; instance selection styles the component wrapper. Common and Advanced use identical command builders.

Theme inherited CSS variables: --ui-editor-font, --ui-editor-panel, --ui-editor-input, --ui-editor-ink, --ui-editor-muted, --ui-editor-line, --ui-editor-accent, --ui-editor-selection. Canvas retains its existing --ui-editor-hover and --ui-editor-selected hooks. Host owns panel height/scrolling and narrow-screen switching. New modules ship a coherent default appearance without a required global CSS import.

Do not copy the dedicated fixture into the toolkit. Existing workbench mounting changes are instructions only: pass document, labels and appropriate renderer scope into Layers; labels into Inspector; keep bridge/canvas selection synchronized; refresh readEffective after tick. Manager-owned technical fixes are listed in FINDINGS.md.

Source pointers: Inspector.svelte declares the supported props; Layers.svelte declares its additive props; inspector-ux.ts declares EditorLabels; index.ts provides the public exports. The review route subscribes once to the bridge and cleans up its subscription/ResizeObserver/window listener through Svelte effects. It client-mounts the store-backed canvas so saved revision CSS agrees with the loaded source.

## Builder checks at initial candidate

- Root tsc: pass.
- Relevant ui/ui-editor unit tests: 70/70 pass.
- Renderer suite: 119/119 pass (includes six editor UX tests).
- Root integration: 4/4 pass.
- Design-proof tsc: pass.
- Supported design-proof Vite production build: pass, existing renderer/workbench accessibility warnings disclosed.
- Renderer Svelte check: 0 errors / 2 existing warnings.
- Broad design-proof Svelte check: retained out-of-scope errors, see FINDINGS.md. Not claimed green.
- Builder Chrome journeys: text/size, shared/instance backgrounds, spacing, undo/redo, save/reload/reopen, responsive/no horizontal overflow. These are implementer evidence; independent verdicts are retained separately (round 1 FAIL, round 2 PASS WITH NON-BLOCKING FINDINGS).

## Three-minute founder walkthrough

1. Open http://127.0.0.1:5197/editor-review. Click the large heading; Content shows its text. Change it and Apply text. Choose Style and change Text size using the numeric field.
2. In Layers expand Research service, then select Service card. Choose Style → Background picker. Shared component changes all three cards. Switch to This instance and choose another color: only this wrapper changes. The number counts authored instances, not runtime repeated occurrences.
3. Expand Size & spacing. Change padding top; Undo and Redo to compare. Select Card description, open Text color → Value origin, read its inheritable ancestor declaration. Override Text color, then Reset Text color to return to shared/inherited styling.
4. Save, reload the browser, then Reopen saved. Confirm edited content and styling survived. Use Layers with arrows and Enter to select an element; canvas outline and Inspector follow. At 390px use the panel tabs. Select 480 preview width to inspect the named container condition; choose its editing condition explicitly if you want to author there.

Known limits: instance wrapper-only style editing, no instance literal text replacement, computed origin cannot be inferred from a value alone, external CSS/token/binding values may require Advanced, no forced pseudo-state simulator, template-only Layers without supplied runtime scope. This is a local review fixture, not complete Studio or live backend work.

## Visual evidence

Before: [historical selected shared Inspector](screenshots/before-shared-inspector.png), unchanged Inspector source from prior U2 recheck through the pinned base. After: [selected heading and size controls](screenshots/heading-1440.png), [instance scope and background](screenshots/instance-1440.png), [1024 selected state](screenshots/selected-1024.png), [390 selected state](screenshots/selected-390.png), [480 container](screenshots/narrow-container.png). These builder captures were refreshed during repair testing; the fresh evaluator's selected-state screenshots are preserved separately with its exact candidate verdict.

The design moves technical identifiers behind Advanced, names the selected content, groups common editing controls, exposes the edit destination and keeps authored overrides distinct from browser measurements. Layers starts with scannable component groups and retains exact selection/provenance.

## Repair-candidate builder checks

Renderer suite: 120/120 pass (seven editor UX tests). Design-proof: 12/12 pass. Scoped TS/JS formatting passes. Browser resize comparison passes at 390 and 1440. Round 1 independent FAIL and all original observations remain in independent-review/ROUND-1.md. Exact repaired candidate independent recheck: PASS WITH NON-BLOCKING FINDINGS.
Root typecheck and design-proof production build also pass after repairs. Broad Svelte check remains 23 errors / 4 existing warnings; see retained log.

## Reproduction and manager action

Final independent report: [ROUND-2.md](independent-review/ROUND-2.md). Tested code: d0ba90cfcd5efead2b7c7c82d37a2ed29483d715. Report copied verbatim, SHA256 6ABBD9F0515BBDC01DB851BBEFB27EF202737D4F8E8E7BA703943832C1BE05D6, matching the evaluator's delivery. Round-1 report hash remains B99907F938D399066ABB8CC060A0CD26F05E8949C747D3C2CE79633224678EFA. All repair findings M1–M3 and L1 passed affected recheck. Independent checks: root tsc, 120 renderer tests, 12 design tests and production build pass; broad Svelte check remains 23 errors / 4 existing warnings. Unchanged unit 70 and integration 4 were verified at round 1.

Fresh independently tested selected states: [1440 heading](independent-review/round2/selected-heading-1440.png), [1440 instance](independent-review/round2/instance-selected-1440.png), [1024](independent-review/round2/selected-1024.png), [390](independent-review/round2/selected-390.png), [480 container](independent-review/round2/container-480.png), [long label at 390](independent-review/round2/long-label-inspector-390.png). Compare these with the historical Before capture above. Reports retain reproduction steps, authored/actual measurements, failed runs and source identities.

In a checkout of the tested candidate, install the unchanged lockfile with npm ci --ignore-scripts. Build contracts, ui, sdk and application workspaces before the design proof. Start the dedicated route from examples/ui-design-proof using its local Vite executable, a free dedicated port and --strictPort. Port 5197 is this builder's live preview. Do not stop the manager's servers.

From the repository root, reproduce the supported checks:

```text
npm run typecheck
npx vitest run --project unit packages/ui/test packages/ui-editor/test
npx vitest run --project renderer
npx vitest run --project integration
npm run typecheck -w ui-design-proof
npm run test -w ui-design-proof
npm run build -w ui-design-proof
```

The separately recorded broad diagnostic command is npx svelte-check --tsconfig examples/ui-design-proof/tsconfig.check.json; it remains red. Do not substitute a narrower green check for that result. FINDINGS.md identifies the precise manager-owned repairs.

Builder probe.mjs requires Chrome and puppeteer-core, uses only the review fixture's localStorage key, and resets that fixture before its journey. Independent report harnesses and screenshots are separate evidence, with their own ports/candidate identities. The three-minute walkthrough above can be performed manually without those harnesses.

Next allowed manager action: inspect this branch and independent reports, integrate the bounded slice with technical repairs in the manager's isolated candidate, apply the existing-host mounting instructions, and independently verify the combined result. Founder experience acceptance remains a separate owner decision.
