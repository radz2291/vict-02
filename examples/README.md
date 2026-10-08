# Runnable examples

Two committed, runnable proofs of the VICT UI foundation. Both are local
demos — nothing here is a deployment, and no surface is production-ready.

| Example | Demonstrates | Tour |
| --- | --- | --- |
| [`ui-authoring-proof`](ui-authoring-proof/README.md) | The U3 inspection **product**: queue + detail authored through canonical VICT UI documents, full submit → decision → rejection → revision → resubmission journey at a real server boundary, eight-scenario test console, simulated vs durable-local (SQLite) storage, Inspector edits saved into the same canonical source the product renders | [U3-WALKTHROUGH](../docs/ui-foundation/U3-WALKTHROUGH.md) |
| [`ui-design-proof`](ui-design-proof/README.md) | The U2 authoring **workbench**: canvas + Layers + Inspector editing a canonical design document; saved edits flow to the finished product page | [U2-WALKTHROUGH](../docs/ui-foundation/U2-WALKTHROUGH.md) |

## Install, build and launch (fresh clone, one-time setup)

From the repository root:

```bash
npm ci --ignore-scripts
npm run build                                   # builds the @victframework/* packages
npm run build -w @victframework/ui-preview      # preview runtime build
```

Then launch either example in development mode:

```bash
npm run dev -w ui-authoring-proof   # http://localhost:5173  (inspection product)
npm run dev -w ui-design-proof      # http://localhost:5173  (design workbench; run one at a time or pass -- --port <n>)
```

Production builds (required for the authoring proof's restart demonstration):

```bash
npm run build -w ui-authoring-proof
npm run build -w ui-design-proof
# then, inside each example directory:
node build                          # honours PORT and HOST env vars
```

Requirements: Node 22.13+ (built-in `node:sqlite`). The build prerequisite is
real: several `@victframework/*` packages are consumed through built outputs.
with HTTP 200 (validated against a fresh clone during this U3 cycle).

## What you can do in each

- **ui-authoring-proof**: switch role (Supervisor/Technician) and record
  preset (Normal/Empty/Long) from the Demo controls disclosure; switch
  Storage between Simulated and Saved locally (SQLite); approve, reject with
  a mandatory reason, revise, correct, resubmit; watch the boundary refuse
  out-of-role and out-of-order actions; open `/scenarios` for the eight
  frozen scenarios (failure, conflict, latency fencing, missing coverage);
  edit the detail presentation in `/studio` and see the product reflect the
  saved canonical source; restart the server in durable mode and find the
  decisions still there.
- **ui-design-proof**: open `/workbench`, select hero/cards on the canvas or
  in the Layers rail, edit text/size/spacing in the Inspector, undo/redo,
  Save, then check `/editor-review` — the finished page renders the saved
  source.

## Committed vs runtime

Git preserves the **source, fixtures and seeds** of both examples. Running
servers, generated `build/` output and **local runtime data** are separate
and reproducible:

- durable SQLite file: `examples/ui-authoring-proof/.local-data/` (or the
  `U3_DURABLE_DB` env var; gitignored — delete it to rebuild from seeds);
- browser-saved edits: per-origin `localStorage`
  (`vict.u1.authoring.doc` / `vict.u2.service.doc`) — **not** Git commits;
  clearing site data restores the committed source.

Demo state always rebuilds deterministically from the committed seeds
(**Reset demo** buttons; delete the SQLite file for a durable reset).

## u4-consumer (U4 batch B1)

`examples/u4-consumer/` — the independent clean consumer for the U4 batch B1
catalog-authoring proof: a multi-entry Vite app whose AUTHORING workbench
(`index.html`; EditorCanvas + Inspector + Layers + HistoryPanel +
StateValuesPanel over a UiEditSession-backed store) edits the eight B1
catalog controls, and whose FINISHED application (`app.html`; DocumentHost)
replays the saved documents with **no authoring machinery in its bundle**.
Built strictly from packed artifacts in the isolated verification
(`scripts/pack-u4-consumer.mjs` — vendor tarballs, no workspace links,
SHA-256 manifest in `pack-manifest.json`). Clean install/build/launch
instructions in [u4-consumer/README.md](u4-consumer/README.md).
