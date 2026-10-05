# U0 proof design — fictional domain, journeys, visual and performance acceptance

Status: U0 contract candidate artifact. Design only — nothing here is implemented or measured
yet. Product semantics follow [PRODUCT-ARCHITECTURE](PRODUCT-ARCHITECTURE.md) §6–§7; execution
boundaries follow [RECONCILIATION](RECONCILIATION.md) §4 and [API-SPEC](API-SPEC.md) §6.

## 1. Fictional inspection domain (contracts and permissions)

A self-contained fictional domain for all proof experiences. It reuses the existing VICT
resource/action/capability vocabulary — no new domain engine is created.

### 1.1 Resources (declared per existing `ResourceDefinition` rules)

| Resource | Fields (type) | Notes |
| --- | --- | --- |
| `inspection` | `id`, `title` (string), `status` (string: `draft`/`submitted`/`approved`/`rejected`), `technician` (string actor), `supervisor` (string actor), `submittedAt` (date?), `decidedAt` (date?), `rejectionReason` (string?), `domainRevision` (number) | `domainRevision` supports optimistic concurrency on decisions |
| `finding` | `id`, `inspectionId`, `severity` (string: `low`/`medium`/`high`), `description` (string) | child records; many per inspection |
| `evidence` | `id`, `inspectionId`, `label` (string), `kind` (string: `note`/`image-ref`), `ref` (string?) | reviewed side by side with findings |
| `activity` | `id`, `inspectionId`, `at` (date), `actor` (string), `entry` (string) | append-only trail rendered as status updates |

### 1.2 Actions (declared capabilities/mutations; effect classes per system-reference §11)

| Action | Actor permission | Transition / effect |
| --- | --- | --- |
| `inspection.submit` | `qlt.inspection.submit` (technician) | `draft → submitted`; sets `submittedAt`; activity entry; write |
| `inspection.approve` | `qlt.inspection.approve` (supervisor) | `submitted → approved`; sets `decidedAt`; requires `expectedDomainRevision`; activity entry; write |
| `inspection.reject` | `qlt.inspection.reject` (supervisor) | `submitted → rejected` + mandatory `rejectionReason`; requires `expectedDomainRevision`; activity entry; write |
| `finding.add` | `qlt.inspection.edit` (technician) | append finding to a draft/submitted inspection; write |
| `evidence.add` | `qlt.inspection.edit` (technician) | append evidence; write |

Domain rules proven at runtime in U3 (U3-03): actor permissions enforced by the adapter/dispatch
context (never by UI visibility); `approve`/`reject` validate `status === 'submitted'` and
`expectedDomainRevision`; stale or replayed decisions produce `DOMAIN_CONFLICT` /
`DATA_IDEMPOTENT_REPLAY` and leave state unchanged.

## 2. Scenario matrix (all eight PRODUCT-ARCHITECTURE §6 scenarios)

Coverage is declared per operation (`vict.ui-scenario@1`); every scenario resets
reproducibly into a fresh session.

| # | Scenario | Seed state | Key operations (implementation) | Expected observable |
| --- | --- | --- | --- | --- |
| 1 | normal submitted inspection | 3 submitted inspections, findings + evidence | approve (simulated) | status → approved; queue/detail/activity refresh; deterministic |
| 2 | empty queue | zero inspections | list (simulated) | explicit empty state; no error |
| 3 | long content / many findings | 1 inspection, 40 findings, long unbroken strings | list + get (simulated) | readable wrapping/scroll; no clipped controls |
| 4 | latency | normal seed | approve (simulated, configured 800 ms delay) | pending state; duplicate-submit prevented; late result fenced after reset |
| 5 | operation failure | normal seed | approve (simulated, declares failure outcome) | settled failure; domain state unchanged; actionable error |
| 6 | missing implementation | normal seed | approve (`unavailable`) | `SCENARIO_COVERAGE_MISSING` denial; no real-handler effect; explicit UI state |
| 7 | insufficient permissions | technician actor on decision | approve (simulated) | `OPERATION_DENIED`; state unchanged; denial UI state |
| 8 | conflicting / stale decision | normal seed | approve with stale `expectedDomainRevision` | `DOMAIN_CONFLICT`; state unchanged; recovery guidance |

Durable replacement proof (U3-05) uses scenario 1's approve operation: identical action ID and
input/output contracts, unchanged UI source/binding digests, only the registered implementation
and data adapter swap to a deliberately selected durable local session; the proof survives a
service restart and passes the shared adapter conformance suite.

## 3. Proof walkthrough designs

### 3.1 Inspection product (`examples/ui-authoring-proof`, native host)

