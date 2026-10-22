# Designer and UI-foundation main integration — 2026-10-22

**Verdict: PASS WITH NON-BLOCKING FINDINGS.** Owner-accepted Designer closure
remains **CLOSED — PASS WITH NON-BLOCKING FINDINGS; OWNER ACCEPTED**.
This record covers authorized main integration only; no publication or deployment.

## Baseline, identity and method

- Repository verified by Git remote and GitHub metadata: `radz2291/vict-02`,
  `https://github.com/radz2291/vict-02.git`.
- Starting live `origin/main`: `4d2df037d8a82d36c60bf1bff16919650643ce22`.
- Accepted source branch: `codex/studio-designer-independent-verification`.
- Exact closed delivery and tested integration product tree:
  `9010c5aff2afb1fb792bf1a1cb15ddf9a92cae55`, local/remote matched after fetch.
- Accepted product: `ba0304693487292e354374b1bd93908506eb2da9`, an ancestor of
  that delivery. Subsequent changes are verification records plus one independent
  test; all product sources, scripts, manifests and lockfiles match the accepted
  product. No integration product repair or behavioral difference was introduced.
- Isolated integration branch: `codex/studio-designer-main-integration`;
  checkout `C:/Users/RZ1/.codex/worktrees/studio-designer-main-integration/260831-VCT-02`.
  Created clean at the exact closed delivery. Final integration commit adds only
  these records/evidence and documentation entry links. Its full SHA is reported
  with the verified remote main SHA at delivery, avoiding a circular self-pin.
- Method: normal fast-forward from starting main through accepted source to the
  integration-records descendant. Main is an ancestor; no conflicts, squash,
  rebase, history rewrite, force-push or branch deletion is needed.
- Existing source worktrees remain untouched. The original main checkout remains
  at its starting commit with its pre-existing untracked builder-kit archive;
  origin/main is the delivered mainline. Running owner servers and browser data
  were not reset or moved. The integration smoke used its own port/origin 5588.

Live GitHub branch metadata reports main unprotected, required status checks off;
repository rulesets are empty (captured in `integration-2026-10-22/`). The checked-in
workflows are manual release/evidence workflows, not push-triggered checks. No
protection settings or release workflow were changed or bypassed. Main is rechecked
immediately before its normal update; concurrent movement must be reconciled.

## Complete proposed diff and ancestry review

Starting main to closed delivery: **1,120 paths**, 1,092 additions and 28
modifications, no deletions; 218 commits, 224,235 insertions and 74 deletions.
The full path/status and numstat inventories and lineage are retained in
[integration evidence](integration-2026-10-22/). Review included the complete path
inventory, ownership/closure records, package/export/build/dependency changes and
source boundaries. Existing independent foundation and Designer evidence is reused
for the byte-identical product, rather than claiming a new line-by-line audit of
all imported historical evidence.

This is the full accepted ancestry, not a Studio-only cherry-pick:

- Canonical UI document/compiler/edit/session/storage contracts in `packages/ui`.
- `vict.application@3` attachment and application identity support in application
  and SDK; passive contract presentation metadata in contracts.
- Shared Svelte document renderer/catalog, public exports and exact bits-ui pin.
- Reusable UI editor and preview orchestration packages, including simulation
  boundaries, explicit adapters and reset/session fencing.
- Designer/replay routes and host integration in Studio, associated tests, proof
  consumers, packed workflow and build/test configuration.
- Foundation contracts, freeze/closure/review history and retained failed evidence
  (741 documentation/evidence paths). The root `dump6.json` is inherited renderer
  probe output, not a newly added product artifact. No Stage 9 governance,
  architecture, handoff or release-workflow diff is part of this integration.

Foundation U0–U4 scoped acceptance and catalog evidence tiers remain as recorded.
Original Designer FAIL `67a47c3732a2527c8c7086dfcae184672f1aae96`, B-1 repair
`b69a4532d8cf09a59240ce2680f9bc68413cbc9a`, independent recheck and owner
acceptance are preserved. See [Designer closure](DESIGNER-CLOSURE-2026-10-22.md),
[technical report](verification-2026-10-22/FINAL-VERIFICATION.md) and
[foundation handoff](../ui-foundation/U4-STUDIO-HANDOFF.md).

## Exact-candidate checks

Checks ran against committed `9010c5aff2afb1fb792bf1a1cb15ddf9a92cae55` in the
isolated integration checkout; final changes are records only, with product-byte
comparison repeated before main delivery. Windows PowerShell, Node v22.13.1,
npm 11.19.1. Logs are in `integration-2026-10-22/`.

