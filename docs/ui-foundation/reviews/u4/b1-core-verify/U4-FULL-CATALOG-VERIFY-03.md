# U4 full-catalog verification round 3 — VERDICT: FAIL (repair round required)

- **Exact implementation candidate evaluated**: `5174219cc1c6880ae5da9dbade1b5cf12cdd7ca5`
  (branch `codex/ui-foundation-u4-b1-core-repair-02`; 18 commits on the dialog
  repair `c76714e1687c8ce28410c4c16a832f3252f1b033`, which sits on the round-2
  verification tip `b6beb23975e564628a617cfecb5fd111673819e7`). The earlier
  `bc4e08d6…` delivery is superseded inside this lineage — verified live.
- **Verification branch**: `codex/ui-foundation-u4-full-verify-03` (isolated
  worktree `vict-02-u4-full-verify-03`, created at the exact candidate SHA;
  verifier commits are probe/hygiene only — final tip recorded in §9).
- **Scope (owner decision, recorded in handoff §14)**: U4 expanded to all 38
  available catalog families plus AppShell, using the existing B2–B5 roadmap;
  PinInput / RatingGroup / TimeRangeField remain deferred (X). Codex's browser
  self-check is authorized but is not independent verification.
- **Governing payload**: unchanged `4cfe5b37…` (FREEZE-02).
- **Environment**: Windows 10, Node v22.13.1, npm 11.19.1, real Chrome 155 via
  CDP (synthetic DOM events; trusted CDP input does not reach pages in this
  environment — every browser claim below states its input class). Focus
  measurements require `Emulation.setFocusEmulationEnabled(true)` or a
  foreground window: bits-ui defers focus through a visibility-gated tick, so
  hidden-window sessions silently suppress focus transfer (this invalidated
  two afternoon measurements before the mechanism was identified — recorded
  here so the reviewer does not repeat it).

## 1. Verdict

**FAIL — a focused repair round is required before reviews/founder checkpoint.**

Both disclosed defects are reproduced and pinned with committed failing
probes; two additional genuine defects were found (tooltip controlled-open,
garbage intermediate emits on date clearing). Everything else verified green:
the inherited regression suites (2990 tests / 0 failed / 3 skipped after the
server build), the packed consumer, bundle separation, the repaired dialog
focus lifecycle (entry, containment, Escape/✕ restoration — on source AND
packed artifacts), and independent interaction demonstrations for the full
B2–B5 family set. The three fresh reviews are deferred to the repaired
candidate (mandate §5). B1–B5 and U4 remain OPEN; owner acceptance PENDING;
no reuse-matrix ledger row advances to B-n this round.

## 2. Disclosed defect A — end-only / partial date ranges

Reproduced and pinned (probes committed; failing BY DESIGN until repaired):

| # | Failure | Oracle |
| --- | --- | --- |
| A1 | **External state updates do not reach date/range controls.** Preview-panel edit `windowStart=''` (end intact) leaves the canvas DateRangeField/Picker displaying the stale start (`12/10/2026`) until a second, unrelated prop changes. Unit-pinned: a single DateField ignores ALL post-mount `stateValues` changes — even non-empty ones (`probe-datefield-supply.test.ts`, `probe-range-external-state.test.ts`). Boundary: the host supply/props-reactivity path, NOT the range adapters | fix must make both unit probes pass |
| A2 | **Clearing a field segment emits garbage intermediate isoDates.** Backspace on the start year emits `startChange "0202-10-12"` eleven times instead of the `''` empty convention (`probe-date-range-partial.test.ts`) | state must only ever hold valid, display-agreed values |
| A3 | Works correctly (verified, keep green): end-only mount keeps the end displayed (field AND picker); start-only calendar selection flows to state; restoring cleared endpoints; reversed-range truthful feedback with no reversed emit; calendar day selection (browser, full pointer sequence: `provisional` range got `start=2026-10-20, end=''` and displayed `20/10/2026/dd-mm/yyyy`) | — |

## 3. Disclosed defect B — TimeField locale/hour-cycle

Commit `5174219c` fixed only the HOUR segment announcements; the defect is NOT
repaired (`probe-time-hour-cycle.test.ts`, 3 failing assertions):

