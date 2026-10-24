# Cycle 1.4 — coherent UI and integrated Studio experience

2026-10-24. **Required roadmap work before Milestone 2; prepared scope, not implementation authority in the current core round.** The owner requires completion after the Cycle 1.3 core and supported authoring foundation, followed by integrated verification and Milestone 1 owner acceptance. These requirements are not an indefinite backlog.

## Entry gate and preservation

Start only from the exact independently verified core delivery recorded in [the core round](CYCLE-1-3-CORE-AUTHORING.md), after reconciling live remote, concurrent work, allowed paths and owner authority. Do not substitute stale `be893f` for the restored Structure product `a36793df` or erase failed attempts. Current core entry is delivery `f95e2cbe80f7afd421f8224634ebc0cecd61c827`; no later product PASS exists yet.

Keep Structure inside Document, the canvas mounted and floating Format/Insert/Arrange/Connect controls on canvas. Preserve old documents, canonical identity, exact component revisions, history, drafts, runtime values, explicit Save/reopen and existing provider/effect boundaries. Preserve owner tabs and data; use isolated previews after listener/headroom inspection.

## 1. General UI standardization

The current AI family derives from shadcn-svelte **rhea**, pinned at `b10f153250b18abfccf49a06e1c4c68945edffa5`. The general VICT catalog has its own Bits-based presentation. This is **not full shadcn-svelte adoption**. Specialist Flow remains based on its separately pinned upstream. Existing AI source provenance is in `packages/ui-ai-svelte/upstream-manifest.json`; general coverage in `packages/ui-svelte/FOUNDATION-CATALOG.md`; Flow provenance in `packages/ui-flow-svelte/UPSTREAM.md`.

