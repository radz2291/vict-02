# Independent Designer verification — final delivery

## Owner-acceptance continuation — 2026-10-22

**CLOSED — PASS WITH NON-BLOCKING FINDINGS; OWNER ACCEPTED**.
The owner completed the walkthrough and confirmed verbatim:

> I have done that.. all are good my side..

See [owner acceptance and closure](../DESIGNER-CLOSURE-2026-10-22.md).
Acceptance covers the verified authoring, editing, undo/redo, save/reopen and
saved-screen execution at product `ba0304693487292e354374b1bd93908506eb2da9`.
Verification records are `e67a7ef460146b4b0c3158c625ef28d1d8f17e73`.
The independent technical verdict, findings, scope and reproducible launch
instructions below stand. Pending acceptance and next-action statements below
are preserved historical status at technical delivery, now superseded by this
continuation. Acceptance applies to the local-first, simulated experience; it
establishes neither production readiness nor all future Studio capabilities.
Browser-saved documents remain local runtime data, separate from committed source.
This cycle is complete; future work requires a separately scoped owner request.

## Retained independent technical delivery report

**Verdict: PASS WITH NON-BLOCKING FINDINGS.** Independent recheck completed
2026-10-22 (Asia/Kuala_Lumpur). Owner acceptance remains **pending**. This closes
the technical verification cycle for the first working Designer, not a merge,
publication, deployment, new feature grant or change to historical Stage 9 closure.

## Exact candidate and retained history

- Tested product candidate: `ba0304693487292e354374b1bd93908506eb2da9`, on
  `codex/studio-designer-independent-verification` (remote matched before recheck).
- Builder repair: `b69a4532d8cf09a59240ce2680f9bc68413cbc9a`, on
  `codex/studio-required-slot-repair`; merged without rewriting the verification
  history. Product sources/manifests match that repair. The final delivery commit
  adds verification tests and records only; its full remote SHA accompanies delivery.
- Original candidate `67a47c3732a2527c8c7086dfcae184672f1aae96` remains **FAIL**.
  [Original assessment](CANDIDATE-67A47C3.md) preserves the complete journey,
  successful controls, failed observations, baseline checks and evidence.
- Original evidence commits `9a681c8f41611ff09ef77ed2a8e039cc9e8d0d43` and
  `f83eb1bdba81265c0713cf985a1ef6c4d3402f38` remain ancestors.
- Main remains `4d2df037d8a82d36c60bf1bff16919650643ce22`; accepted foundation
  remains `e401cea58aae1ca68e2f6e26f9c8caf319d4bc66`. Original implementation
  branch, original checkout, its pre-existing untracked archive, owner port 5480
  and owner examples were preserved. Verification uses an isolated checkout and 5587.

## Blocking finding B-1: closed by independent recheck

The original candidate allowed absent required Dialog body content to persist and
execute despite a renderer diagnostic. Both insertion of an empty Dialog and
removal of its final required child reproduced the defect. The verifier requested
the bounded repair from the existing builder; the verifier authored no product fix.

The repair uses the shared renderer's component-plan validation before Studio
acceptance and validates local-storage writes through the existing host validator.
It traverses conditional branches, repeats and slot fallbacks as well as direct
content. No schema, ABI, dependency or package-version change was introduced.

Production browser recheck and independent tests establish:

1. Old invalid saved sources are refused on Open and direct saved Run with
   `UI_COMPONENT_SLOT_REQUIRED`; no application renders.
2. Empty required content and final-child removal refuse Save. Preview/Run saved
   is unavailable. A second tab confirms the last valid saved source, revision and
   identity remain unchanged after refusal.
3. Undo/redo retains the refusal behavior. Refilling and reusing detached content
   permit Save; saved execution renders the filled Dialog content.
4. Independent repeat-template and local-component fallback probes reject missing
   required content with filled positive controls. The original two red probes pass.
5. The public validator works from freshly packed packages in an isolated consumer.

Screenshots and source controls are in [recheck evidence](recheck-ba03046/).

## Reproduced checks on the repaired candidate

Windows PowerShell, Node v22.13.1 and npm 11.19.1. Logs below are under
`recheck-ba03046/`. Initial regular `npm ci` succeeded on the original candidate;
the repair leaves the dependency graph unchanged. A new clean install is not claimed.

