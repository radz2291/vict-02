# Structure beside the canvas — independent verification

2026-10-24. Fresh independent verifier, no participation in product implementation. **Final scoped verdict: PASS — READY FOR OWNER REVIEW**, exact product `a36793df0f62c002332d66db181310554aaabb05`, branch `codex/studio-cycle-1-3-completion`. Initial candidates failed as recorded below; all four required findings are remedied on the final exact candidate. This report covers the owner-authorized Structure-in-Document placement only; it records no owner acceptance, Stage 9 closure, merge, publication, deployment or unrelated agent-reliability verdict.

## Identity and method

Read root AGENTS.md, canonical system reference, current Stage 9 state/architecture/handoff routing, UI-foundation routing, [the accepted drawer scope](CYCLE-1-3-STRUCTURE-DRAWER.md), previous independent Structure corrections and `C:/Users/RZ1/Documents/UI design preferences.txt`. At entry the isolated `codex/studio-cycle-1-3-completion` working tree was clean. Local HEAD and `git ls-remote` independently matched candidate `89fc5c9d117984abd9a039a518790e23544c565f`; local and remote main matched `d7401bef6e48330796c74ec00c86db9622d48cdf`. Audited the product diff from authority commit `9a94dc5` and surrounding selection, composition, draft, history, capture and keyboard paths. The diff is bounded to Designer, shared StructureView, showcase, presentation CSS, affected tests and the scope record.

Browser demonstrations used only documented `mcp__cua_repl` browser APIs, a new temporary IAB tab on production preview `http://127.0.0.6:5600/design`, and a second disposable showcase tab at `/showcase#designer`. The builder confirmed the exact initial candidate production build and server readiness before browser work. The verifier created and saved a canonical Source fixture, `Independent drawer verification`, ID `screen-d8283e8b-5bef-4e26-b50a-b10852458527`. It contains Left/Right section containers, a heading and literal, a bound native input, a movable text node and a closed Dialog/body composition. No product code was edited. No provider call was made. The owner's `127.0.0.5:5599` tab/server, unsaved painting document, source and Chat were untouched.

The verifier waited during the builder's production build and affected test execution rather than contending for compiler memory. Builder-reported checks are distinguished from independently executed checks below.

## Retained initial failures

1. **SD-01 / P1 — Expand collapses the stacked drawer.** At 1000 × 700 with default Chat visible, the workspace is 680 × 632. Normal stacked Document is 680 × 379.2 at y296.8. After explicit Expand, classes include `structure-drawer drawer-stacked structure-expanded`, but the drawer remains computed `position: static` and shrinks to 680 × 82.6 at y593.4. Grid rows become `549.4px 82.6px`; only the Document tabs and graph toolbar remain visible, with the graph clipped away. Screenshot visibly confirms the collapse. Source cause: the stacked drawer selector has higher specificity than the expanded absolute-position selector. Desktop Expand works, so this is specifically the stacked path.
2. **SD-02 / P2 — hidden-source Locate in Interact makes an incomplete composition transition.** Find/select the closed Dialog's `paragraph` while Interact is active. Ordinary selection correctly retains the root canvas, current runtime input and closed Dialog. Explicit Object → Locate on canvas then adds Composition navigation / Back but still renders the normal closed Dialog/root canvas; the target is invisible and status says `This source has no visible canvas element. Open its composition to inspect it.` The same exact source in Design reveals Details/body and reports `Located on canvas.` Source cause: Locate sets compositionFocus without entering Design although composition rendering is available in Design. The required correction can refuse this unavailable transition before altering context and ask for an explicit Design transition, preserving runtime.
3. **SD-03 / P2 — showcase Expand stays confined to its grid cell.** At 1500 × 900 the normal drawer is x892.8, width560, height600. Expand changes height to720 but retains x892.8/width560. Its retained grid-column3/grid-row1 confines absolute inset0 to that cell. At 800 × 600 the stacked drawer is 752.8 × 480; Expand remains 752.8 × 480 with absolute positioning, so provides no larger workbench. Shared showcase parity therefore fails this explicit expansion requirement. Normal canvas coexistence and responsive stacking work.

