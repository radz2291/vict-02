# F3 — deep canonical source portability consistency repair

The fresh verifier found that the canonical-valid66-wrapper nested graph, with no media, was still refused by prepareSourceImport as STUDIO_IMPORT_MEDIA_DYNAMIC at deep-65. This is a distinct source-inventory cutoff from the graph-ownership cutoff repaired earlier. No actual-agent, saved owner application or browser data was involved.

## Independent builder reproduction

Predecessor HEAD at start:77a5cfd1a634154db94f890ef9880474c970e13b. Added source-import-depth.test.ts without changing production source, checked screenIssues(source) returned no issues, then executed the import regression. Result:1/1 failed, exit1. The importer reported: Saved bytes cannot prove computed or runtime media outputs at deep-65 (source traversal bound). The fixture contains no managed or dynamic media dependencies.

Exact raw failed run:source-import-depth-baseline-red.log. It remains separate from the postrepair output.

## Repair and checks

Removed only path.length>64 from the source-node visit guard in source-import.ts. Ordinary source wrappers do not increase expression complexity. Cycles, the16384visit work bound, expression depth64, expression evaluation budget, strict scoped/controlled-state resolution and missing-media refusals remain unchanged. No package, saved schema, source operation, runtime authority or migration contract changed.

Command in apps/studio:

node node_modules/vitest/vitest.mjs run tests/source-import-depth.test.ts tests/source-import.test.ts

Result:23/23 PASS (new depth case plus22existing import cases), exit0. The new case verifies canonical validation, import success, zero assets, exact document retention and unchanged canonical digest. Existing cases retain missing/invalid media, unknown runtime frame values, controlled scope inventory, dynamic source, archive shape/limits, application semantic comparison and source-size refusals. Raw passing run:source-import-depth-repair-tests.log. git diff --check:clean.

This report is builder evidence. Final source build and exact-candidate independent re-verification belong to the integrator. Public package sources are unchanged by F3, so this repair does not invalidate the existing packed-consumer proof merely by giving private Studio source a new timestamp. No serving activation or owner acceptance occurs here.
