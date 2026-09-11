# VICT 0.2.0 — Coordinated Publication and Registry-Verification Record

> **Class:** coordinated public release record (the publication act authorized
> by the independent pre-publication audit verdict
> `VERIFIED WITH NON-BLOCKING ISSUES — VICT 0.2.0 PUBLICATION PERMITTED FROM
> EXACT SOURCE 5c81aca5e7a50f8f1e1711da1630cb6167b854c0`, audit report at
> `docs/report/VICT-0.2.0-INDEPENDENT-PRE-PUBLICATION-AUDIT.md`,
> commit `a4ad735…`). This is a release-publication record, not an
> implementation or remediation record: the audited Phase F2 implementation,
> hygiene verifiers, and release-source commit were NOT changed. All 13
> `@victframework/*` packages were published at exactly `0.2.0` from the
> frozen artifacts reproduced from the exact release-source SHA, each
> byte-verified against the audited inventory before any `latest` advance,
> and the coordinated release identity is live and consumer-proven.

```text
VICT 0.2.0 PUBLISHED AND REGISTRY-VERIFIED
Stage 07C Phase F complete.
Quellight Phase Q controlled adoption permitted — not begun.
Stage 07 remains In Progress.
```

## 1. Exact SHAs, authority, and state reconciliation

| Item | Value |
| --- | --- |
| Starting VICT SHA (`HEAD == origin/main` after fetch; clean tracked tree; only pre-existing untracked `.pi/`, `CANARY-H1B-d4319803-probe.db`, `tmp-dbg.db`, `vict-debug-4QkPli/` preserved untouched) | `a4ad735ab5f16088496c45a3b3ffcd7956b739ba` — `docs(release): independently audit VICT 0.2.0 candidate` |
| **Immutable release-source commit (frozen; not altered)** | **`5c81aca5e7a50f8f1e1711da1630cb6167b854c0`** — `chore(release): prepare VICT 0.2.0`; verified an ancestor of the evidence tip before any operation |
| Independent pre-publication audit report | `docs/report/VICT-0.2.0-INDEPENDENT-PRE-PUBLICATION-AUDIT.md`; file SHA-256 at publication start `0e3dbe7edbfa539f2f30ed2747a71d5bb1942c02f2c5a01d8d3f07b8a8a37943`; unchanged (tracked-clean) throughout |
| Quellight (read-only throughout) | byte-identical at `f25b03a322868b37c9fee732a767d91d3ab63f98` (`HEAD == origin/main`; all `@victframework/*` pinned exactly `0.1.0`, registry-resolved); Phase Q NOT begun |
| Git tags | none before, none after (`git tag -l` empty; the established protocol remains tagless) |
| Environment | Windows 11 (win32-x64), Git Bash, Node v22.13.1, npm 10.9.2 — the declared release environment |
| Build/verify site | detached `git worktree` at exactly `5c81aca…` in the system temp directory; `npm ci` exit 0; `npm run verify:release-set` ALL CHECKS PASSED (13 packages, 0.2.0, `v1_7a55798…`); `npm run build` exit 0; `format:check`, `lint`, `typecheck` exit 0 |
| Publisher identity | npm user `rz1`, owner of the `victframework` organization (verified via `npm whoami` and `npm org ls victframework`; 2FA `auth-and-writes`) |

**Authentication record (owner-directed one-off approval model).** The
stored CLI credential had expired (E401). To avoid the 39 per-write browser
approvals of the 0.1.1 procedure, the OWNER created a short-lived (1-day)
**granular access token** (name-recorded, packages read-write, `@victframework`
scope) through the npm website after the owner's own browser login. That token
performed the 13 publishes and the 13 `dist-tag add` writes without further
approvals. The 13 `dist-tag rm` operations are NOT permitted to granular
tokens under the current registry policy (E403 on the DELETE endpoint) and
were executed under the owner's interactive login session, each with the
supported interactive WebAuthn confirmation completed by the owner in the
browser (13 confirmations). No password, OTP, token value, or `.npmrc`
content was displayed, stored in the repository, or recorded in any report;
the temporary token configuration file was created with owner-only
permissions outside the repository and securely deleted after publication,
and the owner is advised to revoke the granular token (it self-expires in
one day). No authentication bypass was created.

## 2. Release decision and identity

