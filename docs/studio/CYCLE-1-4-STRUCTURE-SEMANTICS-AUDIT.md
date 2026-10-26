# Cycle 1.4 — Structure semantics audit

2026-10-26. Owner requested a reinvestigation of the implementation after the same-direction Reads/Updates arrows were interpreted as one-way communication. Owner prefers one-word labels where possible. **REPORT ONLY: display correctness is PARTIAL; correction proposal follows. No product repair or universal framework verification is claimed.**

Clean local/remote baseline: `282169593c8e3d523c9f6b5e4f6a229ae87321f3`, `codex/studio-cycle-1-4-edge-label-trial`. Isolated audit branch: `codex/studio-cycle-1-4-structure-semantics-audit`, in the existing owned selection-panel worktree. Remote main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`; other tracks untouched. This owner request authorizes investigation/evidence, not the proposed semantic repairs. Current served product remains `a489ced31e867a25a38ef0371c7507c7e7e3d93d`.

## Conclusion and authority

Structure currently presents an authored **reference graph**, not runtime communication or complete value flow. Its implementation preserves useful source ownership and guarded edits, but some displayed links combine different meanings, some lexical scopes are merged, and some real dependencies are absent. Simply reversing every Reads arrow would not resolve those problems. There is no evidence here that the runtime shares unrelated component/repeat/output values; the reviewed compiler and renderer explicitly retain separate scopes. The confirmed conflation is in Studio's projection.

Canonical VICT semantics remain authoritative under [GOV-007](../VICT-SYSTEM-REFERENCE.md#0162-registered-enforcement-principle--gov-007-vict-semantic-authority). Review followed the Stage9 state, architecture and handoff, then the actual public UI document union, compiler, scope evaluator, renderer and Studio host wiring. This covers Studio Structure's representation of `vict.ui-document@1`, its renderer and immediate host integration. It is **not** a new audit of the entire VICT orchestration kernel, every custom Flow canvas authored by an agent, or all deployed applications.

## Findings

| ID / priority | Confirmed observation | Resolution proposed |
| --- | --- | --- |
| SS-01 / high usability | Both read and write arrows use declaring node→referenced state. Correct as subject/reference relationships, ambiguous as data movement. The current screen was interpreted as state never supplying input. SA01 and current-screen evidence. | For value bindings show provider→consumer labelled **Value**; edits remain input→state **Updates**. Keep relationship identity and direction explicit; do not globally reverse every reference. |
| SS-02 / high correctness | `references()` recursively recognizes property names such as `actionId`, rather than visiting typed declaration positions. A valid host-registered inert attribute named actionId creates a false invocation edge, despite zero interactions. SA07 compiles against a legitimate custom semantic catalog. Default Studio catalog does not expose this attribute; the extensibility failure is demonstrated, not claimed on the current saved screen. | Exhaustive typed UiNode/UiExpression traversal; events and outputs alone establish action/write/navigation edges. Ordinary metadata must not acquire behaviour through its spelling. |
| SS-03 / high correctness | `prop.title` in two different definitions, `repeat.row.name` in two separate repeats, and `$output` from two separate component events each merge into one generic reference node. SA02/03/04 use compiling sources. This can also make Other users imply false sharing. | Scope reference identities by actual lexical owner: definition/prop, repeat/item, component/output. Preserve source-to-instance handoffs without expanding all runtime occurrences. Source IDs/labels alone are insufficient scope keys. |
| SS-04 / medium completeness | Projection walks nodes, but not attached reusable style declarations, tokens, style conditions or definition baseStyle. A valid shared style depending on state.tint produces no dependency edge; its state is isolated. SA05. Inline expression bindings are found, so equivalent inline/reusable styles differ in visibility. | Resolve attached styles and condition/token links from the authoritative document/compiled plan. Use **Styles**, **Value**, **Condition** roles; preserve declaration order and scopes. Document registries such as assets are also absent; assets currently have no expression namespace/delivery link to infer, so do not invent an image-asset dependency. |
| SS-05 / medium completeness | `projectStructure(document)` receives no host action-state mapping. The real host passes pending/error/result wiring for demo.submit; the graph action has no corresponding return edges. SA06 plus DocumentHost runAction. | Consume the existing read-only host mapping when supplied and label **Pending**, **Error**, **Result**. Distinguish this from document declarations. If unavailable, mark the boundary **External**; no inferred action result/permission/effect links. |
| SS-06 / medium correctness | Native change handler uses the current DOM value/checked state; the declared value expression is fallback. Structure says “Updates Message from Message” and aggregates the fallback reference with the displayed-value reference into Reads · 2. Both are source locations, not two unconditional runtime reads or two equivalent bindings. SA01 and RenderNode handleChange. | Distinguish **Value** from **Fallback** by typed expression role; group only equal semantic roles. Describe the edit as using the entered/checked value, retaining the fallback explanation in Selection. |
| SS-07 / medium completeness | A valid source with a localState-conditioned reusable style compiles with an authoritative warning and drops that style rule. Structure has no style/support node or diagnostic. SA12. This does not prove the warning is absent elsewhere in Studio. | Surface compiler support diagnostics in Selection/affected nodes as **Unsupported** or **Warning**. Never imply a declared rule is effective merely because it exists. |
| SS-08 / medium provenance | Branch/slot/repeat containment paths are synthesized display strings (for example conditional.branch: show.0), not exact `nodes.conditional.branches.0.children.0`. Definition roots use bare root and fallbacks use slot/index; context can be recovered, but those strings are advertised as source locations. SA08. | Keep exact structured source paths separately from readable captions; include definition/branch/slot location and preserve original IDs for navigation. |
| SS-09 / low discoverability | Whole hierarchy is not a complete declaration inventory: isolated state is hidden even when State and actions is on; style/condition/token/asset registries have no graph nodes. SA09. This is a view policy, not deleted source. | Make **Used** scope explicit and provide an intentional **All** inventory; show visible/available counts and reason for omissions. Keep compact text reversible and bounded neighbours. |
| SS-10 / low consistency | Node card treats native radio as Radio button; Selection's independent type map calls it Input. Connected text is described as screen data even when it is a prop/repeat/output. Some state names are mapped heuristically (busy→Submitting, accepted→Agreement). Definition fallback captions collapse to Defines, losing the slot role on the edge. Static findings, not a live reproduction of each case. | Share the same typed presentation metadata across cards, Selection, Layers and edge accessibility labels. Prefer **Radio**, **Prop**, **Item**, **Output**, **Fallback**. Preserve authored names/IDs and useful context; do not rename values to fit demo assumptions. |

There is no basis to call the whole representation correct yet. SS-01–03 and SS-06 should precede further visual polish. SS-04/05/07–10 complete the truthful coverage model. These are proposed repairs, not work silently performed by this audit.

## Coverage and preserved correct behaviour

| Contract area | Audit result |
| --- | --- |
| Element / text | Canonical containment and literal content remain; the current sole-literal compaction is reversible and retains dynamic/distinct text. Binding semantics need SS-01/06. |
| Component / local definition / catalog | Instance→definition and definition→root links exist; output writes/invocations exist. Prop/output scoping, fallback roles, effective catalog revision/availability and style coverage need contextual metadata. No evidence of a runtime scope bypass. |
| Repeat | Template ownership and declaration-only explanation are retained. Runtime rows are explicitly not all drawn. Item names reused across repeats must not merge. |
| Conditional | Ordered branches, otherwise, local-state predicate references and plain explanations exist. Branches only accept localState conditions. A media branch was correctly rejected by validation; it is not an accepted-source runtime defect (SA11). Exact source paths need repair. |
| Slot | Instance fills and fallback ownership are represented. Slot identity and caller/definition scope must remain separate; compact labels must retain the slot name in supplementary details. |
| Portal | Logical ownership is represented, and Selection explicitly states native portal rendering is unsupported. Keep this truthful limit; do not draw it as a working overlay channel. |
| State / expressions | Initial values are labelled as starting values rather than live state. Pure expression evaluation remains framework-owned. Graph references need typed roles/scoped identity and must not imply unconditional execution. |
| Actions / outputs / navigation | Source invocation/write/navigation declarations exist. Outputs are scoped by runtime binding frames; graph must mirror that. Navigation nodes represent declared route references, not a complete application page graph. Host action-state returns are omitted, not nonexistent. |
| Styles / tokens / conditions / assets | Registries exist in the canonical document. Structure coverage is incomplete; no inference of actual effective CSS or unsupported asset relationships is permitted. |
| Selection / colours / sockets / arrows | Existing colours distinguish read/write/action/type families and sockets remain read-only. Border indicates selection, not runtime execution. Direction, label role and scope must agree on every surface; colour alone cannot resolve them. |
| View / edit authority | Filtering and layout do not mutate canonical source. Definition/repeat/ambiguous moves remain refused by existing guards; this audit did not exercise a new mutation. Shared Flow rendering defaults and framework execution authority remain untouched. |

## Proposed compact vocabulary

Use one quiet visible word for the relationship; names, predicates, source paths, scope and counts belong in tooltips/Selection. One-word preference must not remove necessary meaning. The arrow must be readable together with its label, not inferred from colour alone.

| From → to | Label | Meaning |
| --- | --- | --- |
| State/data/prop → bound control or text | **Value** | Supplies a displayed/bound value; state is passive data, renderer applies it. |
| Control/output → state | **Updates** | Declared state-write destination. |
| Data → event/action declaration | **Payload** | Declared input expression; not an unconditional display binding. |
| Data → native edit declaration | **Fallback** | Used when the renderer needs the declared fallback. |
| Collection → repeat | **Items** | Collection supplying the repeated template. |
| Repeat → template | **Template** | Source template, not a count of live rows. |
| Predicate input → conditional | **Condition** | Input to branch selection; full predicate remains available. |
| Conditional → branch content | **Branch** / **Otherwise** | Ordered alternative, not an active execution highlight. |
| Parent → child | **Contains** | Logical ownership; quiet until focus/hover where appropriate. |
| Component → definition | **Uses** | Declared, resolved definition/revision. |
| Definition → root | **Defines** | Definition body. |
| Component → supplied content | **Slot** | Slot name stays available as context. |
| Slot/definition → default content | **Fallback** | Default content for that slot. |
| Event/output → action | **Invokes** | Declared invocation; does not claim it ran or succeeded. |
| Interaction → route | **Navigates** | Declared destination; not a proven opened page. |
| Action → configured state | **Pending**, **Error**, **Result** | Existing host wiring, only when known. |
| Style → node; token/data → style | **Styles**; **Value** | Presentation dependencies resolved from the selected source. |
| Unavailable external boundary | **External** | Honest limit rather than a guessed connection. |

Selection should reuse the same label and an incoming/outgoing indicator, with From/To context; it need not invent a second wordier reverse vocabulary. Preserve full human authored names. Use **Declared** as a quiet scope cue, not animation or an execution/status claim. No new UI mode is required by this proposal.

## Implementation method proposed

Use one Studio presentation projection over the existing authoritative public UiNode/UiExpression unions, compiled plan diagnostics, catalog descriptors and optional explicit host mapping. Exhaustive typed visitors must fail visibly or require a deliberate new case when the framework vocabulary grows. Do not rebuild expression evaluation, action execution, ownership or validation inside Studio. Derive `relation role`, direction, lexical scope, exact source path, support status and presentation label once; all cards, Selection, ports, edge arrows, search, grouping and accessibility consume that result. Group by those semantics, not only endpoint strings or label text. World-coordinate geometry and source identities remain stable.

Proposed repair acceptance: input value/update round trip through real renderer fixtures; independent props/repeats/outputs with identical names; inline/shared style equivalence; invalid/unsupported counterexamples; known/unknown host result wiring; all seven node kinds and conditional/slot roles; scoped Other users and exact paths; identical semantics in Selection and graph; current stable zoom/read-only handles/canonical digest preserved. No repair acceptance follows from these characterization probes.

## Evidence, counterevidence and next action

Primary implementation references: [typed document contract](../../packages/ui/src/document.ts), [lexical expression scopes](../../packages/ui/src/expressions.ts), [compiler](../../packages/ui/src/compile.ts), [rendered attribute/change/output behaviour](../../packages/ui-svelte/src/document/RenderNode.svelte), [host state/action return wiring](../../packages/ui-svelte/src/document/DocumentHost.svelte), [projection and filters](../../apps/studio/src/lib/designer/structure.ts), [caption/relationship projection](../../apps/studio/src/lib/designer/structure-connections.ts), [declaration descriptions](../../apps/studio/src/lib/designer/structure-behavior.ts), [Selection](../../apps/studio/src/lib/designer/SourceDetails.svelte), [current trial record](CYCLE-1-4-EDGE-LABEL-TRIAL.md).

- [10 characterization probes](cycle-1-4/structure-semantics-audit/semantics.test.ts) pass, [raw log](cycle-1-4/structure-semantics-audit/probes.log), [observations](cycle-1-4/structure-semantics-audit/observations.json). Their assertions reproduce existing gaps; green tests are not desired-behaviour acceptance. SA07 uses a valid custom host catalog, not the default Studio catalog.
- [Two support probes](cycle-1-4/structure-semantics-audit/support.test.ts) pass after correcting the audit harness assumptions, [final log](cycle-1-4/structure-semantics-audit/support.log). [Initial source](cycle-1-4/structure-semantics-audit/support-initial.test.ts.txt) and [initial failures](cycle-1-4/structure-semantics-audit/support-initial.log) remain: SA11 wrongly expected a media branch to compile; compiler correctly refused it. SA12 initially read diagnostics from result.issues instead of successful result.plan.diagnostics. Both are audit corrections, not product repairs or hidden failures.
- [Compiler refusal counterevidence](cycle-1-4/structure-semantics-audit/responsive-support.json); [dropped style diagnostics](cycle-1-4/structure-semantics-audit/conditional-style-support.json). Support limits must be learned from the compiler/renderer rather than a descriptive helper alone.
- [Current actual screen](cycle-1-4/structure-semantics-audit/current-screen.png), [DOM record](cycle-1-4/structure-semantics-audit/current-screen.txt): current Full name value/read/fallback/update relationships, Saved revision3 and digest v1_fe0ac678e80522e8c9b9a004c95ba6f59c9d3261bd0e4fd54fe1bd47a0a54152. The current owner tab was read only and left intact. No form submission, source save, provider turn or runtime mutation occurred.
- Production seal reverified at product a489ced:765 inputs/491 outputs. No apps/packages source diff, no rebuild/restart, and no new broad suite/type/independent verdict claimed. Existing five renderer warnings remain in probe logs. Earlier pixel/layout PASS and ET-V01 repair retain their exact scope; they are not semantic completeness approval.

Next allowed action is owner review of this diagnostic and the concrete correction scope. Implementation, independent verification, overall Cycle1.4 acceptance, main merge, release/deployment and Stage9 closure remain pending. This report does not authorize itself.
