# U4 COMPONENT-AMENDMENT — INDEPENDENT CONTRACT REVIEW (01)

- Reviewer: fresh independent contract reviewer; authored none of the candidate; read-only (no file in the worktree was modified).
- Candidate under review: `9c31fae110c81aaaf746726e3e502f0353e82516` on `codex/ui-foundation-u4-component-amendment` (worktree `vict-02-u4-handoff`; `git status` clean; `git rev-parse HEAD` = candidate SHA, verified live at review time).
- Base: `cfbd6d31b1e670034f9d94a0ac9a52b017756731`. Candidate delta = exactly 14 documentation/fixture files (+1510/−250), no source changes (diff-verified).
- Review targets: `U4-COMPONENT-AMENDMENT.md`, `fixtures/component-contract/*` (7 files + README), `U4-COMPONENT-INTEGRATION-DESIGN.md`, `U4-COMPONENT-REUSE-MATRIX.md`, `U4-HANDOFF.md`; STATE/DECISIONS deltas read for consistency.

## 0. Method — what was actually checked

Every source-linked claim was checked against the real code at the candidate SHA (read-only):

- `packages/ui/src/validate.ts` (schema guard, component-node validation, prop closure, literal checks, slot checks, interaction action/route catalog checks).
- `packages/ui/src/compile.ts` (`UiExtensionDescriptor`, `UiRenderInstruction` union, `compileUiDocument` seam, extension/component compile branches, `EXTENSION_UNAVAILABLE`).
- `packages/ui/src/document.ts` (`UiExpression` union incl. `compare`, `UiPropDecl`, `UiPrimitiveType`, `UiLocalStateDecl`, `UiSlotFill`, component node shape, `UiOccurrenceRef` in `occurrence.ts`).
- `packages/ui/src/edit.ts` + `session.ts` (atomic transactions, whole-transaction validation, `bindExpression {kind:'prop'}`/`fillSlot`/`connectInteraction`, `UI_EDIT_UNDO_CONFLICT`, two-phase stage-save, deferred-product-reference filter).
- `packages/ui/src/canonical.ts`, `packages/application/src/compile.ts` (`canonicalUiDocument` digest; `computeApplicationVersion` inputs incl. `referencedComponents`; `CompileApplicationInput.components/uiExtensions`; closed `APPLICATION_FIELDS`).
- `packages/ui-svelte/src/document/extensions.ts` (`resolveSvelteExtension` identity matching, `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`), `logic.ts` (`evaluatedComponentProps`, `reportDiagnostic`), `RenderNode.svelte` (declared-action `dispatch`, `handleChange`), `component-context.ts` (`useVictActions` refusal).
- `packages/ui-svelte/src/*.svelte` (Button, ActionButton, Select, Overlay, AppShell, ControlScope) and `packages/ui/src/composition.ts`, `packages/ui-preview/src/session.ts` (`PreviewDataAdapterPort`).
- `packages/ui/src/diagnostics.ts` (severity model; absence checks for every new code and for `UI_DOC_UNKNOWN_ACTION`).

## A. Source-linked claims — verification results

