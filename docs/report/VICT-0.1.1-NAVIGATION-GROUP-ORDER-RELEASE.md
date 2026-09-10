# VICT 0.1.1 — Navigation Group Order Coordinated Release Record

> **Class:** coordinated public release record (reference §0.15; the
> publication act authorized by the independent verification verdict
> `VERIFIED WITH NON-BLOCKING ISSUES — RELEASE PREPARATION PERMITTED`).
> This is a release-publication record, not an implementation or
> remediation record: the verified navigation implementation was NOT
> changed. All 13 `@victframework/*` packages were published at exactly
> `0.1.1` from frozen artifacts of the release-preparation commit, and
> the new immutable release identity is live and consumer-proven.

## 1. Exact SHAs and state reconciliation

| Item | Value |
| --- | --- |
| Starting SHA (`HEAD == origin/main` after fetch; clean tracked tree) | `02dbf40d27eb8df9afbb1dc14b83ce52feeebe52` |
| Independent-audit commit and verdict | `02dbf40d27eb8df9afbb1dc14b83ce52feeebe52` — `docs(report): record navigation-order verification` — verdict `VERIFIED WITH NON-BLOCKING ISSUES — RELEASE PREPARATION PERMITTED` |
| Lineage verified before work | `e70b1a876bf7f4bad83a611f5333d86541a0b664` (baseline) → `4fdabe21449740bfce61242b3480331215c64f97` (implementation) → `13b4ef2a97d53560016b8d9771bb4847a84d5cf9` (implementation documentation) → `02dbf40…` (independent verification), each confirmed an ancestor of HEAD |
| Remote state at start | after `git fetch`: `origin/main == HEAD == 02dbf40…` — the remote had NOT advanced; no intervening changes existed |
| Release-preparation commit (= declared release source) | `2c8a7fb5c264c337ae8474603e693bfb19394d1e` — `chore(release): prepare VICT 0.1.1` (24 files: 13 package manifests, workspace lockfile, 4 workspace-private example/pack manifests for lockfile coherence, `scripts/verify-stage6a.mjs` pin reference, `scripts/benchmark.ts` version label, `docs/RELEASE-COMPATIBILITY.md`, `docs/VICT-SYSTEM-REFERENCE.md` v0.4.5) |
| Push | normal fast-forward `02dbf40..2c8a7fb main -> main` BEFORE publication; the working tree at publication was exactly this commit (only the pre-existing untracked `.pi/` material present) |
| Final documentation commit | this commit — `docs(release): record VICT 0.1.1 publication` (System Reference v0.4.6 with §0.15, RELEASE-COMPATIBILITY live-status reconciliation, §24.4 evidence entries, this report) |
| Working tree at documentation commit | only the pre-existing untracked `.pi/` material, byte-untouched throughout |
| Environment | Windows 11 (win32-x64), Git Bash, Node v22.13.1, npm 10.9.2 — the declared release environment |

## 2. Release decision — version 0.1.1

| Check | Result |
| --- | --- |
| Public npm registry (fetched at preparation, re-confirmed immediately pre-publication) | all 13 packages exposed exactly `["0.1.0"]` with `dist-tags.latest = 0.1.0` and no other dist-tags — `0.1.1` was UNUSED for every package; no version was overwritten, unpublished, or assumed |
| Repository release policy | release-set identities are immutable; a new version creates a NEW set identity (`docs/RELEASE-COMPATIBILITY.md` §2); no Git tag convention exists (`git tag -l` empty; confirmed again this release — no tag created) |
| SemVer impact | the correction is a source/behavior correction restoring an EXISTING contract: no API, schema, plan-shape, or identity change (independent verification §15: "a patch release is the appropriate vehicle under repository policy"); `0.x` semver communicates the pre-1.0 posture; exact pins protect consumers |
| Coordinated set rule | one exact version across all 13 members; every internal dependency an exact pin; the set-consistency checker gates the release |
| Decision | **0.1.1** — patch release of the complete 13-package set, as a new immutable identity; `vict-release-set@1/0.1.0` never mutated |

