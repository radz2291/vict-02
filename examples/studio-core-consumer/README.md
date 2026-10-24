# Standalone packed public consumer

This fixture imports public VICT package exports. It contains no Studio imports,
source aliases, workspace links, provider configuration or execution adapter.
The default package manifest describes dependencies; the preparation script
replaces all eight framework dependencies with actual locally packed artifacts
inside a fresh directory and records their integrity and resolved install paths.

From the repository root, after the candidate package builds are complete:

```powershell
node examples/studio-core-consumer/prepare.mjs --source=<exact-product-SHA> --directory=<new-absolute-directory> --evidence=<absolute-evidence-directory>
```

The script refuses an existing consumer directory or changed candidate package
source, packs without publishing, performs a separate npm installation using the
normal cache, copies the fixture and records installation evidence. It never
changes an earlier consumer or the repository dependency tree.

In the resulting independent directory:

```powershell
npm run build
npm run preview -- --host 127.0.0.11 --port 5605 --strictPort
```

Inspect listener ownership before starting the preview. The page renders the
canonical AI and Flow seed compositions with `DocumentHost`, exposes exact source
occurrence selection, native text-state wiring, typed chat output, and read-only
Flow pan/zoom/selection. Source checks use the public registered insertion helper,
canonical remove/Undo/Redo, duplicate identity refusal, and explicit Save/reopen
against a disposable revision-checked **memory** store. Runtime values are
ephemeral; no durable storage or provider execution is claimed.

Installation, source-helper checks, rendering and exercised browser behavior are
separate evidence. Builder evidence does not supply an independent gate verdict.
