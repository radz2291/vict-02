# Release dispatch runbook — 0.4.0-rc.1 (2026-09-28)

Owner-facing runbook for the remaining, owner-gated steps. Every step
before §A is already verified green (see docs/RELEASE-EXEC-R1-2026-09-28.md
and docs/governance/VICT-STAGE-08-G3-P2-FRESH-PROOF-HANDOFF-2026-09-28.md).
Run everything from a clean checkout of the release source on `main`.
`main` at runbook time: `10dab3bce505bb818bf90104bc60600185492861` —
ALWAYS re-read the dispatch SHA fresh (`git ls-remote origin main`) at
dispatch time; never dispatch from memory.

## Preconditions (all verified 2026-09-28)

- Contract authority GREEN: `node scripts/verify-contract-authority.mjs`
  → AUTHORIZED (§16 ratified; exact §16.5 line `Owner decision recorded:
  D-AUTHORIZE`; consuming commits are ancestors of main).
- Release-set coherence GREEN: `npm run verify:release-set` → 14
  packages, `0.4.0-rc.1`, `v1_2a70a29af12fa88…`.
- Engine validate dry run: passes authority → lineage → coherence →
  unpublished-guard, refuses at the trust preflight
  (`first-publication-bootstrap`) with NO registry write — the expected
  pre-bootstrap state.
- Bootstrap plan/inspect DRY: exactly `@victframework/ui` +
  `@victframework/ui-svelte` absent; placeholder artifacts validated
  (ui: 9,124 bytes / 10 files; ui-svelte: 55,582 bytes / 135 files).

## A. One-time first-publication bootstrap (owner only; §16 exception)

1. Complete the confirmation block of the authorization draft
   (`owner-authorization-DRAFT-ui-bootstrap.txt`, outside the repo):
   name, date, the sentence "I authorize this bootstrap exactly as
   written above." Scope is EXACTLY `@victframework/ui` +
   `@victframework/ui-svelte`, version `0.0.0-bootstrap.1`, tag
   `bootstrap`.
2. Authenticate npm locally (`npm login`; interactive WebAuthn/2FA
   required by the publish itself — contract §13 historical path).
3. Inspect once more from the authenticated machine (no write):
   `node scripts/first-publish-bootstrap.mjs --inspect`
4. Publish the placeholders (interactive 2FA prompt per package):
   `node scripts/first-publish-bootstrap.mjs --execute --authorization <signed-artifact-path>`
   - Refuses unless the contract authority gate is GREEN, the artifact
     contains the exact marker + both member names + the placeholder
     version, and the git tree is clean.
   - Publishes each placeholder with
     `npm publish <tgz> --access public --tag bootstrap --registry https://registry.npmjs.org/`.
   - `latest` stays unoccupied for both packages. Registry-immutable
     once done.

## B. Trust relationships (radz2291/vict-02 / release.yml / publish / none)

1. `node scripts/trust-bootstrap.mjs --execute` — configures every
   member whose relationship is not already EXACT (the historical
   ceremony's relationships are verified and skipped; the two new
   members are configured; CONFLICTING relationships abort, never
   auto-replaced). Completes the npm 2FA grace window in the browser.
2. `node scripts/verify-trust-preflight.mjs` (live, authenticated) must
   report AUTHORIZED for all 14. If it does not: STOP — nothing may
   publish.

## C. Operator trust evidence for CI (24-hour window)

1. `node scripts/capture-trust-evidence.mjs --out trust-evidence.json`
   (authenticated; read-only against npm; schema v2; binds to
   `0.4.0-rc.1` + the set identity).
2. Commit the artifact into the repo (or upload it where the workflow
   input can reference a path in the dispatched ref). Record its
   SHA-256 in the handoff.

## D. Rehearsal (no registry write; proves nothing about OIDC publish)

GitHub → Actions → "VICT coordinated release-set publication" → Run
workflow, on `main`:

- `source_sha`: <exact pushed main SHA, full 40-hex, read fresh>
- `version`: `0.4.0-rc.1`
- `npm_tag`: `vict-0.4.0-rc`
- `trust_evidence_path`: <path of the committed artifact from §C>
- `validate_only`: ✅ true

Expected: authority gate, trust preflight (evidence mode; presence
re-proven live), build, full test suite, pack, tarball scan, packed
consumer — all green; run stops before any publish step.

## E. Coordinated publication

Same dispatch as §D with `validate_only`: ❌ false. The workflow
publishes the exact packed tarballs of all 14 members, in frozen
topological order, through npm OIDC trusted publishing (no token, no
secret), then verifies registry state and uploads `release-evidence`.

## F. Independent post-publication verification

- `npm view @victframework/<m>@0.4.0-rc.1` for all 14;
  `dist-tags['vict-0.4.0-rc'] == 0.4.0-rc.1`; `latest` NOT moved.
- Tarball digests: release-run `release-results.json` vs registry
  `dist.integrity`.
- `npm run verify:release-consumer -- --registry` (clean external
  consumer off the public registry).
- Then execute the fresh P2 proof procedure
  (docs/governance/VICT-STAGE-08-G3-P2-FRESH-PROOF-HANDOFF-2026-09-28.md)
  and take it, with the run ID + evidence, to the Stage 8 operator.
  G3 stays HELD until the owner's formal disposition + proof
  acceptance.
