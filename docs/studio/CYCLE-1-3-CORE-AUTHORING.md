# Cycle 1.3 — reliable component authoring foundation

2026-10-24. **AUTHORIZED; architecture candidate, independent challenge pending.**
The owner's new stage-manager brief supersedes report-only restrictions for core reliability, scalable component knowledge and supported authoring access. It does not authorize the reverted interaction work or Milestone 2. This document records scope before implementation; it is not a gate verdict or owner acceptance.

## Recovered baseline and preservation

- Repository: https://github.com/radz2291/vict-02; origin verified live.
- Fetched completion delivery and clean local branch: `f95e2cbe80f7afd421f8224634ebc0cecd61c827`.
- Fetched `origin/main`: `d7401bef6e48330796c74ec00c86db9622d48cdf`, ancestor of delivery, unchanged from handoff. Desktop main remains an older separate checkout and is not reset.
- Restored product source: `a36793df0f62c002332d66db181310554aaabb05`; `git diff --exit-code a36793df0f62c002332d66db181310554aaabb05 HEAD -- apps/studio packages` passed at entry. Later delivery includes documentation and history-preserving reverts, not a rollback of the full completion round.
- Isolated branch: `codex/studio-cycle-1-3-core-authoring`; new worktree `C:/Users/RZ1/.codex/worktrees/studio-cycle-1-3-core-authoring/260831-VCT-02`, based exactly on delivery. Existing completion, verifier, preview and foundation worktrees are preserved.
- C: free space at entry approximately 1.6 GB; tracked checkout approximately 105 MB. Avoid redundant dependency installs and concurrent heavy builds; check headroom before heavy work. Do not delete owner data or retained evidence.
- Preserve all existing owner tabs, unsaved work, saved documents, provider configuration and serving builds. New verification uses an unoccupied origin and disposable data after listener ownership inspection. No reload of an owner tab is implied.

## Fixed boundaries

Structure remains in Document beside Layers/Data/Actions/Source. Canvas stays mounted with floating Format/Insert/Arrange/Connect tools. Neither rejected context-menu implementation nor shared editing Inspector is reinstated. Cycle 1.4 must deliver the separately specified right-click and shared **inspection details**, and general UI standardization before Milestone 2.

Canonical `vict.ui-document@1`, Application Definition/Plan, Component ABI, compilation, source identity, transactions, browser acknowledgements, stale/draft protection, cancellation, history and explicit Save/reopen remain authoritative. No arbitrary Svelte/JavaScript imports or shadow authoring document. UI presentation never grants provider, shell, workflow, subagent or product-effect authority. Rich unsupported behavior must produce an exact contract gap rather than a hidden bypass.

Allowed paths: existing `packages/ui`, `ui-svelte`, `ui-editor`, `ui-ai-svelte`, `ui-flow-svelte`; Studio; associated tests/scripts/consumer fixtures/build configuration; scoped Studio documentation and dated current-status pointers. No Quellight, main merge, package publication, deployment, formal Stage 9 closure, Milestone 2 or self-acceptance.

## Architecture candidate

### One component contract, package-owned knowledge

Reuse `UiExtensionDescriptor` in `@victframework/ui` and the existing Svelte Component ABI. A neutral authoring companion references the exact descriptor; it adds discovery and semantic guidance, never a second props/events/slots model. Renderer packages own their descriptor, implementation and companion registration together. `ui` owns pure registration validation, deterministic knowledge digest/index/bounded selection helpers and shared declarative semantic rules. `ui-svelte` owns general catalog registrations; `ui-ai-svelte` and `ui-flow-svelte` own eligible specialist adapters and registrations. `ui-editor` owns reusable composition/transaction helpers. Studio composes explicitly installed registrations and supplies discovery/edit tools.

Descriptor-derived information: IDs/revisions, props/defaults/types, slots, outputs/payloads, ABI and renderer identity, style targets and inspection limits. Authored-once semantic information: purpose/category, correct composition/required dependencies and placement, sibling identity scope, paired-part keys, label ownership, controlled prop/output pairs, host requirements, examples and explicit exclusions. Do not infer these rules from TypeScript or guess them from export names.

The registration path is package descriptor + implementation + authoring companion → validated installed registry → renderer/editor catalogs and knowledge index → bounded agent discovery/selected contracts → canonical commands → compiler and renderer validation → browser acknowledgement. Recipes use that path as convenient prepared compositions; supported registered components are also insertable without requiring a recipe per component.

Registration/version identity is separate from document identity: knowledge digests cover exact descriptor plus guidance/dependencies/eligibility. Compact family/category/query discovery returns stable IDs, revisions and digests; bounded selected-contract reads take requested IDs and known digests and return unchanged markers or changed contracts with provenance. Do not cache source facts under knowledge digests. Dependency closure is bounded and explicit; missing/revision-incompatible dependencies fail registration. Existing descriptor IDs/revisions and saved documents remain unchanged. New adapters receive new IDs and explicit revisions. Do not silently migrate existing documents or reinterpret immutable component revisions.

