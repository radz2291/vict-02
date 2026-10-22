# Independent Designer verification — original candidate

**Verdict: FAIL.** This is the retained red assessment of implementation candidate
`67a47c3732a2527c8c7086dfcae184672f1aae96`, dated 2026-10-22 (Asia/Kuala_Lumpur).
B-1 blocks technical delivery and owner acceptance. Passing checks below do not
supersede that finding. A subsequent repair must receive its own exact-SHA recheck.

## Identity, independence and scope

- Repository: `https://github.com/radz2291/vict-02`.
- Implementation branch: `codex/studio-canvas-first`; remote tip independently
  matched the exact candidate before work and again during verification.
- Last implementation commit: `48c3bb59ad0b1ab77454afff2b38fe1436a8f032`;
  candidate `67a47c3…` adds the builder handoff only.
- Accepted foundation closure `e401cea58aae1ca68e2f6e26f9c8caf319d4bc66`
  and main `4d2df037d8a82d36c60bf1bff16919650643ce22` are ancestors.
- Isolated verification branch: `codex/studio-designer-independent-verification`.
  Checkout: `C:/Users/RZ1/.codex/worktrees/studio-designer-verification/260831-VCT-02`.
  It was created at the exact candidate with no tracked changes. No implementation
  repair was authored by this verifier. Added tests/scripts are verification code.
- Original checkout remains on main with its pre-existing untracked
  `victframework-builder-kit-0.1.0.tgz`. Main, implementation branch, owner examples,
  and the owner's port 5480 were not changed.
- Authority: the owner's final independent verification request, root AGENTS,
  canonical system reference, Stage 9 state/architecture/handoff, the current
  implementation handoff and U4 foundation state/handoff. The Stage 9 state records
  its historical formal closure; the old entry handoff is historical, not a new
  operator implementation grant. This gate concerns the separate Designer slice.

## Commands and results

Windows PowerShell; Node `v22.13.1`, npm `11.19.1`. All commands run from the
verification repository root unless stated otherwise. Logs are adjacent files.

| Check | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS; engine/audit notices retained | [install.log](install.log) |
| `npm run build` | PASS | [build.log](build.log) |
| `npm run typecheck` | PASS | [typecheck.log](typecheck.log) |
| `npm run build -w vict-studio` | PASS, adapter-node production build | [studio-build.log](studio-build.log) |
| `npm run check -w vict-studio` | PASS | [studio-check.log](studio-check.log) |
| `npm run check:designer -w vict-studio` | PASS; 0 errors, 6 warnings | [designer-check.log](designer-check.log) |
| `npx vitest run --project unit packages/ui/test packages/ui-editor/test packages/application/test` | 1,136 PASS | [shared-unit.log](shared-unit.log) |
| `npm test -w vict-studio` (before adding verifier tests) | 109 PASS | [studio-tests.log](studio-tests.log) |
| `npx vitest run --project renderer --maxWorkers=2 --testTimeout=15000` | 305 PASS | [renderer-final.log](renderer-final.log) |
| `npm test -w vict-studio -- tests/designer-independent-verification.test.ts` | 4 PASS | [independent-probes-final.log](independent-probes-final.log) |
| `npm test -w vict-studio -- tests/designer-required-slot-verification.test.ts` | **2 FAIL**, B-1 acceptance oracle | [required-slot-red.log](required-slot-red.log) |
| `node scripts/pack-u4-consumer.mjs` with unique `U4_ISOLATED_ROOT` | PASS; 10 tarballs, isolated build, both entries, 16 tests, no workspace links | [packed-consumer.log](packed-consumer.log), [pack-manifest.json](pack-manifest.json) |
| `node docs/studio/verification-2026-10-22/check-bundle.mjs` | PASS; replay 15 chunks; replay + layout/error + boot static closure 22 files | [bundle.json](bundle.json) |
| Broad `svelte-check --tsconfig ./tsconfig.json` from `apps/studio` | 9 errors, 8 warnings; retained operator baseline finding | [studio-wide-svelte.log](studio-wide-svelte.log) |
| `npm audit --json` | 29 notices: 6 low, 7 moderate, 13 high, 3 critical; no dependency repair attempted | [dependency-audit.json](dependency-audit.json) |

