# PV-06 — preserve pointer-selected occurrence

2026-10-24. Builder repair candidate, not an independent verdict. Isolated branch `codex/studio-cycle-1-3-pv06-selection`, based exactly on `b10c37a538a16f52e6430dfb9fc1eb317fc03745`. The running b10 product and its seal/evidence files were left unchanged. Local `origin/main` remains `d7401bef6e48330796c74ec00c86db9622d48cdf`; the authorized core branch, not main, is the baseline.

The independent browser reviewer observed a visible Flow node with the correct child source/occurrence/owner attributes selecting its parent canvas in Studio Design. The same adapter click through an installed consumer's direct DocumentHost selected the correct child. Editing the child through Nodes composition worked; that did not close the full-canvas failure.

EditorCanvas Design intercepted both pointerdown and click as independent selection requests. Showing floating selection tools can scroll the canvas between these events. A browser click retargeted to their common ancestor could therefore replace the exact pointerdown child selection. No generic component promotion was found in Designer's selection normalization; its existing native text promotion is unchanged.

The new test mounts the actual Flow authoring implementations through EditorCanvas. Before repair, a child-label pointerdown followed by a retargeted pointer click produced these two selections:

```
pointer-selection|start|canvas@vict.flow.canvas
pointer-selection|canvas
```

The assertion expected only the child and failed. The repair retains the pointerdown selection for that gesture's pointer-generated click. A new pointerdown resets the gesture, pointercancel clears it, and pointer-free/programmatic clicks and keyboard selection remain supported. Existing Design input/action suppression stays in place. Interact renderer callbacks, source/occurrence identity, local component/slot composition and canonical edits are unchanged.

Regression coverage asserts the actual Flow child occurrence, prevents same-gesture parent overwrite, permits a subsequent deliberate canvas gesture, preserves pointer-free child selection and leaves dispatch unused. Affected real-renderer suites for direct selection, literal text editing, composition surfaces and floating tools passed **13 tests across four files**. The root renderer test project now transforms the actual `@xyflow/svelte` dependency so this test exercises its Svelte implementation; an initial collection attempt without that transform failed on the dependency's `.svelte` import and is retained here as a harness failure.

Root TypeScript (`tsc -p tsconfig.json --noEmit`) and `git diff --check` passed. No production build or browser confirmation follows from these DOM tests. The stage manager must integrate the isolated candidate and the independent reviewer must retry the actual full-canvas Studio click and child edit/history/persistence journey before PV-06 closes.
