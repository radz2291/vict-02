# Native controlled-input continuity repair — builder evidence

## Retained actual failure

Serving product at observation:bfb34e2882781bc2dddd05f2b978b418cda12c49. The actual Studio agent authored the one-node Source note application; root used its native URL and multiline notes controls. Appending x reached canonical graph revision4, but the subsequent native Ctrl+Z left x and produced UI_COMPONENT_SLOT_SCOPE_REJECTED. The retained actual source contains https://example.org/source-ax and the multiline notes. Graph-node transform remained translate(40px,40px); the26.4px screen-position shift is reflow, not evidence of a graph drag. Actual files stage-2-control-geometry-and-native-undo.json, stage-2-native-undo-rejection-dom.txt/.png and stage-2-after-manual-control-source.json remain unchanged.

## Reproduction and cause

The renderer generated one authority token for every plan/reset and also keyed its entire DOM tree on that token. A valid source-owned native graph input synchronously updated canonical source, producing a new plan. Studio additionally advanced resetSignal while invalidating simulation on every authored revision. Both paths destroyed the live native input. Its old scoped callbacks were correctly expired; preserving their authority would be an unsafe workaround.

New renderer regression: after an accepted input source echo, the input serialized identically but was a different DOM object; the identity assertion failed. New genuine EditorBridge+EditorCanvas regression loaded a read-only copy of the exact retained agent source into disposable happy-dom storage and failed the same identity assertion on the first input. Separate raw baseline logs:native-continuity-renderer-baseline-red.log and native-continuity-studio-baseline-red.log. These are diagnostic reproductions of DOM destruction, not another actual-agent run or proof of a browser's native undo-stack internals.

Cross-realm editable detection is not the demonstrated source defect: the current viewport/Designer shortcuts already use nodeType,closest and matches rather than realm-specific input instanceof checks. ApplicationViewport forwards the original KeyboardEvent. This repair makes no shortcut or iframe-policy changes.

## Repair and ownership

DocumentHost keeps its authority-generation rule unchanged: every new plan or reset expires retained emissions and in-flight action results. Its DOM keys are now primitive documentId and explicit resetSignal. A same-document source refresh with unchanged occurrence structure retains live DOM,focus and caret. A different document or explicit reset still replaces the subtree. The keys do not mint a new symbol merely because a fresh plan object shares the same documentId.

Studio's sourceRuntimeRefresh helper retains compatible temporary values and rebases only canonical graph mirrors, preserving the established state owners. Designer still resets preview/simulation work,changes test/session identity and clears activity on every authored revision. It independently advances the renderer reset token for a document switch or explicit reset. Source-editor wholesale replacement now explicitly calls resetRuntime. Ordinary same-document source reconciliation does not reset the live renderer subtree. Scoped declarations retain their existing stableJson declaration key: a changed scoped initial/type/contract still remounts that scoped instance. Private state remains temporary and is never promoted into source by this lifecycle change.

No saved document/application/graph schema,component registration,provider authority or public operation revision changes. The prior public resetSignal contract promises reinitialization, and the authority-generation comment promises expiry; neither requires destructive remount for ordinary same-document source echoes. This is a shared renderer lifecycle repair, used by authoring and normal consumers, with private Studio simulation integration.

## Checks

- Renderer final targeted run:19/19,exit0. Includes stable native DOM/focus/caret across source echoes; explicit reset/different-document remount; retained old component output expiry; undeclared/wrong payload rejection; direct scoped-channel generation expiry and undeclared/type refusal; late action result discarded after a plan change; existing declared host-state/scoped-slot/component-ABI regressions. Raw:native-continuity-renderer-final-with-action.log.
- Genuine Studio bridge/canvas plus existing graph bridge/refusal run:8/8,exit0. The actual exported source accepts three successive InputEvents through the same live control,retains focus and geometry,accepts a synthetic historyUndo input event into canonical state without stale-scope errors,and remounts on explicit reset. Existing mixed manual/agent/history/save/reopen/import and private-instance policies pass. Raw:native-continuity-studio-final.log.
- Studio TypeScript:exit0. Raw:native-continuity-studio-typecheck.log. One initial test-only implicit callback type error was corrected before the final check.
- Renderer Svelte check:0errors/5existingwarnings. Raw:native-continuity-renderer-check.log.
- Earlier passing16/16renderer and8/8Studio,then18/18renderer runs are retained chronological checks; counts overlap and are not additive. A late-action negative was added for the final19-case run.

## Limits and exact next proof

Happy-dom does not implement the browser's native text undo stack. The synthetic historyUndo event proves the live callback/source path remains usable,not that native Ctrl+Z succeeded. Root must safely rebuild/activate the exact reviewed candidate,then use native IAB pressSequentially with several characters,mid-string caret editing and Ctrl+Z in both URL and notes controls,checking actual canonical values and diagnostics. Preserve focus/geometry and distinguish native text undo from graph/source Undo. Fresh independent challenge and affected public-consumer proof remain necessary because shared renderer source changed. No browser,provider,process,activation or owner application mutation occurred in this repair lane.
