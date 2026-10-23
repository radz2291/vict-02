<script lang="ts">
  import * as Collapsible from '../upstream/ui/collapsible/index.js';
  import {Button} from '../upstream/ui/button/index.js';
  import { FolderIcon as Folder } from "@lucide/svelte";
  import { FileIcon as File } from "@lucide/svelte";
  import { ChevronRightIcon as ChevronRight } from "@lucide/svelte";
  import type {FileNode} from './types.js';
  let {nodes, onSelect}:{nodes:readonly FileNode[];onSelect?:(path:string)=>void}=$props();
</script>
{#snippet tree(items:readonly FileNode[])}
  {#each items as node (node.path)}
    {#if node.children}<Collapsible.Root open class="group/folder"><Collapsible.Trigger>{#snippet child({props})}<Button {...props} variant="ghost" size="sm" class="w-full justify-start"><ChevronRight class="transition-transform group-data-[state=open]/folder:rotate-90"/><Folder/>{node.name}</Button>{/snippet}</Collapsible.Trigger><Collapsible.Content><div class="ml-4 flex flex-col">{@render tree(node.children)}</div></Collapsible.Content></Collapsible.Root>
    {:else}<Button variant="ghost" size="sm" class="w-full justify-start" disabled={!onSelect} onclick={()=>onSelect?.(node.path)}><File/>{node.name}</Button>{/if}
  {/each}
{/snippet}
<div class="flex flex-col">{@render tree(nodes)}</div>
