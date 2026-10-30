# Actual second application — nested Project planner

Product source: `8d8be402893a8942b985ad920b32b31807e2ad47`.
Screen: `screen-b1d0036a-e404-448b-8f84-c92b2752220d`.
This is the actual Studio agent's continuation, not a coding-agent replacement document.
The first draft, route failures, stale authentication refusal and zero-width layout failure remain retained.

## Successful authoring and native ownership

The guidance retry acknowledged four transactions, adding one Task to each Project's nested graph, refreshing the containing revision between writes, and applying theme/guide changes. The last edit receipt records 18 calls, zero refusals, four edits and 274856ms elapsed; this is a partial-turn measurement, not provider latency or cost. A separate actual-agent style-only transaction repaired the authored zero-width inner canvases. Save r1.r3 and a full page reload reset the old camera fit; both ordinary Task controls then rendered at usable widths.

Both nested workspaces use the same lexical state name `graph`, shadowing the document graph. Both Task instances use node ID `t1`. Their containing Project occurrences, `p1` and `p2`, supply independent controlled graph strings through the shared Project body. Task bodies likewise share ordinary registered controls and controlled parameters. Private `helpOpen` is temporary occurrence state.

Native interaction changed Website relaunch's Task title to `Redesign homepage hero checked`, exercised native text Undo/Redo with focus/caret retained, and changed Status. The other Project's serialized graph stayed byte-identical. Inner keyboard movement and its owned Undo/Redo changed only the Task position, preserving both Project positions. Another native field edit after Redo retained the moved position. A pointer drag then moved that Task to `{x:66.66666666666666,y:56.66666666666667}`; outer revision became20, first inner revision18, second inner revision1. See `stage-5-nested-native-controls-pass.json`, `stage-5-nested-native-history-pass.json` and `stage-5-nested-native-pointer-observation.json`.

## Actual targeted agent change after manual editing

The agent was asked to change only Mobile app beta's Task status from Todo to Doing and make the guide truthful. It used a routed graph operation and a guide text operation in one acknowledged transaction, with zero refusals at its edit receipt. Outer revision20→21, second inner revision1→2. The entire first Project node, including its manually edited graph string, remained byte-identical. Project positions stayed `{40,40}` and `{360,40}`. The guide now says to select a task and edit its already-visible fields, retaining Save/temporary-preview/no-database policy.

The receipt reports14 calls, one confirmed edit, eight provider requests and185827ms elapsed at acknowledgement; later verification reads are outside that partial measurement. Shared Studio Edit-menu Undo restored the exact preceding graph and visible Todo; Redo restored the exact resulting graph and visible Doing. See `stage-5-targeted-coexist-*` receipts, source comparison and history record. These are independent native/source checks, not reliance on the model's prose.

## Themed private Help

Native opening of the first Project's Help focused its first item. ArrowDown focused Save behavior; Escape closed the menu and returned focus to that Project's Help trigger. Computed background/text/border matched authored theme values (`rgb(244,248,252)`, `rgb(36,66,95)`, `rgb(201,219,238)`). Its200×79.6 rectangle was within the1033×528 application viewport. Opening and closing left the complete canonical source byte-identical. See `stage-5-themed-help-native.json` and screenshot.

The first actual-agent open-popup capture safely refused with `STUDIO_CAPTURE_SCROLL_UNSUPPORTED`; source was unchanged. After native page scroll reset to0, the normal observation-only retry succeeded: current cursor r1.r3#22, same digest84377d55..., one owned overlay,728×528 crop of744×528 viewport and870px document. No edits were applied. The image assessor saw the Help menu within that crop, explicitly disclaimed semantic ownership and untested interaction; native receipts establish those separately. The failed attempt, cropped area and truncated public receipt remain disclosed. See `stage-5-themed-help-capture-retry-*`.

## Save, lifetime and reopen

Normal Studio Save produced r1.r4, outer graph21. `stage-5-final-supported-export.json` is the unchanged supported export and `stage-5-final-saved-source.json` its canonical baseline. With Help open, normal app selection switched to the preserved Evidence desk; the old Project planner main and its Help menu were absent from DOM. Reopening the planner showed both Help triggers closed and canonical source byte-identical. A full browser reload then loaded saved r1.r4: exact source bytes, both Task titles/statuses and graph positions retained, no open Help menu. See `stage-5-help-lifetime.json`, `stage-5-final-reload-result.json` and final owner screenshot. App switching reported in-session retention, so the separate browser reload supplies saved-storage proof. Portable/public evidence is recorded by the separate helper and review.

## Exact portable public consumer

The existing importer/export attachment roundtrips the supported r1.r4 export byte-for-byte (SHA256 `ed2c4fe34d18950e0ec242f0a39cd45f92390c404bab8fc7362db9a5ac33d451`), including outer21, first inner18 and second inner2, exact nested graph strings/types/values/positions. Public preparation verifies all seven bYGiad package archives and510 installed files, compiles the unchanged export and validates the renderer before production build. See `stage-5-portable-summary.md` and underlying reports.

The sealed static server at `http://127.0.0.25:5631/` serves four verified public files only, using preview receipt SHA256 `a1a1cc5c622ad903b34cf47b4a13edefbfe4e74200c6631fe3e264c7a88c367c`. Native interaction appends ` public` to the first Task title and sets it Done; the second title/status stay unchanged. Help has the same authored theme, viewport bounds, settled first-item focus, ArrowDown and Escape-to-own-trigger behavior. A settled reload restores both exported titles and Doing/Doing, both Help triggers closed. The immediate pre-mount empty reload read is retained separately; it is not treated as a pass. See `stage-5-public-native-result.json`. The initial synchronous popup focus read likewise preceded the settled first-item focus check; both are retained.

No database, durable application records or backend effects were added. Source-backed Studio edits are configuration saved explicitly; standalone runtime edits and private popup state do not silently change authored defaults. No owner acceptance or Stage9 closure is inferred.
