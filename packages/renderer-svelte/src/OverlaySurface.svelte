<script lang="ts">
  /** Application surface traversal stays in the adapter; modal behavior belongs to UI. */
  import type { ComponentRegistry } from '@victframework/application/renderer';
  import type { UiOverlayIntent, UiPlan } from '@victframework/ui';
  import { Overlay } from '@victframework/ui-svelte';
  import type { VictPlanView, PlanSurface, ViewDatum, ActionResult } from './logic.js';
  import Surface from './Surface.svelte';

  interface Props {
    surface: PlanSurface;
    plan: VictPlanView;
    uiPlan: UiPlan;
    registry: ComponentRegistry;
    context: {
      readonly params: Readonly<Record<string, string>>;
      readonly viewRowCount: (viewId: string) => number;
    };
    params: Readonly<Record<string, string>>;
    viewData: Readonly<Record<string, ViewDatum>>;
    record: Record<string, unknown> | null;
    run: (actionId: string, input?: unknown) => Promise<void>;
    dispatch: (actionId: string, input?: unknown) => Promise<ActionResult>;
    sendConversation: (actionId: string, text: string) => Promise<boolean>;
  }

  let { surface, plan, uiPlan, registry, context, params, viewData, record, run, dispatch, sendConversation }: Props = $props();
  const intent = $derived<UiOverlayIntent>({
    kind: surface.role === 'drawer' ? 'drawer' : 'dialog',
    title: typeof surface.title === 'string' ? surface.title : '',
    triggerLabel: typeof surface.triggerLabel === 'string' ? surface.triggerLabel : 'Open',
  });
</script>

{#snippet content()}
  {#each ((surface.content ?? []) as readonly PlanSurface[]) as nested (nested.id)}
    <Surface surface={nested} {plan} {uiPlan} {registry} {context} {params} {viewData}
      {record} {run} {dispatch} {sendConversation} />
  {/each}
{/snippet}

<Overlay surfaceId={surface.id} {intent} {content} />
