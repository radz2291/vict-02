# ui-authoring-proof — the U1 runnable loop

The first runnable rendering, editing and simulated product loop for the Vict
UI foundation (U1). One renderer, one document model, real execution
boundaries.

## Run it

From the repository root:

```bash
npm install          # once
npm run build -w @victframework/contracts -w @victframework/ui -w @victframework/sdk \
  -w @victframework/kernel -w @victframework/runtime -w @victframework/application \
  -w @victframework/ui-svelte -w @victframework/ui-preview   # built package outputs
npm run dev -w ui-authoring-proof
```

Open http://localhost:5173

| Route | What it is |
| --- | --- |
| `/` | Inspection queue — the NORMAL application consumer (product entry graph; no editor/preview imports, verified by `test/entry-isolation.test.ts`) |
| `/inspection/i-101` | Inspection detail — a `vict.application@3` DOCUMENT-MODE screen rendered by the same generic `DocumentHost` the studio edits with |
| `/studio` | The authoring host: canvas + inspector + history + simulated preview, composed from `@victframework/ui-editor` and `@victframework/ui-preview` |

`?as=technician` on any product route switches the acting role — the adapter
boundary (not button visibility) then denies decisions.

## Short walkthrough (~3 minutes)

1. **Product path (U1-05).** Open `/inspection/i-101`. The detail screen is an
   authored `vict.ui-document@1` document compiled into the application plan.
   Press **Approve this inspection**: the declared `inspection.approve` action
   dispatches through the real adapter boundary with your permission context —
   status flips to `approved`, the domain revision advances, and the activity
   rail (part of the document) refreshes. The document's own Approve button
   dispatches the SAME declared action.
2. **Denial + failure (U1-05).** Visit `/inspection/i-102?as=technician` and
   approve: the boundary denies (`DATA_UNAUTHORIZED`), state unchanged. A stale
   decision (old `expectedDomainRevision`) fails with a structured conflict and
   changes nothing.
3. **Source-aware editing (U1-03).** Open `/studio`, click the status pill or a
   finding card in the canvas — selection maps to the exact source occurrence
   (node + component instance + record keys). Edit text, apply a token style,
   connect an action: every change is an exported transactional command.
   Invalid changes show structured diagnostics and leave the source unchanged.
4. **Round trip (U1-04).** Undo/redo in the history panel; **Save** advances
   the stored revision (expected-revision discipline); **Reload stored**
   reopens a fresh session over the stored bytes — IDs, layout and bindings
   preserved. Stale saves fail visibly.
5. **Preview isolation (U1-06).** In the studio's Preview panel, switch
   scenarios: `normal` approves through the registered simulated double;
   `missingCoverage` denies with `SCENARIO_COVERAGE_MISSING` (no real handler
   runs); `latency` configures an 800 ms outcome — run approve, switch scenario
   mid-flight, and the old result is fenced (`SESSION_STALE`).

## Automated checks

```bash
npm run test -w ui-authoring-proof   # product path, preview isolation,
                                     # editor round trip, entry-graph isolation
```

Package-level suites cover the identity rules (U1-01), transactions, the
renderer and the preview fencing.

## Declared limits (U1 slice)

- Extensions render as labeled placeholders (`ext.evidenceViewer`).
- Portal rendering is pending beyond U1.
- Component variants are modeled but not rendered.
- The rejection→revision loop UI is U3 scope (the adapter already implements
  `revise`; the journey fixture is frozen contract evidence).
- The studio store port is in-memory (reload = fresh page load state); the
  editor/session/persistence semantics are the frozen ones.
- The activity rail binds the inspection's joined `activity` collection.
