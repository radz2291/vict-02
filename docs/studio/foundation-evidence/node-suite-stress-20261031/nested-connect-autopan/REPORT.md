# Nested connection auto-pan — builder repair

Base `afa8dd9d9f550392811ce286ecc025b9933d99a7`, branch
`codex/flow-nested-connect-autopan-20261101`.

Root reproduced native inner drag refusal after deleting only Social g2, with
fresh source/target points resolving to the exact owning physical handles. The
gesture moved the inner camera without changing canonical node positions. A
clean click-to-connect before any drag succeeded; the earlier click attempt was
against ports displaced by the preceding drag. DOM node IDs and owning aliases
were correct. This distinguished automatic connection pan from handle ownership
or canonical connection validation. Root retains its native observations.

Pinned public XYHandle in system0.0.83 starts automatic pan on the first move,
with a default40px edge zone and speed15 per animation frame. A physical121px
high nested viewport has little stationary area. Our controlled public-pointer
regression reproduces six7.5px pan steps, shifting the target45px away and making
the connection fail without a source operation. Both actual VICT composed and
retained callback adapters fail before the repair (**2 RED / 1 top-level PASS**).
Raw baseline logs are retained. In the expanded baseline, a final test-fixture
parse of the absent retained emission also failed after its already-recorded
zero-operation assertion; this is not an additional product defect.

The source repair sets the upstream public autoPanOnConnect property false only
when the authored viewport/editor has a GRAPH_BODY owner. This is an explicit
nested-ownership policy with no physical size/zoom threshold. Top-level canvases
retain true. Manual pan, wheel, node drag policy, coordinate adaptation, source
authority, validation and readonly behavior are unchanged. The raw exported
FlowCanvas is unchanged. No private engine, event-coordinate mutation, polling,
new gesture engine or artificial bound is involved.

The regression mounts actual VICT GraphViewport/GraphSurface, substituting only
the upstream SvelteFlow DOM with the existing public-props probe, then executes
the real pinned public XYHandle.onPointerDown with DOM mouse events, a controlled
200x121 physical frame, deterministic animation frames and moving hit geometry.
Thus its upstream pointer handler and actual adapter admission/canonical commit
are exercised; its layout and store callbacks are controlled fixtures, not native
browser or actual SvelteFlow construction evidence. After the repair, no pan is
requested and both paths commit exactly one semantic a.out→c.in connection.

```text
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/nested-connect-autopan.svelte.test.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/readonly-initial-layout.svelte.test.ts packages/ui-flow-svelte/test/connection-gesture.svelte.test.ts packages/ui-flow-svelte/test/port-projection-independent.svelte.test.ts packages/ui-flow-svelte/test/composition.svelte.test.ts
npm run build -w @victframework/ui-flow-svelte
node node_modules/eslint/bin/eslint.js packages/ui-flow-svelte/test/nested-connect-autopan.svelte.test.ts
git diff --check
```

Final **43/43 PASS**, Svelte **0 errors / 5 inherited warnings**, own test lint
and diff check exit0. Logs retained here. Native root evidence and independent
review are still required on freshly packed bytes, including the owning positive
drag, foreign repeated-ID refusal and unchanged manual cameras. This builder does
not award its own independent/native gate. No root worktree/dist, browser, live
app, provider, activation or remote was changed.
