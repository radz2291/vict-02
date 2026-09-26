# VICT Release Trusted-Publishing Contract (FROZEN)

**Status:** Frozen release-infrastructure contract — one-time bootstrap task.
**Frozen:** 2026-09-20, at VICT release-source base `18d8b50546a880e097274a32bec781a8fc6a7cdd`
(`HEAD == origin/main`, clean tracked tree, linear ancestry).
**Scope:** the npm publication authority model for the coordinated
`@victframework/*` release set only. This contract does NOT implement
VICT-M-1, does NOT change any package version, does NOT publish any
package version, does NOT repin Quellight, and does NOT begin Phase Q6.

Amendment rule: if a frozen semantic rule below must change, the change is
documented in a separate amendment commit BEFORE any implementation
consumes the amendment. No silent reinterpretation; no amendment bundled
with consuming implementation.
Amendments to date: §8.1 (2026-09-21, build before the full suite);
§14 (2026-09-26, 15-package release set).

## 1. Trusted repository identity (frozen; AMENDED 2026-09-26, §14)

* GitHub owner/repository: **`radz2291/vict-02`** (exactly; from `origin`:
  `https://github.com/radz2291/vict-02.git`).
* Visibility: **public** (verified via the GitHub REST API;
  `private: false`; default branch `main`).
* GitHub Actions is available on the repository (actions API reachable,
  zero prior workflow runs).
* All 15 published manifests carry (AMENDED 2026-09-26: 13 → 15; see
  §14)
  `repository.url = git+https://github.com/radz2291/vict-02.git` with
  `directory: packages/<name>` — the package metadata truthfully names the
  exact source repository. Trusted publishing therefore derives from and
  binds to metadata that is already public and consistent.

## 2. Workflow identity (frozen; security-sensitive; AMENDED 2026-09-26,
§14)

* Exact workflow filename: **`release.yml`** at
  `.github/workflows/release.yml`.
* npm binds each package's trusted publisher to the EXACT workflow
  filename. The filename is security-sensitive: renaming it silently
  invalidates the trust relationships of all 15 packages (AMENDED
  2026-09-26: 13 → 15; see §14). It must not be
  renamed without a new amendment of this contract and a new bootstrap.
* The repository identity and workflow filename together are the whole
  authorization surface: no environment, no unrelated provider, and no
  additional workflow is trusted.

## 3. Runner and toolchain (frozen)

* Runs ONLY on a **GitHub-hosted runner**: `ubuntu-latest`. Self-hosted
  runners are never used for publication (npm trusted publishing requires
  GitHub-hosted runners).
* Node on the runner: **`24`** (satisfies npm's trusted-publishing
  minimum of Node >= 22.14.0).
* npm on the runner: **explicitly pinned `11.19.1`** (satisfies npm >=
  11.5.1 for OIDC publication and >= 11.15.0 for the `npm trust`
  interface used by the one-time bootstrap).
* Dependency caching is DISABLED for release builds
  (`package-manager-cache: false`; no `cache: npm`). A release is built
  from a fresh install of the locked graph only.

## 4. OIDC permission model (frozen)

```yaml
permissions:
  contents: read
  id-token: write
```

* Exactly these two permissions; nothing broader, ever.
* **No-secret policy:** no npm token, granular access token, automation
  token, or bypass-2FA token exists in GitHub repository/org settings, in
  the repository tree, in any `.npmrc`, or in workflow env. The workflow
  receives a SHORT-LIVED credential directly from npm through the OIDC
  exchange (`id-token: write`); npm automatically prefers the OIDC
  identity over any ambient token.
* No GitHub Actions `environment` is declared or trusted (the trust
  relationship is configured with no `--environment`).
* Account-, organization-, and package-governance operations (org
  changes, package settings, dist-tag edits outside publish, unpublish)
  are OUT OF SCOPE: they may still require interactive human 2FA. Ordinary
  coordinated releases do not.

## 5. Release-set inventory (frozen; AMENDED 2026-09-26, §14)

The canonical inventory is derived from the publishable manifests under
`packages/*/package.json` and MUST remain exactly the recorded 15-package
(AMENDED 2026-09-26: 13 → 15; see §14) `@victframework/*` set (`npm run
verify:release-set` is the enforcing
gate; its rules — one coherent version, exact internal pins, recorded
content-derived identity, public access, Apache-2.0, Node engines — are
incorporated here by reference and unchanged).

