<script lang="ts">
  import {Button,Feedback,type UiSvelteComponentProps} from '@victframework/ui-svelte';
  import {Button as CatalogButton} from '@victframework/ui-svelte/catalog/button';
  import {importMediaAsset,importMediaArchive,exportMediaArchive,type MediaAssetMetadata,type MediaAssetStore} from './assets.js';import {mediaHost} from './context.js';
  let {props,io,presentation}:UiSvelteComponentProps=$props();const host=mediaHost();let assets=$state<readonly MediaAssetMetadata[]>([]),error=$state(''),busy=$state(false),message=$state('');
  const target=$derived(presentation?.target('root'));
  let supplyInput=$state<HTMLInputElement>(),archiveInput=$state<HTMLInputElement>();
  const refresh=async(store=host?.assets,namespace=host?.namespace)=>{if(store){const list=await store.list();if(host?.namespace===namespace)assets=list;}};
  let listedNamespace:string|undefined;
  $effect(()=>{const store=host?.assets,namespace=host?.namespace;let disposed=false;if(listedNamespace!==namespace){listedNamespace=namespace;assets=[];error='';message='';}if(store)store.list().then(list=>{if(!disposed&&host?.namespace===namespace)assets=list;}).catch(reason=>{if(!disposed&&host?.namespace===namespace)error=reason instanceof Error?reason.message:'Media library unavailable.';});return()=>{disposed=true;};});
  async function finishImport(store:MediaAssetStore,namespace:string,written:number,result:string,failure=''){
    if(!host||host.namespace!==namespace)return;
    message=result;error=failure;
    try{const list=await store.list();if(host.namespace===namespace)assets=list;}catch{if(host.namespace===namespace)error=[failure,'Stored media could not be refreshed. Reopen the library to inspect it.'].filter(Boolean).join(' ');}
    if(written>0&&host.namespace===namespace){try{host.changed?.();}catch{error=[error,'The host could not be notified; stored bytes remain.'].filter(Boolean).join(' ');}}
  }
  async function upload(event:Event){
    const input=event.currentTarget as HTMLInputElement,files=Array.from(input.files??[]);if(!host||!files.length)return;
    const store=host.assets,namespace=host.namespace;let written=0,failure='';busy=true;error='';message='';
    try{for(const file of files){const asset=await importMediaAsset(file,'Owner-supplied local file');await store.put(asset);written++;if(host.namespace===namespace)io?.emit('selectedAsset',asset.reference);}}
    catch(reason){failure=reason instanceof Error?reason.message:'Upload failed.';}
    finally{await finishImport(store,namespace,written,failure?`Imported ${written} of ${files.length} assets before upload stopped. Earlier stored assets are preserved.`:`Imported ${written} asset${written===1?'':'s'}.` ,failure);busy=false;input.value='';}
  }
  async function importArchive(event:Event){
    const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];if(!host||!file)return;
    const store=host.assets,namespace=host.namespace;let written=0,failure='';busy=true;error='';message='';
    const tracked:MediaAssetStore={get:ref=>store.get(ref),list:()=>store.list(),remove:ref=>store.remove(ref),async put(asset){await store.put(asset);written++;}};
    try{await importMediaArchive(tracked,await file.text());}catch(reason){failure=reason instanceof Error?reason.message:'Archive import failed.';}
    finally{await finishImport(store,namespace,written,failure?`Imported ${written} managed asset${written===1?'':'s'} before archive import stopped. Earlier stored assets are preserved.`:`Imported ${written} managed assets.`,failure);busy=false;input.value='';}
  }
  async function exportArchive(){if(!host)return;const store=host.assets,namespace=host.namespace;busy=true;error='';try{const text=await exportMediaArchive(store);const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='vict-media-archive.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);if(host.namespace===namespace)message='Media archive exported. Keep it with the application source when moving browsers or origins.';}catch(reason){if(host.namespace===namespace)error=reason instanceof Error?reason.message:'Archive export failed.';}finally{busy=false;}}
  async function remove(asset:MediaAssetMetadata){if(!host)return;const store=host.assets,namespace=host.namespace;busy=true;error='';try{await store.remove(asset.reference);await refresh(store,namespace);if(host.namespace===namespace){host.changed?.();message=`Removed ${asset.name}. Any authored references to it now require re-import.`;}}catch(reason){if(host.namespace===namespace)error=reason instanceof Error?reason.message:'Asset removal failed.';}finally{busy=false;}}
</script>
<section {...target} class={`${target?.class??''} vict-media-library`} aria-label={String(props.label??'Media library')}>
  {#if !host}<Feedback kind="error" message="Media library requires an application asset host with an explicit storage namespace."/>{:else}
  <div {...presentation?.target('toolbar')} class={`${presentation?.target('toolbar').class??''} media-toolbar`}>
    <input bind:this={supplyInput} hidden aria-label="Supply media" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml,video/mp4,video/webm,video/ogg,text/vtt" multiple disabled={busy} onchange={upload}/>
    <Button label="Supply media" variant="secondary" onclick={()=>supplyInput?.click()} disabled={busy}/>
    <input bind:this={archiveInput} hidden aria-label="Import media archive" type="file" accept="application/json" disabled={busy} onchange={importArchive}/>
    <Button label="Import media archive" variant="secondary" onclick={()=>archiveInput?.click()} disabled={busy}/>
    <Button label="Export media archive" variant="secondary" onclick={exportArchive} disabled={busy||assets.length===0}/>
  </div>
  <p class="vict-control-help">Media stays in this browser and application namespace. Export an archive to carry its bytes with saved source.</p>
  {#if error}<Feedback kind="error" message={error}/>{/if}{#if message}<Feedback kind="status" {message}/>{/if}
  {#if assets.length===0}<Feedback kind="empty" message="No supplied assets yet."/>{:else}<ul {...presentation?.target('list')}>
    {#each assets as asset (asset.reference)}<li><div class="media-asset-choice"><CatalogButton.Root class="vict-btn vict-btn--quiet media-asset-select" type="button" title={asset.name} disabled={busy} onclick={()=>io?.emit('selectedAsset',asset.reference)}>{asset.name}</CatalogButton.Root><small class="vict-control-help">{asset.mime} · {Math.ceil(asset.size/1024)} KB</small></div><CatalogButton.Root class="vict-btn vict-btn--quiet media-asset-remove" type="button" aria-label={`Remove stored asset ${asset.name}`} disabled={busy} onclick={()=>remove(asset)}>Remove</CatalogButton.Root></li>{/each}
  </ul>{/if}{/if}
</section>
<style>
  .vict-media-library{min-width:0;color:var(--vict-color-text)}
  .media-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:var(--vict-space-2)}
  .vict-media-library ul{list-style:none;padding:0;display:grid;gap:var(--vict-space-3)}
  .vict-media-library li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--vict-space-2);align-items:start}
  .media-asset-choice{min-width:0}
  .media-asset-choice :global(.media-asset-select){display:block;width:100%;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:start}
  .vict-media-library small{display:block;margin-top:var(--vict-space-1);overflow-wrap:break-word}
</style>