The pack directory is outside tracked source at
`C:/Users/RZ1/.codex/worktrees/studio-designer-verification/packed-67a47c3`.
The script-generated tracked example manifest was restored; only its evidence copy
is retained here. Tarballs/build outputs were not committed.

## Actual production browser journey

The verifier used the actual production-served application, browser pointer
clicks/double-clicks and keyboard input (`press`/`pressSequentially`), and the real
authoring controls. No DOM-dispatched synthetic events replaced the journey.
Read-only DOM queries measured rendered styles and source text. Default desktop
viewport was 1280×720; actual selected-tab phone testing used 390×844.

Port 5481 initially had unrelated existing browser storage, so no authored edits
were made there; the clean-origin journey used `http://127.0.0.1:5587`. The local
demo login was used; no operator target or target credential was needed.

| Criterion | Result and direct observation |
| --- | --- |
| Minimal creation | PASS. File/New created **Independent field journal** from the blank root. |
| Insert/select/nest/reorder/remove | PASS. Inserted Section, Heading, input, Checkbox, Button and nested Dialogs. Layers showed ownership/levels. Moved Checkbox before input, removed it, undid/redid removal; canvas and canonical nodes agreed. |
| Properties and slots | PASS for valid composition. Changed Button label to **Submit journal**. Entered actual Dialog Body composition, inserted text and a nested Dialog, filled the nested Body, and used keyboard Back through both levels. Empty required-slot persistence is **FAIL, B-1**. |
| State and declared behavior | PASS for valid connections. Bound Checkbox checked to Agreement and checkedChange to accepted; mapped Button press to Submit (simulated), message to Message and accepted to Agreement through typed controls. No action implementation editor claim. |
| Styling | PASS. Heading rendered at `36px`, `rgb(36,87,168)`; Section gap `22px`, linked padding `28px`. Compact gap `10px` initially produced the truthful masking diagnostic; Allow conditional overrides made Phone render `10px`, Fit render `22px`. |
| History and dirty state | PASS. Removal undo/redo changed source and canvas together. After reopen, Rename changed application identity; undo restored the exact saved identity and Saved state; redo/save produced r1.r3. Valid canonical JSON replacement was also undoable back to exact source bytes. |
| Save/reload/reopen/continue/run | PASS on the valid screen. Saved, reloaded the page, continued editing, saved r1.r3 and ran it. Screen switching back from a competing-write trial preserved exact Source text and identity. |
| Same canonical identity | PASS on valid source. Final [authored-screen.json](authored-screen.json) has document ID `screen-755cd9f6-918c-44af-a104-bc7a7bbe10d9`, revision `r1.r3`, identity `v1_862a38e431d1af0d675554b15074d691875c9b0c36d7d833a305344c77f5a81c`. Designer, replay and an independent compilation of the captured source agree. |
| Execution isolation | PASS. Design selected the checkbox without toggling it. Interact executed typed input; result **Simulated submission: Independent runtime input** left Saved state and application identity unchanged. Saved replay returned **Simulated submission: Finished replay trial** and **Delivery walkthrough**. |
| Negative source/value/connection | PASS for checked cases. Malformed JSON, undeclared action and wrong boolean initial value were refused with `STUDIO_JSON_INVALID`, `UI_DOC_UNKNOWN_PRODUCT_REFERENCE`, `UI_EXPR_TYPE_MISMATCH`; application identity stayed unchanged. B-1 exposes an additional unsupported acceptance hole. |
| Draft/navigation guards | PASS. Unapplied property draft disabled File commands; Data and Source drafts prevented drawer closing. Unsaved Rename prevented navigation to Operator tools and retained edits. Discard/undo recovered. |
| Storage | PASS for checked negatives. Two genuine tabs raced saves: stale save refused `UI_DOC_STALE_REVISION`, kept the dirty draft, and reload recovered **Storage winner**. Independent probes also proved thrown-write refusal preserves bytes/source/history, retry succeeds, and mixed-command failure is atomic. Existing suite covers corrupt-byte preservation. |
| Pending/denied/failed actions | PASS. Working… pending state observed; unchecked Agreement refused; Deny demo writes and Fail next action produced distinct errors. Restart reset values/result. Pending reset produced no late result; the separate two-pending-action probe returned DATA_STALE twice. |
| Portals/focus/teardown | PASS for exercised paths. Nested actual Dialog portals opened; Escape removed one at a time, focused the appropriate trigger and restored body pointer events. Reload with an open portal left no dialog or pointer lock. |
| Menus/Document/source/composition | PASS with N-1. File cascade/current check/screen switching, Rename/New focus, all-disabled Edit → View arrows and Escape focus restoration were exercised. Data, Actions browsing, Source, Layers, Design/Interact and saved-run controls were challenged within this slice. |
| Phone | PASS with N-1. Actual 390px tab supported text edit/commit/undo, drawer, replay action (**Phone replay**) and Run menu bounds 69–212.36px. Closed-menu document width = viewport = 390. Open-screen cascade clips at the right edge. |
| Production restart | PASS for valid screen. Restarted only verifier server; old session correctly returned to login. After login, both Designer and replay recovered the same saved identity. |

