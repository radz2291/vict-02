# Interactive pattern source fidelity audit

2026-10-23. Eight-pattern audit, followed by the coordinator's bounded repair
authorization. This is source/composition evidence, not pixel or browser proof.
Official baseline: `huntabyte/shadcn-svelte@b10f153250b18abfccf49a06e1c4c68945edffa5`.
The [reference manifest](interactive-references/manifest.json) records exact
raw URLs, SHA-256 and byte counts for all eight docs, their eight ComponentPreview
examples, and the file-tree recursive component. [Local before hashes](interactive-references/local-before.json)
bind the audited wrappers and PatternShowcase. The initial concurrent fetch
encountered an SSL error; serial retry used normal TLS verification and succeeded.

All comparisons below use actual pinned example markup plus usage guidance.
Different host text, dark/light themes, card container width, and safe typed
data adapters are not automatically defects. No backend or AI SDK authority is
imported from demo behavior. No product files were changed during the audit.

| Pattern | Concrete pre-repair difference | Bounded repair / preserved host adaptation |
| --- | --- | --- |
| Checkpoint | Official `Marker.Root variant="separator"`; label and xs Restore button share inline-flex Marker.Content. Local default Marker adds Flag, places sm Restore outside Content, and changes label to Restore checkpoint. Gallery is a lone marker rather than a post-turn separator. | Use pinned separator and nested xs Restore layout, label-specific accessible name, explicit restore availability. Keep label/onRestore; never truncate conversation or restore a document internally. Gallery can show the marker between fixture turns. |
| Confirmation | Requested Item/Media/Content/Actions composition and sm Deny/Approve sizes already match. Shield instead of Terminal is a domain icon adaptation, not inherently a defect. Official demo transitions a resolved request into a Tool/Trace line; local wrapper/gallery never displays that state. | Keep existing title/description/onDecision/pending. Add host-controlled requested/running/denied/completed presentation and optional icon. Only explicit host state changes display a resolved line; a click cannot grant approval or claim execution. Gallery simulates these states clearly. |
| Context | Same HoverCard delays, width and Progress. Local replaces official aligned Context heading and muted compact usage with plain raw-count paragraph, omits Input/Output/Reasoning rows. | Restore header typography/alignment and compact counts. Add optional typed breakdown rows, preserving used/limit. Missing metadata must stay missing; do not fabricate token counts or private reasoning. Gallery supplies known fixture breakdown. |
| File Tree | Recursive Collapsible/ghost Button/indentation/icons already match. Local omits upstream `font-normal`, open-folder hover classes, selected accent fill and `aria-current`; API lacks selected path. Gallery callback only changes global status. | Add optional controlled selected path; use upstream state classes and aria-current. Keep FileNode and onSelect path contract; paths remain opaque host identifiers, no filesystem operations. Gallery updates selected state and includes a nested folder. |
| Inline Citation | Official secondary xs hostname chip and 10/100ms delays; local outline title chip/default delays. Official w-64 gap-1 card has strong title, muted description, muted hostname link and new-tab SR text; local only plain excerpt and Open source link. | Restore exact composition and derive hostname only after safeExternalUrl. Retain Citation.title/excerpt as escaped text and noopener/noreferrer; malformed/unsafe URLs render inert text with no anchor. Multiple inline fixture chips demonstrate prose flow. |
| Model Selector | Local same DropdownMenu/InputGroup primitives and radio callbacks but loses demo outline triggers, Model/Effort aria names, visible muted Effort prefix, w-48/w-36 menus, provider Group/Label/Separator structure and effort heading. Local gallery separates selectors from composer. | Add optional ModelOption.group, preserve flat arrays and callbacks, restore demo trigger/menu markup. Host supplies provider groups and effort options. Showcase composes selector beside PromptInput controls; no server/provider configuration change inferred. Demo Attach behavior is not backend authority. |
| Sources | Local Trace primitive composition is substantially aligned, but trigger omits Used prefix, rows omit external-link arrow and new-tab SR text; duplicates by URL remain. Official demo is open and after answer text; local/gallery defaults collapsed. Usage snippet allows collapsed, so that default alone is not a defect. | Restore count/link cues, safe URL dedup and optional open state matching the official open demo by default. Preserve invalid URL as inert text and never fetch citation targets. Gallery displays several fixture sources, including a duplicate and invalid URL separately for robustness. |
| Suggestion | Individual outline sm Button is already aligned except missing shrink-0. Full official composition is horizontally scrollable, overscroll-contained/faded row above PromptInput with several suggestions; local gallery shows only one isolated button. | Add shrink-0 to existing single-item component without changing text/onSelect. Root-owned gallery should compose multiple suggestions in a scroll row above PromptInput. Callback remains host intent; no direct provider send. Scroll-fade utility availability must be checked by stylesheet owner, not claimed from class name. |

## Source closure and API compatibility

All necessary primitive families already exist locally. Suggested repairs add
presentation props and use existing pinned parts; they do not require AI SDK,
new dependency installation, runtime semantics or vendor edits. `FileTreeNode`
was read as an upstream reference, not silently copied into the vendor closure.
If adapted markup is used, provenance remains this manifest and the existing
upstream MIT attribution. Safe URL handling and escaped strings remain required.
Any Markdown-bearing host content continues through the package's safe Markdown
renderer; these eight wrappers need no arbitrary HTML path.

## Verification still required

After the coordinator integrates wrappers and complete showcase compositions:
run focused types and packaged-production build serially; compare representative
light/dark desktop/mobile views and expanded hover/menu states against the pinned
examples. Exercise keyboard/focus, file selection, collapse, provider/effort
selection, citation new-tab naming, source dedup/unsafe-URL refusal, checkpoint
availability, explicit confirmation states, and suggestion overflow. A passing
export inventory or fixture callback alone cannot establish presentation fidelity.
The source audit provides repair targets, not an independent gate verdict.

## Authorized wrapper repairs applied

The coordinator authorized the eight wrapper repairs after receiving the audit.
Changes now match the reference structure described above and retain all prior
required props/callback signatures. Additive props: Checkpoint.canRestore;
Confirmation.state/resultText/icon (state remains controlled exclusively by the
host); Context.breakdown; FileTree.selected; Sources.open (bindable, true by
default); ModelOption.group. ModelSelector retains its flat model/effort arrays.
No Citation shape change was required. Invalid URL citations stay inert.

The primary example uses a command Terminal icon; Confirmation now defaults to
that icon and accepts a host snippet for other domains. Its completed fallback
label says Completed rather than assuming the host ran a shell command. The
restored approved/denied behavior never auto-transitions on button clicks.

`svelte/compiler` compiled all eight repaired wrappers with zero warnings.
[Syntax evidence and source hashes](interactive-references/repair-syntax.json)
are explicitly syntax-only: no heavy type check, package build, or browser run
was performed in this lane. No upstream/vendor file, stylesheet, runtime,
transport, default conversation, PromptInput, Message, index export, or
PatternShowcase was edited. Root owns the fuller fixture compositions and final
serialized verification. These files are a repair candidate, not a claim that
full appearance or interaction fidelity has already been independently proven.
