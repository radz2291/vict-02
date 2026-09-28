# Release-readiness corrections record — r4 (2026-09-27)

Branch `pi/release-readiness-r4`, isolated, one commit on top of
`pi/release-readiness-r3` @ `8b75c3ac31fed62af1eb8eb7147ff830a8b0a8bf`.
Scope: the three r4 review defects. The UI implementation, the
14-package inventory, and the `0.4.0-rc.1` candidate are UNCHANGED (no
manifest/lockfile edits; `verify:release-set` ALL, `verify:builder-kit`
18/18 with the same packId). Nothing is ratified, merged, trusted, or
published; the frozen contract file is byte-untouched; Stage 8 is
untouched; **G3 remains HELD**.

## Defect 1 — the owner decision was not enforced

Finding (confirmed): the authority gate accepted the mere PRESENCE of
the §16.5 heading, while the draft requires the owner to choose
D-authorize or D-revert. A ratified-but-unsigned record would have been
accepted.

Correction (enforcement, not ceremony):

- `scripts/lib/contract-authority.mjs` now extracts the §16.5 section
  (and ONLY that section — a marker dropped anywhere else is invisible
  to the check by design) and requires EXACTLY ONE exact decision line:
  `Owner decision recorded: D-AUTHORIZE` or
  `Owner decision recorded: D-REVERT` (case-sensitive, exact form).
- The recorded choice is cross-checked against the branch's REAL git
  history (`git merge-base --is-ancestor`, via a verifier created at
  the repo root; unavailable git → refuse fail-closed; unresolvable
  SHAs → refuse fail-closed):
  - **D-AUTHORIZE**: every consuming commit named in §16.5 must BE an
    ancestor of the checked-out source — on THIS implementation branch
    (`bac9c0164…`, `d8c70df2…`, and this branch are in the history) only
    an explicit D-AUTHORIZE can ever permit the 14-package release path;
  - **D-REVERT**: every named consuming commit must have been REMOVED
    from the branch's history — the gate refuses the contradiction of a
    D-REVERT recorded while the implementation is still present.
- Missing, ambiguous (both lines, or the line twice), malformed
  (tokens mentioned without the exact line), or contradictory choices
  all refuse, each with a distinct, named problem. A heading, a
  summary, or a self-authored authorization marker anywhere else is
  NOT an owner decision.
- **The real branch stays RED**: the frozen contract is still at the
  §14 state (no §16 record at all), so the gate refuses with the full
  gap list; and even after the owner ratifies, the gate stays red until
  the decision line is recorded.
- The draft's §16.5 text (body + Appendix B record) now specifies this
  exact mechanism. The Appendix B record intentionally does NOT contain
  either verbatim decision line — pasting it verbatim yields a
  ratified-but-unsigned state, which the gate refuses; the owner must
  append exactly one line. Governance limit, stated honestly: the gate
  enforces the RECORDED decision's internal consistency against real
  history; the authority of the record itself rests on the frozen
  contract being owner-governed — the same trust model as the whole
  contract.

Before/after probes (also encoded as tests, see below):

| State | r3 gate | r4 gate |
| --- | --- | --- |
| Real frozen contract (§14, unratified) | REFUSED | REFUSED (same gaps) |
| Appendices A+B applied, NO decision line | **ACCEPTED (defect)** | REFUSED — "owner decision malformed … records no exact `Owner decision recorded:` line" |
| Decision line + consuming commits ARE ancestors | n/a | AUTHORIZED |
| `Owner decision recorded: D-REVERT` while implementation still in history | ACCEPTED (defect) | REFUSED — "D-REVERT is recorded, but the consuming implementation commit(s) … are STILL ancestor(s)" |
| D-AUTHORIZE + git verifier unavailable | n/a | REFUSED fail-closed |

## Defect 2 — the trust preflight was optional

Finding (confirmed): `verify-trust-preflight.mjs` existed standalone,
but `release.yml`, `oidc-release validate|publish`, and
`publish-release.mjs --publish` never invoked it — a publication path
could have published the first member with unverified trust.

Correction (mandatory, pre-write, resume-inclusive):

- New shared engine `scripts/lib/publication-preflight.mjs`:
  `assessPublicationPreflight` owns the probing (registry existence via
  read-only packument probes; trust via the official
  `npm trust list <name> --json`), so the CLI and the engines cannot
  drift. THE SET-WIDE RULE unchanged: publication of ANY member is
  refused unless ALL 14 exist and carry the exact relationship — there
  is no "publish the ready subset" path.
- Wired immediately AFTER the contract-authority gate and BEFORE any
  registry call or write in: `oidc-release.mjs validate` AND `publish`
  (the resume path lives inside publish, so resumes are covered),
  `publish-release.mjs --publish`, and `release.yml` — a dedicated
  "Trust preflight gate" step (with `--require-authorized`) between the
  authority gate and the publish step, with an optional
  `trust_evidence_path` workflow input passed to the engine as env
  (never shell-interpolated).
