# Media, icon and vector portability lane — 2026-10-28

Base at lane start: `59212b031d49163f7e1ebc40088f6a8ab2ae1b1e`.
Scope: source/evidence review for AR-22/28/29 and CF-01, plus one reproduced export repair. No browser, provider, server, production build, dependency installation, staging/commit or publication action occurred in this lane. Root owns live evidence and integration.

## M-EXP01 — corrupt/substituted bytes exported as a successful archive

**Reproduced FAIL before repair.** `exportMediaArchive` called `store.get` directly, unlike renderers using `readManagedMediaAsset`. A custom store returning an original PNG's metadata with changed bytes produced a successful archive retaining the old digest. Import would later reject that archive. A requested reference could also be substituted with another valid stored asset. This contradicts a successful portable-byte export and bypasses the established verified-byte boundary.

Bounded repair: only `packages/ui-media-svelte/src/assets.ts` and `test/assets.test.ts`. Export now calls `readManagedMediaAsset(ref, store)` before accounting and encoding each selected member. The existing verifier enforces the requested reference, actual signature, metadata, digest and size. Existing 100-asset/64 MiB aggregate bounds, archive schema, canonical references and successful round-trip format stay unchanged. Export still performs no store writes; an invalid member rejects before a download is produced. No new media or interaction infrastructure was added.

Evidence retained:

- `archive-export-red.log`: targeted original failure, 1 failed / 15 skipped; invalid archive resolved rather than refusing.
- `archive-export-green.log`: affected assets test file, **16/16 PASS**, including corruption/substitution refusal, successful archive round trip, invalid import atomic validation and existing vector cases.
- `media-types.log`: package TypeScript `--noEmit`, exit 0.
- `review.json`: source SHA-256s, scope, commands/results and exact edited paths.

Commands were run in the existing checkout using its installed toolchain. The Vitest command used `--config packages/ui-media-svelte/vitest.config.ts` with only `assets.test.ts`; task-scoped TEMP/TMP avoided known sandbox cache issues. No unrelated package suites were rerun. This is builder source/test evidence, **not an independent verdict or a running-build/browser pass**. Root must associate the repair with a committed candidate and load/build it as appropriate before making post-repair runtime claims.

## Reviewed paths and current guarantees

| Area | Source/evidence supports | Required live proof / limit |
| --- | --- | --- |
| Upload/storage | Allowed file types/signatures, SHA-256 references, verified store puts, explicit namespace, partial-upload notices and preserved successful bytes. File input is native; toolbar actions reuse public VICT Button. | Actual file chooser upload, image decode and real IndexedDB persistence. Signature admission is not codec/decode proof. |
| Image | Managed verified URL resolution/release; alt/fit/aspect props; loading, loaded and error state; typed loaded/failed outputs. | `complete`, natural 320×180 dimensions and correct crop in authored preview/Run, not just an img/blob URL. |
| Video | Source/poster/captions all resolve through shared boundary; missing managed auxiliary bytes refuse; native controls/playsinline; playing/ended/failed outputs. | Native play/pause/seek/replay, advancing time/duration, visible supplied poster and cues, keyboard. Audio only if actually heard/measured. No DOM-only test establishes playback. |
| Embed | Only approved YouTube/Vimeo identities; explicit host opt-in; invalid/disabled policy has visible error; titled lazy iframe. Studio Design and saved Run enable those two providers. | Cross-origin load/playback/failure cannot be inferred from iframe presence. Current component has policy/data error UI but no explicit network-ready/failure lifecycle UI; do not relabel disabled-provider refusal as a demonstrated remote loading/failure pass. No remote request was made by this lane. |
| Custom icon/vector | Supplied versioned Lucide manifest, inert vector/managed SVG alternatives, brand paint preserved; `scopeVector` gives per-occurrence local IDs; native SVG specialist path documented. | Two actual SVG instances plus custom icon source: distinct IDs and correct local fill/clip references, visible multicolour paint, semantic naming and theme recolouring of supplied monochrome icon. |
| Source/byte portability | Studio importer inventories direct/saved-state/token/conditional media props, image-carousel sources, graph media/icon fields and digest declarations; imports verified archive into staging before fresh namespace. Unprovable computed/runtime media dependencies refuse. | Source + media export/import into a separate new screen on the same approved origin; actual decode/playback/vector after import. Retained installed-consumer build does not prove browser portability. |

Custom host icon registries/components are not automatically serialized by exporting a UI document. For the current durable custom-icon trial, use the declared managed SVG `source` or inline `vict.vector@1` data. Explicit `data` takes precedence over `source`; Studio's explicit attachment action clears inline data with the required warning. Do not assume a runtime custom host registry becomes a portable authored asset.

## Existing retained evidence reused

The current status retains media package checks, Studio import checks and a fresh nine-package installed-consumer build with bytes association (`owned-popup-review-20261028/final-verification.json`, `independent-associated-source.json`, `packed-consumer-vict-foundation-consumer-hLsCWA.json`). Those remain supporting proof for their stated snapshots. The new export repair changes one source body, so the old artifact hash is not a post-repair binary claim. There was no reason to repeat the full renderer/AI/pattern/consumer ladder in this lane.

## Ready local files for root's browser run

Folder: `packages/ui-media-svelte/test/fixtures/foundation-media` (absolute root is the current checkout). Its existing README/manifest describe locally generated, unpaid synthetic content; the files are real importable media bytes, not a substitute for actual authored-app/agent proof. `fixture-hashes.json` freshly verifies every file's SHA-256 and the five valid references against the existing manifest.

