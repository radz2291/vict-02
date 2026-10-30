# Popup architecture reconciliation

Inspected baseline: `4c40cc656328c50d16d28492ae5245bf509ccb6e` on isolated
`codex/architecture-realignment-20261030`, 30 October 2026. Reviewer:
`/root/popup_audit`, delegated read-only source audit followed by bounded
documentation amendment. This is supporting architecture review, not the fresh
Gate E integrated verifier verdict. No popup source changed in this audit.

The existing approved implementation is coherent at the inspected boundaries.
It retains two intentional interaction modes. Application-owned surfaces use
VICT's shared owner-local behavior; ordinary document-scoped consumers use
actual Bits behavior. No new demonstrated source defect justifies replacing the
approved hub or removing either mode.

| Question | Source evidence and disposition |
| --- | --- |
| What remains upstream-owned? | Public Bits Portal mounts owned floating content. Public Floating UI 1.8.0 positions it through `owned-popup.ts:343`. Drawer retains Bits Dialog Root/Trigger/Overlay/Title/Close. Unowned B4 menus, B5Tooltip, ModelSelector and AI hovercards retain Bits interaction parts. `ControlScope.svelte:19` supplies BitsConfig locale/portal defaults. Existing shared catalog and AI presentation reuse remains. |
| What does VICT own? | `owned-popup.ts:148` resolves actual application/canonical owners; `:211` provides owner-local event/layer arbitration; `:284` admits exact child branches. `owned-dialog.ts:72`, `owned-menu.ts` and `owned-tooltip.ts` implement their focus/keyboard/dismissal/lifetime contracts. `OwnedMenuContent`, `OwnedTooltip` and `OwnedHoverCard` compose these shared contracts. This is explicitly custom behavior, not Bits Content interaction reuse. |
| Why retain custom behavior? | The approved decision preserves concrete dialog focus/Escape failures and CF-P01/P02 sibling-app menu/tooltip failures. Those failures arose from document-level interaction scope, which changing only a Portal destination cannot solve. The source avoids private Bits patches and per-component keyboard engines. |
| Are both paths necessary? | Yes at current compatible scope. `CatalogDialog.svelte:55–70` and `Overlay.svelte` intentionally use document-modal Bits Content. `OwnedDialogContent.svelte:22` has an application-local dialog role and deliberately omits whole-document aria-modal. B4DropdownMenu chooses owned mode from presentation/portal/menu context at construction. Unowned coded consumers retain their established behavior. Silent reinterpretation of saved dialogs is unwarranted. |
| How are focus, keyboard and nesting consistent? | One owner hub arbitrates actual layers; nested canonical applications are competing owners. Dialog Tab containment, menu roving/selection/submenu handling and hovercard logical Tab corridors are specialized behavior on that hub. Exact trigger/occurrence/ARIA relationships admit public child portals. Focus return checks actual containment and the active document/embedding chain; sibling focus is not recaptured. |
| How do theme, viewport and standalone work? | Canonical presentation metadata and scope classes reach actual popup parts. Positioning clips to the application viewport where present, preserves authored variables across style replacement and cleans up stale computations. Standalone authored hosts use canonical owner roots; ordinary coded hosts retain ControlScope/Bits semantics and must load public catalog/AI styles. Neither private Studio imports nor a Studio-only popup stylesheet is required by these shared implementations. |

Documentation findings repaired in this audit:

- The existing decision's top-level status stopped at an earlier implementation
  checkpoint. A current amendment now gives one ownership/dependency map and
  keep/change/remove plan, with the original approval and red observations intact.
- `packages/ui-ai-svelte/UPSTREAM.md` item 9 described the initial portal-only
  adaptation and said the menu Escape failure remained open. A bounded current
  amendment now describes the later approved shared implementation, preserving
  the original upstream payload/provenance and historical failure statement.

Current inspected source hashes (SHA-256, actual checkout bytes):