| Boundary | Observed (en-GB + hourCycle 12, value 13:30) |
| --- | --- |
| Public primitive (bits-ui 2.19.3 re-export) | Visible hour text "01" (12-hour ✓) but `aria-valuenow="13"`, `aria-valuetext="13 AM"` (incoherent), and the dayPeriod segment is MISSING entirely — AM/PM can be neither displayed nor toggled. en-US + 12h control renders correctly, so it is locale-dependent segment construction |
| Authored adapter (CatalogTimeField) | Hour announcements fixed ("01", now=1, valuetext "01 PM") and a dayPeriod segment EXISTS — but it displays **"AM" for a 13:30 (PM) value**: the visible spinner contradicts both the ISO value and the adapter's own hour announcement; the PM→AM toggle assertion fails |

Keyboard editing + announcement agreement must all pass on the repaired SHA
(en-GB 12h, en-US 12h, en-GB 24h controls stay green).

## 4. Additional defects found this round (in scope, must repair)

| # | Failure | Evidence |
| --- | --- | --- |
| A4 | **Tooltip never opens.** Controlled path: `open=true` seeded → no `[role=tooltip]` ever mounts (unit probe `probe-b5-interactive.test.ts`, environment-independent). Hover path: no tooltip after 900 ms with emulated focus (browser). Same derived/bind-portal hazard class the dialog family had before `c76714e` | repair oracle = the unit probe turning green + browser hover showing the authored "High priority / Safety findings…" content |
| N1 | Command search matches only raw `value`s ('assign'/'export'), not the authored labels ("Prepare inspection summary" — searching 'summary' finds nothing; the seed placeholder promises label search). Suggested direction: pass the label as `keywords`. Non-blocking, same repair round | browser reproduction; empty-slot + selection + filtering otherwise verified green |

## 5. Repairs re-verified (prior findings)

- **Dialog focus lifecycle (round-2 residual)**: `c76714e` VERIFIED — focus
  enters the open dialog (visible-window measurement), Tab containment holds,
  Escape and ✕ close and restore focus to the trigger, `aria-modal=true`;
  re-verified on the PACKED consumer with focus emulation (§9 packed run).
  Round-1 leak oracles (`probe-dialog-{bare,loop}.test.ts`) still green.
- **F1/F4/F5/F6/F7/F8/F9** (round-1 set): inherited suites all green —
  contract 22/22, consumer 16/16 ×2, renderer/editor/extension/css/state
  suites, both dialog probes; no inherited test file changed by the candidate
  (verified: zero test diffs in `b6beb23..5174219c`).

## 6. Full-catalog family/mode coverage (independent demonstrations)

Batch interaction probes through the real DocumentHost (`probe-b2…b5-*.test.ts`,
committed): B2 5/5 (multi-select keyboard path, combobox, accordion, tabs,
toggle-group multiple), B3 5/5 (slider one-thumb+range with tabindex=0, meter,
progress determinate/indeterminate, pagination), B4 4/4 unit + browser
(dropdown-menu with checkbox-item toggle true→false, menubar with radio items
aria-checked, command filter/empty/selection, navigation-menu links,
context-menu right-click), B5 4/5 (collapsible open loop, alert-dialog,
popover, display set) + the pinned tooltip failure.

Browser journeys (real Chrome, synthetic DOM events): dialog lifecycle
(above); select multiple stays-open semantics; command search/select/empty;
tabs switching; slider keyboard stepping 60→75 (step 15); indeterminate
checkbox click → true; accordion toggles; link-preview hover content with
authored href; toolbar/scroll-area/label/avatar/separator render; AppShell
responsive evidence retained from round 2 (F10 fix); date/time surfaces on the
scheduling document; multi-select/collapsible/date-range compositions.

Authoring loop demonstrated on a B3 family: Inspector label edit → Apply →
Save (rev r1.r1) → finished-app replay shows the edited label; undo/redo and
seed reset exercised (reset verified non-destructively afterwards).

Not demonstrated (honest scope record): SSR — **no server-render entry exists
anywhere in this stack** (no document-HTML renderer in `packages/server`);
no governing requirement names SSR for B1–B5, so this is recorded as a scope
fact, not a defect. A client build does not claim server rendering.

