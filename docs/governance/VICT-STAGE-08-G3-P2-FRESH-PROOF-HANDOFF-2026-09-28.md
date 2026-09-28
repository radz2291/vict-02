# Stage 8 G3 — fresh P2 proof handoff for the 0.4.0-rc.1 release (2026-09-28)

> **Document type:** operator handoff (task 5 of the release-execution
> handoff). NOT an evidence record, NOT a claim. The G3 gate decision
> (pass / fail / fix-round) belongs to the owner and the independent
> audit; **G3 remains HELD** and no Verified claim is made or implied.

## 1. Why a fresh proof is required

The frozen P2 proof (`docs/governance/VICT-STAGE-08-G3-P2-EVIDENCE-2026-09-26.md`)
is pinned, by design, to the PUBLISHED `0.3.1` set
(`vict-release-set@1/0.3.1`, content ID
`v1_1c695280d3afec5e91bfc75d3c99a5a85bc27f6d91127c4d0ce7bd51563c2583`).
A new release does not retroactively pass that frozen proof: its
registry pins, its builder-kit artifact, and its application manifest
all bind to 0.3.1 bytes. The frozen record therefore stays exactly as
it is (history; byte-untouched), and the candidate needs its OWN
TaskLedger-style P2 proof against the actually published set once the
coordinated release is out.

## 2. Exact release identity to hand to the Stage 8 operator

