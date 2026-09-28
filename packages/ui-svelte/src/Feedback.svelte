<script lang="ts">
  interface Props {
    message: string;
    kind?: 'empty' | 'status' | 'error' | 'denied';
    surfaceId?: string;
    testId?: string;
    lastAction?: string | null;
  }
  let { message, kind = 'status', surfaceId, testId, lastAction }: Props = $props();
</script>

<p
  class={kind === 'error' || kind === 'denied' ? 'vict-alert' : 'vict-state'}
  class:vict-alert--denied={kind === 'denied'}
  role={kind === 'error' || kind === 'denied' ? 'alert' : kind === 'status' ? 'status' : undefined}
  data-surface={surfaceId}
  data-state={kind === 'empty' ? 'empty' : undefined}
  data-testid={testId}
  data-last-action={lastAction}
>{message}</p>
