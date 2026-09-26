<script lang="ts">
  import { tick } from 'svelte';
  import { actionFeedback, type UiActionFeedback } from '@victframework/ui';
  import type { ActionResult, PlanSurface, VictPlanView } from './logic.js';
  import Button from './Button.svelte';
  import ActionFeedback from './ActionFeedback.svelte';
  let { surface, plan, disabled = false, run }: {
    surface: PlanSurface; plan: VictPlanView; disabled?: boolean;
    run: (actionId: string, input?: unknown) => Promise<ActionResult | void>;
  } = $props();
  let pending = $state(false);
  let feedback = $state<UiActionFeedback | null>(null);
  const actionId = $derived(String(surface.actionId));
  const action = $derived(plan.actions[actionId]);
  $effect(() => { void actionId; feedback = null; });
  async function execute(event: MouseEvent) {
    if (pending) return;
    const trigger = event.currentTarget as HTMLButtonElement;
    feedback = null;
    pending = true;
    try {
      const result = await run(actionId);
      if (result) feedback = actionFeedback(result, action?.feedback);
    } catch {
      feedback = actionFeedback({ ok: false }, action?.feedback);
    } finally {
      pending = false;
      await tick();
      if (document.activeElement === document.body) trigger.focus();
    }
  }
</script>
<div class="vict-action-control" aria-busy={pending}>
  <Button label={pending ? 'Working…' : String(surface.label)} surfaceId={surface.id}
    actionKind={action?.kind ?? 'unknown'} {actionId} disabled={disabled || pending}
    onclick={(event) => void execute(event)} />
  <ActionFeedback {feedback} {actionId} />
</div>
