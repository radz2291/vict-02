# VICT Studio (Stage 09, G1)

Private SvelteKit operator host (D-1). Renders the VICT Application
Definition/Plan through the genuine `@victframework/ui` →
`@victframework/ui-svelte` delivery path and reads operator data through an
HTTP-backed `ApplicationDataAdapter`. Server-held target credentials; no
target token reaches the browser (D-2/D-7).

**G1 is read-only.** No receipts, no mutations, no FT-1 navigation, no
S9-02 claim, no product view.

## Builder track ownership (non-overlapping)

| Path | Owner |
| --- | --- |
| `src/lib/shared/contract.ts` | INTEGRATOR — the agreed interface; change only via the stage manager |
| `src/lib/server/**`, `src/hooks.server.ts` | `studio-server` track |
| `src/routes/login/**` (session routes) | `studio-server` track |
| `tests/**` (boundary + adapter tests) | `studio-server` track (may add UI-render tests under `tests/ui/**`) |
| `scripts/demo-target.mjs` (local target fixture) | `studio-server` track |
| `src/lib/application/**` | `studio-app` track |
| `src/lib/components/**` | `studio-app` track |
| `src/routes/[...vict]/**` | INTEGRATOR scaffold; `studio-app` may refine rendering/accessibility |

Shared signatures (do NOT change): `compileStudioPlan(): ApplicationPlan`,
`createStudioRegistry(): ComponentRegistry`,
`getStudioServer(): StudioAppServer` (see `src/lib/server/app-server.ts`).

## Interface agreement (binding)

`src/lib/shared/contract.ts` is the single source of truth:

- **Resources:** `runs`, `runEvents`, `runWaits`, `activations`,
  `selectedActivations`, `releases`, `releaseSelections`, `auditEntries`,
  `targetStatus` (Studio-local; never proxied).
- **Bindings:** `RESOURCE_BINDINGS` pins every resource to its exact HTTP
  path(s), identity field, safe field list, and allowed query parameters —
  matching `packages/server/src/commands.ts` projections at checkpoint
  `801ecee`. The adapter forwards ONLY these; arbitrary paths/params fail.
- **Route params:** a detail route's parameter name equals the resource's
  `identityField` (e.g. `/runs/:runId`).
- **Connection states:** exactly `connected | rejected | unreachable |
  absent`, projected as safe `TargetStatusRow`s.
- **loadRoute:** `{ plan, viewData: { [viewId]: { rows, loading, ... } }, record }`.

## Run

```sh
npm install                      # from the repo root (workspaces)
npm run build -w vict-studio     # svelte-kit sync + vite build
npm run check -w vict-studio     # tsc --noEmit
npm run test  -w vict-studio     # vitest (boundary + adapter + render tests)
```
