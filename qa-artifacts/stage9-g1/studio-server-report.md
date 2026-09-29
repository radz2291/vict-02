# BUILDER REPORT — track `studio-server` (Stage 09 G1)

**Branch:** `codex/stage9-g1-studio-server`
**Commit (candidate):** `614f82c778afa73f2e41fd7c2950b8b286080769` (verified on `origin` via `git ls-remote`)
**Base:** `fd2f57d1acd7b5ae1c1b869f5be2268153b0cfde` (unchanged ancestor)
**Status:** BUILDER CANDIDATE — facts only; no gate verdict claimed.

## Scope honored

Only the track's exclusive paths were touched:
`apps/studio/src/lib/server/**`, `src/hooks.server.ts`, `src/routes/login/**`,
`tests/**`, `scripts/demo-target.mjs`. No edits to `contract.ts`,
`packages/**`, `[...vict]`, `lib/application/**`, `lib/components/**`,
package manifests, or root configs.

## Deliverables

- `targets.ts` — env-provisioned registry (`VICT_STUDIO_TARGETS`,
  `VICT_STUDIO_CREDENTIALS`) with loopback demo defaults including a second
  `studio-detail` credential; bounded probe (1500ms AbortController) against
  `/vict/v1/releases`; truthful `connected|rejected|unreachable|absent`;
  configured scopes on connected; 5s probe cache; token never in any return
  value/detail/log.
- `session.ts` — human sessions from `VICT_STUDIO_HUMAN_CREDENTIALS` (demo
  `operator`/`studio-local-pass`); in-memory Map; randomBytes(32) ids;
  cookie `vict_studio_session` HttpOnly SameSite=Lax Path=/ Max-Age=28800;
  CSRF token server-side only.
- `hooks.server.ts` — D-2/D-7 boundary: Origin/Host same-origin on all
  non-GET/HEAD (`VICT_STUDIO_ORIGIN`), JSON requires session + `x-vict-csrf`
  (`VICT_STUDIO_UNAUTHENTICATED` / `VICT_STUDIO_CSRF`), unauthenticated HTML
  navigations → 303 `/login`, logout POST destroy+clear+redirect, static
  assets exempt; fail-closed, non-echoing.
- `routes/login/**` — accessible native-form login action (identical
  non-echoing failure for unknown label vs wrong secret), provisioning hint.
- `vict-client.ts` — fail-closed GET client; path must be an exact binding
  instance; path params validated client-side BEFORE fetch; allowlisted
  query only; envelope mapping; token never escapes.
- `adapter.ts` — `vict.studio.http-adapter` rev 1, fetch-only. Honest
  nearest-code mapping (documented in-code): rejected→`DATA_UNAUTHORIZED`,
  unreachable→`DATA_UNSUPPORTED_QUERY` ('target unreachable'), 404→
  `DATA_UNKNOWN_IDENTITY`, absent target/unknown path→`DATA_UNKNOWN_RESOURCE`;
  `targetStatus` from the injected LOCAL provider; `mutate()` always
  `DATA_MUTATION_NOT_DECLARED`; permission `studio.operator.read` required.
- `app-server.ts` — `getStudioServer()`; loadRoute: collectSurfaces →
  viewIds → per-view adapter queries (limit ≤200 default 50) and local
  targetStatus probe; record via getPath identity param; per-view failures
  surface as `{rows:[], loading:false, failure:<safe code>}`.
- `scripts/demo-target.mjs` — real loopback target (default :4310), two
  actors (operator + detail grant), published+selected manifest, three
  seeded runs (completed w/ stored output under 'full' retention, failed
  with 3 events, blocked with a real durable orchestration wait); safe
  summary JSON only; tokens documented in the script header (LOCAL DEMO
  ONLY); clean SIGINT/SIGTERM close.

## Gate results (all run from the worktree root)

| Gate | Result |
| --- | --- |
| `npm run build` | OK (full workspace build, from no-dist start) |
| `npm run check -w vict-studio` | OK (tsc, 0 errors) |
| `npm run test -w vict-studio` | 27/27 passed (boundary 13, adapter 9, targets 5) |
| `npm run lint` | clean |
| `npm run format:check` | clean (prettier --write applied to track files first) |
| `node scripts/verify-stage9-inventory.mjs` | INVENTORY OK |
| `npx vitest run --project unit packages/server` | **174/174 passed** (existing server suite intact) |

Extra smoke (not a gate): `demo-target.mjs` booted on :4321; `GET
/vict/v1/runs` with the operator Bearer returned the seeded completed run.

## Honest deviations / limitations

1. **Probe `selected` on a real target is usually null.**
   `GET /vict/v1/activations/selected` on the real server requires a
   `graphId` query param (400 `VICT_COMMAND_FIELD_INVALID` without one), so
   the un-parameterized probe cannot enumerate selections; the probe
   tolerates this and reports `selected: null` truthfully. The mock-based
   tests cover both response shapes.
2. **SvelteKit `$lib` alias avoided in server modules and the login route**
   (relative imports) so vitest can run them without the SvelteKit vite
   plugin; `app-server.ts` keeps `$lib/application/index.js` (not imported
   by tests).
3. **Boundary tests call `handle` with minimal RequestEvent objects** and
   the login action directly as a function — honest about exercising the
   hook logic, not the full kit request pipeline or static-asset serving.
4. **Session store is in-memory** (restart logs everyone out) per D-2
   short-lived design; no persistence intended in G1.
5. Server-suite count is **174**, larger than the 129+ expectation —
   includes newer tests on the integrated baseline; all green.
6. The `-detail` credential is reachable only by pointing a provisioned
   target's `credentialRef` at `studio-detail` (env), not by any UI.

## Open questions for the integrator

- Should `selectedActivations` list (`/vict/v1/activations/selected`) be
  given a server-side no-graphId "list all selections" semantics so the
  Studio probe can show selected versions without knowing graph ids?
- Confirm the demo token constants in `demo-target.mjs` header are
  acceptable as a clearly-marked local fixture (they never touch stdout).
- View→resource mapping in `app-server.ts` reads `plan.views[viewId]
  .resourceId` — the studio-app track must declare `resourceId` on every
  view for viewData to load.
