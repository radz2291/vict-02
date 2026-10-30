# Architecture realignment — current delivery boundary

30 October 2026. **Bounded offline repairs independently PASS; complete
Authoring Foundation delivery remains HELD. Not ready for owner acceptance.**
The task remains in progress. No acceptance, milestone completion, Milestone 2
start or Stage 9 closure is recorded.

## Exact identities

| Item | Identity |
| --- | --- |
| Continuation branch | `codex/architecture-realignment-20261030`, local only |
| Checkout | `C:/Users/RZ1/.codex/worktrees/vict-architecture-realignment-20261030` |
| Original private checkpoint | `4c40cc656328c50d16d28492ae5245bf509ccb6e`, original checkout remains clean and untouched |
| Final product/source candidate | `a61396cb3bf20e3f10d62a89a716feafdd91d6e3` |
| Gate A reviewed documentation | `cf5056e5ea37b87931fe24baf53f800e2d7fd173` |
| Gate A independent report | `327db5149881ffdd6ad2e35e3380b60b1ea901fe` |
| Initial independent FAIL | `d64e47087d5dbc3a858c4750045b9d7e1a98f5ec`, reviewed product `46d20c3c8f3d3d617df2b6d18655fc7a31517e8e` |
| Intermediate recheck / F3 retained | `c004f794d25fc55f5ff6b59cc9088eb5070b6e77`, reviewed product `3e2c7b9e4a52721e398afb23d3fa140efe31f689` |
| Final independent source verdict | `4ef3199e87d8f9c04a4b1d584872920345b3917d`, branch `review/architecture-realignment-final-20261030`, exact candidate `a61396cb…` |
| Final production build | Exit 0; 305 files, all hashes in [BUILD-FINAL.json](foundation-evidence/architecture-realignment-20261030/BUILD-FINAL.json); retained at `C:/Users/RZ1/AppData/Local/Temp/vict-realignment-a61396cb-build`; **uninstalled** |
| Public-artifact consumer | [F0YKQr report](foundation-evidence/architecture-realignment-20261030/vict-realignment-consumer-F0YKQr.json), tested package source `3e2c7b9e4a52721e398afb23d3fa140efe31f689`; package bytes unchanged through final source |
| Serving product | `27788de9f111042d04d83e7d603c6da2cccde8dc`, original `127.0.0.25:5626` service; no activation/restart attempted |
| Remote main / public pause branch | `d7401bef6e48330796c74ec00c86db9622d48cdf` / `1fa7c392401bfb6581aae30a1e6d33ba305c2662`, rechecked unchanged; **no push** |

Later documentation/evidence commits do not change the product candidate above.
The sanitized public snapshot was never merged into the private lineage.

## Architecture and material decisions

[Ownership/dependency map and keep/change/remove plan](ARCHITECTURE-REALIGNMENT-20261030.md)
remain the current architecture. Canonical UI owns composition, themes, bindings
and presentation; application definitions own product routes/resources/actions;
runtime state, authored defaults and durable application data retain distinct owners.
Preview and normal consumers share DocumentHost. Graph topology grants no effects.

Graph source resolution now follows lexical scope. Identical scoped/document
state names do not alias. Private instance edits stay temporary with local history;
explicit source edits change template initials. Controlled nested edits identify
the actual containing graph nodes and fence every parent revision. Source editing
and source-history admission use the same resolver. Public host@2 returns explicit
source, runtime or refused ownership, and refuses an unresolved parent parameter
instead of letting nested Undo change unrelated authored source. Valid deep source
layouts retain authored persistence and portable import; real inspection-budget
exhaustion refuses explicitly with canonical rollback.

Applications choose their node content and controls. A new consumer-registered
ordinary Select composition works without a Flow adapter or private Studio import.
The rejected compulsory editor UI remains removed. No parallel runtime,
persistence engine or application language was introduced.

[Popup ownership](AUTHORING-FOUNDATION-OWNED-POPUP-DECISION.md) preserves the approved
split: Bits owns document-modal interactions; public Bits Portal and Floating UI
provide mounting/geometry for the shared VICT owner-local interaction path. VICT
owns the embedded focus/keyboard/dismissal/lifetime scope where upstream document
interaction ownership does not satisfy the requirement. Both remain intentional;
dependencies and appearance do not establish upstream interaction reuse.

## Gate disposition and checks

