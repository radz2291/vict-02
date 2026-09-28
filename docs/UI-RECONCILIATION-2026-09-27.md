# VICT UI Reconciliation — review branch record (2026-09-27)

Branch `pi/ui-reconciliation-r1`, isolated worktree
`C:\Users\RZ1\Desktop\RZ\vict-02-ui-reconciliation`. Status:
**INTEGRATION SLICE READY FOR OWNER VISUAL REVIEW**. Nothing is merged to
`main`, nothing is published, the `renderer-svelte` compatibility facade is
NOT deprecated, the frozen Stage 8 rubric is untouched, and Stage 8 G3
remains HELD on the published `0.3.1` proof.

## 1. Lineage (normal Git history, both proofs preserved)

| Commit | What |
| --- | --- |
| `dc69768` | shared baseline (`codex/ui-foundation-catalog-coverage`, verified tip; includes the owner's five UI corrections) |
| `d343f6c` | merge of `pi/coding-agent-workspace-p1` @ `b7b557f` (coding-agent workspace product proof, "Victor Workspace") |
| `0f4b29f` | merge of `pi/taskledger-platform-gap` @ `3e39318` (TaskLedger platform follow-up: G1–G7) |
| (tip) | this slice: the two shared behavior gaps + reconciliation bookkeeping |

Both proof branches were verified pushed before work started, and both share
`dc69768` as their common baseline (confirmed with `git merge-base`).

### Conflicts

**None.** The two branch diffs from the baseline touch disjoint file sets
(`git merge` produced no conflicts in either merge). The only reconciliation
decisions were behavioral, not textual: both working products and the catalog
corrections are preserved verbatim from their branches.

## 2. Gap 1 — correct read/write invalidation (shared contract)

**Before:** every successful action dispatched through the renderer's action
path triggered the host's invalidation hook — including declared `query`
actions. The coding-agent host carried a `lastActionKind` query-skip
workaround in `+page.svelte`; without it, a mount-time read would dirty the
route, remount the issuing surface, and read again forever.

**Change (shared, in `packages/ui-svelte`):** `VitApp.dispatchAction` now
invokes `onInvalidate` only when the successful action's declared kind is
NOT `query`. The renderer owns the read-vs-write boundary; hosts stay plain.
The coding-agent host's workaround was removed (`+page.svelte` is a plain
`invalidateAll` again), and the `?path=` action-identity glue
(`+page.svelte` → `api/act` → server `dispatch(actionId, input, path)`) was
removed with it — the boundary no longer guesses identity from URLs.

**Preserved:** conversation sends (`act.send`, mutation) still refresh;
TaskLedger Complete (capability) and every other mutation/capability action
still refresh; table search/sort/pagination are unaffected (queries return
their rows as action results and never invalidated in the first place).

## 3. Gap 2 — declared record context (shared contract)

**Before:** component surfaces received only static props, so the
coding-agent islands read the workspace id from `window.location.pathname`
and self-fetched through declared query actions, coordinating refreshes
through a product-local `bus.ts`.

**Change (closed vocabulary, no expressions, no executable code, no props
escape hatch):**

- `@victframework/sdk` (@2, additive): `ComponentSource` =
  `{ param: name } | { record: field } | { view: viewId }`. Component
  surfaces: `props` values may be static scalars (unchanged meaning) or
  declared sources; new optional `input` maps action-input fields to
  sources. Conversation surfaces gain the same optional `input` for their
  send action.
- `@victframework/application`: compile-time validation — source shape
  (exactly one member, non-empty string), unknown route parameters
  (against all declared route path params), undeclared views, and unknown
  record fields (against declared resource catalogues). New issue code
  `INVALID_COMPONENT_SOURCE`; unknown views keep `UNKNOWN_VIEW_REFERENCE`,
  unknown fields `UNKNOWN_FIELD`.
- `@victframework/ui-svelte`: the renderer resolves props against the route
  context (`params` / `record` / `viewData`) and merges declared input
  bindings under the island's explicit input (explicit fields win). New
  exports: `isComponentSource`, `resolveComponentSource`,
  `resolveComponentProps`, `resolveComponentActionInput`,
  `declaredSurfaceViewIds` (+ the `ComponentSourceBinding`/
  `ComponentSourceContext` types). `@victframework/renderer-svelte` remains
  a pure re-export facade (its export list gained the new names; no
  deprecation, no behavior change).
