# First integrated candidate — retained verification checkpoint

Product source: `46d20c3c8f3d3d617df2b6d18655fc7a31517e8e`.
Status: independent challenge in progress; **not accepted, not activated**.
This first candidate and its build remain preserved if later repairs supersede it.

Gate A independently passed documentation candidate `cf5056e5ea37b87931fe24baf53f800e2d7fd173`;
verifier record `327db5149881ffdd6ad2e35e3380b60b1ea901fe`.

## Checks and precise scope

| Check | Observed result |
| --- | --- |
| Workspace build | Exit 0; existing five renderer state/a11y warnings retained in workspace-build.log. This populated fresh checkout artifacts; not a browser or provider run. |
| Public graph authoring registration | 2/2 focused metadata tests; exact revision selection and retained defaults. |
| Original ownership mismatch | Three baseline failures reproduced, retained in GRAPH-BASELINE-RED.md. |
| Graph ownership/Studio bridge/refusal | Final 12/12, detailed in GRAPH-REPAIR.md; overlaps earlier compatibility checks. |
| Studio affected authoring/read/feedback/refusal | 23/23 in six files, studio-affected-regressions.log. |
| Discovery and portability | 38/38 in two files, discovery-portability.log. A requested agent-edit-presentation.test.ts path does not exist; no case is claimed for that name. Route schema/presentation is tested in graph-scoped-ownership instead. |
| Exact protocol/actual pinned offline executor | 6/6, protocol-revision.log. Model factory offline; no real provider/design-quality claim. |
| Mastra pre-invocation safe boundary | 2/2 actual pinned Agent executor cases, mastra-safe-boundary.log. Initial invocation selected the wrong root project and collected no tests; retained mastra-wrong-project-red.log. |
| Studio TypeScript | Exit 0; builder also rechecked after new graph integration tests. |
| Designer Svelte | 0 errors / 5 inherited warnings. |
| Shared popup regressions | 63 renderer + 27 AI scoped cases; source hashes/report in POPUP-AUDIT.md. No native popup claim. |
| Public-artifact consumer | Seven packages, 510 matching installed nonmanifest files, one DOM interaction/roundtrip case and production build PASS. See consumer report. This fixture is coding-authored, not actual-agent output. |
| Studio production build | Exit 0, 305 retained output files; BUILD-46d20c3.json hashes the preserved uninstalled build. Existing large-chunk and dependency-cycle warnings retained. |

Counts overlap across suites and are not an additive milestone total. Consumer
package source was `ed13bb80e8a0cdba2f99143153f3ef5349f8d91d`; packed package sources
are unchanged between that commit and this candidate. Its report explicitly records
unrelated Studio/evidence dirtiness and independently enforces packed-source cleanliness.

## Compatibility and unresolved proof

Saved UI/graph schemas are unchanged. New public code metadata is
`vict.flow-authoring@1`; exact component versions select existing model grammar.
The optional agent occurrenceRoute extends edit capability/input 5→6,
instructions 11→12 and authoring profile 12→13. Direct old operation shapes remain
valid; no saved graph is silently migrated. New controlled nested routes require
graph2 node-parameter ownership. Legacy graph1 controlled nested routes refuse;
direct graph1 support is preserved. Private scoped source edits deliberately change
template defaults; runtime occurrence values are not promoted to source.

The fresh verifier is challenging this exact candidate in a separate checkout.
Potential remaining history/provenance and traversal-boundary cases are under
investigation; green builder tests/build do not award a gate verdict.

Current serving product remains `27788de9f111042d04d83e7d603c6da2cccde8dc`.
Fresh comparison matches all 324 core + 60 retained proof files. Original checkout,
processes, saved apps, managed assets, browser storage and unsent drafts are untouched.
Browser control failed before inventory, including after one documented reset.
No candidate activation, actual Studio-agent request, browser behavior/device test,
push, main merge, publication or production deployment occurred.

Gate B has supporting mounted Studio bridge proof; native behavior is unawarded.
Gate C has affected source/build/regression proof pending independent verdict.
Gate D's actual Studio-agent stages 1–5, representative app and different second
app are unavailable; consumer proof cannot substitute. Gate E integrated acceptance
remains HELD. AR25 physical keyboard/safe-area/touch remains partial. No task,
foundation milestone or Stage 9 closure is inferred.
