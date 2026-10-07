# Independent browser experience challenge — initial candidate

Reviewer: fresh `/root/experience_review`, no implementation role, no source edits, no commit or push. Tested production URL `http://127.0.0.1:5221/` built from exact candidate `8d99f3645691b4c3882cdfe88f298d6f0306eae0`. Browser: real Codex in-app browser, CUA native locator interactions and read-only DOM measurements. Review date: 7 October 2026.

**Verdict: FAIL pending required truthfulness repair.** Owner acceptance remains pending. This is an independent challenge, not owner acceptance or a Stage 9/U4 verdict.

## Required finding

F-EX-1: primary Demo controls offered `Scenario: failure` and `Reset demo`; summary became `failure · Simulated`. A real primary approval then succeeded, changing status to approved. The product server selects a seed; operation outcome injections occur only in the separate scenario console. The control implied a failed product operation that it did not simulate. `failure-390.jpg` preserves the successful approval under the misleading failure label. Required repair: make the primary record seed and separate outcome-console scope truthful, without changing the domain or pretending the console shares primary server state.

## Actual usability observations

- Clear application identity and queue hierarchy. Compact bottom disclosure keeps diagnostics and demo tools outside the ordinary inspection task. Detail has one decision region and one chronological activity trail. No raw JSON, extension IDs, stray punctuation or duplicate Approve were visible.
- Supervisor rejection with reason, switch to assigned technician, Start corrections, add finding, add labelled evidence and Submit for review all succeeded in the actual product. Counts, status and trail refreshed. Supervisor then approved. Approved state removed decision action controls.
- Settled Start corrections feedback receives programmatic focus. Tab order runs application link → queue link → Approve → reason field → enabled Return for correction. Entered return reason enables its button. Native selects and form fields are keyboard reachable.
- Evidence is honestly labelled image-unavailable placeholder or demo note. No image-load claim. Reusable status/button/feedback styling is visibly consistent between authoring Canvas and normal detail, allowing for different fixture data and viewport widths.
- Actual Inspector text-size edit via Ctrl+A, sequential typing `42px`, Tab created one source transaction. Save advanced stored source from 2 to 3. Both Canvas and a separate normal product tab computed title font size `42px`; product source annotation was revision 3. `saved-edit-canvas.jpg` and `saved-edit-product.jpg` retain evidence. Undo in the retained Canvas tab and Save restored product `32px`, source revision 4. The product was reloaded to confirm restoration.
- At 1440×900 and 1024×768, panels and typography have coherent spacing and density. At 390×844, findings/evidence/decision/corrections/activity stack and wrap without horizontal overflow. A true `?frame=480` container computed exactly 480px with browser viewport 1440px; all panels stack despite desktop viewport. Document scroll widths were 375 at viewport390 and1425 atviewport1440 (browser scrollbar), no element extended beyond viewport.
- Empty scenario displays “No inspections to review” and explains new submitted inspections appear there. Long scenario displays all 40 findings and long strings without clipping or horizontal overflow; on mobile it requires substantial vertical scrolling. This is usable but not optimized for large queues/findings; no pagination claim is made.
- Real domain revision conflict reproduced by retaining an old supervisor tab while another tab performed reject → revise → resubmit. Old Approve was refused with “This inspection changed since you opened it. Reload it, review the changes, then try again.” Reload inspection refreshed data and confirmed current state. `revision-conflict-product.jpg` is this actual product conflict.
- An already-approved stale tab receives generic recoverable failure wording and Reload inspection. Its exact diagnostic is `DATA_INVALID_INPUT: approve requires status 'submitted' (found 'approved')`, because lifecycle validation precedes revision conflict. Earlier `conflict-product.jpg` retains this observation. It is not evidence of broken DOMAIN_CONFLICT mapping. More explicit terminal wording is a minor clarity improvement.
- Console latency displayed “Running inspection:approve…”; failure returned declared `SIMULATED_FAILURE`; missing case disabled the unavailable action; conflict returned `DOMAIN_CONFLICT`. These are explicitly console/session observations, not primary product failure injections. Loading, failed and missing console screenshots preserve these boundaries.

## Environment failure retained

Navigation to a missing inspection produced a bare `500 Internal Error` in `not-found.jpg`. Parent correlated production logs to a missing obsolete generated manifest chunk after a concurrent build replaced the running server's output. This is an observed failure; the intended source error page is not claimed to have passed. Required final recheck after a clean candidate build/server restart.

## Evidence and limits

Captured files in this directory: queue-1440, detail-1440, correction-390, approved-1024, container-480, long-390, empty-390, failure-390, saved-edit-canvas, saved-edit-product, loading-console, failure-console, missing-console, conflict-product, revision-conflict-product, not-found (all `.jpg`). Screenshots are full-page captures at the named viewport; long capture is intentionally tall. Failure filenames describe probe intent, not asserted outcome. Browser selector timeouts from guessed exact text or changed labels were resolved by fresh DOM snapshots; none were promoted to success.

No network throttling, accessibility audit, image retrieval or production deployment was performed. Runtime/SQLite conformance is the separate technical review's remit. Final candidate must recheck the required repair, missing-record route and affected navigation. Earlier successful workflow and edit evidence remains candidate-specific rather than silently relabelled to a later SHA.
