# Release-readiness corrections record — r3 (2026-09-27)

Branch `pi/release-readiness-r3`, isolated, one commit on top of
`pi/ui-facade-retirement-r2` @ `d8c70df2d80169e38d951c4569e913ecfab49865`
(owner-review preparation tip). Scope: the three release-readiness
blockers found in owner review. The 14-package UI implementation and the
`0.4.0-rc.1` candidate are UNCHANGED. Nothing is merged, ratified,
published, or trusted; the frozen contract file is byte-untouched;
Stage 8 is untouched; G3 remains HELD.

## Blocker 1 — frozen-contract inconsistency: corrected draft, full normative consistency

Finding (confirmed): the §16 draft's Appendix A replaced only §5, while
current-tense rules in §§1, 2, 6, 8, 10, and 11 still specified 15
packages — an internally inconsistent ratified state would have been
created.

Correction, in the DRAFT only (`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT-AMENDMENT-DRAFT-2026-09-27-FACADE-RETIREMENT.md`):

- **Appendix B (part 1)** — twelve EXACT REMOVE/INSERT substitutions
  covering every current-tense count norm outside §5: the header
  amendments-to-date line, §1 (manifests metadata proof), §2
  (workflow-rename blast radius), §6 ×2 (coherent-version input rule,
  unpublished-version rule), §8 ×2 (build count, pack count), §10
  (unpublished-set rule without resume), §11 ×4 (inventory derivation,
  allowlist, ceremony verification count, manual-configuration count) —
  each preserving the historical amendment markers
  (`§14: 13 → 15; §16: 15 → 14`).
- **Appendix B (part 2)** — the full §16 amendment record to append,
  including **§16.5 "Ratification sequence deviation — explicit owner
  authorization"**: the frozen amendment rule requires the amendment
  commit BEFORE any implementation consumes it; r1/r2/r3 departed from
  that sequence, and the draft now discloses the departure explicitly
  (the earlier draft's "same model as the §15 precedent" justification
  was withdrawn — §15 was never ratified, so it is not authority; the
  only compliant precedent is §14). §16.5 encodes the EXACT corrective
  owner decision: **D-authorize** (retroactively authorize the consuming
  commits) or **D-revert** (revert the consuming implementation before
  ratification and re-apply it after); ratification without a recorded
  choice is incomplete and the authority gate stays red.
- Historical statements (§8.1, §13, §14) are untouched and the checker
  explicitly tolerates 15-references inside historical records only.
- No part of the draft relies on the unratified §15 draft as authority:
  the order derivation now starts from the ratified §14 state plus the
  machine topological validation (`validateFrozenOrderIsTopological`).
- The frozen contract file `docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`
  remains byte-untouched; nothing is applied without ratification.

## Blocker 2 — missing ratification gate: fail-closed contract-authority check

New tooling (wired so that NO registry write can precede it):

- `scripts/lib/contract-authority.mjs` — pure assessment of the frozen
  contract text against the EXACT ratified 14-package state: (1) the §16
  amendment record section exists in the frozen file; (2) the §16.5
  sequence-deviation owner authorization exists; (3) the amendments-to-
  date header records §16; (4) §5 carries the exact frozen 14-package
  inventory, order, and removal markers; (5) zero current-tense
  15-norms survive in §§1–12 (historical records §8.1/§13/§14/§16
  excluded). Every gap is named, never summarized away.
- `scripts/verify-contract-authority.mjs` — the standalone gate CLI
  (exit 0 authorized / 1 refused).
- Wiring, before ANY registry call or write, including resume paths:
  `oidc-release.mjs` `validate` + `publish` (the gate is the FIRST
  action of both commands — `publish` refuses before even the local
  pack-dir check, and `validate` refuses before lineage fetch and the
  unpublished/resume guard), `publish-release.mjs --publish`,
  `trust-bootstrap.mjs --execute` (trust writes are registry writes;
  the dry plan and read-only `--verify-only` stay usable), and
  `release.yml` — a dedicated "Contract authority gate" step
  immediately before the publish step (plus the engine gate in the
  validate step).
- Ordinary checks are deliberately NOT gated and stay usable while
  ratification is pending: `verify:release-set`,
  `verify:release-consumer`, `verify:builder-kit`, format/lint/
  typecheck, and the test suites.
- Tests (`scripts/test/release-authority.test.mjs`): RED — the REAL
  frozen contract is refused with every gap named (missing §16 record,
  missing §16.5, missing header marker, §5 order mismatch with 15
  entries incl. renderer-svelte, ≥5 surviving 15-norms); GREEN — only
  the mechanical application of Appendices A+B (the exact ratified
  state) is accepted, and tampering with the §5 order, reintroducing a
  15-norm, or dropping §16.5/§16 is refused again; engine wiring —
  validate/publish/bootstrap/CLI all refuse BEFORE any registry call.

## Blocker 3 — first publication of `ui` and `ui-svelte`: verified constraint, preflight, owner-authorized bootstrap

Constraint verified read-only (source evidence, 2026-09-27):

- npm documentation ("Trusted publishers",
  docs.npmjs.com/trusted-publishers): trusted-publisher configuration
  happens under "your package settings on npmjs.com → Packages →
  YOUR_PACKAGE → Settings → Trusted publishing" — a per-package
  settings surface that presupposes an existing package.
- Live registry (read-only `npm view` / packument probes):
  `@victframework/ui` and `@victframework/ui-svelte` are ABSENT (404, no
  presence at any version); the 12 other members are present (8 versions
  each, latest 0.3.1 — untouched).
