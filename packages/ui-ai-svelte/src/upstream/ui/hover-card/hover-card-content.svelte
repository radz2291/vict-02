<script lang="ts">
	import { LinkPreview as HoverCardPrimitive } from "bits-ui";
	import { cn, type WithoutChildrenOrChild } from "../../utils.js";
	import HoverCardPortal from "./hover-card-portal.svelte";
	import type { ComponentProps } from "svelte";
	import {hoverCardContentClass} from './hover-card-style.js';

	let {
		ref = $bindable(null),
		class: className,
		side = "bottom",
		sideOffset = 4,
		align = "center",
		portalProps,
		...restProps
	}: HoverCardPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof HoverCardPortal>>;
	} = $props();
</script>

<HoverCardPortal {...portalProps}>
	<HoverCardPrimitive.Content
		bind:ref
		data-slot="hover-card-content"
		{side}
		{sideOffset}
		{align}
		class={cn(
			hoverCardContentClass,
			className
		)}
		{...restProps}
	/>
</HoverCardPortal>
