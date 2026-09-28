# Release impact inventory — adding `@victframework/ui` and `@victframework/ui-svelte`

**READ-ONLY analysis.** No contract amendment, no manifest change, no
publish, no trust mutation was performed. Recorded 2026-09-25 from
branch `qa/ui-foundation-p1` @ `0de2c625d9c6920dd8feefc445719ad1a752486b`.

## Current failing state (reproduced)

On the branch, the two new packages make the release gates fail closed:

- `npm run verify:release-set` (scripts/check-release-set.mjs) — FAILS:
  `@victframework/ui` / `@victframework/ui-svelte` are not members of the
  recorded release set; internal-pin check fails for
  `renderer-svelte → ui`, `renderer-svelte → ui-svelte`,
  `ui-svelte → ui`.
- `vitest run --project unit scripts/test/trusted-publishing.test.mjs`
  — 2 of 55 tests FAIL ("not in the frozen 13-package inventory",
  "inventory is 15 packages, expected exactly 13", order not a
  linearization of the frozen list).

Everything else about the new packages already complies with the
release-set rules (verified via the same gate's per-manifest checks once
membership is amended): `publishConfig.access = "public"`, Apache-2.0,
`engines.node`, `repository.url` with `directory`, declared `files`,
exact internal pins at the coherent version `0.3.1`.

## Every frozen-contract touchpoint that a proper amendment must touch

### A. The frozen contract itself — `docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`

- §1: "All 13 published manifests…" — becomes 15 (metadata-truthfulness
  statement; the new manifests already carry the correct
  repository/directory fields).
- §5 Release-set inventory (frozen): "MUST remain exactly the recorded
  13-package set" + the frozen 13-line publication order — must be
  restated as 15 with `ui` and `ui-svelte` inserted.
- §8 step 4/6 ("all 13 packages") — text updates ("all 15").
- §11 One-time trust bootstrap — the exact-13 allowlist description and
  the bootstrap's "ALL 13 TRUST RELATIONSHIPS VERIFIED" guarantee —
  becomes 15 (see also D below: the two NEW packages need trust
  configured for the FIRST time).
- §13 Phase-0 baseline — historical; unchanged.
- **Amendment rule (header of the contract):** the amendment must be a
  SEPARATE commit documenting the change BEFORE any implementation
  consumes it. It must not be bundled with the consuming implementation
  commit. The 2026-09-21 §8.1 amendment is the precedent format.

### B. The recorded identity — `docs/RELEASE-COMPATIBILITY.md`

- §2 machine-readable `vict-release-set` JSON block records exactly the
  13 members at the coherent version with `contentId`
  `v1_1c695280d3afec5…`. Adding two members at `0.3.1` changes the
  sorted `name@version` list → the contentId MUST be re-derived
  (`deriveReleaseSetContentId` in `scripts/lib/release-set.mjs`:
  sha256 over the sorted newline-joined `name@version` list, prefixed
  `v1_`). The §2 JSON block and any §2.1 lineage prose must be updated
  by the amendment implementation.
- Note: `0.3.1` (stable) is NOT yet published (`latest` = `0.3.0`;
  only `0.3.1-rc.1` exists under the candidate tag). A 15-package stable
  `0.3.1` set is therefore still available as a first publication of the
  two new packages — but the §2 record must be amended to the 15-member
  identity BEFORE `verify:release-set` passes.
- §2.1 lineage: prior sets are immutable; the already-published
  0.3.1-rc.1 candidate (13 members) is never re-published or rewritten.

### C. Scripts / tests that encode the frozen inventory

- `scripts/lib/release-set.mjs` — `EXPECTED_RELEASE_PACKAGE_COUNT = 13`
  → 15; `FROZEN_PUBLISH_ORDER` gains `@victframework/ui` and
  `@victframework/ui-svelte` between `@victframework/application` (6)
  and `@victframework/renderer-svelte` (now 9). Dependency-correct order:
  `ui` depends on nothing internal; `ui-svelte` depends on `ui`;
  `renderer-svelte` depends on `application`, `sdk`, `ui`, `ui-svelte`.
- `scripts/test/trusted-publishing.test.mjs` — pinned expectations
  (exact set + topological linearization) fail today; they read the
  same lib constants, so the lib change + recorded-identity update fixes
  the pins. The frozen-order test recomputes topological validity, so
  the new positions are self-checking.
- `scripts/check-release-set.mjs` (`npm run verify:release-set`) —
  record-driven from RELEASE-COMPATIBILITY.md §2 JSON; no count constant
  of its own. Passes once the record is amended.
- `scripts/trust-bootstrap.mjs` — derives the inventory from the lib
  constants; its `expected exactly 13` messages and the §5-order check
  follow the lib. No independent list.
