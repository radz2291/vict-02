# Stages and verification

Status: U0 contract candidate. Scope/authority: [HANDOFF](HANDOFF.md), [STATE](STATE.md).
U0 is the first executable handoff. U1–U4 are a delivery roadmap, not an unattended continuation grant.

## 1. Shared operating cycle

One stage manager reconstructs state, maps criteria, coordinates non-overlapping work if useful, integrates a candidate, obtains fresh independent challenge, repairs in-scope failures, and obtains affected re-verification. It remains responsible through the final stage verdict and owner report.

For an implementation gate, the verifier works on an exact git candidate SHA, preferably in a separate checkout/session. It does not edit the candidate. For this externally authored pack, a SHA-256 file snapshot can identify the documentation review; that review does not substitute for repository freeze or implementation evidence.

Candidate failures are repaired without asking the owner to relay iterations. Stop only for missing authority, a material product/contract fork, unavailable external right/capability, a required non-remediable failure or the stage boundary. Retain red evidence and exact candidate/fix/verifier lineage.

Verdicts: PASS; PASS WITH NON-BLOCKING FINDINGS; HELD; FAIL; BLOCKED. Required criteria are PASS, FAIL or NOT DEMONSTRATED individually. Missing proof cannot be promoted to pass. Non-blocking findings have an owner, bounded consequence and next check.

A passing stage permits dependent work only when that work is also authorized. Do not infer publication, mainline integration or Stage 9 changes from a stage pass.

## 2. U0 — locally established and frozen foundation contract

Outcome: an implementer can build U1 without making new product/authority decisions or inventing source ownership. No production implementation is part of U0.

Scope: install/reconcile this pack, inventory existing contracts, finalize versioned schemas/API drafts and source fixtures, fix module/dependency/public-export boundaries, define proof journeys/budgets, independently review and freeze the final contract. Documentation and design fixtures only.

| Criterion | Required evidence |
| --- | --- |
| U0-01 Baseline | Exact repository/remote/default and work branch, clean/isolation evidence, live main SHA, root instructions and concurrent work classification |
| U0-02 Ownership | Same Studio product; reusable/reference versus complete-app ownership; apps/studio and other tracks excluded |
| U0-03 Canonical source | Versioned application/document attachment, source closure/digest/applicationVersion/release behavior and APP-019 disposition explicitly specified |
| U0-04 Contracts | Document/style/condition/component/expression/interaction/edit/source-map/scenario schemas or precise drafts, public APIs, valid/invalid fixtures and diagnostics |
| U0-05 Execution | Existing capability doubles and data adapter boundaries; missing-double fail-closed behavior; reset/in-flight fencing; durable replacement design |
| U0-06 Module/reuse plan | Exact proposed directories/exports/dependency graph, built-consumer proof, editor/preview application-bundle exclusion |
| U0-07 Product/evaluation | Fictional domain contracts/scenarios, inspection/page/workspace walkthroughs, visual criteria, named environment and performance budgets |
| U0-08 Independent freeze | Fresh contract reviewer challenges exact contract candidate; repairs/re-review; content pins plus a separate independent freeze-byte verification; recorded candidate/reviewer SHAs and final verdict |

U0 does not require passing future runtime tests. Its fixtures are contract examples, not fabricated compile/execution proof. Existing source inspection and limited baseline checks support feasibility; no production spikes or shell application are secretly included.

Freeze the product/architecture, contracts, stages, handoff and accepted decision payloads. Exclude mutable STATE and later evidence from immutable contract hashing. Record exact UTF-8/LF bytes, SHA-256 digests and the contract candidate git SHA in a separate freeze record. A record cannot hash its own final bytes into itself; pin the contract commit, then commit the record as a subsequent evidence commit. A fresh verifier reproduces pins and distinguishes contract and record SHAs.

Demo: a new agent can read the handoff and describe the U1 slice, file ownership, expected behavior and required negatives with no missing authority decision.

Stop: after verified U0 freeze, branch push, remote verification and report. Do not start U1.

## 3. U1 — first actual rendering, editing and product loop