| Gate | Current disposition |
| --- | --- |
| A | Independently PASS for architecture reconciliation and all 31 requirement mappings. |
| B | Source/mounted vertical-slice proof cleared within scope: ordinary controls, typed connected nodes, nested/repeated state, manual/public agent operations, history, save/reopen/import. Full native/actual-agent experience unawarded. |
| C | Bounded source consistency repairs independently PASS; existing media/mobile/AI/style/icon/panel evidence retained. Whole-product conformance remains open. |
| D | Independent public-artifact fixture proof PASS; actual Studio-agent stages 1–5 and materially different second real application **NOT RUN**. |
| E | Fresh independent bounded-source verdict PASS; integrated browser/device/actual-agent exit **HELD**, owner acceptance absent. |

Final build, Studio TypeScript and changed-code ESLint all exit 0. Source repair
checks include Studio 18/18, retained host@1 package composition 17/17, final
import 23/23, protocol/pinned offline executor 6/6, and safe pre-invocation Agent
boundary 2/2. Other affected read/authoring/refusal and discovery/import checks
are retained at their exact candidate scope. These counts overlap; do not sum them.
The final independent verifier reused byte-identical source/history paths already
reverified at `3e2c7b9e…` and reran the changed importer with its own exact deep
roundtrip and all 22 existing import cases. See
[independent final verdict](foundation-evidence/architecture-realignment-20261030/INDEPENDENT-FINAL.md).

The public consumer freshly installed seven tarballs and matched 510 installed
nonmanifest files. Its ordinary registered Select control preserves two nodes'
independent values through validated graph writes and JSON source remount; DOM
interaction and production build pass with zero render diagnostics. Six unchanged
dependency builds were reused only after source/build-artifact equality checks.
The independent verifier recomputed all tarball and installed-file hashes.
This is a coding-authored fixture, **not actual Studio-agent output**.

Original baseline failures, initial independent FAIL, F1/F2/F3 findings, the
intermediate refused-viewport keyboard failure and lint failures remain preserved.
All three independent findings are resolved. Existing Svelte accessibility/state
warnings, production chunk-size and dependency-cycle warnings remain visible;
there is no blanket accessibility or performance pass.

## All 31 current acceptance dispositions

Every owner acceptance remains open. Retained means valid historical scoped
evidence, not a fresh whole-candidate live pass.

| Requirement | Current supporting result / still required |
| --- | --- |
| AR01 | Retained styling/theme proof; current consumer declares tokens/theme; new native graph appearance unproved. |
| AR02 | Strict discovery and trusted type hints pass offline; meaningful actual Studio-agent read/edit recovery still required. |
| AR03 | Atomic/source/route/revision refusals pass; no validation weakening or coercion added. Live composition still required. |
| AR04 | Retained bounded capture proof; no new actual graph/open-overlay observation. |
| AR05 | Retained concise reporting boundary; final new actual-agent output quality unproved. |
| AR06 | Retained authenticated originals/expiry/no-replay evidence; unchanged. |
| AR07 | Mounted nested viewport/control boundaries pass; native mat/scroll/geometry remains live-proof work. |
| AR08 | Retained availability fences; current browser availability cannot be inspected. |
| AR09 | Retained fact/measurement/hypothesis separation; all unavailable observations remain unproved. |
| AR10 | Scoped source operations/history preserve manual values in mounted bridge; actual-agent coexistence remains. |
| AR11 | Retained identities/metrics; offline pinned-executor protocol passes, no new real-provider metrics. |
| AR12 | Retained observation-only/no-replay proof; unchanged. |
| AR13 | Ownership/history/persistence/import defects independently repaired; actual authored application/browser roundtrip remains. |
| AR14 | Typed two-node/control fixture and ordinary registered components pass; useful actual-agent application remains. |
| AR15 | Seven public artifacts/510 files and new registered control prove fixture reuse; two actual applications remain required. |
| AR16 | Retained parts/theme scope; current native trigger/open-panel appearance remains unproved. |
| AR17 | Shared popup regressions 63 renderer/27 AI pass at unchanged popup source hashes; in-node open/capture/native proof remains. |
| AR18 | Meaningful ordinary control writes pass in bridge/consumer; representative actual application interactions remain. |
| AR19 | Strict safe feedback, exact route failures and offline retry boundary pass; actual remote recovery remains. |
| AR20 | Retained first-visit/carousel proof; actual physical gestures remain unproved. |
| AR21 | Retained launch/open-state/gallery proof; no new native open-popup certification. |
| AR22 | Existing 22 import/media safeguards plus deep roundtrip pass; retained upload/playback/asset evidence stands, heard audio unproved. |
| AR23 | Approved drawer/popup ownership and scoped regressions retained; new native nested/standalone exercise remains. |
| AR24 | Retained desktop dimensions/orientation evidence; desktop previews remain explicitly distinct from physical devices. |
| AR25 | **PARTIAL**: actual-device virtual keyboard, safe-area and touch still unproved. |
| AR26 | Existing panels/drafts proof retained; owner browser/apps/assets/drafts untouched, fresh complete browser backup unavailable. |
| AR27 | Existing View-row/mode-bar behavior retained, unchanged. |
| AR28 | Registered icons/theme/portable evidence retained, unchanged. |
| AR29 | Inert vector/ID/managed-asset evidence retained; importer negatives remain passing. |
| CF01 | Bounded source/package/ordinary-control/ownership conformance cleared; integrated native/new-flow authoring remains open. |
| AI-EX01 | Earlier 23-identity/28-contract exposure retained; safe tool boundary passes offline; new actual flow-authoring proof remains open. |

