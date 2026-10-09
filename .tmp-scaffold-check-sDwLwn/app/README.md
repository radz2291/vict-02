# Build Check App

A Vict application: one neutral Application Definition plus explicit
runtime, data, renderer, and component bindings, rendered by the generic
Vict host.

## File ownership (exact)

### IMMUTABLE HOST FILES — scaffolder-owned; never edited by app authors

Editing any of these leaves the scaffolder's one-time, no-edit host
contract; every domain change should be possible without touching them.

| File | Role |
| --- | --- |
| `package.json` | Generated from the EXPLICIT release set selected at scaffold time (`platformDependencies`); never contains placeholder versions. |
| `.gitignore` | Build/data-artifact ignores. |
| `svelte.config.js`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` | Toolchain configuration. |
| `src/app.html`, `src/app.d.ts` | App shell + ambient types. |
| `src/routes/[...vict]/+page.svelte` | The generic host page (plan + registry + dispatch). |
| `src/routes/[...vict]/+page.server.ts` | Generic plan-driven load: awaits the async app, resolves any route/parameters, loads declared views. |
| `src/routes/api/act/+server.ts` | The one governed action boundary: awaits the async app, validates the request shape, dispatches. |
| `src/lib/server/application-server.ts` | Generic domain-free application server: contract pre-validation, query/mutation dispatch, governed capability runs, plan-driven view loading. |
| `README.md`, `src/lib/components/README.md` | This ownership documentation. |

### AUTHOR-OWNED — your application code (never regenerated)

| File | Role |
| --- | --- |
| `src/lib/application/definition.ts` | YOUR domain: application definition, resources, contracts, capabilities, grants, and the plan compiler. |
| `src/lib/components/registry.ts` | Versioned registration of your custom Svelte components. |
| `src/lib/components/*` | Your code islands (presentational; declared props only). |

The host renders whatever the definition declares — changing the domain
means changing `definition.ts` (and adding islands), never editing host
files. The scaffolder is one-time and non-destructive: it never rewrites
any file it created, and it refuses conflicts instead of overwriting.

## Platform dependencies

`package.json` pins the EXACT platform release set passed to the
scaffolder (`platformDependencies`). The generated host imports at least:
`@victframework/application`, `@victframework/appdata-sqlite`,
`@victframework/ui-svelte`, `@victframework/runtime`,
`@victframework/sdk`, `@victframework/store-sqlite`.

## Commands

- `npm run dev` — start the development server.
- `npm run build` && `npm run preview` — production build and preview.
