<script lang="ts">
	import { Streamdown, type StreamdownProps } from "svelte-streamdown";
	import { cn } from "../utils.js";
	import MarkdownCodeBlock from "./markdown-code-block.svelte";
	import { safeExternalUrl } from "./safe-url.js";

	let {
		class: className,
		components = {},
		controls = false,
		...restProps
	}: StreamdownProps = $props();
</script>

<!--
	Mirrors upstream's `components/markdown.tsx`. React Streamdown puts
	`space-y-4 whitespace-normal …` on its root, svelte-streamdown doesn't, so
	the block spacing is added here.
-->
<Streamdown
	components={{ ...components, code: MarkdownCodeBlock, mermaid: MarkdownCodeBlock }}
	{controls}
	class={cn(
		"w-full min-w-0 space-y-4 overflow-hidden whitespace-normal [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
		className
	)}
	{...restProps}
	renderHtml={false}
	allowedLinkPrefixes={['https://', 'http://']}
	allowedImagePrefixes={[]}
>
	{#snippet link({ token, children })}
		{@const href = safeExternalUrl(token.href)}
		{#if href}<a {href} target="_blank" rel="noopener noreferrer">{@render children()}</a>{:else}<span>{@render children()}</span>{/if}
	{/snippet}
	{#snippet image({ token })}<span class="text-muted-foreground">[Image: {token.text || 'image'}]</span>{/snippet}
	<!-- Fenced code renders through `components.code`. Inline code stays inline. -->
	{#snippet codespan({ children })}
		<code class="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]">{@render children()}</code>
	{/snippet}
</Streamdown>