| File under packages/ | SHA-256 |
| --- | --- |
| ui-svelte/src/owned-popup.ts | `bc176539480e949b6b47f0adebc7f2b0c99106051157e8f54b6c61687ac119c6` |
| ui-svelte/src/owned-dialog.ts | `f6589d87f5d5ebbf7df336465ab64beb50e2e81c0e399c9e32d8d3731382c872` |
| ui-svelte/src/owned-menu.ts | `0739bf73b0fb45d4cf7b7ab293a902cfdcb5b08fa6e934b20934617fbf23aa02` |
| ui-svelte/src/owned-tooltip.ts | `e6050ae5619fe9bfda5ca128dedf9f07d24a9f7232d2f1fd974b58d41491f14d` |
| ui-svelte/src/OwnedMenuContent.svelte | `50a8fe98cda79daf34387c076cacb6fb662291ed1c35bcff059ff49da0b40878` |
| ui-svelte/src/OwnedTooltip.svelte | `b77510a00b53af99b2ddb636ed70c0457714c6a08add10c8d4e38c852ea1668a` |
| ui-svelte/src/OwnedHoverCard.svelte | `b792a13434b63b08672f8bde6393c21d21db8ebf59621037e747ccc34399ec5f` |
| ui-svelte/src/catalog/components/CatalogDialog.svelte | `d3b911cee2a2044c706854deef8d0a91e7b28bdf89627a4cdb17ffef74a45570` |
| ui-ai-svelte/src/patterns/ModelSelector.svelte | `ccbbbac8944b0575378dba1771fc1e1d358c9a65b128d32841f2854d74c8aaf5` |
| ui-patterns-svelte/src/Drawer.svelte | `8d50b6ab375c1cca752e66ba1321be11333a17102161328ded0203354e8a54de` |

Verification at this audit boundary: source inspection and `git diff --check`
pass. Focused regressions ran once after the continuation dependency installation:

| Command / retained log | Result |
| --- | --- |
| `vitest run --project renderer` with the eight explicit owned suites listed below; `popup-renderer-regressions.log` | **PASS: 8 files, 63 tests**, exit 0, 23.67 seconds. |
| `vitest run --config packages/ui-ai-svelte/vitest.config.ts test/action-model-portal.svelte.test.ts test/chat-extension.svelte.test.ts test/passive-hovercard-isolation.svelte.test.ts`; `popup-ai-regressions.log` | **PASS: 3 files, 27 tests**, exit 0, 30.37 seconds. |

Renderer suite arguments: `packages/ui-svelte/test/owned-popup-core.test.ts`,
`owned-popup-adopted.test.ts`, `owned-popup-independent.test.ts`,
`owned-dialog-adopted.test.ts`, `owned-dialog-focus-capture-independent.test.ts`,
`owned-menu.test.ts`, `owned-catalog-menus.test.ts`, and `owned-tooltip.test.ts`
(all subsequent names share the first path's directory). Logs retain the existing
DocumentHost initial-value warning and RenderNode click/ARIA accessibility
warnings; a passing popup test does not clear those warnings.

Tests ran in the shared isolated continuation while non-popup integration edits
were in progress. The inspected popup implementation bytes are pinned above;
these are supporting checks, not an integrated exact-commit Gate E verdict.
Historical scoped results remain in `../owned-popup-review-20261028/`; newer
shared core/adoption and hovercard changes must not be assumed byte-identical to
every historical result.

The focused checks exercise sibling/nested owners,
iframe adoption, exact branch admission, menu-to-dialog Tab continuation,
disabled/hidden/detached source lifetime, controlled selection, submenu keyboard,
description IDs and geometry/style cleanup. Such DOM checks support only those
claims.

Remaining proof: current open-state geometry/theme/parts and nested focus in the
real Studio iframe and independent installed consumer; actual-agent composition,
save/reopen and graph-node popup behavior; actual owned Select and Popover
Escape/focus policies; and applicable physical touch/assistive-technology/device
checks. Admitting a Select/Popover as an exact child branch in an owned dialog
does not establish that child's independent global-input policy. No integrated
conformance, full foundation closure or owner acceptance is awarded by this audit.

The integrator reported that supported browser initialization failed because its
kernel assets are missing, including a bounded documented reset/retry. This audit
did not attempt browser/provider access or an alternate fallback. Current native
and actual-agent popup proof remains unavailable, rather than passed by the DOM
results above.