## 3. Release-set identity (computed, not invented)

```text
identity  : vict-release-set@1/0.1.1
contentId : v1_e31e8dd60d05e1d6feb08b5ed0874cceae561bdf10e08d8b93e07840de8d9cdf
algorithm : sha256 over the sorted newline-joined 'name@version' list of the exact member set, prefixed v1_
```

Computed three independent ways with identical results: (1) an
independent implementation of the documented algorithm run before any
manifest was touched (it also reproduced the recorded `0.1.0` content ID
`v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d`
exactly, validating the implementation); (2) the canonical checker
`npm run verify:release-set` after the manifest advance; (3) the same
checker again inside the clean-checkout verification ladder.

## 4. Frozen release artifacts (the exact published bytes)

Built from the clean checkout of `2c8a7fb…`, packed once, frozen in a
temporary release directory, SHA-256-verified unchanged immediately
before publication, and published by exact tarball path:

| Package | Tarball SHA-256 | `dist.integrity` (sha512, == frozen) |
| --- | --- | --- |
| @victframework/contracts | `1484a7b7a7f81ff0d85b73c28e29cb28598e28e3f6463bbcaadd1c60e58bca85` | `sha512-wkv784fL7fA/csQpjTKLjIOJIPuSoktd1mWap08EEdJoHIrNh7g+pVnvgFlfyPHF0CkCD13ufiCHXRcdPqKd3A==` |
| @victframework/sdk | `5c18bf854092044d83296832c6b6155106241914b3699c80ef5ef523a789a7c6` | `sha512-UZnoT2Mq2Nf1DocHcFCwjHxwHAbY2c7jB+sR8P1r4SsVdjX0ZrfyWNQUp4eW4kseX13kq93RdJnOYitMNEFofA==` |
| @victframework/kernel | `8e540c9fffa8909c94ff5beccd785841a143868cbb8ce7a4fd8a1a9745c768df` | `sha512-Csj3doHd6K4jYda+vHVtIASnVMr/QyhxrjhcYyq3xmwoeVKON8Y2uE6k3/AOcjuzr20aGTDxeXO/8HX/VOWGtw==` |
| @victframework/runtime | `1cb782a970aa26e271a9ca1c60367d669980e28f227c29b1245b8ba22e92910c` | `sha512-as93AwlHqVeiQrmUP+wWjYRaAws4upAvM0mabgRHe3NzhpIPd+y660mwIPc2ov31wFVhsJ3W7FYWzNKHwvs0Ww==` |
| @victframework/store-sqlite | `1dc6065995d2b3cbd0c27125b50f2b00753e340e1413395c576d7771247ff213` | `sha512-Y+32C/j/17TaoGVO6qNYCiMQavTgKJ4OB58MUdsB/O0nqdvJ5fIMe/iGSdeNSTMkGqTgIV0806aDd8MGI+p4IA==` |
| @victframework/application | `b2f787db3c9cf694128c11722b8bf7edee3b25a4acbf9c92afb3453c4428fb11` | `sha512-R80yqpX4xzWAYEgzBU1CTziwT8MjHhOC0lco0Q7rMovR/cI++pObJRDmRC7bgVb4FNut44YW5KXsDM9l+2q0bA==` |
| @victframework/renderer-svelte | `e0e46fe9ec7e20980afd22be9359f064ef7f2107c42dae7fda4bd16680bd234d` | `sha512-9Fvtz3hyRmjtqWnp+DSEAKGzcu/wnsdimSRInJPqSkfMMgDQdPXDT3OMdkQ5jlGjZ3dqwGEut84P/l9Pjsz23w==` |
| @victframework/appdata-sqlite | `e2914799bedafafe1fd3a3de24d39e3d0e992a7ecfdd85b57098f585ed6bf469` | `sha512-jeZXxMOrQgCkyZHGlrg6s7QlBS53hdZNQstbPLvYMf18KkEASaPtl/G6fDfNCoXE5x3muqIdOSwOo0EcxBuMkg==` |
| @victframework/scaffolder | `7d0dbd74ab3ed689a89e87fa80dba269568a097647881107917bf3a5b26195d7` | `sha512-UBsLvkXzhCFG1zc2oZ+GaMNwh3nclsulb72egGOG7wm525niYOLCJmDGb4hGQCr2DypTzHVxCwdfTulspQwwJw==` |
| @victframework/control | `0fcf5afce49112dbfa55199824b7c851e80d0260aaf7cc0b682f0fc3d775ae89` | `sha512-T+UcESX/+HWLyCNPYXSbOHTMxnbi5sVr4J+uplc21Q60RRWk/siFFFVqk0LbTuoufbdtcxES5+ddlLfJcI8EmA==` |
| @victframework/mastra | `f8b4de342fc602b48619fdce8be8bb312743362c5aecf4b7e815094000855763` | `sha512-tAySpBTGwbGXC0eCVHTF5jsbtyvFU4v0Y7t9fIHmAjpom5wuWz1Qq+/HhYiJPv70M6K4jOBWnbzkdh6DdVPJXw==` |
| @victframework/server | `28b9ab3dfbb0861a736d10100e505d18b133e836227fe08fa7bc7afbd3829935` | `sha512-FIVw/BfxpEGzBAY8SNId5y+ti65UG5R+QtOzpUqS5knxc+TA/C4hi2VX8C/RZfPyelC2aWeD3V+yRfC91Ma4+g==` |
| @victframework/cli | `2bd6e3ba865a6af6b926f5ff009a4f9551db9dd6b7d6090ba2fb575ef20d22d3` | `sha512-KyH/r0CfH2i3deAZBF7WJB78JNBH0Xs+FQAf7oyfWVY5z8IoU3MJoObMGw71yGpdd2WfWDSlTCcKNM/bVNCswA==` |

