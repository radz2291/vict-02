# Cycle 1.4 — quiet typography and spacing

AUTHORIZED / IMPLEMENTING. Owner approved the proposed constitution's first batch: font family, font size, weight and spacing; owner tests first. No colour, border/radius, icon, motion, panel placement, authored-page design or behavior redesign.

Clean baseline 47d67297e3ed2ddb8c2e64b53c96abd6dc6fa752, remote equal. Main d7401bef6e48330796c74ec00c86db9622d48cdf, remote equal. Isolated codex/studio-cycle-1-4-quiet-type in the owned selection-panel worktree. The explicit latest owner request authorizes this bounded successor to the previous handoff. Independent gate, overall acceptance and Stage9 closure remain pending.

## First-batch constitution

One system font stack; UI 12/18, sustained Chat text 13/20, metadata and code 11/16, dialog titles 14/20. Weight400 ordinary,500 section/active labels,600 dialog titles and meaningful prose emphasis. Spacing scale4/8/12/16/24; panel inset12, related controls8, group spacing16. Compact controls28 and normal fields32 where typography/padding are normalized. Existing panel bounds, responsive placement, canonical source/history/drafts/provider and effects are preserved. Authored pages retain their own typography and spacing.

Implementation uses one opt-in Studio presentation profile, explicit chrome scopes and existing shared components. Floating palette gets the same scope inside its existing portal; it is not moved. Shared package defaults/exports and Rhea's public profile remain unchanged. Existing selected tab shape/colour and icon glyph sizes are retained.

Builder checks: 16/16 focused existing interaction tests pass (panel-polish, selection-panel, structure-workspace and structure-portals); TypeScript noEmit passes; Svelte0 errors/5 unchanged renderer warnings. No new CSS-mirroring test was added; actual production computed-style/visual checks will verify the profile and authored-page isolation. Initial Kit sync invocation from the repository root used the app-relative path and failed before mutation; rerunning from apps/studio succeeded. Test-only unavailable port3000 status requests remain disclosed in the raw log; no provider turn was sent. Serial production build follows this source commit.
