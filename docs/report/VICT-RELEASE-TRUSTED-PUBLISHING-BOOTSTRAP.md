# VICT Trusted-Publisher Bootstrap Record

**Status:** Completed implementation-evidence record (release infrastructure).
**Date:** 2026-09-21.
**Governing frozen contract:** `docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`
(frozen at commit `f1cc939d…` — `docs(release): freeze trusted-publishing
contract`).
**Scope:** the ONE-TIME npm trusted-publishing bootstrap for the 13-package
`@victframework/*` release set. This record does NOT implement VICT-M-1,
does NOT change any package version, and does NOT publish any package
version. Phase Q6 remains not begun.

## 1. Commits of this task

| Commit | Subject | Content |
|---|---|---|
| `f1cc939d…` | `docs(release): freeze trusted-publishing contract` | the frozen contract document alone |
| `94e8e7d3…` | `feat(release): add OIDC coordinated publishing` | `.github/workflows/release.yml`, `scripts/oidc-release.mjs`, `scripts/scan-release-tarballs.mjs`, `scripts/trust-bootstrap.mjs`, `scripts/lib/{release-set,trust-config,tarball-scan-rules,tarball-io}.mjs`, `scripts/test/trusted-publishing.test.mjs`, `docs/RELEASE-COMPATIBILITY.md` §6 reconciliation, root `js-yaml` devDependency |
| `9954cba6…` | `chore(release): run evidence upload on node24 action runtime` | `actions/upload-artifact` v4 → v5 (Node 20 runtime deprecation observed in the smoke run) |
| `96e86375…` | `fix(release): surface the interactive 2FA prompt during trust bootstrap` | mutating trust call inherits the terminal stdio |
| `30647e94…` | `fix(release): retry trust calls interactively on the npm OTP challenge` | captured trust calls that fail with the OTP challenge are retried interactively once |

Final release-infrastructure tip: `30647e9473204bc19b2cfc8fba78359e82227898`
(`HEAD == origin/main` at recording time; fast-forward pushes only).

## 2. Validation performed (no package version published)

* Focused permanent tests: `scripts/test/trusted-publishing.test.mjs` —
  52 tests covering the closed version/tag rule, source-SHA shape, npm
  minimum-version gate, frozen inventory derivation (real repository +
  synthetic drift fixtures), exact publish/trust argv (never a token),
  trust-relationship classification (exact vs conflicting), token
  redaction, tarball path-allowlist / manifest-truth / content-scan
  rules (including the scaffolder template false-positive guard), and
  the committed workflow's YAML structure (triggers, exact permissions,
  runner, toolchain pinning, no secret references, env-var input
  passing, validate_only gating). Full script suite: 83/83 green.
* Deterministic local engine proofs: `oidc-release.mjs pack` packed the
  real 13-tarball set; `scan-release-tarballs.mjs` scanned the REAL
  `0.2.0` artifacts — 13/13 clean, no false positives; `validate`
  proven fully green (disposable worktree with temporary `0.3.0-rc.1`
  manifests, uncommitted, removed afterward) and proven to fail closed
  on: a published version, a version/manifest mismatch, an unknown
  SHA, malformed tag pairs, and a wrong resume prefix. The smoke test
  caught and fixed a real resume-guard bug before any commit.
* Workflow smoke run (run id `35522893465`, `validate_only` on
  `94e8e7d3…`): checkout of the exact SHA, Node 24 + npm 11.19.1 setup,
  and engine execution all succeeded on the GitHub-hosted runner; the
  run then failed closed at the registry guard (`0.2.0 already exists`)
  — the intended never-republish proof. No registry write occurred.
  This run is NOT OIDC-publication proof.

## 3. One-time human ceremony — exact observed behavior

* Environment at ceremony time: local Node v22.13.1 / npm 10.9.2; trust
  commands executed through explicitly resolved **npm 11.19.1**
  (`npx -y npm@11.19.1`); active npm was below the 11.15.0 trust
  minimum, as the frozen script anticipates.
* The npm web session was absent/expired: the first pre-flight
  `npm trust list` returned `E401`. ONE official interactive web login
  (`npm login` via npm 11.19.1, browser flow completed by the owner)
  established the session token. No password, OTP, recovery code, or
  token was ever pasted into chat, read, printed, or stored by the
  tooling; no `.npmrc` content was inspected.
