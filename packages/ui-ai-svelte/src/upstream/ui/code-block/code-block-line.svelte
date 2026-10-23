<script lang="ts" module>
import { tv, type VariantProps } from "tailwind-variants";
import {codeBlockLineVariants, type CodeBlockLineVariant, type CodeBlockLineToken} from "./code-block-line.variants.js";
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "../../utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		variant = "default",
		code,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> & {
		variant?: CodeBlockLineVariant;
		/** The line as plain text, or as highlighted tokens. When it is set, `children` is ignored. */
		code?: string | CodeBlockLineToken[];
	} = $props();

	const newline = "\n";
</script>

<!-- An empty line holds a newline so copying a selection keeps blank lines. -->
<span
	bind:this={ref}
	data-slot="code-block-line"data-variant={variant}
	class={cn(codeBlockLineVariants({ variant }), className)}
	{...restProps}
>
	<span data-slot="code-block-line-content"class="min-w-0">
		{#if typeof code ==="string"}
			{code || newline}
		{:else if code?.length}
			{#each code as token, index (index)}
				<span style={token.style} class={token.class}>{token.content}</span>
			{/each}
		{:else if code}
			{newline}
		{:else if children}
			{@render children()}
		{:else}
			{newline}
		{/if}
	</span>
</span>