Freeze inspection (all 13 unpacked and scanned): file inventories are
exactly the published `0.1.0` layouts (contracts 31, sdk 25, kernel 31,
runtime 115, store-sqlite 22, application 28, renderer-svelte 14,
appdata-sqlite 13, scaffolder 7, control 13, mastra 34, server 16,
cli 14 files); no `.npmrc`, no `.pi`, no databases/SQLite artifacts, no
test directories, no developer absolute paths, no repository-specific
paths, no credential-shaped content (remaining canary-like tokens are the
documented conformance-fixture identifiers in the `testing`/conformance
modules, present and independently classified in `0.1.0`); every emitted
entry point present; all internal pins exact `0.1.1`; no
`workspace:`/`file:`/`link:`/git specifier in any packed manifest. The
navigation correction is PROVEN inside the renderer tarball: the shipped
`src/VitApp.svelte` contains the unkeyed outer each and the
first-occurrence derivation, and neither the alphabetical group sort nor
the keyed outer each.

## 5. Pre-publication verification (clean checkout of `2c8a7fb…`)

Authoritative ladder — isolated `git worktree` at the release commit,
fresh `npm ci`, one pass each, no rerun to mask a failure, no timeout
increased, no assertion weakened, no diagnostic suppressed:

| # | Command | Exit | Evidence |
| --- | --- | --- | --- |
| 1 | `npm ci` | 0 | clean install from the committed lockfile |
| 2 | `npm run format:check` | 0 | all files Prettier-clean |
| 3 | `npm run lint` | 0 | ESLint clean |
| 4 | `npm run typecheck` | 0 | strict `tsc --noEmit` clean |
| 5 | `npm run build` | 0 | all 13 packages build |
| 6 | `npm test` | 0 | **first-run green: 116 files passed + 1 skipped (117); 2184 tests passed / 3 skipped (2187)** — the 3 skips are the documented POSIX-only `packages/mastra/test/storage.permissions.posix.test.ts` suite (`describe.skipIf(process.platform === 'win32')`) |
| 7 | `npm run verify:stage5` | 0 | ALL CHECKS PASSED — full build, complete suite, warning-free reference build, real-process HTTP restart, REAL-browser desktop + mobile with axe accessibility (44/44), packed-consumer scaffolder verification |
| 8 | `npm run verify:stage6b` | 0 | ALL GATES PASSED; truthful Stage 06 closed banner |
| 9 | `npm run verify:stage7a` | 0 | ALL GATES PASSED (namespace, release-set, N-1, operator-config, H-1, manifest hygiene) |
| 10 | `npm run verify:n1` | 0 | ALL CHECKS PASSED (16/16 emitted-package checks) |
| 11 | `npm run verify:release-set` | 0 | ALL CHECKS PASSED — 13 packages, `0.1.1`, `v1_e31e8dd6…` |
| 12 | `npm run verify:clean-clone` | 0 | fresh clone of the committed state: `npm ci` → typecheck (zero artifacts) → build → `verify:stage6b` ALL GATES PASSED |
| 13 | `npm run example` | 0 | offline proof end-to-end (`run.completed`) |
| 14 | `npm run example:application` | 0 | application-proof build + 17/17 tests |
| 15 | `npm run bench` | 0 | benchmark notes/limits unchanged |
| 16 | `npm audit --omit=dev` | 0 | found 0 vulnerabilities |
| 17 | `git diff --check` | 0 | no whitespace/conflict markers |

