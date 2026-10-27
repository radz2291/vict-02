<script lang="ts">
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import {importMediaAsset,importMediaArchive,exportMediaArchive,type MediaAssetMetadata} from './assets.js';import {mediaHost} from './context.js';
  let {props,io,presentation}:UiSvelteComponentProps=$props();const host=mediaHost();let assets=$state<readonly MediaAssetMetadata[]>([]),error=$state(''),busy=$state(false),message=$state('');
  const target=$derived(presentation?.target('root'));
  const refresh=async()=>{if(host)assets=await host.assets.list();};
  $effect(()=>{refresh().catch(reason=>{error=reason instanceof Error?reason.message:'Media library unavailable.';});});
  async function upload(event:Event){const files=(event.currentTarget as HTMLInputElement).files;if(!host||!files?.length)return;busy=true;error='';message='';try{for(const file of Array.from(files)){const asset=await importMediaAsset(file,'Owner-supplied local file');await host.assets.put(asset);io?.emit('selectedAsset',asset.reference);}await refresh();host.changed?.();message=`Imported ${files.length} asset${files.length===1?'':'s'}.`;}catch(reason){error=reason instanceof Error?reason.message:'Upload failed.';}finally{busy=false;(event.target as HTMLInputElement).value='';}}
  async function importArchive(event:Event){const file=(event.currentTarget as HTMLInputElement).files?.[0];if(!host||!file)return;busy=true;error='';try{const imported=await importMediaArchive(host.assets,await file.text());await refresh();host.changed?.();message=`Imported ${imported.length} managed assets.`;}catch(reason){error=reason instanceof Error?reason.message:'Archive import failed.';}finally{busy=false;(event.target as HTMLInputElement).value='';}}
  async function exportArchive(){if(!host)return;busy=true;error='';try{const text=await exportMediaArchive(host.assets);const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='vict-media-archive.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message='Media archive exported. Keep it with the application source when moving browsers or origins.';}catch(reason){error=reason instanceof Error?reason.message:'Archive export failed.';}finally{busy=false;}}
  async function remove(asset:MediaAssetMetadata){if(!host)return;busy=true;error='';try{await host.assets.remove(asset.reference);await refresh();host.changed?.();message=`Removed ${asset.name}. Any authored references to it now require re-import.`;}catch(reason){error=reason instanceof Error?reason.message:'Asset removal failed.';}finally{busy=false;}}
</script>
<section {...target} class={`${target?.class??''} vict-media-library`} aria-label={String(props.label??'Media library')}>
  {#if !host}<p role="alert">Media library requires an application asset host with an explicit storage namespace.</p>{:else}
  <div {...presentation?.target('toolbar')} class="media-toolbar">
    <label>Supply media<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml,video/mp4,video/webm,video/ogg,text/vtt" multiple disabled={busy} onchange={upload}/></label>
    <label>Import media archive<input type="file" accept="application/json" disabled={busy} onchange={importArchive}/></label>
    <button type="button" onclick={exportArchive} disabled={busy||assets.length===0}>Export media archive</button>
  </div>
  <p class="storage-note">Media stays in this browser and application namespace. Export an archive to carry its bytes with saved source.</p>
  {#if error}<p role="alert">{error}</p>{/if}{#if message}<p role="status">{message}</p>{/if}
  {#if assets.length===0}<p>No supplied assets yet.</p>{:else}<ul {...presentation?.target('list')}>
    {#each assets as asset (asset.reference)}<li><button type="button" disabled={busy} onclick={()=>io?.emit('selectedAsset',asset.reference)} title={asset.reference}>{asset.name} <small>{asset.mime} · {Math.ceil(asset.size/1024)} KB</small></button><button type="button" disabled={busy} aria-label={`Remove stored asset ${asset.name}`} onclick={()=>remove(asset)}>Remove stored asset</button></li>{/each}
  </ul>{/if}{/if}
</section>
<style>.vict-media-library{min-width:0}.media-toolbar{display:flex;flex-wrap:wrap;gap:.75rem}.media-toolbar label{display:flex;flex-direction:column;gap:.25rem;font-size:.875em}.vict-media-library input{max-width:100%}.storage-note{font-size:.8em;opacity:.75}.vict-media-library ul{list-style:none;padding:0;display:grid;gap:.5rem}.vict-media-library li{display:flex;gap:.5rem;align-items:center;justify-content:space-between}.vict-media-library li>button:first-child{text-align:start;min-width:0;overflow-wrap:anywhere}.vict-media-library small{display:block}.vict-media-library button{font:inherit;min-height:2.25rem;cursor:pointer}.vict-media-library button:disabled{cursor:default;opacity:.6}</style>
