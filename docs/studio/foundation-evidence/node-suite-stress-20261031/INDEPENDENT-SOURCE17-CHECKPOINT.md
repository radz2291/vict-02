# Independent checkpoint17 nested-source review

31 October2026. Exact evidence checkpoint17-nested-finishing saved source/export, inspected against16-export-model at root HEAD e98a54cac62d7eb17db990d872dca74f2f3182db. Isolated branch codex/independent-source17-checkpoint-20261031. **Source/export ownership and preservation PASS; native nested layout is a retained FAIL and the integrated suite verdict remains HELD.** This does not assess checkpoint18 repairs currently in progress.

Checkpoint17 is savedr1.r6,295 source nodes,253831 characters; export attachment deep-equals saved source. Checkpoint16 wasr1.r5/226 nodes.69 source nodes are added; only prior ws-main changes, adding the Finishing branch/condition. Existing Model/Export/Review/Merge bodies and all prior source nodes otherwise survive unchanged.

Outer campaignGraph advances revision20→23. All14 node identities, labels, geometry and prior campaign values remain unchanged; all20 edges and all10 family definitions/ports deep-equal prior. The only changed saved parameters are finS.subgraph and finP.subgraph, previously empty. Both mode values remain social/poster. Output fanout and topology remain intact.

Each new subgraph is vict.flow-graph@2 revision1 with three nodes and two links: f-crop→f-grade→f-caption, edge IDs g1/g2. Both occurrences deliberately reuse exactly those inner node and edge IDs and the same three family definitions. Social values are aspect1:1, amount35, caption “Your commute, upgraded — 12h hot coffee”; Poster values are aspect2:3, amount70, caption “Trail-tested. Tireless. Launching soon.” Their inner positions and connections are the same; saved values are distinct rather than a shared singleton state object.

The one shared fin-ws is public vict.flow.workspace@2. It reads state.subgraph and emits graphChange→setState(subgraph), within ws-main's body slot whose subgraph declaration is controlled:string and whose containing finish-family parameter is actually declared string. The outer workspace is itself bound graph/state.campaignGraph and graphChange/setState(campaignGraph). The Finishing branch is isFinish→br-fin, rather than a standalone unrelated graph.

Exact structured source routes at this checkpoint:

```text
fin-ws: [{workspaceNodeId:"ws-main",graphNodeId:"finS",expectedGraphRevision:23}]
fin-ws: [{workspaceNodeId:"ws-main",graphNodeId:"finP",expectedGraphRevision:23}]
```

The nested body slot declares controlled aspect:string, amount:number and caption:string. isCrop/isGrade/isCaption conditions select the matching shared bodies. The actual source controls fc-crop-sel, fc-grade-in and fc-caption-in bind value to the corresponding state key and change/setState to that same key; public Flow ports match each inner family. The outer c-mode remains a controlled mode selector. No same-name document state or independent private graph is substituted for these saved parameters.

## Independent executable source-boundary challenge

Using the normal installed-workspace Studio Vitest configuration,3/3 tests PASS on this actual saved document. Actual inspectAuthoredGraphSource resolves each distinct saved nested string through the routes above. Actual graphAuthoringFor admits canonical source/history for each correct route and refuses missing, stale outer revision22, wrong workspace, and non-Finishing parent routes. Opaque occurrence keys are not parsed to invent ownership.

An in-memory-only patchAuthoredGraph change to Social's f-grade.amount36 at inner revision1/root23 produces inner revision2/root24, preserving Poster’s entire saved subgraph string, every other outer node record and all edges. Stale inner revision0 refuses. The original parsed document remains unchanged. These are disposable in-memory assertions; no browser, actual saved app, root source or evidence file was mutated. This supplies exact source resolver/sibling-isolation proof, not native control interaction/history/persistence proof.

```text
npx vitest run tests/independent-actual-source17-routes.test.ts
node docs/studio/foundation-evidence/node-suite-stress-20261031/independent-source17-check.mjs
```

The Node source check also associates root's retained exact roundtrip PASS to these same saved/export hashes: saved90357dd1f281f3c2e337404559166879fac808e392d9a53f9029e89a0f8d76ac; export32c433d730aa6a26c627e6badaf6d5335820f66753d5c1339254f4f9e1d276cf. Its three source snapshots match outer14/20 and both nested3/2. That integrator-run import/export proof is not an independently rerun native suite or independent new roundtrip run.

## Retained limitations/failure

Root measured both nested viewports around0.74px wide at zoom0.46 despite inner node DOM presence, with screenshot17-nested-initial-layout.png. This remains an actual layout failure, not a successful editable nested UI. Source is consistent with the diagnosis: fin-ws has no explicit width beneath bf-fin's column flex/align-items:center; fin-vp height is150 with min-width0 and overflow hidden. No independent browser measurement is claimed. The targeted layout repair must be rechecked natively before nested editing can pass.

No authored input maxConnections capacities appear yet in checkpoint17. Help remains checkbox/conditional-text based. Native pointer/keyboard editing, nested state isolation, canonical undo/redo, save/reopen/export after native changes, usable geometry and full request completion remain pending. Later checkpoint18 work must be assessed on its own exact evidence.

The full saved JSON parses at253831 characters and matches its complete export. The retained browser-control read truncated near200k is a transport observation; it does not demonstrate application source loss. Root reports an unbounded textarea and full chunked read matching export. This review verifies the complete filesystem artifacts and association, not an independently operated textarea read.

No product repair, provider/browser operation, activation, push, merge, publication, owner acceptance or Stage9 closure occurred. Earlier native failure and truncated-read observations remain preserved. Next: inspect the actual targeted layout/capacity/Help repair and complete its native ownership/persistence checks; retain this source-only PASS at its stated boundary.
