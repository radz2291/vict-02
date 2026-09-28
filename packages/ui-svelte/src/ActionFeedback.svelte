<script lang="ts">
  import type { UiActionFeedback } from '@victframework/ui';
  let { feedback = null, actionId }: { feedback?: UiActionFeedback | null; actionId?: string } = $props();
</script>

<!-- Persistent live regions announce text changes, without moving focus or expiring errors.
     A succeeded action whose data refresh failed renders the DISTINCT stale note: the
     action is still reported as successful (never as a failure, never with a re-run
     invitation), and the out-of-date view is named for what it is. -->
<div class="vict-action-feedback" data-kind={feedback?.kind} data-last-action={actionId}>
  <p role="status" aria-atomic="true" data-testid="action-success">{feedback?.kind === 'success' ? feedback.message : ''}</p>
  {#if feedback?.kind === 'success' && feedback.dataStale === true}
    <p class="vict-action-stale" role="status" aria-atomic="true" data-testid="action-stale">
      Saved, but the latest data could not be loaded. This view may be out of date.
    </p>
  {/if}
  <p role="alert" aria-atomic="true" data-testid="action-error">{feedback && feedback.kind !== 'success' ? feedback.message : ''}</p>
</div>
