<script lang="ts">
  import type { UiDocument, UiNode, UiExpression } from '@victframework/ui';
  import type { TransactionDraft } from './commands.js';
  import { setAttribute } from './commands.js';
  import type { EditorLabels } from './inspector-ux.js';
  import ExpressionEditor from './ExpressionEditor.svelte';
  import StateInitialEditor from './StateInitialEditor.svelte';
  let { document, node, references, referenceLabels, labels, disabled = false, showStateInitial = true, onApply }: {
    document: UiDocument; node: Extract<UiNode,{kind:'element'}>; references: readonly string[];
    referenceLabels: Readonly<Record<string,string>>; labels: EditorLabels; disabled?: boolean; showStateInitial?: boolean;
    onApply: (draft: TransactionDraft) => void;
  } = $props();
  const fields = [{name:'value',label:'Value'},{name:'placeholder',label:'Placeholder'},{name:'aria-label',label:'Accessible name'}];
  function expression(name: string): UiExpression | undefined {
    const value=node.attributes?.[name];
    return typeof value === 'string' ? {type:'literal',value} : value;
  }
</script>
<fieldset {disabled}>
  <p>In Design, edit the saved content here. In Interact, type into the field to test it.</p>
  {#each fields as field (field.name)}
    {#key `${node.id}:${field.name}`}
      <ExpressionEditor label={field.name} displayLabel={field.label} type="string" value={expression(field.name)} {references} {referenceLabels}
        onCommit={value => onApply(setAttribute({requestId:crypto.randomUUID(),nodeId:node.id,name:field.name,...(value === undefined ? {} : {value})}))} />
      {#if showStateInitial}<StateInitialEditor {document} expression={expression(field.name)} {labels} {onApply} />{/if}
    {/key}
  {/each}
</fieldset>
<style>
  fieldset {border:0;padding:0;margin:0;min-width:0;}
  p {font-size:11px;line-height:1.5;color:var(--ui-editor-muted,#667085);margin:6px 0;}
</style>
