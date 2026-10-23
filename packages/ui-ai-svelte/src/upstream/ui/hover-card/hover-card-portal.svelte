<script lang="ts">
	import { LinkPreview as HoverCardPrimitive } from "bits-ui";

	let { children, ...restProps }: HoverCardPrimitive.PortalProps = $props();
</script>

<HoverCardPrimitive.Portal {...restProps}><div class="vict-ai" style="display: contents">{@render children?.()}</div></HoverCardPrimitive.Portal>
