# Actual application 1: saved Stage 4 portable/public consumer preparation

Status: PASS for unchanged static consumer preparation and offline supported
import/export roundtrip. No server, browser, device, provider, backend or owner
acceptance result is asserted here. No product/source edits or commits were made.

Exact saved source identity is `screen-d5c26246-953b-4a57-8e43-b78e8a56e9eb`, revision
`r1.r6`, from `stage-4-saved-source.json`. Raw canonical-source SHA-256:
`ec711fc2f4bd252945dba94485059d09973aec9e669ce003ca9cad218096be32`.
The actual supported export is 56,748 bytes with SHA-256
`ff7d25f0d233b04589308e234235d85826969b08eaa3f490b2e53d5a226e3919`.

## Public static preparation

The existing `prepare-export-device-preview.mjs` consumed that exact export using
the seven WhcDEI packs and successful inventory at product source
`72b7e09b1e6cbd5269578f3c3b1ccdf120a22c3b`. Every tar hash and all 510 installed
nonmanifest file hashes matched. Public compile/renderer validation passed. The
production build passed; its large-bundle warning is retained (about 1.32 MB JS,
360 KB gzip). No authored source, registration seed or fixture was substituted.

Static root ready for the parent's later native consumer review:
`C:/Users/RZ1/AppData/Local/Temp/vict-export-device-preview-stage4-20261030/dist`.
Preparation report:
`C:/Users/RZ1/AppData/Local/Temp/vict-export-device-preview-stage4-20261030/preview-report.json`.
Report SHA-256:
`97c1fd4bb7dbe5603baa10957370608331927d2df45bb0162c304cb1d037e688`.

The original export, copied public/application.json and built dist/application.json
have independently matching PowerShell SHA-256 values. The copied report and
logs are retained as `stage-4-portable-*`; the report inventory seals the exact
built files. No listener or activation was performed.

## Existing supported importer/export attachment roundtrip

`scripts/stage-4-portable-roundtrip.mjs` bundles the existing Studio
`prepareSourceImport` and authoritative `screenApplication` attachment into a
disposable Node entry, then uses the actual export and canonical source files.
It does not construct a replacement authored application fixture or mutate storage.

Both supported importer passes succeeded with zero staged media. The original
export document and both imported documents deep-equal the canonical saved source.
The authoritative application attachment matches the supplied application.
Re-exporting the actual imported document and existing archive through the normal
supported shape produces an envelope that is semantically equal **and byte
identical** to the input export. The second importer pass accepts it.

The retained graph snapshot is `evidence-graph`, revision 163, with three nodes,
two typed edges, parameter/port types, per-node values, labels and positions.
Those complete graph objects deep-equal after the roundtrip. All authored control
label source and bindings also remain identical through the complete-source
comparison. This is data/compile/import proof, not a new label-focus/touch test.

The baseline is saved Stage 4 only. It does not attribute Source 1's earlier
position change or claim its Stage 3 position was preserved.

The first disposable importer bundle used Vite's default browser target, which
refused top-level await in the Node validation entry. The initial build log and
this failed observation are retained. The script now explicitly targets Node 22;
the corrected run passed. Existing shared renderer Svelte warnings are retained
in the execution log; no product changes were made to suppress them.

Static preview limitations remain: catalog/Flow/Media registrations only, no
nonempty managed-media inventory, explicit unavailable backend actions,
session-only state, and no physical-device/secure-context feature proof.
