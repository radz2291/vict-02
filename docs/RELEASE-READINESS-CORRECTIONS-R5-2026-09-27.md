# Release-readiness corrections record — r5 (2026-09-27)

Branch `pi/release-readiness-r5`, isolated, one commit on top of the
pushed `pi/release-readiness-r4` tip
`2a68a29de007bcc2cd0bda0d17aad19024d4bb27` (remote SHA verified against
`refs/heads/pi/release-readiness-r4` before branching). Scope: the three
r5 review defects, release tooling ONLY. The UI implementation, the
14-package inventory, and the `0.4.0-rc.1` candidate are UNCHANGED (no
manifest/lockfile edits; `verify:release-set` ALL,
`verify:builder-kit` 18/18 with the same recorded identities). Nothing
is ratified, merged, trusted, or published; the frozen contract file is
byte-untouched; §16 remains an UNRATIFIED draft; Stage 8 is untouched;
**G3 remains HELD**.

Changed files:

- `.github/workflows/release.yml`
- `scripts/lib/trust-evidence.mjs`
- `scripts/lib/publication-preflight.mjs`
- `scripts/lib/trust-config.mjs`
- `scripts/lib/contract-authority.mjs`
- `scripts/capture-trust-evidence.mjs`
- `scripts/verify-trust-preflight.mjs`
- `scripts/test/release-authority.test.mjs`
- `scripts/test/trusted-publishing.test.mjs`
- this document

## Defect 1 — CI could not use its own trust evidence

Finding (confirmed): `oidc-release validate` runs the trust preflight
IMMEDIATELY (before input validation), but in `release.yml` the first
validate step did not receive `RELEASE_TRUST_EVIDENCE` — even when the
operator supplied `trust_evidence_path`. In CI (no npm session, frozen
no-secret policy §4) the preflight attempted the live
`npm trust list` check, got the E401-class failure, and stopped BEFORE
the later evidence-aware steps (the dedicated preflight gate, publish)
could ever see the evidence. Additionally, the dedicated preflight step
built its argument with `ARGS="--evidence $RELEASE_TRUST_EVIDENCE"`
unquoted — a shell word-splitting hazard for paths with spaces.

Correction (evidence reaches EVERY consumer, by env var only):

- `release.yml` now passes
  `RELEASE_TRUST_EVIDENCE: ${{ inputs.trust_evidence_path }}` to the
  FIRST validate step, the dedicated trust-preflight gate, and the
  publish step.
- The preflight gate's run block is a single fixed command
  (`node scripts/verify-trust-preflight.mjs --require-authorized`); no
  argument string is ever assembled in a shell, so word-splitting is
  impossible by construction.
- `scripts/verify-trust-preflight.mjs` now accepts the evidence path
  from `RELEASE_TRUST_EVIDENCE` (env; `--evidence` flag still wins),
  matching the engine's env-var contract.
- Proven by workflow-level tests (parsed YAML: the validate step env,
  the env-only preflight step, no `$`/`--evidence` interpolation) AND
  faithful integration tests (the REAL `verify-trust-preflight
  --require-authorized` run with only the env var set): a valid
  evidence fixture now carries the run PAST the trust check to the
  live registry recheck (output: `LIVE registry recheck`, stage
  `first-publication-bootstrap` because ui/ui-svelte are still absent
  — correctly refused, but at the RIGHT gate), while without the env
  the run dies authentication-gated (`UNVERIFIABLE`) exactly as CI did
  on r4. All 14 r5-marked tests FAIL on r4 and PASS on r5.

## Defect 2 — the evidence file could claim success without proving its contents

Finding (confirmed): the r4 evidence artifact (`vict-trust-preflight-
evidence/1`) recorded only the FORMAT of `rawOutputSha256` — there was
no captured output in the file to recompute it from — and accepted any
integer `exitCode`. `publication-preflight` then trusted the claimed
`registry: present` / `trust: exact` statuses. A fresh, complete,
FABRICATED v1 JSON file with `exitCode: 1` and an invented hash passed
every r4 check (reproduced on the r4 tip: `accepted: true`).

