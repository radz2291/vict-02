# Retained Stage 5 nested route baseline diagnosis

The retained actual partial source accepts the exact routed public edit. This probe demonstrates no source ownership defect and makes no production change. It is a diagnostic source-fixture test, not an actual-agent completion or native browser proof.

Fixture: byte-for-byte copy of `actual-agent-live-20261030/stage-5-nested-partial-saved-source.json`, screen `screen-b1d0036a-e404-448b-8f84-c92b2752220d`, revision `r1.r2`. SHA256 `b705984baa01bc83b28dd60e637d9de837a4c3c7911ff2e05e9b7505dfc60f78`.

The actual agent stopped after repeated routed guesses without adding tasks. Its exact final public arguments/results were not retained, so this diagnosis does not attribute a particular malformed call to that run. Existing stopped-run observations remain unchanged.

## Exact route and revision semantics

The target `project-task-workspace` lexically owns `graph` through `flow-workspace.body` controlled state, even though the document also declares a state named `graph`.

For the initial p1 edit:

```json
{
  "op": "editGraph",
  "nodeId": "project-task-workspace",
  "expectedGraphRevision": 0,
  "occurrenceRoute": [
    {"workspaceNodeId":"flow-workspace","graphNodeId":"p1","expectedGraphRevision":1}
  ],
  "changes": [
    {"type":"defineNodeType","definition":{"id":"task","label":"Task","parameters":{"title":{"type":"string","default":"Draft launch checklist"},"status":{"type":"string","default":"todo"}},"ports":[]}},
    {"type":"addNode","nodeType":"task","id":"task-1","position":{"x":20,"y":20}}
  ]
}
```

Use the current document cursor for the enclosing edit batch. The target revision belongs to the inner graph. The route revision belongs to its containing outer graph. The route has one containing occurrence, not an extra step for the target workspace. The command is `defineNodeType`; each initially empty inner graph needs its own node type definition. An outer graph's Task definition does not populate an inner graph's registry.

The p1 batch yields inner p1 revision 1 and outer revision 2, leaving p2 unchanged. A subsequent p2 batch uses target revision 0 and route parent revision 2, yielding inner p2 revision 1 and outer revision 3. The serialized p1 graph is unchanged by that p2 batch. This also proves the same `task-1` identifier is valid independently in the two inner graphs.

## Checks

`actual-nested-route-baseline.test.ts` passes 2/2 tests using real `prepareAgentEdit` and `patchAuthoredGraph`. Their accepted p1 documents agree. Both source snapshots remain immutable. Stale parent revisions and the wrong containing workspace are rejected without source mutation. These deliberate negative probes are diagnostic boundaries, not reconstructed actual-agent payloads.

The isolated baseline is `e57ab00c7e92864098090c6a85a620f0f79e0af8`. Relevant `agent-edits.ts` and `graph-authoring.ts` match active source `b08b21f580338228e29f849e37c5894d3fccc0c4`. Source ab329 was serving during the parent observation. No active source, browser, provider, process, package, or owner app document was modified by this lane.

Studio TypeScript check completed with exit 0 and no diagnostics; `git diff --check` passed. Retained logs: `test.log` and `typecheck.log` (empty because the successful compiler emitted no diagnostics).
