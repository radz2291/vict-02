# Independent bounded recheck — host@2 candidate

Reviewer: `/root/candidate_verifier`, same independent verifier continuing the
bounded repair loop, separate checkout. Exact source candidate:
`3e2c7b9e4a52721e398afb23d3fa140efe31f689`.
Initial FAIL and red probes remain at review commit
`d64e47087d5dbc3a858c4750045b9d7e1a98f5ec` on the preserved initial branch.
Current verification branch: `review/architecture-realignment-recheck-20261030`.
No production source, provider/browser/configuration, owner data or serving process
was changed by the verifier. Dependencies/build artifacts from the same separate
checkout are reused; only affected package/checks were rebuilt.

## Disposition at this candidate

**F1 RESOLVED, F2 RESOLVED. Additional F3 MEDIUM requires bounded source-portability
correction or an explicitly retained scope limit.** Full foundation acceptance,
actual-agent/browser/device gates remain HELD. This is an affected offline verdict,
not owner acceptance or a complete E exit verdict.

## Independent checks

- Own prior probes were adapted explicitly to the public host@2 contract:
  FoundationConsumer receives occurrenceHost.authoringFor calling production
  graphAuthoringFor with the structured identity supplied by GraphWorkspace.
  The prior host@1 helper is not used as a substitute for actual host@2 admission.
- `npm run test -w vict-studio -- tests/graph-independent-probes.test.ts
  tests/graph-history-source-policy.test.ts tests/graph-runtime-refusal.test.ts`:
  **9/9 PASS**, three files, exit0 (`verifier-recheck.log`). Includes the original
  two mounted positive controls, exact F1 unrelated-label Undo outcome, F2 deep
  authored persistence, an independent host@1 direct-root fallback, the three
  policy/revision/incomplete-inspection tests and rendered refusal rollback.
- F1: missing actual parent parameter now resolves refused/read-only and no
  canonical history. Inner keyboard movement/Undo leaves the unrelated authored
  outer label intact. Structured routes contain source workspace, actual graph
  node and current parent revision; opaque occurrence strings are not parsed.
- F2:66 ordinary wrappers now preserve authored graph source and history instead
  of silently becoming runtime state. Defensive incomplete inspection clears partial
  ownership. The direct runtime refusal restores the explicit canonical graph
  value and retains the unrelated draft; it does not retain the stale supplied graph.
- `npm run build -w @victframework/ui-flow-svelte`: PASS, exit0,0 errors/5 inherited
  warnings (`verifier-flow-recheck.log`). `npm run check -w vict-studio`: PASS,
  exit0 (`verifier-studio-recheck.log`). No broad unchanged suite was rerun.
- A second bounded Studio invocation independently ran all five builder bridge
  cases, including the runtime-root divergent-revision case and its native text
  Undo assertions: **5/5 PASS**. Its new sixth deep-portability case fails below.
  These suites overlap prior controls and must not be summed as a distinct total.
  Exact output: `verifier-portability-runtime.log`. The attempted name filter was
  not forwarded as intended by npm; the actual output honestly contains all five
  bridge cases, not just the selected runtime-root case.

## F3 — MEDIUM: supported deep layout is falsely refused as dynamic media

The source importer retains its separate `path.length>64` traversal cutoff in
managedReferences. The exact same66-wrapper canonical-valid graph that now passes
source/history editing, containing no managed media, fails its public portable
source roundtrip:

`STUDIO_IMPORT_MEDIA_DYNAMIC`: saved bytes cannot prove computed/runtime media at
`deep65 (source traversal bound)` and future constructed URLs require a supported
media resolver.

This is an honest fail-closed refusal, with no data loss or wrong-owner write.
It is nevertheless a source-portability inconsistency at the newly demonstrated
layout depth, and its dynamic-media diagnosis does not describe this fixture.
The new independent `graph-independent-portability.test.ts` proves it through
screenApplication + prepareSourceImport; screenIssues is empty before import.
The shallow nested source roundtrip still passes in the mounted positive control.

Recommended bounded correction: align the source-layout traversal with valid
canonical depth, retaining cycle protection, the total inspection budget, expression
bounds and missing/invalid media refusals. Do not skip unknown dependencies or
reinterpret scoped state to force a pass. Reverify the deep roundtrip and existing
media/scoped-import negatives. No new persistence engine or product fork is needed.

## Compatibility and retained checks

Public host@1 remains a fallback only when host@2 is absent; the independent
root-graph control proves source Undo through that fallback. Source/runtime/refused
ownership is explicit in host@2. Existing saved source schemas are unchanged.
Direct graph1 compatibility stands; controlled nested graph1 routes remain an
explicit refusal, not an implicit migration. Runtime-owned literal/private chains
continue to work when live graph revisions depart from authored defaults.

The parent's four retained changed-file lint findings are baseline findings:
unused resolveOccurrence and actionInputs imports, the existing let timeout
prefer-const finding and the test's empty catch all occur in4c40cc65. I independently
compared those exact baseline lines. The new optional-chain nonnull assertion was
reported repaired in test-only85926587; no production-source behavior changed.
This review does not claim a blanket lint PASS or require unrelated cleanup.

The earlier public-artifact consumer association applies to the pre-host@2 package
source. After a changed Flow package, the integrator must associate a fresh packed
artifact/installed-byte proof with the repaired source. It remains fixture evidence,
never actual-agent output. No new browser, actual-agent, geometry/focus, device or
owner-acceptance claim follows from this independent source recheck.
