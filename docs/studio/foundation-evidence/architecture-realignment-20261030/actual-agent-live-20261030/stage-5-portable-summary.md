# Actual App 2: final nested-graph portable/public proof preparation

PASS for exact supported import/export roundtrip and unchanged public static
consumer preparation. Work began only after the parent confirmed the final files
were ready. No product/owner-source edits, server, browser, activation, provider
request, publishing or commit occurred.

## Exact final input

- Document `screen-b1d0036a-e404-448b-8f84-c92b2752220d`, revision `r1.r4`.
- `stage-5-final-supported-export.json`: 53,574 bytes, SHA-256
  `ed2c4fe34d18950e0ec242f0a39cd45f92390c404bab8fc7362db9a5ac33d451`.
- `stage-5-final-saved-source.json`: SHA-256
  `47892d858aa7adcd20b2756fa95d926bc7f1288765d5f94367fb804a925fc2f3`.

The baseline is this final saved source. No claims about attribution of earlier
runtime changes or recovery of unsaved state are introduced.

## Existing supported roundtrip

`scripts/stage-5-portable-roundtrip.mjs` uses existing Studio `prepareSourceImport`
and the authoritative `screenApplication` export attachment in a disposable Node
validation bundle. Both importer passes admit the actual export with zero media.
The exported document, first import and second import deep-equal the canonical
saved source. The application attachment matches, and the supported re-export is
semantically equal **and byte-identical** to the input. No replacement authored
fixture is constructed.

The script independently parses each graph@2 source and recursively resolves
graph strings from each graph node's string parameter value/default. It compares
raw graph-string hashes as well as parsed revisions, node types/parameter/port
types, labels, per-node values, positions and exact edge endpoints after both
imports. The resulting snapshots retain:

| Occurrence | Revision | Nodes | Edges |
| --- | ---: | ---: | ---: |
| `state:graph` | 21 | 2 | 0 |
| `state:graph/node:p1/parameter:graph` | 18 | 1 | 0 |
| `state:graph/node:p2/parameter:graph` | 2 | 1 | 0 |

The complete source comparison also preserves all authored bindings and labels.
This is offline data/import proof, not a new native interaction or isolation test.
Receipt: `stage-5-portable-roundtrip-report.json`, SHA-256
`3c0422916ae2e08c430fe9bb47734198c4b17c686d468920f15a22f1be18dd7a`.

## Public static consumer

The existing preparation helper used the seven bYGiad packed public artifacts and
successful inventory at source `8d8be402893a8942b985ad920b32b31807e2ad47`. All tar
hashes and 510 installed nonmanifest artifact hashes matched. Public compilation,
renderer validation and production build passed. The actual JSON bytes were
copied unchanged; independent PowerShell checks match the input, public JSON and
production JSON. No authored UI seed or component-specific replacement was used.

Ready static root:
`C:/Users/RZ1/AppData/Local/Temp/foundation-actual-app2-8d8-20261030/dist`.
The sibling `preview-report.json` has SHA-256
`a1a1cc5c622ad903b34cf47b4a13edefbfe4e74200c6631fe3e264c7a88c367c`.
Copied report/log/hash receipts use the unique `stage-5-portable-*` prefix.

Both runs passed on their first execution; existing shared Svelte warnings and
the static large-chunk warning remain in logs. The browser bundle is about
1.323 MB (361 KB gzip), not a physical-device performance measurement. Script
syntax and scoped whitespace checks passed.

The static shell retains its limits: catalog/Flow/Media public registrations only,
no nonempty managed-media inventory, explicit unavailable backend actions and
session-only state. It has not been served or opened here. Native behavior,
Android connectivity, touch, software keyboard, safe area, secure-context features
and owner acceptance require separate evidence.
