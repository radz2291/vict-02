# Cycle 1.3 core authoring — independent product challenge

2026-10-24. **First candidate FAIL; verification continues.** This is an independent product review, not a builder report, owner acceptance or Stage 9 closure. Failed observations remain retained when a repaired candidate is rechecked.

## Exact candidate and isolation

Reviewed product `e7d2b51d3f22b549a0d4772ceaf8da623131da2c`, remote branch `codex/studio-cycle-1-3-core-authoring`. Live `git ls-remote` confirmed that exact candidate and unchanged main `d7401bef6e48330796c74ec00c86db9622d48cdf`. Candidate descends from delivery `f95e2cbe80f7afd421f8224634ebc0cecd61c827`, restored product source `a36793df0f62c002332d66db181310554aaabb05`, amended architecture `3f6a9182f706405679907be170ce921e8e2c21fc` and independent design evidence `18319838455fd0c71fc741a3a84c9bd3c4d57177`.

Fresh verifier context and separate checkout: `C:/Users/RZ1/.codex/worktrees/studio-cycle-1-3-core-product-verify/260831-VCT-02`; branch `codex/studio-cycle-1-3-core-product-verify`, created directly at the exact product. Entry tree was clean. This verifier makes no product repairs. Third-party dependencies are borrowed through individual junctions; `@victframework` links point to this verifier's own package directories. No install or heavy build was run. Source aliases used by the repository's test configuration exercise this candidate; these tests are not independent packed-consumer evidence.

Authority read: root AGENTS and canonical Stage 9 references, current owner brief, core architecture and independent design challenge/recheck, finding crosswalk, builder records and required 1.4 handoff. The superseding owner brief authorizes this core work and independent challenge; historical report-only/U0 restrictions do not cancel it. No owner tabs, stored sources, provider configuration or previews were changed.

## First-candidate findings

| ID | Finding and consequence | Evidence / required repair |
| --- | --- | --- |
| PV-01 | **FAIL — provider ownership differs between source and runtime admission.** `authoringSemanticIssues` counts every descendant beneath a matching context for `requiredParts` and `pairedValues`. A nested Tabs provider can supply a trigger for an outer Tabs that has none of its own. The source policy admits an incomplete outer composition; the runtime guard excludes the nested same-family provider and can refuse that accepted presentation. | `packages/ui/src/authoring-semantics.ts:100–105`; independent test creates an outer provider with an inner complete provider in its tabs slot and one outer panel. No outer `UI_AUTHORING_REQUIRED_PART` error is produced. Apply nearest compatible provider occurrence ownership consistently through wrappers/local definitions, preserving valid nested compositions. |
| PV-02 | **FAIL — malformed paired metadata is accepted as a healthy registry.** A `pairedValues` rule referring to undeclared owner slots and nonexistent child identity properties yields `ok:true`. `requiredParts` checks its owner slot but does not validate referenced child registrations. This leaves stale advertised semantic guidance outside the claimed registration checks. | `packages/ui/src/authoring.ts:110–127`; independent malformed paired-rule test fails its expected refusal. Validate referenced slots, child contracts/properties and relevant revisions/dependency relationships with bounded structured issues. |
| PV-03 | **FAIL against AC-02 warning visibility.** Studio's only consumer of `screenAuthoringIssues` filters every warning through `screenPlacementIssues`. Bridge/compile/Save/Run therefore receive no retained legacy warning, unresolved identity warning or controlled/label guidance. The amended architecture explicitly requires remaining compatibility warnings to be surfaced on Save/Run. | `apps/studio/src/lib/designer/placement.ts:5–14`; `rg` confirms no other `screenAuthoringIssues` consumer. Preserve nonblocking admission and add an honest bounded warning projection. This is source inspection, not yet a browser assertion. |
| PV-04 | **FAIL — a valid local-definition slot composition is refused at runtime.** A local component rooted in Menubar forwards its declared `menus` slot into the provider. Source admission and compilation succeed, but real DocumentHost mounts an alert, `A required rendered composition part is missing.` The runtime checker starts with empty fills and receives no nearest local-instance fill/scope; the extension's rendering callback also clears fills. | Independent actual Svelte/Happy DOM test [local-fill machine failure](cycle-1-3/core/independent/local-fill-tests.json), `packages/ui-svelte/test/core-independent.test.ts`. `RenderNode.svelte:127,363`; `authoring-runtime.ts` initial owner traversal. Preserve inherited local slot substitutions and caller scopes in both guard and rendered children; do not suppress the guard. This is DOM evidence, not a browser interaction. |