Screenshots: [Designer](designer-desktop.jpg), [saved replay](saved-replay.jpg),
[phone Designer](designer-phone.jpg), [phone replay](replay-phone.jpg),
[stale save refusal](stale-save-refused.jpg).

## B-1 — blocking: required catalog slot accepted into saved execution

At the exact candidate, File/New → select blank canvas → Insert/Dialog shows
`UI_COMPONENT_SLOT_REQUIRED: The required slot 'body' has no fill.` and an
unavailable component. **Ctrl+S succeeds**, reports Saved/r1.r1, and Preview/Run
saved opens the unavailable component. Finished replay does not show the original
required-slot diagnostic. This is not merely an unfilled intermediate draft: it
crosses persistence and the finished execution boundary.

Evidence: [saved-invalid screenshot](required-slot-saved-invalid.jpg),
[replay-invalid screenshot](required-slot-replay-invalid.jpg),
[exact saved source](required-slot-saved-source.json), [two red assertions](required-slot-red.log).
Identity of the invalid saved application:
`v1_fff7633222ff224ac0453e35b1fc57f36ac61c6cc59de0c03826f08aaed71ca0`.

Supplementary same-candidate check reproduced the handoff's exact last-child case:
filled Body with Text and saved valid r1.r2; Arrange/Remove selection deleted its
final Paragraph; Ctrl+S still saved invalid r1.r3. See
[final-child screenshot](required-slot-final-child-red.jpg) and
[exact resulting source](required-slot-final-child-source.json). This preserves
both missing-slot and explicit-empty-slot variants.

Source mechanism: `application.ts:130` delegates screenIssues to compileScreen;
`storage.ts:9` uses screenIssues as its validator. Designer save at lines 232–240
checks compilation and the store. The renderer's `document/extensions.ts:235–239`
separately checks implementation.required, and the Dialog implementation declares
`required: ['body']`. Thus the renderer detects an invalid source which the save
boundary accepts. The handoff's final known-gap item 3 explicitly claims empty
required slots block Save/Run; that claim is falsified here.

Repair oracle: preserve editable incomplete drafts, but authoritatively refuse
missing/empty required catalog slots at source/persistence/saved-execution
boundaries; retain useful diagnostics and unchanged stored bytes on refusal.
Exercise newly inserted empty Dialog, removal/detachment of its final body child,
invalid pre-existing storage, valid filled slots, nested slots, undo/refill/save,
and both finished replay and authoring. Codex owns the general architectural fix;
the verifier must not mask it with a host-only button disable.

Coordination: the owner-authorized repair handoff was sent to existing chat
**Build VICT Studio authoring slice** (`01a134e8-5aa3-7370-91c7-b34391e635e9`).
Requested a new isolated repair branch from 67a47c3, with original branches,
owner port 5480 and verifier port 5587 preserved. No implementation repair is
claimed in this evidence record.

## Non-blocking findings and oracle corrections

