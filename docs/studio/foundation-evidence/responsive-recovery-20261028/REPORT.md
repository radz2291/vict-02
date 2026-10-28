# Responsive recovery and coverage inventory

Inspected committed source: `59212b031d49163f7e1ebc40088f6a8ab2ae1b1e`.
This lane used repository source and retained sanitized public artifacts only.
No browser, provider, server, live build, private reasoning, Git mutation or product
source edit was performed. No duplicate broad test run was needed.

## RR-01: complete original responsive source remains unrecovered

The original responsive document is
`screen-5936ae38-4559-469f-be93-a33806f740b2`. Its continuation began at `r1#8`
with 21 canonical nodes and 23 state declarations. The retained public transcript
contains only five complete original node bodies: `screen`, `dash-grid`,
`dash-nav`, `card-projects`, and `card-milestones`.

At least 16 initial bodies are missing. The known unresolved initial child IDs
are `dash-welcome`, `dash-header`, and `dash-projects`. Observation metadata also
mentions `welcome-copy` and `welcome-copy-text`, but does not supply their source
bodies. The rest of the missing initial IDs cannot be named from these artifacts.
The initial six confirmed edit batches are summarized but their operation inputs
are not retained here. Complete initial `theme`, `styleSources`, `tokens`,
`assets`, and `componentDefinitions` registries were not read. They cannot be
assumed empty.

All 23 state initial-JSON previews parse; two condition previews exist. Two complete
acknowledged continuation batches (7 and 8 operations) advance `r1#8` → `r1#9` →
`r1#10`. Their final digest agrees with both the trial summary and observation:
`37698b22ad89d2624a172eae32447e5124e2d37e09799550c7e11c1bdbca01dd`.
That consistency authenticates those retained claims, not an unavailable full
document. There is insufficient original input to reconstruct and recompute this
digest. No synthetic replacement or guessed canonical document was created.

`inspect-retained.mjs` reproduces this inventory. `retained-coverage.json` records
the original artifact hash, exact public part indices, node-body hashes, batch
receipts, state keys and missing inputs. `incomplete-public-fragments.json`
retains only original public source fragments/continuation operations and is
explicitly not an importable UI document.

The retained records cite a dedicated run database generically but supply no exact
store path. No broad Temp/private-message/database search was performed. The
separate interrupted field-notes trial had zero confirmed edits and a different
document ID; it cannot supply this dashboard's missing initial source.

## RR-02: named-container and host-guidance mismatch

At the inspected source, `ApplicationViewport.svelte` creates a real iframe and
reports `model: isolated-viewport`; Design mounts it inside the outer
`.workspace-screen`. Only that outer wrapper declares
`container: studio-screen / inline-size` (`workspace.css:23`). None of
`ApplicationViewport`, `ViewportContent`, `EditorCanvas`, or `DocumentHost`
establishes that named container inside the iframe. An outside ancestor cannot
satisfy a container query in another document. The retained dashboard's
`cond-narrow` names `studio-screen`, so its actual narrow transition was not
established by the historical source-only change.

`preview-host.ts` additionally says presets change only a container and media
queries evaluate against the outer browser. `agent-reads.ts:254` delivers that
metadata; `designer-agent.ts:237` interpolates its guidance. With the actual
isolated iframe, those facts are stale: media queries evaluate inside that
viewport, and width/height presets change it.

The root has independently measured the live AI-app iframe: ancestor computed
`containerName: none`, `containerType: normal`, viewport 822×528, retained as
`../fresh-integration-20261028/ai-review-iframe-host-before-repair.json`.
The root owns the bounded optional-container integration/guidance repair and its
verification. This lane deliberately made no competing edits.

## Responsive and persistence proof tiers

| Criterion | Existing implementation/support | Still requires root-owned live proof |
| --- | --- | --- |
| AR-18 navigation/filter | `Navigation.svelte` emits typed selection and marks the current item; `FilteredList.svelte` binds query and renders actual filtered rows. Existing `patterns.test.ts` cases at 206/215 exercise rendered changes. The old responsive continuation retained these declarations only in fragments. | Original app source first; then search one/no matches, select an item and verify its visible bound output; navigation closes compact menu and changes selection. |
| AR-20 first visit | `FirstVisit.svelte` selects origin-scoped localStorage or sessionStorage; `state.ts` keys app/campaign/reset identity explicitly. Tests at 232/246/263/275/313 cover remount persistence, acknowledgement, unavailable storage, invalid identity and identity separation. Prior full patterns 45/45 is retained supporting evidence. | Actual authored app's declared application/campaign/scope/reset; dismiss, saved reopen/Run and intended session boundary; explicit reset and unavailable-storage outcome. Do not silently clear an owner's existing campaign. |
| AR-20/21 carousel | `Carousel.svelte` has controlled index/indexChange, Previous/Next/indicators, pointer cancel/swipe threshold, vertical pan and 44px controls. Test at 177 exercises Next/Previous and simulated pointer events. | Actual authored carousel controls and emitted index round-trip, boundary disabled state, keyboard, horizontal gesture with vertical scroll preserved. Synthetic MouseEvents are not physical touch proof. |
| AR-23 drawer | Shared controls and owned dialog path are present; earlier patterns/independent popup checks are supporting evidence. | Actual authored drawer while open: focus entry/containment/return, Escape, backdrop, scroll boundary and nested/other-owner isolation. |
| AR-24 viewport | Real iframe, bounded custom dimensions and rotation are implemented. The iframe supplies viewport meta `interactive-widget=resizes-content`; CSS uses dvh. RR-02 identifies a named-container integration gap for root repair. | Measure actual iframe dimensions and computed layout at wide/390/custom/rotated sizes; distinguish canvas/container from outer browser; recheck open overlays. |
| AR-25 device behavior | Semantic labels, 44px pattern controls and vertical-pan intent exist. No explicit safe-area simulator or physical-device evidence was found. | A real available device for soft keyboard/visual viewport, safe-area, touch and orientation claims. Desktop IAB size changes cannot certify these. |
| Save/reopen/Run | Studio's `screenStore` stores validated canonical documents in origin-local `vict.studio.screen.<id>` records; actual graph Save/reload/Run proof belongs to the root. | Save and reopen the actual responsive source. The historical responsive page was unsaved, so a transcript is not persistence proof. Preserve the same origin and document identity. |

No new runtime PASS is inferred from the inventory. Physical-device availability
is still unestablished. The native fixture comparisons in `native-repair-checks.json`
and the historical responsive 928×580 crop are supporting observations at their
original stated limits, not current responsive-app/device proof.

## Next actions

1. Root completes/rechecks RR-02 on the live app after its current AI turn settles;
   compare iframe media facts, named-container ancestry and computed narrow layout.
2. Recover the original responsive source only from an already authorized original
   tab/store/export or a specifically identified complete public artifact. Preserve
   it before reload, and recompute the final canonical digest. Do not revisit a
   denied origin or use another browser as a workaround.
3. If no complete source exists, report this concrete missing artifact for an owner
   decision; a fresh actual authoring task must be identified as new work rather
   than relabeled recovery. Do not repeat a provider run merely to recreate the
   lost source under the old checkpoint instruction.
4. Once a real complete app is available, root performs the table's browser checks.
   Device claims remain open until hardware evidence exists.
