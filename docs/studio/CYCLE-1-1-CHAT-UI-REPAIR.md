# Cycle 1.1 chat UI repair — in progress

2026-10-23. Owner-authorized repair after review of a populated chat screenshot:
composer/status overlap, cramped transcript, raw Markdown, excessive activity
noise. Apply the owner's professional creative-software preferences: work first,
compact hierarchy, one home per capability, deliberate disclosure, stable tools,
plain language and recoverable experimentation. No Cycle 1.2 collaboration work.

Clean remote-equal base `63ae937cdcbbe1839b78d85bbb9a8a2ef32dac4f`; main remains
`d7401bef6e48330796c74ec00c86db9622d48cdf`. Isolated branch
`codex/studio-cycle-1-1-chat-layout`. Earlier accepted and failed evidence stays.

Bounded scope reconciliation: existing Conversation has no custom-body snippet or
multiline composer API, and only follows appended messages rather than streamed
text. CSS alone cannot implement these behaviors safely. Extend ONLY
`packages/ui-svelte/src/Conversation.svelte` with three optional, default-off
presentation props and focused tests. Existing default rendering, input and
submission behavior remain unchanged; no catalog/node/renderer/editing ABI,
global styles, agent framework or backend changes. Studio owns its layout and
safe AST message renderer. Promote existing pinned mdast-util-from-markdown 2.0.3
to an explicit Studio dependency; no new chat SDK or dependency version upgrade.
This bounded optional extension is necessary to retain reuse instead of forking
the chat component. It does not reopen a foundation stage or claim package release.

Gate: exact pushed candidate, independent default/opt-in checks and visual review
at desktop/short/narrow sizes with long streamed replies, expanded details,
failures and keyboard input; production real-agent smoke. No owner canvas reload
or discard for activation. Stop at verified Cycle 1.1 ready for owner review.

## Candidate implementation

One compact header, screen/selection context, one scrollable transcript and a
bottom-anchored multiline composer. Status has its own bounded row. Chat details
holds model, reconnect, the last eight activity entries and the connection record
in one dismissible, bounded popover. It stays inside the chat panel and above the
composer at tested sizes. Removed repeated setup, history/save reminders and
permanently visible activity. Canvas width remains the existing 320px allocation.

Studio renders CommonMark paragraphs, lists, emphasis, modest headings and code
through escaped Svelte AST nodes. Raw HTML remains text; images render alt text
without network requests; links accept absolute HTTP(S) only. There is no HTML
injection path. Replies from separate tool steps get paragraph boundaries.
Streamed text follows the bottom until the reader scrolls away. Enter sends,
Shift+Enter inserts a newline; IME composition does not submit. Failed admission
retains the request. Agent/edit/history/save server contracts are unchanged.

## Builder checks

- Studio: 140/140 tests, 26 files; 74.58s. Expected test-local target connection
  refusal messages remain in the log; no failed tests.
- Shared renderer: 51/51 focused/default regression checks, five files; 19.45s.
- Studio TypeScript check passes. Designer svelte-check: zero errors, six
  inherited warnings in DocumentHost, RenderNode and StateValuesPanel.
- Scoped TypeScript ESLint passes; dependency lock adds one explicit dependency
  line and changes no resolved versions. Refetched main remains the baseline.
- Browser layout fixture at 1280×720, 1280×500 and 390×700: long streamed
  response, formatted lists, eight activity entries, collapsed/expanded details,
  keyboard dismissal and provider failure. Composer/status do not overlap;
  details do not cover the canvas or composer. Narrow details was tightened
  after the first visual observation. Original owner tab was never navigated.

[Builder logs and screenshots](cycle-1-1-chat-ui-2026-10-23/).
The fixture is explicitly labeled, lives outside SvelteKit routes, never writes
saved screens and is NOT real-agent proof. Run it separately with
`node node_modules/vite/bin/vite.js --config apps/studio/tests/visual/vite.config.ts`.
`?scenario=failure` exercises a failure following partial effects;
`?scenario=offline` exercises missing configuration.

Retained failed observations: the first new shared test checked an async error
before rendering settled (50/51, corrected to wait); initial svelte-check caught
two new type errors, now fixed. A fixture-only Vite restart after formatting left
a blank page; blank captures are explicitly named, reload restored the fixture.
No production failure is inferred from that development-server restart.

Independent exact-commit production build, real-agent smoke and visual verdict
are pending. This builder report is a candidate, not a gate verdict.