- **N-1 (low):** at actual 390px, File/Open screen with the long journal name
  opens at x147 and ends at x393.99. Opening also introduces scrollbar pressure
  (document client width observed 375). Commands remain usable, but the submenu
  clips the right edge. [Correctly targeted screenshot](narrow-cascade-corrected.jpg).
  Source: Designer.svelte:335, framework Menubar.SubContent, collisionPadding 8.
  Future oracle: fit the complete cascade within the actual viewport while
  preserving readable labels and deliberate switching. No polish repair was made.
- **H-1 (existing baseline diagnostics):** broad Svelte check has the same nine
  reported errors in changesets/confirmations/product. Those three operator page
  trees are byte-identical to foundation e401cea; the historical handoff already
  reports these errors. Scoped Designer check is green. This is not a new full
  baseline build execution claim. Six shared warnings remain.
- **H-2 (dependency notices):** audit notices and the posthog-node engine warning
  are retained, not treated as a clean security bill. Relative to e401cea the lock
  change only adds four existing workspace dependency declarations; no installed
  version is upgraded. Critical notices name test tooling. Production readiness,
  dependency remediation and deployment are outside this gate.
- **O-1 (timing):** original renderer run and maxWorkers=2 recheck each had 304
  passes plus contextual-catalog timeout at the default five seconds. Isolated
  unchanged test passed in 4.60s. Final maxWorkers=2 / testTimeout=15000 passed all
  305 assertions. Original files [renderer.log](renderer.log),
  [renderer-recheck.log](renderer-recheck.log), [isolated run](contextual-catalog-recheck.log)
  remain. Only invocation timeout changed; no performance guarantee or test-source
  repair is inferred.
- **O-2 (bundle oracle):** first expanded check incorrectly treated every Vite
  isEntry flag as an eagerly loaded boot entry, thereby including every lazy
  route. The positive-control markers caught this oracle error. Historical
  [script](check-bundle-expanded-wrong.mjs) and [red output](bundle-expanded-wrong.log)
  remain. Corrected traversal starts at the actual start/app entries, root
  layout/error and run node. All four markers exist in Designer and are absent
  from that 22-file static closure. Lazy router route references are expected.
  No browser network trace was captured; attempted performance-resource reading
  was unavailable in the browser tool's restricted evaluation scope.
- **O-3 (viewport target):** the browser-scoped viewport capability initially
  affected selected tab 1 rather than background test tab 2. Earlier images now
  named historical-wrong-target-* are not phone evidence. The check was repeated
  in selected tab 4, asserting actual DOM client/inner width before interactions;
  designer-phone/replay-phone and narrow-cascade-corrected are the valid artifacts.
  Some control attempts also hit changed selections or deadlines; refreshed state
  and successful re-drives, not the failed attempts, supply the journey evidence.

## Launch and founder walkthrough after repair

```powershell
npm ci
npm run build
npm run build -w vict-studio
cd apps/studio
$env:ORIGIN='http://127.0.0.1:5587'
$env:HOST='127.0.0.1'
$env:PORT='5587'
node build
```

Open `/design`, sign in with the documented local-demo credentials when applicable,
then Open UI designer. Storage is origin-specific. The verifier's existing valid
example is **Independent field journal continued**; it is not a bundled default.

1. Select the title; double-click to edit, then Ctrl+Enter. Undo to return to saved.
2. Inspect Layers and Data in Document; compare canonical Source.
3. Inspect nested More details compositions and use Back to return.
4. Switch View between Fit and Phone to see the gap condition.
5. Interact, check Agreement, enter a message and Submit journal. Runtime is simulated.
6. Save a committed edit, reload, then Preview/Run saved. Confirm the same identity;
   Run provides Restart and the simulated negative controls; File/Exit returns.

This walkthrough is prepared for a repaired candidate. **Owner acceptance remains
pending and cannot be requested as a passing delivery at this red candidate.**
LocalStorage, session-local history/drafts, single-screen application and declared
simulation limitations remain. No general backend authoring, collaboration,
publication, deployment, cross-browser coverage, SSR or new performance budget is
claimed. Broad catalog completeness and every possible portal permutation were
not re-proven here; foundation evidence retains its original tiers and limits.
