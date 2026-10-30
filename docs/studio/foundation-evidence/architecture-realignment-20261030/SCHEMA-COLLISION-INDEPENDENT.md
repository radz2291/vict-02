# Independent operation / preflight schema review

Latest exact candidate: `bfb34e2882781bc2dddd05f2b978b418cda12c49`.
Isolated final review branch: `review/schema-collision-verified-20261030`.
Original reviewed candidate: `814c00444cff8e63598145184b6a891dfecf6f34`;
its red review branch `review/schema-collision-20261030` remains at
`32e822db062428683b5127ffd3d284724c9448cf`.
Recorded origin/main: `d7401bef6e48330796c74ec00c86db9622d48cdf`.
Previous review branches preserved; no remote refresh or push. Current owner
resumption authorizes local independent verification, not closure or publication.

## Current verdict: qualified independent offline PASS

SC1 is repaired and cleared on the latest exact candidate. The native object/null
gate is now a non-transforming `z.unknown().superRefine` check. The independent
probe verifies the admitted edit is the same original object, retains its own
JSON `__proto__` field, and is then refused by strict nested edit validation.
There is no JSON parsing, key filtering, type coercion or new edit authority.
Native objects preflight normally; strings/primitives/arrays refuse. Missing/null
retains the earlier nested refusal. Source stays unchanged on successful, stale,
malformed and unknown-field outcomes; no proposal, draft or document is returned.

The final exact candidate includes source repair `5ba04e8b56b7d905419dd73b6af80a861006a630`
and the retained initial independent evidence/probes. Its product source matched
the review tree exactly when aligned to the build candidate `bfb34e28…`; only a
review-test assertion and this final report/logs were added by the verifier.

Final focused checks:

- `schema-collision-independent-final-tests.log`: **3 files / 20 tests PASS**, exit 0
  (five independent probes, four slot-scope schema regressions, eleven read-contract
  cases). These overlap earlier passing cases; counts are not additive.
- `schema-collision-independent-final-typecheck.log`: Studio TypeScript, exit 0.
- `schema-collision-independent-final-lint.log`: independent probe ESLint, exit 0.
- `git diff --check`: clean. No product source edits by this verifier.

All operation-union references retain their own `op` discriminant; every local
JSON Pointer resolves, including the intentionally nested graph definitions. Both
public presentation schemas fit the unchanged bridge capture bounds. The original
slot-scope collision remains independently reproduced as a historical negative.
Ref namespace help and version identities remain as recorded below. Five inherited
Svelte warnings remain visible in test logs; no broad accessibility pass follows.

No blocking finding remains within this bounded schema review. Next allowed action:
finish/seal the corresponding staged production build, perform the owner-authorized
reversible local activation, and resume the actual agent from confirmed saved source.
Verify actual native preflight/slot composition; do not replay confirmed edits or
replace the application with a verifier fixture. Live rich-node usability, two
applications, browser/device behavior, owner acceptance and Foundation/Stage9 gates
remain held. This review neither activates a product nor authorizes publication.

## Retained initial verdict on 814c: bounded repair required

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