Correction (schema v2 — the artifact must PROVE what it claims):

- New schema `vict-trust-preflight-evidence/2` (v1 refused BY NAME with
  the reason; recapture required). Results are an ARRAY of per-member
  records so missing, foreign, and DUPLICATE results are structurally
  detectable.
- Per result, validation requires:
  - the result names EXACTLY one frozen member (foreign-set refused);
  - no duplicate member results (conflicting copies refused);
  - the command is EXACTLY `npm trust list <name> --json` for THAT
    member (mismatched/unbound commands refused);
  - `exitCode === 0` — only SUCCESSFUL official-command results are
    evidence; a failed or authentication-gated capture is refused,
    never interpreted;
  - the non-sensitive captured output (`rawOutput`) is RETAINED in the
    artifact; its sha256 is RECOMPUTED and compared (`rawOutputSha256`)
    — invented hashes and output altered after hashing are refused;
  - the trust relationship is CLASSIFIED FROM THE RETAINED OUTPUT with
    exactly the live-path classifier, and the claimed `trust` must
    agree — a fabricated `trust: exact` over output that classifies as
    `missing`/`conflicting` is refused;
  - freshness (24 h window + clock-skew) and set binding (coherent
    version + content-derived identity) unchanged from r4.
- `membersFromTrustEvidence` now DERIVES trust from the retained
  output; the claimed status is never inherited even if validation
  were bypassed.
- REGISTRY PRESENCE IS RECHECKED AT RELEASE TIME: evidence mode now
  live-probes (read-only packument fetch, no npm session needed) every
  member at the gate, and the LIVE result governs the §11 presence
  rule — the artifact's presence claims are never trusted (a claimed
  `present` for the still-absent ui/ui-svelte is overridden to
  `absent`, blocking publication exactly as before).
- Latent §11 classifier defect found and fixed while implementing the
  reclassification (verified against the npm 11.19.1 source):
  `npm trust list <pkg> --json` actually emits
  `{ id, type: 'github', file, repository, permissions:
  ['createPackage'] }` — the raw API permission key, with `file`
  (not `workflowFilename`), one pretty JSON blob per config, and an
  EMPTY output for a package with no configs. The r4 classifier would
  have misread this REAL shape as CONFLICTING (it accepted only the
  display spelling `publish`/an `allowPublish` flag), would have failed
  on concatenated documents, and (r5 validator) needed to accept an
  empty capture as honest `missing` evidence. The classifier now
  accepts the raw `createPackage` key (stage-publish
  `createStagedPackage` deliberately stays a conflict), parses
  concatenated JSON documents, and treats an empty capture as MISSING.
  The four semantic requirements are unchanged: GitHub provider, exact
  repository, exact workflow file, publish permission, no environment.
- Negative tests (each refuses publication — evidence-mode preflight
  returns `authorized: false`, `stage: 'blocked'`, `NOT CREDIBLE`,
  before any probe and therefore before the first package): an
  otherwise valid artifact with `exitCode: 1`, an invented hash,
  altered captured output, forged `trust: exact`, a wrong member
  binding, a duplicate result, non-member noise, a v1 artifact, and
  stale time. All 14 r5-marked evidence tests FAIL on r4 and PASS on
  r5.

### What the evidence check proves — and what it cannot prove

PROVEN by a validating v2 artifact: for every frozen member there is a
recorded, SUCCESSFUL (`exitCode: 0`) run of the exact official
read-only command for that member; the retained captured output is
byte-pinned by its sha256; that output — classified by the same code
path as a live check — carries the exact frozen trust relationship
(github radz2291/vict-02 / release.yml / publish / no environment);
the whole artifact is bound to the current coherent version and the
current content-derived set identity and is inside a 24-hour window.
Registry presence is NOT taken from the artifact at all: the gate
re-proves it live at release time.

