# FT-4 classification — release-authority parallel timeout (G1 evidence)

Date: 2026-09-29 · Investigated by: G1 stage manager · Branch context: `codex/stage9-g1-foundation`

## What FT-4 is

Documented in `docs/governance/VICT-STAGE-08-FOLLOW-UP-REGISTER-2026-09-29.md`
(Stage 8 G4 independent audit): `scripts/test/release-authority.test.mjs`
cases time out at vitest's default 5s `testTimeout` when run inside the full
119-file unit project, while passing in isolation.

## G1 investigation (three observations, all reproduced this session)

| Run | Scope | Timeout | Result |
| --- | --- | --- | --- |
| Checkpoint `801ecee` full suite | 119 files, full parallel pool | default 5s | 2354/2355; the 1 failure = `oidc-release validate refuses an unauthorized source before lineage/registry activity` — **timeout, no assertion failure** |
| Isolated (this session) | release-authority alone | default 5s | 65/65 pass (153.68s wall) |
| Isolated (this session) | release-authority alone | 30s override | 65/65 pass |
| Moderate parallel (this session) | release-authority + packages/server/test + packages/control/test (15 files) | default 5s | 263/263 pass |

## Classification

- **Failure mode:** resource-starvation timeout of git-fixture setup
  (`writeGitFixture` spawns git processes) under the peak CPU contention of
  the full 119-file worker pool on this Windows machine. It is a
  **test-infrastructure timeout**, not a product or authority-mechanism
  failure: the same cases pass isolated, pass under moderate parallel load
  at the default timeout, and pass with an adequate per-test timeout.
- **Pre-existing:** present since the Stage 8 G4 audit; unchanged by all G1
  checkpoint work (G1 touched `packages/server`, `packages/cli`,
  `packages/runtime`, `apps/studio` — none of the release-authority paths).
- **Remedy direction (unchanged, still scheduled as FT-4):** give
  spawn-heavy release-authority cases a per-file timeout or serialize their
  pool; not absorbable into Stage 9 and NOT silently "fixed" here.

## G1 reporting rule applied

The full-suite number is always reported as "N/(N+1) with the single
failure = documented FT-4 environmental timeout (passes isolated)" — the
suite is never called fully green while FT-4 reproduces.
