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

## Stage 9 G2 — S9-04 confirmation journey (additive slice)

A dedicated journey route `src/routes/confirmations/` (NEW files: page +
page server, `src/lib/confirmation/confirmation.ts` pure shapes, and the
server-only `src/lib/server/confirmation-transport.ts` relay) implements
the S9-04 `prepare → human review → confirm` browser journey per the
frozen G2 proposal §6.2. Summary/status/banner come ONLY from target
responses (no fabricated state). The G1 read-only plan surface, its
RESOURCE_BINDINGS, and the generic host dispatch are NOT changed; the
shared contract `contract.ts` is unchanged (no RESOURCE_BINDINGS addition
was required — confirmations are not G1 read resources and the adapter
stays read-only). New trusted island `cmp.confirmation-review@1` is
registered in `src/lib/components/registry.ts`. Manual journey script:
`qa-artifacts/stage9-g2/journey-plan.md`. Journey tests:
`tests/ui/confirmation.test.ts`, `tests/confirmation-contract.test.ts`.
`scripts/demo-target.mjs` gained ONE additive fixture actor
(`vict-studio-demo-mutator` → mutation scopes) for the journey; the read
surface fixture is untouched.
