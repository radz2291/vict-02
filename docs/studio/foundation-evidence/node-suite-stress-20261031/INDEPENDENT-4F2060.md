# Independent replay recheck and public capture artifact qualification

31 October2026. Exact integrated source `4f2060a1140c770a468d713b4aeddd5372672e1c`, including replay repair10fdf9d6. Isolated review branch `codex/independent-replay-recheck-20261031`, same independently installed checkout. Earlier branches and RED evidence remain preserved. No product source repair, provider/browser/account operation, activation, push, merge or acceptance occurred.

**Focused offline/source repair PASS. F-LIMIT-01, F-LIMIT-02 and the fast-backlog defect are closed on this exact source. Full integrated verdict remains HELD** pending final class/diagnostic/protocol integration, production build association and actual UI checks.

Own three retained independent tests now pass: blocked concurrent publication cannot overtake its earlier async sink; registration delivers replay/live overlap `[1,2]` rather than `[2,1,2]`;4097 historical durable rows reach a fast subscriber with no overflow. The shared repair snapshots the replay watermark/transients at a short publication barrier, releases that barrier before page/sink waits, streams history to fast sinks, and deduplicates/merges newer live captures in order. Slow-sink queue overflow remains explicit, with acknowledged cursor progress available for reconnect. No task ceiling was replaced by a larger constant. Same-stream awaited reentrant publication is explicitly documented as incompatible with strict delivery ordering; no such existing sink usage was identified.

Independent runtime/conformance/real HTTP SSE batch47/47 PASS, additional replay-handoff/direct-registration15/15 PASS:62 total distinct test cases. These cover captured admission bytes, failed append and rejected sink without poisoned tail, cross-stream independence, historical/live/transient overlap, pending pull protection, slow reconnect progress, transient rollover around snapshot, and abort/unsubscribe during blocked delivery/read. Actual pinned offline Mastra completion beyond64 tools, initial blocked sink cancellation, and own later blocked tool-result/late-rejection probe3/3 PASS,10 unselected skipped. Runtime TypeScript build PASS. No new blocker was found in the inspected replay source.

Commands from the review root; exact logs under `independent-4f2060/`:

```text
npx vitest run --project unit packages/runtime/test/independent-limits-ordering.test.ts packages/runtime/test/independent-hub-replay-race.test.ts packages/runtime/test/independent-hub-fast-backlog.test.ts packages/runtime/test/stream-concurrent-publication.test.ts packages/runtime/test/stream-subscriber-backpressure.test.ts packages/runtime/test/stream-subscription-replay.test.ts packages/runtime/test/agent-control-conformance.test.ts packages/server/test/sse.test.ts
npx vitest run --project unit packages/runtime/test/stream-replay-handoff.test.ts packages/runtime/test/direct-registration-atomicity.test.ts
npx vitest run --project mastra packages/mastra/test/adapter.e2e.test.ts -t "independent: later|before a blocked|more than 64"
npm run build -w @victframework/runtime
```

The first command included a nonexistent stream-subscription-replay filter, which selected no file under that name; its seven real selected files all passed. The actual handoff suite and direct-registration tests were subsequently selected explicitly in the separate15-case command. No missing file is counted as tested.

## Public capture artifact PASS — closes D830 checkpoint qualification

The source/offline capture/context checkpoint is verifier commit `5e00c50f13fceb57c0351983b2f1affb1b3f92e1` (`INDEPENDENT-D830.md`): shared57/57 and Studio44/44 PASS on exactd830. That report explicitly left the newly published ./capture subpath qualification pending. It is now independently PASS through an actual local tarball install and server bundle. `git diff d830c7f0..4f2060a1 -- packages/ui-ai-svelte` is empty, so those exact capture bytes remain unchanged here.

Probe source is retained in commit5e00c50f at `docs/studio/foundation-evidence/node-suite-stress-20261031/independent-capture-public.mjs`. It packed the independently built UI-AI package, installed the tarball in a new external consumer with scripts disabled, bundled the actual public subpath with esbuild's Node target and no aliases, verified the metafile contains installed package paths rather than repository source, and imported all public capture exports under document/window getters that throw if touched. Pure JPEG dimension admission and the public raster function export were checked successfully. Installed rasterizer dependencies were resolved from the consumer; no private Studio imports were used. This is a server-import/bundle boundary proof, not a browser raster quality proof.

- Consumer: `C:/Users/RZ1/AppData/Local/Temp/vict-capture-public-independent-SaZRM0`
- Installed entry: `node_modules/@victframework/ui-ai-svelte/src/capture.ts`
- Tarball SHA256: `e6c54a7be4b47e8a7dbd3a011293d4595806fdc766c120d4d6d786c3e76823e3`
- Full installed paths, bundler inputs and result: `independent-4f2060/independent-capture-public.json`.

The package deliberately exports TypeScript source, following its existing Svelte packaging convention. Plain Node22 without a loader/bundler cannot directly import .ts; that retained launcher observation is disclosed in the D830 checkpoint, and is not a DOM failure. The successful actual installed server-bundle result supplies the intended SSR qualification.

Next allowed action: integrate final authorized class/diagnostic/protocol changes, recheck only changed source and relevant negatives, associate the exact production build, then perform authorized actual UI verification while preserving saved owner apps and previous failed trials. Offline passes do not establish actual-agent completion, owner acceptance or Stage9 closure.
