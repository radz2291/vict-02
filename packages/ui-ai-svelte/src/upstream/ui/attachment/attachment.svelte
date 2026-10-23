<script lang="ts" module>
import { tv, type VariantProps } from "tailwind-variants";
import {attachmentVariants, type AttachmentSize, type AttachmentOrientation, type AttachmentState} from "./attachment.variants.js";
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "../../utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		state = "done",
		size = "default",
		orientation = "horizontal",
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		state?: AttachmentState;
		size?: AttachmentSize;
		orientation?: AttachmentOrientation;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="attachment"
	data-state={state}
	data-size={size}
	data-orientation={orientation}
	class={cn(attachmentVariants({ size, orientation }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
