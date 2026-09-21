# VICT-M-1 — Stable 0.3.0 Release and Formal Closure

**Status:** VICT-M-1 is **REMEDIATED, INDEPENDENTLY RE-VERIFIED, AND
FORMALLY CLOSED**. The stable coordinated release set
`vict-release-set@1/0.3.0` is **PUBLISHED, REGISTRY-VERIFIED, and
REGISTRY-CONSUMER-PROVEN** through the unchanged trusted-OIDC workflow
(no npm token, no npm login, no OTP, no local `npm publish` anywhere).
Quellight is exact-pinned to the stable set. **Phase Q5 remains
formally closed; Phase Q6 contract and implementation planning is now
PERMITTED but HAS NOT BEGUN.**

**Date:** 2026-09-21.
**Governing verification:**
`docs/report/VICT-M-1-INDEPENDENT-RE-VERIFICATION.md` (fresh independent
auditor, verdict `CLEARED — CONDITIONAL STABLE RELEASE PERMITTED`,
findings `0 Blocking · 0 High · 0 Medium · 2 Low · 3 Observations`).

---

## 1. The original finding (historical summary)

**VICT-M-1 (carried from the ratified 0.2.0 discovery):** Quellight's
single pinned agent capability `qlt.proposal.draft@1` durably creates an
epistemically inert pending proposal row — factually a WRITE — while
declaring `effect: 'read'`. The false declaration was the sole reason
the 0.2.0 default policy (`write`/`irreversible` → approval) let the
write complete in-turn quietly, and no per-invocation approval decision
or policy basis was durably recorded anywhere. The frozen remediation
contract (`docs/report/VICT-M-1-REMEDIATION-CONTRACT.md`, freeze
`06672de…`) required independent representation of effect truth, the
per-invocation approval decision, and its closed-code policy basis.

## 2. Remediation and candidate (historical summary)

* `e123f0e…` (Lane A): runtime record types
  (`EffectApprovalDisposition`, `VICT_EFFECT_POLICY_IDENTITY =
  'vict-effect-policy@1'`, three intent-immutable evidence members),
  control intent stamping, SQLite migration 10
  `m1-approval-decision-evidence` (fixed 0.2.0-rule backfill, historical
  effects never rewritten), the Mastra exact-match host quiet-write
  policy with fail-closed validation, additive exports.
* `44cec8a…` (Lane B): permanent negative-control suites.
* `f126ec5…` (Lane C): candidate `0.3.0-rc.1` (13 packages, exact pins).
* Quellight `c55489f…`/`0fb4050…` (Lane Q): adoption on the candidate,
  `qlt.proposal.draft@2` truthfully `write`, the EXACT one-entry host
  policy `qlt.host-policy.quiet-write@1`.
* Publication: run `35530894104` (`.github/workflows/release.yml`,
  head `a98dd015…`) — all 13 packages published via npm OIDC trusted
  publishing; its step 16 (same-run registry verification) FAILED on
  stale CDN reads, making the run terminal-`failure` (finding **B-1** of
  the first independent audit, `docs/report/VICT-M-1-INDEPENDENT-VERIFICATION.md`).

## 3. Evidence-chain recovery (historical summary)

Under the owner-approved, narrowly bounded amendment
(`docs/report/VICT-TRUSTED-PUBLISHING-EVIDENCE-RECOVERY-AMENDMENT.md`,
committed ALONE as `98d59b6…` before the consuming implementation
`ba75d5b…`), the READ-ONLY successor evidence run `35558851493`
(`release-evidence.yml`, attempt 1, terminal-`success`) re-proved the
immutable candidate from the public registry and the exact source:
13/13 integrity, provenance, dist-tags, Linux rebuild byte-identical,
corrected contentId `v1_9117e0cb…`, registry-only consumer proof. The
original run remains truthfully terminal-`failure` and was never
relabelled; no registry state was touched by the recovery. Record:
`docs/report/VICT-M-1-CANDIDATE-EVIDENCE-RECOVERY.md`.

## 4. Independent re-verification (gate decision)

A fresh independent auditor re-verified the entire chain
(`docs/report/VICT-M-1-INDEPENDENT-RE-VERIFICATION.md`): B-1 closed;
all deferred scope executed — registry/provenance/content identity
independently recomputed, Linux (WSL2, npm 11.19.1) rebuild 13/13
byte-identical, registry-only consumer proof with fail-closed negative
controls, old-tree negative controls at VICT `0536d1e…`/Quellight
`1d1c9f6…`, 10 independent M-1 semantic probes against the PUBLISHED
packages, and both authoritative ladders green. Verdict:
**CLEARED — CONDITIONAL STABLE RELEASE PERMITTED** (`0 Blocking ·
0 High · 0 Medium · 2 Low · 3 Observations`; the Lows are stale-text
documentation hygiene, fixed during the Quellight repin).

## 5. The stable `0.3.0` release

