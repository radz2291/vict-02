<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";

	let { children, ...restProps }: DropdownMenuPrimitive.PortalProps = $props();
</script>

<DropdownMenuPrimitive.Portal {...restProps}><div class="vict-ai" style="display: contents">{@render children?.()}</div></DropdownMenuPrimitive.Portal>
