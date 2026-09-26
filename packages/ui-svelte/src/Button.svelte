<script lang="ts">
  import type { UiButtonVariant } from '@victframework/ui';

  interface Props {
    label: string;
    variant?: UiButtonVariant;
    type?: 'button' | 'submit';
    disabled?: boolean;
    surfaceId?: string;
    actionKind?: string;
    actionId?: string;
    testId?: string;
    haspopup?: 'dialog';
    expanded?: boolean;
    onclick?: (event: MouseEvent) => void;
  }

  let { label, variant = 'primary', type = 'button', disabled = false, surfaceId, actionKind, actionId, testId, haspopup, expanded, onclick }: Props = $props();
</script>

<button
  {type}
  class="vict-btn"
  class:vict-btn--secondary={variant === 'secondary'}
  class:vict-btn--danger={variant === 'danger'}
  data-surface={surfaceId}
  data-action-kind={actionKind}
  data-action-id={actionId}
  data-testid={testId}
  aria-haspopup={haspopup}
  aria-expanded={expanded}
  {disabled}
  {onclick}
>{label}</button>
