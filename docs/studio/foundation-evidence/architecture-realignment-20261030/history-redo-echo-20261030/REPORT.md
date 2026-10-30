# Source Redo echo marker — isolated builder reproduction and repair

Branch:codex/pointer-history-repro-20261030.
Checkout:C:/Users/RZ1/.codex/worktrees/vict-pointer-history-probe-20261030.
Baseline:6b079c47aa3f6d0e057174adfd10b1409da23bb8 (documentation descendant of production source72b7e09b1e6cbd5269578f3c3b1ccdf120a22c3b; the affected production files were unchanged).

## Native evidence and bounded finding

The retained stage-4-native-drag-history-pass.json shows source graph161 and node2's moved527.8139,-42.9272 position after source Redo. Redo did reach canonical source. Later edge removal/reconnection produced graph162 with the old330,80 position. Source-only history receipts and immediate browser reads could not establish why. The separate settled native keyboard source history remains valid at its stated source scope. It is not discarded or relabeled as failed pointer movement.

Independent mounted reproduction establishes a real source/render-session synchronization defect. It does not establish an issue in pointer-coordinate calculation, native event settlement or undo application itself.

## Isolated reproduction

The diagnostic fixture copies the retained actual Stage4 app/body/ordinary-control composition and combines it with the retained exact afterUndo graph160 snapshot. This is a disposable test fixture,never a replacement owner application or actual-agent proof. A test-only registered component exposes public GraphWorkspaceContext.apply operations and select; no private graph store or mocked graph implementation is used. Genuine EditorCanvas,EditorBridge,Studio source/runtime callbacks and host@2 source ownership remain in the path.

The harness applies the same validated moveNodes operation and coordinates as the native drag,then settled shared Undo and Redo. Canonical source is161/moved,while the rendered graph remains translate(330px,80px). Public edge selection,remove and typed connect then emit graph162/old position with no diagnostics,where the correct result is graph163/moved position. Both assertions failed before repair. Raw:pointer-history-public-operations-red.log (2/2 failed). This is operation/session proof,not another physical-pointer demonstration.

An earlier attempt used a synthetic Delete event after programmatic selection; that selection did not settle into the expected viewport removal,so no remove mutation occurred. Its separate pointer-history-baseline-red.log still proves the settled rendered position mismatch,while the full mutation sequence in that first attempt is not claimed. The subsequent public-operation harness reproduced the complete lost-position sequence exactly.

The compatibility GraphSurface has the same marker shortcut. A genuine graph1 keyboard move produced revision2/position50,40; settled shared Undo/Redo restored that canonical source; the next ordinary Notes change emitted revision2/position40,40 instead of revision3/position50,40. Raw:legacy-history-baseline-red.log (1/1 failed).

## Cause and minimal repair

GraphWorkspace and retained GraphSurface remember their last emitted serialized graph to ignore its immediate controlled echo. After a different external source,including Undo,is parsed,the old emitted marker remained. A later Redo to those old emitted bytes was incorrectly treated as a fresh echo,so the live model/session never adopted it. Subsequent validated local operations used the older session and overwrote the already-redone position.

Both components now clear that marker when a different external source is adopted. A Redo returning to earlier emission bytes is parsed into the live session. Immediate current controlled echoes still retain their normal fast path. There is no runtime,authority,API,schema,migration or component revision change,and no ordinary-control adapter was added.

## Checks

- New2workspace and1legacy probes plus5existing scoped/nested/private/history/save/import bridge cases and1existing refusal case:9/9 PASS,exit0. Raw:pointer-history-repair-tests.log. The corrected full public mutation sequence ends graph163 with moved position and sibling values retained.
- Existing package composition suite:17/17 PASS,exit0. Covers Workspace@1/@2,ordinary controls,standalone and host@1 compatibility,nested ownership and refusals. Raw:pointer-history-flow-compatibility.log. Counts are overlapping scoped evidence,not a milestone total.
- Studio TypeScript:exit0. Raw:pointer-history-studio-typecheck.log. The draft diagnostic nonpersisting store initially used the wrong load tag and omitted refusal reason; corrected test-only types before this final check.
- Flow Svelte check:0errors/5inheritedrendererwarnings. Raw:pointer-history-flow-check.log.
- git diff --check:clean.

The isolated checkout reuses installed third-party dependencies through local directory junctions,links framework packages to this checkout's own package directories,and copies existing ignored dist outputs from the active72-source checkout for unchanged TypeScript packages. The two changed Svelte components are loaded from this isolated checkout and tested there. No npm installation,provider/browser action,owner data mutation,serving activation or push occurred. This review checkout and red evidence are retained.

A fresh independent verifier must challenge the exact repaired candidate. The integrator owns source integration,affected build/consumer checks and an eventual native sequence recheck against the newly serving identity. This builder report does not award that verdict or owner acceptance.
