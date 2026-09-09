# VICT Release Compatibility — Stage 07A Public Release Set

> **Status:** Stage 07A implementation record. This document is the
> VICT-authored compatibility deliverable required by
> `docs/handoff/VICT-STAGE-07A-QUELLIGHT-CONSUMER-FOUNDATION-HANDOFF.md`
> (work items 3–4). It records the exact published versions, the one
> compatible release-set identity, the supported Node/runtime versions,
> the registry location and access requirements, the consumer
> install/rollback procedure, and the integrity mechanism.
> **Not independently verified yet** — Stage 07A remains awaiting
> independent verification.

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
    "identity": "vict-release-set@1/0.1.0",
    "contentId": "v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d",
    "contentIdAlgorithm": "sha256 over the sorted newline-joined 'name@version' list of the exact member set, prefixed v1_",
    "version": "0.1.0",
    "access": "public",
    "registry": "https://registry.npmjs.org/",
    "license": "Apache-2.0",
    "packages": {
      "@victframework/appdata-sqlite": "0.1.0",
      "@victframework/application": "0.1.0",
      "@victframework/cli": "0.1.0",
      "@victframework/contracts": "0.1.0",
      "@victframework/control": "0.1.0",
      "@victframework/kernel": "0.1.0",
      "@victframework/mastra": "0.1.0",
      "@victframework/renderer-svelte": "0.1.0",
      "@victframework/runtime": "0.1.0",
      "@victframework/scaffolder": "0.1.0",
      "@victframework/sdk": "0.1.0",
      "@victframework/server": "0.1.0",
      "@victframework/store-sqlite": "0.1.0"
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

## 3. Dependency graph and exact pins

All intra-VICT dependencies inside the release set are EXACT pins of
`0.1.0` — no ranges, no `workspace:`/`file:`/`git` specifiers in any
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
npm install @victframework/contracts@0.1.0 @victframework/sdk@0.1.0 \
  @victframework/kernel@0.1.0 @victframework/runtime@0.1.0 \
  @victframework/store-sqlite@0.1.0 @victframework/application@0.1.0 \
  @victframework/renderer-svelte@0.1.0 @victframework/appdata-sqlite@0.1.0 \
  @victframework/scaffolder@0.1.0 @victframework/control@0.1.0 \
  @victframework/mastra@0.1.0 @victframework/server@0.1.0 \
  @victframework/cli@0.1.0
```

Integrity mechanism: the consumer's lockfile records the SHA-512
`integrity` hash of every installed tarball; npm verifies every install
against it. `npm ci` reproduces the exact recorded graph.

Rollback: pin the prior release-set identity (all prior published
versions remain in the registry; nothing is unpublished or mutated).
A release-set identity is immutable; changing any member version creates
a NEW set identity; consumers upgrade explicitly.

## 6. Reproducible publication path

The scripted path from a clean checkout + version tag to published
artifacts — no interactive steps, no secrets in the repository (registry
credentials live only in the publishing environment):

1. clean checkout of the release commit (`git checkout <tag>`);
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

The Stage 07A set is published under the `latest` dist-tag as version
`0.1.0` — the first public release of the set. There are no prior
published versions of any `@victframework/*` package, so no non-stable
tag is required; `0.x` semver communicates the pre-1.0 compatibility
contract (breaking changes may arrive in `0.x` minor bumps; exact pins
protect consumers).

## 8. Post-install independence

An installed consumer has NO dependency on the VICT source checkout: all
published packages ship only their declared `files` (built `dist`
output, plus the renderer's Svelte sources and theme CSS by design), all
internal dependencies resolve as exact registry versions, and
`scripts/verify-release-consumer.mjs` proves installation, typecheck,
composition, and execution in a temp directory outside the repository
with a no-monorepo-leakage probe.
