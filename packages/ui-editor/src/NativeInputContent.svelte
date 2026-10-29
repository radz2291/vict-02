<script lang="ts">
  import type { UiDocument, UiNode, UiExpression } from '@victframework/ui';
  import type { TransactionDraft } from './commands.js';
  import { findNodeSlotScope, setAttribute, wireNativeInput } from './commands.js';
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
  let wiringError = $state('');
  const lexicalSlotScope=$derived(findNodeSlotScope(document,node.id));
  function independentState() {
    if(lexicalSlotScope){
      const expected=node.attributes?.type==='checkbox'?'boolean':node.attributes?.type==='number'?'number':'string';
      const bound=expression(expected==='boolean'?'checked':'value');
      const key=bound?.type==='ref'&&bound.path.startsWith('state.')?bound.path.slice(6):undefined;
      const matches=Object.entries(lexicalSlotScope.state??{}).filter(([,declaration])=>declaration.type===expected).map(([key])=>key);
      const target=key&&matches.includes(key)?key:matches.length===1?matches[0]:undefined;
      if(!target){wiringError='Choose a declared scoped state reference in Value first, then connect its change event.';return;}
      try{wiringError='';onApply(wireNativeInput({requestId:crypto.randomUUID(),document,nodeId:node.id,key:target}));}
      catch(error){wiringError=error instanceof Error?error.message:'The scoped field could not be connected.';}
      return;
    }
    const base = `input_${node.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    let key = base; let suffix = 1;
    while (Object.hasOwn(document.localState,key)) key = `${base}_${suffix++}`;
    try { wiringError=''; onApply(wireNativeInput({requestId:crypto.randomUUID(),document,nodeId:node.id,key})); }
    catch (error) { wiringError=error instanceof Error ? error.message : 'The field could not be connected.'; }
  }
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
    {#if showStateInitial&&!lexicalSlotScope}<StateInitialEditor {document} expression={expression(field.name)} {labels} {onApply} />{/if}
  {/key}
{/snippet}
<fieldset {disabled} class:compact>
 {#if compact}<ToolPages pages={fields.map(field=>({id:field.name,label:field.label==='Accessible name'?'Accessibility':field.label}))} label="Input content pages" locked={dirty}>{#snippet children(id)}{@render fieldEditor(fields.find(field=>field.name===id)!)}{/snippet}</ToolPages>
 {:else}<p>In Design, edit the saved content here. In Interact, type into the field to test it.</p>{#each fields as field (field.name)}{@render fieldEditor(field)}{/each}{/if}
 <button type="button" disabled={dirty} onclick={independentState}>{lexicalSlotScope?'Connect scoped field state':'Use independent field state'}</button>
 {#if lexicalSlotScope}<p>Connects this field to declared scoped state. Starting values belong to the scoped source contract.</p>{:else}<p>Connects this field's value and change event to a new local starting value. Test typing in Interact.</p>{/if}
 {#if wiringError}<p role="alert">{wiringError}</p>{/if}
</fieldset>
<style>
 fieldset {border:0;padding:0;margin:0;min-width:0;}.compact {height:auto;min-height:0;}p {font-size:11px;line-height:1.5;color:var(--ui-editor-muted,#667085);margin:6px 0;}
</style>