Prerequisite: accepted/frozen U0 and an authorized U1 handoff.
Outcome: agent-authored inspection-detail UI can be selected, edited, saved, reopened and used against a simulated approval operation.

Minimum modeled/editor slice: element/text/component, simple repeat, literals/typed references, basic interaction, local state, flex/grid essentials, token/local style and a viewport condition. Other contract rows remain explicitly pending.

| Criterion | Required evidence |
| --- | --- |
| U1-01 Canonical source and identity | New opted-in application source resolves a UI document; changed UI content changes applicationVersion; dangling reference and explicit-catalog/pinned revision collision rejected; old release binding rejected; catalog input permutation and duplicate identical entries leave applicationVersion unchanged (A-03) |
| U1-02 One renderer | The same source/compiled artifact renders in the reference host and a normal app; no separate handwritten proof frontend |
| U1-03 Source-aware editing | Click selects source occurrence; insert/move/style/bind/connect work through exported transactional commands; invalid/stale multi-command transaction has no partial effect |
| U1-04 Round trip | Undo/redo, expected-revision save, process/reload reopen preserve IDs/layout/bindings; stale save rejected |
| U1-05 Product path | Declared decision action uses the actual adapter/double dispatch path; success updates status/activity and dependent views; failure and denial leave data unchanged |
| U1-06 Preview boundary | Missing required double denies with no real-handler effect; reset during latency fences old results |
| U1-07 Native and accessible | Reference host consumes VICT application/runtime/component boundaries; keyboard and form/overlay focus behaviors demonstrated |
| U1-08 Runnable quality | Desktop/mobile review, no unexplained console errors, supported-coverage matrix and measured editing/compile feedback |

The first owner checkpoint is this runnable loop. Verification evidence reports what the owner can try and what is still unsupported.

## 4. U2 — designer and workbench breadth

Prerequisite: U1 pass and authorized U2 handoff.
Outcome: reusable component/slot/variant editing, broad presentation conditions and the two contrasting visual proofs are usable.

| Criterion | Required evidence |
| --- | --- |
| U2-01 Components | Shared definition edits affect instances; intentional instance overrides persist; required slots/type errors diagnosed |
| U2-02 Occurrence provenance | Repeated component selection maps to definition/instance/record; duplicate keys rejected; portal logical ownership preserved |
| U2-03 General presentation | Grid, overlap, sticky/overflow, tokens, pseudo states and custom viewport/environment/container conditions where declared supported; advanced declaration control uses the same model |
| U2-04 Inspector clarity | Authored/effective/inherited/token/condition origin is explained; changing a breakpoint does not silently change base source |
| U2-05 Contrasting page | Required service/editorial page looks coherent and behaves responsively with an accessible form |
| U2-06 Studio-style composition | Navigation/central workspace/inspector/activity adapt and resize; long labels/scrolling/keyboard access remain usable |
| U2-07 Reusable tooling | Canvas/layers/inspector/history live in exported modules, not proof-host-only handlers |
| U2-08 Performance/coverage | Declared representative workload measured; precise model/render/editor coverage and unsupported diagnostics |

Do not mistake a graph-shaped fixture for workflow editing or a two-pane proof for a full docking engine.

## 5. U3 — product realism and durable replacement

Prerequisite: U2 pass and authorized U3 handoff.
Outcome: the complete fictional inspection journey and negative scenarios work; one simulated decision becomes durable without UI source/binding edits.

| Criterion | Required evidence |
| --- | --- |
| U3-01 Journey | Queue → evidence/findings → decision → status/activity/queue refresh |
| U3-02 Scenarios | Normal/empty/long/latency/failure/denied/conflict/missing operation reproducibly reset |
| U3-03 Domain correctness | Actor permissions, validation, domain revision and stale decision checked at runtime; no UI-only authorization |
| U3-04 Scenario identity | Cache/local-state/domain-seed reset coherent; capability snapshots and in-flight operations fenced |
| U3-05 Durable replacement | Same action ID and compatible input/output contracts; UI source and binding digests unchanged; durable local operation runs through declared boundary and survives restart |
| U3-06 Conformance | Simulated/local adapter implementations pass relevant shared conformance; side effects and failure behavior observable |
| U3-07 Honest coverage | Implementation mode is truthful per operation; no global “production” label hides missing behavior |
| U3-08 Experience | Owner can explain workflow from actual UI; negative-state UX remains coherent |

