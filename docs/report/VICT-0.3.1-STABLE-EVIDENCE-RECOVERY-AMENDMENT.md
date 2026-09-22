# VICT 0.3.1 Stable Evidence-Recovery Amendment

**Status:** Owner-approved, narrowly bounded amendment to the frozen
trusted-publishing contract (`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`),
committed ALONE before any consuming implementation change (L0 freeze
discipline; the same structure as the rc.1 and rc.2 evidence-recovery
amendments). **Date:** 2026-09-22.
**Amended surfaces:** the read-only evidence-recovery workflow
(`.github/workflows/release-evidence.yml`) and its engine bound
(`scripts/lib/evidence-rules.mjs`, `scripts/test/release-evidence.test.mjs`,
and the summary text in `scripts/release-evidence.mjs`) are RE-BOUND from
the historical `0.3.1-rc.2` candidate to the new STABLE `0.3.1` release
below. Nothing else in the frozen contract changes.

## 1. What happened (truthful record)

The coordinated stable release set `vict-release-set@1/0.3.1` (content ID
`v1_1c695280d3afec5e91bfc75d3c99a5a85bc27f6d91127c4d0ce7bd51563c2583`)
was published from the exact pushed release source
`446453fc4f6837e50a0bf3254b47d6a208f5b491` (verified `HEAD ==
origin/main`, clean, linear; ancestor of `origin/main` at dispatch)
through the unchanged trusted-OIDC workflow
`.github/workflows/release.yml`:

* **Publication run `35688234026`** (event `workflow_dispatch`, inputs
  `source_sha 446453fc…`, `version 0.3.1`, `npm_tag latest`): the FULL
  pre-publication chain ran once green (input/lineage validation,
  release-set coherence, `npm ci`, format, lint, typecheck, build of all
  13 packages, the full test suite ONCE, pack of the actual tarballs,
  tarball identity inspection + content scan, isolated packed-tarball
  consumer proof), and ALL 13 PACKAGES WERE PUBLISHED in the frozen
  dependency-topological order under `latest` through npm OIDC trusted
  publishing; no npm token, login, OTP, or local publication anywhere.
* The run's FINAL step — the same-run registry verification — FAILED on
  registry propagation lag: the step (and the run) concluded
  terminal-`failure` while its verification reads could not yet observe
  the just-published versions. This is the SAME verification-timing
  class as the `0.3.0-rc.1` publication run `35530894104`, the
  `0.3.1-rc.1` publication run `35625570254`, and the `0.3.1-rc.2`
  publication run `35661159776`; the publication itself is complete and
  immutable. The failed run is NEVER relabelled or reinterpreted.

The registry NOW carries all 13 members at exactly `0.3.1` with
`latest → 0.3.1`, the candidate tag RETAINED at
`vict-0.3.1-rc → 0.3.1-rc.2` (and `vict-0.3.0-rc → 0.3.0-rc.1`), verified
by direct registry reads after the run. rc.1, rc.2, and 0.3.0 remain
published, immutable, and installable.

## 2. Adopted remedy (read-only; the established precedent)

The established, owner-approved remedy for this failure class is the
READ-ONLY evidence-recovery workflow. The bound MOVES to the stable
release; the old records are not rewritten. The stable binding extends
the engine in exactly two bounded ways:

1. `forbiddenStableVersion` is `null` for a stable recovery (there is no
   stable version that must remain unpublished); the corresponding guard
   is skipped when the field is null, and the member state records
   `stableAbsent: 'not-applicable-stable-release'`.
2. A new `retainedTags` bound (`{ 'vict-0.3.1-rc': '0.3.1-rc.2' }`) is
   checked EXACTLY per member: the retained candidate tag must never move
   or be reused for the stable release.

Everything else is the unchanged read-only chain: permissions exactly
`contents: read`; no OIDC write authority, no environment, no npm
credential, no secret; only the non-mutating engine subcommands
`pack`/`verify-registry`; the run fails closed on any deviation from the
bound identity; the evidence artifact records the complete chain. The
evidence schema identity becomes `vict-stable-evidence-recovery@1`.

## 3. Bound identity (frozen by this amendment)

* Version: `0.3.1`; release-set identity `vict-release-set@1/0.3.1`;
  content ID `v1_1c695280d3afec5e91bfc75d3c99a5a85bc27f6d91127c4d0ce7bd51563c2583`.
* Source: `446453fc4f6837e50a0bf3254b47d6a208f5b491` (pushed main lineage).
* Original publication run: `35688234026` (terminal-`failure`, NEVER
  relabelled); workflow `.github/workflows/release.yml`; dispatch inputs
  `source_sha 446453fc…`, `version 0.3.1`, `npm_tag latest`.
* Dist-tags required: `latest = 0.3.1`; retained
  `vict-0.3.1-rc = 0.3.1-rc.2` (and the historical
  `vict-0.3.0-rc = 0.3.0-rc.1` remains untouched).
* SLSA provenance: each of the 13 packages must bind to
  `radz2291/vict-02`, `refs/heads/main`,
  `.github/workflows/release.yml`, gitCommit `446453fc…`, and run
  `35688234026`.

No live-provider proof, no consumer release behavior change, and no
historical record rewrite is authorized by this amendment. Quellight's
stable repin proceeds only after the read-only evidence chain is green.
