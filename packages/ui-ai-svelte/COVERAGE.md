# Complete official AI Elements family

## AI-EX01 authoring amendment — 2026-10-28

The owner requires all twenty-one intended public patterns and the built public
standalone Markdown renderer through the same
manual Studio and agent authoring registry. The historical fixture/host-only
dispositions in the table below describe the earlier baseline, not satisfaction
of this new requirement. Package authoring now integrates dedicated passive,
action and extended-chat adapter modules, with exact identities, finite data
schemas, seeds, typed intent outputs, real parts and compatibility pins. New
Message/PromptInput revisions preserve revision 1/2 contracts; a distinct
`vict.ai.transcript` identity adapts the public structured Conversation.

Registration and scoped checks are separate from actual authoring proof.
See `docs/studio/AUTHORING-FOUNDATION-AI-EXPOSURE.md` in the repository for
the capability map, justified low-level exclusions and pending integrated
verification. Existing actual-agent Chat evidence proves only its recorded
three adapters and appearance repair. No new backend, provider processing,
approval authority or access to private reasoning follows from these adapters.

Baseline: official shadcn-svelte commit
`b10f153250b18abfccf49a06e1c4c68945edffa5`, Rhea style, October 2026 family.
All 21 patterns below have reusable exports and a fixture in `PatternShowcase`.
Visual fidelity and host/secondary-variant adaptations are separately recorded
in [PRESENTATION.md](PRESENTATION.md), following owner review corrections.
Names are exported through `/patterns` and the main `Patterns` namespace.
Fixtures are **not** backend capability or product verification evidence.

| Official pattern | Public composition | Upstream building blocks | Integration requirement and Studio disposition |
| --- | --- | --- | --- |
| Chain of Thought | `ChainOfThought` | Trace, Code Block, Badge family available | Host-supplied **public activity summary** and stable step IDs; no private reasoning inference. Fixture available; Studio uses actual tool activity, not a fabricated reasoning trace. |
| Chat | `Chat` / default `Conversation` | Message Scroller, Message, Bubble, Input Group | Host messages/send/stop callbacks; Studio supplies the retained VICT/Mastra transport and lifecycle. |
| Checkpoint | `Checkpoint` | Marker, Button | Restore callback must map to a real validated history command; absent callback disables restore. Studio does not claim branching/checkpoint restoration from this pattern. |
| Confirmation | `Confirmation` | Item, Button | Host owns approval identity, authorization and decision settlement; absent callback disables decisions. Studio chat does not invent approval backend support. |
| Context | `Context` | Hover Card, Progress, Button | Actual usage and model window required. Fixture values are labeled; Studio does not guess provider usage. |
| File Tree | `FileTree` | Collapsible, Button | Stable source paths and an optional selection callback; recursive folders are local view state. Fixture available; no filesystem access follows from a displayed path. |
| Inline Citation | `InlineCitation` | Hover Card, Button | Safe host-provided source URL/title/excerpt. HTTP(S) only; no preview/image network loading. Studio needs actual source metadata before rendering citations. |
| Message | `Message` | Message, Bubble, Tooltip family available | Host role/text/action callbacks. Default chat provides copied messages and safe streamed Markdown/code. Retry/edit/feedback require host semantics and are not invented. |
| Model Selector | `ModelSelector` | Dropdown Menu, Input Group | Model/effort allowlists and server-validated callbacks. Menus disabled without callbacks. Gallery changes local examples only; Studio server provider settings remain authoritative. |
| Plan | `Plan` | Trace | Declared ordered steps, statuses and stable IDs. Host must distinguish proposed from committed actions. Fixture available; Studio does not manufacture a plan feed. |
| Prompt Input | `PromptInput` | Input Group, Attachment, Dropdown Menu family available | Controlled text, Send/Stop callbacks, optional typed attachment descriptors. Upload/validation requires host support; Studio does not expose a pretend upload action. |
| Queue | `Queue` | Trace | Host todo records/status; separate pending and completed sections. No automatic execution or scheduler. Fixture only until actual queue data exists. |
| Reasoning | `Reasoning` | Trace | Explicit safe reasoning **summary** supplied by host, with honest running state. Never manufacture or expose hidden chain of thought. Fixture only in Studio baseline. |
| Sources | `Sources` | Trace | Actual citations with safe URLs. Count and external navigation only; no claimed retrieval merely from presentation. |
| Stack Trace | `StackTrace` | Trace, Code Block | Already-sanitized tool failure/frames; no secrets or local paths should be forwarded by the host. Fixture only; production chat uses safe existing errors. |
| Subagent | `Subagent` | Trace, Code Block and Badge family available | Actual child run identity, statuses, public steps and result. Fixture only; no subagent launcher or fabricated run in Studio. |
| Suggestion | `Suggestion` | Button | Explicit callback feeds an existing composer/send path; disabled without one. Fixture shown; no automatic prompt execution. |
| Task | `Task` | Trace | Separate observed-work summary without a Plan counter or pending steps. Plan and ChainOfThought also have their own compositions; none adds execution semantics. |
| Terminal | `Terminal` | Trace, Code Block | Sanitized command/output from an authorized backend. Presentation never executes shell text. Fixture-only command clearly labeled. |
| Test Results | `TestResults` | Trace, Code Block | Actual suite records plus output; synthetic fixture is explicitly not gate evidence. No test runner is bundled. |
| Tool | `Tool` | Trace, Code Block | Host tool identity/state/input/output with safe projection; Studio retains real commit acknowledgements, refusals and outcomes. Trace composition is shared; no tutorial endpoint. |

The complete registry dependency closure is 21 items: `trace`, `code-block`,
`badge`, `message-scroller`, `message`, `bubble`, `input-group`, `marker`, `button`,
`item`, `hover-card`, `progress`, `collapsible`, `tooltip`, `dropdown-menu`,
`attachment`, `use-highlighted-code`, `input`, `textarea`, `separator`,
`highlighter`. Their subcomponents are source-exported, with public entrypoints
for UI families. The highlighter remains implementation-local to Markdown/code.

The full upstream UI catalog is **not** renamed wholesale into this specialist
package. Existing VICT catalog primitives keep their own responsibility. The
specialist package takes the complete dependency closure of the selected AI
Elements family, and its patterns stay composable through public exports.

Not claimed: automatic backend support for branching, approvals, attachments,
provider selection, filesystem edits, shell execution, task scheduling or
subagent runs; every upstream tutorial variant or AI SDK demo transport; paid
examples; React, assistant-ui or Deep Chat integration. The 21-family coverage
is explicit rather than a claim that every illustrative demo is a production
feature. The gallery proves presentation availability; Cycle 1.3's separate
integration/consumer evidence must prove the working supported behavior.