- Live CLI (read-only): `npm trust list <pkg>` is authentication-gated
  (E401 without a session) — matching contract §13 — so trust
  verification without an authenticated session reports UNVERIFIABLE
  (a blocker; absence of proof is never a pass).

New tooling:

- `scripts/lib/trust-preflight.mjs` + `scripts/verify-trust-preflight.mjs`
  (READ-ONLY): for each of the 14 members in frozen order — registry
  existence probe + trust-relationship classification (`npm trust list
  --json` live, or a recorded official-command evidence file via
  `--evidence`). THE SET-WIDE RULE: unless EVERY member exists AND
  carries the exact relationship, publishing ANY member is refused —
  there is no "publish the ready subset" path. Outcome stages:
  `authorized` / `first-publication-bootstrap` / `trust-bootstrap` /
  `blocked`, each with exact next-stage guidance.
- Demonstrated failure path WITHOUT any registry change (exit 1):
  `ui`/`ui-svelte` ABSENT → stage `first-publication-bootstrap`; all 14
  trust relationships UNVERIFIABLE (unauthenticated) — publication
  refused for the whole set.
- `scripts/first-publish-bootstrap.mjs` (DRY BY DEFAULT): the separately
  owner-authorized one-time bootstrap. Placeholder version
  **`0.0.0-bootstrap.1`** under a dedicated **`bootstrap`** dist-tag —
  a shape that can never satisfy the coordinated version rule
  (`X.Y.Z`/`X.Y.Z-rc.N`), so it can never consume or partially publish
  the coordinated `0.4.0-rc.1` set; the workspace version is never
  touched (temp-copy re-version only); real built package content,
  truthfully versioned; published through the historical local
  interactive-2FA path (the §13 precedent — the ONE registered
  exception, since npm OIDC cannot publish a package that has no trust
  relationship yet); `latest` stays unoccupied. `--execute` requires,
  in order: the contract-authority gate GREEN (i.e. §16 — including
  this exception — ratified), an explicit `--authorization` artifact
  containing the exact marker + member names + placeholder version, and
  a clean tree; it refuses any member that is not absent and any name
  outside the frozen inventory. Sequence: placeholders → §11 trust
  bootstrap → preflight AUTHORIZED for all 14 → only then the
  coordinated release.
- No OIDC, immutability, or no-secret rule is weakened: §4/§10's OIDC
  publication model is unchanged for every ordinary release; the
  exception is scoped to the FIRST registry presence of the two new
  members and is recorded in the §16/§11 ratified text for owner review
  (Appendix B, part 2, amendment point 3).

## Red/green gate distinction on this branch

RED BY DESIGN (fail-closed until ratification; all demonstrated without
registry changes):

| Gate | Observed |
| --- | --- |
| `node scripts/verify-contract-authority.mjs` | REFUSED, exit 1, all gaps named |
| `oidc-release.mjs validate` (any inputs) | CONTRACT AUTHORITY REFUSED before lineage/registry |
| `oidc-release.mjs publish` (any pack-dir) | CONTRACT AUTHORITY REFUSED before the pack-dir check |
| `publish-release.mjs --publish` | CONTRACT AUTHORITY REFUSED before any git/pack work |
| `trust-bootstrap.mjs --execute` | CONTRACT AUTHORITY REFUSED (dry plan + `--verify-only` unaffected) |
| `first-publish-bootstrap.mjs --execute` | CONTRACT AUTHORITY REFUSED without authorization |
| `verify-trust-preflight.mjs` | REFUSED — 2 absent + all unverifiable, set-wide refusal, exit 1 |
| `release.yml` | authority-gate step red before publish; validate step red (rehearsals included) |

GREEN (ordinary checks, usable while ratification is pending):
`verify:release-set` (14, 0.4.0-rc.1, `v1_2a70a29a…`),
`verify:builder-kit` (18/18, packId `3b1f40d5…`), the new
`release-authority` suite (26/26), the full `scripts/test` project, and
format/lint/typecheck. Packed-consumer checks unchanged — no packaging
changed (no manifest/lockfile edits), so `verify:release-consumer` was
not re-run on this branch; the last full pass (ALL CHECKS PASSED,
14 tarballs at 0.4.0-rc.1) stands.

## Owner decisions required (consolidated)

1. **Ratify §16** by committing Appendix A + Appendix B (parts 1 and 2)
   verbatim into the frozen contract — the only sanctioned edit.
2. **Record the §16.5 choice**: D-authorize the consuming implementation
   commits (`bac9c0164…`, `d8c70df2…`, this branch's SHA) or D-revert
   them before ratification. Without it the gate stays red by design.
3. **Authorize the first-publication bootstrap** (or reject and choose an
   alternative, e.g. interactive first publish at the coordinated version
   itself, which the current draft does NOT permit): after ratification,
   run `first-publish-bootstrap.mjs --execute --authorization <file>` for
   `ui` + `ui-svelte` (placeholders `0.0.0-bootstrap.1` under `bootstrap`),
   then `trust-bootstrap.mjs --execute`, then require
   `verify-trust-preflight.mjs` AUTHORIZED before any coordinated release.
4. **Schedule the authorized candidate release** (`0.4.0-rc.1` under
   `vict-0.4.0-rc` via `release.yml`) only after 1–3 are complete; the
   workflow will fail closed until then.
