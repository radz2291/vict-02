# Explicit factory preparation before nested graph migration

Builder follow-up to adapter `6c74fdd21b0d23e89461e4da9183cd23033cdeb5`, on
isolated `codex/studio-edge-v3-adapter-20261101` (parent evidence `a8a1acfc`).
Independent adapter finding and RED remain in verifier
`09657438ae2cd3561e825ae238305af2faf61f06`, including its original future-node
test. The owner chose explicit factory preparation rather than implicit default
conversion or a new migration engine/API.

## Behavior

Before changing a controlled nested workspace identity, `migrateGraph` now
requires every relevant containing node family's declared string parameter
default to parse as installed public graph3. A retained graph2 default, empty
default or invalid graph3 default refuses the entire migration with actionable
`editGraph` / `defineNodeType(replace:true)` guidance. Current instance overrides
do not hide an invalid future-node default. Only the declared controlled graph
parameter is examined; arbitrary strings, private Help state and unrelated family
defaults are not guessed or converted.

The author explicitly prepares the intended factory using existing public graph
operations, then migrates all affected occurrences. If existing instances inherit
their current graph2 from the old default, `setParameter` first materializes those
current values before replacing the default. This preserves their effective
graphs while giving future nodes the separately intended graph3 factory.

One normal atomic agent-edit proposal can contain:

1. `editGraph` at outer revision7 with a public changes batch: preserve inherited
   instance values with `setParameter` as needed, then replace the complete
   intended family definition using `defineNodeType(replace:true)` with its
   explicitly supplied graph3 string default. Preserve its other parameters and
   ports. One changes batch advances that outer graph to8.
2. `migrateGraph` with target/route revisions from that working source: outer8,
   each inner's own revision (for example2), and containing route revision8.
   Every migration target is validated before internal migration assembly. Inner
   source writes advance the containing revision normally; public pure migration
   preserves each current graph revision.

This is one existing canonical proposal/Undo entry. No arbitrary JSON replacement
tool, hidden factory migration, extra default authority, renderer or graph engine
is introduced. Tool guidance and an example show fresh sequential working
revisions. The integrator owns final protocol/profile instruction association;
this repair changes no input shape or central server pins. New edit10 is still an
unactivated candidate, not an accepted historical contract being rewritten.

## Evidence

`factory-default-baseline-red.log` retains the new builder baseline:2 failed /
1 passed. The old implementation accepted graph2 and empty future defaults even
when every current instance had a valid override. The independent original RED
is retained separately; neither observation was deleted or relabelled.

`factory-default-focused.log`: **14/14 PASS** across2 files. Three new factory
checks cover graph2/empty refusal and a genuine normal-agent-edit batch with:

- meaningful factory nodes, typed values and edges preserved by explicit public
  pure graph2-to-graph3 preparation;
- an inherited existing graph2 value materialized before default replacement and
  another occurrence's distinct existing value retained;
- unrelated ordinary factory values, all current positions and links preserved;
- read-only preflight, one-step source Undo/Redo, Save/reopen and normal import;
- a subsequent ordinary public `addNode` with no explicit values, whose exact
  nested source resolves as valid graph3 and equals the intended factory.

The existing11 migration cases now declare explicitly prepared factories and
materialized current values. They retain all sibling, stale, duplicate, route,
context-sharing, source privacy, per-edge/default/reset and mixed-version checks.
This fixture update supplies the newly required valid precondition; unprepared
cases remain executable negative tests. Diagnostic fixtures are not actual-agent
or owner-app source proof.

Studio TypeScript and changed-path ESLint pass (`factory-default-typecheck.log`,
`factory-default-lint.log`). The prior58 affected regression checks remain
historical builder evidence; unchanged non-migration cases were not rerun solely
for timestamps. Dependencies remain the recorded owned checkout artifacts, and
the public Flow source remains candidate `0e73` here. The separate public snapshot
and callback-disposal repair is integrator/public-builder-owned, not included in
this adapter commit.

Next: cherry-pick the adapter repair, independently challenge the exact integrated
successor, associate final central protocol/build, then continue the authorized
actual agent/native graph3 work using the owner's current app. No root mutation,
root dist write, provider/browser call, owner-data change, activation, push,
publication or acceptance occurred.
