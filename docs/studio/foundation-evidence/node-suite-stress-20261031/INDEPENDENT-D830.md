# Independent capture and start-context review

31 October2026. Exact integrated candidate `d830c7f00b4f0e3a4038daf1b4619f5246188ddd` (capture ba90c46b, context f038968f), isolated branch `codex/independent-capture-context-20261031` in the existing independent checkout. Prior review branches and RED observations remain preserved. No product repair/provider/browser/activation/push occurred.

**Focused source/offline capture and context PASS, with installed public capture artifact verification still running at this checkpoint. Full integrated verdict HELD.**

Own UI-AI and runtime builds pass. Shared capture57/57 PASS. Installed-workspace Studio observer/upload/client/context/executor/UI tests44/44 PASS across8files. These are deterministic offline/DOM tests, not actual provider image interpretation or native browser proof. Exact commands/logs are retained under `independent-d830/`:

```text
npm run build -w @victframework/ui-ai-svelte
npm run build -w @victframework/runtime
npx vitest run --config packages/ui-ai-svelte/vitest.capture.config.ts
```

From apps/studio:

```text
npx vitest run tests/designer-visual.test.ts tests/designer-visual-independent.test.ts tests/designer-visual-client.test.ts tests/agent-start-context-limits.test.ts tests/designer-cycle14-efficiency.test.ts tests/ui/capture-filter-independent.test.ts tests/ui/designer-capture-portals.test.ts tests/ui/completion-independent-stop-capture.test.ts
```

Reviewed checks exercise full DOM traversal past2000nodes with late unsupported paint refusal; same-origin owned credential-free blob resources; hostile origins/redirects/live-media/APNG/unsupported transforms and fonts; actual viewport intersection/crop reporting; large raster/data/SVG; optional consumer-selected bounds; actual canvas/JPEG admission; and cancellation with an unabortable rendering promise. Owner cancellation releases its wait but retains the shared engine quarantine until the actual promise settles. The test advances past the former8-second limit before cancellation, then confirms subsequent work refuses until real settlement and can recover afterwards. No claim is made that cancellation killed library work.

Observer checks retain exactly supplied long assessments and original public text without token/line/count/deadline quotas, while enforcing strict fields/types and semanticClaimsVerified:false. Before/after image digests are SHA256 of separate admitted owned byte copies; source/preview/viewport metadata must also match. Source fingerprints are not pixel digests, and equal pixels across separate observations do not imply stale rendering. capturedAt is provenance rather than a task deadline. Single-use pending capture IDs remain session-bound; revision/digest/epoch and live preview fences remain. Multipart requires exactly metadata and JPEG image; legacy JPEG/header read compatibility, CSRF/auth, wrong owner/source, stale pixels/metadata, portal exclusion, Stop and late upload rejection pass.

Central start policy removes only duplicate passive string/geometry limits: closed shapes, safe finite/nonnegative/positive geometry, UUID epoch and exact document/source identity still refuse malformed/foreign requests. Public revisions are instructions15/profile17/start5/observer7+11 at this exact candidate. Later protocol increments from the separately assigned class/diagnostic repair are not yet reviewed here.

## Public artifact qualification

The ./capture export follows this Svelte package's existing TypeScript-source distribution convention. Plain Node22 without a TS loader cannot directly import it (ERR_UNKNOWN_FILE_EXTENSION, retained as a harness observation); this is not a DOM-access failure. The independent packed-package server-bundle probe `independent-capture-public.mjs` packs the actual package, installs it into a new external consumer without source aliases/private imports, bundles the public subpath, checks the metafile resolves installed files only, and imports under throwing document/window getters. Its install was still running when this checkpoint was recorded; no artifact PASS is implied yet. The later exact result and tarball digest must be associated before closing this qualification.

## Additional confirmed replay ceiling

Root requested a fast-backlog challenge. Own `packages/runtime/test/independent-hub-fast-backlog.test.ts` on this exact candidate publishes4097 durable rows, then subscribes a synchronous fast sink returning true. It overflows the default4096 registration queue before any historical delivery; retained RED1/1. Reconnecting at the unchanged cursor repeats the problem. This is a pre-existing replay-registration behavior, not a capture regression. Parent's separate replay repair must stream historical pages to a fast sink, retaining explicit actual slow-sink overflow/reconnect policy. Earlier F-LIMIT-02 race and this ceiling remain open until an exact successor recheck.

```text
npx vitest run --project unit packages/runtime/test/independent-hub-fast-backlog.test.ts
```

Capture source reviewed here shows no additional blocker. Remaining gates: packed public capture qualification, replay repair, final class/diagnostic/protocol source, exact production build association and actual UI verification. No all-limits-gone claim, owner acceptance or Stage9 closure is supplied.