Dependency-topological publication order (frozen; derived from the
manifests' internal dependency graph):

```text
 1. @victframework/contracts
 2. @victframework/sdk
 3. @victframework/kernel
 4. @victframework/runtime
 5. @victframework/store-sqlite
 6. @victframework/application
 7. @victframework/ui                    (ADDED 2026-09-26, §14)
 8. @victframework/ui-svelte             (ADDED 2026-09-26, §14)
 9. @victframework/renderer-svelte
10. @victframework/appdata-sqlite
11. @victframework/scaffolder
12. @victframework/control
13. @victframework/mastra
14. @victframework/server
15. @victframework/cli
```

## 6. Trigger and release inputs (frozen; AMENDED 2026-09-26, §14)

* Trigger: **`workflow_dispatch` ONLY.** No push-, tag-, or
  schedule-triggered publication exists.
* Inputs (all validated; the run fails closed on any violation):
  * `source_sha` (required) — the EXACT pushed release-source commit, full
    40-hex SHA-1. The run checks out and verifies exactly this commit.
  * `version` (required) — the coordinated release-set version; must equal
    the ONE coherent version of all 15 manifests (AMENDED 2026-09-26:
    13 → 15; see §14) at `source_sha`.
  * `npm_tag` (required) — closed vocabulary, see §7.
  * `resume_from_package` (optional) — the first NOT-yet-published package
    of a partially published release; see §10.
* Source-SHA validation: `source_sha` must resolve to a commit object,
  must be checked out exactly, and must belong to the permitted MAIN
  LINEAGE — i.e. be an ancestor of `origin/main` after a fresh fetch.
  A SHA from any other lineage is refused before any registry call.
* Immutability: the release set is built, checked, and published as ONE
  coordinated unit from that exact SHA. No overwrite, no re-publish, no
  unpublish of an existing version, ever. The requested `version` must be
  UNPUBLISHED for all 15 packages (AMENDED 2026-09-26: 13 → 15; see §14)
  before any publish (or satisfy the §10
  resume proof).

## 7. Candidate and stable release strategy (frozen; version-based)

Version-based releases replace the old publish-then-promote model. There
is NO manual dist-tag promotion step and NO separate dist-tag mutation
command anywhere in the workflow (npm trusted-publisher authority covers
`npm publish`; package-governance commands are out of scope).

Closed tag rule (everything else is refused):

| Requested version shape | Allowed `npm_tag`            | Meaning |
|-------------------------|------------------------------|---------|
| `X.Y.Z-rc.N` (N >= 1)   | `vict-X.Y.Z-rc`              | pre-verification audit candidate; never `latest` |
| `X.Y.Z` (no prerelease) | `latest`                     | verified stable release |

* A candidate is an immutable version `0.x.y-rc.N` published under the
  non-latest candidate tag `vict-0.x.y-rc`; `latest` never moves to a
  candidate.
* A stable release is a NEW immutable version `0.x.y` published directly
  under `latest` after independent verification of the candidate — no
  later tag promotion is required, and a stable version is never a moved
  tag on candidate content.

## 8. Authoritative in-workflow checks (frozen; AMENDED 2026-09-21, §8.1;
AMENDED 2026-09-26, §14)

The workflow runs the repository's authoritative release checks against
the exact checked-out `source_sha` before any registry write, in this
order:

1. input and lineage validation (§6) and release-set coherence
   (`npm run verify:release-set`);
2. `npm ci` (locked graph, fresh);
3. `npm run format:check`, `npm run lint`, `npm run typecheck`;
4. `npm run build` — all 15 packages (AMENDED 2026-09-26: 13 → 15; see
   §14; AMENDED: moved ahead of the full suite; see §8.1);
5. `npm test` — the full suite, once;
6. `npm pack` of all 15 packages (AMENDED 2026-09-26: 13 → 15; see §14)
   — ACTUAL tarballs, then inspection:
   identity read from inside each tarball against the workspace manifests
   (canonical npm-pack naming), and a content scan per §9;
7. `npm run verify:release-consumer` — the isolated packed-tarball
   consumer proof (exact versions, lockfile integrity, no monorepo
   leakage, strict typecheck, runtime + renderer composition).

Any non-zero result fails the run before publication. No failure is
rerun, retried, or downgraded to a warning.

