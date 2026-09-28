# Builder-kit stable-layer regeneration — UI convergence tip (2026-09-27)

QA FINDING-2 closure record for branch `pi/ui-convergence-r2`. Scope:
the committed builder-kit stable layer only. No Stage 8 criterion, rubric,
handoff, or governance evidence document is amended; every packId recorded
in frozen evidence remains as filed.

## 1. Symptom (reproduced on this tip before any change)

`verify:builder-kit` — 3 FAIL, byte-identical in class to the failures the
independent verification recorded on `8141812` (and reproduced there on the
pristine `pi/taskledger-platform-gap` worktree):

```
FAIL: pack:regenerate-compare [content-drift] — regenerated base pack differs from the committed base pack
FAIL: pack:renderings [generated-artifact-drift] — BUILDER-KIT.md stale; PACK.md stale
FAIL: identity:workspace [workspace-identity-drift] — root identity current; workspace membership changed
```

All other checks passed, including `catalog:regenerate-compare`
(byte-identical) and `identity:release-set` (`vict-release-set@1/0.3.1`).

## 2. Root cause

The committed stable layer was last regenerated at `196a2c1` (2026-09-25,
pre-UI main lineage; repository map over the then-14-package workspace).
The UI lineages subsequently added `packages/ui`, `packages/ui-svelte`,
and `examples/ui-showcase` (and the TaskLedger/publishing-order work
changed several package manifests) without the mandated regeneration the
kit's own freshness rule requires (BUILDER-KIT.md §2: "regenerate with
`npm run kit:generate`"). The gate failed closed, correctly: the committed
pack no longer described the repository it is generated from.

## 3. Procedure (the repository's own mandated one)

`npm run kit:generate` on the combined tip, which regenerates exactly the
four generated artifacts (capability catalog → base pack → renderings):

- `docs/builder-kit/capability-catalog.json`
- `docs/builder-kit/context-pack.json`
- `docs/builder-kit/PACK.md`
- `BUILDER-KIT.md`

Byte-stability: a second immediate regeneration produced byte-identical
artifacts (sha256-verified, no churn), matching the determinism
requirement recorded for prior regenerations.

## 4. Identity changes (recorded, not hidden)

| Artifact | Before | After |
| --- | --- | --- |
| base pack packId | `791f24fb023cf3eb29ffb0d7123f23ad803b8042906ed84ace6d991d4d15a0b2` | `bed2e5c2d3ed5454a259163fdfc3d2b5e0f250520a9ff493ac3603a0584b4c14` |
| `docs/builder-kit/context-pack.json` sha256 | `220e60c0de00f64beb77fc384223268a240baecab8a8d29a67d952b53ea9a016` | (committed value in this change) |
| `BUILDER-KIT.md` sha256 | `28141d94d6da203623cd2b4ce19c4edbecb0154dccda266bbf9bdd0d4853e0e2` | (committed value in this change) |
| `docs/builder-kit/PACK.md` sha256 | `c0e49a0b7c1c2baea6452ce4eba4a71ff5790fe376e3288f3712700a332eb5ea` | (committed value in this change) |
| `docs/builder-kit/capability-catalog.json` sha256 | `2ff63e5c784a15e93b4457c2a7710beb9443bc119d133fdc156fb0347f818946` | `2ff63e5c784a15e93b4457c2a7710beb9443bc119d133fdc156fb0347f818946` (byte-identical — unchanged) |

Pack content delta (context-pack.json diff, exactly and only):

- workspace repository map gains the three UI-lineage members
  (`@victframework/ui`, `@victframework/ui-svelte`, `ui-showcase`) with
  their dependency maps; recorded membership now 23 workspace manifests;
- recorded input content digests refreshed for manifests and
  `docs/RELEASE-COMPATIBILITY.md` as they changed on the UI/TaskLedger
  lineages since `196a2c1` (the release-set identity block itself is
  unchanged — the gate still verifies `vict-release-set@1/0.3.1`);
- the derived `packId` change above. Capability declarations are
  untouched (5 declarations before and after).

## 5. Frozen evidence untouched

- `docs/builder-kit/accepted-task-scope.json`: sha256
  `f1acae066a822fd5e9c60cc9ba39121f94e462715cf2acb030edf4ea71d73f0e`
  before and after (the generator never writes it).
- Historical evidence documents (Stage 8 records, handoffs, task cards,
  proof reports) that mention `791f24fb…` or earlier kit identities are
  NOT rewritten; they describe those moments in time. The regenerated
  layer is the CURRENT freshness truth, as after every prior mandated
  regeneration (e.g. `196a2c1`: `e8f83651… → 791f24fb…`).
- The trusted-publishing §15 amendment remains a DRAFT for owner
  ratification; the regeneration reads the release-set identity block and
  amends nothing.

## 6. Gate outcome on this tip after regeneration

`verify:builder-kit` — ALL CHECKS PASSED (18 checks), including
`pack:regenerate-compare`, `pack:renderings`, `identity:workspace`
(23 manifests), `identity:release-set`, canary absence, and baseline
comparison (no task pack present).
