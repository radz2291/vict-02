# Vict Reference Application (Stage 05)

The complete Stage 05 reference proof: one neutral `vict.application@2`
definition (`src/lib/application/definition.ts`) plus explicit
renderer, component-registry, SQLite application-data, and runtime bindings,
rendered by the generic Vict host — without hand-authored routes or page
shells.

## Screens

- `/` — dashboard: status indicator, computed metrics (produced by a real
  Vict capability run), budget-by-status chart with an accessible data-table
  alternative, custom component island, theme-token customization.
- `/conversation` — conversation feed with distinct participant roles and a
  validated input whose send crosses a REAL Vict run (pinned activation,
  declared contracts) that computes and stores the assistant reply.
- `/projects` — SQLite-backed records table: search, exact-match filters,
  sortable columns, pagination, breadcrumbs.
- `/projects/new` — contract-validated create form.
- `/projects/:id` — record detail with status tones, tabs (overview/edit),
  prefilled edit form, a delete dialog whose action is DENIED by the
  authorization boundary (UI visibility is not authorization), and a drawer
  hosting the custom component.
- `/dashboard` — a redirect route to `/` (renderer-resolved).

## Evidence

`npm run test -w reference-app` (from the repository root) runs:

- definition/identity/release suites (application identity layering, release
  compilation from ACTUAL binding snapshots, parameter/redirect routing);
- DOM-level suites (every screen, safe states, injection-resistance
  canaries, custom-component isolation);
- real-process HTTP suites (built SvelteKit server, SQLite persistence,
  contract validation, keyed idempotency, denied admin mutation, durable
  Vict capability runs, SIGKILL restart with data survival);
- REAL-browser suites (desktop 1280x800 and mobile 390x844: keyboard/focus
  behavior, dialog focus semantics, responsive navigation, axe-core
  accessibility scans).

## Ownership

- `src/lib/application/definition.ts` — the neutral Application Definition
  (author-owned; edit it and the application changes).
- `src/lib/components/` — custom Svelte component code islands
  (`cmp.health@1`), registered outside the manifest.
- `src/lib/server/application-server.ts` — the storage-neutral application
  server core; `application-server.sqlite.ts` is the production SQLite
  wiring (separate application-domain database and migrations).
- Routes and API boundary are generic Vict host files.

Local development: `npm run dev`. Production build: `npm run build` and
`node build` (adapter-node). The application-domain database lives at
`.data/appdata.sqlite` (override with `VICT_APPDATA_PATH`).
