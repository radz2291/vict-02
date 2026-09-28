# Independent verification — combined UI candidate `8141812` (2026-09-27)

Branch `qa/ui-recon-verify-8141812` (isolated worktree
`C:\Users\RZ1\Desktop\RZ\vict-02-ui-recon-verify`), pinned to
`814181215a522b9028cbe8666a7d07a9da98997e` — the reconciliation branch
`pi/ui-reconciliation-r1` tip at verification start. The concurrent
visual-fix agent's worktree, branch, and server process were not touched
(its preview ran on port 5181; all verification used dedicated ports,
processes, and tmux windows).

**Scope of the result:** this record proves ONLY the pinned `8141812`
candidate. Nothing is merged to `main`, nothing is published, no Stage 8
criterion is amended, G3 remains HELD.

## 1. TaskLedger external-consumer re-proof (packed from this commit)

Full procedure, hashes, and byte comparisons:
`C:\Users\RZ1\Desktop\RZ\vict-02-ui-recon-proof-20260927` (outside the
repository; see its `README.md`). Summary:

- 11 packed tarballs from the pinned tree (`tarball-sha256.txt`); pack-time
  worktree diff = verification tooling only, so tarballs are exactly the
  pinned commit's package content. Diff vs the TaskLedger-branch proof's
  tarballs = exactly the five packages the reconciliation commit changed
  (sdk, application, ui-svelte, renderer-svelte, scaffolder).
- Fresh scaffold via the PACKED scaffolder with an explicit release set
  (`--release-set`); 16 generated files; 15 byte-identical to the
  TaskLedger-branch scaffold, the single delta being the reconciliation
  commit's documented `declaredSurfaceViewIds` collection in
  `application-server.ts`.
- **14/14 immutable host files byte-identical after authoring**
  (`host-byte-comparison.json`); only author-owned `definition.ts` and
  `registry.ts` changed; author-owned `PriorityBadge.svelte` added.
- **The only custom Svelte product component is the 49-line presentational
  `PriorityBadge.svelte`** (`component-trace.json`): row-derived props,
  registered `app.priority-badge@1`, never fetches, never dispatches. No
  TaskTable, no TaskForm, no self-fetching count — all declared surfaces.
- Browser proof at 1280x800 and 390x844 (real Chrome via CDP): create
  (valid + native-required refusal), edit (prefill + typed save),
  server-side search, title sort asc/desc, alphabetical priority sort,
  pagination (zero-overlap with explicit sort), island badge cell with
  three distinct computed palettes, governed row Complete at both widths
  (durable: 2 runs / 8 events / 1 activation), live count (7→6) and
  per-day chart (qty 1→2), restart persistence (rows byte-identical;
  ledger identical; repeated across a full rebuild),
  `applicationVersion v1_e42187a7…` identical to the TaskLedger-branch
  proof and stable across the rebuild, zero page-level horizontal overflow
  at phone width.
- Negative boundary probes over HTTP: undeclared action (`UNKNOWN_ACTION`),
  unknown fields (`CONTRACT_REJECTED`, per-field), malformed types
  (per-field), missing required fields, malformed JSON (`INVALID_REQUEST`)
  — all refused with "no run or mutation was performed"; ledger counts
  content-identical before/after; record total unchanged.

## 2. Trusted-publishing failures — root cause and fix (this branch)

**Symptom (pre-existing on `pi/taskledger-platform-gap` and this tree):**
`scripts/test/trusted-publishing.test.mjs` 2 failures —

```
frozen publication order violated: '@victframework/application' (position 5) depends on '@victframework/ui' (position 6) which publishes later
frozen publication order violated: '@victframework/sdk' (position 1) depends on '@victframework/ui' (position 6) which publishes later
```

**Root cause (genuine, not environmental):** the TaskLedger platform work
gave `sdk` and `application` real internal `@victframework/ui`
dependencies. The frozen §14 order places `ui` AFTER both, so the frozen
order stopped being a dependency-topological linearization of the actual
manifests, and the verifier correctly FAILED CLOSED. This is the contract
working as designed — the recorded order is stale, not the dependency
graph.

**Fix (this branch, verification tooling only):** `FROZEN_PUBLISH_ORDER`
in `scripts/lib/release-set.mjs` re-derived from the actual graph with ONE
move — `ui` to immediately before its earliest internal dependent (`sdk`);
the original 13 entries keep their relative order and the §14 positions of
`ui-svelte`/`renderer-svelte` are unchanged. The stale exact-position
assertions in `trusted-publishing.test.mjs` were updated to the re-derived
order (ui@2, sdk@3, application@7, ui-svelte@8, renderer-svelte@9) — same
assertions, same strength, no check weakened. The content-derived
release-set identity is order-independent and unchanged
(`v1_3a82c0651bb4b0d…`; `verify:release-set` ALL CHECKS PASSED, 15
packages, 0.3.1).

**Owner action recorded, not assumed:**
`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT-AMENDMENT-DRAFT-2026-09-27.md`
(draft §15) documents the order amendment for owner ratification. The
frozen contract file itself is NOT edited here; until ratification the
contract's §5 text still shows the §14 order — the fail-closed state
between a frozen contract and its consuming amendment.