## Compatibility and preservation

New public code contracts are `vict.flow-authoring@1` and
`vict.flow.editor-host@2`. Host@1 remains an explicit compatibility fallback;
new source-backed hosts should migrate to structured @2 admission. Optional
provenance fields preserve existing context implementers. The agent operation
is capability/input@6 (from @5), instructions@12 and authoring profile@13.
Existing direct operation shapes remain valid. UI document, application and
graph@1/@2 saved schemas are unchanged; there is no implicit migration.
Controlled nested source routes support graph@2 node parameters. Legacy graph@1
controlled nested routes explicitly refuse; direct graph@1 remains supported.

The original private checkout remains clean at the paused checkpoint. Current
installed bytes match all 324 core and 60 preserved proof files from serving
`27788de9…`. Existing proof routes, Chatwithme/Matrix/Flow, failed NodeLab trials,
managed assets, browser storage and unsent drafts were not edited or cleaned.
This is preservation by non-mutation, **not a fresh complete browser backup**.
Earlier 119c safety improvements are in the final inactive candidate; the old
serving product has not been upgraded. Do not run new actual-agent proof against
that old serving build as though the safe boundary were installed.

## Exact remaining owner/tool step and walkthrough

The built-in browser controller fails before inventory with `failed to write
kernel assets: The system cannot find the path specified. (os error 3)`.
Initial attempt, one documented session-reset retry, and one fresh attempt after
an independently observed tool re-enable all failed identically. No tab access,
alternate browser, raw protocol or security-policy bypass was used.

Restore the supported built-in IAB controller. Then the already authorized next
work is: inspect/preserve current owner tabs, unsent drafts, saved apps and assets;
freshly reconcile process/build identities; safely activate this exact retained
candidate at the same origin with existing Z.ai configuration; sign in normally;
execute actual Studio-agent stages 1–5 and native independent-consumer checks.
No new provider/account/configuration or publication authority is implied.

Owner walkthrough after that safe activation should focus on:

1. A fresh separate screen: actual agent meaningful read and one useful ordinary
   edit, with receipts and truthful final source. Do not preload a completed fixture.
2. One rich node/control, then two typed connected nodes. Edit/move manually,
   make an agent change, Undo/Redo, Save/reopen and portable import.
3. Repeat/nest the graph: controlled edits persist only to the selected source
   node; private runtime edits stay temporary. Missing parent parameters visibly
   refuse without undoing unrelated authored source. Test ordinary text Undo.
4. Complete one representative actual-agent application and a materially different
   second application; inspect current themes, open overlays, keyboard and native
   control behavior. Keep fixtures separate from those demonstrations.
5. Supply an approved physical-device verification route for AR25 keyboard,
   safe-area and touch, or explicitly accept that exact unmet limitation. A narrow
   desktop container does not supply this evidence.

The final integrated verdict and owner acceptance follow those proofs. Until then,
the ticket and Authoring Foundation milestone remain open. No push, main merge,
package publication, production deployment or Stage 9 closure is authorized.