- **How trust proof can be obtained in GitHub Actions under the frozen
  no-secret policy — investigated, with limits:**
  - LIVE verification is impossible in CI: `npm trust list` is
    authentication-gated. Re-verified read-only with the pinned npm:
    `npm error 401 Unauthorized … "You must be logged in to publish
    packages."` — and the workflow holds no npm credential by policy
    (§4).
  - PUBLISHED-PROVENANCE READ-BACK was investigated: the registry's
    public attestation endpoint exists for the historical `0.3.1`
    publications (`/-/npm/v1/attestations/@victframework%2fcontracts@0.3.1`),
    but it exposes EMPTY predicates (`predicate: {}`) — and even a
    cryptographically verified bundle would only prove the PAST publish
    event, not the CURRENT trust configuration (mutable afterwards).
    For the two ABSENT members (`ui`, `ui-svelte`) there is nothing to
    read back at all. **Not a credible pre-write proof.**
  - Therefore the ONLY accepted proofs are: (a) a LIVE authenticated
    check (operator session, local), or (b) a VALIDATED operator-
    evidence artifact captured during the release window
    (`scripts/capture-trust-evidence.mjs`): schema-marked
    (`vict-trust-preflight-evidence/1`), freshness-bounded (≤24h),
    pinned to the CURRENT coherent version AND the CURRENT
    content-derived set identity, member-complete (exactly the 14), and
    per-member bound (official command + exit code + sha256 of the raw
    output). Arbitrary or stale JSON is refused with named binding
    failures — the r3 `--evidence` free-form map is gone.
  - HONEST LIMIT: the artifact binds the capture to the set, version,
    and time window; the integrity of the captured output rests on the
    operator ceremony — exactly the §13 trust model under which every
    historical package was published. GitHub cannot independently
    verify trust pre-write under the current rules.
  - **Consequence (fail-closed, by design): CI publication — and CI
    validate_only rehearsals, which run the same gate chain — stays
    blocked at this gate until the owner resolves the trust-proof
    decision (see below).**

## Defect 3 — the bootstrap artifact was broken

Finding (confirmed and REPRODUCED): the r3 temp-copy stripped `dist` —
but `@victframework/ui` publishes ONLY `dist` (`files: ["dist"]`). The
r3 process would have published a one-file tarball (`package.json`
only) that violates its own manifest.

Before/after probe (exact reproduction of the r3 process, dry-run):

```text
R3 BEHAVIOR — ui placeholder tarball would contain:
  - package.json
declared export targets missing from tarball: dist/index.js, dist/index.d.ts
VERDICT: BROKEN artifact (violates its own manifest) — the r3 defect, now fixed by r4
```

Correction (`scripts/lib/bootstrap-pack.mjs` +
`first-publish-bootstrap.mjs` refactor):

1. the member is BUILT in the real workspace first
   (`npm run build --workspace <name>`);
2. the temp copy is FAITHFUL (only `node_modules` and stray tarballs
   excluded — the dist-stripping filter is gone);
3. the TEMP COPY's manifest is re-versioned to the fixed
   `0.0.0-bootstrap.1`; dependencies and every other field stay
   verbatim;
4. `npm pack --dry-run --json` yields the ACTUAL tarball file list
   (no artifact persisted, no registry call);
5. the candidate is VALIDATED: every declared export/main/types target
   must exist in the tarball, the `files` allowlist must be covered,
   dependencies must equal the source pins, no
   workspace:/link:/file: protocol may leak. `--execute` refuses to
   publish a candidate with any validation failure; `--inspect` runs
   the whole build+pack+validate for every absent member and prints the
   evidence.

Inspected placeholder tarballs (actual dry-run contents, exit 0 —
`node scripts/first-publish-bootstrap.mjs --inspect`):

- `@victframework/ui` → `victframework-ui-0.0.0-bootstrap.1.tgz`,
  **10 files**, 9124 bytes: `package.json` + the full built `dist`
  (`index.js/.d.ts/.js.map`, `composition.*`, `feedback.*`). Every
  declared export target present; `files: ["dist"]` covered;
  dependencies: none.
- `@victframework/ui-svelte` →
  `victframework-ui-svelte-0.0.0-bootstrap.1.tgz`, **135 files**, 55582
  bytes: the complete `src` tree (all 45 declared export targets
  including every `./catalog/*` module and `./styles.css`), the
  declaration-only `dist` (`.d.ts`), `FOUNDATION-CATALOG.md`,
  `CATALOG-USAGE.md`, `catalog-coverage.json`, `package.json`.
  Dependencies VERBATIM: `@internationalized/date ^3.12.4`, `bits-ui
  ^2.19.3`, and `@victframework/{application,sdk,ui}` pinned to
  `0.4.0-rc.1`.

**Installability, addressed truthfully:** `ui-svelte`'s placeholder is
NOT installable until the coordinated set publishes — its internal
dependencies pin the UNPUBLISHED `0.4.0-rc.1`, so resolution fails BY
DESIGN (which is precisely what prevents the placeholder from ever
being consumed as a release). `ui` has no dependencies, so the
placeholder itself installs standalone — but it remains a
registry-presence marker, never a functional release: fixed
`0.0.0-bootstrap.1` version, `bootstrap` dist-tag only, `latest` stays
unoccupied. This truthful purpose is now documented in the §16 draft
(body + Appendix B record): the placeholders exist ONLY so the
packages EXIST and their trust relationships can be configured.

