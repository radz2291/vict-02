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
> **Coordinated release set 0.2.0 (2026-09-10; published 2026-09-11) —
> VERIFIED AND LIVE:** the third immutable release set — `vict-release-set@1/
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
> (GOV-007). Set status: **published and registry-verified (2026-09-11)** —
> the fresh independent pre-publication audit of the recorded release-source
> commit returned `VERIFIED WITH NON-BLOCKING ISSUES — VICT 0.2.0 PUBLICATION
> PERMITTED FROM EXACT SOURCE 5c81aca…` (audit report committed at
> `a4ad735…`); the 13 frozen artifacts were reproduced from that exact source
> and byte-compared against the audit inventory (13/13 SHA-256 equal) before
> any publish; publication used the §7 candidate-dist-tag discipline with the
> temporary tag `vict-0.2.0-rc` (`latest` remained the complete `0.1.1` set
> throughout the window); each package's registry artifact was downloaded and
> proven byte-identical to its frozen artifact; the §6 CI gate rule
> (`verify:release-consumer -- --registry`) passed, an independent mutation-
> proof consumer proved the governed mutation-input boundary (valid input
> reaches the adapter exactly once; undeclared, oversized multibyte, and
> closed-envelope violations fail closed with zero adapter calls; identity-
> only behavior is byte-compatible), and a fresh `latest`-resolution consumer
> proved the exact-0.2.0 install from the public registry with
> `npm audit --omit=dev` clean; `latest` advanced to `0.2.0` on every package
> only after all 13 members were individually verified, and the candidate
> tag was then removed (13/13; final dist-tags exactly `{latest: 0.2.0}`).
> Publication and verification record:
> `docs/report/VICT-0.2.0-PUBLICATION.md`. Quellight remains pinned to
> `0.1.0`; adopting `0.2.0` is a separate later controlled Phase Q
> compatibility task (permitted, not begun).
>
> **Coordinated stable release set 0.3.0 (2026-09-21) — PREPARED,
> PUBLICATION AUTHORIZED (PENDING EXECUTION AT PREPARATION TIME):** the
> fifth immutable release set — `vict-release-set@1/0.3.0`, all 13
> members at `0.3.0` — carries the SAME verified M-1 semantic content as
> the candidate below with NO runtime, authority, approval, migration,
> API, or product-behavior change (only package versions, exact internal
> pins, the generated release identity, and provenance metadata
> differ). The fresh independent re-verification
> (`docs/report/VICT-M-1-INDEPENDENT-RE-VERIFICATION.md`, verdict
> `CLEARED — CONDITIONAL STABLE RELEASE PERMITTED`, 0 Blocking / 0 High /
> 0 Medium) cleared the evidence chain of the candidate and executed the
> full deferred audit scope (Linux authoritative rebuild 13/13
> byte-identical, registry-only consumer proof with fail-closed negative
> controls, old-tree negative controls, 10 independent M-1 semantic
> probes, both authoritative ladders green). Publication goes through
> the unchanged trusted-OIDC workflow `.github/workflows/release.yml`
> with `npm_tag: latest` (no npm token, login, or OTP anywhere);
> `latest` moves to `0.3.0` only through this direct stable publication
> (frozen §7 tag rule), the candidate tag `vict-0.3.0-rc` remains
> `0.3.0-rc.1` untouched, and `0.2.0` remains available.
>
> **Coordinated candidate release set 0.3.1-rc.1 (2026-09-22) —
> PUBLISHED AND EVIDENCE-RECOVERED (verification candidate):** the sixth
> immutable release set — `vict-release-set@1/0.3.1-rc.1`, all 13 members
> at `0.3.1-rc.1` — carries the B-1 model-facing capability-schema
> remediation (frozen contract
> `docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-CONTRACT.md`): the
> neutral descriptive presentation API (optional `descriptiveJsonSchema` on
> the contract declaration; optional bounded `description` on the
> capability definition), the safe bounded fail-closed presentation capture
> in the Mastra bridge, provider-facing tool schemas that carry the exact
> captured structure instead of the fabricated generic `{type:object}`
> object, fail-closed construction for model-facing capabilities without a
> usable descriptive input schema, and adapter revision 1 → 2.
> Graph-only execution is unchanged. Set status: **published from exact
> release source `948d8e5…` under the candidate tag `vict-0.3.1-rc`
> through the trusted-OIDC release workflow (publication run
> `35625570254`: full in-workflow chain green, ALL 13 packages published
> via npm OIDC, final same-run registry verification failed on CDN
> propagation lag — terminal-`failure` on verification timing only; the
> read-only successor evidence run `35630175086` then re-proved the set
> terminal-`success` — 13/13 registry integrity equality against the
> byte-identical Linux rebuild, dist-tags `vict-0.3.1-rc → 0.3.1-rc.1`,
> `latest → 0.3.0`, SLSA provenance 13/13 bound to the source SHA and
> publication run, registry-only consumer proof — per
> `docs/report/VICT-0.3.1-RC1-EVIDENCE-RECOVERY-AMENDMENT.md`).
> `latest` remains `0.3.0` and stable `0.3.1` is NOT published.**
> Independent verification is outstanding.
>
> **Coordinated candidate release set 0.3.0-rc.1 (2026-09-21) —
> PUBLISHED AND INDEPENDENTLY RE-VERIFIED (verification candidate):** the fourth
> immutable release set — `vict-release-set@1/0.3.0-rc.1`, all 13 members
> at `0.3.0-rc.1` — carries the VICT-M-1 truthful-effect remediation
> (frozen contract
> `docs/report/VICT-M-1-REMEDIATION-CONTRACT.md`): independent
> representation of factual effect, the per-invocation approval decision,
> and its closed-code policy basis (`EffectApprovalDisposition`,
> `VICT_EFFECT_POLICY_IDENTITY`, three intent-immutable evidence fields on
> the durable invocation record; SQLite migration 10 with an unambiguous
> 0.2.0-rule backfill; and the host-owned EXACT quiet-write approval
> policy — composition-supplied only, no wildcard, no capability
> self-exemption, `irreversible` never exemptable; defaults byte-equivalent
> when absent). Set status: **verification candidate, published under the
> candidate tag `vict-0.3.0-rc` through the trusted-OIDC release workflow
> (`.github/workflows/release.yml`); `latest` remains `0.2.0` and stable
> `0.3.0` is NOT published.** Independent verification of M-1 is
> outstanding; a stable `0.3.0` release (published through the same
> workflow after verification) is a separate later decision. **Evidence-chain
> recovery (2026-09-21):** Blocking finding B-1 — the publication run's
> terminal-`failure` verify step and its divergent recorded contentId — was
> remediated through the owner-approved read-only amendment
> (`docs/report/VICT-TRUSTED-PUBLISHING-EVIDENCE-RECOVERY-AMENDMENT.md`):
> successor evidence run `35558851493` (terminal-`success`) re-proved this
> set read-only (13/13 integrity, provenance, dist-tags, Linux rebuild
> byte-identical, corrected contentId `v1_9117e0cb…`, registry-only
> consumer proof) with the original run `35530894104` preserved as the
> truthful publication event; the set's evidence chain is intact and AWAITS
> FRESH INDEPENDENT RE-VERIFICATION
> (`docs/report/VICT-M-1-CANDIDATE-EVIDENCE-RECOVERY.md`).

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
    "identity": "vict-release-set@1/0.3.1-rc.1",
    "contentId": "v1_b6e39c1f6d6f627c03dfe12e8eb4bc0b6b8bb7f7746b4b871cf00d3c7f7ae731",
    "contentIdAlgorithm": "sha256 over the sorted newline-joined 'name@version' list of the exact member set, prefixed v1_",
    "version": "0.3.1-rc.1",
    "access": "public",
    "registry": "https://registry.npmjs.org/",
    "license": "Apache-2.0",
    "packages": {
      "@victframework/appdata-sqlite": "0.3.1-rc.1",
      "@victframework/application": "0.3.1-rc.1",
      "@victframework/cli": "0.3.1-rc.1",
      "@victframework/contracts": "0.3.1-rc.1",
      "@victframework/control": "0.3.1-rc.1",
      "@victframework/kernel": "0.3.1-rc.1",
      "@victframework/mastra": "0.3.1-rc.1",
      "@victframework/renderer-svelte": "0.3.1-rc.1",
      "@victframework/runtime": "0.3.1-rc.1",
      "@victframework/scaffolder": "0.3.1-rc.1",
      "@victframework/sdk": "0.3.1-rc.1",
      "@victframework/server": "0.3.1-rc.1",
      "@victframework/store-sqlite": "0.3.1-rc.1"
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

The immediate predecessor stable set, preserved exactly as it was
recorded while it was the current set:

```text
vict-release-set@1/0.3.0
contentId: v1_5f3a074a50ab5623acbf933d52a24e6d383ded2ccd02bbaa78a28c3be3915580
contentIdAlgorithm: sha256 over the sorted newline-joined 'name@version' list of the exact member set, prefixed v1_
version: 0.3.0
access: public
registry: https://registry.npmjs.org/
license: Apache-2.0
packages:
  @victframework/appdata-sqlite   0.3.0
  @victframework/application      0.3.0
  @victframework/cli              0.3.0
  @victframework/contracts        0.3.0
  @victframework/control          0.3.0
  @victframework/kernel           0.3.0
  @victframework/mastra           0.3.0
  @victframework/renderer-svelte  0.3.0
  @victframework/runtime          0.3.0
  @victframework/scaffolder       0.3.0
  @victframework/sdk              0.3.0
  @victframework/server           0.3.0
  @victframework/store-sqlite     0.3.0