| Check                                                                                                                                                                                | Final result                                                               | Evidence                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm ci`                                                                                                                                                                             | PASS, 532 packages added                                                   | install.log                                                      |
| `npm run build`                                                                                                                                                                      | PASS                                                                       | build.log                                                        |
| `npm run build -w vict-studio`                                                                                                                                                       | PASS                                                                       | studio-build.log                                                 |
| `npm run typecheck`                                                                                                                                                                  | PASS                                                                       | typecheck.log                                                    |
| `npm run check -w vict-studio`                                                                                                                                                       | PASS                                                                       | studio-check.log                                                 |
| `npm run check:designer -w vict-studio`                                                                                                                                              | 0 errors, 6 inherited warnings                                             | designer-check-final.log                                         |
| `npm run test -w vict-studio`                                                                                                                                                        | 122 tests, 19 files PASS                                                   | studio-tests-final.log                                           |
| `npx vitest run --project unit packages/ui/test packages/ui-editor/test packages/ui-preview/test packages/application/test packages/contracts/test packages/sdk/test --maxWorkers=2` | 1,216 tests, 37 files PASS                                                 | shared-unit.log                                                  |
| `npx vitest run --project renderer --maxWorkers=2 --testTimeout=15000`                                                                                                               | 307 tests, 47 files PASS                                                   | renderer.log                                                     |
| `node scripts/pack-u4-consumer.mjs` with fresh `U4_ISOLATED_ROOT`                                                                                                                    | 10 tarballs, 16 tests; isolated build/both entries/no workspace links PASS | packed-consumer.log; pack-manifest.json                          |
| Static finished-entry closure with Designer positive controls                                                                                                                        | 22 static files; four editor/preview markers excluded, PASS                | bundle.json; check-bundle.mjs                                    |
| Production browser create/edit/save/reopen/run and identity                                                                                                                          | PASS                                                                       | browser-smoke.json; smoke-saved-source.json; saved-run-smoke.jpg |
| Documentation links/status, diff whitespace and product-byte equality                                                                                                                | PASS                                                                       | final delivery checks                                            |

The first Studio test run was mistakenly launched before the clean checkout's root
build had completed: 10 suites failed package resolution, 83 tests passed. The first
Designer check likewise ran before editor/preview build completion and reported
4 errors/6 warnings. Both failed logs are preserved (`studio-tests.log`,
`designer-check.log`); correctly ordered reruns pass above without source edits.
This is an integration-check ordering error, not a product repair or hidden pass.
The renderer timeout allowance is explicit and is not a performance guarantee.

The smoke used the production adapter-node build, signed in locally, followed the
operator shell's Designer link, created **Main integration smoke**, inserted and
edited a heading, saved r1.r1, reloaded the stored screen, compared reopened Source
byte for byte, and used Preview → Run saved. Designer and saved-run identity match:
`v1_427bb335b6d575ca9cd7a41d3382bd5a592e6d40a9cb1407fe01a9b979816553`.
The finished page renders **Accepted Designer on main** and labels execution as
simulated with no live effects. The initial browser attempt preceded server start
and refused connection; a fresh tab loaded normally after the listener was ready.
No owner-origin saved document was modified. Bundle evidence is static traversal,
not a browser network trace. Full historical acceptance is reused, not repeated.

## Retained findings and continuation boundary

- N-1: long-name phone submenu overflow, low severity.
- N-2: misleading loading footer after refused saved execution, low severity;
  invalid source remains refused.
- Existing broad Studio Svelte baseline: 9 errors/8 warnings in unchanged operator
  files, as independently recorded; current scoped Designer check is 0/6.
- Install reproduces 29 dependency notices (6 low, 7 moderate, 13 high, 3 critical)
  and posthog Node-engine notice. No dependency repair or security-clean claim.
- Foundation scoped acceptance retains portal depth/label-spinner observations,
  honest catalog plan tiers and deferred families; no blanket catalog claim.
- Local browser persistence, bounded single-screen authoring and simulated execution
  remain the delivered scope. Browser-saved documents are runtime data tied to an
  origin, separate from committed source and captured evidence snapshots.
- Deployment, collaboration, SSR, performance guarantees, general backend/action
  editing and cross-browser coverage remain unclaimed.

Owner acceptance (“I have done that.. all are good my side..”) and historical
Designer closure remain intact. The development cycle stays complete. Main
integration does not authorize publication, deployment, a version/release bump,
unrelated Stage 9 changes or the next Studio feature.

## Reproducible launch from main

From a fresh main checkout (or one normally updated with `git pull --ff-only`):

```powershell
npm ci
npm run build
npm run build -w vict-studio
Set-Location apps/studio
$env:ORIGIN = 'http://127.0.0.1:5588'
$env:HOST = '127.0.0.1'
$env:PORT = '5588'
node build
```

Use an unused port with matching ORIGIN; do not stop an existing owner's server.
Open `http://127.0.0.1:5588/design`; local demo login is `operator` /
`studio-local-pass`. The integration review server already occupies 5588 while
running. File → New screen starts authoring; Save, reopen and Preview → Run saved
use this browser origin's local data. A different port/browser has separate saved
work. Nothing is deployed or published by these build/launch commands.
