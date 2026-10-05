# Product and architecture contract

Date: 5 October 2026
Status: U0 contract candidate — authored, not frozen in the repository.
Canonical authority and state: [STATE](STATE.md), [HANDOFF](HANDOFF.md), [decisions](DECISIONS-AND-EVIDENCE.md).

## 1. Delivery outcome

A founder describes an application. An agent authors actual application UI and product contracts. The founder can use a reference workspace to inspect and edit that UI and try realistic product journeys through simulated implementations. Compatible implementations can become durable behind the same UI bindings.

The mature editor belongs to the existing VICT Studio. This foundation work delivers reusable capabilities and proof consumers, with an integration handoff to its separate owner. A bounded reference editor is required evidence; it is not another production Studio.

The designer should have broad browser layout and styling freedom. Prepared tables/forms/cards are accelerators. Their catalog does not define the persisted model's expressive ceiling. Model, renderer and editor coverage are separately declared; unsupported features produce explicit diagnostics.

## 2. Deliverables and ownership

| Deliverable | Owner and evidence |
| --- | --- |
| Canonical UI authoring document and edit protocol | Foundation; schema, identity, validation and agent round-trip proof |
| Neutral compilation and Svelte application rendering | Foundation; one renderer for preview and normal app, source mapping and build proof |
| Reusable authoring modules | Foundation; canvas selection, layers, inspector, responsive controls, history and document-session interface |
| Product-preview orchestration | Foundation; scenarios consume existing VICT doubles and application-data adapters |
| Reference consumers | Foundation; inspection app, contrasting page and Studio-style composition |
| Consumer artifacts and handoff | Foundation; install built exports in an independent consumer, mount editor modules and document integration |
| Complete VICT Studio | Separate Studio agent; shell, navigation, operator/workflow experience, live target/session boundary and eventual module integration |

This division is about source ownership and delivery, not a permanent split into two products.

## 3. Architectural invariants

A-01. Studio and agents edit the same canonical authored source. There is no shadow canvas document, generated Svelte frontend or hidden agent-only patch layer.

A-02. Each fact has one authority: product definitions own resources/views/actions/capabilities/routes/workflow semantics; UI documents own visual composition and presentation behavior; scenario configuration owns simulated seeds and outcomes.

A-03. UI document references are an explicit part of canonical Application Definition compilation and application identity. A UI-only edit must change the appropriate application version and therefore invalidate an old release binding. A file kept outside identity calculation does not satisfy this invariant.

A-04. Preview and the normal application use the same compiled rendering artifact and renderer. Canvas tools and simulator infrastructure are excluded from the normal application build.

A-05. Data queries and mutations use ApplicationDataAdapter with its authorization/effect context. Capability actions use declared VICT execution contracts. No second resource store vocabulary, action engine or approval authority is created.

A-06. Preview sessions cannot fall back to real effectful handlers when doubles or fixtures are missing. Scenario coverage is truthful per operation.

A-07. Source identities survive compilation, components and repeats. Selection knows definition node, instance path and record key; generated DOM positions are not source identities.

A-08. Specialist components expose typed props, slots, events, data requirements, renderer/editor metadata and inspection limits. Declared interfaces do not imply that opaque internal graphics or code are visually understood.

A-09. Framework-neutral packages do not depend on Svelte, DOM, the runtime or the application compiler. Semantic catalogs enter neutral compilation through explicit data contracts; the existing SDK/application dependency direction must remain acyclic.

A-10. UI freedom is evaluated alongside accessibility, keyboard/focus behavior and responsive usability. These are product qualities, not optional effects added after screenshots.

## 4. Source and execution boundaries

The project has a canonical application definition plus explicitly referenced UI documents and their component/style/asset dependencies. Compilation jointly validates product references and UI source. It emits an application plan with resolved presentation artifacts and occurrence-aware source mappings.

The proposed application schema amendment is described in [CONTRACTS](CONTRACTS.md). Existing @1/@2 identities cannot be silently reinterpreted. The exact new schema and identity markers are frozen in U0 after local inventory; the default proposal is a versioned @3 application definition/identity with document references and hashes.

| Area | Authoritative facts |
| --- | --- |
| Application definition | Product identity/revision, routes, screen identity, views, actions and declared resources/components |
| UI documents | Nodes, component definitions, tokens, conditions, styles, local presentation state, bindings and interactions |
| Application compilation | Joint reference checks, reachable source closure, identity and plan |
| UI compilation | Neutral rendering instructions/CSS, retained dynamic bindings and source maps |
| Runtime/data adapters | Authorization, real or simulated dispatch, domain updates and capability compatibility |
| Authoring session | Document revision, edit history, dirty/save status and source-linked diagnostics |
| Editor shell | Ephemeral selection, zoom, tool state and proof-workspace composition |
| Scenario configuration | Seeds, actor grants, operation implementations/outcomes and reset boundary |

