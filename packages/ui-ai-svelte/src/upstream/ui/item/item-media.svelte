<script lang="ts" module>
import { tv, type VariantProps } from "tailwind-variants";
import {itemMediaVariants, type ItemMediaVariant} from "./item-media.variants.js";
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "../../utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		variant = "default",
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { variant?: ItemMediaVariant } = $props();
</script>

<div
	bind:this={ref}
	data-slot="item-media"
	data-variant={variant}
	class={cn(itemMediaVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
