# UI convergence slice r2 — reconciliation candidate + QA findings closed (2026-09-27)

Branch `pi/ui-convergence-r2` in worktree
`C:\Users\RZ1\Desktop\RZ\vict-02-ui-convergence`. Review candidate only:
no merge to `main`, no publication, no deprecation, no rubric amendment,
G3 remains HELD — stop for owner visual review.

## 1. Provenance

- Verified pushed tips before starting: `pi/ui-reconciliation-r1` @
  `b21296300eae2d9905b9e23c7a390fe55ee688ec` and
  `qa/ui-recon-verify-8141812` @
  `4133be7cc843e4fd97fec2a1e9255ae04f90e2b9` (both == `origin/*`).
- `a812678` — merge of the QA verification work into the repaired UI
  candidate. Textual merge clean (no overlapping files). Semantic audit:
  R1 changed no package manifests (publish-order re-derivation still
  linearizes the combined tree — re-verified by gates below); the QA
  reference-app test fixes were re-run against R1's component changes;
  the Surface.svelte type-only fix applies untouched.
  Preserved: the visual transition fix (`2f71ef8`), the reference-app
  corrections, the Surface.svelte type fix, the publishing-order
  re-derivation + draft §15, and both product proofs (coding-agent
  workspace + TaskLedger platform).
- `cc86869` — **QA FINDING-1 closed** (product, shared VICT code):
  `deriveUiPlan` derives the bound view's declared deterministic sort
  (`@2`) onto `UiTableIntent.initialSort` (defensive closed-vocabulary
  read); `TableAdapter` seeds the fresh-mount sort state AND every
  dispatched query (search, filter, pagination) with it until the user
  selects another sort; route-data resyncs restore the declared sort.
  A table bound to a view without a declared sort is unchanged.
  Proof: permanent renderer tests (red on pre-fix code, verified by
  stash round-trip) plus the real-browser re-proof below.
- `c17359e` — **QA FINDING-2 closed** (verification identity): the
  committed builder-kit stable layer regenerated over the combined
  workspace map per the kit's own freshness rule; identity changes
  recorded in `BUILDER-KIT-REGEN-UI-CONVERGENCE-2026-09-27.md`
  (packId `791f24fb…` → `bed2e5c2…`, 23 workspace manifests; capability
  catalog byte-identical; accepted-task-scope.json untouched; no frozen
  evidence document rewritten).

## 2. Gate matrix on the final tip `c17359e`

| Gate | Outcome |
| --- | --- |
| Root vitest, all projects (unit / mastra / renderer / integration) | **2621 passed \| 3 skipped (2624), 151 files — EXIT 0** |
| Renderer project (explicit re-run on the final content) | **all green — EXIT 0** |
| `check:ui` (svelte-check, packages/ui-svelte) | **0 errors, 0 warnings** |
| Full reference-app suite (own vitest; explicit re-run on final content) | **66/66, 6 files — EXIT 0** |
| ui-showcase suite incl. `agent-browser.test.ts` (real-browser coding-agent proof: failure transition, retry, draft retention, keyboard/drawer focus, overflow 1440/768/390/320, axe smoke) | **44/44, 8 files — EXIT 0**; agent-browser re-run alone on the final tip: **11/11** |
| `test:foundation` | **PASS — 10 browser checks** |
| `test:composition` | **PASS — 18 browser groups** |
| `test:catalog` | **PASS — 46 catalog browser checks** |
| `verify:stage5` (warning-free reference build + packed-consumer 11-tarball scaffold→install→build→negative probe) | **ALL CHECKS PASSED** |
| `verify:release-set` | **ALL CHECKS PASSED — 15 packages, 0.3.1, `v1_3a82c0651bb4b0d…`** (identity unchanged) |
| `verify:builder-kit` | **ALL CHECKS PASSED (18 checks)** |

Environment note: on the fresh worktree, 6 real-process unit tests failed
until `npm run build` populated `dist/` (child processes resolve built
packages); all 55 of the affected files' tests pass sequentially after the
build. Not a product regression. Running browser suites rewrites committed
`qa-artifacts` screenshots (recorded overwrite-hygiene deviation); the
screenshots were restored to the committed state.

## 3. TaskLedger external-consumer re-proof on this tip

Directory `C:\Users\RZ1\Desktop\RZ\vict-02-ui-convergence-proof-20260927`
(README + evidence-summary inside). Summary:

- 11 **unpublished candidate tarballs** packed from the tip
  (`tarball-sha256.txt`). They label themselves `0.3.1` but are NOT the
  published `0.3.1` packages — a future publication needs a new coherent
  version and owner authorization. Delta vs the pinned-candidate proof:
  8 byte-identical; `scaffolder`/`ui`/`ui-svelte` changed exactly by the
  documented findings-closure changes.
- Fresh scaffold via the packed scaffolder with an explicit release set:
  16 files, 15/16 byte-identical to the pinned candidate's scaffold, the
  single delta being R1's documented `onInvalidate` template one-liner.
- Author-owned authoring identical to both prior proofs:
  **14/14 immutable host files byte-identical**; only `definition.ts` /
  `registry.ts` edited and presentational `PriorityBadge.svelte` added.
- Real-browser checks (1280x800 and 390x844): **FINDING-1 closure live** —
  fresh mount with no user sort shows the declared sort active
  (`aria-sort=descending`, createdAt) and walks all pages with zero
  repeated and zero hidden rows (12/12) in declared desc order; server-side
  search on the fresh mount returns declared-ordered results; a user sort
  replaces the declared sort and pagination stays zero-overlap; governed
  row Complete at both widths with the declared feedback "The task was
  completed." and live open-count decrements (11→10→9); negative boundary
  probes all refused with the ledger content-identical before/after;
  full-restart persistence rows byte-identical and ledger identical
  (4 runs / 16 events / 1 activation); `applicationVersion
  v1_e42187a7…` identical to both prior proofs; zero phone overflow.

## 4. Package impact

- Published `0.3.1` packages on npm: UNTOUCHED and not republishable as-is.
- Candidate tarballs (unpublished): 8 of 11 byte-identical to the pinned
  candidate's; `ui` and `ui-svelte` carry the FINDING-1 fix (plus the
  already-merged QA/R1 changes for `ui-svelte`), `scaffolder` carries R1's
  template one-liner. Any future coordinated release must re-derive a new
  coherent version across the set with owner authorization; the frozen
  §14 publish order stays frozen until the draft §15 is ratified (the
  verifier continues to fail closed against it if publication is attempted
  without ratification).

## 5. Remaining limitations

- The visual-transition quality and the coding-agent demo aesthetics are
  the owner's call: **stop here for owner visual review** (`run.bat` starts
  the workspace demo at http://127.0.0.1:5181/agent).
- `verify:builder-kit`'s regenerated packId (`bed2e5c2…`) supersedes the
  stale one for CURRENT freshness only; historical evidence keeps the
  identities they were filed with (that is the point of the record).
- The reference-app's browser suites remain sensitive to
  screenshot-overwrite hygiene (running them rewrites committed PNGs);
  recorded, not fixed here.
- Real-process unit tests require a prior `npm run build` on fresh
  worktrees (6 contention/missing-dist failures observed pre-build; all
  green after). Windows file locks can transiently retain
  `.tmp-scaffold-check-*` test dirs.
- G3 disposition remains HELD pending owner ratification; nothing here is
  marked Verified; no G4 was started; the renderer-svelte facade is not
  deprecated; `main` is untouched.
