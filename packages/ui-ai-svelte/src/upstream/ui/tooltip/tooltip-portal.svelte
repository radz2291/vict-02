<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";

	let { children, ...restProps }: TooltipPrimitive.PortalProps = $props();
</script>

<TooltipPrimitive.Portal {...restProps}><div class="vict-ai" style="display: contents">{@render children?.()}</div></TooltipPrimitive.Portal>
