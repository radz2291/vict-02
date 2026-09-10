# VICT Release Compatibility — Stage 07A Public Release Set

> **Status:** Stage 07A implementation record. This document is the
> VICT-authored compatibility deliverable required by
> `docs/handoff/VICT-STAGE-07A-QUELLIGHT-CONSUMER-FOUNDATION-HANDOFF.md`
> (work items 3–4). It records the exact published versions, the one
> compatible release-set identity, the supported Node/runtime versions,
> the registry location and access requirements, the consumer
> install/rollback procedure, and the integrity mechanism.
> **Independently verified and live (2026-09-09):** the independent
> Stage 07A verification recomputed the release-set identity, retrieved
> all 13 packages from the registry, and re-verified both consumer
> modes (verdict `VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE
> PERMITTED`); Stage 07A is formally closed (reference v0.4.2, §0.13).
> Per §6's CI gate rule the recorded set is live. Finding F-4's §6
> wording was reconciled at formal closure (no version-tag publication
> path; the content-derived identity is the immutability anchor).
>
> **Coordinated release set 0.1.1 (2026-09-10):** the second immutable
> release set — `vict-release-set@1/0.1.1`, all 13 members at `0.1.1` —
> carries the independently verified navigation-group-order renderer
> correction (independent verdict `VERIFIED WITH NON-BLOCKING ISSUES —
> RELEASE PREPARATION PERMITTED`, audit at `02dbf40…`). Set status:
> **verified and live (2026-09-10)** — published from the exact frozen
> artifacts of release source
> `2c8a7fb5c264c337ae8474603e693bfb19394d1e` with a temporary candidate
> dist-tag during the publication window; `latest` advanced to `0.1.1`
> only after all 13 members were individually verified against the
> frozen artifacts; the §6 CI gate rule (`verify:release-consumer --
> --registry`) passed, and an independent fresh-cache external consumer
> proved the exact-pinned install and the corrected first-occurrence
> navigation order from the registry artifacts (record:
> `docs/report/VICT-0.1.1-NAVIGATION-GROUP-ORDER-RELEASE.md`). The
> complete `0.1.1` set record is preserved in §2.1.
>
> **Coordinated release set 0.2.0 (2026-09-10) — PREPARED, NOT
> PUBLISHED:** the third immutable release set — `vict-release-set@1/
> 0.2.0`, all 13 members at `0.2.0` — carries the independently verified
> Stage 07C Phase F2 generic governed mutation-input boundary correction
> (independent verdict `VERIFIED WITH NON-BLOCKING ISSUES — PHASE F4
> RELEASE PREPARATION PERMITTED`, audit at `af47f15…`; the Phase F4
> release-gate hygiene conditions MD-1, MD-2, and LO-1 were repaired and
> verified at hygiene commit `935dae7…`). The substantive 0.2.0 change:
> generic governed mutation input carried through the released
> `app.data.mutate`/`app.data.action` command boundary of
> `@victframework/server` — a closed, optional mutation envelope whose
> input is resolved against the compiled application plan
> (`actionId`/`expectedActionRevision`) and fenced by the action's
> declared input contract before any adapter sees it; identity,
> provenance, and idempotency boundaries are preserved unchanged
> (server-derived actor, durable claim/lease/fenced settlement, keyed
> adapter reconciliation); calls without mutation input (identity-only)
> behave byte-identically to `0.1.0`/`0.1.1` (backward compatibility);
> and NO Quellight-specific Shared World semantics enter the framework
> (GOV-007). Set status: **prepared — NOT
> published; `latest` remains `0.1.1`**; publication requires a fresh
> independent pre-publication audit of the recorded release-source
> commit followed by the §6 candidate-dist-tag publication path;
> adoption by Quellight is a separate later controlled Phase Q
> compatibility task (Quellight remains pinned to `0.1.0`).

## 1. Registry identity and namespace decision

