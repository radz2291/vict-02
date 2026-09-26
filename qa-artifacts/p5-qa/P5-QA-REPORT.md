# P5 — Independent Architectural-Closure QA Report

**Branch under verification:** `pi/ui-foundation-p5`
**Base SHA (confirmed):** `8c21d5f71d7bdd88954c79589efaff59ffa099f3` — `arch(ui)!: move permanent Svelte renderer into @victframework/ui-svelte; renderer-svelte becomes compatibility facade` (local `pi/ui-foundation-p5` == SHA; parent `cc132c6` = P4 QA tip)
**QA branch:** `qa/ui-foundation-p5` (worktree `vict-02-qa-ui-p5`), created at exactly the base SHA
**Final QA SHA:** see git log of `qa/ui-foundation-p5` (base + this report + one bounded packaging fix)
**Untouched:** `main`, Stage 8 branches/worktrees, `pi/ui-foundation-p5` and all `codex/*` implementation branches, all prior `qa/*` branches and their worktrees.

---

## Verdict

**P5 ARCHITECTURE VERIFIED — release integration permitted.**

One bounded packaging fix was applied on the QA branch (declaring an existing type-level dependency that the package move dropped). No renderer behavior, contract, identity, or presentation was changed. Release governance (trusted-publishing contract, release inventory, release order, compatibility record, workflows, trust bootstrap) was not modified; the only release-set failures remain the known frozen 13→15 inventory assertions.

---

## 1. Ownership proof — `renderer-svelte` is a pure facade; `ui-svelte` is the one implementation

- `packages/renderer-svelte/src` contains **exactly two files**:
  - `index.ts` — a compatibility module whose **every export is a re-export** from `@victframework/ui-svelte` (verified: no `export function` / `export class` / `export const` of its own; asserted permanently by `compat.test.ts`).
  - `theme.css` — one comment + `@import '@victframework/ui-svelte/styles.css';` and nothing else (asserted by `compat.test.ts`).
- No independent copy remains of: VitApp (`src/VitApp.svelte` only in ui-svelte), surface traversal (`Surface.svelte`), table/form/overlay adapters (`TableAdapter.svelte`, `FormSurface.svelte`, `OverlaySurface.svelte`), route logic (`logic.ts`), form-value conversion (`form-values.ts`), presentation normalization (`presentation.ts`), mount/update machinery (`mount.svelte.ts`), renderer factory/constants (`renderer.ts`), presentation CSS (`styles.css`) — all exist **only** in `packages/ui-svelte/src`. `createVictRenderer`'s body moved byte-equivalently (same validation-then-mount structure, same constants).
- **Same runtime bindings, not wrappers** (proven three independent ways):
  1. Source: the facade contains only re-export statements.
  2. In-workspace DOM test (`compat.test.ts`): `expect(createVictRenderer).toBe(directCreateVictRenderer)`, same for `renderVictApplication`, `VitApp`, `RENDERER_ID`, `RENDERER_REVISION` — module-identity checks.
  3. Packed, workspace-free browser runtime (compat consumer imports BOTH packages): `compatNS.createVictRenderer === directNS.createVictRenderer`, same for `renderVictApplication` / `VitApp` / identity constants — all `true` in real Chrome (see §4 evidence).

Checked bindings: `createVictRenderer`, `renderVictApplication`, `VitApp`, renderer identity (`RENDERER_ID`/`RENDERER_REVISION`), supported roles (`BUILT_IN_ROLES`, all 15 roles) — plus `resolveRoute`, `matchPath`, `themeVariables`, `validatePlanForRenderer`, `collectSurfaces`, `RendererDiagnostic` and all 6 exported types. All are the same bindings.

## 2. Dependency audit — cycle-free

Manifests (0.3.1 line):
- `@victframework/ui` — **no dependencies at all** (no Svelte, no ui-svelte).
- `@victframework/application` — `contracts`, `sdk` only (no Svelte, no renderer packages).
- `@victframework/ui-svelte` — `@victframework/application`, `@victframework/ui` (allowed), `svelte` peer.
- `@victframework/renderer-svelte` — `@victframework/ui-svelte` only, `svelte` peer.