All findings were sent promptly to the stage manager with measured bounds before product repair. No source repair was made by the verifier. The builder's earlier declaration-order check failure, Layers lifecycle regression and wrong-directory test append are retained in the scope record; they were not independently reproduced and are not counted as successful checks.

## Initial production demonstrations

| Criterion | Result and actual evidence at initial candidate |
| --- | --- |
| Capability home / mounted visible canvas | PASS: Structure appears in Document with Layers/Data/Actions/Source; workspace mode has Design/Interact only. At1500 ×900/default Chat, canvas614px and drawer560px coexist. Runtime input remains present through Document transitions. Source audit confirms one maintained EditorCanvas. |
| Comfortable width / independent resizing | PASS: keyboard ArrowLeft on the accessible Document width separator changed Structure560 →576. Data retained its separate320px width; Structure restored576 on return and close/reopen. |
| Ordinary keyboard selection | PASS: Enter on Right group synchronized the graph/source selection while camera remained `translate(203.6px, 93.5px) scale(1.1)`, canvas scroll stayed0, no composition navigation or floating tools appeared and application identity remained `v1_9eac1d02aaa1624c7bcd1c67cb6de509bc9041222460b3d128e2dd50ec5ceecf`. |
| Graph/runtime/context retention | PASS: `group` search, exact camera transform, Right selection, runtime value `Runtime remains through drawer` and identity survived desktop Expand/Restore, Data →Structure and Close →Document. State facts/selection survived Structure →Data →Structure. |
| Explicit Locate / Inspector | PASS in Design: hidden paragraph Locate opened Details/body, revealed `Hidden dialog content`, kept Document open and reported Located. Edit properties then used existing floating Inspector tools for that exact paragraph. Interact hidden-source path FAIL: SD-02. |
| Focused inspection / keyboard dismissal | PASS: inspection occupies one focused page over the graph. Escape from Properties closed inspection, retained drawer/selection and restored focus to Inspect structure. Next Escape cleared search without closing Document. Escape in the open Structure View menu closed only that menu and restored View trigger focus. |
| Data draft protection | PASS: entered `Pending data draft`; Close refused with Apply/cancel notice, Structure disabled, exact pending text retained. Explicit Cancel restored the saved initial value. |
| Source draft protection | PASS: appended whitespace; Interact refused, Close refused, Structure disabled, exact draft text retained. Explicit Discard restored Source. |
| Canonical Move / Undo | PASS: Object →Move inside moved `copy` from left.children to right.children through existing history. Source showed left `[heading,field]`, right `[copy]`. Edit →Undo restored Source JSON exactly equal to its saved pre-move text, including identities and revision. |
| State handoff | PASS: Find Agreement/accepted →Properties →Edit in Data reached Agreement starting-value editor. Returning Structure retained State/accepted facts and application identity. |
| Smaller windows with default Chat | PASS for docked mode at640 ×480: workspace448 ×412 at x192; drawer448 ×247.2 at y208.8; inspection448 ×164.6 at y291.4, bottom456. Document scroll width640; focused inspection has bounded scrolling and visible Close/pages. Expand FAIL: SD-01. |
| Showcase shared presentation | PASS for normal coexistence, one shared StructureView, search retention through Document close/reopen, and stacked placement at800 ×600. Explicit Expand FAIL: SD-03. |

## Checks and limits

The builder reported initial TypeScript PASS, Svelte0 errors /6 retained warnings, production build PASS and final14 affected tests PASS. These are builder evidence, not an independently rerun ladder. The source audit confirms docked Structure no longer sets the canvas capture-unavailable flag; only explicit expanded covering state does. Actual provider-assisted capture was not exercised and broad agent reliability remains outside scope.

