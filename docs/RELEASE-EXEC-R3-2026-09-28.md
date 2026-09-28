# Release execution record R3 — coordinated 0.4.0-rc.1 PUBLISHED (2026-09-28)

> Companion to docs/RELEASE-EXEC-R2-2026-09-28.md (bootstrap + trust +
> evidence). This record documents the coordinated release itself. G3
> remains HELD — publication does not move the Stage 8 gate; the fresh
> P2 proof against the PUBLISHED candidate is a separate, open operator
> procedure (docs/governance/VICT-STAGE-08-G3-P2-FRESH-PROOF-HANDOFF-2026-09-28.md).

## Publication facts

| Item | Value |
| --- | --- |
| Release source (dispatched SHA, detached in-run) | `d7bd003047a648738a4d1d824b0c4e4a442c0da3` (main; contains the evidence artifact + executed-authorization record) |
| validate_only rehearsal | run [`36427093710`](https://github.com/radz2291/vict-02/actions/runs/36427093710) — SUCCESS (pre-publication chain green: validate, install, release-set, static, build ×14, full suite, pack, scan, packed consumer; gates/publish skipped by design) |
| Coordinated publication | run [`36427806906`](https://github.com/radz2291/vict-02/actions/runs/36427806906) — authority gate SUCCESS; trust preflight (evidence mode + live recheck) SUCCESS; **"ALL 14 PACKAGES PUBLISHED under 'vict-0.4.0-rc'"**; post-publish verify step FAILED on registry propagation timeout (see below) |
| Published set | 14 packages at `0.4.0-rc.1`, dist-tag `vict-0.4.0-rc` on every member; set identity `vict-release-set@1/0.4.0-rc.1` / `v1_2a70a29af12fa887d18e7099b027a11f86bd2f6a70a756446fb43844e41d9399` (recomputed == recorded == run-recorded contentId) |
| `latest` | UNTOUCHED: all 12 historical members remain at `0.3.1`; `ui`/`ui-svelte` keep npm's platform-forced `0.0.0-bootstrap.1` (see R2). The candidate is reachable ONLY via `vict-0.4.0-rc`. |
| Release evidence artifact | run 36427806906 artifact `release-evidence` (= `release-results.json`: sourceSha, identity, contentId, 14 × {name, version, status: published, integrity}); SHA-256 of the zip: `40fb2ff615c5ce21d04a36efd2e692cf0898cc88ab218d4d3e0755481eaca1c5` |

## The verify-step failure, and why publication still stands

The publish step completed with every per-package OIDC publish exiting 0
("ALL 14 PACKAGES PUBLISHED"). The subsequent read-only `verify-registry`
step re-checks propagation with a bounded retry window (12 × 10s ≈ 2.5
minutes). npm's CDN lag for `@victframework/application` and
`@victframework/scaffolder` exceeded that window, so the step fail-closed
("version missing in registry; dist-tag 'vict-0.4.0-rc' is 'missing'")
and the run's conclusion is `failure` — **even though the publication
itself is complete and correct**. Registry facts confirmed minutes later,
independently of the workflow:

- all 14 versions present at `0.4.0-rc.1` with `vict-0.4.0-rc → 0.4.0-rc.1`;
- **14/14 registry `dist.integrity` values byte-match the run-recorded
  digests in `release-results.json`**;
- `latest` untouched everywhere (see table above).

The verifier's retry window is widened by this commit (60 × 15s ≈ 15
minutes, still bounded, still read-only, still fail-closed on the final
pass) so the next release's workflow verdict reflects reality.

## Independent external-consumer verification

`npm run verify:release-consumer -- --registry` from the clean checkout
installs the published set from the public registry and re-runs the
consumer proofs (result recorded in the release report; local run exit 0).