| Check | Result |
| --- | --- |
| Version | `0.2.0` — the prepared, independently audited candidate; no version bump or content decision was taken at publication time |
| Registry preflight (fresh task-specific cache; public, unauthenticated) | all 13 packages exposed exactly `["0.1.0","0.1.1"]`; `dist-tags` exactly `{"latest":"0.1.1"}`; `0.2.0` ABSENT for every package; no `vict-0.2.0-rc` tag anywhere — publication was not blocked by any collision and never overwrote anything |
| Coordinated set | `vict-release-set@1/0.2.0`, all 13 members at `0.2.0`, every internal dependency an exact `0.2.0` pin |
| Content ID | `v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172` — recomputed (a) from the workspace manifests (`verify:release-set`), (b) from the 13 frozen packed artifacts, and (c) from the registry manifests and downloaded registry tarballs after publication — all three identical |
| SemVer | additive governed mutation-input boundary (audited F2); `0.x` minor as prepared and audited |

## 3. Frozen artifacts — reproduction and byte-comparison

All 13 tarballs were rebuilt from the isolated worktree at exactly
`5c81aca…` (`npm ci` → `verify:release-set` → `npm run build` → topological
`npm pack` into one disposable frozen directory) and compared against the
audit §7 inventory BEFORE any publish. Every SHA-256 and every byte size
matched exactly; each packed manifest's inner identity is
`@victframework/<name>@0.2.0`; file inventories equal the published
0.1.0/0.1.1 layouts (contracts 31, sdk 25, kernel 31, runtime 115,
store-sqlite 22, application 28, renderer-svelte 14, appdata-sqlite 13,
scaffolder 7, control 13, mastra 34, server 16, cli 14 files); hygiene scans
found no local/workspace/`file:`/`link:`/git specifiers, no machine paths,
no credential-shaped content, no databases/logs/temp artifacts, and no
undeclared contents. This reproduction independently re-confirms the
audit's §8 reproducibility result (a different process rebuilt the same
bytes the auditor recorded).

| # | Tarball | Size (bytes) | SHA-256 |
| --- | --- | --- | --- |
| 1 | victframework-contracts-0.2.0.tgz | 24,856 | `cf542215affc9bef472c0fbf348b8a8a5945513edbbadf92c33203f8e7b0945e` |
| 2 | victframework-sdk-0.2.0.tgz | 35,099 | `142cb767e95b06b88c37e50d7de335b2e5c542baff2033552c2ddbced723489e` |
| 3 | victframework-kernel-0.2.0.tgz | 57,491 | `c3abc5df1d7175e39eeb6eb1e2f24fe387c42e744e83df30fcaaca7a4a642e2c` |
| 4 | victframework-runtime-0.2.0.tgz | 299,881 | `d3452c9db71c7562ebef4f5fc187fc0f1095522d970d3fb5f1382ddc9993ba93` |
| 5 | victframework-store-sqlite-0.2.0.tgz | 69,344 | `2268bc3d5dce9b2b8463b3c38693e4c1bef28aaed3960247544d284ff98ab850` |
| 6 | victframework-application-0.2.0.tgz | 80,977 | `10bef0547b1570d99abcad64cde623ea99d9237dba7dd4ebb00b98c0b9be872d` |
| 7 | victframework-renderer-svelte-0.2.0.tgz | 25,619 | `2ba80ad6a50ebdaa1edc11fb8aad6b457c4b6bf0ce9e1c0cb78616749a13b24d` |
| 8 | victframework-appdata-sqlite-0.2.0.tgz | 20,240 | `a7b16555ab402c3041c06910cb68360918923bba3dd1f5e86f690b1a28d65649` |
| 9 | victframework-scaffolder-0.2.0.tgz | 11,591 | `37c65000e120f7d8f9c853d84d410028a8a0ca6d99ff88addf8aa8a7563308f5` |
| 10 | victframework-control-0.2.0.tgz | 36,230 | `5983188dccaecd5a9d094f6f7076893603baa1fed6c0cabad9a0c29302f5611e` |
| 11 | victframework-mastra-0.2.0.tgz | 101,507 | `2253556a2799affbfb80917fcedf6a39aee6942f2f0a07f3db99c09bb9e28978` |
| 12 | victframework-server-0.2.0.tgz | 44,078 | `2fc7d70d03718709528c1c365443d3acbb07b5ff8d4cde6eac53ce7be4b6f288` |
| 13 | victframework-cli-0.2.0.tgz | 11,538 | `baa5cef6bdb7fe3628fcb7ffaff49c0349849fd584ee5694e5843247a18c74d6` |

The frozen tarballs were the ONLY publish inputs (`npm publish
<frozen.tgz> …`); nothing was published from a package directory, from
`main`, or from a rebuild.

## 4. Phase 3 — candidate publication under `vict-0.2.0-rc`