- Screens: queue (list of submitted inspections), detail (findings + evidence side by side,
  decision controls), activity/status rail. A reusable finding card component; an evidence
  viewer extension (declared inspection limits: image-refs render as labeled placeholders in
  U1–U3 unless the extension renders them).
- Journey: open queue → select inspection → review findings/evidence → decide (approve or
  reject with reason) → observe status/queue/activity updates; rejection returns the
  inspection for correction (technician edits and resubmits).
- Authoring demonstration (U1+): the detail screen is authored as a `vict.ui-document@1`
  document; selecting/editing it (insert, move, style, bind, connect) exercises the editor
  modules against the same document the preview renders.

### 3.2 Contrasting page (`examples/ui-design-proof`)

A service/editorial page authored with the same general document: hero, overlapping card, CSS
grid region, sticky section, reusable cards, responsive typography, accessible form (label
association, keyboard submission, error association). Proves the document model is not a
dashboard-only vocabulary.

### 3.3 Studio-style workbench (`examples/ui-design-proof`)

Navigation rail, central preview pane showing a graph-shaped **fixture** (not a workflow
engine), adjustable inspector, activity area. Proves density, hierarchy, panel resize,
scrolling, long labels, keyboard access and small-screen adaptation. Fixture nodes carry no
workflow semantics and no live operator controls.

## 4. Visual acceptance criteria (freeze for U1+ gates)

- Required browser sizes: 1440×900, 1024×768, 390×844, plus a narrow-container proof at
  480 CSS px container width. Real screenshots at readable scale are evidence of appearance;
  interaction and keyboard journeys require actual browser behavior.
- Reviewers check: hierarchy, alignment, typography, density, spacing, responsive structure,
  contrast, focus visibility, long/unbroken labels, empty/loading/error/denial states,
  overflow/clipping. Any clipped control, confusing interaction or inaccessible action is a
  finding.
- Visual direction (U0 decision, per PRODUCT-ARCHITECTURE §7): restrained token set (start
  from the existing closed `THEME_TOKEN_NAMES` vocabulary), deliberate hierarchy, coherent
  spacing/typography, meaningful empty/error/loading states, inspector controls that expose
  authored values and effective conditions. No decorative optimistic badges: product status is
  real adapter state.
- Independent evaluators record their own findings; owner product judgment happens at runnable
  checkpoints and is never inferred from silence.

## 5. Performance environment and budgets (named, to measure in implementation gates)

Named U0 environment (recorded 2026-10-06; measurements happen in U1+ against the environment
named at measurement time):

| Item | Value |
| --- | --- |
| Machine | Lenovo (model 81N4), Windows 11 Home, build 26200, 12,102 MB RAM |
| Node / npm | v22.13.1 / 11.19.1 |
| Browsers available | Chrome 154.0.8037.92 (installed executable version; a newer staged Chrome 155.0.8059.26 package exists on disk but is not the installed binary); Edge 154.0.4258.53 (installed executable version; no staged 155 Edge package) |
| Notes | Cold vs warm distinguished; ≥30 measured iterations after warm-up; method preserved with results |

Workload (STAGES §8): 1,000 authored nodes including reusable definitions; 100 visible repeated
finding occurrences; one inspector selection; 20 consecutive source transactions; a
representative scenario reset.

Provisional targets (freeze before U1; amending later requires named baseline evidence plus a
recorded rationale — never weakened to make a failing implementation pass):

- p95 visible feedback after a local editing command ≤ 100 ms.
- p95 full compile of the representative document ≤ 250 ms.
- p95 local scenario reset to settled seeded UI ≤ 1 s (excluding intentionally configured
  simulated latency).
- No authoring/simulator module in the normal application entry graph; report measured bytes
  and package versions.

## 6. Agent-speed measurement design (U4-04 rehearsal)

An unfamiliar-brief agent creates a bounded UI (declared in the brief) from the frozen
contracts. Record: actual elapsed time, validation/repair cycles, manual interventions. No
"complex apps in minutes" or backend-fidelity claims before evidence exists.

## 7. Independent-consumer mounting design (U4-02 rehearsal)

A clean consumer (no repo source aliases) installs built package outputs, renders a document
through the public renderer API, mounts the editor modules through their public session API,
loads one declared extension, and runs one declared preview interaction. The mounting example
shape is fixed now so U1+ builds toward it: consumer code touches only `packages/*` public
entries (`@victframework/ui`, `@victframework/ui-svelte`, `@victframework/ui-editor`,
`@victframework/ui-preview`, `@victframework/application`) and never workspace source paths.
