<script lang="ts">
  import type { Snippet } from 'svelte';
  import * as Item from '../upstream/ui/item/index.js';
  import * as Trace from '../upstream/ui/trace/index.js';
  import { Button } from '../upstream/ui/button/index.js';
  import Terminal from '@lucide/svelte/icons/terminal';

  let { title, description, onDecision, pending = false, state = 'requested', resultText, icon }: {
    title: string;
    description: string;
    onDecision?: (approved: boolean) => void;
    pending?: boolean;
    /** Only the host advances this state; a click is a request, not authority. */
    state?: 'requested' | 'running' | 'denied' | 'completed';
    resultText?: string;
    icon?: Snippet;
  } = $props();
</script>

{#snippet operationIcon()}
  {#if icon}{@render icon()}{:else}<Terminal />{/if}
{/snippet}

{#if state === 'requested'}
  <Item.Root variant="outline" size="sm">
    <Item.Media variant="icon">{@render operationIcon()}</Item.Media>
    <Item.Content>
      <Item.Title>{title}</Item.Title>
      <Item.Description>{description}</Item.Description>
    </Item.Content>
    <Item.Actions>
      <Button size="sm" variant="outline" disabled={!onDecision || pending}
        onclick={() => onDecision?.(false)}>Deny</Button>
      <Button size="sm" disabled={!onDecision || pending}
        onclick={() => onDecision?.(true)}>Approve</Button>
    </Item.Actions>
  </Item.Root>
{:else}
  <Trace.Root>
    <Trace.Line status={state === 'running' ? 'running' : undefined}>
      <Trace.Icon>{@render operationIcon()}</Trace.Icon>
      <Trace.Title>
        {resultText ?? `${state === 'denied' ? 'Denied' : state === 'completed' ? 'Completed' : 'Running'}: ${title}`}
      </Trace.Title>
    </Trace.Line>
  </Trace.Root>
{/if}
