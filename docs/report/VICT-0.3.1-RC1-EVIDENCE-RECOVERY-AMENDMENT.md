# VICT 0.3.1-rc.1 Candidate Evidence-Recovery Amendment

**Status:** Owner-approved, narrowly bounded amendment to the frozen
trusted-publishing contract
(`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`), committed ALONE before
any consuming implementation change (L0 freeze discipline; same structure
as `docs/report/VICT-TRUSTED-PUBLISHING-EVIDENCE-RECOVERY-AMENDMENT.md`).
**Date:** 2026-09-22.
**Amended surfaces:** the read-only evidence-recovery workflow
(`.github/workflows/release-evidence.yml`) and its engine bound
(`scripts/lib/evidence-rules.mjs`, `scripts/test/release-evidence.test.mjs`)
are RE-BOUND from the historical `0.3.0-rc.1` candidate to the new
`0.3.1-rc.1` candidate below. Nothing else in the frozen contract changes.

## 1. What happened (truthful record)

The coordinated candidate release set `vict-release-set@1/0.3.1-rc.1`
(frozen contract
`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-CONTRACT.md` §5) was
published from the exact pushed release source
`948d8e514d5657e4b76df54e2168101c8e084267` (verified `HEAD ==
origin/main`, clean, linear; ancestor of `origin/main` at dispatch)
through the unchanged trusted-OIDC workflow `.github/workflows/release.yml`:

* **Publication run `35625570254`** (event `workflow_dispatch`, inputs
  `source_sha 948d8e5…`, `version 0.3.1-rc.1`, `npm_tag vict-0.3.1-rc`):
  the FULL pre-publication chain ran once green (input/lineage validation,
  release-set coherence, `npm ci`, format, lint, typecheck, build of all
  13 packages, the full test suite ONCE, pack of the actual tarballs,
  tarball identity inspection + content scan, isolated packed-tarball
  consumer proof), and ALL 13 PACKAGES WERE PUBLISHED in the frozen
  dependency-topological order under `vict-0.3.1-rc` through npm OIDC
  trusted publishing ("oidc-release: ALL 13 PACKAGES PUBLISHED under
  'vict-0.3.1-rc'"; no npm token, login, OTP, or local publication
  anywhere).
* The run's FINAL step — the same-run registry verification — FAILED on
  registry propagation lag: after 12 read-only re-checks, 2 of 13
  packages (`@victframework/appdata-sqlite`, `@victframework/control`)
  were not yet visible to the verification reads, so the step (and the
  run) concluded terminal-`failure`. This is the same verification-timing
  class as historical finding B-1 (the `0.3.0-rc.1` publication run
  `35530894104`); the publication itself is complete and immutable.

The registry NOW carries all 13 members at exactly `0.3.1-rc.1` with
`vict-0.3.1-rc → 0.3.1-rc.1` and `latest` UNCHANGED at `0.3.0` (verified
by direct registry reads after the run).

## 2. Adopted remedy (read-only; same precedent as B-1)

The established, owner-approved remedy for this failure class is the
READ-ONLY successor evidence run — no republication, no dist-tag
mutation, no registry write of any kind. The evidence-recovery
machinery (workflow + engine + tests) is RE-BOUND to the new candidate:

| Bound field                | Value |
| -------------------------- | ----- |
| version                    | `0.3.1-rc.1` |
| source SHA                 | `948d8e514d5657e4b76df54e2168101c8e084267` |
| original publication run   | `35625570254` (terminal-`failure`; preserved as the truthful publication event) |
| original workflow path     | `.github/workflows/release.yml` (unchanged) |
| candidate dist-tag         | `vict-0.3.1-rc` |
| expected `latest`          | `0.3.0` (never moves to a candidate) |
| forbidden stable version   | `0.3.1` (must NOT exist) |
| release-set identity       | `vict-release-set@1/0.3.1-rc.1` |
| expected content ID        | `v1_b6e39c1f6d6f627c03dfe12e8eb4bc0b6b8bb7f7746b4b871cf00d3c7f7ae731` |
| corrected engine commit    | `948d8e514d5657e4b76df54e2168101c8e084267` (the engine that performed the publication is the release source itself) |
| provenance ref             | `refs/heads/main` |
| provenance builder         | `https://github.com/actions/runner/github-hosted` |

All safety properties of the evidence path are PRESERVED UNCHANGED:
read-only permissions (`contents: read`; NO `id-token: write`, NO
environment, NO secret of any kind); the only permitted release-engine
subcommands remain the non-mutating `pack` and `verify-registry`; no npm
publish/dist-tag/deprecate/unpublish/trust/login/whoami anywhere; the
run fails closed on any deviation from the bound identity; the
historical `0.3.0-rc.1` recovery record is preserved byte-unchanged as
historical record (the bound MOVES; the old record is not rewritten).

The successor evidence run must prove, read-only: 13/13 registry
manifests at exactly `0.3.1-rc.1`, dist-tag state (`vict-0.3.1-rc` →
`0.3.1-rc.1`; `latest` → `0.3.0`), per-package integrity equality
between the registry artifacts and the rebuilt candidate source,
SLSA provenance bindings (repository, source SHA, workflow, publication
run `35625570254`, tarball digests), the release-set content identity,
and the registry-only consumer proof. A terminal-`success` evidence run
closes the verification chain for the candidate.

## 3. Status language

The `0.3.1-rc.1` candidate remains a VERIFICATION CANDIDATE — awaiting
independent verification. `latest` remains `0.3.0`; stable `0.3.1`
remains unpublished. This amendment authorizes the read-only evidence
recovery ONLY; it does not authorize any stable release, any registry
mutation, or any consumer-product behavior change.