| Property | Value |
| --- | --- |
| Registry | `https://registry.npmjs.org/` (the public npm registry) |
| Namespace | `@victframework/*` — the **canonical public namespace** (owner decision, 2026-09-09) |
| Publisher | npm user `rz1`, publishing through the `victframework` organization (`rz1` is an **owner** of the org) |
| Access | `publishConfig.access = "public"` on every published manifest |
| License | Apache-2.0 (root `LICENSE`; `license: "Apache-2.0"` on the root and every published manifest) |
| Historical namespace | The former development-only `@vict/*` names are **superseded** by `@victframework/*` and are never published. Historical reports and handoffs that name `@vict/*` packages remain byte-for-byte unchanged; the supersession record lives in `docs/VICT-SYSTEM-REFERENCE.md` (§0.12) |

## 2. The immutable compatible release-set identity

One coherent exact version across the compatible package set. The
release-set identity is **immutable**: changing any member version
creates a NEW set identity; consumers upgrade explicitly by pinning the
new set. Nothing is ever unpublished, re-published, or mutated.

```json
{
  "vict-release-set": {
    "identity": "vict-release-set@1/0.2.0",
    "contentId": "v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172",
    "contentIdAlgorithm": "sha256 over the sorted newline-joined 'name@version' list of the exact member set, prefixed v1_",
    "version": "0.2.0",
    "access": "public",
    "registry": "https://registry.npmjs.org/",
    "license": "Apache-2.0",
    "packages": {
      "@victframework/appdata-sqlite": "0.2.0",
      "@victframework/application": "0.2.0",
      "@victframework/cli": "0.2.0",
      "@victframework/contracts": "0.2.0",
      "@victframework/control": "0.2.0",
      "@victframework/kernel": "0.2.0",
      "@victframework/mastra": "0.2.0",
      "@victframework/renderer-svelte": "0.2.0",
      "@victframework/runtime": "0.2.0",
      "@victframework/scaffolder": "0.2.0",
      "@victframework/sdk": "0.2.0",
      "@victframework/server": "0.2.0",
      "@victframework/store-sqlite": "0.2.0"
    }
  }
}
```

The consistency gate `npm run verify:release-set`
(`scripts/check-release-set.mjs`) re-derives every value above from the
actual manifests and **fails the release** if the manifests and this
record ever disagree (mismatched internal pins, a member version drift,
a missing member, a non-exact internal specifier, or a lost
publishability property).

### 2.1 Release-set lineage (immutable predecessors)

Prior release sets are never mutated, re-published, or unpublished;
their registry artifacts remain available for explicit pinning.

The second public release set, preserved exactly as it was recorded
while it was the current set:

```text
vict-release-set@1/0.1.1
contentId: v1_e31e8dd60d05e1d6feb08b5ed0874cceae561bdf10e08d8b93e07840de8d9cdf
contentIdAlgorithm: sha256 over the sorted newline-joined 'name@version' list of the exact member set, prefixed v1_
version: 0.1.1
access: public
registry: https://registry.npmjs.org/
license: Apache-2.0
packages:
  @victframework/appdata-sqlite   0.1.1
  @victframework/application      0.1.1
  @victframework/cli              0.1.1
  @victframework/contracts        0.1.1
  @victframework/control          0.1.1
  @victframework/kernel           0.1.1
  @victframework/mastra           0.1.1
  @victframework/renderer-svelte  0.1.1
  @victframework/runtime          0.1.1
  @victframework/scaffolder       0.1.1
  @victframework/sdk              0.1.1
  @victframework/server           0.1.1
  @victframework/store-sqlite     0.1.1
```

The `0.1.1` set was published from the exact frozen artifacts of
release source `2c8a7fb5c264c337ae8474603e693bfb19394d1e` and is
verified and live (2026-09-10); its `latest` dist-tag remains until the
`0.2.0` publication advances it through the §7 candidate-tag procedure.

The first public release set is preserved here exactly as it was recorded
while it was the current set:

