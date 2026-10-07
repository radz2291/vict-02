# U3 experience repair integration handoff

The repair gives the fictional inspection application a clear queue, status and next action, readable findings/evidence, one role-appropriate decision area, integrated correction forms, and one chronological activity trail. Demo controls live in a compact disclosure. Terminal records have no enabled approval affordance.

Primary launch: [VICT Inspections](http://127.0.0.1:5221/). Founder instructions: [walkthrough](WALKTHROUGH.md). This is a local fictional demo, not a deployment.

## Authority and candidate

- Repository: `radz2291/vict-02`; remote `https://github.com/radz2291/vict-02.git`.
- Isolated branch: `codex/ui-foundation-u3-experience`.
- Entry U3 records: `aaeea16f9cabccad05650eefdd8771c756326f17`.
- Main baseline: `4d2df037d8a82d36c60bf1bff16919650643ce22`.
- Initial implementation candidate: `8d99f3645691b4c3882cdfe88f298d6f0306eae0`.
- Repaired implementation candidate: `e0dd026e3fe08cf979d6625a88828e295f23dba6`.
- Owner instruction is preserved [verbatim](OWNER-INSTRUCTION.txt). Original U3/U2 reports, frozen contracts, manager branch and main checkout are preserved.

Candidate 1 failed independent experience review for misleading scenario controls. Candidate 2 separates simulated record presets from outcome-console cases, explains persistent saved records, and improves current-state refusal feedback. Final records are a documentation/evidence-only descendant of candidate 2; they do not change the reviewed implementation.

## Independent verdicts and evidence lineage

- [Technical candidate 1](technical-review/TECHNICAL-REVIEW-01.md): technical core passed; complete gate held for required experience repair. Preserves independent 131 renderer tests, 68 application tests, 4 integration tests, checks/builds, source ownership and both-adapter correction probes. Actual process termination/relaunch recovered SQLite approval, with simulated reset as negative control.
- [Experience candidate 1](experience-review/EXPERIENCE-8D99.md): FAIL for misleading demo outcome controls; all successful flow/edit/width evidence and failed observations retained.
- [Technical candidate 2](technical-review/TECHNICAL-REVIEW-02.md): PASS with retained limitations on exact `e0dd026e3fe08cf979d6625a88828e295f23dba6`; independently reran application 68/68 and Svelte check, reviewed the four-file repair delta. Unchanged generic/runtime paths carry explicit candidate-1 evidence rather than a claim of a full rerun.

- [Experience candidate 2](experience-review/EXPERIENCE-E0DD.md): PASS on exact `e0dd026e3fe08cf979d6625a88828e295f23dba6`. Repeated actual return → correction → resubmission → approval, keyboard/focus, recovery and widths. Ordinary Inspector edit rendered 42px in both Canvas and normal product at stored revision 5, then Undo/Save restored 32px at revision 6. [Saved-edit proof](experience-review/final/saved-edit-proof.json), [responsive measurements](experience-review/final/responsive-metrics.json). Final browser and server are restored to normal simulated supervisor queue.

Both independent reviews pass the repaired candidate within their stated limits. Owner experience acceptance remains pending; these verdicts do not close U3. The final delivery message supplies the verified pushed record SHA. Reviewed implementation bytes are unchanged in the evidence commit.

Readable before/after: [original queue](before/queue-1440.png), [repaired queue](experience-review/final/queue-1440.jpg), [original detail](before/detail-1440.png), [repaired detail](experience-review/final/detail-1440.jpg). Original screenshot SHA-256 hashes match the preserved U3 verifier files; see [baseline evidence](builder/baseline-and-preservation.json). The browser reports identify screenshot candidate and viewport; full-page image height can exceed viewport height.

## Integration surface

[Changed paths](CHANGED-PATHS.txt) lists every path changed from the entry records. Presentation/document/host changes are in `examples/ui-authoring-proof`; generic renderer integration is in `packages/ui-svelte` and forwarding is in `packages/ui-editor/src/EditorCanvas.svelte`. No domain, durable adapter, server operation implementation or preview-session implementation changed. No frozen contract changed.

Public additions:

- `UiSvelteExtensionProps`, `UiSvelteExtensionImplementation`, and explicit registration resolver/types exported from ui-svelte. Registrations match extension ID, revision and renderer implementation identity exactly.
- `DocumentHost.extensionDescriptors`, `.extensionImplementations`, and `.stateValues`. State values accept only declared, type-compatible primitive local state. The latter seeds SSR and subsequent orchestration without replacing authored form typing.
- `EditorCanvas.extensionImplementations` and `.stateValues`, forwarded alongside its existing descriptors to the same renderer.

Descriptors with events/slots are deliberately unsupported by the current props-only renderer bridge and fail visibly. Missing/ambiguous implementations produce diagnostics and a safe unavailable placeholder. Extensions receive no runtime dispatch authority; authored interactions remain authoritative requests to the existing runtime.

Mount `@victframework/ui-svelte/styles.css` once, wrap the product in `.vict-app`, register the same descriptors/implementations in Canvas and product, and provide the named `inspection` inline-size container for the document's container conditions. The projection resource `inspectionQueue` is read-only rendering metadata for the existing list; it adds no stored facts or operations. [Reuse and ownership map](REUSE-AND-OWNERSHIP.md) explains source/host boundaries and legacy catalog connections.

## Builder validation

- Renderer: 131 tests across 20 files passed.
- Proof application: 68 tests across 9 files passed, including correction/lifecycle, permissions, expected revisions, replay, reset/fencing and SQLite conformance.
- Relevant integration: 4 tests passed.
- Root TypeScript, ui-svelte Svelte check, example Svelte check, formatting and production build passed. Svelte checks retain two original noninteractive-text selection warnings.
- Same repaired source in simulated/durable mode has equal queue, detail and binding digests and application version; both approve to revision 4 with the same trail. SQLite close/reopen retained approval. [Parity evidence](builder/parity.json).
- Initial failures are preserved in builder logs and explained in the ownership map. `builder/approved-1440.jpg` was captured before an asynchronous operation settled and is not used as proof of terminal approval.
- Repaired candidate application checks again passed: 68 tests and Svelte 0 errors / 2 retained warnings, plus production build. An attempted nonexistent npm check script is retained as a harness failure, followed by the correct Svelte check. Explicit Prettier parsing of Svelte paths is unsupported by this repository's formatting setup; Svelte files remain governed by the actual Svelte checks.

## Local launch from a fresh checkout

Use Node 22.13 or newer with built-in SQLite support. From repository root run `npm ci --ignore-scripts`, `npm run build`, and `npm run build -w @victframework/ui-preview`. Then from `examples/ui-authoring-proof` run `npm run build` followed by PowerShell:

```powershell
$env:PORT = '5221'
$env:HOST = '127.0.0.1'
$env:U3_DURABLE_DB = "$env:LOCALAPPDATA/Temp/u3-experience-product.sqlite"
node build
```

Open the primary launch URL. Simulated/Saved locally storage is explicitly labelled; unavailable modes do not claim durable success. The browser authoring store is per origin. Existing valid saved presentation may replace the bundled detail source; incompatible bytes remain preserved with a disclosed fallback. The queue is authored canonical source but the bounded browser editor currently edits detail only. `?frame=480` constrains the containing product region while retaining a wide viewport for container-condition review.

## Limits and retained findings

Evidence image references remain labelled placeholders. Opaque extension internals do not become visually editable source. Studio preview dispatch retains its prior bounded operation coverage. Historical U3 N-1 error ordering, N-2 build prerequisites and N-3 table upsert notes remain; U2 F3 dist packaging readiness and F4 scope persistence remain with their original tracks. This repair makes no U4 packaging or Stage 9 claim.

Independent ui-editor workspace build reproduced the accepted U2 F3 failure (four TS2307 Svelte declarations); public source exports and actual product builds work, but dist readiness is not claimed. A concurrent build initially replaced generated chunks under the running product server and yielded a missing-record 500; that failed screenshot is preserved. All final browser checks use a clean rebuilt/restarted server, and builds must be coordinated with live review.

Owner experience acceptance remains pending. Next allowed action is manager integration of this reviewed repair followed by independent verification of the combined candidate. Do not close U3 or continue U4 merely because this branch is pushed.