| File | Expected root browser observation |
| --- | --- |
| `synthetic-image.png` | 320×180 colour pattern; actual successful decode |
| `synthetic-poster.png` | Different dark-blue poster/yellow frame before playback |
| `synthetic-video.mp4` | Approximately 2 s H.264/AAC moving pattern at 320×180; synthetic tone requires separate audio proof |
| `synthetic-captions.vtt` | Two cues, changing at 0.9 s |
| `synthetic-brand.svg` | Original multicolour gradient/clip mark with local references |
| `synthetic-invalid.mp4` | Plain text; explicit upload signature refusal, no new library item |

## Minimal browser checklist (root only)

1. Wait for the active AI trial to settle. Use a separate test screen on the **same approved `127.0.0.25:5626` origin**. The old fixture README's alternative-host instruction is historical and superseded by current browser/origin restrictions. Preserve owner screens and storage.
2. Open Document → Data → Media and graphics. Upload the five valid files, record five MIME/name/size entries. Upload the invalid MP4 separately; retain refusal. Registry facts do not prove bytes or playback.
3. Use actual declared Image/Video/Vector/Icon recipes/contracts. Through the real explicit attachment flow, bind image source; video source/poster/captions; two vector sources; custom icon source. Merely selecting an asset must not change source before **Use on selected media**. Wrong MIME/field, mixed selection and pending drafts must refuse. Do not repeat the separately denied historical Undo.
4. In Interact, verify image `complete`/natural dimensions; observe the poster, native playback time/motion, pause/replay and two captions. Exercise native keyboard. Check responsive sizing at wide/390 px without calling it a physical-device test.
5. Inspect two vector gradient/clip IDs and local references, and preserve brand colours while changing a supplied `lucide/search@1.27.0` icon's inherited/theme colour. Confirm meaningful/decorative accessibility separately.
6. Save/reopen the same test screen, open saved Run and repeat decode/playback/vector essentials. Export the source plus media archive; inspect digest refs and verified bytes. Import into a new screen/namespace using Studio's supported bundle importer and repeat essentials. No persisted blob URL should be an identity.
7. Use a fresh test namespace or copied source without bytes for honest missing-asset failure; never clear owner storage. Challenge permitted embed behaviour separately and disclose cross-origin limits. Keep applied source, actual loading/playback, captions, source persistence, Run, portability, device and independent evidence separate.

Current lane result: **one bounded source repair tested; AR-22/28/29 integrated acceptance remains HELD** pending independent review and root's actual authoring/browser evidence. No owner acceptance inferred.

## Follow-up: bounded Embed lifecycle repair

The initial Embed row above describes the pre-extension source snapshot. Root explicitly authorized this repair after the source gap was reported. Existing descriptor/pin and `root`/`frame` parts remain unchanged. Only `src/Embed.svelte`, new `test/EmbedHost.svelte` and `test/embed.svelte.test.ts` are involved; the archive repair remains separately documented above.

The root now reports `aria-busy` and inherited semantic status while awaiting the native frame. After ten seconds of elapsed waiting it displays a neutral delayed-loading message without changing or aborting the request. The iframe's native error event displays `Embedded frame could not be loaded.` and hides the failed frame. Its native load event only removes the loading indicator; it does not claim that a provider video is playable, authorized, available or actually playing. The existing provider allowlist, URL builder, native lazy/titled iframe, referrer policy and allowed capabilities are preserved. There is no new provider, retry action, cross-origin read or active network probe.

A keyed source replaces the iframe when its URL changes. Load/error handlers accept only the currently bound frame whose `src` matches the current resolved URL; previous-frame events cannot settle a replacement. The source effect cancels its delay on source/policy change and unmount, and has an active-lifetime fence for already queued callbacks. Load/error cancel the current delay. A failed frame stays failed until source replacement; a late native load cannot relabel it as successful. Root/frame authoring styles still target the actual existing surfaces; the small status text inherits colour and typography rather than adding a parallel control system.

Evidence:

- `embed-before.svelte.txt`: complete original source snapshot.
- `embed-lifecycle-red.log`: original source failed all four initial lifecycle challenges (missing loading/busy/delay, same-frame source reuse and absent timer lifecycle).
- `embed-lifecycle-green-first.log` and `embed-lifecycle-green-recheck.log`: three passing cases/one over-broad fake-clock assertion failed. The assertions expected all global timers to be zero after a synthetic error; Happy DOM adds an immediate error-notification task. The retained `embed-lifecycle-timer-probe.log` distinguishes that task (undefined/zero delay) from the component's already expired 10-second delay. The test drains only immediate work, so an actual leaked 10-second timer would remain and fail. A separate early-error test now verifies pending-delay cancellation and new-source recovery. No network loading was enabled to make the test pass.
- `embed-lifecycle-green-final.log`: **5/5 PASS**, fake-clock/synthetic native events only. Cases cover initial load without playback claims, measured delay/native failure, early error cleanup/recovery, replaced-frame event/timer fencing, disabled-policy refusal and unmount cleanup.
- `embed-policy-regression.log`: existing registered consumer native-attributes/allowlist regression **1 PASS / 5 unselected**; no broad consumer suite rerun.
- `embed-svelte-types.log`: two test-only generic annotation errors retained; annotation repaired without runtime/assertion change.
- `embed-svelte-types-recheck.log`: **0 errors / 5 inherited warnings** in the existing renderer files. The direct checker emitted no production build or dist.
- `embed-lifecycle-review.json`: exact source hashes and scope. No descriptor or compatibility pin changed.

Tests use the existing config's disabled iframe page loading; Happy DOM logs its deliberate `NotSupportedError` for attempted virtual frame loading. These are offline lifecycle/control-flow checks, not proof that YouTube/Vimeo loaded in a real browser. Browser security may deliver provider/HTTP failures as frame load events rather than native errors; the component does not infer those inaccessible outcomes. The delayed message measures waiting after source configuration, not network/provider latency. Root still owns real allowed embed/browser evidence and independent final review.