| # | Claim | Verdict | Evidence |
| --- | --- | --- | --- |
| A1 | `validateUiDocument` hard-rejects `schema !== 'vict.ui-document@1'` with immediate return; validation is property-based, no unknown-field rejection sweep | CONFIRMED | validate.ts:53–70 (`return issues` after schema push); no field-sweep anywhere in validate.ts |
| A2 | Component-instance props declaration-closed (`UI_DOC_UNKNOWN_PROP`), literal type checks (`UI_EXPR_TYPE_MISMATCH`) | CONFIRMED — **for stored definitions only** (see M-4) | validate.ts:529–555 |
| A3 | Extension seam: definitionId → descriptor map → `kind:'extension'` with propDecls/propValues; `EXTENSION_UNAVAILABLE` + `kind:'unsupported'` when neither resolves | CONFIRMED | compile.ts:423–445, 241 |
| A4 | `resolveSvelteExtension` exact identity (id+revision descriptor; extensionId+revision+rendererImplementationId implementation; ≠1 fails closed); `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED` for events/slots descriptors | CONFIRMED | ui-svelte/src/document/extensions.ts:36–76 |
| A5 | `UiEditSession` atomic transactions + whole-transaction validation, continuity-checked undo/redo (`UI_EDIT_UNDO_CONFLICT`), two-phase save | CONFIRMED | edit.ts:4–5, 163+, 593–606; session.ts:80–152, 223–268, `#pendingStage` commit guard |
| A6 | `canonicalUiDocument().contentDigest` → document identity entry → `computeApplicationVersion` (which also hashes resource/view/action revisions and the application `components` list) | CONFIRMED | canonical.ts:84–101; application/src/compile.ts:1209–1262 (`referencedComponents` sorted into the hash) |
| A7 | `UiExtensionDescriptor` has events/slots/styleTargets/inspectionLimits/rendererImplementationId; `UiPropDecl` vocabulary is primitives only; occurrence identity `UiOccurrenceRef` = documentId+sourceNodeId+componentInstancePath+repeatRecordKeyPath; `occurrenceKeyOf` | CONFIRMED | compile.ts:33–44; document.ts:25, 148–151; occurrence.ts:12–20 |
| A8 | `bindExpression {kind:'prop'}` edits component-node props; `fillSlot` exists; Inspector tabs Content/Style/Behavior with occurrence selection and `connectInteraction` authoring | CONFIRMED | edit.ts:83–110, 497–505; Inspector.svelte:18, 169, 202 |
| A9 | Composition semantics (`UiApplicationComposition.navigation`, `responsive.navigationAt`; `UiShellLink.current` renderer-resolved; AppShell matchMedia 720/960; `BitsConfig defaultPortalTo` in ControlScope; `PreviewDataAdapterPort`) | CONFIRMED | composition.ts:1–34; ui/index.ts:113–118; AppShell.svelte:28, 44; ControlScope.svelte:19; ui-preview/session.ts:41 |
| A10 | Implementations receive no dispatcher (props+occurrenceKey+nodeId only); `useVictActions` throws outside registered surfaces; `UI_DOC_UNKNOWN_COMPONENT` is a compiler-deferred code at validate/compile/edit | CONFIRMED | UiSvelteExtensionProps (extensions.ts:11–15); component-context.ts:14; validate.ts:515–521 + compile.ts:233–247 + edit.ts:619–624 |
| A11 | **"Already-supported instance machinery, unchanged: `revision` pinning" (§3.1) and "document revision pin semantics already used by extensions" (§4.1)** | **FALSIFIED — BLOCKER B-1** | compile.ts:438/444 emit `revision: extension.revision` (descriptor echo); `node.revision` honored only for stored definitions (compile.ts:516); compile descriptor map is id-keyed, last-wins (compile.ts:241) |

## B. Instance/output/binding protocol completeness

Substantially complete and implementable: output declaration (`UiOutputDecl`, `'void'` | primitive), instance bindings (`outputs` map, setState/invokeAction variants), `$output` scoping (§3.5 + §5.1 path-annotated rejection), binding replacement/clearing (`setOutputBinding`, `binding?: undefined`), stale/generation gate (§5.3), declared-only + payload-typed delivery with `UI_COMPONENT_OUTPUT_REJECTED`. Gaps and unspecified behaviors are itemized as findings (B-1 identity pin; M-4 missing diagnostic for the promised array-reference rule; M-6 incomplete implementation interface; I-3 delivery ordering). None of those are architectural; B-1 must be resolved before freeze.

## C. Founder visibility and editor round trips

Adequately specified. Each proof in amendment §6 and design §1 names what the founder selects, inspects, edits, connects, and persists; the Inspector specification is concrete enough to implement against the existing Inspector (Content prop editors via literal + `bindExpression{kind:'prop'}`; Behavior-tab "Component outputs" with type-filtered state picker, action picker over `knownActionIds`, `$output` input mapping) — the pattern already exists in `connectInteraction` authoring (Inspector.svelte:202). The same-control arc (select→edit→undo/redo→save→reload→finished app) is enforced as FAIL/NOT DEMONSTRATED in handoff §2 and §12.2(4), matching amendment §2.1's anti-downgrade rule.

## D. State isolation between instances

Covered: distinct keys fixture (checkbox-valid.json ackA/ackB), rebind semantics via `setOutputBinding` replacement/clear, author-time refusal of a type-incompatible rebind (design §1.2), stale-occurrence drop and generation gate (§5.3), occurrence-keyed emission stamping. One spec asymmetry noted (M-5): only the output side is type-guarded; input prop references are not.