Published sequentially in the dependency-topological order
`contracts → sdk → kernel → runtime → store-sqlite → application →
renderer-svelte → appdata-sqlite → scaffolder → control → mastra → server →
cli`, each by exact frozen tarball with the audited temporary candidate tag:

```text
npm publish <frozen.tgz> --tag vict-0.2.0-rc --access public
```

(Low finding LO-3 honored: the `publish:release` script's default-`latest`
mode was NOT used at any point.) A release ledger recorded, per package:
intended identity, local SHA-256, publish attempted/confirmed, registry
tarball downloaded, registry SHA-256 matched, candidate tag verified, and
`latest` still verified `0.1.1`.

After each publish the script verified, with bounded registry-consistency
polling: `0.2.0` visible; `dist.integrity` present; `vict-0.2.0-rc → 0.2.0`;
`latest` still `0.1.1`; the registry tarball downloaded to separate storage
and recomputed byte-identical (SHA-256 equal to the frozen artifact); and
the registry manifest's internal pins exact `0.2.0`.

**Interrupted-read event (truthfully recorded):** after `runtime` published
(exit 0), the packument read stayed stale beyond the 2-minute bounded poll
and the driver stopped per the partial-publication rule — nothing was
republished and no tags changed. Diagnosis confirmed the publish HAD
applied (direct registry fetch showed `0.2.0` with `dist.integrity` equal
to the frozen artifact), i.e. a stale read, not a failed write. The run
resumed with the SAME frozen artifacts: the resume guard proved each
already-published artifact's integrity equality before completing its
verification, and the remaining packages were published normally. No
version was ever overwritten, republished, or unpublished, and `latest`
remained `0.1.1` on every package until Phase 5.

Result: **13/13 published under `vict-0.2.0-rc`, each byte-verified against
the frozen audited artifacts.**

## 5. Phase 4 — candidate-set registry verification

Independent complete-set verification over the public registry: exactly 13
candidate packages; every version set exactly `{0.1.0, 0.1.1, 0.2.0}`;
`vict-0.2.0-rc → 0.2.0` on all 13; `latest → 0.1.1` on all 13; internal
dependency graphs equal to the recorded 0.2.0 graph with exact pins; all 13
freshly downloaded registry tarballs byte-equal to the audit inventory
(SHA-256); registry-derived content ID equal to
`v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`.

Registry-mode consumer proofs:

- `npm run verify:release-consumer -- --registry` (the §6 CI gate rule) —
  **ALL CHECKS PASSED, exit 0**: exact-pinned 0.2.0 install from the public
  registry only, lockfile integrity on every member, registry-only resolved
  URLs, no-monorepo-leakage and realpath probes, strict
  `skipLibCheck:false` typecheck over the full public surface, real-SQLite
  runtime composition with close/reopen, Application Definition compile +
  renderer composition.
