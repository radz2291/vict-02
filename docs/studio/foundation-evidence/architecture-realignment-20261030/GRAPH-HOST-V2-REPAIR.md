# Graph host@2 source-authority repair — builder record

Predecessor candidate: 46d20c3 (full SHA in integrated candidate records). The independent reviewer returned FAIL in review commit d64e47087d5dbc3a858c4750045b9d7e1a98f5ec. Preserve that report and its tests in their review branch. This document is a builder report, not a replacement verdict.

## Reproduced findings and repair

F1: a canonical-valid nested workspace with a controlled string scope declaration but no corresponding parent graph-node parameter renders its declared fallback. The old host helper accepted the controlled flag and returned global source history anyway; nested Undo could undo an unrelated canonical label edit. The repair introduces public `vict.flow.editor-host@2` with structured occurrence identity and an explicit source/runtime/refused disposition. GRAPH_BODY/GraphWorkspace provide canonical workspace ID, actual graph-node ID and containing graph revision as a route. No opaque occurrenceKey parsing or private UI-renderer bridge is introduced. Studio validates this route through the exact same recursive source resolver used by editGraph. The missing parameter yields a visible refusal, read-only node/body/content context and no source Undo or write authority.

F2: a canonical-valid graph below66 ordinary wrappers passed canonical validation but its graph was silently dropped by the private lexical inspector's separate depth64 cutoff. Removed that cutoff. The existing source model's valid depth remains usable: mounted keyboard movement writes canonical source and Undo restores it. Cycles and explicit visit-budget exhaustion now clear all partial ownership and expose incomplete inspection; they cannot leave a convenient shallow owner in the map. Studio refuses source authoring on incomplete inspection. The runtime callback defense also resets the rejected graph key explicitly from its canonical declaration while retaining unrelated drafts, rather than promoting the refused value into temporary supplied state.

The reviewer's earlier custom-definition alias/depth fixture was invalid under canonical state-reference rules and is not counted as a product defect or proof. The valid66-wrapper runtime finding is distinct. The new cyclic-source direct-helper test is defensive invalid-input coverage, not another valid-app finding.

## Public contract and compatibility

- New exports: GRAPH_EDITOR_HOST_V2, GraphOccurrenceRoute, GraphOccurrenceIdentity, GraphAuthoringDisposition, GraphEditorHostV2. The @2 host separates source history, temporary local history and refused source ownership.
- GRAPH_EDITOR_HOST@1 and its callback shape remain supported when a consumer provides no @2 host. Existing legacy host and standalone composition tests pass. Studio supplies @2 and retains a conservative @1 fallback for older components; node-only history lookup cannot claim controlled nested canonical history without a route.
- Public context@1 structures gain optional provenance fields, preserving existing implementers. Current GraphWorkspace/ComposedGraphNode populate them. Saved UI documents, graphs and application schemas are unchanged. The agent operation remains the already versioned operation@6 extension; this host API has its own explicit revision.
- Explicit unbound/literal/private runtime roots retain local history. Their live graph revisions may depart from authored defaults; that difference never grants canonical history or incorrectly refuses local interaction.
- Controlled nested source routes retain the previously documented graph2 node-parameter scope. Legacy graph1 controlled nested routes are explicitly refused rather than silently reinterpreted; direct graph1 and standalone/@1 behavior remains supported.

## Retained intermediate failure

The first @2 mounted run passed16/17 cases but the missing-parameter negative still failed. Although the nested workspace correctly refused authority, its read-only viewport returned before owning its keyboard boundary, so Ctrl+Z bubbled into an enclosing writable viewport. The shared GraphViewport now checks the nearest viewport before handling graph commands; refused/read-only canvas commands cannot target an ancestor. Native input/textarea/select/contenteditable Undo is not default-cancelled. A subsequent7/7 followup passed; later extra coverage produced the final18/18 below. These counts overlap and are not additive.

A formatting attempt included .svelte files, but this repository has no configured Svelte Prettier parser. It reported those files unsupported; TypeScript files were formatted, Svelte source follows the existing format and all relevant Svelte/type checks pass. This is not recorded as a product failure.

## Checks

- Studio targeted source policy, mounted bridge, refusal and lexical-ownership suites:18/18, exit0. Raw log: graph-host-v2-repair-tests.log.
- Package composition.svelte.test.ts using the existing authoring config:17/17, exit0. This covers @1 host fallback, ordinary controls, nested operations, read-only/refusal and standalone runtime behavior. Raw log: graph-host-v1-compatibility.log.
- Studio TypeScript: exit0.
- Flow package Svelte check:0errors/5existing renderer warnings.
- Studio Designer Svelte check:0errors/5existing renderer warnings.
- git diff --check: clean.

Mounted added cases cover missing-parent-parameter refusal with unrelated global history retained, exact automatically supplied occurrence route/revision, readOnly propagation into app-owned content buttons, native text Undo not cancelled, valid deep canonical source history, and a controlled nested graph operating after its runtime literal parent's revisions diverge from authored source. The earlier mixed manual/agent/save/reopen/import and repeated-private-instance paths remain passing. Some nested DOM tests emit the upstream svelte-put shortcut warning; behavior assertions pass and no warning-free runtime claim is made.

Production build, packed independent-consumer rerun and fresh exact-candidate independent verification belong to the integrator's next checks. No serving activation, actual-provider trial, owner-data mutation, publication or owner acceptance occurred in this repair lane.