```text
vict-release-set@1/0.1.0
contentId: v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d
contentIdAlgorithm: sha256 over the sorted newline-joined 'name@version' list of the exact member set, prefixed v1_
version: 0.1.0
access: public
registry: https://registry.npmjs.org/
license: Apache-2.0
packages:
  @victframework/appdata-sqlite   0.1.0
  @victframework/application      0.1.0
  @victframework/cli              0.1.0
  @victframework/contracts        0.1.0
  @victframework/control          0.1.0
  @victframework/kernel           0.1.0
  @victframework/mastra           0.1.0
  @victframework/renderer-svelte  0.1.0
  @victframework/runtime          0.1.0
  @victframework/scaffolder       0.1.0
  @victframework/sdk              0.1.0
  @victframework/server           0.1.0
  @victframework/store-sqlite     0.1.0
```

Registry truth for the predecessor set is the authoritative immutability
evidence: every `@victframework/*` package keeps its published `0.1.0`
artifacts (per-version integrity values recorded in the Stage 07A
independent-verification report) alongside the new set; `0.1.0` stays
installable by exact pin regardless of which set `latest` points to.

## 3. Dependency graph and exact pins

All intra-VICT dependencies inside the release set are EXACT pins of
`0.2.0` — no ranges, no `workspace:`/`file:`/`git` specifiers in any
published manifest. Verified dependency direction (acyclic):

```text
@victframework/contracts
  └─ @victframework/sdk
       ├─ @victframework/kernel
       │    └─ @victframework/runtime
       │         ├─ @victframework/store-sqlite
       │         ├─ @victframework/control
       │         │    └─ (server, mastra depend on control)
       │         └─ @victframework/mastra  (optional adapter; pinned @mastra/* 1.64.0 / 1.28.2 / 1.22.3 / 1.17.5)
       └─ @victframework/application
            ├─ @victframework/renderer-svelte  (Svelte 5 peer)
            └─ @victframework/appdata-sqlite
@victframework/server   (runtime + control + application + store-sqlite)
@victframework/cli      (HTTP client only; server dependency is test/dev-only)
@victframework/scaffolder (no internal runtime dependencies)
```

Publication MUST follow dependency-topological order so every consumer
install resolves: `contracts → sdk → kernel → runtime → store-sqlite →
application → renderer-svelte → appdata-sqlite → scaffolder → control →
mastra → server → cli`.

Examples (`examples/*`) and capability packs (`packs/*`) remain
workspace-private and are NOT part of the release set.

## 4. Supported runtimes

| Runtime | Supported | Evidence |
| --- | --- | --- |
| Node.js `>=22.13.0` | Declared in every published manifest (`engines.node`) | `node:sqlite` floor (OPEN-001); full verification ladder executed on Node v22.13.1 (Windows) |
| Node 24.x | Compatible target (not the declared floor) | Stage 06 authoritative evidence ran on Node v24.19.0 (Linux/WSL2) |
| Browsers | `@victframework/application` is browser-safe; `@victframework/renderer-svelte` supports browser + SSR with Svelte as a peer. All other members are Node-side | Stage 05 browser-safety boundary (reference §5.1) |

`@victframework/mastra` additionally pins exact Mastra package versions
(`@mastra/core` 1.64.0, `@mastra/memory` 1.28.2, `@mastra/libsql`
1.22.3, `@mastra/observability` 1.17.5) and records them in the adapter
compatibility marker inside `agentProfileVersion` (MSTR-002).

## 5. Install procedure (consumers, e.g. Quellight)

From a clean clone OUTSIDE the VICT checkout, installing exclusively
from the public npm registry with exact versions:

```bash
npm install @victframework/contracts@0.2.0 @victframework/sdk@0.2.0 \
  @victframework/kernel@0.2.0 @victframework/runtime@0.2.0 \
  @victframework/store-sqlite@0.2.0 @victframework/application@0.2.0 \
  @victframework/renderer-svelte@0.2.0 @victframework/appdata-sqlite@0.2.0 \
  @victframework/scaffolder@0.2.0 @victframework/control@0.2.0 \
  @victframework/mastra@0.2.0 @victframework/server@0.2.0 \
  @victframework/cli@0.2.0
```

