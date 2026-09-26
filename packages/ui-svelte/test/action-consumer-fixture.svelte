<script lang="ts">
  import { useVictActions } from '@victframework/ui-svelte/component-actions';
  let { actionId = 'save' }: { actionId?: string } = $props();
  const actions = useVictActions();
  let message = $state('');
</script>

<button
  onclick={async () => {
    const result = await actions.run(actionId, { name: 'Scheduled review' });
    message = result?.ok ? 'Saved' : (result?.message ?? '');
  }}>Run registered action</button
>
<output>{message}</output>
