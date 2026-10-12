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

---

# ROUND 3A (2026-10-09, same verifier) — ORACLE CORRECTION + corrected findings

## 11. Oracle correction record: date clearing (supersedes §2 A2 "garbage intermediates")

The owner directed a re-examination of the round-3 clearing oracle. The
pinned bits-ui@2.19.3 source (`dist/bits/date-field/date-field.svelte.js`)
deletes digits incrementally:

- `BaseNumericSegmentState.#handleBackspace`: `"12" → "1" → null`,
  `"10" → "1" → null` (two-digit values starting with `0` clear in one press);
- `DateFieldYearSegmentState.#handleYearBackspace`: `"2026" → "202" → "20" →
  "2" → null` (string slice, no digit shifting);
- `DateFieldYearSegmentState.onfocusout`: pads a partial year with
  `prependYearZeros` (`"202" → "0202"`) — **a valid calendar year**, not
  garbage.

One Backspace per segment therefore never established a cleared endpoint, and
the round-3 claim that clearing "emits garbage intermediates (`0202-10-12`)"
was an oracle error. Corrections, all recorded as evidence:

1. The original probe is preserved verbatim as historical evidence:
   `packages/ui-svelte/test/historical/probe-date-range-partial-v1.historical.ts`
   (excluded from the vitest glob by its `.historical.ts` suffix; the only
   edit is the import-depth adjustment required by the move).
2. The corrected oracle `probe-date-clear-sequence.test.ts` uses a genuine
   complete-clearing sequence (2 Backspaces per 2-digit segment, 4 for the
   year, per the pinned semantics) and asserts: a fully cleared endpoint
   emits the empty convention `''`; the other endpoint stays intact and
   displayed; restoration works; display and accepted state agree; and
   controlled synchronization produces **no repeated echo emissions**. All
   intermediate emissions must parse as valid calendar dates.
3. Result: **the field-clearing path passes the corrected oracle in full** —
   A2 is WITHDRAWN as a field-level defect. The intermediate `0202` padding
   behavior is documented as pinned bits-ui semantics in the probe.

## 12. Corrected defect set (round 3a): 10 pinned oracles

The corrected calendar probes (`probe-date-range-picker.test.ts`, keyboard
path — pointer clicks remain a documented happy-dom limit with browser
coverage) replace the round-3 weak assertions ("truthy JSON string",
"permitting no emissions"), which proved nothing. New genuine defects the
correction exposed:

| # | Defect | Pinned oracle (failing) |
| --- | --- | --- |
| A2-cal-1 | **Duplicated identical emissions**: one calendar selection emits the same `startChange` 4× (first selection) | `calendar: the first selection emits exactly one startChange` |
| A2-cal-2 | Duplicated `endChange ''` 6× when restarting from a complete window; the unchanged start must not re-emit | `calendar: restarting from a complete window emits exactly the end-clear` |
| A2-cal-3 | Duplicated `endChange` 4× when completing from start-only | `calendar: completing from start-only emits exactly one endChange` |
| A2-cal-4 | **End-only mount + selecting a day silently builds a REVERSED internal range** (display shows start=20 AND end=16 selected) with ZERO emissions — authored state and display permanently disagree, violating the partial-range amendment's agreement requirement | `calendar: selecting from an end-only mount stays ordered and display agrees with state` |
| A1 | External state supply dead for date controls (unchanged from §2) | `probe-datefield-supply`, `probe-range-external-state` (2 tests) |
| B | TimeField en-GB 12h primitive + adapter (unchanged from §3) | `probe-time-hour-cycle` (3 tests) |
| A4 | Tooltip controlled-open never renders (unchanged from §4) | `probe-b5-interactive` (1 test) |

Root-cause direction for A2-cal-1..3: the calendar adapter wires
`onValueChange` AND `onStartValueChange`/`onEndValueChange` to the same
`emitRange` path without consecutive-transition dedup, and bits-ui fires the
pair multiple times per interaction. The field adapters already dedup against
authored props; the calendar needs the same single-source emission contract.
A2-cal-4 additionally needs the ordered-range guard to apply BEFORE mutating
the internal value (restart semantics: picked day becomes start, old end
cleared, both emitted once).

## 13. Authoring coverage (family-and-mode) — new probe, all green

`probe-authoring-coverage.test.ts` (75 tests) drives the Inspector's exact
data path — descriptor prop declarations → `bindExpression` with the
editor-bridge `expectedDocumentRevision` contract → the real `UiEditSession`
state machine (idempotency, revision history) → joint compile →
DocumentHost render — for EVERY descriptor in the catalog:

- 38+ families inventoried (+ AppShell decompositions); 6 structural parts
  (menu separators / checkbox groups) documented as composition-authored by
  design, with no value prop;
- every non-structural family: transaction accepted, working revision
  advances, authored literal persists into the compiled plan;
- parts are authored inside their real composition chains (e.g. menubar >
  menubar.menu > radio-group > radio-item; tabs > panels);
- open-render families must echo the authored edit in the canvas (text or
  aria-label); closed-surface/menu/aria-metadata families are covered by the
  plan-persistence assertion with their open-state echo browser-verified
  (§6) — the classification is an explicit allowlist in the probe, so any
  rendering change re-classifies loudly.

This replaces the single-slider demonstration with per-family evidence.

## 14. Focused Codex repair handoff (round 3a)

Same agent, same rules as §7 (runtime/authored-state separation, no forced
remounts or refresh counters, no date-specific bypasses, assertions never
weakened). Reproducible oracles are the committed failing probes; green is
defined by them.

