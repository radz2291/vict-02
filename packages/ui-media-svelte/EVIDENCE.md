# Package G builder evidence — media, icons and vectors

2026-10-27. Candidate work is in the shared isolated `codex/authoring-foundation` worktree; root stage manager owns commit identity, Studio integration and independent verification. This is a builder report, not AR-22/28/29 closure or owner acceptance.

Implemented six registered canonical authoring components (`vict.media.image`, `.video`, `.embed`, `.icon`, `.vector`, `.asset-library`), initial descriptor/capability pins and package-owned discovery knowledge. Added an explicit asset host, digest-addressed reference lifecycle, browser IndexedDB store, memory test host and portable archive import/export. Byte signatures, MIME, digest/size and inert SVG geometry are validated. A bounded supplied Lucide manifest supports semantic paginated search; custom icon pack registration and authored custom vector/source icons preserve provenance, licensing and brand colours. Editable SVG data supports shapes/groups/transforms, gradients/stops, clips/masks and occurrence-scoped references without raw markup insertion.

## Checks

- `node node_modules/vitest/vitest.mjs run --config packages/ui-media-svelte/vitest.config.ts`: **17/17 PASS**, two test files. Final run duration 8.17 seconds. Tests exercise canonical registry pins/seeds, actual Svelte renderer consumer, accessible supplied icons, custom pack metadata, repeated multicolour SVG namespace/ID isolation, native video/track attributes and host embed policy, source serialization, digest-preserving archive replay, byte cloning, corrupted archive atomic validation, missing assets, forged media/digests, executable source/vector refusals and explicit object-URL release.
- `node node_modules/svelte-check/bin/svelte-check --tsconfig packages/ui-media-svelte/tsconfig.json --output machine`: final follow-up **0 errors / 5 warnings** across 1,003 imported files. All warnings are imported from existing `ui-svelte` RenderNode/DocumentHost.
- Scoped TypeScript/JSON/README Prettier formatting completed. No commits or pushes by this builder.

## Retained failed observations

1. Initial file-add action was denied by automatic approval review for missing trusted owner implementation approval. No files were changed. Parent then supplied the actual owner approval transcript; one retry succeeded. No shell workaround or delegated bypass occurred.
2. Initial sandbox Vitest collection failed with EPERM during temporary cache rename; zero tests ran. Supported escalated execution was then approved.
3. First collected candidate: 13/15 PASS. Archive import generated a fresh createdAt instead of preserving the archive metadata; fixed by validated metadata preservation. Svelte reactive vector proxies failed `structuredClone`; fixed by validated JSON copying. All affected cases pass afterward.
4. Initial type check had three package errors (BlobPart's ArrayBuffer typing, nested component occurrence/source identity props, optional ABI); fixed and rechecked.
5. First enabled-provider DOM test attempted loading an iframe, which was aborted during teardown. No remote playback or visual success is inferred. Tests now disable iframe resource loading and perform provider-URL attribute checks in a detached DOM; subsequent runs make no iframe requests.

## Required integration and proof still outstanding

The host must install the package registrations, wrap documents in `AssetProvider` with a stable application namespace, expose the live asset inventory to the agent, and connect supplied owner media to canonical asset/source edits. The authored asset-library emits a runtime selectedAsset output; that output alone does not create a canonical document asset declaration or persist arbitrary application runtime state. Root owns those seams and component icon-slot integration.

Browser-local bytes survive same-origin/namespace reopen by design; this implementation has not yet been exercised against actual browser IndexedDB. Portability requires carrying/exporting the media archive with source, or an explicitly supplied portable host store. The memory-store archive replay tests do not substitute for real browser persistence.

No real image decoding/remote image availability, video/audio playback, caption keyboard interaction, live cross-origin provider availability, real-device testing, final browser visual review, independent verdict or owner acceptance is claimed. Native media attributes and controlled DOM events are separate from playback proof. Embed providers default to disabled; root/consumer must explicitly enable supported providers without silently expanding host policy.

## Later approved integration preparation

- Added synthetic PNG/poster, a two-second 320×180 H.264/AAC test-pattern/tone video, two-cue WebVTT, an original gradient/clip SVG and an intentionally invalid MP4. No downloads or user media. FFmpeg 8.1.1 decoded the image and video with exit 0; ffprobe reports 2.000-second video/audio, 320×180 and 82,613 bytes. Absolute paths, hashes and a browser sequence are in `test/fixtures/foundation-media/README.md` and `manifest.json`. CLI decode is not browser playback proof; this builder did not open a browser.
- Added explicit complete vector grammar/multicolour example to discoverable media contracts, including canonical seeds/examples. Verified through the actual bounded contract-read API rather than README/source-only knowledge. Media package consumer tests remain **17/17 PASS** after this change.
- Under the manager's expanded path assignment, added `apps/studio/src/lib/designer/media-assets.ts` and focused tests: derived canonical digest references, a strict shared `AgentMediaInventory` schema (document/list time, at most100 actual metadata items, no bytes/provenance), optional sixth-argument media query/key/page reads, and side-effect-free explicit attachment drafts with type/selection/draft/revision checks. Updated only the assigned agent-read seam and its tests; root owns Designer/transport integration. Focused Studio media/discovery tests **22/22 PASS**.
- Source-reviewed root's explicit attachment wiring: pending selection does not attach, real store get precedes draft preparation, document/revision/selection are fenced across the await, and normal history applies the canonical change. This is source review, not hands-on verification or an independent integrated verdict.
- Retained source-review finding: a mixed multi-file upload can store early valid files, then skip refresh/host notification when a later file is invalid or a storage write fails. Validation is not a cross-file/storage transaction. Parent notified; no repair or browser reproduction claimed by this builder at this checkpoint.
