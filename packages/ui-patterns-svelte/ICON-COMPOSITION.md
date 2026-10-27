# Icon composition amendment

This package consumes the installed `@victframework/ui-media-svelte` icon registry. All original revision-1 descriptors, implementation capabilities and compatibility pins remain retained. Existing authored documents continue to resolve their exact revisions.

| Contract | Supplied icons | Composed slots | Behavior retained |
| --- | --- | --- | --- |
| `vict.pattern.navigation@2` | `menuIcon` and parallel `icons` names, with `iconPack` / `iconRevision` | `triggerIcon` overrides the menu glyph | Visible labels, accessible menu name and typed string activation/selected-state binding |
| `vict.pattern.carousel@2` | Default `chevron-left` / `chevron-right` through the supplied registry | `previousIcon` / `nextIcon` override glyphs independently | Named native Previous/Next buttons, disabled boundaries, index binding and swipe |
| `vict.pattern.filtered-list@2` | Default `search` through the supplied registry | `searchIcon` overrides the glyph | Nonempty input label, actual list filtering and item activation |
| `vict.pattern.action-button@1` | Compose a registered supplied/custom `vict.media.icon` | `icon` / `trailingIcon` | Nonempty accessible `label`, typed string `activate`, native disabled behavior and deliberate `iconOnly` presentation |
| `vict.pattern.drawer@1` | Compose a registered supplied/custom `vict.media.icon` | Existing `trigger` | Explicit accessible triggerLabel, controlled open/close and drawer behavior |

Search the media manifest for exact available pack/name/revision identities. An icon name is not an arbitrary glyph string or an emoji substitution. Supplied glyphs default to Lucide revision `1.27.0`; a host-installed custom pack can supply another exact identity. Composed slots accept registered custom icon/vector content without changing the control contract. Icon content must be noninteractive: do not nest a button/link/input inside a native button.

Control labels own accessibility; decorative icon wrappers are hidden from the accessibility tree. Glyphs never replace state/action bindings. The Action button's `activate` payload is a string value such as `send`, suitable for a matching state declaration or declared action input. It never silently submits a form or dispatches an undeclared application operation. `iconOnly=true` keeps the label as aria-label and native title, with an offscreen text label.

Pattern surfaces consume the canonical theme aliases `--vict-color-surface`, `--vict-color-text` and `--vict-color-border`, while retaining explicit earlier `--vict-surface`, `--vict-text` and `--vict-border` overrides. Search and carousel native controls receive those roles rather than retaining an unrelated browser-light surface. This CSS alignment requires integrated production visual evidence; package type checking alone does not establish contrast or theme acceptance.

The integration fixture exposed a real revision-1 Drawer implementation defect: a trigger slot containing only a decorative icon left the trigger unnamed. The implementation now always provides a nonempty aria-label from triggerLabel, and a canonical-renderer regression test opens that exact icon-only trigger. This repair does not reinterpret the frozen descriptor or change the trigger/open output contract.

Focused evidence: **19/19 consumer tests PASS**, package Svelte check **0 errors / 0 warnings**, and diff-check clean. Cases cover exact registry compatibility, compiling seeds for every revision, actual supplied SVG controls, custom slot replacement, fallback accessible names, typed state outcomes and disabled refusal. The earlier 14-case package run remains historical. Automated DOM checks do not establish screen-reader, device, production geometry or independent acceptance. Studio's integrated browser artifact and lockfile are owned by the root manager; this builder changes only this package.