Initial verdict is FAIL until the required findings are repaired, an exact pushed replacement is identified and the affected browser/check evidence is independently re-established. Next authorized action is bounded repair and re-verification, followed only after scoped PASS by owner hands-on review.

## First repair challenge

Independently matched local HEAD and pushed branch to `497549f73dce8d869bdb0385ae93d843b629e250`; main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. The report is the verifier's only write; product repair belongs to the builder. `git diff --check 9a94dc5..497549f73dce8d869bdb0385ae93d843b629e250`: independently PASS.

Source audit finds the bounded remedies: expanded Designer position has equal specificity and follows the stacked rule; hidden Interact Locate refuses before changing composition and preserves runtime; showcase expanded Document spans all grid columns and uses a viewport-bounded larger height. The drawer's first-open collapse threshold is changed only for drawer presentation, retaining the workspace default.

After the builder confirmed sequential checks/build and restarted the exact replacement, reloaded only the verifier's own tab. Shared active-screen storage initially chose the builder's saved Canvas and Structure fixture; used File →Open screen to select the verifier's own fixture without editing the builder's document or tab.

- **SD-01 remedied:** at1000 ×700/default Chat, expanded drawer is now computed absolute at x320,y82,width680,height594, with511.4px graph height. At640 ×480/default Chat it is x192,y82,width448,height374, with291.4px graph height. Restore/Escape returns docked stacking rather than collapsing the graph. Screenshot confirms visible expanded workbench.
- **SD-02 remedied:** with runtime `Repaired runtime retained` in Interact, Locate on the hidden paragraph now refuses before adding composition navigation, retains Interact/runtime/selection and reports `This source is hidden in Interact. Switch to Design, then Locate on canvas to inspect its composition.`
- **First-open disclosure:** Left group is deliberately collapsed with4 hidden nodes,5 visible items. Canonical source/application identity is unchanged; this remains presentation state.
- **SD-03 partially remedied, still FAIL at the smaller window:** desktop expanded drawer now spans x32,width1420.8,height868 instead of560px. At800 ×600, normal stacked drawer is752.8 ×480. Clicking Expand scrolls its lower-row trigger into view before the state change; expanded absolute placement moves to grid row1. Immediate expanded bounds are x16,y−582.5,width752.8,height568,bottom−14.5: the entire workbench and Restore control are above the viewport. An automation locator can scroll to Restore afterward, but this does not demonstrate usable initial reveal. The stage manager was notified before the next rebuild.
- **SD-04 / P1 — covered graph remains keyboard reachable:** open focused inspection, focus Inspect structure then press Tab. Actual focus enters `Component: Details, source dialog`, a covered Flow node with role group/tabindex0, before Close inspection. Parent canvas is computed visibility:hidden, but Flow nodes and Collapse Details explicitly compute visibility:visible; AX still lists them. Users can select unseen graph objects behind the focused page. The builder independently reproduced this and proposed an inert covered graph; the verifier made no repair.

Independent affected command from `apps/studio`: `npm test -- --run tests/ui/composition.test.ts tests/ui/structure.test.ts tests/structure-presentation.test.ts` invoked the expected filtered `vitest run`. **Exit0,3files/14tests PASS,54.64s** (composition5, Structure7, projection2). Retained diagnostics: unchanged Svelte renderer/editor warnings, upstream shortcut warnings and caught AgentChat configuration requests to unavailable localhost3000 (`ECONNREFUSED`). None was a failed assertion. This independently covers the component/source regression suite, not browser CSS/layout or general live-agent execution.

Candidate497549f remains FAIL on SD-03 reveal and SD-04. The passing portions above remain exact-candidate evidence after the next bounded repair.

## Final candidate browser challenge

