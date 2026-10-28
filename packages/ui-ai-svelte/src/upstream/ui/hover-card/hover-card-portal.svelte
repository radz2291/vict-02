<script lang="ts">
	import { LinkPreview as HoverCardPrimitive } from "bits-ui";

	// Local VICT addition: canonical document scope follows owned popup content.
	let { children, scopeClass = '', ...restProps }: HoverCardPrimitive.PortalProps & {scopeClass?: string} = $props();
</script>

<HoverCardPrimitive.Portal {...restProps}><div class={`vict-ai ${scopeClass}`} style="display: contents">{@render children?.()}</div></HoverCardPrimitive.Portal>