## E. Identity/versioning and old-document compatibility

- Identity matching rules: descriptor and implementation matching rules are complete and fail-closed **except** the instance→descriptor revision rule, which as specified degenerates to self-echo (BLOCKER B-1). ABI matching (descriptor `abi` vs implementation `abi`) is well specified; who checks it (render side) and with what code (`UI_COMPONENT_ABI_UNSUPPORTED`) is consistent across §4.1/§5.2/render-failures.json.
- Digest/versioning statements (§4.2) verified correct against canonical.ts and `computeApplicationVersion` (A6), with one dependency: "re-pinning a revision" changes bytes only if the instance pin is honored end-to-end — again B-1.
- Compatibility matrix (§4.3) is honest: property-based validation does tolerate the additive fields (A1); old renderer fails closed via `EXTENSION_UNAVAILABLE`/`UI_RENDER_EXTENSION_UNAVAILABLE`; props-only descriptors keep failing closed (extensions.ts:51–58). No silent-misbehavior path identified in the matrix rows themselves.

## F. Dispatch authority, stale callbacks, safe failures

Confirmed sound: implementations receive `emit` and nothing else (no dispatcher, no adapters, no application data beyond evaluated declared props — A10); emit channel is declared-only, payload-typed, generation-gated (§3.4, §5.3); outputs map onto the two existing channels (setState / declared-action `dispatch`, RenderNode.svelte:36, 86–92) — no new execution engine; preview fencing preserved (`PreviewDataAdapterPort` unchanged; P3 `useVictActions` semantics distinct). Diagnostic consistency between §5, fixtures, and handoff §6 has defects: fixture code `UI_DOC_UNKNOWN_ACTION` exists nowhere (M-2); §5.1 omits the promised array-reference rule diagnostic (M-4); handoff negatives omit two specified author-time diagnostics (M-7).

## G. Feasibility of the four proofs and fixture fidelity

Feasible overall, with named caveats:

