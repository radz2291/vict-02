# Independent chat controls re-verification — PASS

2026-10-23, Asia/Kuala_Lumpur. Product `402dec75c7593fe23e41f3d3c0659ca61a8edc27` on `codex/studio-cycle-1-1-chat-controls`, remote-equal at verification. Isolated fresh verifier branch `codex/studio-cycle-1-1-chat-controls-verification-final`. Main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. Required root/canonical Stage9/current Studio handoffs reviewed. Product source is untouched by this verifier.

Initial candidate `d23d73144770e7181c9b46febdfdec76f0c554e5` independently FAILED because bottom Chat details covered textarea/Send at all three viewports. Remote-equal failed evidence `c0c71ba83063f38f0e51972938802d88b24592ad` is preserved in adjacent verification-cycle-1-1-chat-controls, including screenshots, raw geometry, artifact identity and harness observations. The builder repaired the anchor in product402; no failed result has been relabeled.

## Exact candidate checks

- Affected UI10/10: chat-controls1, agent-chat5, chat-message4; actual Studio Vitest3.2.7,26.82s. TypeScript passes.
- Exact production build passes,41.74s SSR (client16.85s). Existing Svelte warnings about unrelated initial capture, authoring span keyboard/role and StateValuesPanel label, plus date-library circular imports, remain in the full log; no new error.
- Candidate versus preceding delivery14961be has product changes only AgentChat.svelte and the View menu label in Designer.svelte, plus one UI test. Server/provider/framework/canonical agent-edits/storage/history sources are byte-unchanged. GLM131072 output and default thinking remain. Existing broad real-z.ai evidence on prior product3c54f5e remains scoped historical proof; this presentation-only gate makes no new live-provider claim.
-202 artifact files have SHA256/byte manifest tied to exact402; zero absolute/nonrelocatable imports. All8 runtime externals plus native SQLite and bundled mdast2.0.3 resolve to the same physical files as the intended builder activation destination. Build preserved at verifier apps/studio/build.
- Actual owner-selected credential scan: zero matches in client/evidence; zero server-only markers in44 client files. No key or private configuration was copied or printed.

## Actual production browser challenge

production-controls.mjs uses an isolated headless Chrome and authenticated5592 test origin, with explicitly labeled deterministic transport fixtures. It renders the genuine production Designer, Conversation, ControlScope and catalog CSS. No provider call or edit proposal occurs. Owner5591/browser/saved content were never accessed or changed.13 assertions pass; raw geometry/transport counters in production-controls.json. Screenshots inspected directly by verifier.

| Criterion | Verdict and evidence |
| --- | --- |
| Redundant Studio agent heading and assistant identity absent | PASS; no heading, assistant metadata display:none. Existing useful user message label retained. |
| View menu hides and restores chat | PASS; actual keyboard menu actions Hide chat/Show chat. Canvas960→1280px, draft and canvas byte-identical. |
| Mounted feed and pending turn preserved while hidden | PASS; one POST, zero DELETE, additional streamed text arrives while hidden and appears on restore. |
| Context, Stop, details at bottom | PASS; footer follows composer, status follows footer. Stop sends exactly one DELETE, ends busy and reports Stopped. |
| Popup stays within transcript at1280×720,1280×500,390×700 | PASS; popup lower edge four pixels above composer. No textarea, Send or canvas overlap. |
| Provider failure while popup open | PASS; useful provider failure/no edits message, bounded details stays above input, Stop disappears. |
| Multiline composer and open-popup growth | PASS;8-line draft with zero unintended new POST, input112px desktop/76px mobile. Programmatic input growth while popup remains open tracks form boundary. |
| Viewport resize while popup open | PASS; mobile→short desktop retains contained popup. |
| Long activity/record and reconnect | PASS;8 long activity rows and long turn/profile record scroll within bounds; record visible after internal scrolling. Reconnect GET restores Ready, draft and canvas preserved. |

The corrected harness uses keyboard Input.insertText via sendCharacter for multiline content, avoiding Enter submissions recorded in the failed run. Dynamic-growth stress is explicitly programmatic while popup is open; ordinary pointer input dismisses the existing Popover. No candidate issue was repaired by this verifier.

## Disposition

PASS for this bounded chat-controls amendment. No new blocking or nonblocking product finding in this scope. Prior functional latency/copy observations and broader Cycle1.1 historical evidence remain. Own5592 server stopped, no review browser left open; exact build preserved. Parent may activate this independently built artifact with hash verification, preserve the owner's unsaved page/chat/draft, show a separate fresh review page, and report ready for owner review. No owner acceptance, main merge, Stage9 closure or Cycle1.2 authorization.
