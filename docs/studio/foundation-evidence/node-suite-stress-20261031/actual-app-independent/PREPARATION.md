# Independent actual-app proof preparation

**Baseline inspection only. Port-row and graph3 appearance phases remain HELD
until completed actual-agent source/receipts and required native/save/export
evidence are supplied.** No whole-candidate verdict follows from prior camera or
source passes.

Runtime product supplied by integrator:
`bac786840d7519c041638e1b9d239d54efdf56f5`. Clean evidence snapshot reviewed:
`9bea060f3738e4c12ebf6cf998b81aa6d82b09e3`. New isolated branch
`review/current-app-port-and-graph3-20261031` starts directly there. Production
source diff from bac to this snapshot is empty; origin/main remains
`d7401bef6e48330796c74ec00c86db9622d48cdf`. No root/UI/activation/source changes
were performed by this reviewer.

Exact actual Campaign Foundry baseline is
`21-boundary-label-poster-saved-source.json`, screen
`screen-a8690ffa-1e90-4b72-909c-66141d372773`, revisionr1.r12.
`28-activated-exact-source.json` deep-equals this complete canonical document.
The file bytes differ by a final newline; that formatting difference is not a
source edit or a byte-equality claim. All localState declarations and graph source
strings are exact.

`baseline-inventory.json` records:

| Explicit occurrence | Schema/revision | Model size |
| --- | --- | --- |
| ws-main / state.campaignGraph | graph2 /35 |14nodes,20edges,10families |
| fin-ws / finS.subgraph | graph2 /5 |3nodes,2edges,3families |
| fin-ws / finP.subgraph | graph2 /3 |3nodes,2edges,3families |

The existing Social manually reviewed caption and Grade position286,92 remain
in the exact graph string; Poster Grade72 and both parent positions remain.
This is preservation of the recorded baseline, not attribution of earlier changes.
Conditional shared-body inspection resolves all20 actual graph-node occurrences:
27 source bare-anchor records, zero port-row records at this baseline, complete
expected family-port IDs without missing/extra/duplicate anchors.

The diagnostic script `audit-actual-port-phase.mjs` has baseline and port-only
modes. It reads explicit snapshots, never authors or writes an application. The
port-only gate demands exact complete localState and recursive graph strings,
requires exact public port-row@1 and no remaining bare anchor, then compares each
current family/occurrence's conditional body anchors to its semantic graph ports.
Nested workspaces establish separate port owners. Unhandled expressions/repeats
or ambiguous workspace resolution refuse diagnostic coverage rather than guessing.
This static evaluation is not proof of runtime handle geometry, pointer hit areas,
painted wires, focus/controls, history or save/reopen.

Preparation command:

```
node docs/studio/foundation-evidence/node-suite-stress-20261031/actual-app-independent/audit-actual-port-phase.mjs baseline docs/studio/foundation-evidence/node-suite-stress-20261031/21-boundary-label-poster-saved-source.json docs/studio/foundation-evidence/node-suite-stress-20261031/28-activated-exact-source.json docs/studio/foundation-evidence/node-suite-stress-20261031/actual-app-independent/baseline-inventory.json
```

PASS for baseline equality/inventory; script syntax check passes. No port-phase
success is claimed by running against the unchanged baseline. Once actual output
is supplied, use port mode against this exact baseline and associate real receipts,
ordinary-control/native/source isolation, saved export and portable replay. The
later migration/appearance phase requires a separate explicit comparison allowing
only intended schema/factory/default/override changes while retaining topology,
manual values, source ownership/history and persistence. That mode is not silently
implemented or awarded here. No browser/provider/owner-data operation, new backend
authority, push/publication or milestone/Stage9 acceptance occurred.
