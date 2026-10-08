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

## Verification status (U4-B1 core-refactor round 1 — 2026-10-08)

This consumer builds and launches ONLY on the verification branch
`codex/ui-foundation-u4-b1-core-verification` (delivery repairs: application
public re-export, pack closure incl. ui-preview, seed route path, vite
dep-optimization exclusion, pinned dev toolchain). On the unmodified
implementation candidate `098b84e3…` the consumer cannot build. Round-1
verdict FAIL with known defects recorded in
`docs/ui-foundation/reviews/u4/b1-core-verify/U4-B1-CORE-VERIFY-01.md`;
founder-visible ones: the catalog Dialog cannot be dismissed (✕/Escape inert),
select options cannot be chosen from the portaled listbox, and the workbench
preview does not surface action failure/success feedback near the button
(the finished app and activity log do). Wait for the repaired candidate.