Additional pre-publication gates:

- Focused navigation suite: `npx vitest run --project renderer test/navigation-group-order.test.ts` — **9/9 passed**.
- Full renderer project (`--project renderer`): **4 files / 54 tests, all passed** (shared renderer-conformance suite, "accessible defaults", heading-levels accessibility suites).
- Release-set checker negative controls (temporary scratch copies of the manifests + checker + compatibility document only): a corrupted internal pin (`runtime → contracts 0.1.0`) → `FAIL` and **exit 1**; additionally drifting one member version (`cli 0.2.0`) → **6 FAILs and exit 1**. The checker demonstrably fails closed.
- `npm run verify:release-consumer` (tarball mode) — ALL CHECKS PASSED (exit 0): exact recorded versions, lockfile integrity present, no-monorepo-leakage probes, strict `skipLibCheck:false` typecheck of the full 13-package public surface, real-SQLite runtime composition with close/reopen, Application Definition compile + renderer composition headlessly.

## 6. Publication (safe, topological, frozen artifacts only)

- **Authority:** npm user `rz1`, owner of the `victframework`
  organization (verified read-only via `npm whoami` and
  `npm org ls victframework` — both confirm `rz1 - owner`). 2FA
  `auth-and-writes`.
- **Authentication method:** every registry write (each of the 13
  publishes and each dist-tag operation) required the supported
  interactive WebAuthn confirmation, completed by the owner in the
  browser at npm's auth URL. No password, OTP, token, recovery code, or
  `.npmrc` content was requested, accepted, printed, stored, or
  transmitted; no 2FA-bypass token was created.
- **Dist-tag strategy:** each package was published with a temporary,
  unique candidate tag `vict-0.1.1-rc` (`npm publish <frozen.tgz> --tag
  vict-0.1.1-rc --access public --registry https://registry.npmjs.org`),
  so `latest` remained at the complete `0.1.0` set during the entire
  publication window. After all 13 exact versions were independently
  confirmed, `latest` was advanced to `0.1.1` on every package
  (`npm dist-tag add @victframework/<pkg>@0.1.1 latest`), and only then
  was the candidate tag removed (`npm dist-tag rm`); no temporary tag
  remains.
- **Order:** dependency-topological — `contracts → sdk → kernel →
  runtime → store-sqlite → application → renderer-svelte →
  appdata-sqlite → scaffolder → control → mastra → server → cli`.
