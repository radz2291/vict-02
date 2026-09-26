<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog } from 'bits-ui';
  import { resolveApplicationComposition, resolvePageComposition, type UiApplicationComposition, type UiShellBreadcrumb, type UiShellGroup } from '@victframework/ui';

  interface Props {
    title?: string;
    brand?: string;
    screenId?: string;
    path: string;
    composition?: UiApplicationComposition;
    pageComposition?: ReturnType<typeof resolvePageComposition>;
    groups?: readonly UiShellGroup[];
    breadcrumbs?: readonly UiShellBreadcrumb[];
    children: Snippet;
  }
  let { title = '', brand = 'Workspace', screenId, path, composition, pageComposition, groups = [], breadcrumbs = [], children }: Props = $props();
  const shell = $derived(resolveApplicationComposition(composition));
  const page = $derived(pageComposition ?? resolvePageComposition(composition));
  const hasNavigation = $derived(shell.navigation !== 'none' && groups.some(group => group.links.length > 0));
  let mobileNavOpen = $state(false);
  let trigger = $state<HTMLButtonElement | null>(null);

  $effect(() => { void path; mobileNavOpen = false; });
  // CSS owns presentation; crossing to desktop also releases the modal's
  // focus/scroll lock. Bits Dialog owns trapping, dismissal and restoration.
  $effect(() => {
    const media = window.matchMedia(shell.navigationAt === 'medium' ? '(min-width: 960px)' : '(min-width: 720px)');
    const closeOnDesktop = () => { if (media.matches) mobileNavOpen = false; };
    closeOnDesktop();
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  });
  $effect(() => { if (!hasNavigation) mobileNavOpen = false; });
</script>

{#snippet brandMark()}
  <div class="vict-brand"><span aria-hidden="true">{brand.slice(0, 1)}</span><strong>{brand}</strong></div>
{/snippet}
{#snippet links(close: boolean)}
  {#each groups as group}
    {#if group.label !== ''}<p class="vict-nav-group-label">{group.label}</p>{/if}
    {#each group.links as link (link.href)}
      <a class="vict-nav-link" href={link.href} aria-current={link.current ? 'page' : undefined}
        onclick={() => { if (close) mobileNavOpen = false; }}>{link.label}</a>
    {/each}
  {/each}
{/snippet}

<div class="vict-shell" data-navigation={hasNavigation ? shell.navigation : 'none'}
  data-navigation-at={shell.navigationAt} data-density={page.density}>
  <header class="vict-header">
    {#if hasNavigation}
      <Dialog.Root bind:open={mobileNavOpen}>
        <Dialog.Trigger class="vict-nav-toggle" bind:ref={trigger} aria-label="Open navigation menu">
          <span aria-hidden="true">☰</span><span>Menu</span>
        </Dialog.Trigger>
        <Dialog.Portal to={trigger?.closest('.vict-app') ?? 'body'}>
          <Dialog.Overlay class="vict-navigation-backdrop" />
          <Dialog.Content class="vict-navigation-drawer" aria-describedby={undefined}>
            <div class="vict-navigation-heading">
              <Dialog.Title class="vict-navigation-title">{brand} navigation</Dialog.Title>
              <Dialog.Close class="vict-navigation-close" aria-label="Close navigation menu">×</Dialog.Close>
            </div>
            <nav aria-label="Application mobile">{@render links(true)}</nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    {/if}
    <h1>{title || brand}</h1>
  </header>
  {#if hasNavigation}
    <nav class="vict-nav" data-desktop-navigation aria-label="Application">
      {@render brandMark()}
      {@render links(false)}
    </nav>
  {/if}
  <main class="vict-main" data-screen={screenId} data-content-width={page.contentWidth}>
    {#if breadcrumbs.length > 0}
      <nav aria-label="Breadcrumb" data-testid="breadcrumbs">
        <ol class="vict-breadcrumbs">
          {#each breadcrumbs as crumb, index (index)}
            <li>
              {#if crumb.href !== undefined}<a href={crumb.href}>{crumb.label}</a>
              {:else}<span aria-current="page">{crumb.label}</span>{/if}
            </li>
          {/each}
        </ol>
      </nav>
    {/if}
    {@render children()}
  </main>
</div>
