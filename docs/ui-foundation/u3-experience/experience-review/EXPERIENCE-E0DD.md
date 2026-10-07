# Independent browser experience verification — repaired candidate

**Verdict: PASS for this bounded experience repair, with disclosed limits.** Exact tested implementation candidate: `e0dd026e3fe08cf979d6625a88828e295f23dba6`. Reviewer: fresh `/root/experience_review`, independent of implementation, no source edits, no commit/push. Real CUA-controlled Codex in-app browser at `http://127.0.0.1:5221/`, restarted after the successful candidate production build. Review date: 7 October 2026.

This is an independent experience verdict. Owner acceptance remains pending; the U3 manager must integrate and independently verify the combined candidate before closure or U4 continuation. Technical/runtime conformance remains the separate technical review's remit.

## Repaired required finding and retained lineage

[Initial challenge](EXPERIENCE-8D99.md) returned FAIL at `8d99f3645691b4c3882cdfe88f298d6f0306eae0`: primary `Scenario: failure` misleadingly implied an injected failed operation, although primary approval succeeded. All initial evidence is preserved.

The four-path delta contains DemoControls, detail operation feedback and two repair documents. Recheck at this exact candidate confirms:

- Primary control is now **Records (simulated)** with **Submitted inspections**, **Empty queue**, **Long content**. It describes resetting simulated records and persistent saved records.
- The disclosure explicitly directs delayed/failed/unavailable/denied/conflicting operation cases to the separate test console and explains they do not change ordinary product approval. No misleading primary failure option remains.
- A terminal stale tab now says the change cannot be applied to the current inspection and asks the person to reload/check status and entries. Reload resolves to approved and removes Approve. `final/stale-terminal.jpg`.
- Missing-record route now shows the intended understandable unavailable-inspection error and return-to-queue link. Actual return navigation worked. The initial bare500 was an environment failure caused by replacing build output under a running server; it was not silently erased or counted as a source PASS. Clean build/restart resolved it. `final/not-found.jpg`.

## Actual usability and interaction verdicts

| Area | Result and evidence |
| --- | --- |
| Hierarchy/composition | PASS. Clear identity, navigation, title/status/context and next action. One decision region and one chronological activity trail. Consistent typography, spacing, severity and evidence cards. Diagnostic/demo controls remain collapsed below the task. No raw JSON/extension IDs, duplicate Approve/history or stray punctuation. |
| Complete ordinary journey | PASS, repeated at final SHA. Reason entered → Return via native Enter → rejected → technician Start corrections → draft → finding and evidence added → Submit → submitted → supervisor Approve → approved. Counts/trail refreshed. Final terminal inspection had zero Approve buttons, exactly one Decision region and one Activity trail region. `final/correction-390.jpg`, `final/approved-1440.jpg`. |
| Keyboard/focus | PASS on bounded journey. Tab order is application link, queue link, Approve, reason field, enabled Return. Required empty reason disables Return. Enter submitted the rejection form. Settled feedback receives focus after transitions; final approval active element text was “Inspection approved. The review is complete.” Native form/select keyboard behavior works. Focused reason field capture: `final/keyboard-focus.jpg`. |
| Real conflict/recovery | PASS. Initial unchanged-source challenge retained an old supervisor tab while another performed rejection/revision/resubmission. Stale Approve reported changed-since-opened with Reload. Reload read current data and confirmed it. `revision-conflict-product.jpg`. This binding/runtime path is unchanged by the four-path repair delta; final terminal-state recovery was independently repeated. |
| Honest evidence | PASS. Image cards explicitly say unavailable labelled placeholder; note cards say demo evidence. No unavailable image is claimed loaded. |
| Responsive composition | PASS. Final queue/detail captures at 1440×900, 1024×768, 390×844 inspected. Narrow panels stack, text wraps, controls remain readable. True container test uses viewport1440 with computed container480; it stacks independent of viewport. No measured element extends outside viewport and no horizontal document overflow. `final/responsive-metrics.json` and corresponding captures. |
| Empty/long | PASS with density limit. Final Empty queue control/reset verified the intentional empty state. Initial long40-findings mobile evidence remains valid because canonical source, seed and renderer are unchanged by the repair delta. Long strings wrap without clipping/overflow; all findings remain accessible, but require substantial vertical scrolling. `final/empty-390.jpg`, `long-390.jpg`. |
| Loading/error/denial/missing | PASS within truthful console boundary. Initial unchanged console captured latency “Running inspection:approve…”, declared failure, missing disabled action and revision conflict. Final candidate denial repeated as OPERATION_DENIED (“A technician may not record decisions”). Product missing-record recovery and actual stale-terminal failure were repeated at final SHA. The primary product is not claimed to inject latency/failure outcomes. |
| Ordinary authored edit reaches product | PASS, repeated at final SHA. Select title → Style → native Ctrl+A/type42px/Tab → Save. Canvas source transaction saves revision5; actual normal detail title computes42px at source revision5. Undo in retained Canvas and Save restores32px/source revision6 on normal product reload. `final/saved-edit-proof.json`, `final/saved-edit-canvas.jpg`, `final/saved-edit-product.jpg`. |

## Exact viewport measurements

Measured final detail at 1440×900: scrollWidth1425; at1024×768:1009; at390×844:375 (available content width excludes browser scrollbar). Overflow element arrays were empty. At viewport1440 the QA frame computed exactly480px. Source and navigation remain genuine product DOM; this is not a scaled screenshot or 480px browser viewport.

## Limits and handoff state

No full assistive-technology audit, automated contrast audit, network throttling, image-fetch test or production readiness claim. The long fixture has no pagination and is vertically dense on mobile. Canvas fixture differs in data from product; parity means the same renderer/components/source styling, not identical demo records. The current browser editor edits detail; queue remains canonical source but has no dedicated browser editing screen in this slice. Existing runtime permits adding findings/evidence to submitted records; observed availability follows that existing domain and does not constitute invented authorization.

The final browser origin was restored to normal **Simulated** supervisor queue with three submitted inspections. Saved typography was restored to baseline32px using normal Undo/Save, retaining truthful stored revision6. Temporary viewport override reset. Reviewer Canvas/console tabs closed; primary queue tab retained as deliverable. Server was not altered by this reviewer.

Evidence is stored beside this report. Initial captures remain under this directory; final exact-candidate rechecks under `final/`. Screenshot names identify intent or viewport, not substitute for the described outcome. No earlier candidate evidence is relabelled as a final-candidate rerun.