```

The candidate release set, preserved exactly as it was recorded while it
was the current set (published under the candidate tag `vict-0.3.0-rc`;
evidence chain recovered and independently re-verified — original
publication run `35530894104` truthfully terminal-`failure`, successor
evidence run `35558851493` terminal-`success`):

```text
vict-release-set@1/0.3.0-rc.1
contentId: v1_9117e0cbd3f3fe520238442e237889bf3b9a50916327051487b8a497551500a4
contentIdAlgorithm: sha256 over the sorted newline-joined 'name@version' list of the exact member set, prefixed v1_
version: 0.3.0-rc.1
access: public
registry: https://registry.npmjs.org/
license: Apache-2.0
packages:
  @victframework/appdata-sqlite   0.3.0-rc.1
  @victframework/application      0.3.0-rc.1
  @victframework/cli              0.3.0-rc.1
  @victframework/contracts        0.3.0-rc.1
  @victframework/control          0.3.0-rc.1
  @victframework/kernel           0.3.0-rc.1
  @victframework/mastra           0.3.0-rc.1
  @victframework/renderer-svelte  0.3.0-rc.1
  @victframework/runtime          0.3.0-rc.1
  @victframework/scaffolder       0.3.0-rc.1
  @victframework/sdk              0.3.0-rc.1
  @victframework/server           0.3.0-rc.1
  @victframework/store-sqlite     0.3.0-rc.1
