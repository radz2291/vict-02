# Independent operation / preflight schema review

Exact candidate: `814c00444cff8e63598145184b6a891dfecf6f34`.
Isolated review branch: `review/schema-collision-20261030`.
Recorded origin/main: `d7401bef6e48330796c74ec00c86db9622d48cdf`.
Previous review branches preserved; no remote refresh or push. Current owner
resumption authorizes local independent verification, not closure or publication.

## Initial verdict: bounded repair required

The slotScope collision is repaired correctly. The operation-union reference now
reaches the closed `{op,nodeId,slot,scope?}` wrapper, and its scope reference reaches
the separate declaration. Replaying the previous overwritten definition admits
the actual bare declaration and rejects the canonical wrapper; candidate behavior
reverses both correctly. Wrapper removal, state dictionary and closed declaration
cases pass. The canonical editor and saved document grammar are unchanged.

**SC1 — preflight normalizes an unknown own JSON key before strict validation.**
The new `z.record(z.unknown())` preflight gate clones the input and silently drops
an own `__proto__` property. An exact native JSON payload with normal edit fields
and this extra field is refused by direct `agentEditSchema`, but the same input
through `agentContext` preflight returns `ok:true, applied:false`. This is a false
positive for validation of the exact proposed edit. No source change, prototype
grant, dispatch or applicable proposal is demonstrated; the finding is bounded to
preflight admission and reporting.

The independent probe constructs the own key with `JSON.parse`, verifies its own
presence and direct parser refusal, then expects the preflight to refuse. It fails
on the candidate with observed `ok:true`. Original red output is preserved in
`schema-collision-independent-exact-payload.log`. Parent informed; activation held.

Recommended repair: perform a non-transforming native object/null type check,
rejecting strings/primitives/arrays without parsing or cloning. Preserve the exact
edit payload for the nested strict compiler. Keep historical missing/null refusals
and strict operation/revision validation. A repaired exact candidate requires a
focused independent recheck before this finding can be cleared.

## Initial checks and retained review mistakes

Relevant five-file suite: 40 passing cases, one reviewer test failure. The failure
was the reviewer's reference scanner assuming one-level definitions; graph grammar
uses valid nested JSON Pointers. The scanner was corrected to resolve all pointer
segments. Its original output is preserved in
`schema-collision-independent-test-pointer-red.log`; it is not a candidate defect.

Additional exact-payload probe: one candidate failure, four tests skipped by the
targeted test filter. No synthetic application is claimed as actual-agent proof.
Initial independent TypeScript check and probe lint results are retained separately.
Source ref namespace help agrees with existing canonical `state.` / singular
`prop.` semantics; it does not weaken expression validation. Protocol revisions
identify read/input8, edit/input7, authoring profile15 and observer profile9.

The device preparation helper was read only: it uses public package imports,
hashes/copies the supported export unchanged, refuses unsupported media, makes no
listener or provider call, and reports unavailable backend effects. This is a
bounded read-through, not independent execution or Android/browser certification.

Actual b6 rich-node retry remains a stopped partial trial: 39 calls, 15 refusals,
four acknowledged edits and 923.5 seconds of partial browser measurements. No
rich-node, device, owner acceptance, Foundation or Stage9 gate is awarded here.
