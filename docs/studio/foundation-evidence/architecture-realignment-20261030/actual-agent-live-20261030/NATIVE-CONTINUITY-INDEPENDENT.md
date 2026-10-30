# Native continuity — independent offline verdict

Verdict: **QUALIFIED OFFLINE PASS** for source candidate
`72b7e09b1e6cbd5269578f3c3b1ccdf120a22c3b`. Native browser text Undo,
activation, public-artifact consumer refresh, integrated exit and owner acceptance
remain **HELD / UNAWARDED** by this report.

## Identity and scope

Fresh independent review on isolated branch `review/native-continuity-20261030`
in `C:/Users/RZ1/.codex/worktrees/vict-realignment-independent-20261030`.
The checkout was clean at `9a5fb5f1e88424e11a353400200a38e677f4c7d6`
before creating this branch directly from exact candidate 72b7e09. Local
`origin/main` remains `d7401bef6e48330796c74ec00c86db9622d48cdf`; this is
a tracking-ref comparison, not a fresh network fetch. Read AGENTS, canonical
system reference, Stage 9 state/architecture/handoff and current delivery scope.
Later owner authorization supplied by the stage manager permits local review
and evidence commits, explicitly superseding historical push requirements.
No push, merge, provider/browser/device call, activation, owner data mutation,
Stage 9 acceptance or closure occurred in this lane.

## Independent challenge and results

- Renderer: **11/11**, four files, exit 0. Command:
  `npx vitest run --project renderer packages/ui-svelte/test/independent-native-continuity.test.ts packages/ui-svelte/test/document-native-continuity.test.ts packages/ui-svelte/test/scoped-slot.test.ts packages/ui-svelte/test/document-state-values.test.ts`.
  Raw evidence: `independent-native-continuity-renderer.log`.
- Studio: **20/20**, five files, exit 0. From `apps/studio`:
  `npx vitest run tests/native-source-echo.test.ts tests/graph-scoped-bridge.test.ts tests/graph-runtime-refusal.test.ts tests/graph-history-source-policy.test.ts tests/graph-scoped-ownership.test.ts`.
  Raw evidence: `independent-native-continuity-studio.log`.
- `git diff --check`: exit 0. Only independent probes and evidence are added;
  candidate product code is unchanged. Existing Svelte accessibility/initial-state
  and shortcut warnings remain visible in the raw logs.

Two independently authored adversarial cases supplement the builder tests.
A textarea retains exact DOM identity, focus, selected range and private draft
through a newly compiled plan with identical source bytes and revision. A new
document ID and explicit reset replace its DOM and restore initial values.
A retained input follows a changed state declaration, rejects incompatible and
undeclared supplied state, and cannot write string data into a number declaration;
removing its binding removes write authority. Existing renderer cases separately
exercise expired old component emissions, expired scoped channels, undeclared
and mistyped outputs, current valid outputs and late async action completion.

Existing genuine EditorBridge/EditorCanvas cases were rerun independently, using
the retained actual agent source as fixture data. They prove consecutive canonical
input echoes retain the same control, focus and graph position, and a synthetic
historyUndo input reaches canonical state. They also cover controlled repeated
and nested source ownership, private instance local Undo without promotion,
manual/agent shared history, save/reopen and portable import, exact parent fences,
unresolved ownership refusal, incomplete-inspection refusal and runtime rollback.
These are offline fixture observations, not another actual agent or native Undo.

## Source and authority assessment

DocumentHost authority generation still depends on every new plan and explicit
reset. RenderNode and ScopedSlotInstance continue receiving that generation;
retained callbacks check generation/liveness, and async action completion checks
generation/run identity. Removing generation from the DOM key does not prolong
their authority. Document ID and resetSignal still delimit DOM lifetime. Scoped
declarations retain their stable serialized declaration key, so a changed scoped
contract/initial remounts that scoped instance rather than inheriting private state.

Designer still expires simulation/session work on ordinary source revisions,
retains only compatible temporary values and rebases canonical graph mirrors.
Its openSession clears runtime values and advances resetSignal before another
document is rendered. Explicit source-editor replacement calls resetRuntime;
ordinary canonical echoes preserve the renderer token. The helper itself is
not an independent cross-document storage boundary: cross-document runtime
clearance is supplied by openSession, which was inspected here.

No document/application/graph schema or state-authority policy changed. The
shared package gains no private Studio import. The change uses the existing
public resetSignal contract rather than introducing a second renderer or history.
No gating source defect was found in this bounded delta.

## Retained failed probe observations

`independent-native-continuity-initial-red.log` retains an initial assertion
expecting a textarea numeric value to be a browser-coerced string. Happy-dom's
textarea setter stores its supplied value directly. After normalizing that
assertion, removing its value binding hit the same setter's null `.length`
exception, retained in `independent-native-continuity-textarea-null-red.log`.
Inspection of installed happy-dom's HTMLTextAreaElement setter confirms absent
WebIDL coercion. The final declaration-removal test uses an input; the independent
textarea continuity test remains. Neither failure was silently repaired in product
source. Actual browser textarea declaration removal/coercion is unawarded here.

## Consumer helper review and limits

Reviewed `7d8f687c15d4b2bbb38a554ac20cc1e82cf5d1bd` statically. The helper rejects
dirty package/shared tracked inputs, requires a prior successful report, compares
whole tracked package trees and prior artifact hashes, rebuilds mismatches, and
checks a freshly packed inventory against reused evidence. A changed renderer
tree cannot qualify for reuse.

Its general per-package rule does not include dependency contract identities.
For arbitrary future API/build-input changes, equal downstream package trees and
artifact bytes alone do not prove downstream type/build checks remain valid.
This candidate changes DOM lifetime without changing public type contracts, so
the narrower retained downstream evidence is reasonable; no blanket claim for
arbitrary dependency API changes is supplied. The parent must still produce and
verify fresh seven-package packing/consumer evidence for this candidate.

## Next allowed action

Stage manager may complete the affected public-artifact proof and reversible
local rebuild/activation within the owner's existing authorization, then perform
native multichar typing, mid-string selection/caret editing and Ctrl+Z on both
URL and multiline notes, checking canonical values, diagnostics, focus and
geometry. Preserve bfb34e's actual native failure. Do not infer native Undo from
synthetic InputEvents or this offline PASS. Integrated/device/actual-agent gates,
owner acceptance, publication, merge and Stage 9 closure remain separate.