```

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
`0.3.1-rc.1` — no ranges, no `workspace:`/`file:`/`git` specifiers in any
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
npm install @victframework/contracts@0.3.0 @victframework/sdk@0.3.0 \
  @victframework/kernel@0.3.0 @victframework/runtime@0.3.0 \
  @victframework/store-sqlite@0.3.0 @victframework/application@0.3.0 \
  @victframework/renderer-svelte@0.3.0 @victframework/appdata-sqlite@0.3.0 \
  @victframework/scaffolder@0.3.0 @victframework/control@0.3.0 \
  @victframework/mastra@0.3.0 @victframework/server@0.3.0 \
  @victframework/cli@0.3.0
```

Integrity mechanism: the consumer's lockfile records the SHA-512
`integrity` hash of every installed tarball; npm verifies every install
against it. `npm ci` reproduces the exact recorded graph.

Rollback: pin the prior release-set identity (all prior published
versions remain in the registry; nothing is unpublished or mutated).
A release-set identity is immutable; changing any member version creates
a NEW set identity; consumers upgrade explicitly. For consumers of the
`0.3.0` set, rollback means pinning the complete `0.2.0` set from §2.1
(the M-1 truthful-effect evidence is NOT contained in `0.2.0`);
for consumers on `0.3.0-rc.1`, upgrade means pinning the complete
`0.3.0` set above (the M-1 semantic content is identical; only the
version/pin/identity metadata differs); for consumers still on `0.2.0`
or earlier, upgrade means adopting the complete `0.3.0` set —
never a partial mix of sets.

