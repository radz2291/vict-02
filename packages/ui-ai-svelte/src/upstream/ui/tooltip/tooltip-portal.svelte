<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";

	// Local VICT addition: canonical document scope follows owned popup content.
	let { children, scopeClass = '', ...restProps }: TooltipPrimitive.PortalProps & {scopeClass?: string} = $props();
</script>

<TooltipPrimitive.Portal {...restProps}><div class={`vict-ai ${scopeClass}`} style="display: contents">{@render children?.()}</div></TooltipPrimitive.Portal>