1. **A1 — external state supply (2 oracles).** Trace the shared
   host/props-reactivity boundary in `DocumentHost`/state supply: post-mount
   `stateValues` changes must reach date/range displays (non-empty change,
   clear, restore). `probe-datefield-supply.test.ts` +
   `probe-range-external-state.test.ts`.
2. **A2' — calendar emission contract (4 oracles).** One user action, one
   emitted transition per changed endpoint; restart from complete emits the
   end-clear exactly once; selection from an end-only mount must stay
   ordered (restart semantics), emit the coherent transition, and keep
   display == state. `probe-date-range-picker.test.ts` (4 failing tests).
   No blacklists of valid years; field keyboard semantics stay as pinned.
3. **TimeField — primitive + adapter (3 oracles).** en-GB 12-hour: visible
   hour, `aria-valuenow`, `aria-valuetext`, dayPeriod segment presence and
   value, and the PM⇄AM toggle must all agree (13:30 renders/announces PM).
   Retain the en-US 12-hour and en-GB 24-hour controls.
   `probe-time-hour-cycle.test.ts`.
4. **A4 — Tooltip (1 oracle + interactions).** Controlled `open=true` must
   mount `[role=tooltip]`; hover and keyboard-focus open paths; close/reset;
   portal ownership per the dialog-family repair pattern.
   `probe-b5-interactive.test.ts`.
5. **N1 — Command label search (non-blocking).** Match authored labels
   (e.g. "Prepare inspection summary") while item `value`s and action
   identity stay stable; suggested direction: label as `keywords`.

Self-check requirements: full pipeline green, browser self-checks with the
documented focus protocol (§9: visible window or
`Emulation.setFocusEmulationEnabled(true)`), synthetic events labelled as
such. Do NOT claim SSR (out of scope, unclaimed). bits-ui stays exact-pinned
`2.19.3` (this round's delivery repair — the consumer previously resolved
^2.19.3 → 2.19.5).

## 15. Gate (round 3a) — actual results

| Gate | Result |
| --- | --- |
| Root `npm run build` | clean (incl. server dist for the battery) |
| `npm run typecheck` | **0 errors** (including all new probe files + historical) |
| `npm run check:ui` | **0 errors** / 5 warnings (unchanged) |
| Root battery `npm test` | **3093 passed / 10 failed / 3 skipped** (3106) — the 10 failures are exactly the pinned §12 oracles; inherited suites unchanged and green |
| Renderer probe suite | 244 tests: 234 green, 10 pinned-failing; authoring coverage 75/75; corrected clear oracle 4/4 |
| Consumer suite (workspace) | **16/16** |
| Pack | 10 tarballs, manifest regenerated `2026-10-09T10:44:11.490Z`, zero tarballs in the repo tree (F13 holds) |
| bits-ui | **exact `2.19.3`** in `packages/ui-svelte` and the consumer manifest; workspace lock + fresh isolated install both resolve 2.19.3 (drift closed) |
| Isolated consumer (fresh install from packed tarballs) | **16/16**, `vite build` clean, zero repo-path strings |
| Packed browser evidence (focus-emulation protocol) | dialog lifecycle **all green** (entry, Tab containment, Escape close + trigger restore); schedule surfaces render values incl. **end-only ranges displayed** (`20/10/2026` + `dd/mm/yyyy`); calendar pointer selection selects (`aria-selected=true`) |
| Packed authoring entry | boots; Inspector style/state panels interactive; the full prop-editor journey remains the round-3 recorded slider demonstration — additional browser family journeys belong to the fresh browser-experience review |
| Formatting | all round-3a added/modified prettier-covered files formatted; no unrelated churn (the pre-existing 38-file drift list is untouched, recorded in §7) |
| Branch hygiene | the round-3a commit accidentally included a build-generated `.tmp-scaffold-check-*` directory; removed in the follow-up hygiene commit and the pattern gitignored (no force-push) |

---

# ROUND 4 (2026-10-12, same verifier) — repair-03 independent recheck

Candidate under verification: `32d8465aa9c810e4285995549a562957c85d2e36`
(branch `codex/ui-foundation-u4-full-catalog-repair-03`), a linear 5-commit
repair on top of this report's round-3a delivery tip `05c1f9a0b899…`
(range unification `6f24ca7`, TimeField `78e66e2`, tooltip `1cb7447`,
command labels `74a2216`, numeric-list drafts `32d8465`). Isolated
verification branch: `codex/ui-foundation-u4-repair-verify-04`. The builder
changed NO test files — every round-3a oracle ran unchanged against the
repairs.

Provenance note: the owner-referenced builder report
`U4-REPAIR-03-DELIVERY.md` was not present in the repository, the builder
worktree, or local disk at verification start and therefore could not be
imported with a checksum. The five repair commits themselves are treated as
the builder's claims; every finding below is from independent reproduction
at the exact candidate.

## 16. Task 1 — the remaining datefield-supply probe: builder explanation CONFIRMED

`probe-datefield-supply.test.ts` was reproduced failing exactly as
committed. Root cause: the round-3 fixture calls `setValue(...)` (a Svelte 5
`$state` write, which batches a reactive update) and asserted the display
immediately — before any supported update boundary. The initial assertion
passed only because the probe explicitly `flushSync()`-ed after mount.

Verification: in a scratch run (deleted after use), the identical
expectations pass with `flushSync()` after each external change AND with
`await tick()` — both public Svelte 5 boundaries — at the exact candidate.
The supply channel itself is live; the round-3 A1 reading for the single
DateField was a probe timing artifact.