## 7. Gates (actual results)

| Gate | Result |
| --- | --- |
| Root `npm test` (inherited suites; after full build) | **2990 passed / 0 failed / 3 skipped** (the 3 `restart-sigkill` failures observed pre-build were environmental: missing `packages/server/dist`; pass 3/3 after `npm run build`). **Definitive full-battery re-run with the probe files in the tree: 3020 passed / 10 failed / 3 skipped (3033)** — the 10 failures are exactly the committed pinned probes (§2/§3/§4: 6 genuine defects + 4 documented environment-limited); zero inherited failures |
| Round-3 probe suite (committed, renderer project) | 41 tests: **31 green, 10 pinned-failing** (6 genuine defects + 4 documented happy-dom input limits whose assertions are browser-covered) |
| consumer suite (workspace) | **16/16** |
| consumer suite (packed, isolated install) | **16/16** |
| `npm run typecheck` | 0 errors (after fixing the candidate's own ui-svelte declaration error — D-repair §8; probe files included) |
| `npm run check:ui` | **0 errors** / 5 warnings |
| `npm run build` (root + ui-editor + ui-preview) | clean |
| `prettier --check .` | 38 files unformatted (pre-existing class; 15 added by the candidate's new files) — recorded, not restructured |
| Pack closure | 10 tarballs, no repo-tree pollution (F13 fix holds), manifest regenerated |
| Isolated consumer | deps all `file:vendor/*.tgz`, zero repo-path strings, both entries boot from packed artifacts, dialog focus + dropdown verified on packed artifacts (focus emulation) |
| Bundle separation | app 2.3 kB clean of editor markers; authoring 107.9 kB carries all editor markers; shared execution chunk **949.6 kB (gzip n/a recorded)** — grew from 381 kB with the full catalog; no performance budget exists (nothing invented), recorded for founder transparency |
| bits-ui drift | workspace pins 2.19.3; the isolated consumer resolved **2.19.5** (`^` range) until pinned. Behavior-affecting transitive drift is a delivery risk — recommendation: exact-pin bits-ui in the consumer manifest (delivery repair, next round) |

## 8. Verifier delivery repairs on the verify branch (allowed scope)

- `b2-implementations.ts`: `slots: descriptor.slots ?? []` — the candidate's
  ui-svelte tsc declaration build failed at the source (TS2322); one-line
  type-level fix, runtime identical.
- Root build order note: `npm run build` must complete before the battery
  (server tests need `packages/server/dist`) — environmental, documented.
- All other verifier commits are probes, fixtures and type hygiene only.

## 9. Lineage, evidence, reproduction

- Verification branch tip after verifier commits:
  `bc65a6a…` → final tip is recorded on the pushed branch (§9 of the delivery
  report; the exact SHA is verified against the remote after push).
- Probe files (committed failing oracles): `packages/ui-svelte/test/probe-*.test.ts`
  (+ `probe-kit.ts`, `RangeStateFixture.svelte`, `DateSupplyFixture.svelte`,
  `TimePrimitiveFixture.svelte`, `CatalogDocFixture.svelte`).
- Launch (packed): `node scripts/pack-u4-consumer.mjs` →
  `cd ../u4-consumer-isolated/u4-consumer && npm run dev` → `/` (authoring),
  `/app.html?doc=queue|detail|schedule|controls|shell` (finished app).
- Focus-sensitive checks require a visible/focused browser window (or
  `Emulation.setFocusEmulationEnabled(true)`).

## 10. Required end state for the repair round

1. All six genuine defects (§2 A1, A2; §3 both boundaries; §4 A4; plus the
   focus-emulated packed dialog check staying green) fixed — probe suite green
   except the four documented environment-limited tests, with assertions
   intact.
2. Full battery 0 failed; consumer 16/16 ×2; typecheck/check:ui 0 errors.
3. bits-ui exact-pinned in the consumer manifest.
4. Then: verifier affected rechecks → freeze the exact SHA → the three fresh
   reviews (falsification, real-browser authoring/experience, unfamiliar-agent
   on packed capabilities) → founder checkpoint. Ledger rows advance to B-n
   only with that recorded evidence.
