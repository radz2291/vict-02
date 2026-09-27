# UI compatibility-facade retirement — `renderer-svelte` removed from the candidate set (2026-09-27)

Branch `pi/ui-facade-retirement-r1` in worktree
`C:\Users\RZ1\Desktop\RZ\vict-02-ui-facade-retirement`, based on the
verified authoring-tools tip `pi/ui-authoring-tools-r1` @
`bd8f580f4e9dd02949e1bf6c91e4fbba0037737e` (pushed SHA verified == `origin`
before starting). Review candidate only: nothing merged to `main`, nothing
published, nothing deprecated on npm, the frozen trusted-publishing
contract file is untouched (the consolidated amendment is a DRAFT, §16,
awaiting owner ratification), the frozen Stage 8 proof is untouched, G3
remains HELD — stop for owner review.

## 1. What was done

`@victframework/ui-svelte` is now the sole Svelte renderer package in the
next candidate release set. The local `@victframework/renderer-svelte`
compatibility-facade package is REMOVED from the workspace and from the
candidate package inventory, and every current workspace consumer was
migrated to public `ui-svelte` imports. The already published `0.3.1`
packages — including `renderer-svelte@0.3.1` — and all historical evidence
are preserved untouched.

### Inventory: live references migrated (current code)

| Location | Before | After |
| --- | --- | --- |
| `packages/renderer-svelte/` | facade package (pure re-export of `ui-svelte`) | **REMOVED** (git rm; 5 files) |
| `examples/reference-app/package.json` | dep `@victframework/renderer-svelte` | dep `@victframework/ui-svelte` (0.3.1) |
| `examples/reference-app` `release.ts` / `application-server.ts` / `test/*.test.ts` | imports from the facade | same imports from `@victframework/ui-svelte` |
| `examples/reference-app` `[...vict]/+page.svelte` | `VitApp` + `theme.css` from the facade | `VitApp` from `ui-svelte` + `@victframework/ui-svelte/styles.css` |
| `examples/ui-showcase/package.json` + `vitest.config.ts` | facade dep + alias | removed (src already imported ui-svelte directly, 81 call sites) |
| root `package.json` / `tsconfig.json` / `vitest.config.ts` | facade build step / alias / facade test project + alias | removed (renderer vitest project = `packages/ui-svelte` only) |
| `packages/scaffolder/src/index.ts` | `REQUIRED_PLATFORM_PACKAGES` + generated host imports + README template name the facade | `ui-svelte` required; generated host imports `ui-svelte` (`VitApp`, `ActionResult`, `styles.css`, server renderer imports); template one-liner for the style entry point |
| `packages/scaffolder/src/cli.ts`, `test/scaffolder.test.ts` | facade in doc + release-set fixture | `ui-svelte` |
| `scripts/lib/release-set.mjs` | 15-member inventory/order | **14-member** inventory + order (§16 draft), fail-closed derivation unchanged |
| `scripts/check-release-set.mjs`, `publish-release.mjs`, `verify-release-consumer.mjs`, `verify-stage5.mjs`, `verify-stage6a.mjs`, `ui-{foundation,composition,workspace}.mjs`, `trust-bootstrap.mjs`, `oidc-release.mjs` | 15-member lists / facade probes / facade wording | 14-member lists; the facade/direct identity probe replaced by a former-facade SURFACE-COMPLETENESS probe (all 18 former facade export names + frozen identity must exist directly on the installed `ui-svelte`); "retired facade absent from the installed consumer tree" check |
| `scripts/test/trusted-publishing.test.mjs`, `scripts/test/release-evidence.test.mjs` | 15-member/position assertions + `v1_3a82c065…` identity coupling | 14-member assertions + new identity coupling (historical BOUND candidate assertions untouched) |
| `.github/workflows/release.yml` | "15-package" wording + input description | "14-package" wording + descriptions (enforcement is dynamic via `scripts/oidc-release.mjs` → `lib/release-set.mjs`) |
| `docs/RELEASE-COMPATIBILITY.md` | §2 prepared record = 15 members `v1_3a82c065…` | §2 prepared record = **14 members, contentId `v1_e31858f1ba93a4336524d52886c3c72f85fda4b4237457bccfad2235d0e1555d`** + supersession provenance; §3 graph/order; §4; §5; §6; §8 updated. §2.1 lineage entries UNTOUCHED |
| `package-lock.json` | workspace link + example deps for the facade | clean (0 references) |

