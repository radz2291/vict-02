# Cycle 1.4 — quiet typography and spacing

BUILDER CHECKS PASS / READY FOR OWNER TEST; INDEPENDENT GATE PENDING. Owner approved the proposed constitution's first batch: font family, font size, weight and spacing; owner tests first. No colour, border/radius, icon, motion, panel placement, authored-page design or behavior redesign.

Clean baseline 47d67297e3ed2ddb8c2e64b53c96abd6dc6fa752, remote equal. Main d7401bef6e48330796c74ec00c86db9622d48cdf, remote equal. Isolated codex/studio-cycle-1-4-quiet-type in the owned selection-panel worktree. The explicit latest owner request authorizes this bounded successor to the previous handoff. Independent gate, overall acceptance and Stage9 closure remain pending.

## First-batch constitution

One system font stack; UI 12/18, sustained Chat text 13/20, metadata and code 11/16, dialog titles 14/20. Weight400 ordinary,500 section/active labels,600 dialog titles and meaningful prose emphasis. Spacing scale4/8/12/16/24; panel inset12, related controls8, group spacing16. Compact controls28 and normal fields32 where typography/padding are normalized. Existing panel bounds, responsive placement, canonical source/history/drafts/provider and effects are preserved. Authored pages retain their own typography and spacing.

Implementation uses one opt-in Studio presentation profile, explicit chrome scopes and existing shared components. Floating palette gets the same scope inside its existing portal; it is not moved. Shared package defaults/exports and Rhea's public profile remain unchanged. Existing selected tab shape/colour and icon glyph sizes are retained.

Builder checks: 16/16 focused existing interaction tests pass (panel-polish, selection-panel, structure-workspace and structure-portals); TypeScript noEmit passes; Svelte0 errors/5 unchanged renderer warnings. No new CSS-mirroring test was added; actual production computed-style/visual checks will verify the profile and authored-page isolation. Initial Kit sync invocation from the repository root used the app-relative path and failed before mutation; rerunning from apps/studio succeeded. Test-only unavailable port3000 status requests remain disclosed in the raw log; no provider turn was sent. Serial production build follows this source commit.

## Owner test candidate

Product b251606212f79f7fdc2ee48e61edb82b75f711e7 on codex/studio-cycle-1-4-quiet-type is pushed and remote verified. Serial production build and exact committed-byte seal pass: 759 inputs / 491 outputs; manifest SHA256 426e49f1fe3a6c5655efaa7842113c516b18bf52642b1af0e6c7d7e076d11e98. Existing dependency circular warnings are retained in the build log.

Actual CUA verifies the shared system font at12/18 across menus, modes, Document, Layers, Selection and floating Format. Document and Selection headings both render weight500, fixing their previous600/400 mismatch; selected tabs use500 and ordinary labels400. Data toolbar uses8px gap and16px group separation; Selection body inset12px. Chat input/empty reading text13/20 and status11/16. Structure titles12/18 at500 and kind/summary metadata11/16. Floating controls retain their existing portal/placement and now consume the Studio font scope.

The exact DOM-backed before/after snapshot for authored heading, inputs and labels matches (font family, size, line height, weight, colour and padding); saved revision remains r1.r1. [Before](cycle-1-4/quiet-type/before-authored.json), [after](cycle-1-4/quiet-type/after-authored.json), [computed styles and review](cycle-1-4/quiet-type/browser-review.json). No persistent source edit or provider turn was made.

Owner-tab panel state changed during checks: Back/Layers controls stopped matching the prior state. This was retained as a stale observation, not classified as a product failure. The root stopped interacting with that tab and completed Chat/Structure checks in a separate background tab, then closed it. The existing owner tab remains logged in on the updated [.22:5616 Studio](http://127.0.0.22:5616/design). It was not repositioned after the owner began interacting.

Screenshots: [Selection](cycle-1-4/quiet-type/selection.png), [floating Format](cycle-1-4/quiet-type/floating-format.png), [Chat](cycle-1-4/quiet-type/chat.png), [Structure](cycle-1-4/quiet-type/structure.png). Existing workspace and palette showcase fixtures receive the same profile; no full gallery visual sweep is claimed. Generic library/Rhea defaults, colours, radii, shadows, icons, layout algorithms, canonical semantics/history/provider/effect boundaries and panel placement are unchanged. Inherited19 authoring-probe failures retain their prior scope.

Next allowed action: owner testing and next bounded feedback. The owner asked whether work was done and has a comment; implementation is finished and no further UI edits are underway. Independent gate, overall owner acceptance, Stage9 closure, merge, release and deployment remain outside this checkpoint.
