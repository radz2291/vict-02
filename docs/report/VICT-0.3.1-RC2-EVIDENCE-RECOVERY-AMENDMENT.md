# VICT 0.3.1-rc.2 Candidate Evidence-Recovery Amendment

**Status:** Owner-approved, narrowly bounded amendment to the frozen
trusted-publishing contract
(`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`), committed ALONE before
any consuming implementation change (L0 freeze discipline; the same
structure as `docs/report/VICT-0.3.1-RC1-EVIDENCE-RECOVERY-AMENDMENT.md`).
**Date:** 2026-09-22.
**Amended surfaces:** the read-only evidence-recovery workflow
(`.github/workflows/release-evidence.yml`) and its engine bound
(`scripts/lib/evidence-rules.mjs`, `scripts/test/release-evidence.test.mjs`)
are RE-BOUND from the historical `0.3.1-rc.1` candidate to the new
`0.3.1-rc.2` candidate below. Nothing else in the frozen contract
changes.

## 1. What happened (truthful record)

The coordinated candidate release set `vict-release-set@1/0.3.1-rc.2`
(frozen contract
`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-AUDIT-REMEDIATION-CONTRACT.md`
§5) was published from the exact pushed release source
`a7b0018c460581e5425df80e56b0ccf309a4b4a4` (verified `HEAD ==
origin/main`, clean, linear; ancestor of `origin/main` at dispatch)
through the unchanged trusted-OIDC workflow `.github/workflows/release.yml`:

* **Publication run `35661159776`** (event `workflow_dispatch`, inputs
  `source_sha a7b0018…`, `version 0.3.1-rc.2`, `npm_tag vict-0.3.1-rc`):
  the FULL pre-publication chain ran once green (input/lineage
  validation, release-set coherence, `npm ci`, format, lint, typecheck,
  build of all 13 packages, the full test suite ONCE, pack of the actual
  tarballs, tarball identity inspection + content scan, isolated
  packed-tarball consumer proof), and ALL 13 PACKAGES WERE PUBLISHED in
  the frozen dependency-topological order under `vict-0.3.1-rc` through
  npm OIDC trusted publishing ("oidc-release: ALL 13 PACKAGES PUBLISHED
  under 'vict-0.3.1-rc'"; no npm token, login, OTP, or local publication
  anywhere).
* The run's FINAL step — the same-run registry verification — FAILED on
  registry propagation lag: after 12 read-only re-checks, 2 of 13
  packages were not yet visible to the verification reads, so the step
  (and the run) concluded terminal-`failure`. This is the same
  verification-timing class as the `0.3.0-rc.1` publication run
  `35530894104` and the `0.3.1-rc.1` publication run `35625570254`; the
  publication itself is complete and immutable.

The registry NOW carries all 13 members at exactly `0.3.1-rc.2` with
`vict-0.3.1-rc → 0.3.1-rc.2` and `latest` UNCHANGED at `0.3.0` (verified
by direct registry reads after the run; stable `0.3.1` remains absent).

## 2. Adopted remedy (read-only; the established precedent)

The established, owner-approved remedy for this failure class is the
READ-ONLY successor evidence run — no republication, no dist-tag
mutation, no registry write of any kind. The evidence-recovery machinery
(workflow + engine + tests) is RE-BOUND to the new candidate:

| Bound field                | Value |
| -------------------------- | ----- |
| version                    | `0.3.1-rc.2` |
| source SHA                 | `a7b0018c460581e5425df80e56b0ccf309a4b4a4` |
| original publication run   | `35661159776` (terminal-`failure`; preserved as the truthful publication event) |
| original workflow path     | `.github/workflows/release.yml` (unchanged) |
| candidate dist-tag         | `vict-0.3.1-rc` |
| expected `latest`          | `0.3.0` (never moves to a candidate) |
| forbidden stable version   | `0.3.1` (must NOT exist) |
| release-set identity       | `vict-release-set@1/0.3.1-rc.2` |
| expected content ID        | `v1_55d1ad2eb0afaf0e487b3e0b457069e7cfe2ac0bdaed7d443a13287287f0e31f` |
| corrected engine commit    | `a7b0018c460581e5425df80e56b0ccf309a4b4a4` (the engine that performed the publication is the release source itself) |
| provenance ref             | `refs/heads/main` |
| provenance builder         | `https://github.com/actions/runner/github-hosted` |

All safety properties of the evidence path are PRESERVED UNCHANGED:
read-only permissions (`contents: read`; NO `id-token: write`, NO
environment, NO secret of any kind); the only permitted release-engine
subcommands remain the non-mutating `pack` and `verify-registry`; no npm
publish/dist-tag/deprecate/unpublish/trust/login/whoami anywhere; the
run fails closed on any deviation from the bound identity; the
historical `0.3.1-rc.1` recovery record is preserved byte-unchanged as
historical record (the bound MOVES; the old record is not rewritten).

The successor evidence run must prove, read-only: 13/13 registry
manifests at exactly `0.3.1-rc.2`, dist-tag state (`vict-0.3.1-rc` →
`0.3.1-rc.2`; `latest` → `0.3.0`), per-package integrity equality
between the registry artifacts and the rebuilt candidate source, SLSA
provenance bindings (repository, source SHA, workflow, publication run
`35661159776`, tarball digests), the release-set content identity, and
the registry-only consumer proof. A terminal-`success` evidence run
closes the verification chain for the candidate.

## 3. Status language

The `0.3.1-rc.2` candidate remains a VERIFICATION CANDIDATE — awaiting
fresh independent re-verification. `latest` remains `0.3.0`; stable
`0.3.1` remains unpublished. This amendment authorizes the read-only
evidence recovery ONLY; it does not authorize any stable release, any
registry mutation, or any consumer-product behavior change.
