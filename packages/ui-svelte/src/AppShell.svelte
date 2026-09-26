<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { UiShellBreadcrumb, UiShellGroup } from '@victframework/ui';

  interface Props {
    title?: string;
    brand?: string;
    screenId?: string;
    path: string;
    groups?: readonly UiShellGroup[];
    breadcrumbs?: readonly UiShellBreadcrumb[];
    children: Snippet;
  }

  let { title = '', brand = 'Workspace', screenId, path, groups = [], breadcrumbs = [], children }: Props = $props();
  let mobileNavOpen = $state(false);
  let navToggle = $state<HTMLButtonElement | null>(null);
  let navElement = $state<HTMLElement | null>(null);

  // A route change always leaves the next page with its menu closed.
  $effect(() => {
    void path;
    mobileNavOpen = false;
  });

  function closeMenu(): void {
    mobileNavOpen = false;
    navToggle?.focus();
  }

  function onMenuKeydown(event: KeyboardEvent): void {
    if (!mobileNavOpen || event.key !== 'Escape') return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (navElement?.contains(target) || navToggle?.contains(target)) {
      event.preventDefault();
      closeMenu();
    }
  }
</script>

<div class={groups.length === 0 ? 'vict-shell vict-shell--single' : 'vict-shell'}>
  {#if title !== ''}
    <header class="vict-header">
      {#if groups.length > 0}
        <button
          type="button"
          class="vict-nav-toggle"
          aria-expanded={mobileNavOpen}
          aria-controls="vict-nav"
          aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          bind:this={navToggle}
          onclick={() => (mobileNavOpen = !mobileNavOpen)}
        >
          <span aria-hidden="true">☰</span><span>Menu</span>
        </button>
      {/if}
      <h1>{title}</h1>
    </header>
  {/if}

  {#if groups.length > 0 && title !== ''}
    <nav
      id="vict-nav"
      class="vict-nav"
      class:vict-nav-open={mobileNavOpen}
      aria-label="Application"
      bind:this={navElement}
    >
      <div class="vict-brand"><span aria-hidden="true">{brand.slice(0, 1)}</span><strong>{brand}</strong><span class="vict-brand-caption">Workspace</span></div>
      {#each groups as group}
        {#if group.label !== ''}
          <p class="vict-nav-group-label">{group.label}</p>
        {/if}
        {#each group.links as link (link.href)}
          <a class="vict-nav-link" href={link.href} aria-current={link.current ? 'page' : undefined}>
            {link.label}
          </a>
        {/each}
      {/each}
    </nav>
  {/if}

  <main class="vict-main" data-screen={screenId}>
    {#if breadcrumbs.length > 0}
      <nav aria-label="Breadcrumb" data-testid="breadcrumbs">
        <ol class="vict-breadcrumbs">
          {#each breadcrumbs as crumb, index (index)}
            <li>
              {#if crumb.href !== undefined}
                <a href={crumb.href}>{crumb.label}</a>
              {:else}
                <span aria-current="page">{crumb.label}</span>
              {/if}
            </li>
          {/each}
        </ol>
      </nav>
    {/if}
    {@render children()}
  </main>
</div>

<svelte:window onkeydown={onMenuKeydown} />
