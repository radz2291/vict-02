<script lang="ts">
  let {kind}:{kind:string}=$props();
</script>
<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if kind==='state'}<ellipse cx="10" cy="4.5" rx="6" ry="2.5"/><path d="M4 4.5v10c0 3.3 12 3.3 12 0v-10M4 9.5c0 3.3 12 3.3 12 0"/>
  {:else if kind==='action'}<path d="m11 2-7 9h5l-1 7 8-10h-5z"/>
  {:else if kind==='catalog' || kind==='definition'}<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/>
  {:else if kind==='route'}<path d="M3 15V5h13m-4-4 4 4-4 4"/>
  {:else if kind==='text'}<path d="M4 4h12M10 4v12M7 16h6"/>
  {:else if kind==='reference'}<path d="M8 6H6a4 4 0 0 0 0 8h2m4-8h2a4 4 0 0 1 0 8h-2M7 10h6"/>
  {:else}<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 7h14M7 7v10"/>{/if}
</svg>
<style>svg{width:16px;height:16px;display:block;flex:none}</style>
