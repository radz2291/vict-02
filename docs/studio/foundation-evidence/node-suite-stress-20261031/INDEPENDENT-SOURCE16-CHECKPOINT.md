# Independent checkpoint16 source/export review

31 October2026. Read-only review of evidence15-review-merge and16-export-model at root HEAD `fd27911029864d5618ea04d8c9814df7df865494`. Both `102267977e783898905d6aa846fd16e158b37ee1` and proof-helper review cherry-pick `7200902952bf2829b29dbafd52d482d68d6bf61e` exist and are ancestors of that HEAD; there is no ancestry discrepancy. The isolated review branch is codex/independent-source16-checkpoint-20261031. Root source/evidence/browser were not changed, and no provider/service/push operation occurred.

**PASS for this checkpoint's source/export preservation and declared wiring only. Native behavior and the complete actual suite remain HELD.** This report does not assess the later in-progress nested-flow turn.

Checkpoint15 is savedr1.r4 with180 source nodes. Checkpoint16 is savedr1.r5 with226 source nodes and197097 characters. The same document identity screen-a8690ffa-1e90-4b72-909c-66141d372773 is preserved. Each supported export's attached document deep-equals its corresponding saved source. Exact input hashes and measurements are retained in independent-source16-review.json.

The outer campaignGraph revision advances19→20. All14 graph node records deep-equal the prior checkpoint, including IDs, types, positions and every saved value; all20 edges deep-equal prior. All10 family identities and port declarations remain unchanged. Output fanout is consequently preserved. Family distribution remains brief1, prompt2, model1, style1, seed1, draft2, finish2, review2, check1, exp1. allowCycles remains false.

The only family metadata delta is check: boolean parameters checkCrop, checkCaption and checkAA with defaultfalse are added. These now back the matching pre-existing controlled boolean declarations in ws-main's body slot. In checkpoint15 those declarations existed without corresponding check-family parameters; checkpoint16 supplies that missing saved-data contract. Existing items:stringList and ready:boolean parameters and all check-node values remain unchanged. c-chk1/2/3 bind checked to those matching state keys and change to setState; c-ready binds to ready. New booleans are initially resolved from their false defaults, with no claimed prior user value overwritten. Ready is labeled manual sign-off, not computed approval execution.

The Model branch is isModel→br-model; its shared body now includes labeled model selector c-msel, numeric Steps c-steps and Guidance c-guid, a Help row/panel and public vict.flow.port@2 outputo. Value bindings and change/setState keys match controlled model:string, steps:number and guidance:number family parameters. Existing node values eco-diffusion-xl/28/6.5 survive unchanged; selector options include the saved model value. The native renderer's established change handler reads typed DOM values before scoped setState, so the self-state expression is a fallback, not evidence that the handler always writes the old value. Actual native editing/persistence is still untested by this source inspection.

The new Export branch is isExp→br-exp. c-dest binds Delivery destination to controlled destination:string; c-fmt binds Package format to controlled format:string with Web bundle/Print pack/Archive (ZIP) values. Saved destination campaign-foundry/mug-launch and formatWeb bundle survive unchanged. Public vict.flow.port@2 slots expose i/o matching the exp family's declarations. This is editable export configuration; source wiring does not execute generation, publishing, file writes or backend export success.

Model and Export Help use native checkbox/change wiring to slot-local helpOpen:boolean, with controlled absent and initialfalse, and conditional explanatory text. It is temporary occurrence presentation state rather than a campaign parameter. This source does not wire a registered Popover/dialog Help control; any stronger interaction/conformance requirement must be checked separately.

Across the UI source,46 nodes are added and no prior node is removed. Only existing ws-main, br-model and bf-model nodes change. The only document local-state delta is campaignGraph. Other prior body nodes, review/merge wiring and source registries are preserved by the structural comparison.

Checkpoint16 limitations remain explicit: finS/finP subgraph values are empty and no finish body branch is supplied yet; independently editable nested workflows are not established. No input port has an explicit maxConnections declaration, so the requested authored input-capacity proof is also still pending at this snapshot. These observations are not assertions about the later authoring turn. Geometry, readability, popup behavior, occurrence isolation, native controlled writes, save/reload/import behavior and full application completion require their actual checks.

Reproduction from the independent checkout:

```text
node docs/studio/foundation-evidence/node-suite-stress-20261031/independent-source16-check.mjs
```

The script performs source/export/ancestry checks without invoking a browser or modifying the actual application. Its result is errors:[] and PASS: checkpoint preservation and declared wiring only. No public-compiler, rendered native, device, provider, owner-acceptance or Stage9 verdict is inferred from JSON inspection.
