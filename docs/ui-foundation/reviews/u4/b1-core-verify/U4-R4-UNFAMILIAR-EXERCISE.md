# U4-R4 — UNFAMILIAR-AGENT EXERCISE (review only)

- **Candidate identity:** packed artifacts produced at candidate `32d8465aa9c810e4285995549a562957c85d2e36`
- **Reviewer:** simulated cold-start integrator; no prior knowledge of the vict-02 monorepo (treated as nonexistent)
- **Environment:** isolated consumer `C:/Users/RZ1/Desktop/RZ/u4-consumer-isolated/u4-consumer`, installed purely from `vendor/*.tgz` (`file:` deps). Read surface: README.md, package.json, src/, pack-manifest.json, public exports/.d.ts under `node_modules/@victframework/*/dist` (+ src, since the tarball exports map points there).
- **Date:** 2026-10-12

## Verdict

**PASS (with findings)** — a stranger with no monorepo knowledge succeeded at all three required exercises using only public artifacts: (1) rendering a document in the finished app entry, (2) authoring a change through the authoring entry and seeing it in the finished app after save+reload, and (3) programmatically consuming a catalog component from `@victframework/ui-svelte` public exports. The gaps found are documentation/declaration underspecification, not functional defects.

## What I could achieve from public capabilities

1. **Render a document in the finished app.** README documents the two entries (`/` authoring, `/app.html` finished). Started `vite preview --port 5471`; `/app.html?doc=controls` replayed the saved `consumer.taskControls` document (heading, checkboxes, select, switch, toggle, radio-group, submit bar) with no authoring machinery visible.
2. **Authoring end-to-end round trip.** In the authoring entry: rail button "Submit review" switches the blade to the task-controls document; clicking the `<h1>Task review</h1>` occurrence selects it (Inspector shows "Heading · Task review" with a Text content field + "Apply text"); typing new text and clicking **Apply text** logged `Applied setProperty on headingText`; clicking **Save** logged `Saved revision r1.r1` and wrote `localStorage['u4-consumer.controls']`. After browser reload, both the authoring entry (status `Saved · rev r1.r1`) and the finished app (`/app.html?doc=controls`) showed the edited heading **"Task review (cold-start edit)"**. Persistence, dirty-state, and undo/redo affordances all worked as documented.
3. **Programmatic catalog consumption.** In a scratch app under the OS temp dir (imports resolved against the isolated consumer's node_modules via a junction; vite dev on port 5472):
   `import { Button } from '@victframework/ui-svelte/catalog/button'` → `Button.Root` mounted with svelte `mount()`, rendered `<button data-button-root="true" type="button">`, and the `onclick` handler fired (verified via CDP-driven Chrome). `npm test` passes: 16/16 tests, 1 file.
4. `pack-manifest.json` gave SHA-256/integrity for every tarball, matching the claim of fully `file:`-installed packed artifacts.

## What I could NOT achieve / had to work around from public capabilities

- Nothing was functionally blocked. The workarounds below (findings 1–4) were all needed before anything rendered.

## Numbered gaps / findings

1. **Catalog exports are bits-ui namespaces, not components — declarations don't say so.** `ui-svelte/catalog/button` is literally `export { Button } from 'bits-ui'`, and bits-ui exports `Button` as `export * as Button` (i.e. `Button.Root`). Mounting `Button` directly fails with an unhelpful `TypeError: Component is not a function`. The `.d.ts` comment only says "Supported Button parts. Use ControlScope and catalog.css for VICT styling." A stranger must reverse-engineer bits-ui's compound-components convention; the public declaration never states that `Button` is a namespace whose mountable part is `Button.Root`.
2. **Tarball exports point at `src/*.ts`, not built dist.** Every `@victframework/ui-svelte` export condition resolves to `./src/index.ts` (Svelte sources). The `dist/` `.d.ts` files exist but are not referenced by the exports map. Consequence: no consumer can use these packages without a Svelte/TS-aware bundler (vite + vite-plugin-svelte); a pure-node `import` from the package is impossible. This is workable but is an undeclared runtime requirement — package.json gives no hint that Svelte compilation of dependencies is mandatory.
3. **ControlScope / catalog.css coupling is mentioned but not wired up.** Finding 1's type comment says to use ControlScope and catalog.css for styling, but nothing in the public surface explains when ControlScope is required for a bare catalog part to function vs. merely styled (my scratch `Button.Root` rendered and handled clicks without it, contradicting the comment's implication).
4. **Vite dev requires dependency optimization exclusions that no public doc explains.** Serving the packages via a scratch vite dev server needed the consumer's own `vite.config.ts` treatment (svelte plugin, dedupe); naive setups hit `svelte/reactivity` resolution errors from aliased/prebundled deps. Only the consumer's config reveals the working recipe; it is consumer code, not package documentation.
5. **README is stale relative to the packed candidate.** Its "Verification status" section still describes round-1 FAIL on candidate `098b84e3…` and says "Wait for the repaired candidate," while the packed artifacts are round-4 `0.4.0-rc.1` at `32d8465a…`. A cold-start reader cannot tell from the README whether the current bits are usable (they are — everything I exercised works).
6. **Minor:** `vite preview` binds IPv6 `::1` only in this environment; `http://127.0.0.1:5471` fails while `http://localhost:5471` works. Environment quirk, not a product defect, but worth noting for scripted verification.

## Notes on method

- Scratch files only under `%TEMP%/u4r4/` (scripts, scratch app, junction to node_modules); the isolated consumer directory was not modified (preview/dev servers serve in place; `dist/` untouched — I did not re-run `npm run build` since a production build already exists and building would rewrite it).
- Browser automation: CDP on 127.0.0.1:9222 with `Emulation.setFocusEmulationEnabled(true)` via puppeteer-core.
- Commands run: `npm test` (16/16 passed), `vite preview --port 5471` (HTTP 200 on `/` and `/app.html`), CDP-driven authoring round trip (select → edit → apply → save → reload → finished app), scratch catalog consumption on port 5472 (render + click verified).
