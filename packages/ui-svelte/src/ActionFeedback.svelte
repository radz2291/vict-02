<script lang="ts">
  import type { UiActionFeedback } from '@victframework/ui';
  let { feedback = null, actionId }: { feedback?: UiActionFeedback | null; actionId?: string } = $props();
</script>

<!-- Persistent live regions announce text changes, without moving focus or expiring errors. -->
<div class="vict-action-feedback" data-kind={feedback?.kind} data-last-action={actionId}>
  <p role="status" aria-atomic="true" data-testid="action-success">{feedback?.kind === 'success' ? feedback.message : ''}</p>
  <p role="alert" aria-atomic="true" data-testid="action-error">{feedback && feedback.kind !== 'success' ? feedback.message : ''}</p>
</div>
