<script lang="ts" module>
import { tv, type VariantProps } from "tailwind-variants";
import {bubbleReactionsVariants, type BubbleReactionsSide, type BubbleReactionsAlign} from "./bubble-reactions.variants.js";
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "../../utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		side = "bottom",
		align = "end",
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		side?: BubbleReactionsSide;
		align?: BubbleReactionsAlign;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="bubble-reactions"
	data-align={align}
	data-side={side}
	class={cn(bubbleReactionsVariants({ side, align }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