### The `theme.css` compatibility path

The facade's `./theme.css` was itself a compatibility entry point whose
only content was `@import '@victframework/ui-svelte/styles.css'` (proven
by the P5 QA evidence). The migration moves consumers one level deeper,
to the single production style source:

```diff
- import '@victframework/renderer-svelte/theme.css';
+ import '@victframework/ui-svelte/styles.css';
```

Applied in: the reference app's host page, the scaffolder's generated
`[...vict]/+page.svelte` template (hence every future scaffold), and
documented below for external consumers.

### Former-facade public exports proven directly on `ui-svelte`

The retired facade re-exported exactly 18 public values and 8 public
types. The packed-consumer gate now asserts — inside an ISOLATED consumer
installed from the actual candidate tarballs — that every one of those
names exists directly on `@victframework/ui-svelte` with the frozen
identity (`renderer.svelte-kit` / `5.0.0`):
`BUILT_IN_ROLES, RendererDiagnostic, RENDERER_ID, RENDERER_REVISION,
VitApp, collectSurfaces, createVictRenderer, declaredSurfaceViewIds,
isComponentSource, matchPath, renderVictApplication,
resolveComponentActionInput, resolveComponentProps, resolveComponentSource,
resolveRoute, substitutePathParams, themeVariables,
validatePlanForRenderer` + types `ActionResult, ComponentSourceBinding,
ComponentSourceContext, MountedVictApplication,
RenderVictApplicationOptions, ResolvedRoute, VictPlanView, ViewDatum`
(types exercised by the consumer's strict typecheck).

### Deliberately NOT changed (historical records, non-consumers)

- `docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md` — FROZEN; the amendment
  rule requires the owner's ratification of the §16 draft first.
- `docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT-AMENDMENT-DRAFT-2026-09-27.md`
  (§15 draft) — filed, unratified draft; left untouched; superseded by the
  consolidated §16 draft (which explicitly does not ratify it).
- `scripts/lib/evidence-rules.mjs` — the evidence ladder's BOUND 13-member
  candidate (incl. `renderer-svelte` in its historical order); the ladder
  keeps verifying the historical candidate against its OWN recorded set.
- `.github/workflows/release-evidence.yml`, `qa-artifacts/p5-*`,
  `docs/report/*`, `docs/handoff/*`, prior slice reports, and the Stage 5
  records in `docs/VICT-SYSTEM-REFERENCE.md` — historical verification
  records (the reference document's package-table rows describing the
  Stage 5 verification of the renderer are historical statements; a
  reference-document update with its own version bump can follow owner
  ratification).
- `examples/ui-showcase` `agent-data.ts`/`data.ts` — the coding-agent
  demo's seed transcripts narrate this repository's own past slices
  (including the shell-move conversation that produced the facade); they
  are historical narrative inside the demo, not imports or dependencies.
- `packages/runtime/src/control-conformance.ts` `rendererIdentity:
  'renderer-svelte@1'` — a synthetic control-plane fixture string (no
  import, no dependency, arbitrary identity value in a test fixture).

## 2. Renderer semantic identity decision

The renderer's semantic identity and revision are UNCHANGED:
`RENDERER_ID = 'renderer.svelte-kit'`, `RENDERER_REVISION = '5.0.0'`
(asserted in the packed-consumer gate and by the surviving ui-svelte
suites). Justification: this slice performs NO renderer-contract change —
the facade was a pure re-export layer with no independent implementation
since P5, so removing it changes packaging/imports only, not renderer
behavior, identity, revision, or plan semantics. The compiled plan
`applicationVersion` for the identical TaskLedger authoring is unchanged
across all four proofs (`v1_e42187a7…`), which is the strongest possible
confirmation that nothing in the renderer contract moved.

## 3. Release-set identity changes

| | Members | Version | ContentId |
| --- | --- | --- | --- |
| §14 prepared record (superseded, never published) | 15 | 0.3.1 | `v1_3a82c065…` |
| **This candidate (live prepared record)** | **14** | 0.3.1 | **`v1_e31858f1ba93a4336524d52886c3c72f85fda4b4237457bccfad2235d0e1555d`** |
| BOUND historical evidence candidate (frozen) | 13 | 0.3.1 | `v1_1c695280…` |

- Candidate dependency order (14, machine-validated topological): `contracts → ui → sdk → kernel → runtime → store-sqlite → application → ui-svelte → appdata-sqlite → scaffolder → control → mastra → server → cli` — the §15 order minus position 9 (`renderer-svelte`), one deletion, no reordering (the facade was a dependency-graph sink: nothing depended on it).
- Compatibility impact: none for consumers pinned to published versions (the published facade and all prior versions remain on npm untouched, never unpublished or deprecated; the facade re-exported ui-svelte's bindings, so facade consumers keep working). For consumers moving FORWARD, the migration is mechanical (§4). Any future publication requires a NEW coherent version (13 members of the `0.3.1` line are already published and immutable) and the authorized final release contract — the frozen contract text is intentionally ahead of (15-member) this candidate until the §16 draft is ratified, and the verifier continues to fail closed against publication without ratification.

## 4. Migration guide (existing consumers)

1. **Dependencies** — remove `@victframework/renderer-svelte` and add
   `@victframework/ui-svelte` at the same exact version
   (`npm uninstall @victframework/renderer-svelte && npm install
   @victframework/ui-svelte@<same-version>`). The facade was a pure
   re-export; `ui-svelte` carries the full public surface (see §2's export
   list, proven by the packed-consumer gate).
2. **JS/TS imports** — replace every
   `from '@victframework/renderer-svelte'` with
   `from '@victframework/ui-svelte'` (named values and types have the same
   names). The migrated reference-app files are concrete examples:
   `release.ts` (`createVictRenderer, RENDERER_ID, RENDERER_REVISION`),
   `application-server.ts` (`collectSurfaces, resolveRoute, ViewDatum,
   VictPlanView`), host page (`VitApp, ActionResult`), tests
   (`renderVictApplication, MountedVictApplication`).
3. **Styles** — replace `import '@victframework/renderer-svelte/theme.css'`
   with `import '@victframework/ui-svelte/styles.css'` (the facade's
   `theme.css` was exactly this compatibility import; `styles.css` is the
   one production style source).
4. **Scaffolder release sets** — explicit release sets must now name
   `@victframework/ui-svelte` (the scaffolder refuses a set without it and
   no longer accepts a facade-only set). Generated hosts already import
   `ui-svelte`; rerunning the one-time scaffolder is not required or
   supported — hand-migrate the two import lines above in existing hosts.
5. **Bundlers/aliases** — drop any
   `@victframework/renderer-svelte` alias or resolution override
   (root/showcase vitest aliases and the tsconfig path were removed in
   this branch as the reference pattern).

A clean new app never needs the facade: the packed-consumer gate proves
the generated host installs, builds, and runs from the 10-tarball
candidate closure with zero facade references.

## 4. Builder-kit stable layer

Regenerated per the kit's freshness rule after the workspace membership
change; recorded in
`docs/BUILDER-KIT-REGEN-UI-FACADE-RETIREMENT-2026-09-27.md` (packId
`f5a691a1…` → `a4e5668a…`, workspace map 23 → 22 manifests, capability
catalog byte-identical, second generation byte-identical,
`verify:builder-kit` 18/18).

## 5. Gate matrix on this branch

| Gate | Outcome |
| --- | --- |
| Full build (14 publishable + workspace packages) | EXIT 0 |
| Root vitest (all projects) | **2651 passed \| 3 skipped (2654), 154 files — EXIT 0** (the removed facade's 7-test suite accounts for the delta vs the base tip's 2658) |
| `check:ui` (svelte-check) | **0 errors, 0 warnings** |
| typecheck / lint / format | **ZERO delta vs the base tip** (typecheck: the same 11 pre-existing base error lines, byte-identical output; lint: the same 2 pre-existing findings; format: the same 23 pre-existing drifted files — all inherited from the authoring-tools tip, unchanged by this slice) |
| Reference-app suite | **66/66, 6 files — EXIT 0** |
| ui-showcase suite (incl. `agent-browser.test.ts` — coding-agent real-browser proof: failure transition, retry, draft retention, keyboard/drawer focus, overflow 1440/768/390/320, axe smoke) | **44/44, 8 files — EXIT 0** |
| `test:foundation` | **PASS — 10 browser checks** |
| `test:composition` | **PASS — 18 browser groups** |
| `test:catalog` | **PASS — 46 catalog browser checks** |
| `verify:release-set` | **ALL CHECKS PASSED — 14 packages, 0.3.1, `v1_e31858f1…`** (fail-closed on the final graph) |
| `verify:release-consumer` (14 packed tarballs → isolated install → strict typecheck → runtime + renderer composition → former-facade surface completeness → facade-absence) | **ALL CHECKS PASSED** |
| `verify:stage5` (packed scaffolder → isolated install → generated-host build → emitted-compiler negative probe; includes the reference-app suite) | **ALL CHECKS PASSED** |
| `verify:builder-kit` | **ALL CHECKS PASSED (18 checks)** |

Environment notes (unchanged from prior slices): real-process tests need a
prior `npm run build` on fresh worktrees; running browser suites rewrites
committed `qa-artifacts` screenshots (restored to the committed state;
recorded overwrite-hygiene deviation).

## 6. External-consumer proof (TaskLedger, tarballs only)

Directory `C:\Users\RZ1\Desktop\RZ\vict-02-ui-facade-retirement-proof-20260927`
(README + `evidence-summary.json` inside). Highlights:

- 10 **unpublished candidate tarballs** (no facade); scaffold via the
  packed scaffolder with the 10-tarball release set: 16 files, generated
  host imports `ui-svelte` directly, **0 facade references**, no facade
  tarball in the consumer tree.
- Author-owned authoring identical to all three prior proofs:
  **14/14 immutable host files byte-identical**; only `definition.ts` /
  `registry.ts` edited and presentational `PriorityBadge.svelte` added
  (the badge remains the only custom Svelte product component).
- Real-browser checks (1280x800 and 390x844): declared-sort pagination
  12/12 zero-overlap, server-side search, user-sort pagination
  zero-overlap, governed row Complete with the declared feedback "The
  task was completed." and live count/chart refresh (12→11 laptop,
  11→10 phone, chart 09-28 qty 1→2), badge palettes (3 distinct computed
  palettes), negative boundary probes all refused before any run
  (UNKNOWN_ACTION / CONTRACT_REJECTED ×3 / UNSUPPORTED_ACTION /
  INVALID_REQUEST; ledger proven content-identical across the probe
  battery), idempotent re-Complete observed and recorded; full-restart
  persistence byte-identical (12 rows, 5 runs / 20 events / 1 activation);
  post-restart flow live at both counts; `applicationVersion
  v1_e42187a7…` identical to BOTH prior proofs; zero phone overflow
  (375 ≤ 390).

## 7. Remaining limitations / owner-review items

- **The consolidated §16 amendment is a DRAFT** awaiting owner
  ratification (`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT-AMENDMENT-DRAFT-2026-09-27-FACADE-RETIREMENT.md`);
  it supersedes the unratified §15 draft without ratifying it. Until
  ratified, the frozen contract's §5 text (15 members) and the tooling
  (14 members) disagree BY DESIGN and any release action fails closed.
- A future publication requires a NEW coherent version and the authorized
  final release contract (13 members of the `0.3.1` version line are
  published and immutable).
- The §15 draft's trust-ceremony history and all frozen records are
  untouched; the published facade remains installable by exact pin.
- G3 remains HELD; nothing here is marked Verified; no merge to `main`;
  no publication; no deprecation.
- Root typecheck/lint/format carry the authoring-tools tip's pre-existing
  findings unchanged (zero delta introduced here) — flagged for the
  owner; they are outside this slice's scope.
- The `docs/VICT-SYSTEM-REFERENCE.md` current-truth rows still describe
  the Stage 5 renderer under its historical package name; a reference
  update with its own version bump can follow ratification.