- **Checkbox** — feasible: bits-ui Checkbox (catalog/checkbox.ts) with `checked`/`onCheckedChange`; label via wrapper. Distinct-key isolation fixture matches document model exactly.
- **AppShell** — feasible: `children` snippet, composition semantics, matchMedia 720/960 all real (A9); wrapper maps declared slot 'content' → children.
- **Select** — feasible with the array-reference rule built: today's `Select.svelte` takes `options: readonly UiSelectOption[]` + `value: string` + `onChange`; expression language genuinely has no array literal (UiExpression union; document.ts:30–48) and view fields support `'array'` (document.ts:27), so the reference-only binding is honest. Element-untyped arrays are a declared-limit item (I-2).
- **Dialog** — feasible with wrapper-added controlled open: today's `Overlay.svelte` is trigger-driven (`intent`, `content`, `onOpenChange` — no `open` prop); bits-ui `Dialog.Root` supports controlled `open`, so the wrapper adaptation is real but is a wrapper capability, not an existing Overlay property. Portal-to-ControlScope-root is real (`BitsConfig defaultPortalTo`, ControlScope.svelte:19).
- **Fixture fidelity** — node kinds, `UiSlotFill {name, children}`, `localState {key,type,initial}`, expression shapes (`ref`, `compare`, literal) all match the real model; three fixture defects found (M-2, M-3; case-3's prose also cites a "wrong comparison operand type" that its own excerpt does not contain).
- **Button** — `loading` is not an existing catalog property (I-1): Button.svelte has label/variant/type/disabled/etc.; the pending choreography lives in ActionButton.svelte (`pending` state → 'Working…', aria-busy, disabled-while-pending). The descriptor-level `loading` prop is implementable by adapting that pattern (reuse-matrix §3 row 1 records this honestly), but the amendment/design should name the source pattern explicitly.

## H. Handoff and authorization-prompt consistency

- §12.2 fully subsumes §12.1: every element of the superseded prompt (F3, packing, consumer isolation, proofs, parity/bundle separation, agent exercise, walkthrough negatives, handoff artifacts, gate/repair/preserve, stop conditions, prohibitions) reappears in amended, stricter form; §12.1's banner explicitly voids it ("Any authorization quoting this text authorizes an insufficient scope"). No surviving operative statement contradicts the amendment. The P3 workaround cannot be accidentally authorized: §1 out-of-scope, §2 anti-downgrade rule, §3 route statement, and both prompts all align.
- §1 allowed paths vs amendment §4.3 module ownership agree, with one boundary note (I-4): `packages/application` is named in the amendment ("registration list plumbing (existing)") but is not in the allowed paths — correct as a fail-safe only if truly no change is needed; existing `components`/`uiExtensions` compile inputs support that reading.
- §2 acceptance semantics, §6 negatives, §7 agent brief (authoring-experience version: checkbox + button), §8 pending-review record, §10 carry-forwards (including the bridge-change reproduction obligation) all agree with the amendment. The §8 PENDING references to `reviews/u4/U4-AMENDMENT-REVIEW-01.md` and `U4-AMENDMENT-FREEZE.md` are explicitly marked pending and claim nothing false; per assignment this is not flagged (this report is the intended import).
- Handoff §0 entry SHAs verified in history (cfbd6d3, 16df3bf, 952d92d, 9ec87f3 present; main baseline `4d2df03…` matches live origin/main tip).

## Findings

### BLOCKER

**B-1 — The instance revision-pin mechanism is misattributed as existing and, as specified, degenerates to registry self-echo.**
- Amendment §3.1: "Already-supported instance machinery, unchanged: `revision` pinning"; §4.1: "the instance's effective revision (`node.revision` pin, else document revision pin semantics already used by extensions) equals `descriptor.revision`".
- Source: the extension compile branch emits `revision: extension.revision` and never reads `node.revision` (packages/ui/src/compile.ts:438, 444); the only honored node pin is the stored-definition branch (`definitionRevision: node.revision ?? definition.revision`, compile.ts:516); compile resolves descriptors through an id-keyed Map (compile.ts:241) — last-registration-wins on competing revisions, no fail-closed; no "document revision pin semantics for extensions" exists anywhere (grep across ui/application; document.ts:215's pin comment is definition-scoped).
- Consequence: §3.3 adds fields to the extension instruction but does not change the `revision` source, so the §4.1 rule "exactly one descriptor may match; zero or >1 is `UI_COMPONENT_UNAVAILABLE` at render" can never fire on a pin mismatch — the compiled revision is the descriptor's own answer (self-echo). The ABI gate, stale-safety ("re-resolved to a different revision", §5.3), and the §4.2 version narrative ("re-pinning a revision" → bytes → digest → applicationVersion) all lean on a pin that today has no effect on the extension path, and the fixtures' "implementation revision differs" case exercises only the non-circular implementation half of the check.
- Required repair (bounded, design-level): state explicitly that the compiled extension instruction must carry the instance's effective revision (node pin, else registered-current), that compile resolves the descriptor by (id, effective revision) fail-closed (zero or >1 → diagnostic; replaces the id-keyed last-wins Map for this path), and strike/correct the "already-supported"/"already used by extensions" attributions. Add one render/compile falsifier where a node pin ≠ registered revision produces the unavailable diagnostic.

### MINOR

**M-1 — "Undeclared slot fills are already rejected" is false for descriptor-backed components.** §3.4 claims rejection "at validation/compile (`UI_DOC_UNKNOWN_COMPONENT`, definition 'declares no slot')" and §3.7 says "exactly as today". True only for stored definitions (validate.ts:557–567). For extension components the validator `break`s before slot checks (validate.ts:515–521) and the compile extension branch never reads `node.slots` — such fills are silently dropped today. The check must be built; the "already" wording must go.

**M-2 — invalid-cases.json case 6 expects `UI_DOC_UNKNOWN_ACTION`, a code that exists nowhere.** Not in diagnostics.ts, not in §5.1; the existing code for undeclared action ids is `UI_DOC_UNKNOWN_PRODUCT_REFERENCE` (validate.ts:777–786). Either reuse the existing code in the fixture or specify the new code in §5.1; today fixture and contract disagree with each other and the source.

**M-3 — invalid-cases.json case 3 uses a malformed expression shape.** `{ "type": "boolean", "value": "not-a-boolean-literal" }` is not a `UiExpression` (boolean nodes are `{type:'boolean', op, terms}` — document.ts:40–42; the intended literal is `{type:'literal', value:'…'}`). As written the fixture pins an impossible shape; its prose also cites a "wrong comparison operand type" absent from its own excerpt. Additionally its expected `UI_EXPR_TYPE_MISMATCH` cannot fire for a descriptor component under today's validator (component case breaks at validate.ts:520 before prop checks) — this is part of the M-4 gap.

**M-4 — §5.1 omits diagnostics for promised §3.2 rules.** §3.2 promises "array-typed props accept only reference expressions — new validator rule, Section 5.1", but §5.1 contains no code/layer/severity for it; likewise no specified diagnostic covers literal/reference prop checking against `propDecls` for descriptor-backed components (today's literal check runs only for stored definitions). The failure model is incomplete relative to the contract text.

**M-5 — Input-prop reference typing is unguarded by spec.** invalid-cases case 2 binds boolean `checked` to number `state.count` and expects only `UI_COMPONENT_BINDING_INCOMPATIBLE` (the output-side rule), implying prop references are not type-checked against `propDecls` — a silent runtime type lie at the wrapper boundary, in tension with the fail-closed philosophy. State the disposition explicitly (check, or declared accept).

**M-6 — `UiSvelteComponentImplementation` is never fully declared.** §4.1 requires descriptor-abi vs implementation-abi equality and render-failures.json case 6 requires a slot-capability distinction (`rendersSlots: false` → `UI_COMPONENT_SLOT_UNAVAILABLE`), but §3.4's drafted interface (identity fields + `component`) defines neither an `abi` field nor a slot-capability field. The "complete path" contract is underspecified against its own fixtures.

**M-7 — Handoff §6/§12.2(5) negatives omit two of the five specified author-time diagnostics:** `UI_COMPONENT_OUTPUT_PAYLOAD_INVALID` (the `$output` scope-leak safety property) and `UI_COMPONENT_SLOT_REQUIRED`. Fixtures pin them; the gate's required-negative list does not. Add both to §6 and §12.2(5) at freeze.

**M-8 — The "action input catalog" for typed output-payload checks has no source counterpart.** §3.5: "payload expressions are type-checked against the action input catalog where the application declares types". The compile seam's catalogs are actionIds/routeIds/viewFields/opNames only; application actions carry `inputContractId?` (+ a contracts registry), and the button-action fixture's `applicationInputs.actionInputs` shorthand has no application-schema counterpart. Name the mechanism (e.g., a new compile catalog input derived from contracts) before freeze.

### INFO

- **I-1** Button `loading` is not a property of `Button.svelte`; the pending pattern is `ActionButton.svelte` (pending → 'Working…', aria-busy, disabled-while-pending). Name ActionButton as the adaptation source in §6/design §1.1 so the implementer does not hunt a non-existent prop (reuse-matrix §3 already records this honestly).
- **I-2** `'array'` is element-untyped (`UiFieldType` has no element type); a wrong-shaped array bound to `options` is diagnosable by no specified rule — runtime-only misbehavior. Declare it a limit.
- **I-3** Delivery ordering (multiple outputs, emit vs reactive prop re-evaluation interleaving) is unspecified; one sentence would do.
- **I-4** Amendment §4.3 names `@victframework/application` ("registration list plumbing (existing)") but handoff §1 allowed paths exclude it — acceptable fail-safe given existing `components`/`uiExtensions` compile inputs, but any discovered need there requires a scope decision, and the contract should say so.
- **I-5** Amendment §6's recorded-walkthrough minimum (Checkbox + one of Select/Dialog) is stricter in handoff §2/§12.2(4) (all four controls) — consistent, no contradiction.
- **I-6** STATE.md and DECISIONS-AND-EVIDENCE.md deltas honestly record the owner decision, the PROPOSED/under-review status, and the C-level support table; no overclaim found.

## Verdict rationale

The amendment is well-grounded overall: ten of eleven source-claim groups verified exactly (A1–A10), the compatibility matrix is honest, the failure model is mostly complete, the fixtures match the real document/expression/descriptor shapes, the four proofs are feasible against real components, and the handoff/prompt pair is consistent with the anti-downgrade rule. One blocker prevents freeze: the identity/revision-pin mechanism — the safety backbone the ABI gate, stale-drop, and version semantics all depend on — is (a) attributed to machinery the source shows does not exist on the extension path and (b) specified such that an implementer following §3.3+§4.1 literally ships a circular self-echo pin. This is repairable with bounded design edits (as this handoff's own review history demonstrates), but at these exact bytes it is not freeze-ready.

U4 AMENDMENT REVIEW: FAIL
