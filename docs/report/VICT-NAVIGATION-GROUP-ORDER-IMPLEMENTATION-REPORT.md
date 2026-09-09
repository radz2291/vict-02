# VICT Navigation Group Order — Implementation Report

> **Status:** Implemented and internally verified — **awaiting independent
> verification and a coordinated public release**. This is an implementer
> claim, NOT independently authoritative (reference §0.1 authority order;
> "Implemented" is not "Verified", GOV-004).
> **Origin:** external consumer finding **GAP-CANDIDATE-2** (declared
> navigation-group ordering), recorded in the Trading OS T0
> independent-review reconciliation
> (`docs/audit/TRADING-OS-T0-INDEPENDENT-REVIEW-RECONCILIATION.md` in the
> read-only Trading OS repository at evidence commit
> `22a6b34773033bc5d807b4bdd130f30240b7079d`) and its consumer-fit audit
> (`docs/audit/VICT-TRADING-CONSUMER-FIT.md`, §5 item 11 / §6).
> **Reference version:** VICT System Reference v0.4.4 (patch increment:
> renderer behavior correction + §17.3 clarification; no accepted
> architecture changed, no Verified status changed).
> **Disposition recorded here:** GAP-CANDIDATE-2 is
> `IMPLEMENTED — INDEPENDENT VERIFICATION AND PUBLIC RELEASE PENDING`.

---

## 1. Starting state

| Item | Value |
| --- | --- |
| Repository | `C:/Users/RZ1/Desktop/RZ/260831-VCT-02` (VICT framework monorepo) |
| Starting SHA | `e70b1a876bf7f4bad83a611f5333d86541a0b664` |
| `origin/main` at start | `e70b1a876bf7f4bad83a611f5333d86541a0b664` (identical; fetched before work began) |
| Tracked working tree | clean |
| Untracked material | pre-existing `.pi/` only — preserved untouched |
| History | linear (no merge commits), understood |
| Prior observed SHA | the previously recorded VICT SHA `e70b1a876bf7f4bad83a611f5333d86541a0b664` was still the remote tip; no divergence occurred |

Final state: implementation commit and documentation commit on `main`
(see §10); remote advanced only by normal fast-forward pushes of these
commits.

## 2. The originating finding (GAP-CANDIDATE-2)

The Trading OS T0 reconciliation (F-2, superseding the original
"navigation group ordering is directly supported" claim) independently
reproduced from VICT `0.1.0` sources:

- `ApplicationRoute.nav.order` is documented and implemented as an order
  hint **within its group** (`packages/sdk/src/application.ts`);
- `VitApp.svelte` (`navGroups` derivation) sorts navigation groups
  **alphabetically by group name**, then routes within a group by
  `order`, then by path;
- the compiler's closed `NAV_FIELDS = ['label', 'group', 'order']`
  leaves no way to declare a group order;
- consequently a consumer sequence such as
  `Research → Practice → Operate → Review → System` renders as
  `Operate → Practice → Research → Review → System`.

The finding was classified as genuinely framework-neutral and blocking
for the consumer's T1 shell, with the honest workarounds (numeric
prefixes, invisible characters, label encoding, post-render DOM
rearrangement, product-rendered navigation duplicates) all rejected as
presentation hacks. This correction implements the upstream fix in VICT
itself; no consumer-side workaround exists or was created.

## 3. Independently reproduced pre-fix behavior (negative control)

Before applying the correction, a focused regression test file was
authored against the UNMODIFIED renderer and executed
(`npx vitest run --project renderer packages/renderer-svelte/test/navigation-group-order.test.ts`):

- **5 failed / 4 passed** — every assertion expressing the desired
  first-occurrence semantics failed, and every assertion expressing the
  then-current behavior passed.
- The failing non-alphabetical test (declared groups `Reports → Alpha →
  Metrics` by route order) received the rendered sequence
  `#Alpha, Ledger, #Metrics, Charts, #Reports, Reports, Overview` —
  i.e. **groups rendered alphabetically, exactly the defect**. The
  passing "alphabetical input remains stable" test proved the
  alphabetical presentation in the positive direction. This is the
  recorded negative control.
- The passing `nav.order` and path tie-break tests proved the
  within-group contract was already correct pre-fix (the defect was
  exclusively the group-level sort).
- The passing interleaved-groups test pre-fix was coincidental: its two
  group names (`Aurora`, `Borealis`) happen to be in alphabetical order,
  so the alphabetical sort and the first-occurrence rule agree; the
  anti-alphabetical fixtures (e.g. `Zebra` before `Yak`) failed pre-fix
  and pass post-fix.