* **Release source:** `c7a413a1d3e3da978434e9b1a6679b9ac233d203`
  (pushed fast-forward; `HEAD == origin/main` at dispatch; clean tree;
  manifests + lockfile + release-set record only — **no semantic
  runtime, authority, approval, migration, API, or product-behavior
  change of any kind**; the audited M-1 implementation is untouched).
* **Equivalence proof:** all 13 stable tarballs packed from this source
  are file-for-file **byte-identical to the audited `0.3.0-rc.1`
  registry artifacts except `package/package.json`** (version + exact
  internal pins) — verified by full extraction comparison in the
  pre-publication gates.
* **Pre-publication gates (stable tree, all exit 0):** release-set
  coherence (`vict-release-set@1/0.3.0`,
  `v1_5f3a074a…`), format, lint, typecheck, build 13/13, full test
  suite ONCE (2364 passed / 3 skipped), pack 13, tarball scan 13/13
  clean, isolated local-tarball consumer proof, `git diff --check`,
  `npm audit --omit=dev` (0 vulnerabilities).
* **Publication:** workflow run **`35564490763`**
  (`https://github.com/radz2291/vict-02/actions/runs/35564490763`,
  `.github/workflows/release.yml`, run number 8, **attempt 1**,
  event `workflow_dispatch`, head `c7a413a…`) concluded
  **terminal-`success`** — the full in-workflow chain (validate,
  `npm ci`, release-set gate, format/lint/typecheck, build, FULL test
  suite, pack + identity inspection + content scan, isolated
  packed-tarball consumer proof) ran once green, then all 13 packages
  were published in the frozen dependency-topological order under
  `npm_tag: latest` through npm OIDC trusted publishing, and the run's
  own corrected same-run registry verification + registry-only consumer
  proof PASSED (`registryVerification.ok === true`, 13/13, exit 0).

## 6. Complete stable release-set identity (independently verified)

```text
vict-release-set@1/0.3.0
contentId: v1_5f3a074a50ab5623acbf933d52a24e6d383ded2ccd02bbaa78a28c3be3915580
contentIdAlgorithm: sha256 over the sorted newline-joined 'name@version' list of the exact member set, prefixed v1_
version: 0.3.0   access: public   registry: https://registry.npmjs.org/   license: Apache-2.0
```

All 13 members verified at exactly `0.3.0` with `latest → 0.3.0`,
the candidate tag `vict-0.3.0-rc → 0.3.0-rc.1` untouched, and every
prior version (`0.1.0`, `0.1.1`, `0.2.0`, `0.3.0-rc.1`) still
available. Registry `dist.integrity` (sha512, base64), each proven
equal to the downloaded tarball's own digest and to the SLSA subject:

| # | Package | dist.integrity (sha512) |
|---|---------|-------------------------|
| 1 | `@victframework/contracts` | `4NmUobkxCQ2slWEkZ1EJ965H0xzSgCnsK+NCaz/LH5glFPv90DQh+PgIcAvxg1wTHigESKX4vy/YSsT/xVvzzw==` |
| 2 | `@victframework/sdk` | `2u6gquUl4TfRLCaZZMBVktX2cPnqWzhqC8MVUj5MhHt8VNiPwFJf+QNFM6fGPEPjHhpnh6EzpBdCqhSYVoFnIg==` |
| 3 | `@victframework/kernel` | `T1CMnN7KAAVzPMuVyBlxjAod9vFvOZewVhmntMrB5O6Zx3KTsYJgjQVMGgEqRSQDSr3pxaRWUHPXPi1u7j74iQ==` |
| 4 | `@victframework/runtime` | `7x6/k/17WzUnqF05slVkYOAVuRugoLGJl0asRh8QvIzVDrI8j1bNZ3YYkY8FKwu3GdaeVhOsjwE8nrmIAbImWw==` |
| 5 | `@victframework/store-sqlite` | `ZdiiG1n0NN2+9mRRHuYZa28LjdpXbRKZs3bmGP8eXpPhsOJTCuGKvd3F51T4BpZYesbIify9VI0cRBeFGF65Zw==` |
| 6 | `@victframework/application` | `8oFm9CYrTi8pwZ+yvXK4us+YDr9Ea3gzht51Wtf0HkI73pRkvYYWB4Yo5QQrD1SLM56pN2aSJDDJsC9/fO3WtA==` |
| 7 | `@victframework/renderer-svelte` | `+NKWVqs3c4zFAExGOL530o0tXqzy+dPUpHkGB650Vs7XoDJc1VyoQrOSRRGaWr3JObqKOfgCT3H/Mm0wU4K2CA==` |
| 8 | `@victframework/appdata-sqlite` | `6SkeAfrqPL0hcwg9Cy/Ss9vTqlNqs3El5LgcvibRJdobUQ80KqBiTgP7Gq1zdJKaKEo3u/QyMSOtRSqNl0NsXQ==` |
| 9 | `@victframework/scaffolder` | `xA8TJrFrBXzWbmj1Hh9mq3Mb2x7pGci5Dw0sAs00f/7190c8Ux5nXB91M9hbB47EuZr12Yc9o9AjX8dCjFTsgQ==` |
| 10 | `@victframework/control` | `Wj6vbutk7KRuNhRTtk3mOQnYfOlLYc5w+LQDSIvLa4rgiwCdCm+GKO+AY5mpN/yxRDgeL3z8GW7KfijPUs2OBw==` |
| 11 | `@victframework/mastra` | `01LedjWz5jAYDCKIRNNl7VAGJ4eoVoyohISS4U3Uxmc0epUW0QjSBHng7RPOfYhCQ+qiS5gfiXnFRHIRgoJSnQ==` |
| 12 | `@victframework/server` | `Vfmu2p8Ra2RWVo38ZJYLIlZfl/9SglV0SEsvLLrcmAi1+QGlX+Pih2tcBSkrErA7jShPtF7G9X83kmymfsSmkQ==` |
| 13 | `@victframework/cli` | `wYtZobfAEyGz6KxElx1HtCfuYFVmZUly8NeXPMsbEWdTR7Emm0NMoaaL9f9mBnYHDUH9lGoc0CY2Cmgae2iDcA==` |

