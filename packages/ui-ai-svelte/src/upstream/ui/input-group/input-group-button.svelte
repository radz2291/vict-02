<script lang="ts" module>
import { tv, type VariantProps } from "tailwind-variants";
import {inputGroupButtonVariants, type InputGroupButtonSize} from "./input-group-button.variants.js";
</script>

<script lang="ts">
	import { Button } from "../button/index.js";
	import { cn } from "../../utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		children,
		type = "button",
		variant = "ghost",
		size = "xs",
		...restProps
	}: Omit<ComponentProps<typeof Button>, "href" | "size"> & {
		size?: InputGroupButtonSize;
	} = $props();
</script>

<Button
	bind:ref
	{type}
	data-size={size}
	{variant}
	class={cn(inputGroupButtonVariants({ size }), className)}
	{...restProps}
>
	{@render children?.()}
</Button>
