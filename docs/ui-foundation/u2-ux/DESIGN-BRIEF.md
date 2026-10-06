# U2 Inspector / Layers — owner instruction and design brief

Date: 7 October 2026. Owner experience acceptance remains PENDING.

## Authority and isolation

The owner supplied the complete bounded instruction in this chat: redesign and implement reusable Inspector and Layers; research, independent browser experience review, repair, and integration handoff are required. This instruction supersedes historical UX readiness claims, not the frozen U0 semantics. The full original directive is preserved in OWNER-INSTRUCTION.txt.

Exact starting base: 83ba87f7aa112a1d93e7236c9c3ec2f4505f6cff. This is an ongoing compiler repair whose independent verification was pending when assigned; it is NOT an accepted U2 gate. Prior record: 6610d3f0c555308a3252632df3d3686094d1f8ea. Frozen amended contract: 9ec87f3e7eb8eb7793f972111258940aac635346.

Repository: https://github.com/radz2291/vict-02. Existing isolated clean worktree: C:/Users/RZ1/Desktop/RZ/vict-02-u2-inspector-ux, branch codex/ui-foundation-u2-inspector-ux, HEAD and own remote both exact base. It belongs to the alternate local clone at C:/Users/RZ1/Desktop/RZ/vict-02, which has the same origin. The initial create attempt from the chat checkout created an unused same-named branch there, but refused the existing directory and changed no files. Main live SHA: 4d2df037d8a82d36c60bf1bff16919650643ce22; unchanged. Manager's branch was observed at 9983e91c952179bd0bca0a9e8dbc8c442e8ef30d. Owner explicitly pins this workstream to the earlier exact repair base; no rebase or writes to manager files.

Writable paths: Inspector.svelte; Layers.svelte; new panel helpers/styles; additive exports; clearly named UX tests; editor-review route and its dedicated helpers; docs/ui-foundation/u2-ux/**. No compiler, renderer, session, bridge, store, old workbench, root STATE/DECISIONS, frozen records, Studio or other-track edits. Dedicated port 5197.

## Research and decisions

Primary references read on 7 October 2026:

- https://docs.webstudio.is/university/foundations/style-panel — visual property groups, scoped edits and a separate advanced surface informed the panel's hierarchy.
- https://docs.webstudio.is/university/foundations/navigator — hierarchy, selection feedback and expandable navigation informed Layers.
- https://github.com/CoreBunch/Instatic/blob/main/docs/editor.md — source-bound property controls and reusable tree primitives informed module boundaries.
- https://github.com/CoreBunch/Instatic/blob/main/docs/features/modules.md — declarative module metadata informed optional host labels, without introducing a new product model.

Chosen hierarchy: selection name and breadcrumb first; explicit scope; Content / Style / Behavior; Advanced last. Typography and fill open first; spacing and layout collapse. Use native inputs, numeric/unit controls, swatches, declared choices, Override and Reset. Keep measured browser values distinct from authored destination declarations. An ancestor source is described as an inheritable candidate, never asserted to be the browser's winning origin. Condition/pseudo editing does not simulate a pseudo state or silently resize/rewrite base styles.

Layers reads the render plan and source labels; component internals collapse by default, selection reveals ancestors. Arrow keys navigate, Left/Right collapse/expand, Home/End move, Enter selects. Runtime scopes use existing renderer evaluation/key helpers; missing scope is labeled template, not fabricated record selection. Technical identities stay in tooltips and provenance details.

Visual language: 12px panel type, 32px rows, 16px section inset, restrained blue selection, neutral surfaces, visible focus, wrapping labels. CSS custom properties provide a practical integration theme. Narrow hosts explicitly choose Canvas / Layers / Inspector; panel behavior stays reusable.

## Semantics and limitations

One canonical source, existing command builders and EditorBridge/store/history. No second document. Shared inner-source edits affect all component occurrences. Instance styling addresses the existing component wrapper, not an invented occurrence-local inner element. Instance text overrides are unavailable and disabled. Conditions/pseudo commands only accept element targets; unavailable wrapper commands are disabled. Reset removes only declarations owned by the current edit destination; attached shared rules remain. Conditional attached rules can be masked by base-local styles; the panel discloses this.

Before screenshot is copied, byte-identically, from the preserved prior U2 experience recheck (19bb4b9 code; Inspector unchanged through the pinned base). It is historical evidence, not a newly captured baseline browser session.

No acceptance, U2 closure, U3/U4 work, merge, publication or deployment is authorized by this slice's verdict.
