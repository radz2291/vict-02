# Independent N1 follow-up — repaired candidate

Exact independently tested and remote-matched candidate: **1bd745a04334af07934db33211ef7803a2e4cd0b**, branch `codex/ui-foundation-u2-inspector-ux`. Verdict: **PASS for this bounded UX follow-up, with documented integration limits**. No unresolved in-scope blocking finding was observed. The failed e593 candidate remains `../n1-candidate/REVIEW.md`; this verdict does not erase its findings or approve the compiler gate, owner experience acceptance, or U2 closure.

Source was independently checked out detached. No candidate source repairs were made. Only evidence under `docs/ui-foundation/u2-ux/independent-review/` is untracked. Remote branch SHA independently matched the tested SHA. Native Chrome used independent Puppeteer harnesses and ports5201/5202; builder servers were untouched.

## Journey verdicts

| Challenge | Verdict and observed evidence |
|---|---|
| Historical stale measurement control | PASS reproduction: original83 Inspector before real Canvas shows46px annotation after valid61px edit renders61px. Copy identity was checked after reversing only two imports/newline normalization. This is not a reproduction of the historical report's exact screenshot pixels. |
| Base edit/history/Reset | PASS:61→Undo46→Redo61→Reset32→Undo61→Redo32. Existing `setStyleDeclaration` with value omitted removes only the override, keeps other declarations and attached titleNarrow. |
| Conditional edit/Reset/history | PASS: active narrow29→Reset32→Undo29. Existing `setConditionalStyle` with value omitted retains original attached32px source. Editing destination changes do not force the preview condition. |
| Selection/scope/callback | PASS: exact repeated occurrences independently measure17px versus31px. Intro/title changes and replacement plain callback refresh. Actual selected component root remains cardA pink during shared blue edit; cardB reports its own blue. Instance Reset reveals attached seed rgb187,221,204; Undo restores pink. Source/seed and unrelated declarations remain intact. |
| Save/full reload/reopen | PASS: canonical working document persisted and selected occurrence measurements remain truthful after full reload and reopening saved source. |
| Live pseudo states — M4 | PASS repaired: normal17→native hover41→pointer leave17→focus51→native held pointer active71→release with focus51→blur17. Actual, input and Browser now agree at every settled sample. Live events create zero drafts; source JSON, digest, revision, dirty flag and undo/redo availability stay identical. |
| Visible Reset — L2 | PASS repaired: intrinsic42.55px button, client/scroll widths both41px; no label overflow. Native Reset remains usable. Accessible names identify each property. |
| Responsive review consumer/mobile | PASS spotcheck:1440x900,1024x768,390x844 and390px preview container; actual46→32→46 agrees with Browser now while authored46 remains separate. No horizontal viewport overflow. Mobile Text size remains in the first screen with details open, y599–629. |

`journeys.json` contains28 main observations and zero page exceptions. `live-pseudo.json` contains7 live transitions plus before/after source/history snapshots. `host-spotcheck.json` contains5 viewport/container states and zero page exceptions. Screenshots `reset-390.png`, `host-390.png`, `host-1024.png`, and `live-active.png` were visually inspected; repaired Reset fits, text controls remain visible, and selected active row measurement is71px.

## Independent check results

Exact1bd full renderer suite: **123/123,18 files PASS**. Root TypeScript PASS; design TypeScript PASS; design12/12 PASS; production build PASS. Logs are `renderer-tests.txt`, `root-tsc.txt`, `design-tests.txt`, `design-tsc.txt`, `build.txt`. Completed sequence exited0. Broad supported Svelte check remains **RED:23errors/4warnings in4 unchanged files**, logged in `broad-supported.txt`; it is not hidden by renderer/build passes. Existing EditorCanvas/workbench/service diagnostics and renderer accessibility warnings remain outside this bounded slice. No new Inspector/InspectorControl/review-route diagnostics were observed in the completed broad check.

## Retained failures and limits

The e593 M4/L2 report, failed geometry, historical negative control and all earlier ROUND-1/ROUND-2/iteration2 evidence remain preserved. Initial independent fixture omitted typed repeat fields, producing compile errors; `failed.json` retains that harness failure. Initial original-control unitless61 was invalid CSS and is separately retained, then corrected to61px. On first repaired hover run, default em margins moved the row away from the native pointer; actual and annotation both17 did not demonstrate41px hover. `live-pseudo-hover-layout.json` preserves that inconclusive run. Only independent fixture margin was fixed at10px for a stable target; all7 live transitions were then measured. Final fixture is preserved as `Host-final-fixture.svelte`.

The reusable Inspector refreshes source/selection/scope/edit-target/callback, resize, and ordinary pointer/focus/key events. Arbitrary external or container changes without those triggers still require the host's reactive measurement invalidation; the review consumer supplies it through ResizeObserver/domVersion. No CSS animation completion, asynchronous external style mutation, forced browser pseudo state, or disabled-property transition is claimed tested. Focus was placed on the real rendered element; held pointer active and hover used native pointer input. Event refresh does not change source/history.

The previous six-improvement comprehensive suite remains historical verification lineage. This follow-up reran affected source/history, exact selection, reset, responsiveness, mobile and live-state journeys plus the full automated renderer/design suites; it is not a claim of a new exhaustive founder study. No participant was observed. Prepared founder exercise, owner acceptance, combined U2 verification and closure remain pending.

Next allowed action: copy the preserved failure and repaired evidence verbatim into the bounded branch, commit/push an evidence-only handoff, verify its remote SHA and that source matches tested1bd, then present it for manager integration/owner experience acceptance.
