# U0 stage-manager handoff

Status: EXECUTABLE DOCUMENTATION HANDOFF, subject to live baseline/isolation reconciliation.
Authority: owner's 5 October 2026 instruction “Ok lets start” after the scope and documentation-pack discussion. This handoff prepares, reviews and freezes the first foundation contract. It does not authorize production implementation.

## 1. Your responsibility

Own U0 end to end: install/reconcile the pack, inventory actual public contracts, finalize the implementation-ready design, obtain independent review, repair findings, freeze/reverify exact bytes, commit/push the isolated stage branch and report. You may delegate non-overlapping investigation/design work if useful and use a fresh verifier. Keep technical choices within the agreed product outcome.

Do not return each minor finding to the owner. Resolve ordinary in-scope choices and defects. Preserve red findings. If independent agents are unavailable, use a fresh separate session/checkout; do not label your own review independent.

## 2. Repository and baseline

Repository: https://github.com/radz2291/vict-02.
Observed origin/main: `4d2df037d8a82d36c60bf1bff16919650643ce22`.
Preferred branch and normal-push destination: codex/ui-foundation-u0 in this repository.
Working location: new isolated worktree or checkout; do not reuse or clean another agent's tree.

Verify remote URL, live origin/main, branch, working tree, relevant local instructions and existing pack paths before changes. Do not expose credentials in logs.

If main changed: compare the relevant SDK/application/UI/runtime and root instructions against the pinned baseline. A documentation-only or unrelated movement can be reconciled with a recorded updated base and unchanged scope. A change affecting identity, dispatch, package ownership or another active UI track requires concrete reconciliation before freeze. Do not force old bytes over newer work. Ask only if the resolution changes product/authority; otherwise reconcile routine baseline movement yourself.

If the preferred branch/path already exists, inspect its state and coordinate/resume legitimate work or choose an isolated suffix. No reset, force push or history rewrite.

## 3. Allowed edits

- docs/ui-foundation/**: the contract records, source/API drafts, design fixtures, identity examples, proposed dependency graph, freeze/review evidence and state.
- Root AGENTS.md: only append/update the short routing block in AGENTS.addendum.md while preserving existing guidance.
- A concise link to this foundation pack in an existing documentation index, only if useful and non-conflicting.

Allowed read-only inspection: root package/scripts/tests/CI, docs/VICT-SYSTEM-REFERENCE.md, SDK application types, application compile/release/data/conformance, UI composition/renderer/registry, capability-double execution APIs, current Studio as a consumer and prior relevant evidence.

Do not modify production source, package manifests/lockfiles, runtime/server/CLI commands, apps/studio, other products, existing Stage 9 contract/closure bytes, published release records or registry settings. No implementation spike or prototype code in U0. Design fixtures and precise schema drafts are documentation, not a claim of executable implementation.

## 4. Required work packages

WP-1 Baseline and installation: preserve root instructions, install docs, record base/branch/isolation and relevant dependencies.

WP-2 Canonical source/identity: reconcile the proposed @3 application shape, uiDocument reference and explicit compile inputs with existing closed schemas, SDK→UI dependency and release version binding. Specify applicationVersion changes and old-release rejection. Explain APP-019 compliance through a dated design decision.

WP-3 UI contracts: finalize document/node ownership, styles/cascade/conditions, components/slots/extensions, expressions/types, interactions, occurrence mappings and transactional edit/session protocol. Draft representative valid/invalid fixtures. Pin diagnostic classes and proposed public APIs.

WP-4 Preview: select existing double registration/invocation and data adapter contracts by actual exported name/path; map action/view dispatch without inventing a second engine. Specify reset/session fencing and the durable local replacement.

WP-5 Delivery: fix module directories/export/build strategy; complete fictional domain/permission/scenario contracts, visual proof layouts, independent-consumer mounting example design and performance workload/environment/targets.

WP-6 Independent contract challenge and freeze: reviewer tests U0-01..U0-08 against exact candidate. Repair gaps and re-review. Freeze final immutable contract bytes and record pins/candidate SHA, then have a fresh checker reproduce pins and authority/scope claims. Update STATE, commit evidence, normal-push the isolated branch and verify remote full SHA.

## 5. Acceptance and stop

U0 passes only when U0-01..U0-08 are demonstrated by a fresh independent reviewer and final freeze bytes are independently checked. A design fixture review is not runtime test evidence. Record NOT DEMONSTRATED honestly.

STOP at U0 closure and owner handover. Do not start U1, merge to main, publish npm packages, integrate Studio, migrate products or activate any real service.

Material stop conditions: incompatible existing VICT identity/runtime boundary requiring a new product decision; no available independent verification; conflicting ownership/rights; inability to create/push the authorized isolated branch; unresolved required contract findings. Missing local credentials are an environmental blocker, not permission to substitute another remote.

## 6. Required final report

Lead with contract/freeze readiness and what the next implementation agent can do.
Include:
- repository/branch/base full SHA;
- final contract candidate SHA, freeze-record/evidence commit SHA and remote SHA;
- reviewer/checker identities, exact reviewed SHAs, criterion verdicts and pins;
- key architectural decisions and amended scope, if any;
- retained findings, limitations and missing proof;
- next action: an explicit U1 implementation handoff, without claiming it is already authorized by this U0 task.

Keep the actual contract and evidence files in the repository. This prompt gives you stage ownership, not just a one-shot writing assignment.
