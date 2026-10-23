# Independent plain-prompt baseline challenge — FAIL

Candidate delivery: `9f834ccfa0f0b7b744c22c895cc995d64a3b2bac`.
Exact product: `4700689bf985c83cd3f944ad4cd324f2bfe8d724`.
Studio tree: `2922600773758df5dde65c369d5fdca3f6423b18`.
Main: `d7401bef6e48330796c74ec00c86db9622d48cdf`.

Fresh verifier reused the authorized separate verifier checkout, checked its clean
`192d6380490ab87880e206a27dceffacd51e18c3` state and fetched main, then created
`codex/studio-cycle-1-1-tool-completion-verification` from the exact delivery.
No implementation files were changed. The owner's 5591 browser/server, screen,
chat, drafts and saved data were not accessed or modified by this verifier.

The exact uncoached owner prompt was sent once through the real pinned Mastra
composition and canonical EditorBridge on an isolated blank screen:

> Pls create a landing page for an Ai platform like chatgpt, called Quellight.

Real provider: `zai/glm-5.3-flash`, authorized local credential configuration.
The test-only seam wraps the real ModelRouter stream without changing chunks,
request settings, prompts, provider options or response behavior. It records
finish reason, token usage, part types, tool JSON validity/length and reasoning
character counts; it never retains hidden reasoning text or credentials.

## Result

**FAIL / Cycle 1.1 readiness held.** The provider exhausted the complete output
budget before emitting any visible text or tool request:

- Requested maxOutputTokens: **4000**.
- Finish reason: `{ "unified": "length", "raw": "length" }`.
- Provider output tokens: **4000 total, 4000 reasoning, 0 text**.
- Applied edits: **0**; canonical document remains exactly one blank root node.
- Studio terminal event incorrectly reports **`status: completed, applied: 0`**.
- Turn: `turn-8c286664-c3c7-4419-9796-9f491492240d`.
- Real turn: **73.50 seconds**; complete harness: 121.68 seconds including cold
  transformation/imports.

This independently proves budget exhaustion and false completion for the exact
plain request. It supports the same output-exhaustion failure class as the owner's
incomplete JSON tool call, but does not claim that this separate run emitted that
same malformed JSON: this run reached the limit entirely during reasoning.

The evidence harness's single assertion verifies that a terminal event was
captured; its green Vitest result is **not product acceptance**. The captured
product behavior is FAIL. Earlier revision/layout proofs remain historical within
their tested scope and do not establish plain-prompt reliability.

Evidence: [safe stream trace](baseline-provider-trace.json),
[probe](baseline-provider.test.ts), [configuration](probe.config.ts),
[log](baseline-provider.log). Initial setup attempted a config under the wrong
relative working directory and failed before running a test; the evidence files
were moved into this documentation directory and the shown probe was rerun.

Next allowed action: bounded Studio provider budget/completion repair and fresh
exact-candidate verification, including the same uncoached prompt. No owner
acceptance, Stage 9 closure, Cycle 1.2, main merge or framework replacement.