- An INDEPENDENT fresh-cache consumer (no VICT checkout access, explicit
  0.2.0 pins) proved the governed mutation-input boundary through the
  installed packages' PUBLIC APIs: **T1** a valid declared mutation reaches
  the reference adapter EXACTLY ONCE with the conforming
  `{resourceId, op, input, idempotencyKey}` request, input value-for-value;
  **T2** an undeclared input field is rejected
  `VICT_APPDATA_INPUT_CONTRACT_REJECTED` with zero adapter calls and no
  payload echo; **T3** an oversized multibyte input (22,000 × `€` = 66,000
  bytes > 64 KiB while far below in characters) is rejected
  `VICT_APPDATA_MUTATION_INPUT_INVALID` with zero adapter calls and no
  payload echo; **T4** an identity-only payload produces EXACTLY the legacy
  identity-only adapter request (keys `actionKind, actorId,
  expectedRevision, kind, releaseVersion, resourceId`; no `input`, no `op`);
  **T5** `MUTATION_INPUT_MAX_BYTES === 65536`. (Additionally observed: a
  stray top-level envelope field is rejected `VICT_COMMAND_PAYLOAD_INVALID`
  — the closed-envelope fence works.) Lockfile proof, realpath probe, and
  strict typecheck (`exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `skipLibCheck:false`)
  all green; `@victframework/mastra` remains installed-and-verified but
  outside the strict surface (documented upstream `@mastra/*` declaration
  defects, unchanged posture).

## 6. Phase 5 — coordinated promotion to `latest`

After the complete candidate set and consumers were green, all 13 packages
were promoted sequentially:

```text
npm dist-tag add @victframework/<pkg>@0.2.0 latest
```

Each promotion was followed by a re-read of the actual registry dist-tags
verifying `latest → 0.2.0` with `vict-0.2.0-rc` intact, with bounded
polling against stale CDN reads (one stale read at `contracts` was resolved
by polling; the authoritative registry state confirmed the promotion had
applied). All 0.2.0 versions were already present, so no consumer could
encounter a missing internal 0.2.0 dependency at any point. The rollback
procedure (re-point any defectively promoted package's `latest` to `0.1.1`)
was armed and never needed — no failure occurred, no rollback was executed,
and no mixed `latest` set ever existed.

## 7. Phase 6 — candidate-tag removal

```text
npm dist-tag rm @victframework/<pkg> vict-0.2.0-rc
```

Granular tokens are not authorized for dist-tag DELETE under the current
registry policy (E403), so the 13 removals were performed under the owner's
interactive login session with per-write WebAuthn confirmation in the
browser (13 confirmations, sequentially). Final verified registry state for
every one of the 13 packages:

```text
versions: 0.1.0, 0.1.1, 0.2.0
latest: 0.2.0
vict-0.2.0-rc: absent
```

## 8. Phase 7 — final public-registry proof

A completely fresh disposable consumer resolving ONLY `latest` (no pins)
installed all 13 packages at exactly `0.2.0` from the public registry — no
mixed release, no 0.1.1 fallback, no local resolution. Strict typecheck and
the full governed-mutation proof suite (T1–T5) passed again from these
artifacts. A final sweep re-downloaded all 13 registry tarballs: 13/13
SHA-256 equal to the authorized audit inventory; the registry-derived
content ID equals
`v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`.
`npm audit --omit=dev` in the consumer: **found 0 vulnerabilities**. Every
package's versions and dist-tags were rechecked after the proof
(`0.1.0, 0.1.1, 0.2.0`; `latest: 0.2.0`; no other tags).

## 9. Rollback posture (as-implemented, none executed)

- Versions are immutable: nothing was unpublished, overwritten, or
  re-published; the existing-version guard verified `0.2.0` unused for all
  13 immediately before each first publish.
- Publication-window rollback = do not promote `latest` (consumers never
  saw the candidate set through `latest`).
- Promotion rollback = `npm dist-tag add <pkg>@0.1.1 latest` per affected
  package (the complete prior set), then verify all 13 agree.
- For consumers of `0.2.0`, rollback means pinning the complete `0.1.1`
  set; for consumers of `0.1.1`, nothing changes unless they upgrade.

## 10. Preservation

- Quellight byte-identical at `f25b03a…`, pinned to
  `vict-release-set@1/0.1.0`; **Phase Q controlled adoption is permitted and
  NOT begun**; no existing consumer (including Quellight and Trading OS) was
  silently upgraded — `latest` moved as one coordinated set only after the
  complete candidate verification, and exact-pin consumers are unaffected.
- The release-source commit `5c81aca…` and the audit report are unchanged;
  historical preparation/audit records were not modified.
- OQ6 remains ratified; GOV-007 remains intact; Stage 07 remains In Progress.
- No git tag was created; `.pi/` and the pre-existing untracked artifacts
  remain untouched; no credential value or authentication file was read,
  displayed, or committed; all task-created worktrees, tarballs, consumers,
  caches, logs, and temporary auth material were removed after the record.
- Genuine Low issues carried forward unchanged: LO-1 (import-scan
  template-literal/concatenation gap), LO-2 (stripComments trailing-comment
  false positive, fail-closed), LO-3 (`publish:release` default-tag mode —
  avoided here by explicit `--tag` publishes), LO-3b (F3's LO-2 timing
  sensitivity, LO-3 direct-API payload trust domain), ENV-1 (the Stage 5
  Windows file-lock transient observed by the audit).

## 11. Commands and exits (summary)

Pre-publication (release-source worktree at `5c81aca…`): `npm ci` 0;
`verify:release-set` 0 (13 packages, 0.2.0, `v1_7a55798…`); `build` 0;
`format:check` 0; `lint` 0; `typecheck` 0; pack + hash comparison 13/13
exact; hygiene scans clean.

Publication: 13 publishes exit 0 (one stale-read stop-and-resume at
`runtime`, no republish); 13 `dist-tag add latest` exit 0 with verified
state; 13 `dist-tag rm` exit 0 under per-write WebAuthn.

Post-publication: `verify:release-consumer -- --registry` ALL CHECKS PASSED;
independent mutation-proof consumer exit 0 (T1–T5); latest-resolution
consumer install + strict typecheck + proof suite exit 0; `npm audit
--omit=dev` 0 vulnerabilities; final sweep 13/13 hashes + content ID equal.

---

*Coordinated publication record for the audited VICT 0.2.0 release set. The
immutable anchors remain the release-source SHA, the audit inventory, and
the content-derived release-set identity.*
