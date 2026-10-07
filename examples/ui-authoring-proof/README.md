# ui-authoring-proof — the U3 inspection product

The U3 runnable proof: a complete fictional inspection application whose
queue and inspection detail are **authored through canonical VICT UI
documents** and rendered by the same generic renderer the studio edits with.
One shared domain core drives two interchangeable decision backends — an
in-memory **simulated** store and a **durable-local SQLite** store — with the
full submit → decision → rejection → revision → resubmission journey enforced
at a real server boundary. This is a local demo, not a deployment; nothing
here is production-ready.

## Requirements

- **Node 22.13 or newer** (built-in `node:sqlite` powers the durable mode).
- A fresh clone needs a one-time package build: several `@victframework/*`
  packages are consumed through their built outputs (only the document
  renderer is consumed from source).

## Run it (from the repository root, fresh clone)

```bash
npm ci --ignore-scripts
npm run build                                   # builds the @victframework/* packages
npm run build -w @victframework/ui-preview      # preview runtime build
npm run dev -w ui-authoring-proof               # development mode
```

Open http://localhost:5173 (add `-- --port 5333 --strictPort` to the dev
command for a fixed port).

Production build (required for the restart proof):

```bash
npm run build -w ui-authoring-proof             # inside the repo root
```

then from `examples/ui-authoring-proof`:

```bash
node build                                      # honours PORT and HOST env vars
```

PowerShell example:

```powershell
$env:PORT = '5333'; $env:HOST = '127.0.0.1'; node build
```

These instructions were validated against a fresh clone: `npm ci`,
the two build steps, dev server and `node build` all served the routes below
with HTTP 200.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Inspection queue — the product entry (authored canonical document; no editor/preview imports in the product entry graph, verified by `test/entry-isolation.test.ts`) |
| `/inspection/i-101` (etc.) | Inspection detail — a `vict.application@3` document rendered by the generic `DocumentHost`: readable findings/evidence, one role-appropriate decision area, integrated correction forms, one chronological activity trail |
| `/studio` | The authoring host: canvas + Inspector + history + preview, composed from `@victframework/ui-editor` and `@victframework/ui-preview`; edits are saved back into the same canonical source the product renders |
| `/scenarios` | Operation coverage & test console — the frozen eight-scenario matrix with truthful implementation labels |
| `/api/inspection/[action]` | The server POST boundary every decision goes through |

## Role, records and storage

Everything lives in the **Demo controls** disclosure at the top of the queue
and detail pages:

- **View as** — Supervisor or Technician (`?as=…`). The adapter boundary, not
  button visibility, denies decisions outside the acting role.
- **Records (simulated)** — the simulated record preset: Normal, Empty or
  Long (`?scenario=…`). Deterministic seeds; **Reset demo** returns to the
  seed exactly.
- **Storage** — `Simulated` (in-memory, resets on server restart) or
  `Saved locally (SQLite)` (durable-local; survives a server restart). The
  disclosure strip always shows which one is active — saved records never
  claim more durability than one local file.
- Reset during an in-flight decision fences the late result
  (`SESSION_STALE`); the decision never lands after the reset.

## Where data lives

- **Durable store**: one SQLite file — `U3_DURABLE_DB` if set, otherwise
  `examples/ui-authoring-proof/.local-data/inspections-u3.sqlite`
  (gitignored; WAL journal, `synchronous=FULL`). Delete the file to rebuild
  from the committed seeds on the next durable start.
- **Authoring edits** (Studio **Save**): the browser's `localStorage` for
  this origin, key `vict.u1.authoring.doc` (format `vict.authoring-store@1`).
  Browser-saved edits are **not** Git commits; clearing site data restores
  the committed source. Incompatible saved bytes are preserved and the app
  falls back with a visible notice.
- **Committed seeds**: `src/lib/product/scenario-seeds.ts` — the demo always
  rebuilds from these; Git preserves the source and fixtures, while running
  servers, generated `build/` output and local runtime data (SQLite file,
  browser storage) are separate and reproducible.

## Tests and checks

From this directory: `npm test` (68 tests: journey, permissions, revisions,
replay, reset/fencing, SQLite conformance), `npx svelte-check --tsconfig
./tsconfig.json` (0 errors, 2 retained noninteractive-text warnings). The
frozen performance budgets are measured by `npx tsx test/measure-u3.ts`.

Founder-facing tour: [docs/ui-foundation/U3-WALKTHROUGH.md](../../docs/ui-foundation/U3-WALKTHROUGH.md).
See also [the examples index](../README.md) and the design-tooling proof
[ui-design-proof](../ui-design-proof/README.md).
