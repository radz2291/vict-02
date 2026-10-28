# AI authoring exposure — AI-EX01

Owner amendment, 2026-10-28: the existing public AI patterns must be usable through both manual Studio authoring and the Studio agent. Public exports alone, a gallery, and the historical blanket `host-only` disposition do not meet this criterion. This is authoring-foundation scope, alongside CF-01; it is not deferred to Milestone 2. Provider engines and private reasoning remain outside this amendment.

Status: IMPLEMENTATION CHECKPOINT SAVED / EXPOSURE CHECKS PASS / POPUP CONFORMANCE FAIL / OWNER ACCEPTANCE OPEN. This record is a capability map; the linked independent evidence supplies only its scoped verdict. The initial audit reviewed `d733980b1894b2309d26bd3f408a3e2b7da5e823`: only Conversation, Message and PromptInput revisions 1/2 were registered. Their earlier actual-agent chat evidence remains valid within its recorded scope.

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

## Evidence and next checks

Retain the actual chat's twelve confirmed edits, its failed appearance observation, and the bounded post-repair actual-agent observation. These establish the three original adapters and the specific appearance repair; they do not prove newly exposed tool, source, approval, attachment or retry capabilities.

Retained new failure: the scoped ModelSelector test placed the open menu in the correct application and delivered selection, but Escape dispatched in a sibling application was `defaultPrevented=true` by Bits Dropdown's global Escape layer (`packages/ui-ai-svelte/test/action-model-portal.svelte.test.ts:32`, `Temp/vict-ai-actions-isolation.log`: five passing cases, one failing ownership case). Placement PASS does not close isolation. ModelSelector exposure is implemented; owned interaction conformance is FAIL pending repair, and actual browser/agent acceptance remains HELD. No exception is inferred.

Required closure evidence: registry/manual/agent identity coverage; unchanged revision-1/2 compatibility pins; valid and invalid finite-data admission; typed output/state wiring; real part styling; owned open hovercards/menus; keyboard/focus; source/Undo/Redo/Save/reopen; a representative actual Studio-agent composition using the newly exposed public activity/tool/result/source/attachment or action surfaces. Reuse retained valid evidence, identify new run/cursor/artifact/observation boundaries, and disclose unrun checks. No physical-device, independent integrated PASS, provider integration or owner acceptance follows from unit tests.

Builder integration check, 2026-10-28: `npx vitest run --config packages/ui-ai-svelte/vitest.config.ts test/authoring.svelte.test.ts` passed **3/3**, exit 0 (`Temp/vict-ai-exposure-registry-legacy.log`). The first case builds the combined package registry with required compatibility pins and compiles every registration example. The retained cases exercise controlled message/composer changes, Send without source clearing/provider execution, and busy Stop intent. Five inherited renderer warnings are retained. `git diff --check` passed for the integration-owned files, and the historical `compatibility.json` / `compatibility-v2.json` had no byte changes. This is current working-tree builder evidence, not a sealed candidate or independent verdict. It does not erase the ModelSelector ownership failure or establish new actual-agent output quality.

## Frozen implementation checkpoint after 1569567

All 23 intended AI identities now have 28 versioned contracts, unique latest manual Insert recipes, exact agent contracts and shared edit admission; six historical revision-1/2 contracts and their pins remain unchanged. Independent Studio exposure checks pass2/2. The package-wide current check passes60cases and fails2cases in6files (exit1): ModelSelector consumes sibling Escape and restores focus to its trigger; a hovered MessageAction tooltip consumes sibling Escape. These are retained executable product failures, not skipped tests or approved exceptions.

New adapters forward actual semantic parts, use the existing public patterns/Conversation/Markdown, validate finite versioned data and expose controlled typed intents. Availability flags defaultfalse and require the host to bind outputs before enabling; no binding-introspection enforcement is claimed. Larger manual/host JSON limits do not remove the current4000-character agent edit limit. New actual Studio-agent/persistence/device proof remains unrun.

Studio TypeScript passes; designer Svelte check has0errors/5inheritedwarnings. Portal wrapper provenance hashes match the exact normalized current files. Production build and fresh packed-consumer results follow separately. Full AI conformance remains FAIL/HELD pending a reusable owner-scoped menu/tooltip correction and integrated evidence. No private Bits patch, ModelSelector-specific interaction bypass or implicit owner acceptance was introduced. See foundation-evidence/ai-exposure-1569567-repair.json for frozen product hashes and distinct scopes.

Exact source checkpoint: b793b0b9843094be71d3ab2a418ebcff24ab7862. Independent association verified all59frozen product hashes, clean product diff and unchanged historical pins; no duplicate tests were run merely to associate the commit. See foundation-evidence/ai-exposure-independent-b793b0b.json. The final Studio production build and AI CSS build both completed exit0. Build success does not erase the two retained popup failures or replace actual-agent/browser/device evidence.
