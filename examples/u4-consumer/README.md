# u4-consumer — the U4-B1 independent clean consumer

A minimal product that authors **B1 catalog controls through the Inspector**
and replays the **saved document in the finished application** — the §6
catalog proof: the SAME control through
`select → inspect/edit exposed properties → connect/change outputs →
undo/redo → save → reload → use in the finished application`.

## Entries (separate bundles by construction)

| Entry | Route | Contents |
| --- | --- | --- |
| Authoring workbench | `index.html` (`/`) | EditorCanvas + Inspector + Layers + HistoryPanel + StateValuesPanel over a `UiEditSession`-backed store |
| Finished application | `app.html` (`/app.html`) | `DocumentHost` replaying the SAVED documents — **no authoring machinery imported** |

The finished bundle is checked for editor-module leakage at every build
(`scripts/pack-u4-consumer.mjs` + the consumer test suite).

## B1 controls delivered here

Button (declared action, disabled/loading from authored state), catalog
Checkbox ×2 (distinct state keys, feeding a declared submission), catalog
Select (single-value, options via array-typed view reference), catalog
Dialog (open loop + `body` slot with an authored confirm control),
AppShell (content slot + nav), Switch, Toggle, RadioGroup.

## Clean install, build, launch (packed artifacts)

```bash
# from the repository root — packs the closure, isolates, verifies:
node scripts/pack-u4-consumer.mjs

cd ../u4-consumer-isolated/u4-consumer   # OUTSIDE the repo workspace graph
npm run dev                              # http://localhost:5173 (authoring)
#                        http://localhost:5173/app.html (finished app)
npm test                                 # contract suite from packed artifacts
```

Dependencies install from `vendor/*.tgz` tarballs (`file:`), never workspace
links; the packer fails on any `@victframework/*` module resolving outside
the isolated directory, on any repository source path in a built bundle,
and records the tarball SHA-256 manifest in `pack-manifest.json`.

## Seeds

The authoring seeds are the committed documents in `src/product/documents.ts`
(`consumer.taskControls`, `consumer.taskShell`). "Reset to seed" clears the
stored envelope and reloads. Saved edits persist in `localStorage` under
`u4-consumer.controls` / `u4-consumer.shell` and are what the finished app
replays.

## Consuming the packed packages — public requirements (read first)

These are hard requirements discovered by the round-4 unfamiliar-agent
exercise; none of them are optional:

1. **Svelte-capable bundler required.** The packed `@victframework/*`
   tarballs ship TypeScript/Svelte SOURCES (`exports` point at `src/*.ts`),
   not prebuilt JS. Consume them with Vite + `@sveltejs/vite-plugin-svelte`
   (as this consumer does) or any bundler with equivalent Svelte/TS
   support. A plain Node/JS bundler will fail on the sources.
2. **Dependency pre-bundling exclusion.** Svelte component sources must not
   be pre-bundled by esbuild. Exclude every `@victframework/*` package from
   `optimizeDeps` (see `vite.config.ts` in this consumer for the exact list).
3. **Catalog namespace exports.** Catalog families export bits-ui
   namespaces, e.g. `import { Button } from '@victframework/ui-svelte/catalog/button'`
   gives `Button.Root` — there is no flat `<Button>` component. Mounting
   `Button` itself fails with an opaque "Component is not a function".
4. **Control scope + stylesheet.** Wrap rendered documents in
   `ControlScope` (from `@victframework/ui-svelte`) and import
   `@victframework/ui-svelte/catalog.css` once per entry. Without these the
   controls render unstyled and keyboard focus policies do not apply.
5. **Build everything first.** From a fresh checkout run the repository
   root `npm run build` — it now builds every workspace package the packer
   consumes, including `@victframework/ui-editor` and
   `@victframework/ui-preview` (round-5 fix for finding F14: no manual
   pre-build step is needed any more).

## Isolated install: what the pack step does (round-5 cold-start findings)

- The packed tarballs live in the ISOLATED directory (`u4-consumer-isolated/
  u4-consumer/vendor/`), NOT inside `examples/u4-consumer`. A bare copy of
  this example directory cannot install by itself (round-5 gap G-A) — run
  the pack step from the repository root first (it builds every workspace
  package, packs the closure, creates the isolated directory, installs from
  the tarballs, runs the contract suite, and builds both entries).
- The packer DELETES and recreates the isolated directory on every run.
  Any server or editor holding that directory open fails the run with
  `EBUSY` — stop previews/servers from that directory first (round-5 gap
  G-B). Set `U4_ISOLATED_ROOT` to place the isolated directory elsewhere;
  the value may be relative or use forward slashes (resolved).

## Status (2026-10-13 — ACCEPTED baseline `dcd3cbea`)

This example is the accepted U4 UI-foundation baseline (owner scoped
acceptance; closure records `43a2c74c`). Verified by the round-5
combined gate and the independent remedy recheck: clean install from
this README's path, contract suite, both entries, catalog consumption.
Remaining refinement happens in the actual Studio
([U4-STUDIO-HANDOFF](../../docs/ui-foundation/U4-STUDIO-HANDOFF.md)).

This consumer is the packed-closure proof surface for the U4 combined
candidate `codex/ui-foundation-u4-combined-verify-05` (verification track
`143ffc4` + owner-UI track `954f93f` on the common implementation base
`32d8465a`). The stale round-1 FAIL text that stood here before has been
removed — that status described `098b84e3` and does not describe this
candidate. Current verification evidence lives in
`docs/ui-foundation/reviews/u4/b1-core-verify/` (rounds 1–4 reports kept
intact, each naming the SHA it evaluated).
