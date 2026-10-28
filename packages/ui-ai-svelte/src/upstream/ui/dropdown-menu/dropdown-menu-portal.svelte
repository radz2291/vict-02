<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";

	// Local VICT addition: canonical document scope follows owned popup content.
	let { children, scopeClass = '', ...restProps }: DropdownMenuPrimitive.PortalProps & {scopeClass?: string} = $props();
</script>

<DropdownMenuPrimitive.Portal {...restProps}><div class={`vict-ai ${scopeClass}`} style="display: contents">{@render children?.()}</div></DropdownMenuPrimitive.Portal>
