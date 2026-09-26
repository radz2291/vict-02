<script lang="ts">
  import { Avatar } from '@victframework/ui-svelte/catalog/avatar';
  import { Meter } from '@victframework/ui-svelte/catalog/meter';
  import { NavigationMenu } from '@victframework/ui-svelte/catalog/navigation-menu';
  import { Pagination } from '@victframework/ui-svelte/catalog/pagination';
  import { Progress } from '@victframework/ui-svelte/catalog/progress';
  import { Tabs } from '@victframework/ui-svelte/catalog/tabs';
  import Example from './Example.svelte';
  let currentPage = $state(1);
  let progress = $state(65);
</script>

<Example family="avatar" title="Avatar">
  <div class="vict-control-row">
    <Avatar.Root
      ><Avatar.Image src="/team-maya.svg" alt="Maya Chen" /><Avatar.Fallback>MC</Avatar.Fallback
      ></Avatar.Root
    ><span>Maya Chen · project owner</span>
    <Avatar.Root
      ><Avatar.Image src="data:image/png;base64,invalid" alt="Arun Patel" /><Avatar.Fallback
        >AP</Avatar.Fallback
      ></Avatar.Root
    ><span>Fallback when an image is unavailable</span>
  </div>
</Example>
<Example family="meter" title="Meter">
  <span id="storage-label">Storage used · 6.5 GB of 10 GB</span><Meter.Root
    value={65}
    max={100}
    aria-labelledby="storage-label"
    ><div class="vict-metric-fill" style="--vict-value:65%"></div></Meter.Root
  >
</Example>
<Example family="navigation-menu" title="Navigation menu">
  <NavigationMenu.Root aria-label="Workspace resources" delayDuration={100}
    ><NavigationMenu.List>
      <NavigationMenu.Item
        ><NavigationMenu.Trigger>Explore workspaces</NavigationMenu.Trigger><NavigationMenu.Content>
          <NavigationMenu.Link href="/requests"
            >Requests<span class="vict-control-help">
              — review the team queue</span
            ></NavigationMenu.Link
          >
          <NavigationMenu.Link href="/workspace"
            >Conversation<span class="vict-control-help">
              — work through a question</span
            ></NavigationMenu.Link
          >
        </NavigationMenu.Content></NavigationMenu.Item
      >
      <NavigationMenu.Item
        ><NavigationMenu.Link href="#direct">Composition examples</NavigationMenu.Link
        ></NavigationMenu.Item
      >
    </NavigationMenu.List></NavigationMenu.Root
  >
</Example>
<Example family="pagination" title="Pagination">
  <Pagination.Root
    count={108}
    perPage={10}
    siblingCount={1}
    bind:page={currentPage}
    aria-label="Request pages"
  >
    {#snippet children({ pages, currentPage: selectedPage })}
      <Pagination.PrevButton aria-label="Previous page">‹</Pagination.PrevButton>
      {#each pages as page (page.key)}{#if page.type === 'ellipsis'}<span aria-hidden="true">…</span
          >{:else}<Pagination.Page
            {page}
            aria-current={selectedPage === page.value ? 'page' : undefined}
            >{page.value}</Pagination.Page
          >{/if}{/each}
      <Pagination.NextButton aria-label="Next page">›</Pagination.NextButton>
    {/snippet}
  </Pagination.Root><span role="status">Page {currentPage} of 11</span>
</Example>
<Example family="progress" title="Progress">
  <span id="upload-label">Upload progress · {progress}%</span><Progress.Root
    value={progress}
    max={100}
    aria-labelledby="upload-label"
    ><div class="vict-metric-fill" style={`--vict-value:${progress}%`}></div></Progress.Root
  >
  <button
    class="vict-btn vict-btn--secondary"
    onclick={() => (progress = progress === 100 ? 0 : Math.min(100, progress + 10))}
    >Advance upload</button
  >
  <span id="sync-label">Syncing workspace</span><Progress.Root
    value={null}
    aria-labelledby="sync-label"><div class="vict-metric-fill"></div></Progress.Root
  >
</Example>
<Example family="tabs" title="Tabs">
  <Tabs.Root value="overview"
    ><Tabs.List aria-label="Project information"
      ><Tabs.Trigger value="overview">Overview</Tabs.Trigger><Tabs.Trigger value="activity"
        >Activity</Tabs.Trigger
      ><Tabs.Trigger value="billing" disabled>Billing</Tabs.Trigger></Tabs.List
    ><Tabs.Content value="overview">Two reviews are scheduled this week.</Tabs.Content><Tabs.Content
      value="activity">Maya updated the project brief this morning.</Tabs.Content
    ></Tabs.Root
  >
</Example>
