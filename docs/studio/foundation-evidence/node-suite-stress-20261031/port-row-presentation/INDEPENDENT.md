# Independent port-row source review

Exact source candidate: `d8b3f6b8c3c8b74c529d3f6cfc532519a1ea7f2b`.
Isolated review branch: `codex/port-row-independent-20261031`.

**PASS for the bounded port-row leaf/registry/ownership/legacy source gate.**
No source blocker found. The reviewer did not author this port-row implementation
and made no production changes. This verdict does not review or award the
reviewer's separate geometry repair, installed-package association, native
endpoint placement, actual-agent completion or whole-suite acceptance.

The final candidate's type badge `max-width:45%`, wrapping and shrink declarations
were included in all runs below. HappyDOM does not establish painted width,
clipping, hit areas, endpoint locations or actual wire attachment.

## Source findings

- The new `vict.flow.port-row@1` is separately registered and exported, with
  matching descriptor/implementation parts `root,handle,socket,label,type`,
  ordinary `content`, no outputs and parent-context requirement. Strict registry
  compatibility accepts its new digest; an independently altered style-target
  contract is refused. Placement rules explicitly admit workspace body @1/@2/@3.
- Semantic label, type, direction and handle ID derive from the nearest actual
  GraphBodyContext port. The same public pinned XYFlow Handle and shared
  registerPort/uniquePort mechanism are used as bare GraphPort. No graph
  mutation, source-host bypass, inferred capacity or presentation-owned port is
  introduced. Read-only connectability is enforced by that owning body.
- The old GraphPort component and @1/@2/@3 compatibility JSON records are
  byte-unchanged relative to the parent before `edd71db4`. Existing bare-port
  descriptor revisions remain `3,2,1`; the implementation and registry remain
  additive. No saved graph schema or automatic migration changes occur here.
- Input uses the pinned public left/target classes; output uses right/source.
  The pinned public stylesheet anchors those at left/right 0 with half-width
  translation. Component CSS sets a transparent 28px handle and 10px dot. Actual
  card-boundary positioning still requires the documented full-width unpadded
  row placement and native measurement.
- Color accepts only hex or the stated token grammar; invalid values use a
  fixed fallback plus a fixed diagnostic. No supplied invalid string is echoed
  into rendered markup. Optional type hiding retains the semantic label.

## Independent challenges and exact checks

New `port-row-independent.svelte.test.ts` supplies 11 tests: graph@1/@2/@3
semantic resolution and no source writes; registry placement and compatibility
drift refusal; five unsafe color inputs; missing semantic port and outside-body
runtime refusal; conditional duplicate rows scoped independently to repeated
bodies, with unregister/restoration after hiding the duplicate. Existing native
field isolation, bare+row duplicate, read-only, registry and legacy authoring
checks were also rerun. The conditional test confirms no graph/global source
write while toggling the first body's private state; its sibling stays available.

```text
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/port-row-independent.svelte.test.ts packages/ui-flow-svelte/test/port-row.svelte.test.ts packages/ui-flow-svelte/test/authoring.svelte.test.ts
npm run build -w @victframework/ui-flow-svelte
node node_modules/eslint/bin/eslint.js packages/ui-flow-svelte/test/port-row-independent.svelte.test.ts
git diff --check
```

Results: **22/22 PASS** (11 independent + 4 builder port-row + 7 authoring).
Svelte check: **0 errors / 5 inherited warnings**. Own test ESLint and diff check:
exit 0. Final logs are `port-row-independent-third.log`,
`port-row-independent-types.log`, `port-row-independent-lint.log`.

Retained initial test-development failures do not indicate product failures:
the first helper shadowed DOM document with source document; the second kept
scope-dependent content when lifting the row outside its body, and used native
click/setState instead of the supported checkbox change/setState interaction.
Those fixtures were corrected without production edits. Both failed logs are
retained. The configured existing fixture aliases `@victframework/ui` to source;
this is expressly not an installed-artifact test.

Next allowed action: integrate this bounded review, build/pack the exact combined
candidate, then verify public installed rendering and the actual authored app's
row layout, connection/reconnection hit targets, nested zoom, readonly behavior,
history and save/export/import association. Native and integrated gates remain
HELD. No root worktree, dist output, browser, running app, provider, activation,
push or publication was changed.
