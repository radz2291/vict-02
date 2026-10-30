# Independent implementation challenge — initial candidate

Reviewer: `/root/candidate_verifier`, fresh context and separate checkout.
Exact source candidate: `46d20c3c8f3d3d617df2b6d18655fc7a31517e8e`.
Verification branch: `review/architecture-realignment-20261030`.
Checkout: `C:/Users/RZ1/.codex/worktrees/vict-realignment-independent-20261030`.
No implementation source was repaired in this checkout. Only independent tests,
logs and this report were added. No provider, browser, activation, push, main merge,
publication or owner-data change was performed.

## Verdict

**FAIL — bounded implementation repair required.** The original reported flat-key
exception and wrong-state patch are materially repaired, and the retained mounted
nested/private controls pass independently. Two additional ownership/history
cases remain gating below. This is not a reversal of the independent Gate A
architecture PASS. B/C implementation needs the bounded corrections; D actual-agent
and E integrated/browser/device acceptance remain HELD regardless of offline results.

## Independently executed

- Clean separate worktree created at the exact candidate above; own `npm ci
  --ignore-scripts --no-audit --no-fund` installed dependencies, then `npm run build`
  passed, exit 0. Final Svelte check reports 0 errors / 5 inherited warnings.
  Exact logs: `verifier-dependency-install.log`, `verifier-build.log`.
- `npm run test -w vict-studio -- tests/graph-independent-probes.test.ts` runs
  the two unchanged builder bridge controls plus two independent adverse cases.
  Controls PASS: nested manual/agent public source operations, history, save/reopen
  and import; repeated private occurrences, local undo and no source promotion.
  Adverse cases FAIL as described below. Runs overlap; no summed pass total.
- The initial independent helper assertion failed true-vs-false in the missing
  parameter case. A second run continued past that known assignment to exercise
  the actual Ctrl+Z effect. Both red records remain retained, not overwritten as
  passing: `verifier-initial-history-red.log`,
  `verifier-history-effect-red-and-definition-refusal.log`.
- Seven fresh-consumer tarball SHA256s were independently recomputed and equal.
  All 510 installed nonmanifest public-package files match the report hashes.
  `git diff ed13bb80e8a0cdba2f99143153f3ef5349f8d91d
  46d20c3c8f3d3d617df2b6d18655fc7a31517e8e -- packages` is empty: the
  consumer's packed package source association remains valid for this candidate.
  The public consumer uses a separate registered `consumer.review-decision`
  wrapping public Select, with two node occurrences and source roundtrip/build.
  Source inspection found no private Studio imports or source aliases. I verified
  artifact association/bytes, not a real browser interaction or actual-agent run.

## F1 — HIGH / gating: unresolved controlled fallback receives source history

`apps/studio/src/lib/designer/graph-history.ts:9–17` decides source history from a
controlled slot declaration and the parent workspace's registration, without
resolving the particular parent node's string parameter or occurrence provenance.

Independent canonical-valid fixture: start with the real nested bridge fixture,
remove the parent family's `innerGraph` parameter, and put the same valid inner
graph in the controlled scope declaration's initial value. Canonical screen checks
pass, and ScopedSlotInstance displays that fallback. Make an unrelated authored
outer-node label edit, then move an inner node and invoke inner Ctrl+Z.

The nested write cannot become the missing parent parameter, but historyFor still
returns the global source controller. Observed canonical label changes from
`Unrelated source edit must survive nested Undo` back to `Outer project node`.
The assertion fails at the real bridge document, not a mock function. This keeps
the same wrong-owner undo class in a less common valid configuration.

Required correction: source history/writes must use the same actual resolvable
source/occurrence ownership. Structured public host provenance is appropriate;
opaque occurrence strings must not become an undocumented parsing contract.
Invalid/unresolved controlled ownership must refuse explicitly rather than acquire
canonical history or silently become private state. Retain standalone/local host
compatibility deliberately and version any changed public host contract.

## F2 — MEDIUM / gating: traversal cutoff silently downgrades authored writes

`graphLexicalOwners` stops when path length exceeds64 or visit count exceeds16384,
but does not mark its map incomplete. `graphStateKeys` then treats a graph beyond
the cutoff as absent. `graphRuntimeChanged` treats its resulting document-level
write as ordinary ephemeral runtime state, with no authored admission/refusal.

Independent canonical-valid fixture: wrap the existing nested composition in66
ordinary div nodes. Screen compilation still succeeds. An outer graph keyboard
move emits the root graph state callback and changes displayed runtime geometry,
but the bridge's canonical position remains80 and no canonical history is added.
This is a silent persistence-policy change caused by source layout depth.

Required correction: make ownership traversal completeness explicit and fail
closed at source/runtime/history boundaries when it is incomplete, or support the
valid source depth without the early cutoff. A diagnostic refusal plus restored
runtime state is acceptable to the chosen bounded plan; silent downgrade is not.

## A rejected suspicion, retained honestly

The first depth probe reused a custom-definition root containing document-state
references in two lexical contexts. `graphSourceOwnership` exposed a partial
ownership map there, but public agent preflight independently rejected that source
for `UI_EXPR_SCOPE_VIOLATION` and an unresolved scoped prop. It therefore did NOT
prove a canonical-valid wrong-state agent edit. Its red helper assertion and safe
preflight refusal remain in `verifier-history-effect-red-and-definition-refusal.log`.
F2 above uses a different canonical-valid ordinary-wrapper fixture and does not
rely on the rejected definition construction.

## Remaining review and acceptance limits

The lexical resolver now distinguishes document/slot/literal ownership, validates
same-owner readers, refuses missing/stale controlled routes and recursively checks
graph2 parent revisions. Public exact registrations replace the old Studio name
inference. Tool schema/presentation both expose the strict bounded optional route,
and edit/instructions/profile revision pins changed explicitly. Direct graph1
compatibility remains; nested graph1 controlled routes are explicitly unsupported
and refused, not migrated.

No new popup implementation defect was established. The approved upstream versus
VICT ownership split remains accurately recorded. Parent popup/test evidence is
supporting evidence with its own hashes; this verifier did not rerun those suites.

The installed-public consumer is a coding-authored diagnostic fixture. Neither it
nor these mounted Studio tests satisfy the required actual Studio-agent stages1–5,
second actual application, browser geometry/focus/open overlays, native usability,
physical keyboard/safe-area/touch or owner acceptance. Browser initialization is
reported unavailable before inventory; no alternate path or bypass was attempted.
A later repaired candidate needs affected independent re-verification at its exact
SHA, with both failures and this initial FAIL retained.
