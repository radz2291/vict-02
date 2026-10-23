<script lang="ts" module>
import { tv, type VariantProps } from "tailwind-variants";
import {markerVariants, type MarkerVariant} from "./marker.variants.js";
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "../../utils.js";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		variant = "default",
		child,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		variant?: MarkerVariant;
		child?: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();

	const mergedProps = $derived({
		class: cn(markerVariants({ variant }), className),
		"data-slot": "marker",
		"data-variant": variant,
		...restProps,
	});
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<div bind:this={ref} {...mergedProps}>
		{@render mergedProps.children?.()}
	</div>
{/if}
