# Cycle 1.3 — reusable presentation, designer coverage and structure

> Current gate result, 2026-10-23: independent **PASS — ready for owner review** on product `e6fa5f976b71150d8c334d4a2bd973fd4a653012`, branch `codex/studio-cycle-1-3`; independent evidence `790b6b6e404407a4b313797fbcf1f33925cfe906` is pushed and remote verified. See the [final report and walkthrough](CYCLE-1-3-REPORT.md) and [independent verdict](CYCLE-1-3-INDEPENDENT.md). Owner acceptance remains pending. Original scope, failed observations and pause history are retained. Stage 9 remains reopened; no Cycle 1.4/Milestone 2 or merge/publication/deployment authority follows.

2026-10-23. EXECUTABLE owner-directed scope, recorded before implementation. Authority: the owner's attached “Own VICT Stage 9, Cycle 1.3 end to end” instruction, including the explicit shadcn-svelte/AI Elements and Svelte Flow decision. This supersedes earlier prohibitions on Cycle 1.3 and preserving custom chat presentation, only within this scope.

## Baseline and preservation

Repository: https://github.com/radz2291/vict-02. Fetched main is `d7401bef6e48330796c74ec00c86db9622d48cdf`; it is an ancestor of accepted Cycle 1.2 delivery `1bc56b1da30279baa6ca9dff21a56ec2baf2bd52`. Verified product `7874c64158b877c574ceff04e1917773bc03afe6`; independent evidence `567d6bc2e6028221b4e457e55e6e2521a4fcb3ed`. Cycle 1.1 closure `da1144c3332a0141aa778fcef26be1b8f6636b85` remains in lineage.

Original checkout main is `4d2df037d8a82d36c60bf1bff16919650643ce22`, behind remote, with untracked `victframework-builder-kit-0.1.0.tgz`. It is untouched. Clean isolated worktree `C:/Users/RZ1/.codex/worktrees/studio-cycle-1-3/260831-VCT-02`, branch `codex/studio-cycle-1-3`, starts at accepted delivery. Other checkouts remain untouched. Recheck remote lineage at gates; reconcile newer work, never overwrite it.

Preserve owner servers (historically 5591 and 5593), tabs, unsaved source/drafts/chat/history, saved screens and provider configuration. Inspect port ownership before an isolated review launch; use a fresh browser profile and disposable data. Do not rebuild another checkout or restart an owner process.

## Architecture and allowed paths

Keep `@victframework/ui` framework-neutral, and keep current source identities, compiler, canonical commands, EditorBridge, validation, history and persistence authoritative. No new workflow semantics or backend authoring. Existing VICT/Mastra execution, server credentials, acknowledgement after commit, stale/draft refusal and cancellation fences remain.

Use a specialist Svelte AI package for pinned upstream shadcn-svelte presentation and AI Elements; expose upstream-derived parts and a default conversation composition through public exports. Keep VICT message/tool/state mapping separate from those source components and Studio transport. Replace Studio's competing transcript/composer/tool presentation. Preserve compatible existing consumers through a documented migration where needed, rather than breaking saved documents or silently forking two Studio chat engines.

Use a separate Svelte Flow package for public canvas/controls/minimap/connections/extensibility, so unrelated UI consumers do not acquire specialist dependencies. VICT supplies source mapping and canonical command validation. Canvas positions/viewport are local presentation state, excluded from application identity and history. Studio's structure view represents actual containment, definitions and bindings; it must not call those executable workflows. Connections/edit controls only invoke supported canonical edits; refuse ambiguous/unsupported edits.

Pin immutable upstream source commits, licenses, dependency versions, provenance and local modifications. Inventory the complete selected AI Elements source family and record each pattern's reusable availability, Studio disposition and integration requirements. Controls for attachments, approval, branching or model selection require explicit host support and cannot imply Studio backend capability. Avoid duplicate incompatible Bits versions and global CSS resets affecting existing consumers. Compatibility proof must validate the exact installed versions and production CSS.

Allowed implementation paths: `packages/ui-ai-svelte/**`, `packages/ui-flow-svelte/**` (names may be refined by compatibility proof), relevant existing `packages/ui/**`, `packages/ui-svelte/**`, `packages/ui-editor/**`, `apps/studio/**`, a reusable showcase/isolated-consumer fixture under `examples/**`, associated scripts/tests, root workspace dependency/build configuration and lockfile, `docs/studio/**`, and dated current authority pointers. Existing foundation/frozen historical records stay intact. No unrelated runtime/server/CLI semantics or Quellight changes.

Audit actual catalog, renderer, palette, inspector and agent coverage independently. Expand supported components with usable properties, required slots and declared events through shared metadata/commands. Existing exports alone do not count as Designer support. Keep old document revisions and source compatibility.

## Gates and proof

1. Reconstruction/scope and upstream compatibility: current authority, baseline, immutable source/dependencies, complete inventory and concrete package/CSS boundaries.
2. Reusable packages: source attribution, public exports, default conversation, full explicitly supported pattern examples, Flow canvas and extensibility, tests and production build.
3. Studio integration: real VICT/Mastra chat, broader component authoring, actual source structure with selection and permitted edits, shared history/save/reopen.
4. Independent verification: fresh-context verifier against exact committed/pushed candidate; preserve failures, repair in scope and reverify affected claims.

Required proof: relevant types/build/regressions; real-provider chat-to-canvas; manual→agent continuation; Stop/stale/draft/delayed-frame races; Undo/Redo and Save/reopen including older saved source; keyboard/responsive/long-content/streaming/error presentation; newly exposed components via manual and agent paths; node identity/selection/edit refusal; clean packed-artifact consumer without Studio imports or repository aliases showing chat and Flow; dependency/CSS isolation. Distinguish simulated from provider evidence. Test counts never substitute for coverage.

At completed gates commit/push candidate and evidence, verify exact remote SHA. Builders produce candidates; fresh independent verifiers supply verdicts. User permits delegated builders/verifiers and routine repair coordination. Final report gives full branch/SHA, pins/boundaries, coverage/omissions, independent verdict, retained findings, launch and short walkthrough.

Stop only at independently verified Cycle 1.3 ready for owner review, or a concrete unresolved authority/environment blocker. Do not mark owner acceptance, start Cycle 1.4/Milestone 2, merge main, publish, deploy or close Stage 9.