NOT PROVEN, stated plainly:

- WHO created the artifact. A self-consistent hash and a timestamp
  authenticate NOTHING about the creator. The artifact carries no
  independently verifiable signature or equivalent provenance; its
  integrity rests on the operator ceremony — the same §13 trust model
  under which every historical package was published. Anyone with
  write access to the repository could hand-craft a technically valid
  artifact. No cryptographic authenticity is claimed anywhere in the
  code or docs.
- That trust did not change between capture and publication. The 24-hour
  freshness window bounds this TOCTOU gap; it cannot close it. Registry
  presence is re-proven live; trust relationships cannot be re-proven
  from CI under the frozen no-secret policy.

Concrete owner choices (no green gate is manufactured):

1. Accept the operator-evidence ceremony for CI (ratify §16 with
   D-AUTHORIZE) — CI publication then runs on the v2 evidence model
   above, with the residual operator-integrity limit recorded here.
2. Amend the frozen §4 no-secret policy to allow a READ-ONLY
   authenticated npm session in CI so `npm trust list` runs live at
   release time (no evidence artifact needed; strongest proof).
3. Keep CI publication blocked entirely — the owner performs
   publications from an authenticated local environment (live checks;
   CI remains validate/rehearsal-only).

Until the owner decides and §16 is ratified into the frozen contract,
every registry write remains blocked BY DESIGN (the contract-authority
gate), regardless of any evidence artifact.

## Defect 3 — the owner decision was not an exact line

Finding (confirmed): `extractOwnerDecision` searched for the decision
phrase anywhere inside §16.5 (`Owner decision recorded:\s*(D-AUTHORIZE|
D-REVERT)`). PROSE quoting the phrase authorized the release, and so
did the exact phrase followed by a trailing annotation on the same line
(e.g. `Owner decision recorded: D-AUTHORIZE (ratified 2026-09-27)` —
the lookahead tolerated the suffix).

Correction (exact FULL line, §16.5-scoped):

- The decision must be EXACTLY ONE line whose entire (trimmed) content
  is `Owner decision recorded: D-AUTHORIZE` or
  `Owner decision recorded: D-REVERT` — case-sensitive, exact token,
  nothing else on the line. Surrounding indentation is tolerated; any
  other text on the line makes it prose, and prose mentioning the
  phrase or tokens is refused as `malformed`.
- Duplicate identical lines, or one of each choice, are `ambiguous`;
  a marker outside §16.5 is invisible (unchanged r4 property); a §16.5
  section with no decision attempt at all is `missing`.
- The git-ancestry consistency check is PRESERVED untouched: the
  recorded choice must still agree with the branch's real history via
  `git merge-base --is-ancestor` (D-AUTHORIZE: named consuming commits
  ARE ancestors; D-REVERT: they are REMOVED; unavailable/unresolvable
  git refuses fail-closed).
- Before/after (encoded as tests, failing on r4 / passing on r5):

| §16.5 record content | r4 gate | r5 gate |
| --- | --- | --- |
| Exact line `Owner decision recorded: D-AUTHORIZE` (plus ancestry) | AUTHORIZED | AUTHORIZED (unchanged) |
| Same line with a trailing annotation `(ratified …)` | **AUTHORIZED (defect)** | REFUSED — owner decision malformed |
| Prose quoting the phrase ("minutes quote: …") | **AUTHORIZED (defect)** | REFUSED — owner decision malformed |
| `d-authorize` (lowercase) | **AUTHORIZED (defect)** | REFUSED — owner decision malformed |
| Line twice, or both choices | REFUSED (ambiguous) | REFUSED (ambiguous) |
| Marker outside §16.5 | REFUSED | REFUSED |
| No decision attempt in §16.5 | REFUSED | REFUSED |