Source-import scan (all `.ts`/`.svelte` under `src/` and `test/`):
- `ui` and `application` sources: zero `svelte` / `ui-svelte` / `renderer-svelte` references (only prose comments mention Svelte).
- `ui-svelte` sources import only `@victframework/application`, `@victframework/ui`, and (type-only, see §Fix) `@victframework/sdk`; the single `renderer-svelte` string in `ui-svelte/src` is a **comment** (`index.ts` line 20), not an import. No hidden back-reference exists.
- `renderer-svelte` sources import only `@victframework/ui-svelte`.

Graph: `ui ← ui-svelte → application → {contracts, sdk}`; `ui-svelte ← renderer-svelte`. **No cycles.**

## 3. Full behavioral regression — through the DIRECT ui-svelte path

The established P4 real-browser matrix was re-run against a direct-path harness (`qa-artifacts/p5-qa/harness`, the P4 harness with `VitApp` imported from `@victframework/ui-svelte` and `styles.css`; plan compiled by the real SDK compiler):

**`qa-harness-direct.mjs`: 76/76 checks PASS** (headless Chrome, port 5201; `harness-direct-results.txt`, `shots-harness/`, `harness-results.json`):

- text/heading closed vocabulary h1–h6 + unleveled `p`; markup-looking content renders as escaped text (XSS canaries silent); 320px wrap/containment
- read-only DataView: header/cell correspondence, empty state, contained horizontal scroll at 1280/430/380/320, keyboard scrollability
- list (plain/secondary/empty), detail (rows/empty/long unbroken JSON)
- charts: bar/line geometry, empty/one-point/many-point cases, named-SVG accessible alternative, data-table correspondence, no label clipping
- conversation: send → trimmed dispatch (dispatch log + `window.__dispatchLog` evidence), in-flight disabled/aria-busy, draft clearing vs. held-draft race, denied state (`role=alert`), thrown-action safe failure (`PRIVATE-CANARY` never in DOM), refetch invalidation, composer focus, 320px
- custom-component slot: resolvable island receives string/number/boolean props UNCHANGED; unresolvable `cmp.ghost` produces the structured failure panel (never a crash, never a raw error)
- cross-role nesting: detail in tabs, conversation+list in drawer (send + refetch through the boundary), island/list/empty-view/empty-chart in dialog, nested dialogs
- **zero axe-core violations** on every scanned screen at desktop and phone widths; **zero uncaught page errors** across the whole run

Browser-level coverage beyond the harness (established suites re-run in this tree):
- redirects, route parameters, plan validation, theme tokens, unsupported-role honesty, unknown-component diagnostics, hostile-action canary safety (deep error-surface scan), shared Stage 05 renderer conformance, table local vs. server queries, **stale-response protection ("last-issued wins")**, sort/pagination, nested dialogs, status tone, reactive path/plan/viewData/registry changes without remount, idempotent unmount — exercised in the `renderer` vitest project (happy-dom + real Svelte 5 compiler): **70/70 PASS** (`packages/ui-svelte/test` 63 + `packages/renderer-svelte/test/compat.test.ts` 7).
- Full workspace suite: **2500 passed / 2 failed / 3 skipped** — the only failures are the two known `trusted-publishing.test.mjs` frozen 13-package inventory assertions (see §10).

## 4. Direct vs compatibility packed consumers (outside workspace resolution)

Six 0.3.1 packages packed from this exact QA tree (`qa-artifacts/p5-qa/packed/`, committed): contracts, sdk, application, ui, ui-svelte, renderer-svelte.

Two consumers installed via `npm install` from the tarballs into a fresh temp dir **outside the repository** (no workspace resolution possible):
- **consumer-direct**: imports `VitApp` from `@victframework/ui-svelte` + `@victframework/ui-svelte/styles.css`
- **consumer-compat**: imports `VitApp` from `@victframework/renderer-svelte` + `@victframework/renderer-svelte/theme.css`

**`qa-consumer-p5.mjs`: 45/45 checks PASS for both variants** (`consumer-p5-results.txt`, `consumer-results.json`, screenshots in `shots-consumer-{direct,compat}/`):