Oracle correction, recorded: the committed probe now reads the display
through `flushSync()` — the supported synchronous boundary — with
expectations unchanged (`09/10/2026`, `dd/mm/yyyy`, `02/11/2026`, no sleeps,
no remounts, no weakened assertions). The round-3 version is preserved
verbatim as historical evidence at
`packages/ui-svelte/test/historical/probe-datefield-supply-v1.historical.ts`
(excluded from the vitest glob). The range half of A1 was genuine: its probe
already observed the boundary and only passes with the builder's
`catalogRangeState` unification.

## 17. Task 2 — every repair independently reproduced

The 10 pinned round-3a oracles all pass at the candidate (builder untouched;
exact contracts intact), plus new oracles where none existed:

| Repair | Independent evidence (this round) |
| --- | --- |
| A1 external supply (range) | `probe-range-external-state` 3/3 (boundary-observed; clear/restore/start-only/end-only display agreement) |
| A1 external supply (single field) | corrected `probe-datefield-supply` (§16) |
| A2′ calendar emission dedup + ordered end-only restart | `probe-date-range-picker` 5/5 — one action = one emitted transition; end-only selection stays ordered with display/state agreement |
| Field clearing (withdrawn A2 stays withdrawn) | `probe-date-clear-sequence` 4/4 — full-clear sequence, empty convention, intact endpoint, restoration, no echo; incremental Backspace semantics preserved |
| TimeField en-GB 12h / en-US 12h / en-GB 24h | `probe-time-hour-cycle` 3/3 — keyboard changes, visible 12-hour text, `aria-valuenow`/`aria-valuetext`, dayPeriod presence and PM⇄AM, ISO value agreement |
| A4 tooltip controlled-open | `probe-b5-interactive` — controlled `open` mounts `[role=tooltip]`; hover/keyboard/dismissal browser-verified this round (§19) |
| N1 command label search | NEW `probe-command-label-search` 3/3 — authored label matches (full + mid-word), value search retained, authored empty slot on non-match, Enter activation emits the authored VALUE (discovered: the output binding must be declared on the item node — the emission comes from the item's io) |
| Numeric-list drafts (new repair) | NEW `state-values-panel-numeric-list` 4/4 — draft kept verbatim (`1e999` survives the number-input sanitizer and is non-finite: genuine invalid path), validation surfaced without seeding or clearing the draft, application clears, removal filters, scalar finite-number guard; engine-level partial-draft reset is browser-covered |

Range state matrix re-verified across the probes: empty / start-only /
end-only / complete / clearing / restoration / display-state agreement /
reversed-range refusal (ordering guard runs before state mutation).

## 18. Task 3 — host isolation and lifecycles

NEW `probe-host-isolation.test.ts` (+ `HostIsoFixture`): TWO DocumentHosts
mounted simultaneously with identical document ids and component node ids.

- Supply isolation: each host's `stateValues` reaches only its own display;
  updating A leaves B byte-identical.
- Portal ownership: A's controlled tooltip opens exactly one portal in the
  document, stamped with A's `data-ui-owner`; unmounting A removes its
  portal from the document; B can then open its own portal, owned by B.
- Styling: the cascade scope class is keyed by the DOCUMENT (identical plans
  share one scope — byte-identical styles by design); instance isolation is
  carried by the distinct per-host `data-ui-owner` ids. Recorded as design,
  not defect.
- Lifecycle: the surviving host stays interactive (checkbox toggles through
  the state loop) and keeps accepting supply after its sibling unmounts;
  retained callbacks keep flowing.
- Runtime/authored-state separation: runtime canvas interactions leave the
  authored `UiEditSession` untouched — working revision, source bytes,
  dirty flag and undo history all unchanged — and authoring still works
  afterwards (accepted `bindExpression`, revision advances, edit undoable).

Repair-mechanism review (reusability / consumer independence): the range
repairs live in one reusable module (`range-state.svelte.ts` /
`catalogRangeState`) consumed by the field, picker and calendar surfaces —
`emitRange` is now referenced only there and in its definition; no
duplicated emission logic remains in adapters. The TimeField primitive
(Root/Input/Segment + locale-carried `hourCycle` via `Intl.Locale`) is
generic and seed-independent. The tooltip ids/anchor and command keyword
repairs are generic.

Seed-specific exception recorded: the schedule seed's `handover-time`
time-field was re-pointed `en-US` → `en-GB` (12h) in `78e66e2` — the
finished-app document now exercises the en-GB 12h path; en-US 12h remains
covered by the retained probe control. Documentation nuance recorded (not a
defect): a comment in `CatalogRangeInputs.svelte` still describes the
composite field's watcher as omitting end-only external updates; the
oracles demonstrate the current behavior is correct via the range-state
normalization.

## 19. Browser evidence (focus-emulation protocol) — real authoring journeys

The complete packed UI journey ran on the **production preview of the
isolated packed consumer** (`vite preview`, fresh install from the 10
packed tarballs): per family — route blade select → Layers-panel search +
row click (genuine pointer) → Inspector prop edit (genuine CDP keyboard:
focus, select-all, type, Enter) → canvas echo → Undo removes → Redo
restores → per route Save → Reload stored → persistence → **finished-app
(`app.html`) demonstrates the saved result**. Seed reset per route before
each journey. Focus-emulation protocol enabled for the page lifetime;
all input was genuine pointer/keyboard (no synthetic DOM events).

**50/50 family journeys pass, covering all 38 available families + AppShell
across their governing modes** (single/multiple, field/picker/calendar,
menu/sub/checkbox/radio parts). Per-family edit: select → edit applicable
properties/connections/composition → undo/redo → save → reload/reopen →
finished app.

Evidence tiers (recorded honestly):
- **Text echo in canvas + finished app (36 journeys)** — button, tabs-trigger,
  accordion-item, checkbox, switch, toggle, radio-group, combobox,
  select-multiple, avatar, date/time/range family labels, meter/progress/
  slider (aria-label tier), pagination/toolbar/tabs (aria tier), separator
  (aria-orientation vertical), command placeholder, label, appshell title, …
- **Closed surfaces OPENED in the finished app (5)** — alert-dialog
  (Corrections tab → trigger → `[role=alertdialog]` shows the authored
  title), popover (floating content), dialog (shell route), tooltip
  (hover → `[role=tooltip]`), link-preview (hover → floating card): all five
  demonstrate their saved changes.
- **Plan-level authoring (10, recorded with reason)** — dropdown-menu,
  context-menu, menubar.menu/item, command.item, navigation-menu.item
  (slot content wins over the `label` prop — F15), accordion-multiple
  (label prop unimplemented — F16), collapsible ×2 (trigger slot wins),
  scroll-area (non-visual prop), aspect-ratio (CSS-only): the authored
  value is verified through the Inspector's authored-prop editor after
  Undo/Redo/Save+Reload; no visual echo exists BY IMPLEMENTATION.

Artifacts: journey driver + config + result matrix recorded in the round-4
review evidence; screenshots `browser-r4/r4-01…03.png` (workbench,
finished app, opened dialog with authored title).

**Preview/production parity: IDENTICAL** — the packed production preview
and the workspace dev server were driven through the same schedule + queue
surfaces (segment displays, menu text, page titles, occurrence counts 53/41)
with byte-identical snapshots.

## 19a. New findings (round 4, non-blocking delivery findings)

- **F14 (gate)**: the root `build` script omits `@victframework/ui-preview`,
  which the pack closure includes — from a clean checkout, the documented
  `npm run build && node scripts/pack-u4-consumer.mjs` sequence fails at the
  isolated build. Verified twice; worked around by building the workspace
  package explicitly. Builder-repair item.
- **F15 (accessibility, non-blocking)**: the `label` prop of
  dropdown-menu/context-menu/menubar.menu/menubar.item/command.item/
  navigation-menu.item is accepted by the authoring surface but is not
  reflected as an accessible name when the seed provides slot content
  (slots always win); the authored value persists in the plan only.
- **F16 (dead prop, non-blocking)**: accordion-multiple's `label` prop is
  declared in the descriptor but unused by the implementation (the accordion
  items carry their own labels).

Neither F15 nor F16 is part of the pinned defect set; both are repair-
candidate items for the next builder cycle and do not block this round.

## 20a. Ledger reconciliation + launch instructions + founder walkthrough

**Ledger**: `reconcile-ledger.mjs` re-run against this worktree:
RECONCILIATION OK — 41 coverage families (38 available, 3 deferred,
bits-ui 2.19.3); every available family keeps an explicit ledger
assignment; PinInput/RatingGroup/TimeRangeField remain the only named
exclusions. Ledger rows stay at their batch status — per AGENTS.md they
advance to Verified only at the final gate + owner acceptance.

**Reliable launch instructions (packed, reproducible from a clean clone —
note F14 for ui-preview)**:
```
git clone https://github.com/radz2291/vict-02 && cd vict-02
git checkout 32d8465aa9c810e4285995549a562957c85d2e36
npm ci
npm run build && npm run build -w @victframework/ui-preview   # F14
npm test            # at the bare candidate: 3102/1/3 (the 1 = the round-3 datefield-supply
                    #   oracle asserting before the update boundary; see §16/§20)
                    # on verify-04 (with the verifier commit): 3113/0/3
node scripts/pack-u4-consumer.mjs                             # -> ISOLATED PACKED-ARTIFACT VERIFICATION: OK
cd ../u4-consumer-isolated/u4-consumer && npx vite preview --port 5450
# authoring: http://127.0.0.1:5450/     finished app: /app.html?doc=<queue|detail|schedule|shell|controls>
```

**Founder walkthrough (5 minutes)**:
1. Open the authoring entry `/` — five route blades on the left rail
   (Inspection queue, Evidence & corrections, Scheduling, Workspace &
   assignment, Submit review); click `Scheduling`.
2. In the Layers panel (right), search `visit-duration`, click the row —
   the Inspector shows the slider's authored props; edit `label`, press
   Enter; the canvas echoes the change; `Undo` reverts it, `Redo` restores
   it; the status line shows `Unsaved changes · rev …`.
3. `Save` — the status flips to `Saved · rev …`; `Reload stored` re-reads
   the saved bytes; `Open finished app ↗` shows the saved result in the
   running product (labels, values, aria names all carried).
4. Closed surfaces: on `Evidence & corrections`, open `Corrections` tab →
   `Archive inspection` opens the alert-dialog with its authored title;
   on `Workspace & assignment`, the dialog trigger shows the authored
   `Review guidance` title; on `Inspection queue`, hover `Priority help`
   (tooltip) — all saved changes survive reload.
5. Dates/times behave per locale: `13:30` renders `PM` in the en-GB 12h
   time field; one calendar selection emits one coherent range change;
   clearing a field endpoint leaves the other displayed.

(This walkthrough was exercised by the round-4 journey matrix, §19.)

## 20. Gate (round 4) — actual results

| Gate | Result |
| --- | --- |
| Root `npm run build` | clean — **with one delivery finding (F14)**: the root build script omits `@victframework/ui-preview` (and `ui-editor`), so from a clean checkout the packed closure cannot be produced by the documented command alone; `npm run build -w @victframework/ui-preview` was required before packing (ui-editor ships Svelte sources and resolves without dist). Builder-repair item, not a runtime defect. |
| `npm test` (full battery) | **3113 passed / 0 failed / 3 skipped** (3116) on THIS verification tree (candidate + the round-4 verifier commit: corrected datefield-supply oracle + 10 new verifier probes). **At the bare candidate `32d8465a` the battery is 3102/1/3** (independently reproduced, deterministic across 3 runs): the single failure is exactly the UNCORRECTED round-3 `probe-datefield-supply` (asserts before the Svelte 5 update boundary — see §16; its correction is this tree's verifier commit `b874205…`, together with the 10 new tests: 3106 + 10 + 1 = 3113). PROVENANCE CORRECTION after independent review — the repairs themselves are unaffected |
| `npm run typecheck` | **0 errors** (after fixing two type slips in the new verifier probes; the candidate's own sources never errored) |
| `npm run check:ui` | **0 errors / 5 warnings** (unchanged) |
| Consumer suite (workspace) | **16/16** |
| Pack | 10 tarballs, fresh manifest, zero tarballs in the repository tree (F13 holds) |
| bits-ui | **exact `2.19.3`** in both manifests, workspace lock and the fresh isolated install |
| Isolated consumer (script-driven: pack → isolate → rewrite to `file:vendor` → install → build → test → verify) | **`ISOLATED PACKED-ARTIFACT VERIFICATION: OK`** — 16/16 from packed artifacts, zero workspace links, zero repository source paths in built bundles |
| Packed entries & bundle separation | authoring entry (`index.html`) + finished app (`app.html`) both present; `app-*`, `authoring-*`, `execution-*` chunks separate across the transitive graph; catalog/theme CSS ships in the packed ui-svelte artifact |
| Formatting | all round-4 verifier files prettier-clean |

**F14 (delivery, non-runtime)**: root `package.json` `build` does not build
`@victframework/ui-preview`; `scripts/pack-u4-consumer.mjs` packs it. From a
clean clone, `npm run build && node scripts/pack-u4-consumer.mjs` fails at
the isolated build (`Failed to resolve entry for package
"@victframework/ui-preview"`). Repair: add the workspace build (or build the
closure from the pack script). Recorded for the next builder cycle.


---

# ROUND 4 — THREE FRESH REVIEWS (frozen candidate `32d8465aa9c810e4285995549a562957c85d2e36`)

Reports (imported verbatim, reviewer-authored):
- `U4-R4-TECHNICAL-FALSIFY.md` — independent technical falsification
  (vict-verifier agent, fresh context; its session hit the run timeout once
  and was revived solely to write up findings already gathered — the packed
  closure re-run was cut off and is explicitly NOT its evidence).
- `U4-R4-AUTHORING-EXPERIENCE.md` — real-browser authoring/experience review.
- `U4-R4-UNFAMILIAR-EXERCISE.md` — unfamiliar-agent exercise on packed
  public capabilities only.

## 21. Review verdicts and reconciliations

**Technical falsification** — overall: "repair substance real, round-4 gate
presentation of battery/oracle provenance not reproducible at the pinned
candidate." Accepted in full; §20 and §20a carry the provenance correction
(battery on verify-04 tree vs bare candidate; the one bare-candidate failure
is the known pre-boundary round-3 oracle). Independently confirmed: 9/10
pinned oracles pass at the candidate unchanged; 18 adversarial probes pass
twice (rapid-selection dedup, earlier-day ordering, PM→AM→PM rapid toggles,
mid-flight unmount, author-while-canvas-runs + stale-revision replay
rejection, invalid StateValuesPanel values, partial-label search); F14
ordering confirmed structurally. The D-edge failures were the reviewer's
own probe artifacts (documented as such by the reviewer) — the verifier
additionally reproduced the mid-flight-destroy edge directly: no portal
leak in either path (scratch probe, not committed). Non-blocking
observations recorded: from-complete restart emits end-clear before start
(order asymmetry vs the end-only restart; both exactly-once); the
numeric-list guard is finiteness-based, so `-3` is accepted as a member.
Claim 5 (packed closure) — not verified by the reviewer (timeout cut);
the verifier's own completed run (§20, `ISOLATED PACKED-ARTIFACT
VERIFICATION: OK`) stands as the evidence of record.

**Authoring/experience review** — verdict: PASS WITH FINDINGS.
Independently reproduced the entire journey matrix (50/50, 50/50 persisted,
40/50 app echo + 10 plan-level), confirmed all three repair checks from the
user standpoint (single coherent range transition; en-GB 12h 13:30 → PM;
tooltip opens on genuine hover), confirmed all five closed-surface
demonstrations (5 screenshots). New findings:
- **F17 [moderate, repair-candidate]**: the numeric-list invalid-draft
  validation is unreachable in real Chrome — `type=number` sanitizes
  partial drafts to `value=""` (badInput) before `oninput`, so the user
  experiences a silent no-op; the pinned component-level oracle's contract
  holds in the test engine only. The builder should surface `badInput`
  explicitly.
- F2/F3 [minor]: number-input error paths cannot be reached by typing in
  Chrome; Enter does not commit a list member (click-only).

**Unfamiliar-agent exercise** — verdict: PASS WITH FINDINGS. Cold-start
succeeded on all three exercises using only packed public artifacts
(finished-app render; full authoring round-trip with Save/reload;
programmatic catalog consumption from the packed dist). Gaps recorded for
the next builder cycle: undeclared bits-ui namespace exports
(`Button.Root`) with an opaque failure mode; tarball exports point at
Svelte sources, making a Svelte/TS-capable bundler an undeclared hard
requirement; ControlScope/catalog.css coupling and the vite
dep-optimization recipe are undiscoverable from public docs; the consumer
README still carries the stale round-1 status text.

## 22. Round-4 verdict

- Repair substance (A1/A2′/TimeField/A4/N1/numeric-drafts): VERIFIED by the
  verifier and independently confirmed by all three reviews. No pinned
  oracle was weakened and the builder changed no tests.
- Delivery/gate presentation: one falsification (battery provenance),
  corrected in §20/§20a by the verifier after review — the correction is
  itself evidence of the review process working.
- New findings for the next builder cycle: F14 (gate), F15/F16 (plan-level
  label props), F17 (Chrome numeric-list badInput), plus the unfamiliar
  review's public-capability gaps and the falsifier's two observations.
- **Screening result: candidate `32d8465a…` passes screening with the
  §20 provenance correction applied.** B1–B5/U4 remain OPEN; the ledger
  does not advance; owner acceptance remains PENDING until the final gate
  and founder checkpoint.

---

# ROUND 5 — U4 COMBINED INTEGRATION AND VERIFICATION (2026-10-13)

## 23. Combined candidate and lineage

- **Combined tested SHA: `fe800369968489390428d3be7808b0799f9d944d`**
  (branch `codex/ui-foundation-u4-combined-verify-05`).
- Merge commit `4e2e4fe` integrates, with preserved ancestry:
  - verification track `codex/ui-foundation-u4-repair-verify-04` @
    `143ffc431f1f88b74795a91d9ed5bd031758c4cc` (corrected oracles,
    verifier probes, packed evidence, three round-4 reviews);
  - owner-UI track `codex/ui-foundation-u4-full-catalog-repair-03` @
    `954f93ffa70b34abe7f72c4bee04474bdd751aea` (two commits on the common
    base `32d8465aa9c8...`: `e1ab78a` catalog layouts/nested overlays,
    `954f93f` decision spacing/assignment clarity).
- Both source branches untouched; no forced writes; main untouched.
- Governing payload unchanged: `4cfe5b373481e29cff7d9bd02d9c473064a8aa9c`.
  Full-catalog scope unchanged: 38 assigned families + AppShell; three
  named deferred families excluded.

### 23a. Owner-UI provenance (delivery document gap)

The owner-referenced `U4-OWNER-FEEDBACK-DELIVERY.md` was NOT FOUND - not on
the owner-UI branch, not in any local ref, not on disk (searched all refs
and the filesystem). Recorded as a provenance gap. The seven owner issues
are therefore derived from the owner's instruction and the owner-UI diff
itself, pinned by checksums:
- `e1ab78a` patch SHA-256
  `be5276c4d8aa290bd48c1fb290e9ec3b0cb60158cee8fdcf02acb18065bb084c`
- `954f93f` patch SHA-256
  `5ed4d129d9222522a0aa92dee27c379eb8c105f25eca703ecdba3ed68163dcb3`
- full owner-UI diff (29306 bytes) SHA-256
  `fa1e39bf8028fc231a48f7ad3604d4804b84a183c57268657f2012020d6b91d2`

### 23b. Seven owner issues -> changes -> combined evidence

| # | Issue | Change (owner-UI diff) | Combined evidence |
| --- | --- | --- | --- |
| 1 | Combobox input/arrow placement | `.vict-combobox-control` wrapper; arrow in `aria-hidden` span; input `padding-inline-end: 52px`; 40px absolute trigger | focus check `combobox-placement` PASS (geometry asserted); screenshot `r5-combobox-placement.png` |
| 2 | Decision area layout | `decision-actions` flex row (gap 12) in the detail seed; popover header/body grid | `decision-layout` PASS (same-row + >=8px gap asserted) |
| 3 | Popover layout | `vict-catalog-overlay-header` (title + close) and `.vict-catalog-popover-body` | `decision-layout` PASS; `r5-decision-layout.png` |
| 4 | Dialog layout | overlay/content layer-calc z-index + grid gap | `dropdown-above-dialog` PASS (dialog over page content) |
| 5 | Stable buttons + adjacent feedback | ActionFeedback moved inside `.vict-action-control` (flex column, button anchored); schedule/global feedback de-duplicated in seeds | `stable-button-feedback` PASS: aria-busy truthful ~600ms, anchor x/y stable, feedback text appears in-control; width delta (label->spinner swap) recorded as observation `obs-button-width-delta` |
| 6 | Dropdown layering above dialogs | `portal-layer.ts` Svelte-context depth; `--vict-catalog-layer: layer*100`; all overlay z-indexes layer-calc | `dropdown-above-dialog` PASS: the dialog select's portaled listbox paints above the dialog (elementFromPoint), dialog content z=181 |
| 7 | Page-position preservation (ordinary + nested menus) | `strategy="fixed"` on menu contents; `catalogMenuOpenFocus` (preventScroll); `catalogFocusReturn` | `page-position-preservation` PASS: scrollY identical on open/nested-open/close; focus returns to trigger; `r5-page-position.png` |
| - | Selection outlines scoping | attribute-specific selectors replace bare `[data-state]`/`[data-selected]` | `selection-outlines` PASS: selected toggle gets the selected style; unselected controls do not |
| - | Mobile | responsive contract (styles.css) + fixed-position menus | `mobile-layouts` PASS: no horizontal overflow at 390px on schedule + shell; screenshots |

### 23c. Delivery findings disposition (F14-F17) and documentation

- **F14 RESOLVED (verifier, routine build work).** Root `build` now also
  builds `@victframework/ui-editor` and `@victframework/ui-preview` - the
  packed closure's prerequisites - so the documented build+pack sequence
  completes from a fresh checkout with no manual pre-build. Validated on
  this worktree: root build from a no-dists state produced both dists and
  a clean typecheck. Pack re-run from the candidate:
  `ISOLATED PACKED-ARTIFACT VERIFICATION: OK`.
- **F17 RESOLVED (verifier-made repair - see 23e).**
  StateValuesPanel scalar number and number-list draft inputs read
  `validity.badInput`: invalid partial input surfaces 'Enter a valid
  number.' and never seeds or clears a value; deliberate empty still
  clears; Add refuses while the visible draft is invalid (a stale valid
  prefix cannot commit behind the user's back). Component oracle extended
  (simulated badInput, labelled); the round-4 raw-text expectation is
  superseded and preserved verbatim at
  `test/historical/state-values-panel-numeric-list-v1.historical.ts`.
  REAL-Chrome behavior exercised by genuine keys:
  `f17-real-chrome-numeric-feedback` PASS (error text, value untouched,
  list refusal, valid entry applies and clears).
- **F15 RESOLVED (verifier-made repair).** Slot precedence preserved. The
  Inspector annotates a `label` prop whose visible text is owned by a
  FILLED slot for 16 affected catalog component ids ('Shown from the
  <slot> slot content while that slot is filled; this value is the
  fallback text.'); no annotation when unfilled. Oracle:
  `inspector-slot-owned-label.svelte.test.ts` (2 tests).
- **F16 RESOLVED (verifier-made repair).** B2Accordion (single + multiple)
  wires a non-empty authored `label` to `aria-label` on the group root;
  empty/unset leaves the attribute off. The previously plan-only journey
  UPGRADED to a real aria echo (50/50 matrix). Oracle:
  `probe-accordion-label.test.ts` (2 tests).
- **Documentation findings RESOLVED (verifier).** Consumer README
  rewritten: Svelte-capable bundler requirement, optimizeDeps exclusion
  recipe, bits-ui namespace exports, ControlScope + catalog.css setup,
  fresh-checkout build (F14). Stale round-1 FAIL status removed.

### 23d. Reproducible pipeline from the candidate SHA

**PROVENANCE CORRECTED AFTER THE GATE (see section 24):** the original
text of this table attributed every result to `fe800369...`; the gate
falsified that for the browser rows - the F17 Add-refusal delta plus its
pinning-oracle change lived in the evidence-labeled commit `60b95e6e`,
not in `fe80036`. Remedy adopted: the candidate was RE-PINNED as
`dcd3cbea255af9aa...` (the refusal inside the candidate, plus the
cold-start gate fixes: U4_ISOLATED_ROOT resolution, README gaps G-A/G-B)
and the COMPLETE pipeline was re-run from that exact committed tree
(working tree clean). The table below reports the re-pinned results;
the per-SHA history is kept in section 24a. Original (superseded)
introduction kept for the record:

| Check | Result |
| --- | --- |
| Root build (F14 workflow, from no-dists state) | clean; ui-editor + ui-preview dists produced |
| Typecheck (ui-svelte tsc --noEmit) | 0 errors |
| svelte-check | ui-svelte 0 errors / 5 warnings; ui-editor 0 errors / 6 warnings (pre-existing a11y/lint patterns) |
| Full battery `npm test` | **3119 passed / 0 failed / 3 skipped (3122)** at `fe80036`; re-run at the re-pinned candidate `dcd3cbea` with full log capture: **3119 passed / 0 failed / 3 skipped (3122)** (an intermediate under-capture reading of 3118/194-files was superseded by the authoritative full-capture run; the earlier load-flake note below documents the SIGKILL fixture sensitivity) |
| Battery re-run note | one pipeline re-run showed 3 load-flakes in the real-child-process SIGKILL fixtures (`restart-sigkill`, `agent-governance-corrective`); both files pass 10/10 in isolation and the identical tree was green in the primary run - flakiness documented, not a product defect |
| Pack + isolated verify | **ISOLATED PACKED-ARTIFACT VERIFICATION: OK**; isolated bits-ui **2.19.3** exact; isolated suite 16/16; both entries build |
| Focused browser checks | **10/10 PASS** (23b table + keyboard-nav + mobile + F17 real-Chrome); results `u5-focus-results.json` |
| Full-catalog journey replay | **50/50 PASS; 50/50 persisted after Save + Reload stored; 41 finished-app echoes; 10 honest plan-tier** (accordion label upgraded plan->aria this round); results `u4-journeys-r5.json`, config `u5-journey-config.json` |

Pack manifest: regenerated by the candidate pack run (10 tarballs,
SHA-256 manifest at `u4-consumer-isolated/u4-consumer/pack-manifest.json`).
NOT SHIPPED/CLAIMED: SSR, performance budgets.

### 23e. In-scope repair provenance for this round

The Codex builder channel (external CLI) is NOT installed in this session
(`external-cli:codex missing`), so the owner-directed in-scope repairs
F14/F15/F16/F17 + docs are VERIFIER-MADE with full disclosure. They are
compensated by the fresh independent combined gate (section 24): none of
the gate reviewers authored any repair. The owner may re-assign any of
these repairs to Codex; the corrected tests pin the contracts either way.


---

## 24. INDEPENDENT COMBINED GATE (round 5) — verdicts and reconciliation

Three fresh reviewers at the frozen candidate; none authored any repair.

### 24a. Technical falsification — `U4-R5-COMBINED-TECHNICAL-GATE.md`

- Lineage VERIFIED (both parents ancestors; no rewrites; corrected
  oracles survive). Owner-UI diff VERIFIED TRUTHFUL against the seven
  issues (13 files, file-by-file). F14/F15/F16 + README VERIFIED.
- **F17 FALSIFIED as claimed at `fe80036`**: the Add-refusal was absent
  there (it sat in the evidence-labeled commit `60b95e6`) — a candidate-
  boundary/record-truthfulness defect. Its own stale-prefix probe failed
  at `fe80036` and PASSED at `60b95e6`. Gate verdict: FAIL with the
  remedy "re-pin the candidate (or correct the record) + one
  uncontended packed-closure re-run".
- **REMEDY APPLIED (this record, commit `dcd3cbea`)**: candidate
  re-pinned WITH the refusal; complete pipeline re-run from the exact
  re-pinned tree (table above); packed closure re-run UNCONTENDED →
  `ISOLATED PACKED-ARTIFACT VERIFICATION: OK`. The falsified claim is
  cured: at `dcd3cbea` the refusal is candidate code, pinned by the
  oracle the gate itself verified passing at this tree.
- Adversarial probes 12/12 at this tree. Non-blocking observation:
  sibling page-level portals share depth 100 (popover == dialog at the
  same depth; DOM order tie-breaks) — recorded as a future hardening
  note, no failure.
- Its packed-closure attempt was EBUSY-blocked by a concurrent
  reviewer's server (correctly reported INCOMPLETE, not a pass) — the
  uncontended re-run above stands as the evidence.
- Battery observed by the gate: 3118/1/3 with the single failure being
  the `release-authority` timeout under load, 65/65 in isolation —
  consistent with the documented load-flake class.

### 24b. Fresh unfamiliar-agent cold-start — `U4-R5-COMBINED-COLDSTART-GATE.md`

- **PASS** — install, build, run, author, undo/redo, save, reload,
  finished-app replay, programmatic `Button.Root` consumption (README
  requirement 3 verified accurate), contract suite 16/16 (+2 scratch) —
  all from the documented path.
- Gaps found and RESOLVED in the re-pinned candidate: **G-C** real
  script bug (`U4_ISOLATED_ROOT` not `path.resolve`d — forward-slash
  overrides always failed isolation verification) FIXED;
  **G-A** (bare example copy has no vendor tarballs) and **G-B**
  (isolated-dir hard-delete/EBUSY + the override) now DOCUMENTED in the
  README.

### 24c. Real-browser recheck — `U4-R5-COMBINED-BROWSER-GATE.md`

- Focus driver independently re-run: **10/10 PASS** (first-run
  `stable-button-feedback` failure investigated and classified as a
  hydration-timing environment flake, screenshot kept).
- Journey matrix independently re-run: **50/50 PASS, 50/50 persisted**.
- Own probes: (a) combobox inset geometry PASS; (b) select listbox above
  the assignment dialog PASS (z 260 vs dialog 181, elementFromPoint);
  (c) menubar scroll preservation + focus restoration PASS; (d) accordion
  `findings` label as the group root's `aria-label` in the finished app
  PASS; (e) Inspector slot-owned note NOT COMPLETED in its window (the
  preview was restarted mid-session by the verifier's uncontended pack —
  environment, disclosed).
- Probe (e) was completed afterwards by the VERIFIER on the re-pinned
  build (labelled: not independent): the truthful note 'Shown from the
  "content" slot content while that slot is filled; this value is the
  fallback text.' renders under the command.item label prop.
  Product defects found by this reviewer: NONE among completed checks.
- NOTE: this reviewer's runs executed on the `60b95e6`/`ea6c6e2` trees,
  whose browser-relevant code is IDENTICAL to `dcd3cbea` (the re-pin
  changed only the pack script, README, records); the verifier's
  focus/journey/probe re-runs above cover the re-pinned tree directly.

### 24d. Verifier's re-pin pipeline at `dcd3cbea` (exact committed tree)

- battery **3119/0/3** (full capture); typecheck 0; svelte-check 0
  errors (6+5 warnings, pre-existing patterns); pack uncontended
  **ISOLATED PACKED-ARTIFACT VERIFICATION: OK**, bits-ui 2.19.3 exact,
  16/16 isolated; focus **10/10** (re-run; one first-run hydration
  flake, same classification as the independent reviewer's); journeys
  **50/50 PASS, 50/50 persisted, 41 app echoes**; probe (e) PASS.

## 25. ROUND-5 COMBINED-GATE VERDICT

**PASS WITH FINDINGS** (after remedy). The single falsified claim
(F17 candidate boundary) was cured by re-pinning and a full same-SHA
pipeline re-run; the record now attributes each result to the exact
tree that produced it. Non-blocking findings carried forward:
portal-depth-100 sibling observation; button label→spinner width swap
(anchor stable); cold-start gaps G-A/G-B/G-C (resolved in this
candidate); 10 plan-tier journeys (honestly tiered); SSR and
performance budgets remain UNCLAIMED. **Combined tested SHA:
`dcd3cbea255af9aa…`** (record tip: see push line in the delivery).
B1–B5/U4 remain OPEN; the ledger does not advance; owner acceptance
PENDING at the founder checkpoint.
