<script lang="ts">
  import * as Collapsible from '../upstream/ui/collapsible/index.js';
  import { Button } from '../upstream/ui/button/index.js';
  import { cn } from '../upstream/utils.js';
  import Folder from '@lucide/svelte/icons/folder';
  import File from '@lucide/svelte/icons/file';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import type { FileNode } from './types.js';

  let { nodes, onSelect, selected }: {
    nodes: readonly FileNode[];
    onSelect?: (path: string) => void;
    selected?: string;
  } = $props();
</script>

{#snippet tree(items: readonly FileNode[])}
  {#each items as node (node.path)}
    {#if node.children}
      <Collapsible.Root open class="group/folder">
        <Collapsible.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="ghost" size="sm"
              class="w-full justify-start font-normal aria-expanded:bg-transparent aria-expanded:hover:bg-muted dark:aria-expanded:hover:bg-muted/50">
              <ChevronRight class="transition-transform group-data-[state=open]/folder:rotate-90" />
              <Folder />
              {node.name}
            </Button>
          {/snippet}
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div class="ml-4 flex flex-col">{@render tree(node.children)}</div>
        </Collapsible.Content>
      </Collapsible.Root>
    {:else}
      <Button variant="ghost" size="sm"
        class={cn('w-full justify-start font-normal', selected === node.path && 'bg-accent text-accent-foreground')}
        aria-current={selected === node.path ? 'true' : undefined}
        disabled={!onSelect} onclick={() => onSelect?.(node.path)}>
        <File />
        {node.name}
      </Button>
    {/if}
  {/each}
{/snippet}

<div class="flex flex-col">{@render tree(nodes)}</div>
