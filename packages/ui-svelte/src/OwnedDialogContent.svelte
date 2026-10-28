<script lang="ts">
  import {untrack,type Snippet} from 'svelte';
  import type {HTMLAttributes} from 'svelte/elements';
  import {createOwnedDialogBehavior} from './owned-dialog.js';
  type Props = Omit<HTMLAttributes<HTMLDivElement>,'children'|'role'|'aria-modal'> & {
    id:string; open?:boolean; owner?:HTMLElement; ref?:HTMLDivElement|null;
    trigger?:HTMLElement|null; branches?:readonly HTMLElement[]; dismissible?:boolean;
    lockScroll?:boolean; focusOnOpen?:boolean; onRequestClose?:(reason:'escape'|'outside')=>void;
    children?:Snippet;
  };
  let {id,open=true,owner,ref=$bindable(null),trigger,branches=[],dismissible=true,lockScroll=false,focusOnOpen=true,onRequestClose,children,...attributes}:Props=$props();
  let missingOwner=$state(false);
  $effect(()=>{
    if(!open||!ref)return;
    const panel=ref,scope=owner??panel.closest<HTMLElement>('[data-ui-application-viewport]');
    missingOwner=!scope;
    if(!scope)return;
    return untrack(()=>createOwnedDialogBehavior({owner:scope,panel,getTrigger:()=>trigger,getBranches:()=>branches,canDismiss:()=>dismissible,onDismiss:reason=>onRequestClose?.(reason),lockScroll,focusOnOpen}));
  });
</script>
{#if open}
  <div {...attributes} {id} bind:this={ref} role="dialog" aria-modal={undefined} tabindex="-1" data-dialog-content data-owned-dialog-content data-owned-dialog-state={missingOwner?'unavailable':'ready'}>
    {#if missingOwner}<p role="alert">Owned dialog requires an application owner.</p>{/if}
    {@render children?.()}
  </div>
{/if}