- clean install; installed versions exactly 0.3.1; lockfile has NO `workspace:`/`link:` specs, NO monorepo paths (`vict-02` absent), `file:` only as the packed-tarball specifiers
- `vite build` succeeds per variant; **built bundle contains EXACTLY ONE renderer implementation** (`renderer.svelte-kit` identity string ×1, `vict-host` marker ×1 across all emitted JS) through BOTH entry paths — no second implementation is bundled
- real-Chrome runtime per variant: mount; frozen identity (`renderer.svelte-kit@5.0.0`, 15 roles); heading tags + escaped text; DataView correspondence; list/detail/empty; bar/line/empty charts + a11y fix present in packed CSS; conversation send→trim→refetch→clear; island props unchanged; route + data updates propagate **without remount** (tagged host node survives navigations); 320px contained scroll, zero document overflow; no page errors
- compat variant additionally proves **binding identity in the installed tree**: facade exports `===` direct exports for `createVictRenderer` / `renderVictApplication` / `VitApp` / identity constants
- emitted CSS identical markers per variant; every signature selector defined exactly once (no duplicate style implementation)

## 5. TypeScript / package-export verification (investigated, not assumed)

`@victframework/ui-svelte` builds `dist` declarations (`tsc --emitDeclarationOnly`) but its manifest exposes types via `exports["."].types = "./src/index.ts"` (and top-level `types` likewise). Tested with a clean packed **TypeScript + Svelte 5 consumer** (`vict-02-p5qa-tsconsumer`, outside the repo, no monorepo aliases, no path overrides; tsconfig `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, **`skipLibCheck: false`**):

Imports exercised exactly as published: `createVictRenderer` (assigned to the neutral `ApplicationRenderer` type), `RENDERER_ID`/`RENDERER_REVISION`, `VitApp`, `renderVictApplication` (+ `MountedVictApplication`/`RenderVictApplicationOptions`), renderer helpers `resolveRoute`/`matchPath`/`themeVariables`/`validatePlanForRenderer`/`collectSurfaces`/`BUILT_IN_ROLES`/`RendererDiagnostic`, all exported types (`ActionResult`, `ResolvedRoute`, `VictPlanView`, `ViewDatum`), presentation components (`StatusBadge`, `RecordsTable`), **and the same types through the legacy facade** (`@victframework/renderer-svelte`, whose `exports["."].types → ./dist/index.d.ts` chain resolves into ui-svelte's type surface; facade type-level compat assignment proven).

Results with the package exactly as published:
- `tsc --noEmit` strict: **EXIT 0**
- `vite build` (TS entry mounting VitApp against a compiled plan): **EXIT 0**
- real-browser runtime of the built TS consumer: **4/4 PASS** (mount, declared heading level, viewData-resolved list, no page errors)

Variant-B simulation (copied the packed package, switched `types` to `./dist/index.d.ts`): strict typecheck ALSO passes — Svelte 5 ships ambient `*.svelte` module declarations, so the `.svelte` references inside `dist/index.d.ts` (a directory that contains no `.svelte` files) are wildcard-matched rather than resolved.

**Determination: (A) source-based type exports are intentional and robust for this package.**
- The package's RUNTIME is its source (`exports["."].svelte/default → ./src/index.ts`, compiled by the consumer's vite+svelte toolchain). Pointing types at `src` guarantees types and runtime come from the same files — zero skew.
- Variant B would add a second, generated artifact to keep in sync, degrade Svelte component typing (dist has no `.svelte` sources for svelte2tsx-based tooling, everything becomes the `Component<Record<string, unknown>>` shim), and buy nothing — both variants pass strict typecheck.
- The facade's dist-based type chain (renderer-svelte `types → ./dist/index.d.ts`, which contains only re-exports) is verified working in the same strict consumer.
- The built `dist/` remains in place as the release-contract build artifact; only the manifest type pointer question was at issue, and the as-published state is correct.

Minor observation (no action): renderer-svelte's top-level `types: "./src/index.ts"` differs textually from its `exports["."].types: "./dist/index.d.ts"`; every modern resolver uses the exports map (proven), both resolve correctly, and the facade's src pointer is equally valid for a re-export-only module.

## 6. Public API compatibility — pre-P5 vs facade

Pre-P5 `renderer-svelte` public root (runtime): `RendererDiagnostic`, `resolveRoute`, `matchPath`, `themeVariables`, `validatePlanForRenderer`, `collectSurfaces`, `BUILT_IN_ROLES`, `renderVictApplication`, `VitApp`, `RENDERER_ID`, `RENDERER_REVISION`, `createVictRenderer`; types: `VictPlanView`, `ResolvedRoute`, `ActionResult`, `ViewDatum`, `MountedVictApplication`, `RenderVictApplicationOptions`.
The facade re-exports **all 12 runtime bindings and all 6 types** — nothing lost, nothing renamed. (`ApplicationPlan`/`ApplicationRenderer`/`RenderedApplication`/`RendererBindings` were import-only in the old index, never re-exported; the facade correctly does not enlarge the API.)
Pre-P5 `ui-svelte` public root (16 presentation components + `styles.css`) is fully preserved; the renderer surface was **added** to it. Both manifests' `exports` maps keep `.` and the stylesheet entry points; `theme.css` and `styles.css` continue to exist at the same specifiers.

## 7. Renderer identity

`RENDERER_ID = 'renderer.svelte-kit'`, `RENDERER_REVISION = '5.0.0'` — defined exactly once (`ui-svelte/src/renderer.ts`), re-exported unchanged by the facade. Verified frozen in: the compat suite, both packed consumers (in-page, both paths), the TS consumer (`renderer.id`/`revision` assignment to `ApplicationRenderer`), and the reference-app definition suite (`renderer: { id, revision }` release record assertions, 62/62). `git diff cc132c6 HEAD -- examples/reference-app/src/lib/application/release.ts packages/application/src/renderer.ts` is **empty** — identity consumers are unchanged solely because implementation ownership moved. Identity NOT changed.

## 8. Reference app and scaffolder (deprecation-window consumers)

- **Reference app** (intentionally still on the facade: `createVictRenderer`/`RENDERER_ID`/`RENDERER_REVISION` in `release.ts`, `VitApp` + `theme.css` in `[...vict]/+page.svelte`, server renderer imports): `npm run build` (svelte-kit sync + vite + adapter-node) **EXIT 0**; full test suite **62/62 PASS** (real-Chrome browser suite with axe scans, SSR/dom/http/definition/metrics/reading-time).
- **Scaffolder template**: generated via `packages/scaffolder/dist/cli.js` into a clean outside-repo dir, installed from packed tarballs (all ten internal deps mapped to file: tarballs, `--legacy-peer-deps` per the documented npm-10.9.2 arborist workaround), `npm run build` (svelte-kit sync + vite + adapter-node) **EXIT 0**. The generated host's `src/routes/[...vict]/+page.svelte` retains the legacy `@victframework/renderer-svelte` / `theme.css` imports and builds and functions through the facade. (The template generates no test files — pre-existing template behavior, unchanged; not migrated, per deprecation-window scope.)

## 9. Test ownership

- The five implementation suites (`renderer.test.ts`, `form-values.test.ts`, `heading-levels.test.ts`, `navigation-group-order.test.ts`, `surface-p4.test.ts` + `fixtures.ts`) moved verbatim into `packages/ui-svelte/test/` and now import `@victframework/ui-svelte` directly (zero `renderer-svelte` imports in ui-svelte tests).
- `packages/renderer-svelte/test/` retains exactly ONE focused suite: `compat.test.ts` (7 tests) — identity preservation, binding identity, canonical renderer, render equivalence, reactive update, theme.css purity, no-own-implementation guard. No duplicated suites.
- Note (intentional, not a defect): `compat.test.ts` reuses `../../ui-svelte/test/fixtures.ts` — the correct choice vs. duplicating fixtures; it does mean the facade test tree references the implementation's fixture module, which is acceptable for a facade whose entire purpose is equivalence with that implementation.

## 10. Release tests

Full workspace vitest in this tree: the ONLY release-attributable failures are the two known `scripts/test/trusted-publishing.test.mjs` assertions (`derives exactly the frozen 13-package set…`, `validates the frozen order…`) — reproduced identically at the pristine base SHA (documented in the P5 implementation proof) and failing for exactly the five expected inventory problems (ui / ui-svelte not in the frozen 13; count 15≠13; renderer-svelte→ui-svelte; ui-svelte→ui edges). `deriveReleaseInventory` re-run after the QA fix returns the **same 5 problems** — the fix adds none. No trusted-publishing contract, release inventory, release order, release compatibility record, workflow, or trust-bootstrap file was modified by this QA pass (`git diff` below touches none of them).

## Bounded QA fix applied (one)

**D1 — ui-svelte phantom type dependency (`packages/ui-svelte/package.json`).** P5 moved `logic.ts` — which opens with `import type { SurfaceRole } from '@victframework/sdk'` — from renderer-svelte (whose manifest declared `@victframework/sdk: 0.3.1`) into ui-svelte **without carrying the dependency declaration**. Both `src/logic.ts` and the generated `dist/logic.d.ts` reference `@victframework/sdk`, so the published package's type surface requires it; it resolves today only via hoisting (sdk is application's dependency). Fix: declare `"@victframework/sdk": "0.3.1"` in ui-svelte `dependencies` (+ 1-line `package-lock.json` sync). This is pure package/type metadata — no runtime graph change (type-only import), no contract/identity/presentation impact, no new inventory problems, and it restores parity with the pre-move manifest. Re-verified after the fix: renderer project 70/70, root typecheck EXIT 0, inventory problems unchanged (5), and the strict packed TS consumer re-installed from the re-packed fixed tarball (typecheck/build/runtime all green).

No other defect met the fix bar. Nothing was found that would alter `vict.application@2`, the ApplicationRenderer contract, renderer identity, application authority, or the neutral UI architecture — no escalation required.

## Remaining warnings (carried; none introduced by P5)

1. **Chart geometry** (documented in P4, escalated to owner): negative/zero values clamp to baseline nubs; approximate y-axis tick labels; dense-label overlap at 12+ points. Unchanged by P5; the accessible data table always carries exact values.
2. **Reference-app suite cold self-build**: `npx vite build` without a prior `svelte-kit sync` fails on a fully cold tree (Windows); the package script path used here is green. Pre-existing tooling nuance.
3. **Trusted-publishing 2 assertion failures** are expected until P6 performs the release-set 13→15 expansion (including ui, ui-svelte and the facade edge in the frozen order/inventory).
4. Windows npm invocation nuance: `npm.cmd`/piped-spawned npm can fail with "stdout is not a tty"; drivers use `npm-cli.js` via node (documented in QA4, reused here).
5. Facade `compat.test.ts` imports the implementation package's test fixtures (see §9) — intentional equivalence testing, noted for transparency.

## Governance confirmation

This QA pass created `qa/ui-foundation-p5` and modified ONLY: `packages/ui-svelte/package.json` (+1 dependency line), `package-lock.json` (+1 line), and `qa-artifacts/p5-qa/**` (evidence). Trusted-publishing contract, release inventory, release order, release compatibility record, workflows, and trust bootstrap are untouched. No publication or release action was performed.

## Evidence index (`qa-artifacts/p5-qa/`)

- `harness/` — direct-path browser harness (VitApp imported from `@victframework/ui-svelte`), plan compiled by the real SDK compiler
- `qa-harness-direct.mjs` → 76/76 (`harness-direct-results.txt`, `harness-results.json`, `shots-harness/`)
- `consumer-direct/`, `consumer-compat/` — packed consumers (direct and compat entry paths, identity probes in `src/App.svelte`)
- `qa-consumer-p5.mjs` → 45/45 (`consumer-p5-results.txt`, `consumer-results.json`, `shots-consumer-*/`)
- `packed/` — the exact 0.3.1 tarballs (11 incl. scaffolder-set extras) installed by the consumer proofs
- `vitest-p5qa-full.log` — full workspace suite (2500/2/3)
- TS consumer evidence: external dir `vict-02-p5qa-tsconsumer` (strict consumer: typecheck EXIT 0, build EXIT 0, runtime 4/4, variant-B simulation EXIT 0)
- Scaffolder evidence: external dir `vict-02-p5qa-scaffold/GeneratedApp` (generated → packed install → build EXIT 0)