| Command / check | Result | Log |
| --- | --- | --- |
| `npm run build` | PASS | build.log |
| `npm run typecheck` | PASS | typecheck.log |
| `npx vitest run --project unit packages/ui/test packages/ui-editor/test packages/application/test` | 1,138 passed | shared-unit.log |
| `npx vitest run --project renderer --maxWorkers=2 --testTimeout=15000` | 307 passed | renderer.log |
| `npm run build -w vict-studio` | PASS | studio-build.log |
| `npm run check -w vict-studio` | PASS | studio-check-final.log |
| `npm run test -w vict-studio` | 122 passed, 19 files | studio-tests-final.log |
| `npm run check:designer -w vict-studio` | 0 errors, 6 inherited warnings | designer-check.log |
| `node scripts/pack-u4-consumer.mjs` with a fresh `U4_ISOLATED_ROOT` | 10 tarballs, 16 tests, isolated build, both entries, no workspace links | packed-consumer.log; pack-manifest.json |
| Public packed preflight probe | 1 passed | packed-preflight.log; packed-preflight-probe.ts.txt |
| Production replay static dependency closure | PASS, 22 files; 4 authoring markers absent with Designer positive controls | bundle.json; check-bundle.mjs |
| Changed product and verifier source lint; formatting; `git diff --check` | PASS | lint-final.log; probe-format-final.log |

The closure check includes actual boot, root/layout/error and replay roots. It is
static bundle traversal, not a browser network trace. The original renderer timeout
runs are preserved; the passing run uses the stated allowance and is not a latency
budget measurement.

Verifier oracle correction: the initial new repeat probe used an unsupported array
literal, causing one test failure and TS2322. It now uses a declared string-list
state reference. The invalid fixture (`preflight-fixture-wrong.txt`), initial
`studio-check.log` and `studio-tests.log` remain, alongside passing final logs.
This was a verifier fixture error, not a product regression. Earlier bundle-root
and viewport-target corrections remain documented in the original assessment.

## Browser journey and practical limits

The original complete create/compose/configure/connect/style/save/reload/run,
draft/history, stale/corrupt-source, execution-boundary and responsive checks are
retained in the original assessment. The repaired production recheck additionally
preserved the original authored journal source byte for byte, revision r1.r3 and
application identity
`v1_862a38e431d1af0d675554b15074d691875c9b0c36d7d833a305344c77f5a81c`.
Nested Dialog keyboard dismissal, checkbox/input simulated submission, runtime
isolation from Saved state, actual 390px editing/undo and saved phone replay passed.
The phone viewport measured inner/client/scroll width 390. Final desktop and phone
screenshots are `final-designer.jpg`, `final-saved-replay.jpg` and
`final-phone-replay.jpg` in the recheck folder.

Retained non-blocking findings:

- **N-1, low:** the long-name Open screen submenu extends to approximately 394px
  at a nominal 390px viewport and introduces a scrollbar. Commands remain usable;
  original measured evidence is retained. No polish was added during verification.
- **N-2, low:** a refused direct saved Run shows the clear invalid-source alert
  and no application, but the footer still says “Loading saved application…”.
- Broad historical Studio Svelte diagnostics remain 9 errors/8 warnings in unchanged
  operator files, byte-identical to the foundation. Scoped Designer diagnostics and
  Studio TypeScript checks pass. These are distinct checks.
- Existing dependency audit notices (29: 6 low, 7 moderate, 13 high, 3 critical)
  and Node engine notice remain; no security-clean or production-readiness claim.

This slice remains local-storage/session based, single-screen authoring with
simulated execution. No general backend/action editor, collaboration, deployment,
SSR, performance budget or cross-browser coverage is claimed. Foundation catalog
and authority boundaries remain as recorded; pushing code does not verify Stage 9.

## Owner review and next allowed action

The repaired production app is left at <http://127.0.0.1:5587/design>. Demo login:
`operator` / `studio-local-pass`. In this browser origin, File → Open screen →
**Independent field journal continued** opens the independently authored saved
sample. Inspect Document → Source, use Preview → Run saved, open the nested Dialog,
enter a message, agree and submit; the result is explicitly simulated. File → Exit
returns to Designer. Saved source and application identity above are the comparison
control. Browser-origin storage is not a bundled product default.

To relaunch from the isolated verification checkout: `npm ci`, `npm run build`,
`npm run build -w vict-studio`; then from `apps/studio`, set PowerShell environment
`$env:ORIGIN='http://127.0.0.1:5587'`, `$env:HOST='127.0.0.1'`, `$env:PORT='5587'`
and run `node build`.

Next allowed action: owner review and explicit acceptance of this Designer delivery,
or a separately scoped request addressing retained findings. No merge or deployment
is performed or implied. Owner acceptance remains pending.