## 3. Reference-app happy-dom CORS failure — root cause and fix

**Symptom (pre-existing):** `examples/reference-app/test/http.test.ts`
failed on every request (7 tests) under the project's `happy-dom`
environment.

**Root cause (stale environment assumption):** `http.test.ts` is a
real-process HTTP suite — it spawns the built Node server and drives it
with `fetch`; it never touches the DOM. Under happy-dom the global `fetch`
is happy-dom's browser-faithful implementation, which enforces CORS
against the cross-origin (localhost, OS-assigned port) spawned server, so
every request failed before reaching the real boundary. The suite was
written against Node's fetch and silently inherited the file-level default
environment when the shared happy-dom version in the workspace rose to a
CORS-enforcing major.

**Fix (this branch, no weakening):** per-file `// @vitest-environment
node` pragma at the top of `http.test.ts` with a comment explaining why.
Assertions, real process, durable-store and restart coverage unchanged.

## 4. Additional pre-existing reference-app failures found and fixed

Running the FULL reference-app suite (not just the stage5 subset) exposed
9 more pre-existing failures (7 `browser.test.ts`, 2 `dom.test.ts`),
present identically on the pristine `pi/taskledger-platform-gap` worktree
(reproduced there) and therefore inherited from before the shared baseline
— the reference app itself is unchanged from `dc69768` through `8141812`.
All are stale test assumptions about DOM the renderer stopped emitting;
none masked a product regression:

| Test | Stale assumption | Fix |
| --- | --- | --- |
| dom: denied state after boundary denial | expected a dedicated `denied-state` testid removed with the pre-bits state block (`bf8a0aa`); two other action surfaces on the same screen render their own empty feedback elements | assert the CURRENT denial contract: the delete dialog's `action-error` feedback carries the boundary's safe "requires permission" denial; shell stays intact |
| dom: hostile island prop | expected the island INSIDE the `overlay` backdrop — pre-bits native-dialog DOM; bits-ui renders panel and backdrop as siblings | scope to `[data-testid="overlay-panel"]`; security assertions (inert text, no registry access) unchanged |
| browser: dialog focus | expected focus on the panel element; bits-ui focuses the panel's first focusable (close button) | assert focus is contained INSIDE the panel (any focusable), keep Escape-close, overlay-gone, focus-restore |
| browser: 5 nav-layout tests (`#vict-nav` selector) | the composition-slice shell (`bf8a0aa`) replaced the single nav with a desktop sidebar + bits-ui mobile drawer; `#vict-nav` no longer exists | measure the VISIBLE navigation container (`[data-desktop-navigation]` / `.vict-navigation-drawer`); drawer containment asserted against the viewport (it is a viewport overlay by design); menu-close-after-navigation, no-overflow, keyboard open/Escape/focus-restore invariants all kept |
| browser: numeric prefill | clicked the removed `vict-tab-*` id and waited for the removed `result-state` testid | activate the declared 'Edit' tab via its declared tablist label; wait for the form's `action-success` feedback; THE regression assertion (untouched `budget` dispatches as number 42 and survives a real server restart) unchanged |
| browser: post-fix flake hardening | two fixed sleeps raced bits-ui's asynchronous unmount (overlay after Escape; drawer after Escape) — intermittent failures under load, passing in clean runs | replace both fixed sleeps with bounded `waitFor*` on the REAL condition (up to 5s) — strictly stronger, same invariants; 4/4 clean full-file runs afterwards |

Result: full reference-app suite **66/66 passed** (6 files).

## 5. FINDING-1 for reconciliation (product, not fixed here)

With no explicit user sort, the TaskLedger table's query dispatch omits
`sort`, so the data adapter's declared list order (ascending `createdAt`)
is used while the screen's server load applies the declared view sort
(`desc`). The initial page order and the post-dispatch order diverge, and
paging on a fresh mount can repeat a row across pages (observed: Golf on
both page 1 and page 2) while hiding others. Mechanism:
`packages/ui-svelte/src/TableAdapter.svelte` sets `payload.sort` only when
the user has toggled a sort. Pre-existing on the TaskLedger branch
lineage; not introduced by `8141812`. **Documented for reconciliation —
the shared renderer belongs to the visual-fix agent's branch; a candidate
fix is to seed the table's dispatch sort from the bound view's declared
sort.** With an explicit sort active, pagination is zero-overlap
(verified).

## 5.1 FINDING-2 for reconciliation (verification-identity drift, not
fixed here)

`verify:builder-kit` fails with 3 drift failures (regenerated base pack,
stale BUILDER-KIT.md/PACK.md renderings, workspace membership changed).
The committed builder-kit stable layer was last regenerated on the
pre-UI main lineage (`196a2c1`, 2026-09-25; repository map over 14 package
dirs); the UI lineage then added `packages/ui`, `packages/ui-svelte`, and
`examples/ui-showcase` without a mandated regeneration. Identical failures
reproduced on the pristine `pi/taskledger-platform-gap` worktree, so the
drift spans the whole UI lineage and is not introduced by `8141812`.
Regeneration rewrites committed identity artifacts (packIds, renderings)
that the reconciliation branch also carries — owner/reconciliation
decision, not made here.

