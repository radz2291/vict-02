# AI authoring exposure — AI-EX01

> Owner pause,29October2026: **PAUSED / HELD**. Earlier23-identity AI exposure
> demonstrations remain scoped historical evidence; they do not establish the
> newly reopened flow actual-agent requirement. Product119c80bf is built but not
> installed; no further provider/activation work until owner resumption. Read
> [the pause handoff](VICT-PAUSED-HANDOFF-20261029.md) before the historical counts.

> Sanitized public requirements excerpt. Private verification history is omitted; all owner acceptances remain open. See [publication handoff](VICT-PAUSED-PUBLIC-HANDOFF-20261030.md).

## Shared delivery path

Package descriptors, renderer implementations, compatibility pins, registrations, seeds and guidance install through `apps/studio/src/lib/designer/authoring.ts`. `recipes.ts` derives manual Insert recipes from those registrations. Manual insertion must choose one effective latest registration per component identity, since recipe IDs do not encode revisions; retaining duplicate recipe IDs selects historical wrappers and conceals new capabilities. The same registry retains exact-revision agent family/catalog/contracts discovery and component insertion. The Inspector derives property and binding controls from the installed descriptors. New exposure must use this path rather than add a second agent UI or provider transport.

Complex presentation records use bounded, versioned, validated JSON strings where existing scalar canonical state cannot hold records. The reference-only `array` field declaration does not make arbitrary object arrays valid local state. Graph/vector adapters establish the existing finite-JSON-string convention. Scalar props and typed intent outputs remain explicit. Invalid data must produce a useful refusal, not fabricated content or a fallback claiming success.

Current agent scalar-edit strings are limited to 4,000 characters (`agent-edits.ts`). Some adapter data schemas admit larger records for host/manual use; those higher limits are not a claim that one Studio agent edit can deliver that amount. Representative agent checks must stay within the actual tool bound, and larger-data authoring remains a disclosed delivery limit until an affected bounded operation is implemented and verified. Never split arbitrary JSON into independently invalid property writes or silently truncate supplied records.

The candidate keeps the six historical contracts (`vict.ai.conversation`, `vict.ai.message`, `vict.ai.prompt-input`, each revisions 1/2), adds fourteen public-data pattern identities plus standalone Markdown and four action identities at revision 1, adds Message/PromptInput revision 3, and adds `vict.ai.transcript@1`: twenty-eight contracts representing twenty-three exact definition IDs and all twenty-one intended public pattern compositions plus the public Markdown renderer. Expected counts are a coverage target, not proof until the combined registry check passes. The existing slotted Conversation remains independently useful; public Chat maps to the distinct transcript adapter. The owner explicitly requested the already built public standalone Markdown renderer as well; it is not an internal primitive exclusion.

## Capability map

Every row below requires manual insertion/configuration, agent discovery/authoring, canonical Save/reopen, real rendered parts and truthful completion evidence. An implemented adapter alone does not establish those checks.

| Public capability | Required authoring surface | Boundary and verification focus |
| --- | --- | --- |
| Chat / Conversation | Slotted composition retained; structured messages, public activity/events and controlled lifecycle where exposed | Send/Stop are intents; preserve draft/admission/failure behavior; no provider created by rendering. |
| Message | Role/text plus existing copy/edit/retry/feedback controls and states | Actions need authored bindings; preserve old revisions and actual repaired bubble appearance. |
| PromptInput | Controlled text/busy/Send/Stop, attachments/removal/attach and footer composition | Attachment descriptors do not grant filesystem/upload authority; preserve Enter/Shift+Enter/IME and draft semantics. |
| ChainOfThought | Public process steps/status/details/code/badges/safe links | Only explicitly supplied public execution steps; no access to or inference of private chain of thought. |
| Reasoning | Public summary/text/running/title/duration/open/Markdown/icon | Only a provider-supported or host-approved public summary; absent data is not invented. |
| Tool | Identity/status/input/result/error/details and optional output-open/approval intent | Sanitized public receipts; displaying a tool does not execute it. |
| Plan | Declared proposed steps/status/disclosure | Distinguish proposed work from committed actions. |
| Task | Observed steps/status/disclosure | Preserve its distinction from proposed Plan/Queue entries. |
| Queue | Pending/completed records and disclosure | Presentation, not a scheduler. |
| Terminal | Sanitized command/output/status/exit code/disclosure | No shell execution capability. |
| TestResults | Suites/tests/status/errors/output/running/disclosure | Supplied results, not a test runner or gate verdict. |
| StackTrace | Sanitized frames/title/disclosure and frame-selection intent | Selection does not grant local file access. |
| Subagent | Actual child-run metadata/public steps/result/status | Presentation does not spawn agents. |
| Context | Actual usage/limit/breakdown and owned hovercard | Do not guess unavailable provider usage. |
| Sources | Supplied citations/open state | Safe supplied URLs, deduplication and truthful counts; no implied retrieval. |
| InlineCitation | Supplied citation fields and owned hovercard | No automatic preview fetch or invented source. |
| FileTree | Supplied bounded tree/selection and selection intent | No filesystem access follows from displayed paths. |
| Checkpoint | Label/availability and restore request | Host validates and performs history restoration. |
| Confirmation | Controlled requested/running/denied/completed state and decision request | A click requests a decision; only the host settles authorization/execution. |
| Suggestion | Text and selection intent | Feed an existing composer path; no silent execution. |
| ModelSelector | Supplied model/effort options, controlled values and change intents | Host/server allowlists remain authoritative; no credential or provider switch from presentation. |
| Markdown | Standalone safe Markdown text | Reuse the existing renderer and its safe URL/HTML policy; no authored script execution. |

## Legitimate internal-only exclusions

Low-level Trace/Bubble/Item/MessageScroller parts, highlighter/hooks, transport types/helpers, and showcase components do not each need a standalone authoring identity. Their intended reusable presentation is reached through the registered compositions or existing shared catalog. No duplicate general UI library is introduced. Capture helpers remain observation infrastructure. Standalone Markdown is explicitly registered and requires its own authoring evidence; rendering Markdown inside an assistant message does not prove that standalone path.
