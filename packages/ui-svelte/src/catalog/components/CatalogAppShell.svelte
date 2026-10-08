<script lang="ts">
  import AppShell from '../../AppShell.svelte';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  import type { UiApplicationComposition, UiShellGroup } from '@victframework/ui';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const title = $derived(typeof props.title === 'string' ? props.title : '');
  const path = $derived(typeof props.path === 'string' ? props.path : '');
  const composition: UiApplicationComposition = $derived({
    navigation: props.navigationMode === 'top' ? 'top' : props.navigationMode === 'none' ? 'none' : 'sidebar',
    responsive: { navigationAt: props.navigationAt === 'medium' ? 'medium' : 'small' },
  });
  const groups: readonly UiShellGroup[] = $derived.by(() => {
    if (!Array.isArray(props.navigation)) return [];
    const links: UiShellGroup['links'][number][] = [];
    for (const link of props.navigation) {
      if (typeof link !== 'object' || link === null || typeof link.label !== 'string' || typeof link.href !== 'string') continue;
      links.push({ label: link.label, href: link.href, current: link.href === path });
    }
    return [{ label: '', links }];
  });
</script>

<div class="vict-app" data-testid="catalog-appshell">
  <AppShell {path} {title} {groups} {composition} presentation={presentation?.target('root')}>
    {@render io?.slots?.content?.()}
  </AppShell>
</div>