* **Deviating observed registry behavior (vs the contract's expected
  five-minute-skip model):** npm demanded a FRESH browser-auth
  handshake (EOTP, "Authenticate your account at: <URL>") for EVERY
  trust endpoint call — including `npm trust list` READS — and the
  advertised five-minute skip did NOT suppress subsequent challenges.
  The captured-spawn pre-check model therefore could not converge
  (each captured retry hid the challenge URL). Per the contract's
  stop-and-revise rule the bulk run was stopped after the first
  package, and the owner chose the revised bounded path: the SAME
  mutating commands (identical argv, identical frozen order, two-second
  delays, `--allow-publish`, no environment) executed one package at a
  time in a LIVE terminal so each browser handshake could be completed
  in the official npm flow. Late in the sequence npm stopped
  re-challenging (session warmed), so the final packages completed
  without fresh prompts.
* **Human 2FA challenges actually required:** 1 interactive web login +
  one browser handshake per configured/verified package (approximately
  18 approvals total across the session; `server` and `cli` completed
  without an additional challenge once the session warmed). npm did
  NOT offer an effective five-minute skip for `npm trust` operations.
* **Recovered incident:** the first `@victframework/sdk` mutation
  printed its created settings but its post-auth status poll failed
  (`E404` on `/-/v1/done?authId=…`) and the relationship did NOT
  persist (a later `npm trust list` returned it absent). The mutation
  was re-run once, completed cleanly, and the final verification below
  proves the persisted state. `@victframework/contracts` creation was
  unaffected.
* No probe package was published and no existing version was touched;
  registry `dist-tags` remain exactly `latest: 0.2.0` on all 13
  packages throughout this task.

## 4. Permanent trust table (verified post-bootstrap)

All 13 relationships verified through `npm trust list <pkg> --json`
after configuration. Every relationship is EXACTLY:

```text
type: github
file: release.yml
repository: radz2291/vict-02
permissions: createPackage, createStagedPackage
environment: none
```

(`createPackage`/`createStagedPackage` is npm's canonical expansion of
the requested `--allow-publish`.)

| Package | relationship id |
|---|---|
| `@victframework/contracts` | `41fbf73b-575a-4b91-b61c-b8da0ce11cb7` |
| `@victframework/sdk` | `64969a9e-0981-4c7b-887f-524c085f8d83` |
| `@victframework/kernel` | `e0ba58ae-01ec-4b61-b624-717661179132` |
| `@victframework/runtime` | `fd78ba78-e0a4-434c-a00f-cafab8f5d501` |
| `@victframework/store-sqlite` | `f3dcf1ee-3bd4-469f-9cfb-48b611c98be5` |
| `@victframework/application` | `950e7c03-ab89-47eb-a3f5-ee819e8a2017` |
| `@victframework/renderer-svelte` | `9dd5c558-9a06-40ee-a8d6-dc0c685a4936` |
| `@victframework/appdata-sqlite` | `3937f798-a1d1-4499-82fb-c06e48ede63d` |
| `@victframework/scaffolder` | `c94d42ba-45e9-4596-853c-bba46900c4a0` |
| `@victframework/control` | `5ec55848-254e-4e81-bd59-a1d2df4fc926` |
| `@victframework/mastra` | `d75127d7-6542-418e-97bc-fd9585682026` |
| `@victframework/server` | `b9e50865-e90f-499f-9b5a-a4b89049f8f6` |
| `@victframework/cli` | `134fd08a-9f62-49bf-9ee8-a4f98739bee7` |

## 5. Limitations and audit notes

* The frozen contract's §11 five-minute-skip model did not match npm's
  actual behavior for `npm trust` operations (per-operation handshakes;
  skip not offered/effective). The one-time bootstrap therefore ran as
  the revised bounded sequence above. Future trust changes (unlikely;
  the relationships are permanent) would face the same per-package
  handshake; ordinary RELEASES are unaffected — they use OIDC publish,
  which requires no OTP and no handshake.
* `scripts/trust-bootstrap.mjs` remains in the repository as the
  canonical tooling (exact allowlist, frozen order, delays, conflict
  refusal, post-verification); its OTP-retry path now surfaces the
  interactive handshake when the registry demands it.
* The workflow filename (`release.yml`) and repository identity
  (`radz2291/vict-02`) are security-sensitive and must not be renamed
  without a contract amendment and a new bootstrap.
* Account-, organization-, and package-governance changes may still
  require interactive 2FA; ordinary coordinated releases do not.
* The first real OIDC publication proof remains outstanding and will
  occur during the resumed VICT-M-1 candidate release. This task
  published nothing.
