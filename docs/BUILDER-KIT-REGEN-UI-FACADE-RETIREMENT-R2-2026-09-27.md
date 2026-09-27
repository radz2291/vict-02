# Builder-kit stable-layer regeneration — facade-retirement owner-review preparation (2026-09-27, r2)

Mandated regeneration over the version-selected workspace map, per the
kit's own freshness rule (`BUILDER-KIT.md` §2; same procedure as the
facade-retirement slice's regeneration recorded in
`docs/BUILDER-KIT-REGEN-UI-FACADE-RETIREMENT-2026-09-27.md`). This
regeneration was triggered by the coherent-version selection
`0.3.1` → `0.4.0-rc.1` across the 14 release manifests (plus the two
example manifests that track the workspace version and the
`docs/RELEASE-COMPATIBILITY.md` §2 record update) — a workspace-map
content change, so the committed stable layer had to be regenerated
before any owner review. Recorded identities:

- packId `a4e5668afec07c9e…` (facade-retirement r1 tip) →
  `3b1f40d5dbeaa755d2156808809b1490cc73603b7a425e6cfa9256f8da551440`.
  (An intermediate `0f6eeb76…` was generated over a pre-final
  RELEASE-COMPATIBILITY §2 draft during this branch's work and was
  never a recorded identity; the freshness gate caught the residual
  content drift and the final tree carries `3b1f40d5…` — the
  fail-closed freshness rule working as designed.)
- Workspace map: still **22 manifests** (no membership change on this
  branch — the 14 release packages + 8 workspace-private manifests).
- The content deltas are: the `name@version` entries for the 14 release
  members (now `0.4.0-rc.1`), the release-truth line
  (`vict-release-set@1/0.4.0-rc.1`), and the updated
  `docs/RELEASE-COMPATIBILITY.md` digest (new §2 record). Capability
  catalog byte-identical. Accepted-task-scope.json untouched. No frozen
  evidence document rewritten.
- Second generation byte-identical (determinism re-verified on the final
  tree; same packId both runs).
- `verify:builder-kit`: ALL CHECKS PASSED (18 checks) on the regenerated
  layer.
- Historical evidence (frozen Stage 8, published `0.3.1` records, the
  P1–P6 slice records, and the evidence ladder's BOUND 13-member
  candidate in `scripts/lib/evidence-rules.mjs`) is untouched; historical
  packs keep the identities they were filed with.
