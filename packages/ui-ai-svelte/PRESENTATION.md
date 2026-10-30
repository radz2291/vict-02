# Presentation fidelity and host adaptations

AI-EX01 owner amendment (2026-10-28) requires these public compositions to be
reachable through canonical manual and agent authoring, not only code imports
and the gallery. Thin adapters reuse these existing patterns; they must forward
declared parts to actual rendered surfaces and retain owned hovercard/menu
behavior inside the application viewport. Generic outer wrappers, registered
exports and passing schema checks alone do not establish visual conformance.
Existing revision 1/2 contracts remain pinned. New authoring output names are
typed requests; host-controlled status and results remain authoritative.

Reference: official shadcn-svelte AI Elements at
`b10f153250b18abfccf49a06e1c4c68945edffa5`, Rhea styled registry.
`upstream-manifest.json` records each pattern's docs and example-source hashes.
Initial VICT fixtures proved availability, not full visual fidelity. Owner review
identified simplified compositions; the correction restores primary structure,
icons, grouping and states. This is not pixel identity across host themes or
every secondary docs variant.

| Pattern | Presentation and deliberate host boundary |
| --- | --- |
| Chain of Thought | Distinct summary/status, nested steps/code/badges/links; host-approved public activity only |
| Chat | Scroller, aligned messages, Markdown, activity, optional header/reset; Studio retains its own shell and real transport |
| Checkpoint | Marker separator/content/compact Restore; callback controls restoration availability |
| Confirmation | Item request and controlled running/denied/completed states; click never proves execution |
| Context | Compact summary and aligned usage breakdown; actual counts supplied by host |
| File Tree | Recursive folders, selected appearance and aria-current; callback does not grant file access |
| Inline Citation | Hostname chip and timed rich hovercard; safe supplied source, no preview fetch |
| Message | Aligned bubble, compact tooltip actions, assistant footer; confirmed clipboard success and optional host edit/retry/feedback |
| Model Selector | Outline grouped controls, labels, menu widths and Effort; host controls selected model/effort |
| Plan | Separate proposed-step progress; no execution from rendering |
| Prompt Input | Icon submit/Stop, attachment media/removal and optional grouped footer; host send/attach callbacks and draft/IME guards |
| Queue | Separate counted pending/completed groups; main completed section open, collapsed descriptions variant optional |
| Reasoning | Disclosure with running/reader choice/duration; iconless primary or optional duration/icon variant, public summary only |
| Sources | Count, deduplication, disclosure and external arrows; safe links, no retrieval inference |
| Stack Trace | Error summary and application/framework grouping; optional host frame-selection callback |
| Subagent | Metadata, nested work and result within disclosure; observed host child-run data only |
| Suggestion | Nonshrinking horizontal suggestions above a prompt; callback fills local example |
| Task | Separate observed-work status, without Plan counter or pending rows |
| Terminal | Command/exit summary and one bounded output; reader open choice retained, no shell runner |
| Test Results | Suites/tests, pass/fail/skipped summary and errors; legacy Step input not falsely classified as skipped |
| Tool | State-aware summary, bounded output, denial and optional approval; input detail optional. Secondary Sheet is not bundled: onOpenOutput delegates to a host presentation panel, and literal Sheet parity is not claimed |

Primary gallery previews use a known maximum width and shrink on mobile. VICT
light tokens and host content remain explicit adaptations. The selected AI family
and dependency closure do not replace the entire general shadcn-svelte catalog.
Backend-dependent actions require actual host callbacks. Repository Cycle1.3
audits retain reference/before/after evidence and the independent gate verdict;
source provenance alone never establishes visual acceptance.


Conversation tool exchanges use one shared renderer for chronological and legacy activities. Optional host-supplied `input` and `result` payloads show separate sections inside a reader-controlled, initially collapsed disclosure, with explicit redacted/truncated/unavailable labels. These are presentation data and grant no tool authority. Legacy stages/detail remain supported. Hosts may call the optional second `onSend` argument once the request is admitted; this clears only the submitted composer draft, without waiting for the complete response or erasing a subsequently typed draft. Legacy send callbacks retain completion-time clearing. Default transcript compaction stays compatible; Studio deliberately retains every admitted entry inside its existing bounded transport.