Integrity mechanism: the consumer's lockfile records the SHA-512
`integrity` hash of every installed tarball; npm verifies every install
against it. `npm ci` reproduces the exact recorded graph.

Rollback: pin the prior release-set identity (all prior published
versions remain in the registry; nothing is unpublished or mutated).
A release-set identity is immutable; changing any member version creates
a NEW set identity; consumers upgrade explicitly. For consumers of the
`0.2.0` set, rollback means pinning the complete `0.1.1` set from §2.1
(the governed mutation-input boundary is NOT contained in `0.1.1`);
for consumers on `0.1.1`, upgrade means pinning the complete `0.2.0` set
above; for consumers still on `0.1.0` (e.g. Quellight until its Phase Q
adoption), upgrade means pinning the complete `0.1.1` set first or
jumping directly to the complete `0.2.0` set after its publication —
never a partial mix of sets.

## 6. Reproducible publication path

The scripted path from a clean checkout of the release commit to
published artifacts — no interactive steps, no secrets in the repository
(registry credentials live only in the publishing environment). **No
Git release tag is required or used** (reconciled at Stage 07A formal
closure per independent-verification finding F-4: the repository has no
tag convention; the immutability anchors are the content-derived
release-set identity in §2, the clean-tree publication preflight, and
the never-republish guard — independently verified):

1. clean checkout of the release commit (exact clean tree at the
   release commit; no tag lookup);
2. `npm ci` → `npm run verify:release-set` → `npm run build`;
3. `npm pack --dry-run --json` per package → inspected tarball manifests;
4. `npm run verify:release-consumer` (installs the packed tarballs into a
   fresh external consumer, typechecks, typechecks, runs the runtime and
   renderer composition, asserts exact versions and lockfile integrity,
   and probes for monorepo leakage);
5. `npm run publish:release` (dependency-topological `npm publish
   --access public` of the exact packed artifacts);
6. post-publication: `npm run verify:release-consumer -- --registry`
   re-runs the consumer verification installing EXACT versions from the
   public registry.

CI gate rule: `publish → verify:release-consumer -- --registry` must
pass before a release-set identity is recorded as live in this document.

## 7. Distribution tag

The Stage 07A set was published under the `latest` dist-tag as version
`0.1.0` — the first public release of the set. There were no prior
published versions of any `@victframework/*` package, so no non-stable
tag was required; `0.x` semver communicates the pre-1.0 compatibility
contract (breaking changes may arrive in `0.x` minor bumps; exact pins
protect consumers).

For the `0.1.1` coordinated set, publication kept `latest` pointing at
the complete `0.1.0` release until every `0.1.1` artifact existed: each
package was published with a temporary unique candidate dist-tag (not
`latest`), the exact version, manifest, integrity, and tarball inventory
were verified per package, and only after all 13 members were
independently confirmed was `latest` advanced to `0.1.1` on every
package and the temporary candidate tag removed. A bare
`npm install @victframework/<pkg>` therefore resolves either the
complete old set or the complete new set, never a mixed one.

For the `0.2.0` coordinated set the same discipline applies: at
preparation time `latest` is `0.1.1` on every package and `0.2.0` is
unpublished (re-derived from the registry, see the F4 preparation
record). When publication is authorized after a fresh independent
pre-publication audit, each package is published by exact frozen
tarball with a temporary unique candidate dist-tag (not `latest`),
verified per package, and only after all 13 members are independently
confirmed is `latest` advanced to `0.2.0` on every package and the
candidate tag removed — never a mixed set.

## 8. Post-install independence

An installed consumer has NO dependency on the VICT source checkout: all
published packages ship only their declared `files` (built `dist`
output, plus the renderer's Svelte sources and theme CSS by design), all
internal dependencies resolve as exact registry versions, and
`scripts/verify-release-consumer.mjs` proves installation, typecheck,
composition, and execution in a temp directory outside the repository
with a no-monorepo-leakage probe.
