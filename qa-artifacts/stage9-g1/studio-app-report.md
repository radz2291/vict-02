# BUILDER REPORT — studio-app (VICT Stage 09 G1)

- Branch: `codex/stage9-g1-studio-app`
- Base: `fd2f57d1acd7b5ae1c1b869f5be2268153b0cfde`
- Candidate SHA: `534ac8aef19a8b4305c21ef4f41c4d31368aa675` (verified on `origin` via `git ls-remote`)
- Status: BUILDER CANDIDATE — facts only; an independent verifier supplies the gate verdict.

## Deliverables landed
1. `apps/studio/src/lib/application/definition.ts` (+ `index.ts` re-export): real
   `vict.application@2` definition `app.vict-studio@1`. 9 resources verbatim per
   `RESOURCE_BINDINGS` (identity fields, exact safe field lists), list queries
   (pagination true for runs/activations), detail queries where `getPath` exists,
   authorization `read` / `['studio.operator.read']`, EMPTY `mutations` on every
   resource, `actions: []`, no forms. Ten views with safe projections. Six routes
   exactly: `/`, `/runs`, `/runs/:runId`, `/activations`, `/releases`, `/audit`.
   Nav groups Target/Operations/Governance; breadcrumbs on sub-screens;
   loading/empty/failure states everywhere. `compileStudioPlan()` compiles via
   `compileApplication` (signature preserved).
2. `apps/studio/src/lib/components/registry.ts`: real registry
   `registry.studio@1` registering `cmp.target-connection-status@1`; the same
   factory is used by the host page and tests.
3. `apps/studio/src/lib/components/TargetConnectionStatus.svelte`: NAMED island.
   Justification (also in code): target connection semantics (four truthful
   states with per-state conditional disclosure) fit no shipped ui-svelte
   surface role. connected → 'Connected' + actorId + scopes + selected versions;
   rejected → credential message; unreachable → 'Target unreachable at
   <endpoint>.'; absent → 'No provisioned target with this id.' role=status,
   aria-live=polite, ul/li, native details/summary, :focus-visible outline,
   responsive <640px, per-state tone via ui-svelte token fallbacks.
4. `tests/app-definition.test.ts` and `tests/ui/render.test.ts` (happy-dom,
   VitApp + canned viewData): four state labels render distinctly with per-state
   tones; actor/scopes only on the connected row; no token-like strings
   (credentialRef/Bearer/JWT/API-key shapes); summaries keyboard-reachable;
   runs list has NO anchors/clickable rows inside data surfaces and the truthful
   FT-1 text renders; run-detail truthful empty texts render.

## FT-1 no-row-link guard
No row links anywhere: the `/runs` list uses the read-only `view` surface role
(DataView grid; no query action, no row action, no island). The
`/runs/:runId` detail route is URL-reach-only and is NOT an S9-02 drill-down
claim. Test asserts zero `a[href]` inside any `[data-surface]`, zero anchors in
table rows, and no `/runs/run-1` href in the DOM. Shell nav/breadcrumb links
(generic host chrome) are the only links, as in the reference app.

## Gates (run from worktree root, all green)
- `npm run build` — OK
- `npm run check -w vict-studio` — OK (tsc clean)
- `npm run test -w vict-studio` — OK (12/12)
- `npm run lint` — OK (clean)
- `npm run format:check` — OK (prettier --write applied to own files first)
- `node scripts/verify-stage9-inventory.mjs` — INVENTORY OK

## Approved deviations (stage manager decisions, 2026-09-29)
1. `apps/studio/vitest.config.ts`: added `plugins: [sveltekit()]`. Reason: raw
   `.svelte` imports (`registry.ts` → `TargetConnectionStatus.svelte`; the
   ui-svelte package ships src `.svelte`) need the svelte plugin in the vitest
   pipeline. Global `test.environment` stays `'node'`; the DOM environment is
   selected per-file via `// @vitest-environment happy-dom` in
   `tests/ui/render.test.ts` only. Include glob unchanged.
2. `apps/studio/vitest.config.ts`: added `resolve: { conditions: ['browser'] }`.
   Reason: Svelte's client runtime is required for `mount()` in happy-dom
   (same pattern as `examples/reference-app/vitest.config.ts`). Acknowledged:
   this changes resolution conditions for the whole vitest pipeline; the
   integrator will re-run the MERGED suite after the server track lands and
   reserves the fallback of splitting UI tests into a separate vitest
   config/script, which supersedes this approval.
3. `apps/studio/package.json`: `+ "happy-dom": "^20.14.5"` devDependency
   (explicitly authorized; lockfile updated via npm install).

## Honest deviations / limitations
- The `/runs` records grid uses the `view` role (read-only DataView grid)
  rather than the `table` role: the `table` role is bound to the
  query/search/pagination RecordsTable pipeline that assumes a declared
  `queryActionId`; G1 declares zero actions, so `view` is the supported
  read-only records surface. Column headers are raw field names (runId,
  graphId, status, createdAt) — DataView does not take column labels.
- `v.runDetail` includes run identity/status/error/currentNodeId/retention/
  versions projections but not `steps` (json blob; not a record field for a
  read-only detail grid). All fields are within the safe list.
- Screen-level `states.empty` texts exist per screen, but the renderer shows
  per-surface empty messages for empty views (truthful texts 'No events
  recorded.' / 'No durable waits.' are bound as list emptyMessages on the run
  detail screen; 'Audit is empty until actions occur.' as the audit screen
  empty state). Renderer only auto-renders stale/partial states at screen
  level; failure states are declared per screen.
- `routes/[...vict]/+page.svelte` was NOT modified (no accessibility change
  was strictly required; the additive-only allowance went unused).
- Dashboard 'selectedActivations' and 'releases' summary lists render as
  graph/release + version pairs (list role), not full tables — a dashboard
  summary, with full lists on their own routes.
- happy-dom rendering required one full workspace `npm run build` first
  (ui-svelte resolves via installed dist + src mix); noted for verifiers.

## Open questions
1. Integrator: confirm the merged vitest pipeline (server track + browser
   condition) stays green; else invoke the reserved fallback (separate UI
   vitest config).
2. The run-detail contract expects the host to supply the detail record via
   both `record` and the `v.runDetail` viewData entry (reference-app
   loadRoute pattern); studio-server must implement that convention.
3. `pagination: true` declared for runs/activations lists (server-side
   limit/offset paging); the read-only `view` surface does not render a
   pagination control — if the integrator wants visible paging, that is an
   FT-gated surface improvement, not a G1 requirement.