- Hosts (`agent-server.ts` product server; the scaffolder's generated
  generic `application-server.ts` template): view loading collects view ids
  from component-surface bindings via the shared `declaredSurfaceViewIds`,
  so a bound view is loaded for the surface's screen exactly like a direct
  view surface.

**Coding-agent workspace conversion (product code kept product-specific):**

- `SessionConsole` receives the session record's declared fields as props
  and dispatches with NO explicit input (the surface's
  `input: { id: { param: 'id' } }` supplies record identity). No URL
  reading, no self-fetch.
- `SessionPicker` receives `v.agentSessions` / `v.agentProjects` rows as
  declared props. No self-fetch.
- `OutputLog` receives the session-scoped `v.agentLog` rows as a declared
  view binding. No self-fetch.
- The conversation surface declares `input: { id: { param: 'id' } }` for
  sends.
- Deleted: `bus.ts` (island coordination) and the three self-fetch query
  actions (`act.pickSessions`, `act.pickProjects`, `act.queryLog`). The
  three product surfaces remain product-specific (their presentation is
  theirs); governed dispatch (`component-actions` context) and contract
  validation are unchanged.
- The deterministic server accepts explicit `input.id` (tests/clients) and
  no longer resolves identity from request paths.

**TaskLedger work reused, not reimplemented:** the TaskLedger branch's
table cell islands, row actions, count surface, app-neutral scaffold,
parameterized navigation and view filters/sort are used as merged. Its only
island (the presentational priority badge, row-derived props) needs none of
the new bindings; nothing was implemented twice.

## 4. Verification

### Focused tests (new)

- `packages/application/test/component-record-context.test.ts` — 7 tests:
  valid bindings compile (plan carries them verbatim); expression-shaped,
  multi-member, and unknown-kind sources rejected (`INVALID_COMPONENT_SOURCE`);
  unknown route parameter rejected; undeclared view (`UNKNOWN_VIEW_REFERENCE`)
  and unknown record field (`UNKNOWN_FIELD`) rejected; malformed `input`
  rejected; static scalars unchanged.
- `packages/ui-svelte/test/component-record-context.test.ts` — 5 renderer
  tests: param/record/view props resolved in the DOM; view binding without a
  record; declared input binding supplies the dispatch input (`{ id: 'i-2' }`
  from `/tasks/:id`); a successful declared query does NOT invalidate while a
  mutation does; a mounted view-reading surface issues no dispatches and no
  invalidations (no repeated-fetch loop).

### Full suites on this tree