## 4. Governing contract analysis

Source inspection confirmed that the existing public contract ALREADY
guarantees stable, intentional route ordering, so no schema change is
required or permitted by the minimal-correction rule:

1. `ApplicationRoute` (`packages/sdk/src/application.ts`): *"One
   navigable route. The routes array is ORDERED navigation semantics."*
2. `ApplicationPlan.routes` (`packages/application/src/compile.ts`):
   *"Resolved routes in NAVIGATION order with their screens"* — the
   compiled plan preserves declared route order (the renderer's
   ordering input).
3. `canonicalApplicationManifest` (same file): set-like collections are
   sorted by id, but *"meaningful ordered arrays (navigation routes,
   layout regions, ordered surfaces, form fields)"* are preserved —
   route order is identity-relevant semantics, not insertion accident.
4. `computeApplicationVersion`: *"Meaningful UI sequences (navigation,
   layout, surfaces, form fields) are ORDERED semantics and change the
   identity."* Reordering the routes array produces a different
   `applicationVersion` (asserted permanently in the new test file), so
   first-occurrence group ordering is exactly as identity-stable as the
   declaration it presents.
5. No normative document requires alphabetical group ordering. The only
   pre-correction source of that behavior was the renderer's own inline
   comment (`"Navigation groups sort by name"`), i.e. implementation
   commentary contradicting the ordered-route contract above it —
   precisely the §0.1 authority-order mismatch class ("A discovered
   mismatch must be fixed…").

**Conflict check (mandated stop condition): none.** First-appearance
ordering contradicts no normative requirement; no broader API redesign
was invented; no new schema field was added to compensate for
renderer-side sorting.

## 5. Selected semantics (exact)

> **Navigation groups appear in the order of their first occurrence in
> the ordered route list.**

- Within each group, the existing contract is preserved verbatim: routes
  sort by the declared `nav.order` hint (absent ⇒ `0`), ties broken by
  route path. Route-array position never overrides an explicit
  `nav.order`.
- A repeated or interleaved group is anchored at its first occurrence
  and all of its routes render together (single Map bucket per group
  name, populated in plan-route order, then sorted by the within-group
  contract).
- Routes without a `group` keep their existing presentation (no group
  label element) and their collection is anchored at the first
  occurrence of an ungrouped navigable route, ordered among themselves
  by the same `nav.order`/path contract. No new user-facing vocabulary
  was introduced.
- Desktop and mobile navigation are the same DOM landmark
  (`nav[aria-label="Application"]`) with one derivation, so the semantic
  order is identical in both form factors; the mobile panel state
  (open/close, Escape policy) does not reorder it.
- Because `navGroups` is a Svelte `$derived.by` over the plan, a
  reactively updated application plan recalculates the order without
  remounting.
- Generic by construction: no consumer-specific names, no hardcoded
  sequences, no prefixes, no hidden labels, no CSS/DOM ordering, no
  consumer-side patching, no renderer fork, no global mutable singleton,
  no verifier weakening.

## 6. Implementation files changed

Production change — exactly one file:

- `packages/renderer-svelte/src/VitApp.svelte`
  1. `navGroups` derivation: removed the alphabetical group-name sort
     (`[...groups.entries()].sort((a, b) => a[0] < b[0] ? …)`) so group
     order is the Map's first-occurrence insertion order; the within-group
     `nav.order`/path sort is untouched; the misleading "sort by name"
     comment was replaced with the normative first-occurrence comment.
  2. The nav's outer `{#each navGroups as [group, entries] (group)}` was
     made **unkeyed** (with an explanatory comment). Reason: a reactive
     plan update can now legitimately PERMUTE the group sequence, and the
     Svelte 5 (5.57.0) keyed-each reconciliation misplaces nodes when a
     keyed item body consists of multiple nodes starting with an `{#if}`
     fragment — the exact nav structure. Pre-fix this defect was masked
     because an alphabetical key order can never permute across plan
     swaps (same key set ⇒ same rendered order). The defect was
     reproduced in an isolated minimal fixture during diagnosis (kept out
     of the permanent tree): after permuting keys `[Alpha, Beta] →
     [Beta, Alpha]`, the rendered DOM was `Alpha…Beta…B1…A1` instead of
     `Beta…B1…Alpha…A1`. Unkeyed index-wise reconciliation keeps DOM
     order equal to derivation order; the group blocks carry no local
     state, no transitions, and no per-group identity requirements, and
     in-place updates are focus-safe. The inner
     `{#each entries as entry (entry.route.id)}` remains keyed (unique
     route ids, single-node items — the reliable case).

Test addition — exactly one file:

- `packages/renderer-svelte/test/navigation-group-order.test.ts`
  (9 tests, compiled through the REAL `compileApplication`; assertions
  express public DOM behavior, not implementation snapshots).

No other production, build, manifest, lockfile, or script file was
modified.

## 7. Tests added (public-behavior coverage)

`packages/renderer-svelte/test/navigation-group-order.test.ts`:

1. non-alphabetical group declarations render in first-route-occurrence
   order (`Reports → Alpha → Metrics`);
2. alphabetical input remains stable (also the recorded pre-fix positive
   control);
3. `nav.order` still orders routes within a group against declaration
   order;
4. equal/absent `nav.order` keeps the deterministic path tie-break;
5. repeated and interleaved groups anchor at first occurrence and
   collect every member (`Aurora` block: order-sorted `A2, A1, A3`
   followed by the complete `Borealis` block);
6. ungrouped routes stay unlabeled, anchor at their first occurrence,
   and order among themselves by `nav.order`;
7. desktop and mobile share one semantic order (single landmark; link
   and label sequence identical; `aria-expanded` toggle, in-flow open
   panel, Escape-closes-and-restores-focus policy all verified with
   grouped navigation);
8. a reactively replaced application plan recalculates the group order
   without remounting (including the full permutation case that
   exercises the keyed-each remedy);
9. compiled-plan and application-identity behavior unchanged: plan
   routes preserve declared order, rendering never mutates the plan
   (`toJSON` deep-equal before/after), identical definitions recompile
   to the identical `applicationVersion`, and route-order-only changes
   produce a different `applicationVersion` (the identity contract that
   makes the declaration meaningful).

Accessibility regression coverage for the nav (landmark, current-page,
group-label markup, focus order = DOM order, Escape policy) is expressed
in tests 6, 7 plus the pre-existing
`renderer.test.ts` "accessible defaults" suite and
`heading-levels.test.ts`, all green.

## 8. Compatibility analysis

| Question | Answer |
| --- | --- |
| Exported TypeScript contract changed? | **No.** No `.d.ts`, no source type, no schema, no compiler validation change. |
| Serialized Application Plan shape changed? | **No.** `compile.ts` untouched; plan serialization, canonical manifest, and frozen-plan behavior unchanged (asserted by test 9). |
| Application identity calculation changed? | **No.** `computeApplicationVersion` untouched; route order was already ordered identity semantics before this correction. |
| Generated declarations changed? | **No.** `tsc --emitDeclarationOnly` output for the renderer package is unchanged in shape (no exported surface changed). |
| Other renderers or consumers affected? | The shared renderer conformance suite (`runRendererConformanceSuite`) does not assert group order and is untouched; the reference-app and application-proof examples compile and run unchanged (reference-app groups `Workspace`, `Work` now render in declaration order — no test asserted their rendered order). |
| Backward compatible? | **Yes** for every definition whose groups were declared in alphabetical order (rendering is identical). Definitions relying on the previous alphabetical re-sort of a NON-alphabetical declaration were relying on behavior that contradicted the documented ordered-route contract; such definitions regain control by declaring routes in their intended group order, with a deterministic, declared-order-driven presentation. No plan, schema, identity, or API migration is involved. |

## 9. Commands and results

Executed on the corrected working tree (Windows, Git Bash, Node
v22.13.1). Exit codes are the commands' actual results; no failure was
suppressed, no timeout increased, no assertion weakened.

| # | Command | Exit | Result |
| --- | --- | --- | --- |
| 1 | `npm ci` | 0 | clean install from the committed lockfile |
| 2 | `npm run format:check` | 0 | all matched files pass Prettier |
| 3 | `npm run lint` | 0 | ESLint clean |
| 4 | `npm run typecheck` | 0 | `tsc --noEmit` clean |
| 5 | `npm run build` | 0 | all 13 packages build |
| 6 | `npm test` | 0 | **116 files passed + 1 skipped (117); 2184 tests passed / 3 skipped (2187)** — single run, first-run green (the 3 skips are the pre-existing POSIX-only suites, unchanged) |
| 7 | `npm run example:application` | 0 | application-proof build + 17/17 tests |
| 8 | `git diff --check` | 0 | no whitespace/conflict markers |
| 9 | focused file: `npx vitest run --project renderer packages/renderer-svelte/test/navigation-group-order.test.ts` | 0 | 9/9 passed (post-fix); pre-fix the same file recorded **5 failed / 4 passed** (§3 negative control) |
| 10 | full renderer project: `npx vitest run --project renderer` | 0 | 4 files / 54 tests (45 pre-existing + 9 new), including the shared renderer conformance suite, accessible-defaults, and heading-levels (accessibility) suites |
| 11 | `npm run verify:release-set` | 0 | ALL CHECKS PASSED — 13 packages, `0.1.0`, content ID `v1_dbb7438dfe16b7d…` (release-set identity unchanged) |
| 12 | `npm run verify:stage5` | 0 | ALL CHECKS PASSED — full-package build, complete vitest suite, warning-free reference application build (no Svelte `state_referenced_locally`, no vite-plugin-svelte warnings), reference application suites (definition/DOM/real-process HTTP restart/REAL-browser desktop + mobile with axe accessibility), and packed-consumer scaffolder verification (tarball install, generated-host install/build in isolation, emitted-compiler rejection/acceptance) |
| 13 | `npm run verify:clean-clone` | (run post-commit) | fresh-clone `npm ci` + typecheck + build + `verify:stage6b` from the committed correction |

## 10. Commits

Two reviewable commits, per the task's preferred split:

1. `fix(renderer): preserve declared navigation group order` — renderer
   correction + focused test file.
2. `docs(application): record navigation-order correction` — System
   Reference v0.4.4 (§17.3 clarification, header status/evidence) and
   this report.

Historical implementation, verification, closure, and handoff reports
were not modified. The pre-existing untracked `.pi/` material was
preserved untouched.

## 11. Immutable release boundary and non-interaction

- The published release set `vict-release-set@1/0.1.0` (content ID
  `v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d`,
  release source `7e5908e578c6371ef20a93d03c48f8af422ca487`) remains
  **immutable and unchanged**. No package version was changed for
  publication, `0.1.0` was not republished, no new version was
  published, no release-set metadata was altered, no dist-tag, access,
  or organization setting changed, and no Git release tag was created.
- The source correction is NOT contained in the currently published
  packages; consumers receive it only through a future coordinated
  release decided by a separate task.
- No npm registry, GitHub release, tag, or package-ownership state was
  mutated by this task (`verify:release-set` is read-only;
  `publish:release` was NOT run).
- The Trading OS repository
  (`C:/Users/RZ1/Desktop/RZ/260909-VCT-Trading`) was used read-only as
  evidence (verified at `22a6b34773033bc5d807b4bdd130f30240b7079d`);
  nothing was committed, pushed, or modified there.
- The Quellight repository was not accessed or modified.

## 12. Limitations and unresolved questions

1. **Independent verification outstanding.** Every claim above is an
   implementer claim. Per GOV-004/GOV-003 the correction becomes
   Verified only through an independent audit.
2. **Public release outstanding.** The published `0.1.0` set is
   immutable and does not contain this correction; a separate task will
   independently verify this implementation and determine the
   coordinated release version.
3. **Upstream Svelte keyed-each observation.** The keyed multi-node
   fragment reorder misbehavior (Svelte 5.57.0) is documented here and
   avoided by construction (unkeyed outer each); it is not fixed
   upstream from this repository. If a future renderer refactor restores
   keying on the group each, the reactive-permutation test (test 8) must
   stay green first.
4. **verify:stage5 scope note.** The Stage 05 aggregate re-runs the
   ladder steps (build, full suite, reference application suites
   including real-browser desktop/mobile and axe accessibility,
   scaffolder packed-tarball verification) on the corrected tree; it
   passed in full (§9 row 12) on this workstation.
5. **Pre-existing knowledge.** A prior full-suite run in this checkout
   (earlier task, pre-correction tree) observed one nondeterministic
   Stage 06 test failure that passed on a quiet isolated rerun; the
   corrected tree's own `npm test` for this task was first-run green
   (§9 row 6). No rerun was needed or performed for this correction.

## 13. GAP-CANDIDATE-2 disposition

```text
GAP-CANDIDATE-2 — IMPLEMENTED — INDEPENDENT VERIFICATION AND PUBLIC RELEASE PENDING
```

Trading OS T1 remains **blocked** until this correction is independently
verified AND available through a new immutable public VICT release. No
"verified" or "released" claim is made here.

**Exact remaining gate before Trading OS T1:** independent verification
of this implementation plus a coordinated new immutable public VICT
release containing it.