### 8.1 Amendment (2026-09-21): build before the full suite

**Defect observed (release runs 35530469973, pre-publication):** the
repository's permanent cross-process durability fixtures (the Stage 05
`ReadyChild`/`sigkill-worker` pattern: `agent-profile-identity`,
`agent-governance-corrective`, `restart-sigkill`, and the scaffolder's
real generated-project build) spawn REAL child node processes that import
the workspace packages through their BUILT `dist/` outputs. Vitest's
source aliases cover only in-process imports; a spawned child resolves
through `node_modules` and requires a prior build. With the ladder's
original order (`npm test` before `npm run build`), the full suite is
NOT self-contained on a clean machine and fails with `Cannot find module
.../dist/index.js` — six genuine fixture failures, zero product defects.
Development machines always carried a stale `dist/`, which masked the
defect; the first clean-runner execution exposed it.

**Amendment:** the ladder order becomes build (4) → full suite (5), as
restated above. The semantic guarantee is unchanged and strengthened:
every check still runs against the exact checked-out `source_sha`, the
suite still runs exactly once, and any failure still fails the run
before publication.

## 9. Tarball content scan (frozen)

Every actual tarball is scanned before publication and must contain NONE
of: credential material (tokens, `.npmrc`, key/token/secret filename or
content patterns), local absolute paths (`C:\`, drive letters, `/home/`,
`/Users/`, the build agent's workspace path), workspace/protocol
references (`workspace:`, `file:`, `link:`), repository-only material
(`.pi`, test directories, dotfiles, examples, packs, scripts, docs), and
any file outside the manifest's declared `files` surface. The scan fails
closed with named findings; it never warns-and-continues.

## 10. Publication, partial failure, and resume (frozen; AMENDED
2026-09-26, §14)

* Publication uses the EXACT packed and verified tarballs, in the §5
  topological order, `npm publish <tarball> --access public --tag
  <npm_tag>` against `https://registry.npmjs.org/`, with the OIDC
  credential obtained automatically (no `NODE_AUTH_TOKEN`, no npm secret,
  no token-bearing `.npmrc`).
* Concurrency: the workflow declares a single `concurrency` group
  (`vict-release-set-publication`, `cancel-in-progress: false`) so two
  releases can never publish simultaneously.
* On any publish failure the run STOPS IMMEDIATELY, reports the exact
  published subset and the unpublished remainder, and exits non-zero.
  Successful publications are NEVER unpublished, rolled back, or mutated.
* Safe resume: an optional `resume_from_package` input names the first
  unpublished member. With it, every member BEFORE the resume point must
  ALREADY exist in the registry at exactly the requested version AND its
  registry `dist.integrity` must EQUAL the SHA-512 integrity of the
  locally packed tarball (byte-identical artifact proof); every member at
  or after the resume point must be unpublished. Any mismatch fails the
  run closed. Without the input, all 15 must be unpublished (AMENDED
  2026-09-26: 13 → 15; see §14).
* Post-publication verification (same run): per-package registry reads
  prove version existence, `dist.integrity` equality with the packed
  artifact, and the expected dist-tag state; then
  `npm run verify:release-consumer -- --registry` re-runs the isolated
  consumer install from the public registry. Any mismatch fails the run.
* The run records: all package names, versions, integrity values, source
  SHA, release-set identity (`vict-release-set@1/<version>` +
  content-derived ID), publication order, and registry results, as a
  GitHub step summary and a run artifact (JSON). Nothing sensitive is
  recorded (no tokens, no OIDC values).
* A validation-only run (any dry/validate mode) proves the pre-publication
  chain ONLY; it must never be described as proof that OIDC publication
  works. The first real OIDC publication proof is the resumed VICT-M-1
  candidate release.

## 11. One-time trust bootstrap (frozen; performed once; AMENDED
2026-09-26, §14)

* Tool: `scripts/trust-bootstrap.mjs` — derives the exact 15-package
  (AMENDED 2026-09-26: 13 → 15; see §14) inventory from the canonical
  manifests, in §5 topological order, and
  configures each package with the official `npm trust github` interface
  (npm >= 11.15.0) to trust EXACTLY:
  * repository `radz2291/vict-02`,
  * workflow filename `release.yml`,
  * permission `--allow-publish` (direct `npm publish`),
  * NO environment, NO unrelated provider/repository/workflow.