## Tests (would fail on r3)

`scripts/test/release-authority.test.mjs` (46 tests) and
`scripts/test/bootstrap-artifact.test.mjs` (9 tests):

- decision matrix: missing / both-tokens-ambiguous / duplicate-line
  ambiguous / informal-line malformed / misplaced marker ignored /
  D-AUTHORIZE+ancestors authorized / D-AUTHORIZE+absent refused /
  D-AUTHORIZE without verifier refused / D-REVERT-while-present
  refused (injected verifiers);
- end-to-end REAL git: D-AUTHORIZE with real ancestor commits → CLI
  AUTHORIZED; D-REVERT while commits still ancestors → CLI refused;
  D-REVERT against an orphan-commit ("reverted") history → CLI
  AUTHORIZED; ancestry verifier true/undefined semantics;
- evidence binding: r3-style arbitrary map refused (schema), stale
  refused, wrong version / wrong identity refused, partial or
  non-member sets refused, unbound commands / missing sha256 refused;
  a credible artifact → preflight AUTHORIZED in evidence mode;
- wiring (fails on r3 by construction): `release.yml` contains the
  "Trust preflight gate" step with `--require-authorized` + evidence
  input between the authority gate and publish; `oidc-release.mjs`
  calls the preflight in BOTH validate and publish before any
  unpublished-guard/resume work; `publish-release.mjs` invokes the
  shared assessment; arbitrary `--trust-evidence` still refuses at the
  AUTHORITY gate first (ordering);
- bootstrap artifact: real builds + dry-run packs for both absent
  members — `ui` contains `dist/index.js`/`dist/index.d.ts` (r3 would
  not), `ui-svelte` contains all 45 export targets + declaration-only
  dist + verbatim `0.4.0-rc.1` pins (documenting intentional
  non-installability); tamper detection (missing dist = the r3 state;
  dependency mutation; workspace-protocol leakage).

## Gates on this branch

GREEN NOW (verified): `format:check` EXIT 0; `lint` EXIT 0 (14
findings fixed at root, including a real `liveNames` reference bug the
lint pass caught in the new preflight engine); `typecheck` EXIT 0;
scripts/test project **7 files, 208/208** (incl. the two new suites);
`verify:release-set` ALL (14, 0.4.0-rc.1, `v1_2a70a29a…` — identity
unchanged); `verify:builder-kit` **18/18** (packId `3b1f40d5…`
unchanged — no kit inputs touched). Packaging unchanged →
`verify:release-consumer` not re-run (the full pass stands).

RED BY DESIGN (fail-closed until owner action; all demonstrated without
registry writes): `verify-contract-authority` (exit 1, full gap list —
stays red even after ratification until the §16.5 decision line is
recorded); `oidc-release validate|publish` (authority-refused first,
preflight second); `publish-release --publish`; `trust-bootstrap
--execute`; `first-publish-bootstrap --execute` (without authority +
authorization artifact); `verify-trust-preflight --require-authorized`
(2 absent members + all trust unverifiable without a session → set-wide
refusal, exit 1); `release.yml` publication (and validate_only
rehearsals) — blocked at the authority gate today, at the preflight
gate once §16 is ratified but the CI trust-proof decision is not made.

## Owner decisions required (consolidated)

1. **Ratify §16** (Appendices A + B verbatim into the frozen contract).
2. **Record the §16.5 decision line** — on this branch only
   `Owner decision recorded: D-AUTHORIZE` permits the 14-package path
   (D-REVERT requires actually reverting the implementation first; the
   gate verifies the real git history either way). Ratification without
   the line stays fail-closed.
3. **Resolve the CI trust-proof decision** (no pre-write npm trust
   verification is possible in GitHub Actions under the frozen
   no-secret policy — E401 re-verified; provenance read-back proves
   only the past publish event and does not exist for the absent
   members). Options: (a) accept the operator-evidence ceremony for CI
   (capture fresh evidence via `scripts/capture-trust-evidence.mjs`,
   pass via the `trust_evidence_path` input; integrity rests on the
   §13 operator trust model), (b) amend §4 to allow a minimal scoped
   read-only automation token for `npm trust list`, or (c) amend §11 to
   require provenance-attested publications and accept attestation
   read-back as future evidence. Until one is chosen, CI publication
   fails closed at the preflight gate; local publication with an
   authenticated session works without it.
4. **Then, in order**: bootstrap placeholders for `ui` + `ui-svelte`
   (`first-publish-bootstrap.mjs --inspect` first, then `--execute`
   with the owner authorization artifact) → `trust-bootstrap --execute`
   → preflight AUTHORIZED for all 14 → only then the coordinated
   `0.4.0-rc.1` release under `vict-0.4.0-rc`.
