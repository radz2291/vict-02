# Builder-kit stable-layer regeneration — authoring-tools slice (2026-09-27)

## What happened

`verify:builder-kit` failed with `pack:regenerate-compare [content-drift]`
and `pack:renderings [generated-artifact-drift]` on the authoring-tools
branch: the committed stable layer was derived from the UI-convergence
workspace and no longer matched the workspace after this slice's changes
(`@victframework/cli` gained a runtime dependency on
`@victframework/application`; compiler/sdk/ui sources changed).

## Procedure

The kit's own freshness rule (BUILDER-KIT.md §2, the same mandated
procedure as the UI-convergence slice's FINDING-2 closure):
`npm run kit:generate`, twice, asserting byte-identical second
generation (determinism), then `verify:builder-kit`.

## Identity changes

| Artifact | Before (d86e9f2) | After (this branch) |
| --- | --- | --- |
| Base pack packId | `bed2e5c2d3ed5454a259163fdfc3d2b5e0f250520a9ff493ac3603a0584b4c14` | `f5a691a1f27eecccc0f96b4f23eb289408e7e04379068617ed674031397d8bb8` |
| `packages/cli/package.json` (workspace map digest) | `51eb6c8d3aa3d47f…` | `0e0f53c881ec5305…` (the one manifest change: cli now depends on `@victframework/application` for the local `check`/`vocabulary` commands) |
| `docs/builder-kit/context-pack.json`, `PACK.md`, `BUILDER-KIT.md` | — | regenerated; the only content deltas are the cli manifest digest and the cli runtime-dependency line |
| Capability catalog (`docs/builder-kit/capability-catalog.json`) | — | **byte-identical** (untouched by this slice) |
| Workspace map | 23 manifests | 23 manifests (no packages added or removed) |

## Verifier outcome after regeneration

`verify:builder-kit: ALL CHECKS PASSED (18 checks)`.

`verify:release-set: ALL CHECKS PASSED — 15 packages, 0.3.1,
v1_3a82c0651bb4b0d…` — the release-set identity is unchanged (it covers
the published package/version/registry set; a workspace-only dependency
addition does not alter it, and nothing was published).

## Governance

No frozen Stage 8 evidence document was rewritten; the frozen §14
publishing order is untouched; the §15 amendment remains a draft; nothing
was merged to `main` or published. Historical evidence records keep the
packIds they were filed with.