* Safety: exact package allowlist (15 as of the 2026-09-26 amendment,
  §14; anything else aborts); fixed
  deterministic order; two-second delay between registry requests;
  `spawnSync` argument arrays only (no shell interpolation of any value);
  no token input, output, storage, or `.npmrc` inspection; stops at the
  FIRST failure; after configuration, verifies EVERY resulting trust
  relationship; idempotently skips an already-EXACT relationship; REFUSES
  (never auto-replaces) an existing conflicting relationship.
* The script defaults to a dry structural plan; registry mutation happens
  only behind an explicit execute flag, and only after `release.yml`
  exists on the pushed GitHub repository (the script refuses otherwise).
* One-time human ceremony (bounded five-minute window): the operator
  stays at the computer; if the npm web session has expired, ONE official
  interactive web login is initiated (never a password/OTP/token in
  chat); the FIRST `npm trust github` request triggers the npm 2FA
  challenge completed by the human in the official npm flow; the human
  selects npm's option to skip repeated 2FA for the next five minutes;
  the script then configures the remaining packages automatically; all
  15 relationships are verified inside the window (AMENDED 2026-09-26:
  13 → 15; see §14 — the completed historical ceremony covered the
  original 13 and is preserved as history). The human never
  performs 15 separate manual package configurations. If npm does not
  offer the five-minute skip, the script stops after the first package
  and the exact non-sensitive behavior is reported so the plan can be
  revised. No granular bypass-2FA publishing token is created as a
  workaround or as the permanent solution.

## 12. Permanent verification requirements (frozen)

* After the bootstrap, every package's trust relationship is verified
  through `npm trust list` (or the supported registry interface) to be
  EXACTLY: GitHub provider, repository `radz2291/vict-02`, workflow
  `release.yml`, publish permission granted, no environment.
* Authentication is NEVER proven by publishing a probe package or a new
  version. The first real OIDC publication proof occurs during the
  resumed VICT-M-1 candidate release.
* `npm whoami`/local npm authentication is NO LONGER a release-preflight
  requirement: the local machine develops, verifies, commits, and pushes
  the immutable release source; GitHub Actions re-checks the exact pushed
  source, obtains short-lived OIDC authority, and publishes the set.
* Release-policy documentation (current docs only; historical reports
  remain untouched) must describe exactly this model and must NOT require
  local `npm whoami`, long-lived tokens, per-package OTP, or local
  execution of the final publication loop for ordinary releases.

## 13. Phase 0 baseline record (observed, at freeze time)

* Local toolchain: Node v22.13.1, npm 10.9.2 (the bootstrap therefore runs
  its trust commands through an explicitly resolved npm >= 11.15.0 and
  refuses the active npm if it is older).
* Existing workflows: none (no `.github/` directory existed at freeze
  time). Existing release scripts: `scripts/publish-release.mjs` (local,
  dry-by-default publish loop — retained as the same fail-closed engine
  for operator-run publication, no longer the ordinary path),
  `scripts/check-release-set.mjs` (`verify:release-set`),
  `scripts/verify-release-consumer.mjs`,
  `scripts/lib/tarball-set.mjs`, `scripts/lib/import-scan.mjs`.
* Trusted-publisher state at freeze time: no `@victframework/*` package
  has (or can have) a relationship to the workflow of §2 — the workflow
  did not exist. All historical publications used local interactive
  WebAuthn 2FA per the historical reports; no trusted-publisher
  configuration is recorded anywhere. `npm trust list` is
  authentication-gated, so the authoritative per-package confirmation of
  "no pre-existing relationship" is performed by the bootstrap's
  pre-check step during the one-time ceremony.
* Historical documents that mention `npm whoami` (the 0.1.1 and 0.2.0
  release reports) are HISTORICAL REPORTS and are preserved unchanged.
  The only current release-path document at freeze time,
  `docs/RELEASE-COMPATIBILITY.md` §6, is reconciled by this task.

## 14. Amendment (2026-09-26): 15-package release set