- **Existing-version guard:** every `@victframework/*@0.1.1` was
  verified unused immediately before publication; no overwrite,
  unpublish, or re-publish occurred.
- **Per-package confirmation:** after publication, each of the 13 was
  independently re-read from the registry: version `0.1.1` exists,
  `dist.integrity` EQUALS the frozen artifact's integrity, the packed
  manifest fields are correct (Apache-2.0, `engines.node >=22.13.0`,
  `publishConfig.access = public`, exact internal pins), and the
  downloaded registry tarball bytes recompute to exactly the frozen
  artifact's SHA-512 — **13/13 verified, byte-identical**.
- **Partial-failure handling:** the publication completed as one
  sequential run; no stop occurred, so no partial state ever existed.
  Had a stop occurred, the procedure (same frozen artifacts, resume from
  the first unpublished package) was armed and no rebuild or republish
  would have been performed.

## 7. Post-publication registry verification (13/13)

For every package, independently retrieved from
`https://registry.npmjs.org/`: visibility public (unauthenticated
metadata + tarball fetch), exact version `0.1.1`, `dist-tags.latest =
0.1.1` (all 13 agree; candidate tag absent everywhere), `license:
Apache-2.0`, `engines.node >=22.13.0`, all internal `dependencies` and
`peerDependencies` exact `0.1.1` pins with no
`workspace:`/`file:`/`link:`/git/local-path specifier anywhere, correct
registry tarball URL, complete `dist.integrity` equal to the frozen
value, and full tarball inventory re-unpacked from the downloaded bytes.

- `0.1.0` remains published, available, and byte-integrity UNCHANGED —
  every package's `0.1.0` `dist.integrity` re-verified against the
  Stage 07A independent-verification record's values.
- Browser safety re-confirmed from the published artifacts:
  `contracts`, `sdk`, `application` contain no `node:` imports;
  `renderer-svelte` depends only on `application`/`sdk` with `svelte` as
  a peer.
- The `resolved` URL form in consumers' lockfiles
  (`…/@victframework/<pkg>/-/<pkg>-0.1.1.tgz`) is exactly the form the
  registry recorded for `0.1.0`.

## 8. Clean external-registry consumer proof (independent)

A completely fresh consumer OUTSIDE the VICT repository
(`vict-consumer-011` in the system temp directory), with an empty npm
cache, explicit `--registry https://registry.npmjs.org`, and exact
`@victframework/*@0.1.1` dependencies for all 13 packages — no workspace
inheritance, no local VICT resolution:

1. **Install exclusively from the public registry** — succeeded for the
   complete 13-package release set.
2. **Lockfile proof:** every `@victframework/*` entry resolves to the
   public registry tarball URL at exactly `0.1.1` with `integrity` equal
   to the frozen artifact; zero `file:`/`link:`/`workspace:`/`git`
   resolutions; no monorepo path appears anywhere; installed-package
   realpaths stay inside the consumer directory.
3. **Strict TypeScript compilation** — `tsc` with `strict`,
   `skipLibCheck: false`, `exactOptionalPropertyTypes`,
   `noUncheckedIndexedAccess`, `verbatimModuleSyntax` over the
   documented public entry points of the installed packages — exit 0.
   (`@victframework/mastra` is installed and registry-verified but kept
   out of the strict surface: importing its types hits the documented
   upstream `@mastra/*` declaration defects — Stage 07A finding F-5.)
4. **Minimal runtime execution on real SQLite** — contract + capability
   + graph run `completed` with truthful output; store closed; reopened
   with exact-activation restoration and a truthful run record
   (`CONSUMER_RUN_OK` / `CONSUMER_REOPEN_OK`).
5. **Application Definition compilation** — a five-group definition
   compiles through the installed `@victframework/application`.
