# Release-execution record — r1 (2026-09-28)

Branch `pi/release-exec-r1`, isolated worktree, based on the verified
`origin/main` tip `9b6eb01e32c1a2d81368c8231cb1bb037a702bfa` (remote SHA
re-verified against `refs/heads/main` before branching). Scope: the two
concrete corrections the release path still needed — release-test
registry-state determinism, and the isolated-consumer packed closure —
plus this record. Release tooling ONLY: the 14-package implementation
and the `0.4.0-rc.1` candidate are byte-unchanged (`verify:release-set`
ALL with the recorded identity `v1_2a70a29af12fa88…`). The frozen
contract file is byte-untouched; the seven Stage 8 governance records
are byte-untouched; **G3 remains HELD**; no registry write, no trust
configuration, no bootstrap, no publication occurred on this branch.

## Correction 1 — release-test registry-state determinism

Finding (confirmed): four tests in
`scripts/test/release-authority.test.mjs` whose subject touches the live
registry hard-coded the PRE-bootstrap world (`@victframework/ui` and
`@victframework/ui-svelte` ABSENT). After the owner-authorized §16
first-publication bootstrap establishes the placeholders, those
assertions cease to hold and the release workflow's `npm test` step
would fail — breaking the CI publication path exactly when it is first
needed.

Correction (derive, never assume): a `livePresence()` helper performs
the same read-only packument probe the production preflight performs,
and every registry-state expectation is derived from it:

- evidence-mode preflight test: trust is proven from the RETAINED
  captured output in every registry state; presence is proven ONLY by
  the live recheck (the verdict's absent set must equal the live probe;
  every claim/live disagreement must be surfaced); refused on
  `first-publication-bootstrap` while anything is absent, authorized
  once all 14 are present.
- NEW state-independent negative: inverting EVERY presence claim in an
  otherwise valid artifact leaves the live verdict unchanged — evidence
  can neither forge nor deny registry presence.
- bootstrap-plan test: the plan's `absent:` set must equal the live
  probe (never a present package — idempotence), the dry run stays dry
  (`published:` never appears), and post-bootstrap the script refuses a
  second placeholder ("nothing to bootstrap").
- evidence-env integration test: the run must reach the LIVE registry
  recheck in every state — refused (bootstrap stage) pre-bootstrap,
  AUTHORIZED at the release-ready state.
- no-evidence live test: the CLI verdict must equal the live-mode lib
  verdict of the same state (including CI's session-less
  authentication-gated refusal), instead of assuming `UNVERIFIABLE`.

The production preflight is untouched: the authority gate, the
mandatory set-wide preflight on every publication path, schema-v2
evidence validation (exitCode 0, retained output, recomputed hash,
reclassified trust, 24 h freshness, set binding), and the release-time
live presence recheck are byte-unchanged.

## Correction 2 — isolated-consumer packed closure

Finding (observed, reproduced): `scripts/isolated-consumer-check.mjs`
packed only the five neutral base packages (contracts, kernel, runtime,
store-sqlite, sdk). The candidate's `sdk` declares a real dependency on
`@victframework/ui@0.4.0-rc.1` (UI-foundation integration; at 0.3.1 sdk
depended only on contracts), so the consumer's `npm install` resolved
through the PUBLIC registry and failed E404 on the unpublished
candidate — 16 check failures. The Stage-02-era closure was correct for
0.3.1 and latent-broken for the candidate.

Correction: the check now packs and installs the transitive workspace
dependency closure (six tarballs: contracts, ui, sdk, kernel, runtime,
store-sqlite — ui has no dependencies) and includes `ui`'s dist in the
zod-reference declaration scan. After the fix:
`ISOLATED CONSUMER CHECK PASSED` (exit 0).

## Gate table (this branch, clean `npm ci` + full authoritative build)

| Gate | Result |
| --- | --- |
| focused `scripts/test` suite (unit project) | 224 tests green (incl. the four reworked + one new authority tests); 1 pre-fix suite failure (bootstrap-artifact) resolved by the authoritative build ordering — green after `npm run build` |
| `npm run build` (all 14 packages, topological) | exit 0 |
| `npm test` (full suite, built tree) | **2730 passed \| 3 skipped** (155 files) — the prior environment's full-suite stall (npm 10.9.2 → npx npm@11.19.1 fallback, ~5 s per trust probe) does not occur with npm 11.19.1 active (the workflow's pinned version) |
| `format:check` / `lint` / `typecheck` | all exit 0 |
| `check:ui` (svelte-check) | 0 errors, 0 warnings |
| `verify:release-set` | ALL — 14 packages, 0.4.0-rc.1, `v1_2a70a29af12fa88…` (recorded identity) |
| `verify:builder-kit` | 18/18 |
| `verify:release-consumer` (packed tarballs, fresh consumer) | ALL (incl. former-facade surface on ui-svelte) |
| `verify:stage5` aggregate | all checks passed |
| `verify:consumer` (isolated Stage-02 consumer) | PASSED after Correction 2 (16 failures before) |
| browser: `test:foundation` / `test:composition` / `test:catalog` | 10 / 18 / 46 checks passed (matches the recorded baseline) |

Live registry state during this run (read-only probes only):
`@victframework/ui` and `@victframework/ui-svelte` ABSENT at all
versions; `@victframework/contracts@0.4.0-rc.1` unpublished; historical
`latest` values unchanged. The reworked tests pass in exactly this
state, and their post-bootstrap expectations are exercised by
construction (derived from the live probe).

## Unchanged

- No package source, manifest, workspace root, or lockfile change.
- Frozen contract + §16 ratification record byte-untouched
  (`Owner decision recorded: D-AUTHORIZE` stands).
- Stage 8 governance records byte-untouched; G3 HELD.
- No registry write, no trust mutation, no bootstrap, no publication.

## Next steps (owner-gated, in order)

1. Owner review of the §16 bootstrap authorization artifact for exactly
   `@victframework/ui` + `@victframework/ui-svelte`, placeholder
   `0.0.0-bootstrap.1`, dist-tag `bootstrap` (draft prepared; the owner
   completes the confirmation block).
2. Authenticated npm session (interactive 2FA): run
   `scripts/first-publish-bootstrap.mjs --inspect` (no write) and then
   `--execute --authorization <signed artifact>`.
3. `scripts/trust-bootstrap.mjs --execute` (configures the missing
   relationships; idempotent; refuses conflicts), then
   `scripts/verify-trust-preflight.mjs` must report AUTHORIZED for all
   14.
4. `scripts/capture-trust-evidence.mjs --out …` while authenticated
   (24 h window), committed/uploaded for the workflow's
   `trust_evidence_path` input.
5. `validate_only` rehearsal, then the coordinated publication under
   tag `vict-0.4.0-rc` from the exact main-lineage release source.
6. Independent registry verification of all 14 versions + a clean
   external consumer; then the FRESH TaskLedger-style P2 proof against
   the actually published candidate for the Stage 8 handoff (the frozen
   P2 proof remains pinned to published 0.3.1 and is not retroactive).