Internal helpers, unsupported upstream patterns and host-only APIs have explicit dispositions; installed exports do not automatically become authorable. Tests must detect missing/duplicate registrations, descriptor drift, unsupported claims, invalid examples/placements and renderer mismatch. Maintenance demonstration adds an eligible registration and changes its contract in a controlled fixture, proving derived discovery/schema/digests update without parallel prompt/catalog edits.

### Supported authoring and specialist adapters

Audit canonical support, renderer/editor support, manual tools, agent tools and verification separately. Close existing date/time/list-state, native text-reference, heading and styling gaps through current commands and exact validation. Expose a bounded generic insertion/composition path for elements/text and registered components whose full canonical path exists, retaining explicit slots and exact typed bindings; recipes are accelerators.

AI/chat authoring adapters should cover real supported presentation compositions and typed composer/message behavior using the existing ABI, public specialist components and slots. Proposed eligible starting set: conversation (messages/composer slots), message (role/text, only declared intent outputs where implemented), prompt input (value/busy, typed valueChange/send and stop). They do not attach Studio's provider backend to authored chats.

Proposed Flow path for independent challenge: canvas with node/edge declaration components in slots; declarations carry scalar id/label/x/y/source/target and register through a package-local rendering context, which maps to public Svelte Flow arrays. Persisted truth remains those canonical component nodes, with no second stored graph or JSON-string object escape hatch. Challenge slot mounting, occurrence provenance, repeated instances, controlled updates, cleanup and Design/Interact differences before implementation. Positions authored in these new user components are their explicit presentation props, distinct from Studio Structure's ephemeral layout. Arbitrary callbacks, custom executable nodeTypes, rich object-array graph state and workflow execution remain excluded unless a full canonical path exists. Required behavior that cannot fit existing canonical types is an amendment question with an exact gap. Advertise only implemented and independently demonstrated adapters.

Existing unpinned component resolution and application identity are not changed by discovery digests. New authored component nodes pin descriptor revisions. Meaning/default changes require a new descriptor revision with old support retained; guidance-only changes update knowledge digest without pretending saved source changed. Renderer identity remains the existing explicit identity boundary, not an invented automatic code digest.

### Reliability and truthful verification

Preserve the complete stress inventory and later owner additions. Capture receipts identify capture-time phase, working revision, mode, visibility and geometry, with bounded stale/refusal evidence and observation-specific recovery. Failed observation must preserve successful edit receipts and never replay confirmed writes to retry vision. Downstream compiler diagnostics retain bounded target/path/expected/actual information when available. Shared authoring rules prevent repeated recipe identity collisions and explain labels/control ownership.

Chronological tool attempts group their own lifecycle phases, expandable receipts and failed outcomes under the actual call identity. Preserve aggregate call/retry/timing/usage metrics across bounded detail compaction; model steps and costs are unavailable unless observed from the real engine/provider. Completion and intermediate coverage remain source-grounded and distinguish requested intent, presence, behavior and actual image evidence. The in-product agent has no click/type testing capability unless separately contracted; independent real-browser testing remains required.

## Scoped acceptance criteria

| ID | Required evidence |
| --- | --- |
| CA-01 | Exact baseline/authority/isolation and fresh independent architecture challenge before substantial implementation; failures and repair lineage retained. |
| CA-02 | Package-owned shared registration, derived contracts, explicit semantic rules/dependencies/placements/exclusions and unchanged saved-source compatibility. |
| CA-03 | Large bounded family/category discovery, selected bundles, unchanged digest reuse/selective invalidation; no relaxed framework snapshot bounds. |
| CA-04 | Maintenance demonstration: eligible registration and changed-contract fixtures update derived knowledge/schema without parallel prompt edits; stale/missing/invalid/unsupported negatives fail. |
| CA-05 | Canonical/manual/agent parity for typed state, native text references, truthful headings and supported styling; same transactions and diagnostics. |
| CA-06 | Generic registered insertion/composition, repeated identities/paired parts/label ownership/controlled state; relevant browser behavior and legacy reopen. |
| CA-07 | Actual authored AI/chat and Flow discovery→insert→configure→render→interact→Undo/Redo→Save/reopen; presentation/execution separation. |
| CA-08 | Capture success and phase-specific stale/visibility recovery; actual provider invalid→corrected recovery and source-grounded continuation, no replayed acknowledged writes. |
| CA-09 | Truthful status/diagnostics/completion, chronological grouped attempts, bounded measured metrics and intermediate intent/coverage distinction. |
| CA-10 | Representative form/dashboard/content-editor real browser/provider tasks, keyboard/responsive, mixed manual/agent, Stop/draft/stale/history/persistence; missing proof explicitly identified. |
| CA-11 | Independently installed package consumer without Studio source aliases; exact candidate, affected checks/build and fresh-context independent verification/repair/reverification. |
| CA-12 | Full stress finding disposition and concrete required Cycle 1.4 scope; remote-equal delivery, product and verifier identities, launch/walkthrough and limitations. |

Stop at independently verified readiness for owner review, or a concrete documented blocker. No broad completion is established by gallery counts, simulations, earlier verdicts or a pushed builder candidate.