**Provenance (13/13, content-level binding):** every SLSA v1 statement
binds repository `https://github.com/radz2291/vict-02`, workflow
`.github/workflows/release.yml`, ref `refs/heads/main`,
`gitCommit = c7a413a1d3e3da978434e9b1a6679b9ac233d203`, the
GitHub-hosted builder, invocationId
`…/actions/runs/35564490763/attempts/1`, and a subject sha512 equal to
the tarball digest behind the registry `dist.integrity`.
**Exact internal pins:** every registry manifest pins its internal
dependencies at exactly `0.3.0`; no `workspace:`/`file:`/`link:`/`git`
specifiers anywhere.

## 7. Quellight stable exact pins

Quellight commit `1c7d3e6…` (fast-forward push) repins every
`@victframework/*` dependency from exact `0.3.0-rc.1` to exact `0.3.0`
(9 runtime dependencies + the scaffolder devDependency); the lockfile
was regenerated through real public-registry installation (11/11
lockfile entries at exact `0.3.0`, integrity values equal to §6); the
release-set gate constants record
`vict-release-set@1/0.3.0` / `v1_5f3a074a…`. **No Quellight product or
Q6 behavior change; `qlt.proposal.draft@2` (`write`) and the exact host
quiet-write policy `qlt.host-policy.quiet-write@1` are unchanged; Q2–Q5
closure records and all historical reports are preserved.** The FIRST
stable-pinned ladder run at `1c7d3e6…` FAILED inside
`verify:quellight` with 5 findings, every one traced to a single repin
defect: the Q-phase verifier gates still carried the RECORDED candidate
pin literals (`0.3.0-rc.1`), which the repin had missed. The fix commit
`1ff8e6b…` updates exactly those recorded identities (27 literal
replacements; no behavior, schema, or product change; each affected
gate re-verified green individually before the authoritative re-run).
The full stable-pinned ladder then ran ONCE green on the corrected tree
`1ff8e6b…` (`npm ci`; registry-only `verify:consumer` with the
unreachable-registry negative control; `verify:quellight` — node suites
including the real offline-conversation M-1 evidence, dev-start
zero-warning gate, UI islands, production build, real-browser checks,
credential scan, `git diff --check`; `npm audit --omit=dev` clean).
Quellight-side record (with the disclosed failed run):
`docs/report/QUELLIGHT-STAGE-07C-M-1-STABLE-REPIN.md`.

## 8. Formal closure and standing

* **VICT-M-1: FORMALLY CLOSED** — remediated, independently verified
  end-to-end, released as the stable set, and adopted by Quellight.
* The candidate `0.3.0-rc.1` and its evidence chain (original run
  `35530894104` terminal-`failure` + successor evidence run
  `35558851493` terminal-`success`) remain immutable historical record.
* **Q5 remains VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED**
  (unchanged).
* **Phase Q6: contract and implementation planning is now PERMITTED and
  HAS NOT BEGUN.** No Q6 work exists in either repository.

## 9. Authentication attestation

The stable publication used ONLY the existing GitHub-OIDC trusted
publishing workflow. No npm login, password, OTP, npm token, or
token-bearing `.npmrc` was used, requested, or created; no local
`npm publish` was executed; no package-by-package browser approval was
performed. The one authenticated call in the release path was the
`workflow_dispatch` (repository administration by the owner identity
through the existing GitHub credential — no npm authority of any kind).

## 10. Preservation

All frozen contracts and historical reports (including the first audit,
the amendment, and the recovery record) are byte-unchanged. No history
was rewritten; no tag was created; the candidate dist-tag was not
moved, re-created, or removed; nothing was unpublished or republished.
No operator data (`.quellight-data`, `.pi/`) was accessed.
