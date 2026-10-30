# Native continuity — final affected regression review

**Interim affected-regression PASS** for exact product source
`72b7e09b1e6cbd5269578f3c3b1ccdf120a22c3b`, subject to the explicit offline
scope below. This is not a whole Foundation verdict. Actual applications,
physical devices, integrated exit and owner acceptance retain their separate
gates. No new browser/native typing or device result is supplied here.

## Identity and selection

Independent checkout `C:/Users/RZ1/.codex/worktrees/vict-realignment-independent-20261030`,
branch `review/native-continuity-20261030`. Starting review HEAD is
`edd1ad01ab28cc09a83c929d1377ff375fd180df`; later commits contain only independent
probes/reports/evidence. A direct diff against source72 confirms no changes to
`packages/ui-svelte/src`, `packages/ui-media-svelte/src` or `apps/studio/src`.

DocumentHost now preserves native DOM through same-document source echoes. That
new lifecycle warrants one relevant popup/focus/nesting/media regression pass;
earlier unchanged evidence alone is insufficient for this affected renderer.
Selected existing suites cover owner-local nested popup arbitration, dialog
focus containment/capture, adopted nodes, source visibility/removal, local slot
scope/registration, registered media consumers and Studio capture fences. This
selection supplements the previous independent native-continuity 11 renderer /
20 Studio tests and WhcDEI artifact recomputation, without repeating them.

## Commands and observations

From repository root:

```powershell
npx vitest run --project renderer packages/ui-svelte/test/owned-popup-core.test.ts packages/ui-svelte/test/owned-popup-adopted.test.ts packages/ui-svelte/test/owned-popup-independent.test.ts packages/ui-svelte/test/owned-dialog-adopted.test.ts packages/ui-svelte/test/owned-dialog-focus-capture-independent.test.ts packages/ui-svelte/test/authoring-slot-forwarding.test.ts packages/ui-svelte/test/document-extensions.test.ts
npx vitest run --config packages/ui-media-svelte/vitest.config.ts packages/ui-media-svelte/test/consumer.svelte.test.ts packages/ui-media-svelte/test/library.svelte.test.ts packages/ui-media-svelte/test/embed.svelte.test.ts
```

- Renderer: **44/44**, seven files, exit 0.
  Raw log: `independent-final-affected-renderer.log`.
- Media: **15/15**, three files, exit 0.
  Raw log: `independent-final-affected-media.log`.

From `apps/studio`:

```powershell
npx vitest run tests/ui/designer-capture-portals.test.ts tests/ui/designer-capture-images.test.ts
```

Studio: **8/8**, two files, exit 0. Raw log:
`independent-final-affected-studio.log`.

Existing Svelte initial-value/accessibility warnings remain in the logs. The media
suite intentionally disables iframe page loading. Its retained NotSupportedError
diagnostics state that loading is disabled; synthetic load/error/timer events
exercise lifecycle, without remote embed loading or playback evidence. Capture
integration uses mocked rasterization and deterministic geometry, so it proves
ownership/fingerprint/refusal behavior rather than native pixels or screenshot
fidelity. No failed test observation is suppressed.

## Existing exact72 checks reused

No product source changed since the already validated exact72 production and
static checks. Inspected the parent's production completion log and the committed
renderer/static-check receipts rather than re-running their builds:

- `native-continuity-production-build.log` under the parent architecture evidence
  directory ends in successful completion; stage manager reports exit 0.
  SHA-256: `a4c2e931d18eaf7519384eb94bd4f198b33171cc53c9d07724f54df5733173e5`.
- `actual-agent-live-20261030/native-continuity-renderer-check.log` reports
  **0 errors / 5 warnings**.
  SHA-256: `9fe29e5e84a27144510f5b40f1c006a3b7d739721e2a0a76e80973d7380f08e5`.
- `actual-agent-live-20261030/native-continuity-studio-typecheck.log` is the empty
  successful TypeScript output retained in the exact72 builder evidence. Its
  exit 0 is recorded by that builder report; empty bytes alone do not prove exit.
  SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

Parent activation receipt `NATIVE-CONTINUITY-ACTIVATION.json` identifies exact72
and the prior independent source/artifact reviews. This lane did not reproduce
activation, inspect the live browser or award its reported native observations.

## Disposition and next boundary

No affected regression finding is established by the completed tests. Raw output
is retained, including diagnostics and trailing terminal blank lines. Existing
native source/history/ownership findings and qualified source verdict remain in
their original reports. The stage manager may integrate this interim evidence
with separate actual-agent/application/browser/device work; those gates must
be satisfied on their own evidence before requesting owner acceptance. No push,
merge, publication, service activation or Stage 9 closure is authorized by this
report, and none occurred in this lane.