**Cause observed (P1–P5 UI foundation phases; independently verified):**
the repository gained two publishable packages — `@victframework/ui`
(neutral, renderer-agnostic UI vocabulary, no dependencies) and
`@victframework/ui-svelte` (the permanent Svelte `ApplicationRenderer`).
P5 independently established (`qa/ui-foundation-p5`, verdict **P5
ARCHITECTURE VERIFIED — release integration permitted**;
`qa-artifacts/p5-qa/P5-QA-REPORT.md`) that `@victframework/ui-svelte` is
the single permanent Svelte renderer implementation and
`@victframework/renderer-svelte` is a pure compatibility facade whose
only dependency is `ui-svelte`. `renderer-svelte` REMAINS in the release
set during its documented compatibility/deprecation window: the amended
coordinated set is 15 packages, NOT 14. The repository now contains
exactly 15 publishable `@victframework/*` manifests (all `private=false`
with `publishConfig.access=public`, one coherent version `0.3.1`; the
workspace-only `@victframework/builder-kit` is `private:true` and is not
a release-set member). Against the un-amended frozen rule, the
release-set gate fails closed BY DESIGN (inventory derives 15 members vs
the recorded 13; the `renderer-svelte → ui-svelte` and `ui-svelte → ui`
edges reference packages that were not release-set members) — exactly
the amendment trigger this contract's amendment rule anticipates; the
failures are the frozen semantics working, never a silent
reinterpretation.

**Amendment (the semantic rule changes as follows; nothing else in this
contract changes):**

1. **Inventory (§5):** the coordinated release set is amended from the
   recorded 13-package set to exactly 15 packages by ADDING
   `@victframework/ui` and `@victframework/ui-svelte`. No member is
   removed.
2. **Publication order (§5):** the frozen dependency-topological order
   becomes the 15-entry order restated in §5. It was verified at
   amendment time against the ACTUAL manifests' internal dependency
   graph: `ui-svelte` depends on `application`, `sdk`, and `ui`;
   `renderer-svelte` depends on `ui-svelte`; `ui` itself has no internal
   dependencies, so it is placed immediately before its only internal
   dependent (`ui-svelte`, position 8), preserving the original 13-entry
   order everywhere else. The order is a valid topological linearization
   (no member publishes before any package it depends on).
3. **Derived counts:** every count derived from the inventory changes
   with it — manifests metadata proof (§1), workflow-rename blast radius
   (§2), coherent-version check (§6), unpublished-set check (§6, §10),
   build/pack counts (§8), and the bootstrap allowlist (§11) — all now
   mean 15.
4. **Trust semantics (§11):** the original one-time ceremony configuring
   the original 13 relationships was completed on its historical date and
   is preserved as history; it is neither repeated nor rewritten. The
   amended inventory means the bootstrap tool (once its implementation is
   amended) derives a 15-package allowlist: the existing 13 EXACT trust
   relationships are idempotently skipped (never replaced), and the two
   new packages are configured through the same official `npm trust
   github` interface with the same repository/workflow/permission
   constraints and the same verification requirements. This is an
   EXTENSION of trust to new members of the set — a second one-time
   ceremony is NOT required, and no existing relationship is mutated.
5. **Historical record preserved:** §8.1 (the 2026-09-21 build-order
   amendment) and §13 (the freeze-time baseline record) are untouched.
   Statements that were true of the 13-package state on their historical
   dates remain true as history; only normative present-tense rules are
   restated to 15.

**Implementation consumption status:** at the time of THIS amendment
commit, NO implementation consumes it — per the amendment rule, the
consuming implementation must come in a separate later commit.
Specifically, `scripts/lib/release-set.mjs`
(`EXPECTED_RELEASE_PACKAGE_COUNT`, `FROZEN_PUBLISH_ORDER`), the
trusted-publishing tests, `release.yml` inventory expectations,
`docs/RELEASE-COMPATIBILITY.md`, the release-set content ID, and the npm
trust state still enforce the 13-package rule and MUST be amended by that
follow-up implementation work. Until then, release-set verification
currently fails against the frozen 13-package expectations — which is the
EXPECTED and CORRECT state between this amendment and its consuming
implementation.

**Explicitly unchanged by this amendment:** the trusted repository
identity (§1 repository), workflow filename (§2 `release.yml`), runner
and toolchain pins (§3), OIDC permission model and no-secret policy (§4),
candidate/stable tag strategy (§7), tarball content-scan rules (§9),
publication/resume/integrity semantics (§10), permanent verification
requirements (§12), and the release-set content-ID scheme (owned by the
implementation, not this document).