- `scripts/oidc-release.mjs` — uses the lib constants throughout
  (inventory coherence, pack count, publication order, resume proof,
  registry verification); message text mentions 13 (cosmetic).
- `scripts/verify-release-consumer.mjs` — installs the EXACT recorded
  set parsed from RELEASE-COMPATIBILITY.md §2; becomes 15 automatically
  after the record amendment. (Its consumer-proof scenario should gain
  coverage of `VitApp` + `theme.css` + `ui-svelte/styles.css` from
  tarballs — already proven ad hoc in QA; making it a permanent §8 step-7
  scenario is an owner decision.)
- `scripts/lib/tarball-set.mjs` — identity-matching only; inventory-
  driven. No change.
- `scripts/release-evidence.mjs` — reads `FROZEN_PUBLISH_ORDER` from the
  lib; follows automatically.
- `.github/workflows/release.yml` — comment/step text says "13
  packages" (cosmetic); the version input description says "must equal
  all 13 manifests" — text update; behavior is lib-driven.
- Root `package.json` `build` chain — already includes
  `ui → ui-svelte → renderer-svelte` in build order (publish order is
  governed by the frozen list, not the build chain).

### D. npm trust setup (one-time, for the TWO NEW packages only)

- The 13 existing packages already have exact trust relationships
  (GitHub provider, `radz2291/vict-02`, `release.yml`, allow-publish, no
  environment) from the one-time bootstrap; they are unaffected.
- `@victframework/ui` and `@victframework/ui-svelte` have NEVER been
  published and have NO trust relationship. Required sequence:
  1. Amendment commit (contract §5/§1 text + §2 record) — separate,
     BEFORE implementation (contract amendment rule).
  2. Implementation commit: lib constants + record + workflow text.
  3. Trust bootstrap for the two new names via
     `scripts/trust-bootstrap.mjs` (it derives the new inventory and
     verifies every relationship). OPEN OPERATIONAL QUESTION to verify
     during the amendment work: whether `npm trust github` accepts a
     not-yet-published package name, or whether the first publish must
     ride a variant flow (npm's trusted-publisher configuration for a
     new package name). The bootstrap's fail-closed pre-checks will make
     the answer explicit; do not guess in automation.
  4. Then an ordinary `workflow_dispatch` release from a pushed
     `origin/main`-lineage SHA; §6 requires the requested version to be
     unpublished for ALL 15 members (true for stable `0.3.1`).
- §11 ceremony constraints unchanged: one human-bounded 2FA window,
  `npm >= 11.15.0` explicitly resolved, no tokens anywhere.

### E. Publication order (amended, proposed — NOT applied)

```text
 1. @victframework/contracts
 2. @victframework/sdk
 3. @victframework/kernel
 4. @victframework/runtime
 5. @victframework/store-sqlite
 6. @victframework/application
 7. @victframework/ui            (NEW — no internal deps)
 8. @victframework/ui-svelte     (NEW — depends on ui)
 9. @victframework/renderer-svelte
10. @victframework/appdata-sqlite
11. @victframework/scaffolder
12. @victframework/control
13. @victframework/mastra
14. @victframework/server
15. @victframework/cli
```

Any topologically valid position for `ui` before `ui-svelte` before
`renderer-svelte` is acceptable; the above minimizes diff surface
(appdata-sqlite etc. keep relative order after renderer-svelte).

### F. Identity consequence

- The member-set change makes the content-derived identity change by
  construction (`v1_` sha256 over the sorted `name@version` list). The
  15-member `0.3.1` identity is a NEW immutable identity; the published
  13-member history (0.1.0 … 0.3.1-rc.1) is never mutated.
- `npm run verify:release-consumer` will then install and typecheck the
  15-member set, including `ui` (dist JS/d.ts) and `ui-svelte` (Svelte
  sources + styles.css through the renderer's `theme.css` @import).

## What was NOT done (per instruction)

- No edit to `docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`,
  `docs/RELEASE-COMPATIBILITY.md`, `scripts/lib/release-set.mjs`, the
  pinned tests, the workflow, or any npm trust state.
- No publish, no dist-tag, no registry call.

## Smallest properly ordered path (proposal for Codex)

1. Amendment commit: contract §1/§5/§8/§11 text 13→15 with the insertion
   order above (separate commit, per amendment rule).
2. Implementation commit: `release-set.mjs` constants, §2 record JSON
   (re-derived contentId), workflow/message text, any pinned-test
   expectation text.
3. Verification: `npm run verify:release-set` green;
   `trusted-publishing.test.mjs` 55/55; full unit suite green.
4. Trust bootstrap execution for the two new packages (owner ceremony),
   then an ordinary candidate release (`X.Y.Z-rc.N`) to prove the first
   OIDC publication of `ui`/`ui-svelte` before any stable release.