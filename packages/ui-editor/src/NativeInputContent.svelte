<script lang="ts">
  import type { UiDocument, UiNode, UiExpression } from '@victframework/ui';
  import type { TransactionDraft } from './commands.js';
  import { setAttribute } from './commands.js';
  import type { EditorLabels } from './inspector-ux.js';
  import ToolPages from './ToolPages.svelte';
  import ExpressionEditor from './ExpressionEditor.svelte';
  import StateInitialEditor from './StateInitialEditor.svelte';
  let { document, node, references, referenceLabels, labels, disabled = false, compact = false, onDraftChange, showStateInitial = true, onApply }: {
    document: UiDocument; node: Extract<UiNode,{kind:'element'}>; references: readonly string[];
    referenceLabels: Readonly<Record<string,string>>; labels: EditorLabels; disabled?: boolean; compact?: boolean; onDraftChange?: (dirty: boolean) => void; showStateInitial?: boolean;
    onApply: (draft: TransactionDraft) => boolean | void;
  } = $props();
  let dirty = $state(false);
  const fields = [{name:'value',label:'Value'},{name:'placeholder',label:'Placeholder'},{name:'aria-label',label:'Accessible name'}];
  function expression(name: string): UiExpression | undefined {
    const value=node.attributes?.[name];
    return typeof value === 'string' ? {type:'literal',value} : value;
  }
</script>
{#snippet fieldEditor(field: {name:string;label:string})}
  {#key `${node.id}:${field.name}`}<ExpressionEditor {compact} label={field.name} displayLabel={field.label} type="string" value={expression(field.name)} {references} {referenceLabels}
    onDraftChange={compact ? next => { dirty=next; onDraftChange?.(next); } : undefined}
    onCommit={value => onApply(setAttribute({requestId:crypto.randomUUID(),nodeId:node.id,name:field.name,...(value === undefined ? {} : {value})}))} />
    {#if showStateInitial}<StateInitialEditor {document} expression={expression(field.name)} {labels} {onApply} />{/if}
  {/key}
{/snippet}
<fieldset {disabled} class:compact>
 {#if compact}<ToolPages pages={fields.map(field=>({id:field.name,label:field.label==='Accessible name'?'Accessibility':field.label}))} label="Input content pages" locked={dirty}>{#snippet children(id)}{@render fieldEditor(fields.find(field=>field.name===id)!)}{/snippet}</ToolPages>
 {:else}<p>In Design, edit the saved content here. In Interact, type into the field to test it.</p>{#each fields as field (field.name)}{@render fieldEditor(field)}{/each}{/if}
</fieldset>
<style>
 fieldset {border:0;padding:0;margin:0;min-width:0;}.compact {height:100%;min-height:0;}p {font-size:11px;line-height:1.5;color:var(--ui-editor-muted,#667085);margin:6px 0;}
</style>