## 6. Reproducible publication path (GitHub OIDC trusted publishing)

The ordinary publication path is the GitHub Actions workflow
`.github/workflows/release.yml` (`radz2291/vict-02`), governed by the
frozen contract
[`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`](./RELEASE-TRUSTED-PUBLISHING-CONTRACT.md).
No interactive steps, no secrets in the repository, and no long-lived npm
publishing token anywhere: the workflow receives a SHORT-LIVED credential
directly from npm through the OIDC exchange (`id-token: write`; npm
>= 11.5.1 on a GitHub-hosted runner). There is no separate dist-tag
mutation step — the model is version-based:

```text
Pre-verification candidate:  0.x.y-rc.N under the candidate tag vict-0.x.y-rc (never latest)
Verified stable release:     0.x.y under latest
```

**Local machine:** develops, verifies, commits, and pushes the immutable
release source (an exact, clean main-lineage commit whose manifests and
recorded release-set identity are coherent).

**GitHub Actions:** re-checks the exact pushed source again — full
40-hex `source_sha` input checked out and proven an ancestor of
`origin/main`; release-set coherence (`npm run verify:release-set`);
`npm ci`; format, lint, typecheck, and the full test suite; the full
build; the ACTUAL tarballs packed, identity-inspected, and content-
scanned; the isolated packed-tarball consumer proof — and then publishes
those exact tarballs in dependency-topological order with `--access
public` and the requested closed dist-tag, never overwriting,
re-publishing, or unpublishing an existing version. On partial failure
it stops and reports the exact published subset; a later run may resume
only by proving byte-identical registry integrity for every
already-published member (`resume_from_package`). Post-publication it
proves per-package registry integrity and dist-tag state and re-runs the
consumer install from the public registry. Local `npm whoami` is NOT a
release-preflight requirement; no OTP is required per package. A
`validate_only` run exercises the entire pre-publication chain but is
NOT proof that OIDC publication works.

The retained operator-run fallback for extraordinary situations is
`node scripts/publish-release.mjs [--publish]` (dry by default), the
same fail-closed engine described below; it requires local npm
authentication and is NOT the ordinary path:

1. clean checkout of the release commit (exact clean tree at the
   release commit; no tag lookup);
2. `npm ci` → `npm run verify:release-set` → `npm run build`;
3. `npm pack --dry-run --json` per package → inspected tarball manifests;
4. `npm run verify:release-consumer` (installs the packed tarballs into a
   fresh external consumer, typechecks, runs the runtime and
   renderer composition, asserts exact versions and lockfile integrity,
   and probes for monorepo leakage);
5. publication of the exact packed artifacts (ordinary path: the GitHub
   Actions workflow above; fallback: `npm run publish:release` —
   dependency-topological `npm publish --access public`);
6. post-publication: `npm run verify:release-consumer -- --registry`
   re-runs the consumer verification installing EXACT versions from the
   public registry (the workflow performs the equivalent proof
   automatically).

CI gate rule: `publish → verify:release-consumer -- --registry` must
pass before a release-set identity is recorded as live in this document.
Trusted-publisher configuration is per package (all 13 trust the exact
repository + workflow filename `release.yml`); it was bootstrapped once
in a bounded interactive session with
`scripts/trust-bootstrap.mjs` and is verified through `npm trust list`.
Workflow filename and repository identity are security-sensitive and
cannot be casually renamed. Account-, organization-, and package-
governance changes may still require interactive 2FA; ordinary
coordinated releases do not.

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
