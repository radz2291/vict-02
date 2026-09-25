<script lang="ts">
  import type { UiStatusTone } from '@victframework/ui';
  interface Props { value: string; tone?: UiStatusTone; surfaceId?: string }
  let { value, tone = 'neutral', surfaceId }: Props = $props();
</script>

<span class="vict-status vict-status--{tone}" data-surface={surfaceId} role="status">{value === '' ? '—' : value}</span>
