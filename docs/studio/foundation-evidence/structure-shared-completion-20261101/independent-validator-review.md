# Independent actual-source comparator review

The initial comparator was insufficient for an unqualified preservation pass.
Against helper SHA256
`9a64a9c2f4ed9d409620400b6e6e8f209663d4d11fe97e562fadae55a039e868`,
three coding-authored in-memory counterexamples incorrectly passed:

1. Move ordinary control `c-sum` from `bf-brief` to `bf-prompt`, with no reported
   nonstructural changes.
2. Replace the source-bound `ws-main` graph reference with a literal copy, with
   only a nonfatal change entry.
3. Explicitly enable the redundant type badge, with no reported change.

The original observation is retained in
`independent-validator-negative-probes.json`. No counterfeit application file was
written and no actual application/browser/agent source was injected or modified.
The validator's real code was run with in-memory before/after inputs under a VM.

The repaired helper additionally preserves non-port ordering/containment and
lexical ownership, exact existing node fields and top-level contracts, existing
style sources, explicit row@2 and column@1 adoption, names-only policy and unique
parent ownership. Only proven presentation-only port containers are pruned.
Behavior-bearing wrappers, scoped/prop/output additions and new ordinary nodes
cannot be silently discarded by normalization.

Final reviewed helper SHA256:
`dc5320d18743c574668558a35d4974e3a63767e622a5ed49bc2a80b0295cbf0a`.
It accepts a source-preserving positive conversion and correctly rejects all four
negative probes, including a new port-only wrapper adding a state-write click
interaction. Results are in `independent-validator-final-probes.json`;
`independent-validator-repaired-probes.json` retains the intermediate result.
The replay checker refuses to overwrite a prior evidence filename.

**PASS for the bounded source-preservation comparison.** Actual agent authorship,
new style declarations, semantic side placement when a reused port id is
ambiguous, painted endpoints, ordinary controls and Save/reopen remain separate
review obligations. This checker does not turn synthetic probes into actual-agent
or native evidence.

## Explicit UI leaf replacement amendment

The actual Studio agent replaced27 UI port-row leaf IDs while preserving their
semantic graph port IDs. The initial identity-preserving comparison correctly
reported this unsupported assumption as a failure; it is retained in
`06-source-id-assumption-failure.json`. Independent review found a unique complete
bijection by unchanged body anchor, semantic port id and every source field except
UI id/revision/showType. No old leaf id has an outside source reference before
replacement, or any exact/substr mention afterward; no style source was added.
See `independent-actual-row-adoption.json`.

Accepting this explicit, reported UI leaf migration does not permit graph endpoint
renaming or arbitrary source replacement. Helper@3 now reports the mapping and
refuses outside/stale references. Final helper SHA256 is
`a47e8edeff660a87891e10db6d8d5c6eba3e2cf9ae695819616075f57c738b17`.
Both identity-preserving and bijective replacement positive probes pass; all five
negative cases fail, including a stale old-id reference after replacement.
Results: `independent-validator-bijection-probes.json`.
