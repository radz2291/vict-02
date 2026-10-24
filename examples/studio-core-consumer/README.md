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
occurrence selection, native input/textarea/select state wiring, typed chat output, and read-only
Flow pan/zoom/selection. Source checks use the public registered insertion helper,
canonical remove/Undo/Redo, duplicate identity refusal, and explicit Save/reopen
against a disposable revision-checked **memory** store. Runtime values are
ephemeral; no durable storage or provider execution is claimed.

The separate `/capture.html` page renders the retained canonical form and calls
the installed public `captureRenderedElement` on the real styled frame. Capture
pixels, dimensions and actual date segment measurements can be downloaded for
comparison. It does not invoke a model or synthesize a replacement image.
**Capture actual visible crop** uses the same fixed-width source frame inside
a 420 × 460 clipped viewport starting 30 pixels right and 220 pixels down, and
passes that real viewport to the public helper. The full action restores the
whole frame. The visible read-only JPEG data URI is FileReader's encoding of
the exact returned Blob, for raw export when browser download events fail.

After installation and again after the production build, verify all eight
installed package manifests and every src/dist byte against the exact candidate:

```powershell
node examples/studio-core-consumer/verify.mjs --source=<exact-product-SHA> --directory=<consumer-directory> --evidence=<evidence-directory>
```

This also refuses dependency symlinks/junctions and records hashes of actual
production files when `dist` exists.

Installation, source-helper checks, rendering and exercised browser behavior are
separate evidence. Builder evidence does not supply an independent gate verdict.