## The CI trust-proof model (precise form)

- **Registry presence** — proven LIVE by CI at release time: read-only
  packument fetches, no npm session required, every publication path,
  both modes. This is independent verification, not evidence.
- **Trust relationships** — cannot be proven live from CI
  (authentication-gated; the no-secret policy forbids an npm session).
  CI accepts exactly two proofs: a LIVE authenticated check (operator
  environment) or a VALIDATED v2 evidence artifact whose trust
  classification is recomputed from its retained captured output at
  gate time.
- **Authority** — orthogonal and still supreme: no registry write
  happens unless the frozen contract carries the ratified §16 state
  with the EXACT §16.5 decision line consistent with real git history.

Remaining human-trust and timing limits (honest, by design): artifact
provenance is operator-ceremony-backed, not cryptographically
authenticated (no signature; self-hash + timestamp prove nothing about
the creator); trust state can change inside the 24-hour capture window
(presence does not have this gap — it is re-proven live). These limits
are exactly what the owner's ratification decision (choice 1 above)
would consciously accept, or replace (choice 2), or avoid (choice 3).

## Gate table (state after this branch)

| Gate | Check | State today |
| --- | --- | --- |
| Structural | release-set coherence (14 pkgs, 0.4.0-rc.1, identity `v1_2a70a29af12fa88…`) | GREEN (verified) |
| Structural | format / lint / typecheck / build | GREEN (verified) |
| Structural | full script-tooling suite incl. r5 negatives | GREEN (verified) |
| Structural | builder-kit stable layer (18/18, same recorded digests) | GREEN (verified) |
| Structural | packed-consumer / browser proofs | NOT RERUN — inputs byte-unchanged |
| Structural | workflow evidence wiring (validate + preflight + publish; env-only) | GREEN (verified by tests) |
| Authority | contract-authority (§16 ratified INTO the frozen file) | **RED by design** — §16 unratified |
| Authority | §16.5 exact owner decision line + ancestry consistency | **RED by design** — no decision recorded |
| Registry write | trust preflight AUTHORIZED (all 14 present + exact) | **RED by design** — ui/ui-svelte absent (bootstrap not owner-authorized) |
| Registry write | bootstrap publication / coordinated publication | **RED by design** — blocked behind both gates above; G3 HELD |

## Unchanged (verified)

- No UI package source, behavior, or test changed; the only modified
  files are release tooling, the workflow, tests, and this record.
- No manifest, workspace (`package.json`/`package-lock.json`), or
  lockfile change: `verify:release-set` ALL (14 packages, 0.4.0-rc.1,
  same recorded identity), `verify:builder-kit` 18/18 with the same
  recorded digests.
- No registry state, trust relationship, or trust configuration was
  touched (every gate and probe is read-only; all publication paths
  refused at the authority gate — confirmed by the r4 tests retained in
  the suite).
- The frozen contract file and the §16 draft are byte-untouched; Stage
  8 records untouched; **Stage 8 G3 remains HELD**. Stop before
  ratification, merge, trust configuration, bootstrap publication, or
  coordinated publication.

## Checks run on this branch

- Focused release tooling: `scripts/test/` — 7 files, 230 tests, ALL
  PASSING (release-authority 63, trusted-publishing 72, bootstrap 9,
  release-evidence, tarball-set, import-scan, lint-scope).
- The r5-marked tests were also run against the r4 tip in an isolated
  worktree: 14 FAIL there and PASS here (the before/after proof).
- `npm run format:check` (the only warning is the pre-existing
  untracked `pi-session-*.html` session recording, present before this
  work), `npm run lint`, `npm run typecheck`, `npm run build`,
  `npm run verify:release-set`, `npm run verify:builder-kit` — ALL
  GREEN. Packed-consumer and browser proofs were not rerun: their
  inputs (packages/examples/packs) are byte-identical to the base tip.