The durable local proof demonstrates a specific compatible replacement, not full backend feasibility or production readiness.

## 6. U4 — built-artifact reuse and Studio-agent handoff

Prerequisite: U3 pass and authorized U4 handoff.
Outcome: independently installed exports support another native consumer and provide a concrete integration route for the existing Studio.

| Criterion | Required evidence |
| --- | --- |
| U4-01 Packaging | Built artifact contents and public exports recorded; no original app-source imports or repo source aliases |
| U4-02 Independent consumer | Separate clean consumer renders source, runs a declared preview interaction, mounts reusable editor modules and loads an extension |
| U4-03 Build parity | Production application render behavior agrees with preview; editor/simulator infrastructure absent from normal application bundle |
| U4-04 Agent speed | Unfamiliar bounded brief completed with elapsed time, validation/repair/manual intervention recorded |
| U4-05 Complete walkthrough | Final inspection/page/workspace use and required negatives independently demonstrated |
| U4-06 Handoff | APIs, mounting example, identity/dispatch/theme contracts, limitations, exact artifacts and retained integration findings delivered |
| U4-07 Final gate | Fresh independent review of exact final candidate; affected post-review changes rechecked; truthful final state |

No npm publication, merge to main, existing Studio integration or production activation is implied by U4 closure.

## 7. Visual evaluation

Required browser sizes: 1440×900, 1024×768 and 390×844; add a narrow-container proof at 480 CSS px. Inspect real screenshots at readable scale.

Review hierarchy, alignment, typography, density, spacing, responsive structure, contrast, focus, long/unbroken labels, empty/loading/error/denial states and overflow. A reviewer must identify any clipped control, confusing interaction or inaccessible action. A screenshot can evidence appearance; interaction and keyboard journeys require actual browser behavior.

The reference workbench must feel like an intentional professional tool. The owner supplies product judgment at runnable checkpoints; independent evaluators record their own findings and never claim owner approval from absence of feedback.

## 8. Performance and bundle targets

U0 records the local machine/browser/version and distinguishes cold/warm measurements. Workload: 1,000 authored nodes including reusable definitions; 100 visible repeated finding occurrences; one inspector selection; 20 consecutive source transactions; a representative scenario reset.

Provisional targets to freeze before U1:
- p95 visible feedback after a local editing command: ≤100 ms.
- p95 full compile for that authored document: ≤250 ms.
- p95 local scenario reset to settled seeded UI: ≤1 second, excluding intentionally configured simulated latency.
- No authoring/simulator module dependency in the normal application entry graph; report measured bytes and package versions rather than claiming universal bundle size.

Use at least 30 measured iterations after warm-up, and preserve measurement method. U0 may amend a target on named baseline evidence and a recorded rationale before implementation. Do not weaken a frozen target merely to make a failing implementation pass.

## 9. Verification selection and evidence

U0: source/API/identity consistency, link/schema-fixture review, allowed-path diff and freeze pins.
U1+: targeted semantic/unit/adapter/browser/identity/negative checks plus builds/type checks affected by the change. Broaden only when changed shared behavior, failure or unresolved concern warrants it. Avoid implementation-mirroring tests for cosmetic tweaks.

Baseline scripts include npm run typecheck, npm run check:ui and relevant workspace tests/builds. The stage manager inspects actual current scripts before choosing commands. Do not report a script as run merely because it exists in package.json.

Each report records repository/branch/base/candidate full SHA, environment, criterion statuses, reproduction commands and inputs, screenshots/API evidence, negative controls, findings/severity/user effect/owner/next check, and independent verdict. Push only within the accepted handoff, verify the remote full SHA, and report exact lineage.