The package builder acknowledged PV-01/PV-02 and is preparing separate repairs; that acknowledgement does not change this candidate's result. No failure was silently repaired in the verifier checkout.

## Independently rerun checks

| Scope | Result | Evidence |
| --- | --- | --- |
| Neutral authoring, editor registered authoring and independent adversarial tests | **19 PASS / 2 FAIL / 21 total** | [machine report](cycle-1-3/core/independent/source-tests.json). Command: `node node_modules/vitest/vitest.mjs run packages/ui/test/core-independent.test.ts packages/ui/test/authoring.test.ts packages/ui-editor/test/registered-authoring.test.ts --project=unit --maxWorkers=1 --no-file-parallelism --reporter=json --outputFile=docs/studio/cycle-1-3/core/independent/source-tests.json`. |
| General package registration/examples/runtime identity DOM | **6 PASS / 1 intentional baseline-generation skip** | [machine report](cycle-1-3/core/independent/renderer-tests.json). Same runner, `packages/ui-svelte/test/authoring.test.ts --project=renderer`. Existing Svelte initial-plan/a11y warnings retained; this is Happy DOM, not browser geometry or accessibility certification. |
| Specialist AI/chat and Flow authored DocumentHost tests | **10 PASS** | [machine report](cycle-1-3/core/independent/specialist-tests.json). Dedicated `--config packages/ui-flow-svelte/vitest.authoring.config.ts`, serial workers. Includes typed controlled AI intents, isolated visible Flow targets, projection lifecycle, duplicate IDs/endpoints refusal. Happy DOM only. |
| Independent local-definition slot substitution regression | **1 FAIL** | [machine report](cycle-1-3/core/independent/local-fill-tests.json); explicit provider-local fill failure PV-04. |

Passing coverage includes compatibility pins, exact renderer matching, large 300-entry bounded discovery, incomplete dependency closure, selective digest invalidation, new-family/changed-revision fixtures, legacy duplicate treatment, native headings, generic insertion/history, warning-only bridge admission and active provider occurrence affordances. These do not erase PV-01–PV-03 or establish the real-provider/browser criteria.

## Acceptance matrix at this checkpoint

| Criterion | Independent result |
| --- | --- |
| CA-01 | PASS for exact authority/baseline/isolation and prior independent design challenge lineage. |
| CA-02 | FAIL: PV-01/PV-02/PV-03/PV-04; shared package path itself is present. |
| CA-03 | Targeted tests PASS; actual large provider discovery and final browser proof pending. |
| CA-04 | Targeted maintenance tests PASS; malformed-rule negatives fail PV-02. |
| CA-05 | Source path present; integrated browser/provider typed/text/style proof pending. |
| CA-06 | FAIL: nested ownership PV-01 and local fill PV-04; composed browser/legacy/history proof pending. |
| CA-07 | Specialist authored adapters present; real browser interaction/history/persistence proof pending. |
| CA-08 | Real provider/capture proof pending. Synthetic/offline evidence is not upgraded. |
| CA-09 | Source implementation present; actual provider status/grouping/metrics and completion proof pending. |
| CA-10 | Representative real browser/provider and mixed-change/Stop journeys pending. |
| CA-11 | Full Studio checks/build and independent packed consumer pending from coordinated exact-candidate evidence; fresh verifier is active. |
| CA-12 | Required 1.4 scope is concrete and preserves milestone boundary. Crosswalk still says planned dispositions at this candidate; final finding dispositions and final remote-equal identities pending. |

Next allowed action: stage manager repairs the bounded findings, supplies a new exact committed/pushed candidate and sealed production build, then this verifier rechecks affected behavior and required regressions. Real production browser verification remains required on a separate origin; no owner review-readiness PASS is claimed now. No merge, publication, deployment, rejected interaction implementation, Milestone 2 or self-acceptance follows.
