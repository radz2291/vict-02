# Public consumer per-package build-evidence reuse

The prior helper allowed only Flow to change during explicit dependency reuse.
A renderer change in `ui-svelte` therefore required repeating every dependency
build check even when those other package trees and built artifacts were identical.

`scripts/verify-architecture-realignment-consumer.mjs` now evaluates each of the
seven packages independently. Reuse requires a prior successful DOM/production
consumer report, an identical committed package tree, and matching current hashes
for every file in that report's packed inventory. A changed tree receives a fresh
build check. With an unchanged tree, changed/missing artifact files also receive
a fresh build check, with mismatched paths recorded. Other read errors refuse.
The successful report explicitly records reused versus fresh checks and reasons;
reuse never claims a newly executed package build.

Every package is freshly packed. Reused packages must additionally reproduce the
entire prior packed file inventory, including file count, paths and SHA-256 values.
Fresh packages use their new packed inventory. All packages retain the existing
installed-artifact identity checks, isolated consumer DOM interaction and source
roundtrip checks, and production build. No previous receipts are overwritten.

Shared root package/lock/TypeScript inputs changing since the prior source still
refuse reuse and require the default full ladder. Uncommitted changes to those
inputs also refuse reuse. Dirty or nonignored untracked files anywhere within a
packed package refuse proof, extending the earlier source/manifest cleanliness
check to match the full package-tree identity comparison. The default invocation
continues to execute all seven build checks.

Validation at this helper-only commit: `node --check` and scoped `git diff --check`
passed. The consumer was deliberately **not run** while the separate renderer
lifetime repair was in progress. After that package change is committed, the
parent should run the actual isolated consumer against the exact candidate:

```powershell
node scripts/verify-architecture-realignment-consumer.mjs `
  --reuse-built-dependencies `
  docs/studio/foundation-evidence/architecture-realignment-20261030/vict-realignment-consumer-F0YKQr.json
```

That later receipt determines the actual reused/fresh counts and results. It is a
coding-authored public-consumer fixture proof, never actual-agent, browser,
physical-device, provider, or owner-acceptance evidence. No such checks or service,
network, browser, or provider changes were performed for this helper revision.

## Follow-up: propagate dependency rebuilds

Independent review identified that equal local package trees/artifacts alone do not
prove a downstream package's check remains applicable when an upstream internal
API changes. The earlier paragraphs record the initial helper revision; the
current helper additionally requires that no internal dependency was freshly
checked. This is a generic reuse correction. The existing WhcDEI receipt for the
bounded DocumentHost-only, unchanged-API delta is retained and not discarded.

The current helper reads actual installed workspace package manifests, unions
`dependencies`, `peerDependencies` and `optionalDependencies` edges among the seven
packages, and verifies those installed manifest sections match the workspace
manifests. Stale installed graphs refuse. Topological ordering ensures upstream
checks are decided first; dependency cycles refuse instead of guessing an order.
Any fresh dependency check forces the direct dependant's check fresh, propagating
transitively even if the dependant's own tree and artifact hashes are unchanged.
For the current graph, a fresh `ui-svelte` check also requires Media and then Flow
checks. A fresh contracts/UI check conservatively propagates through SDK,
application and the affected Svelte packages.

Reports retain the graph and each dependency edge's declaring manifest sections.
Fresh checks retain the existing primary `reason`, add complete `reasons` and
explicit `dependencyRebuilds` names when applicable. Existing shared-input,
dirty/untracked-source, artifact, fresh-packing and installed-identity fences
remain. There are no timestamp-based invalidations.

Validation of this follow-up: syntax and scoped whitespace checks passed. No
consumer, package build or runtime was invoked because the parent's existing
consumer and Studio build were active. The parent determines whether another
consumer is needed after those runs finish; this change itself establishes no
new consumer or actual-agent/device result.