A persisted UI document may be a separate file for good authoring ergonomics. It remains a referenced authored artifact inside canonical application source and identity. Separating files is not permission to create competing product truth.

Compiled plans are disposable. Dynamic repeats/conditions/bindings remain runtime instructions; compilation does not freeze live data into a static DOM.

## 5. Module and path plan

Prefer the existing boundaries for their appropriate responsibilities:

| Proposed area | Responsibility |
| --- | --- |
| packages/ui | Neutral document/style/expression/edit/source-map/plan types, validation and compiler |
| packages/ui-svelte | General document renderer, accessible components and their declared extension metadata |
| packages/sdk | Versioned application authoring reference shape, preserving neutral dependencies |
| packages/application | Joint compilation, application identity and release checks |
| Isolated authoring module(s), names fixed in U0 | Editor-session interfaces, canvas/layers/inspector/history UI |
| Isolated preview module(s), names fixed in U0 | Scenario orchestration around existing capability/data boundaries |
| examples/ui-authoring-proof (proposed) | Native reference host and fictional inspection consumer |
| examples/ui-design-proof (proposed) | Contrasting page and Studio-style composition |
| scripts/verification and tests | Exact consumer, identity, behavior, negative and visual evidence |

These are planned implementation areas, not authority to edit them during the documentation-only U0 handoff. U0 records exact module directories and public exports, dependency graph, packaging and targeted checks. Use public exports and built artifacts; source aliases do not count as reuse.

Do not alter apps/studio in this workstream. Do not migrate existing consumers, edit Quellight/trading/Cognee or restore the retired renderer-svelte facade.

## 6. Three proof experiences

### Inspection product

Fictional roles: technician and supervisor. Inspection lifecycle: draft → submitted → approved or rejected; a rejected inspection may be revised back to draft by its assigned technician (record-level decision fields cleared, reason preserved in the activity trail) and resubmitted. Rejection records a reason and returns the inspection for correction. Findings and evidence are reviewed side by side.

The pilot must support queue/detail/decision journeys, a reusable finding card, an evidence viewer extension, and activity/status updates. Product decisions are real state transitions in the preview adapter, not optimistic decorative badges.

Scenarios: normal submitted inspection; empty queue; long content/many findings; latency; operation failure; missing implementation; insufficient permissions; conflicting/stale decision. Each resets reproducibly. Real-world inspection safety or client operational data is outside the fictional proof.

### Contrasting page

A service/editorial page with hero, overlapping card, CSS grid, sticky section, reusable cards, responsive typography and an accessible form. It uses the general document, not a newly hard-coded marketing surface.

### Studio-style workbench

Navigation, central preview/graph-shaped fixture, adjustable inspector, and activity area. It proves density, hierarchy, panel sizing, scrolling, long labels, keyboard access and small-screen adaptation. Fixture nodes do not imply a visual workflow engine or live operator controls.

## 7. Visual quality and speed

Agree a clear visual direction in U0: restrained tokens, deliberate hierarchy, coherent spacing and typography, meaningful empty/error/loading states, and inspector controls that expose authored values and effective conditions. Reference consumers must be visually inspected in desktop and mobile browser screenshots.

Measure unfamiliar-brief agent creation, including validation/repairs/manual intervention. Record actual time. Do not claim “complex apps in minutes” or backend fidelity before evidence.

Performance target details and the representative document are in STAGES-AND-VERIFICATION. They apply to a named U0 environment and must be measured in implementation gates.

## 8. Deferred work

Complete Studio integration, live operator backend changes, a full workflow graph editor, arbitrary Svelte import, native renderers, full docking engine, animation timeline, real-time collaboration, new embedded coding-agent infrastructure, cloud deployment, npm publication and existing-app migration are deferred.

The model supports extension and versioning. It does not promise every future web feature can be represented without any schema change, nor that specialist internals become visually editable.

## 9. Studio handoff boundary

U4 provides public module APIs, a small native host example, dependency/identity rules, source-map and command contracts, theme/token integration, bundle separation, coverage and limitations, reproducible evidence, and remaining integration decisions.

The Studio agent can integrate those artifacts into the same existing application. Passing the proof host does not constitute completion of its final UX or live operator verification.