- Unit project: 2184/2186 passed. The 2 failures
  (`scripts/test/trusted-publishing.test.mjs`, frozen publication order vs
  the `@victframework/ui` dependency added by the TaskLedger branch) are
  PRE-EXISTING on `pi/taskledger-platform-gap` (verified by running the same
  test on that branch's worktree) — inherited, not introduced here.
- Renderer project: 95/95 passed (11 files, includes the new tests).
- ui-showcase: typecheck clean; agent node/DOM tests 13/13; full showcase
  suite 41/42 → after ordering the new browser test first, the agent-browser
  suite is 9/9 and the whole suite is green (the one earlier failure was the
  new no-loop test running after the approval test had mutated shared demo
  state; it now runs first and restores the seed state itself).
- `verify:stage5` packed-consumer: the packed closure was extended to
  `@victframework/ui` + `@victframework/ui-svelte` (required since the P5
  facade architecture and the TaskLedger branch's sdk/application ui
  dependencies left them outside the packed set — the pre-TaskLedger
  baseline had no such dependency and needed no change). With the extended
  closure, the packed-consumer proof passes end-to-end (11 tarballs →
  scaffolder installs → host generated → installs from tarballs with NO
  registry fetch → builds). The stage5 run otherwise reports two inherited
  reds (the trusted-publishing unit failures above and a happy-dom CORS
  failure in the reference-app `http.test.ts` suite — both reproduced
  identically on the pristine TaskLedger worktree, so both are
  pre-existing/environmental, not from this slice).
- Package builds: all 15 build clean.

### Real-browser evidence (both apps)

- Coding-agent workspace (`npm run workspace` → http://127.0.0.1:5181/agent):
  the full interaction path passed in Chrome — session chooser with project
  filter (keyboard), approval → running, failure → output log → retry,
  conversation with reply and draft retention on a stopped session, reset
  dialog, mobile drawer (Escape + focus restore), responsive stacking at
  768/390/320, document overflow ≤ 2px, axe-core smoke scan (zero
  serious/critical). NEW: the no-query-loop check — a mounted workspace
  issues ZERO `/api/act` requests while idle (reads come from declared
  route data), and approving issues exactly one action request followed by
  the host's data refresh. Screenshots refreshed:
  `qa-artifacts/agent-workspace/*.png` + `browser-evidence.json`.
- TaskLedger (external consumer at
  `C:/Users/RZ1/Desktop/RZ/taskledger-gap-proof-20260926`): the recorded
  proof stands (its tarballs are pinned to the TaskLedger branch). Confirmed
  this slice's requirements against it: the ONLY custom Svelte product
  component is the 50-line presentational `PriorityBadge.svelte`
  (registered in the author-owned `registry.ts`; no TaskTable, no
  TaskForm, no self-fetching count), and the immutable host files are
  byte-identical after authoring (`host-byte-comparison.json`: 16 files
  compared, 14/14 immutable files identical, only the author-owned
  `definition.ts` and `registry.ts` changed). In-repo proxies re-verified on
  the merged tree: the taskledger-gap compile/renderer/scaffolder suites and
  the packed-consumer scaffold+build (above).

## 5. Measured impact (actual, not estimated)

Coding-agent product custom UI + host glue, before (b7b557f) → after:

| Measure | Before | After | Δ |
| --- | ---: | ---: | --- |
| Product UI lines (Picker+Console+Log+AgentSurface+bus+eager) | 879 | 773 | −106 lines (−12.1%) |
| Island coordination (`bus.ts`) | 24 lines | 0 (deleted) | −24 |
| Self-fetch query actions in the definition | 3 | 0 | −3 |
| Host-glue diff vs catalog baseline (shared files) | +95/−23 | +62/−15 | −33/−8 |
| `?path=` action-identity plumbing (host → endpoint → server) | present | removed | — |
| Query-skip workaround in `+page.svelte` | present | removed (renderer-owned) | — |

Package impact (source changes; nothing published):

| Package | Change |
| --- | --- |
| `@victframework/sdk` | additive @2: `ComponentSource`, component-surface `props` bindings + `input`, conversation-surface `input` (all optional; absent members compile unchanged) |
| `@victframework/application` | compile validation for the above; new issue code `INVALID_COMPONENT_SOURCE` (additive diagnostics) |
| `@victframework/ui-svelte` | binding resolution in `Surface`/`VitApp`, query-exempt invalidation in `dispatchAction`, new logic helpers + exports |
| `@victframework/renderer-svelte` | facade export list extended only (pure re-export; deprecation impact unchanged) |
| `@victframework/scaffolder` | generated generic host collects component-surface view bindings (`declaredSurfaceViewIds`) — a newly scaffolded host differs from previously generated ones only in that import/collection line |
| `scripts/verify-stage5.mjs` | packed closure extended with `ui`/`ui-svelte` (verifier only) |

## 6. Transition-coherence repair (owner-reported, fixed on this branch)

**Report:** after clicking **Simulate failure** on
`/agent/sessions/AGW-101`, five consecutive frames showed Running →
"Failing…" → success feedback "Failure simulated" BESIDE the still-Running
status → Failed with Retry, the success text never visible together with the
fresh status; the conversation shifted sideways; the page jerked.

**Measured cause** (real Chrome via CDP, 8 ms in-page sampler,
`before/timeline.json`; 500 ms-throttled pass to widen the frames):

1. `VitApp.dispatchAction` fired the host hook **fire-and-forget**
   (`onInvalidate={() => void invalidateAll()}`) and resolved the action
   immediately: at t+11 ms the success feedback appeared and the loading
   control popped back to enabled while the status badge still read
   "Running" (incoherent frame; with throttling it lasted ~830 ms and left a
   window where the action could be fired again).
2. When the refreshed record applied, the console island **remounted**:
   `AgentSurface`'s `const load = $derived(LOADERS[kind]?.())` created a NEW
   dynamic-import promise per re-run, restarting the `{#await}` block — the
   island (and its feedback state) was destroyed and rebuilt (element
   identity probe: marked section replaced by a fresh node), so the success
   message was wiped exactly when the Failed status arrived, and keyboard
   focus fell to `<body>`.
3. Disabling the focused button at action start drops focus to `<body>`.
4. `.vict-conversation` had no `scrollbar-gutter`, so the failure message
   that overflowed the feed made the scrollbar appear and shifted every
   message 15 px sideways (measured feed 572 → 557 px, message width
   496 → 482 px).

**Fix (shared VICT code):**

- `ui-svelte/VitApp.svelte`: `dispatchAction` now AWAITS the host refresh
  before the action resolves; surfaces show feedback and release their
  loading control only beside the REFRESHED record. A rejected refresh is
  caught and reported as `ActionResult.dataStale: true` — the mutation stays
  a success, never misreported as failed, with no re-run invitation.
- `ui/src/feedback.ts` + `ui-svelte/ActionFeedback.svelte`: success feedback
  carries the distinct stale note (`data-testid="action-stale"`); the
  conversation send path surfaces its own equivalent
  (`data-testid="conversation-stale"` in `Conversation.svelte`).
- `ui-svelte/styles.css`: `scrollbar-gutter: stable` on the conversation
  feed (no width shift when the scrollbar appears) + the stale-note style.
- Host pages return the `invalidateAll()` promise (showcase
  `+page.svelte` and the scaffolder's generated host template).

**Product-specific adjustments (only what the product owns):**

- `AgentSurface.svelte`: the lazy-loader promises are created ONCE at module
  scope, so a record refresh can no longer restart the `{#await}` block and
  remount the island.
- `SessionConsole.svelte`: after the settled transition, keyboard focus
  moves to the NEW primary control (approve/advance/retry) or the completed
  note — focus follows the flow instead of dropping to `<body>`.

**Regression coverage:** `packages/ui-svelte/test/action-transition.test.ts`
(4 tests: loading control + feedback wait for refresh; failed refresh →
success + distinct stale state, no failure text; sync host hook; stale
through the conversation send) and two real-browser timeline tests in
`agent-browser.test.ts` (desktop 1440 and phone 390: no success-beside-stale
sample, island identity stable, feed width constant, single POST under a
double click, focus on Retry, draft retained, no scroll jump, idle no-loop,
settled screenshots `coherent-transition-*.png`).

## 7. Boundaries kept

- No merge to `main`, no publishing, no facade deprecation.
- The frozen Stage 8 rubric is untouched; G3 remains HELD on the published
  `0.3.1` proof; nothing here claims F6/G3 passed.
- Follow-up candidates recorded, NOT implemented here: `vict check`,
  per-role examples, linked lists, formatting, progress binding,
  wider/sticky layout, structured conversation content.

## 8. Remaining limitations (honest)

1. Compile-time param validation is app-wide (union of declared route
   params), not per-screen — a param valid on one route passes on another.
   Per-screen precision is a follow-up.
2. Record-field bindings validate against the union of declared resource
   catalogue fields; the route→record-resource mapping is host behavior
   (product server or generic host), not a declared contract, so a field can
   pass compile yet be absent from the record at runtime (renders as empty,
   never an error).
3. `{ view }` props deliver the view's projected rows as data; there is no
   per-field view binding for component surfaces (tables already have one
   via G1 cell props).
4. The packed-consumer release closure now includes `ui`/`ui-svelte`; a
   future release must publish both for external consumers of the merged
   architecture (owner decision, nothing published here).
5. The TaskLedger external-consumer proof remains pinned to the
   TaskLedger-branch tarballs; re-running the authoring pass against
   re-packaged post-reconciliation tarballs is a possible follow-up if the
   owner wants the byte-comparison repeated against the merged tree.6. The reference-app's browser/dom suites (responsive-nav MED-05-A, dialog
   focus, HIGH-05-A numeric prefill, denied-state fallback, injection
   canary) show **9 pre-existing failures inherited from the merged
   branches** — A/B verified 2026-09-27: rebuilding `8141812`'s package
   sources reproduces the identical failure set, so the transition repair
   (`2f71ef8`) did not cause them. The http-suite CORS failures are
   environmental (happy-dom fetch), also reproduced on the pristine
   TaskLedger worktree. Neither proof branch had the refapp browser/dom
   suites in its gate; a refapp follow-up against the reconciled facade
   architecture is an owner decision.
