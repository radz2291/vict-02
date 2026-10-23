# Cycle 1.3 Flow builder candidate

2026-10-23. Builder evidence only; independent verification is pending.

## Baseline and compatibility

Read the system reference, Stage 9 state, architecture and handoff, then current
Cycle 1.3 executable handoff before changes. Shared isolated branch
`codex/studio-cycle-1-3` at scope commit
`61e3874` and `origin/main d7401bef6e48330796c74ec00c86db9622d48cdf`
matched the parent coordinator's reconstructed authority. The initial worktree
had only the coordinator's install log untracked. No owner process, port, tab,
saved screen or other checkout was changed by this lane.

The optional package `@victframework/ui-flow-svelte@0.4.0-rc.1` consumes exact
`@xyflow/svelte@1.7.0`. Upstream annotated release tag resolves to immutable
commit `3d35b57317576b0916c0bfeaaedd573aaacc2839`. License, integrity, source
links and local modification boundaries are recorded in
`packages/ui-flow-svelte/UPSTREAM.md`. No upstream source is patched. Installed
dependency readback: Svelte 5.57.0 deduped; xyflow/system 0.0.83. No Bits UI,
VICT core, editor, Studio or runtime dependency enters this package. Explicit
CSS import uses upstream Flow styles without a global reset or preflight.

## Delivered surfaces

Public exports include the complete pinned upstream Svelte Flow component,
hook, connection, node/edge, navigation and extension API. `FlowCanvas`
composes optional controls, minimap and background with bindable graph state
and forwards all SvelteFlow props/snippets. Its README has a standalone
consumer example with user-owned connection handling and no Studio import.

Studio adds a large Structure view next to Design and Interact. The graph is
computed from the actual canonical UI document: stable source-node IDs;
ordinary and slot containment; repeat templates; conditional branches;
fallbacks; stored definitions and revision-specific catalog references;
local-state reads/writes, action and route references. Edges describe declared
structure, never executable workflow wiring. Selectable authored nodes share
the existing editor selection. References/templates without unique authored
occurrences remain inspectable; an accessible source selector accompanies the
canvas. Flow provides pan/zoom, keyboard navigation, controls and minimap.

Positions/viewport are local presentation state. They never enter canonical
documents, application identity, storage, history or runtime state. Existing
canvas remains mounted when hidden, preserving its current preview context.

Connections are explicitly opt-in containment moves. A drag/click start pins
document and working revision; the Studio adapter checks both again at commit,
plus property/source/rename drafts. Only a unique authored source path and a
supported single-slot container pass. Root, cyclic, unknown, non-container,
multi-slot, repeated/definition and multiply-owned selections refuse. Context
parts use the same `canInsertRecipe` placement metadata as Composer and agent
tools. Successful preparation invokes the existing move command through the
existing EditorBridge; canonical validation remains authoritative. Graph
deletion/reconnection is disabled. Explicit slot choices and binding edits
remain available through the existing Design tools.

## Checks and retained failed observations

- `npm view @xyflow/svelte version license peerDependencies gitHead dist.integrity --json`
  and read-only upstream tag lookup established the pin before implementation.
- `npm run build -w @victframework/ui-flow-svelte`: PASS, zero errors and zero
  warnings, using installed Svelte 5.57.0 / xyflow 1.7.0.
- `npm run test -w vict-studio -- tests/structure.test.ts`: PASS 6/6. Tests cover
  stable IDs, projection without identity changes, real definition/template/
  binding edges, one canonical move with Undo/Redo/Save/reopen, stale document/
  revision/draft/root/cycle/unknown/non-container refusal, ambiguous source
  ownership and multi-slot refusal, and context-owned component refusal.
- First test attempt before foundation build: failed collection because
  `@victframework/ui` dist did not yet exist. Retained as setup observation;
  the successful rerun above used real built workspace packages.
- `npm run check:designer -w vict-studio`: process failed with native
  `Fatal process out of memory: Zone`, before diagnostics. Concurrent render
  test startup failed with `young object promotion failed` / heap out of memory.
  The coordinator identified concurrent full-test worker startup and asked
  all lanes to stop heavy checks and centralize serial verification. This
  lane did not terminate another process. These are not passing checks.
- Added `apps/studio/tests/ui/structure.test.ts` for real Flow mount,
  controls/minimap, accessible shared selection, no source mutation and draft
  refusal. Its execution is pending the coordinator's serial rerun.

Production CSS/browser, packed-artifact consumer, Designer check and combined
regression evidence belong to the integrating coordinator's gate. This report
does not claim their completion, provider proof, independent verification,
owner acceptance, publication or Stage 9 closure.

Review walkthrough: open an existing screen, choose Structure, select a source
node, drag it to rearrange the view and confirm the saved state is unchanged.
Enable Move by connection, connect a child to a different ordinary container,
then use shared Undo/Redo and Save/reopen. Attempt root/cycle/reference moves
and confirm refusal. Use Design for multi-slot choices and behavior bindings.