## 6. Gate outcomes on this branch (exact)

All gates run on `qa/ui-recon-verify-8141812` = pinned `8141812` + the
verification fixes in §2–§4 plus one type-only line (§6.1). The packed
TaskLedger proof (§1) used tarballs packed from the PINNED tree before any
fix, so it characterizes the candidate itself.

| Gate | Outcome |
| --- | --- |
| Root vitest projects (unit / mastra / renderer / integration) | **2607 passed \| 3 skipped (2610), 148 files — EXIT 0** (includes the fixed trusted-publishing tests: 62/62) |
| Full reference-app suite (own vitest) | **66/66 passed, 6 files — EXIT 0** (dom 13, http 11, browser 13, definition, metrics-upsert, reading-time) |
| `verify:release-set` | **ALL CHECKS PASSED — 15 packages, 0.3.1, `v1_3a82c0651bb4b0d…`** (identity unchanged by the §15 order re-derivation) |
| `check:ui` (svelte-check on packages/ui-svelte) | **0 errors, 0 warnings** after the §6.1 type-signature fix (failed with 1 error on the pinned tree) |
| `test:foundation` (build + verify-ui-foundation) | **PASS — EXIT 0** (10 browser checks) |
| `test:composition` (build + verify-ui-composition) | **PASS — EXIT 0** (18 browser groups) |
| `test:catalog` (build + verify-ui-catalog) | **PASS — EXIT 0** (46 catalog browser checks) |
| `verify:stage5` (reference warning-free build + packed-consumer 11-tarball scaffold→install→build→probe) | **ALL CHECKS PASSED — EXIT 0** (final run after the §4 flake hardening; embedded reference-app suites 66/66; packed-consumer: scaffolder installs from tarball, packed generation, host installs from tarballs, host builds in isolation, emitted compiler negative probe — all ok) |
| `verify:builder-kit` | **3 FAIL — pre-existing inherited drift** (identical on pristine `pi/taskledger-platform-gap`): `pack:regenerate-compare`, `pack:renderings` (BUILDER-KIT.md/PACK.md stale), `identity:workspace` (membership changed). Cause: the committed stable layer was last regenerated at `196a2c1` (2026-09-25, 14 package dirs); the UI lineage added `packages/ui`, `packages/ui-svelte`, and `examples/ui-showcase` afterwards without regeneration. **FINDING-2 for reconciliation** (documented, not fixed here — regeneration rewrites committed packIds/renderings shared with the other agent's branch) |
| ui-svelte package build after §6.1 | clean (`tsc --emitDeclarationOnly`) |
| Renderer project re-run after §6.1 | 95/95 passed |

### 6.1 Product type fix on this branch (verification-exposed)

`packages/ui-svelte/src/Surface.svelte` declared the `sendConversation`
prop as `(actionId, text)` while the reconciliation commit's own template
calls it with a third `boundInput` argument (matching the VitApp
implementation's actual optional parameter). Runtime behavior was already
correct (the annotation is erased; the call and implementation agree), but
`check:ui` failed closed with `Expected 2 arguments, but got 3`. Fix: the
prop type now matches the implementation
(`boundInput?: Record<string, unknown>`). This is the only non-test,
non-verifier source change on this branch; if the visual-fix agent's branch
does not carry it, `check:ui` stays red there and this line folds in
trivially.

## 7. Focused checks to repeat on the final combined tip

Once the visual-fix agent lands on `pi/ui-reconciliation-r1`, these are
the checks this verification exposes as must-repeat (cheap, targeted) on
the new tip, in addition to that agent's own visual review:

1. The two trusted-publishing tests + `verify:release-set` (the frozen
   order travels with the branch; the draft §15 must still apply).
2. Full reference-app suite (the three fixed test files ride on this
   branch; if the visual fix touches `AppShell`, `Overlay`, `Tabs`,
   `FormSurface`, or `ActionFeedback`, these are the tests that pin their
   contracts).
3. A fresh packed-consumer scaffold (verify:stage5's packed check) IF the
   visual fix touches `packages/scaffolder` templates or anything under
   `packages/ui-svelte/src` — then re-hash the 16 generated files and
   re-run the TaskLedger authoring byte-comparison (the 14 immutable files
   must stay byte-identical; only a deliberate template change may move
   them, and it must be re-documented).
4. Renderer project + ui-svelte component-record-context tests (the
   query-exempt invalidation and binding resolution the reconciliation
   added).
5. The TaskLedger browser matrix at phone width ONLY IF the visual fix
   touches shared table/feedback/navigation rendering used by the
   generated host (badge cell, row Complete, count/chart live updates).
6. `applicationVersion` re-probe (`v1_e42187a7…`) after any template or
   contract change.

## 8. Governance boundary

No merge to `main`; no publication; no amendment to the frozen contract
file or the Stage 8 rubric; G3 remains HELD; nothing here claims F6/G3
passed. The packed proof directory stands as evidence for the pinned
candidate only.
