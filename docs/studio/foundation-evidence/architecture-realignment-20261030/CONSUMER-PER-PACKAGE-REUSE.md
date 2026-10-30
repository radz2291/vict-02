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
