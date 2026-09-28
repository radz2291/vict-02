# Builder-kit stable-layer regeneration — UI facade retirement (2026-09-27)

Mandated regeneration over the post-retirement workspace map, per the
kit's own freshness rule (`BUILDER-KIT.md` §2; the same procedure as the
convergence slice's FINDING-2 closure and the authoring-tools slice's
regeneration). Recorded identities:

- packId `f5a691a1f27eeccc…` (authoring-tools tip) →
  `a4e5668afec07c9e…` (`b2f41c393a7dc2f3…` was an intermediate
  regeneration during this slice's work and was never recorded in any
  committed artifact; the final tree's identity is the recorded one).
- Workspace map: **23 → 22 manifests** — the removed
  `@victframework/renderer-svelte` manifest is gone from the map.
- The only content deltas are: the removed `renderer-svelte` rows/edges,
  the updated `docs/RELEASE-COMPATIBILITY.md` digest (14-member candidate
  record), and the changed example/root manifest digests (dependency
  swap). Capability catalog byte-identical. Accepted-task-scope.json
  untouched. No frozen evidence document rewritten.
- Second generation byte-identical (determinism re-verified on the final
  tree).
- `verify:builder-kit`: ALL CHECKS PASSED (18 checks) on the regenerated
  layer.
- Historical evidence (frozen Stage 8, published `0.3.1` records, the
  P1–P6 slice records, and the evidence ladder's BOUND 13-member
  candidate in `scripts/lib/evidence-rules.mjs`) is untouched; historical
  packs keep the identities they were filed with.