Read-only audit of the pinned rhea `index.json` found 268 registry entries: 63 UI families, 148 blocks, 52 fonts, two hooks and three libraries. Blocks/fonts are not 200 additional supported component contracts. [Pinned index](https://github.com/huntabyte/shadcn-svelte/blob/b10f153250b18abfccf49a06e1c4c68945edffa5/docs/static/registry/styles/rhea/index.json). The machine-readable comparison accompanies this handoff; it is an inventory, not a visual-fidelity or behavior verdict.

Implementation plan:

1. Reconcile every pinned UI family with general VICT, AI and specialist registrations. Record exact counterpart, differences, authoring eligibility, required host support, missing adapter and explicit exclusion. Distinguish native elements from reusable styled families; exported parts from complete authored support; blocks from components.
2. Establish one deliberate token/theme/control language for Studio and the general catalog: typography, density, action sizing, focus, spacing, surfaces, overlays, labels and state feedback. Use owner preferences, including compact but comfortable geometry and one clear command home. Audit whole-shell CSS, portals and specialist containers; isolated component styling is insufficient.
3. Migrate presentation through existing public components and Component ABI adapters. Preserve existing IDs/revisions/default semantics where only presentation changes compatibly. Meaning/default/required-slot changes require new revisions with old support retained or an explicit source migration. Never relabel a breaking change as a theme update.
4. Pin source files/dependency closure/licenses and record local adaptations, rather than taking mutable latest. Avoid a second incompatible Bits version, broad preflight resets and private upstream imports. Fonts and demo blocks need separate product decisions; importing the whole registry is not the objective.
5. Add missing broadly useful families only with complete renderer/editor/agent contracts, actual interaction proof and support dispositions. Host-dependent form, chart, toast, sidebar, upload or authentication examples must not imply backend, provider, filesystem or authorization capability.
6. Update the shared showcase with every changed surface/state, linked to its exact contract and evidence. Verify a packed consumer, production CSS, representative keyboard/portal/long-content/mobile states and legacy documents.

Explicit exceptions must name their reason and scope: Flow's specialist graph geometry/controls; VICT-specific operator/history/receipt status; native semantic elements; date/time serialization and controlled ABI; host-dependent patterns; unsupported helpers/adapters. An exception is not permission for arbitrary visual divergence.

## 2. Contextual right-click menus

Reimplement from the corrected scope, **not by restoring the rejected commit**. Retain CI-01/CI-02 from [the rejected attempt](CYCLE-1-3-CONTEXT-INSPECTOR-INDEPENDENT.md) as required regression cases.

| Context | Commands and behavior |
| --- | --- |
| Authored object | Commands from the existing Object home, enabled by exact source/occurrence capability: inspect, locate, duplicate/delete and supported arrangement/containment actions. Secondary selection targets that object before invocation without opening unrelated floating controls. Never imply workflow execution. |
| Empty Design canvas | Existing canvas/view commands such as fit/zoom and applicable insertion choices. No object command acts on an old selection by accident. |
| Structure source node | Only supported source actions for that node; references/ambiguous repeated occurrences remain inspect-only where required. |
| Native text/input editing and Interact | Preserve native context menus and application behavior; do not intercept editing selection, browser menus or the authored page's runtime interaction. |

Provide Shift+F10/context-menu key for focused targets, correct focus return, Escape/outside dismissal and bounded viewport positioning. Test the **actual pointerdown/up/contextmenu sequence**, first secondary click on a different target, keyboard invocation and disabled/refused commands. Context-menu trigger styling must not collapse the graph or change canvas layout. Pending drafts and canonical validation remain in force; contextual access does not create another command implementation.

## 3. Shared inspection details beneath Layers and Structure

The panel contains existing source facts/properties, identities and relationships, available from both navigation surfaces. **It does not relocate or suppress floating canvas editing tools.** Selection may update details without automatic camera/scroll/composition changes. Provide an explicit editing handoff where relevant.

Keep Layers/graph and canvas useful above/beside details. Define minimum usable geometry, scrolling, disclosure/close, focus return and small-window behavior before implementation. Evaluate remembered session height, resize and explicit temporary expansion against owner preferences; these were prior assistant suggestions, not an already accepted detailed docking specification. Preserve selection, graph camera/search, runtime values and drafts across Layers/Structure and close/reopen. Covered content must be inert only when actually covered; avoid hidden keyboard targets.

## 4. Integrated verification and Milestone 1 owner review

Fresh-context independent verification must cover exact committed candidate and production build, with failures preserved and bounded repairs/rechecks. Include:

- Founder opens/saves a realistic source, inspects Layers/Structure/details, edits with existing floating tools, uses contextual commands and returns to the same canvas/graph/runtime context.
- Agent discovers selected contracts, authors form/dashboard/content-editor and eligible AI/Flow compositions, reports actual source/visual evidence, recovers from invalid input or observation failure and continues after a mixed manual change.
- Real keyboard/pointer behavior, responsive/zoom/long content, overlays, Stop, stale/draft protection, Undo/Redo and explicit Save/reopen.
- Every newly changed UI appears in the showcase with simulations labelled; independently installed public packages work without Studio aliases.
- Honest finding dispositions and missing demonstrations, owner walkthrough and exact source/product/verifier/evidence SHAs, remote equality and launch instructions.
- Compare measured form/dashboard/editor turns at the same model, starting source and contract-cache state. Report initial discovery versus source reads, edits and observation separately, including call counts, first confirmed edit, wall time, cumulative reported usage and avoidable repeated reads. Where a selected dependency closure fits the bounds, target one compact overview plus one selected bundle (and a selective refresh if needed); this is a two-to-three **knowledge-read** aim, never a two-to-three-total-call promise. Bounded body pages and source freshness still count as real calls. Retain the core round's expensive actual runs as comparison evidence and agree realistic acceptance budgets at the integrated gate.
- Check authored style precedence and actual container width before reporting responsive values or output quality. A valid conditional rule or successful image call does not prove its computed value, pointer usability or professional-design quality. Retain the core dashboard's necessary corrective continuations and writing-desk source-versus-computed padding discrepancy as regression journeys.

Technical PASS is readiness for owner review, not owner acceptance. **Milestone 2 application-building starts only after required 1.4 work, integrated Milestone 1 verification and owner acceptance.** Multi-page application assembly and separately governed runtime interaction-testing tools remain explicit future contract questions, not capabilities inferred from this handoff. No main merge/publication/deployment/Stage 9 closure follows automatically.
