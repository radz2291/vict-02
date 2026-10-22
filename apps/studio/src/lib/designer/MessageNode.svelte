<script lang="ts">
 import MessageNode from './MessageNode.svelte';
 import {messageHref,type MessageNode as Node} from './markdown.js';
 let {node}:{node:Node}=$props();
 const href=$derived(messageHref(node.url));
</script>
{#snippet children()}{#each node.children??[] as child}<MessageNode node={child}/>{/each}{/snippet}
{#if node.type==='root'}{@render children()}
{:else if node.type==='paragraph'}<p>{@render children()}</p>
{:else if node.type==='heading'}<svelte:element this={node.depth&&node.depth>3?'h4':'h3'}>{@render children()}</svelte:element>
{:else if node.type==='list'}{#if node.ordered}<ol start={node.start??1}>{@render children()}</ol>{:else}<ul>{@render children()}</ul>{/if}
{:else if node.type==='listItem'}<li>{@render children()}</li>
{:else if node.type==='strong'}<strong>{@render children()}</strong>
{:else if node.type==='emphasis'}<em>{@render children()}</em>
{:else if node.type==='inlineCode'}<code>{node.value}</code>
{:else if node.type==='code'}<pre><code>{node.value}</code></pre>
{:else if node.type==='blockquote'}<blockquote>{@render children()}</blockquote>
{:else if node.type==='break'}<br/>
{:else if node.type==='thematicBreak'}<hr/>
{:else if node.type==='link' && href}<a {href} target="_blank" rel="noopener noreferrer">{@render children()}</a>
{:else if node.type==='image'}<span>{node.alt??'Image'}</span>
{:else if node.type==='definition'}<!-- Definitions are resolved only by explicit link nodes. -->
{:else if node.children}{@render children()}
{:else}{node.value??''}{/if}
