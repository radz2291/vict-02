<script lang="ts">
  import type { Snippet } from 'svelte';
  import { provideComponentActions, type VictComponentActions } from './component-context.js';
  interface Props {
    surfaceId?: string;
    componentId?: string;
    children: Snippet;
    run?: VictComponentActions['run'];
  }
  let { surfaceId, componentId, children, run }: Props = $props();
  provideComponentActions({
    run: (actionId, input) => {
      if (!run) {
        return Promise.resolve({
          ok: false,
          code: 'NO_DISPATCHER',
          message: 'This action is unavailable.',
        });
      }
      return run(actionId, input);
    },
  });
</script>

<div class="vict-component-slot" data-surface={surfaceId} data-component={componentId}>
  {@render children()}
</div>