6. **Renderer composition + NAVIGATION-ORDER PROOF** — the real renderer
   mounted from the installed `@victframework/renderer-svelte` (happy-dom
   + Svelte 5.57.0 peer): **2/2 tests passed**, asserting (a) the exact
   group sequence `#Research → #Practice → #Operate → #Review → #System`
   in declared first-occurrence order — NOT the alphabetical order the
   baseline would have produced — and (b) `nav.order` ordering within a
   group plus the deterministic path tie-break when hints are equal or
   absent, with the single `nav[aria-label="Application"]` landmark.
7. **Emitted-artifact proof** — every executed `@victframework/*` module
   resolves by realpath into the consumer's own `node_modules` (the
   registry artifacts), never into a source checkout.
8. **Negative control** — a separate consumer with a separate empty
   cache and the registry deliberately unavailable via command-scoped
   configuration (`--registry http://127.0.0.1:9/`): installation FAILED
   truthfully (npm error), produced no lockfile, and installed no VICT
   packages — no fallback to the monorepo, another cache, or any other
   source.

## 9. Audit-finding reconciliation (IV-1 through IV-6, exact severities and dispositions)

| ID | Audit severity | Disposition in this release |
| --- | --- | --- |
| IV-1 | **Medium, non-blocking — documentation truthfulness** | **Resolved in active normative documentation only.** The blanket reactive-recalculation sentence in `docs/VICT-SYSTEM-REFERENCE.md` §17.3 is qualified to its verified scope (v0.4.5): shape-preserving plan updates (group permutation, label rename) recalculate without remounting; shape-changing updates are excluded and cross-referenced to IV-2. The historical implementation and independent-verification reports were NOT edited. |
| IV-2 | **Medium, non-blocking — pre-existing defect, newly documented** | **Carried as known framework debt — NOT fixed, NOT claimed fixed, severity unchanged.** Recorded in §17.3 and in this report: adding, removing, or structurally resizing navigation groups during reactive plan replacement is NOT guaranteed by this release (insert can lose the following group's label; remove can leave a stale duplicate label; a member-count-growing swap can empty the nav). The defect class predates the correction (also present in the baseline keyed implementation); the correction neither introduced nor worsened it. Static navigation structures and independently verified shape-preserving group permutations ARE supported. |
| IV-3 | **Low — test coverage** | **Carried, truthfully recorded.** No shape-changing-reactive-update coverage was added (that would be remediation beyond this release's boundary); the permanent suite still covers same-shape permutation/rename only. Documented in §17.3's qualification text. |
| IV-4 | **Low — renderer identity** | **Explicit owner decision recorded: RETAIN `renderer.svelte-kit@5.0.0`.** Basis: the audit's own disposition found retention consistent with documented rules (renderer identity participates only in release identity, never application identity) and with established practice (retained through earlier behavior-changing corrections); no normative rule requires a bump on renderer behavior changes; the npm package version `0.1.1` distinguishes the corrected behavior; changing the verified implementation for a non-blocking finding would violate the minimal-change release boundary. Recorded here and in the v0.4.5 header. |
| IV-5 | **Informational — documentation hygiene** | **Resolved.** The stale closing marker ("End of authoritative baseline v0.4.3") was corrected in the release-preparation commit (v0.4.5) and advances with this record (v0.4.6). |
| IV-6 | **Informational — environment** | **Observed and recorded.** The documented npm 10.9.2 `edgesOut` crash appeared during the external consumer's dev-tooling install (vitest); the release-set install itself was clean. Workaround: client-side `--legacy-peer-deps` for that one dev-tool install only — resolution still exclusively from the public registry (lockfile-proven). Also recorded: `npm pack` requires explicit `./`-prefixed package paths in this npm version (bare relative paths are misparsed as remote specs). Temporary audit/release material created by this task is removed after the record; pre-existing temp residue was left untouched. |

## 10. Dynamic navigation shape-change limitation (truthful statement)

**Adding, removing, or structurally resizing navigation groups during
reactive plan replacement is NOT guaranteed by this release.** Under
such updates the shipped renderer can corrupt the nav DOM (a missing
adjacent group label on insert; a stale duplicate label on remove; an
entirely empty nav after a member-count-growing swap). This is
pre-existing framework debt (IV-2), documented rather than remediated in
this release, and its severity is unchanged. **Supported by this
release:** static navigation structures and independently verified
shape-preserving group permutations and label renames. Definitions whose
reactive plans change the navigation shape should remount the renderer
surface across the shape change until the defect is remediated with its
own narrowly-scoped correction and permanent coverage (IV-3).

This limitation does NOT block Trading OS T1: T1's Application
Definition uses a stable route and navigation-group structure (no
reactive add/remove/resize of navigation groups), so the guaranteed
behavior — declared first-occurrence group order with `nav.order` and
the deterministic tie-break — is exactly what T1 consumes. This
reasoning is recorded here without inserting any Trading-specific
behavior into framework code.

## 11. `0.1.0` preservation and non-interaction

- **`vict-release-set@1/0.1.0` is immutable and untouched:** every
  package's `0.1.0` remains published with its `dist.integrity`
  byte-verified against the Stage 07A independent-verification record;
  no `0.1.0` artifact, dist-tag history, access, ownership, or
  organization state was mutated; nothing was unpublished; no version
  was republished. Consumers pinning `0.1.0` are unaffected; `0.1.1` is
  a new immutable identity beside it.
- **No Git release tag was created** — the repository has no tag
  convention (`git tag -l` empty before and after), consistent with the
  0.1.0 release decision.
- **Trading OS repository** (`C:/Users/RZ1/Desktop/RZ/260909-VCT-Trading`)
  was used strictly READ-ONLY at
  `22a6b34773033bc5d807b4bdd130f30240b7079d` (verified unchanged at
  start); nothing was committed, pushed, or modified there.
- **Quellight** (local directory and `https://github.com/radz2291/Quellight`)
  was never accessed or modified.
- **`.pi/` pre-existing untracked material** was preserved byte-untouched
  throughout.

## 12. Commands, exits, and observed counts (summary)

Pre-publication ladder (§5): 17/17 commands exit 0; full suite 2184
passed / 3 skipped (first-run green); example:application 17/17;
real-browser suites 44/44; focused navigation 9/9; renderer project
54/54; `verify:n1` 16/16; consumer tarball mode ALL CHECKS PASSED;
release-set negative controls exit 1 (fail closed).

Publication (§6): 13 publishes exit 0 in topological order under
`vict-0.1.1-rc`; 13 `dist-tag add latest` + 13 `dist-tag rm` exit 0;
per-package registry verification 13/13 (existence, integrity, manifest,
inventory, byte-identity to frozen artifacts).

Post-publication (§7–§8): `verify:release-consumer -- --registry` ALL
CHECKS PASSED (exit 0) — the RELEASE-COMPATIBILITY.md §6 CI gate rule is
satisfied and the set is recorded as live; independent consumer:
install from public registry only, lockfile/realpath checks all pass,
strict `tsc` exit 0, runtime run + reopen OK, navigation tests 2/2;
registry-unavailable negative control fails truthfully (no lockfile, no
packages).

## 13. GAP-CANDIDATE-2 and the Trading OS T1 gate

```text
GAP-CANDIDATE-2 — CLOSED: supplied by the released, independently
proven installable VICT release set vict-release-set@1/0.1.1.

TRADING OS T1 ENTRY GATE — SATISFIED (2026-09-10):
a released VICT version now supplies declared navigation-group ordering
(Research → Practice → Operate → Review → System renders in declared
first-occurrence order from registry artifacts, with nav.order and the
deterministic tie-break within each group), per the T1 gate in the
Trading OS roadmap, read-only at 22a6b34…

T1 HAS NOT BEGUN. The Trading OS repository was not modified.
```

The carried IV-2 shape-change limitation does not alter this
disposition: T1's Application Definition uses a stable route and
navigation-group structure (§10).