| Item | Value |
| --- | --- |
| Candidate version (all 14 members) | `0.4.0-rc.1` |
| Release-set identity (content-derived, recomputed == recorded) | `v1_2a70a29af12fa887d18e7099b027a11f86bd2f6a70a756446fb43844e41d9399` |
| Release-set schema | `vict-release-set@1` |
| Members | contracts, ui, sdk, kernel, runtime, store-sqlite, application, ui-svelte, appdata-sqlite, scaffolder, control, mastra, server, cli (frozen §5 order) |
| Dist-tag after publication | `vict-0.4.0-rc` on every member; `latest` NOT moved (still the historical stable) |
| Release source at handoff time | `radz2291/vict-02` `main` @ `46988a6a45a31d76629570e12024c6ca92f17d0c` (merge of `pi/release-exec-r1` @ `b0619b1`; base `9b6eb01e32c1a2d81368c8231cb1bb037a702bfa`) |
| Dispatch source_sha | the exact pushed main-lineage SHA supplied to the workflow at dispatch (must be an ancestor of origin/main at run time; record it from the workflow run) |
| Bootstrap placeholders (authorized §16 exception) | `@victframework/ui@0.0.0-bootstrap.1`, `@victframework/ui-svelte@0.0.0-bootstrap.1`, dist-tag `bootstrap` — registry-presence markers, NOT releases; never cited as the candidate |
| **PUBLISHED (2026-09-28)** | run [`36427806906`](https://github.com/radz2291/vict-02/actions/runs/36427806906), source `d7bd003047a648738a4d1d824b0c4e4a442c0da3`: all 14 at `0.4.0-rc.1` under `vict-0.4.0-rc`; 14/14 registry `dist.integrity` match the run-recorded digests (`release-results.json` artifact); `latest` untouched (12 × `0.3.1`); independent external consumer (`verify:release-consumer --registry`) ALL PASSED. See docs/RELEASE-EXEC-R3-2026-09-28.md. |
| Authority | §16 ratified; §16.5 exact line `Owner decision recorded: D-AUTHORIZE` in the frozen contract |

Post-publication verification the operator should demand (independent
of the release run):

- `npm view @victframework/<member>@0.4.0-rc.1` resolves for all 14;
  `dist-tags['vict-0.4.0-rc'] == '0.4.0-rc.1'` for all 14; `latest`
  unchanged for the 12 historical members and unoccupied for
  ui/ui-svelte;
- every published `dist.integrity` matches the release-run tarball
  digests recorded in the run's `release-results.json` artifact;
- `verify:release-consumer -- --registry` (clean external consumer off
  the PUBLIC registry) passes against the published set;
- the release workflow run ID + its `release-evidence` artifact are
  attached to the handoff.

## 3. Fresh P2 proof — exact procedure (mirrors the frozen P2, re-pinned)

Inputs to pin FIRST (evaluator records SHA-256 of every input, exactly
as the frozen proof did):

1. **P2 brief** — the same verbatim brief bytes as the frozen proof
   (`taskledger-brief.txt`, frozen digest `046558c9f99a05b6812ab0db10ec51e8fe5873964af03b3bee78e8eb56476a0d`).
   If the owner re-issues the brief for the new release, pin the NEW
   bytes and say so explicitly.
2. **Evaluator rubric** — the same F1–F8 rubric + claims table
   (`b7531d5b621bc670d2cc1b5ed4c10077f541ff4119b0290d72b15d85ad65a9b0`),
   evaluator-only, outside the builder workspace.
3. **Builder Kit artifact** — `@victframework/builder-kit` built from
   the EXACT release source SHA; pack it (`npm pack`), pin the
   tarball's SHA-256; record the kit's own regenerated identity
   (`verify:builder-kit` 18/18 at that SHA).
4. **Clean-consumer start state** — a NEW empty directory (no
   package.json, no git repo), outside VICT and all worktrees; record
   its emptiness.
5. **Release-set binding** — `vict-release-set@1/0.4.0-rc.1`, identity
   `v1_2a70a29af12fa88…` (recomputed == recorded), with registry
   evidence: 14/14 packages at `0.4.0-rc.1`, tag `vict-0.4.0-rc`, every
   `dist.integrity` matched against downloaded bytes, every internal
   pin exact.

Builder session (identical isolation discipline to the frozen proof):
separate process, fresh context, flags `-nc -ns -ne -np`; supplied ONLY
the empty workspace, the brief, the kit tarball + SHA, and the
release-set id; full-transcript isolation audit (zero references into
the VICT tree outside the allowed inputs); any interruption disclosed
and resumed from the persisted transcript.

Delivered application must demonstrate, at `0.4.0-rc.1`:

- app manifest pins all 14 platform packages at exact `0.4.0-rc.1`
  (registry URLs + sha512 in the lockfile; `ui` and `ui-svelte` are now
  FIRST-CLASS members — the scaffold installs them from the registry,
  including the renderer; the facade package is NOT referenced);
- `npx vict-builder-kit verify --app` — 5/5 (schema, packId identity,
  bootstrap binding, input provenance, release-set identity of all 14
  installed packages), reproduced after rebuild;
- `npm run build` exit 0; app served HTTP 200;
- builder tests exit 0;
- real-browser record (real Chrome via CDP, real keyboard): the F3
  surface that failed in the frozen proof (task table island) must be
  exercised explicitly — its prior defect was fixed and re-proven on
  the workspace; the published-set proof must show it mounting;
- governed action probes at the declared `/api/act` boundary: exact
  input `ok`, undeclared input `CONTRACT_REJECTED`, unknown id,
  idempotent replay; durable ledger rows observed read-only
  (`vict_activation` / `vict_run` / `vict_run_event`);
- restart probe (hard process kill → restart → byte-identical state
  digest, ledger intact) and rebuild probe (content-identical rebuild →
  identical `applicationVersion`, `verify --app` green);
- negative controls: content drift → fail-closed → restore → green;
  pack tamper (schema-invalid AND schema-valid value change) → fail
  closed → restore → green;
- F1–F8 scored against the byte-pinned rubric, every score evidenced.

## 4. Disposition

- The frozen 0.3.1 P2 record is NOT amended, re-scored, or re-parsed;
  it stands as history.
- G3 stays **HELD** until BOTH: (a) the owner records the formal
  criterion/version disposition (which set version G3's criterion is
  judged against going forward), and (b) the fresh proof above is
  accepted by the owner + independent audit.
- Nobody claims Verified on the operator's or the agent's authority.

## 5. Gate outcomes at handoff time (2026-09-28, main `46988a6a45a31d76629570e12024c6ca92f17d0c`)

| Gate | State |
| --- | --- |
| Contract authority (§16 ratified + D-AUTHORIZE + ancestry) | GREEN (verified, CLI + tests) |
| Release-set coherence (14 pkgs, 0.4.0-rc.1, `v1_2a70a29af12fa88…`) | GREEN (verified) |
| Build / full test suite / static gates / packed-consumer / browser proofs | GREEN (verified on this exact source; see docs/RELEASE-EXEC-R1-2026-09-28.md) |
| Registry writes (bootstrap placeholders) | BLOCKED pending owner-signed authorization artifact + interactive npm 2FA (draft prepared; §16 exception) |
| Trust relationships for ui/ui-svelte | BLOCKED until the placeholders exist, then `trust-bootstrap --execute` + live/evidence verification |
| Coordinated publication | BLOCKED behind the trust preflight (all 14 present + exact) and the authority gate; `validate_only` rehearsal recommended first |
| G3 | **HELD** (frozen P2 pinned to 0.3.1; fresh proof pending publication) |
