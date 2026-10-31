# VICT AI presentation for Svelte

Optional Svelte 5 source components derived from pinned shadcn-svelte AI Elements.
This package has no provider, endpoint, credential store or application command engine.

```svelte
<script lang="ts">
  import { Conversation, type ConversationMessage } from '@victframework/ui-ai-svelte';
  import '@victframework/ui-ai-svelte/styles.css';
  let messages = $state<ConversationMessage[]>([]);
  let busy = $state(false);
  // Supply your transport and update messages immutably as deltas arrive.
  async function send(text: string) {
    // Return true only when the host admitted the message. A refusal retains
    // the draft: return { ok: false, message: 'Explain the refusal.' }.
    return { ok: false, message: 'Connect a host transport first.' };
  }
</script>
<Conversation {messages} {busy} onSend={send} />
```

`ConversationMessage` carries a stable ID, role, text, optional author and
optional typed activity records. Keep IDs stable during streaming. The host
supplies `busy`, `onSend` and optional `onStop`; stopping must fence future
transport effects in that host. The component retains a next draft typed while
busy, handles Enter/Shift+Enter/IME, renders safe streamed Markdown and code,
and offers scrolling, message copy and activity disclosure. A successful send
clears the submitted draft only if the user has not replaced it while waiting.

`conversationMessages` is an optional adapter for simple role/text records.
More advanced hosts should construct stable IDs and activity directly. Studio's
canonical commands and acknowledgement handling live in Studio, outside this
package.

Use `Patterns` or `@victframework/ui-ai-svelte/patterns` for all 21 supported
pattern compositions. `PatternShowcase` demonstrates their data and callbacks
with explicitly simulated content. Upstream namespaces such as `Message`,
`Bubble`, `Trace`, `InputGroup` and `CodeBlock` are public; component subpaths
are available at `@victframework/ui-ai-svelte/components/*`. Standalone parts
need a `.vict-ai` ancestor and the stylesheet import. The default conversation
and showcase supply that ancestor.

See [PRESENTATION.md](PRESENTATION.md) for primary-pattern fidelity, adaptations
and secondary-variant limits. Optional title/description/reset remain host-owned.
Message copy uses tooltip icon actions and confirmed clipboard success; optional
edit/retry/feedback callbacks do not invent backend operations.

See [COVERAGE.md](COVERAGE.md) for each pattern's host requirements and Studio
disposition, and [UPSTREAM.md](UPSTREAM.md) for exact pins, source provenance,
CSS isolation, license and upgrade instructions. The example workspace
`examples/studio-ui-consumer` uses only public AI and Flow package exports;
`scripts/verify-cycle-1-3-consumer.mjs` packs them into an isolated consumer.
# Completion-round additions (2026-10-24)

`ConversationMessage.events` accepts an ordered sequence of text, concise host
summaries and expandable activity records. Stable event IDs support updating a
record in place. `appendConversationEvent` visibly compacts earlier entries at
the configured bound. Hosts retain their confirmed commit boundary separately.
Legacy `activity` consumers remain supported. Events take precedence when supplied.
The package presents supplied evidence; it does not produce private reasoning,
tool results, execution receipts or provider observations.

`captureRenderedElement(element, viewport?, options?)` rasterizes the existing
DOM through the pinned engines (`html-to-image` for ordinary layout,
`dom-to-image-more` for the supported scroll projection). It returns JPEG pixels
for the actual visible viewport intersection, with source dimensions and crop
offsets. There is no default DOM-count, byte, geometry or elapsed-time quota.
`RENDER_CAPTURE_LIMITS` is deprecated historical metadata, not an imposed policy.
Consumers may explicitly choose `width`, `height` or `bytes` options. The codec
uses one quality setting rather than lowering quality to fit an invented quota.

An optional `AbortSignal` stops waiting on owner cancellation. Cancellation does
not claim that an unabortable raster engine stopped: a still-running shared
scroll engine remains quarantined until it actually settles (or the host reloads).
The capture API never uploads or invokes a model. Hosts supply source/session
identity and freshness fences; Studio sends JSON metadata and JPEG in multipart
body fields instead of oversized HTTP headers. The public `./capture` subpath
also exposes passive JPEG frame-dimension admission for thin hosts.

Existing origin, static-format, owner/clipping, font, SVG-reference, DOM mutation
and geometry fidelity checks remain. Unsupported scroll/native-control/live
media paint still refuses explicitly; it is not replaced with invented pixels.
Provider/context limits, browser canvas/codec capability, dependency behavior and
machine resources remain real constraints. Capture proves appearance of its
stated region only, never bindings, actions, execution or semantic correctness.