Final product candidate: `a36793df0f62c002332d66db181310554aaabb05`. Independently matched local/remote branch to that full SHA and main to the unchanged pinned SHA; `git diff --check 9a94dc5..a36793df0f62c002332d66db181310554aaabb05` PASS. Product delta from497549f is bounded to inert covered drawer graph and deliberate showcase Expand reveal/focus/Restore scroll. Intermediate `7db59a4ffedb67c0d5ec9da6261453127507012b` supplied inert; it is not the final served/verified candidate. The builder explicitly discarded the in-progress intermediate build as final evidence and completed a fresh final production build before restarting5600. No verifier product edit occurred.

Reloaded and signed in only the verifier's disposable5600 tab after final readiness. Actual final browser demonstrations:

| Finding / criterion | Final result |
| --- | --- |
| SD-01 stacked Expand | PASS: at1000 ×700/default Chat, expanded drawer is absolute680 ×594 at y82, matching the repaired usable workbench. Restore returns docked placement. Earlier640 ×480 remedial bounds remain covered by identical CSS. |
| SD-02 Interact Locate | PASS: hidden paragraph Locate leaves Interact active, does not create composition navigation and preserves `Final runtime stays`; the notice explicitly requests Design to inspect its composition. |
| SD-03 small showcase reveal / Restore | PASS: at800 ×600, expanded drawer is752.8 ×568 at y−0.1, fully within the viewport tolerance; Restore control is visible at y10.7–47.3 and receives focus. Restore returns exact previous page scroll y13580 and normal drawer top270.5. Screenshot confirms the entire workbench and controls. At1500 ×900, expanded panel spans1420.8 ×868 at y−0.4. |
| SD-04 focused-page keyboard exclusion | PASS in Designer and shared showcase: Inspect →Tab lands Close inspection, never a covered graph item; covered graph is inert and absent from AX. Close inspection restores graph keyboard traversal; Enter on Right group followed by Inspect shows exact source `right`. |
| Final canonical/context continuity | PASS: final Source text exactly equals the saved pre-move fixture; application identity remains `v1_9eac1d02aaa1624c7bcd1c67cb6de509bc9041222460b3d128e2dd50ec5ceecf`. Source →Structure and Close →Document preserve exact graph camera and runtime input. |

The verifier's temporary showcase tab was closed and temporary browser viewport override reset. The builder's deliverable tab8 and owner5599 were not operated. No provider call or saved owner document mutation was needed.

## Final checks and disposition

Independent final checks at `a36793df0f62c002332d66db181310554aaabb05`:

- `npm test -- tests/ui/structure.test.ts`, from `apps/studio`: **PASS,1file/7tests, exit0,24.81s**. Retained upstream shortcut and unchanged renderer/editor warnings; no failed assertion.
- `npm run check:designer`: **PASS,0errors /6warnings in3unchanged renderer/editor files, exit0**. This checks the final Svelte edits and their TypeScript usage. The full affected14-test run independently passed at497549f; after the bounded inert/showcase-scroll delta, affected shared Structure tests and real browser journeys were re-executed on finala36793df. No test result was carried across a semantic product change without an affected check.
- `git diff --check` across authority-to-final product: **PASS**. Local/remote full candidate identity and unchanged main independently matched. The report and root-owned supporting artifacts are the known untracked evidence at this point; no overlapping product edit was made by the verifier.

The builder's fresh final production build/adapter result is PASS. Full TypeScript checks and affected14tests were builder PASS at497549f; final independent Svelte checking plus affected tests/browser challenge cover the only later product changes. Build provenance and aggregate screenshots are supplied by the stage manager, separate from the independent demonstrations recorded here.

**SD-01–SD-04: CLOSED by bounded repair and independent affected re-verification. No open required finding in this drawer scope. PASS — READY FOR OWNER REVIEW.** Initial failures, partial remedy failure and retained compiler/test diagnostics remain above. Remaining limits: no new provider run, general accessibility certification, broad agent reliability acceptance or unrelated platform repair is claimed. Stage9 remains REOPENED / IN PROGRESS; owner acceptance is pending. Next allowed action is owner hands-on review of the exact scoped product, with candidate/evidence commit and remote verification delivered by the stage manager.
