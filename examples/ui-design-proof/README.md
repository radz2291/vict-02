# ui-design-proof — the U2 Inspector/Layers workbench

The U2 runnable proof: a Studio-style authoring workbench for a marketing
page ("Northwind Atelier") — canvas preview, navigation rail, layer tree and
an Inspector with Content/Style/Behavior tabs — editing one canonical
`vict.design-store@1` document. Selection outlines, inline text editing,
undo/redo and per-surface clamps are enforced through the generic editor and
renderer packages. This is a local demo, not a deployment.

## Requirements

- Node 22.x. A fresh clone needs the one-time package build from the
  [examples index](../README.md) (`npm ci --ignore-scripts`, `npm run build`,
  `npm run build -w @victframework/ui-preview`).

## Run it (from the repository root)

```bash
npm run dev -w ui-design-proof        # development mode, http://localhost:5173
```

Production build:

```bash
npm run build -w ui-design-proof
```

## Routes

| Route | What it is |
| --- | --- |
| `/` | Landing page linking the demo surfaces |
| `/workbench` | The U2 workbench: click a hero/card/button on the canvas (or pick it in the Layers rail), edit text, size and spacing in the Inspector, undo/redo, then **Save** |
| `/editor-review` | The finished product page rendering the saved canonical source — what you saved in the workbench is what the product shows |
| `/service` | A second surface rendered from the same document family |

## Where data lives

- **Saved edits** (workbench **Save**): the browser's `localStorage` for this
  origin, key `vict.u2.service.doc` (format `vict.design-store@1`).
  Browser-saved edits are **not** Git commits; clearing site data restores
  the committed document.
- **Committed source/fixtures**: the hero, service cards and layout live in
  the committed source; Git preserves them, while running servers, generated
  builds and browser storage are separate and reproducible.

## Tests and checks

`npm test` (12 design tests), `npm run typecheck`, plus the repository-level
`check:ui`. Founder-facing tour: [docs/ui-foundation/U2-WALKTHROUGH.md](../../docs/ui-foundation/U2-WALKTHROUGH.md).
See also [the examples index](../README.md) and the inspection product
[ui-authoring-proof](../ui-authoring-proof/README.md).
