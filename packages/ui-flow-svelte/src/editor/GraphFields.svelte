<script lang="ts">
  import {
    catalogImplementations,
    type UiSvelteComponentProps,
    type UiComponentPresentation,
  } from '@victframework/ui-svelte';
  import {MediaImage,MediaVideo,MediaIcon,MediaVector} from '@victframework/ui-media-svelte';
  import type { GraphField, GraphValue } from './model.js';
  import { graphFieldPresentation } from './presentation.js';
  let {
    fields,
    values,
    readOnly = false,
    advanced = false,
    owner,
    presentation,
    onchange,
  }: {
    fields: GraphField[];
    values: Record<string, GraphValue>;
    readOnly?: boolean;
    advanced?: boolean;
    owner: string;
    presentation?: UiComponentPresentation;
    onchange: (id: string, value: GraphValue) => void;
  } = $props();
  const registered = new Map(
    catalogImplementations.map((item) => [item.extensionId, item.component]),
  );
  function value(field: GraphField): GraphValue {
    return (
      values[field.id] ??
      field.default ??
      (field.kind === 'toggle'
        ? false
        : ['number', 'slider', 'button'].includes(field.kind)
          ? (field.min ?? 0)
          : field.kind === 'list'
            ? []
            : '')
    );
  }
  const pending = new Map<string, string>();
  function commit(field: GraphField, next: GraphValue) {
    if (readOnly || field.disabled) return;
    const serialized = JSON.stringify(next);
    if (serialized === JSON.stringify(value(field)) || pending.get(field.id) === serialized) return;
    pending.set(field.id, serialized);
    queueMicrotask(() => { if (pending.get(field.id) === serialized) pending.delete(field.id); });
    onchange(field.id, next);
  }
  function control(field: GraphField) {
    return registered.get(
      `vict.catalog.${field.kind === 'toggle' ? 'switch' : field.kind}`,
    );
  }
  function controlProps(field: GraphField): UiSvelteComponentProps {
    const current = value(field);
    return {
      nodeId: `${owner}/${field.id}`,
      occurrenceKey: `${owner}/${field.id}`,
      presentation: graphFieldPresentation(presentation, field.label),
      props: {
        label: field.label,
        disabled: readOnly || field.disabled === true,
        value: field.kind === 'slider' ? [current] : current,
        checked: current,
        min: field.min ?? 0,
        max: field.max ?? 100,
        step: field.step ?? 1,
        options:
          field.options?.map((item) => ({ value: item, label: item })) ?? [],
      },
      io: {
        emit: (output, payload) => {
          if (readOnly || field.disabled) return;
          if (field.kind === 'button' && output === 'press')
            onchange(field.id, Number(current) + 1);
          else if (
            field.kind === 'slider' &&
            output === 'valueCommit' &&
            Array.isArray(payload)
          )
            onchange(field.id, Number(payload[0]));
          else if (
            field.kind === 'toggle' &&
            output === 'checkedChange' &&
            typeof payload === 'boolean'
          )
            onchange(field.id, payload);
          else if (
            field.kind === 'select' &&
            output === 'valueChange' &&
            typeof payload === 'string'
          )
            onchange(field.id, payload);
        },
      },
    };
  }
</script>

<div class="vict-graph-fields nodrag nopan nowheel" data-graph-fields={owner}>
  {#each fields.filter(field=>advanced||!field.advanced) as field (field.id)}
    {@const Component=control(field)}
    <div class="vict-graph-field" data-field={field.id}>
      {#if Component && ['slider','toggle','select','button'].includes(field.kind)}
        {#if field.kind==='select'}<span class="field-label">{field.label}</span>{/if}
        <Component {...controlProps(field)} />
        {#if field.kind==='slider'}<output aria-label={`${field.label} value`}>{String(value(field))}</output>{/if}
      {:else if field.kind==='preview'}
        <span class="field-label">{field.label}</span><output>{String(value(field))}</output>
      {:else if ['image','video','icon','vector'].includes(field.kind)}
        <span class="field-label">{field.label}</span>
        {#if field.kind==='image'}<MediaImage nodeId={`${owner}/${field.id}`} occurrenceKey={`${owner}/${field.id}`} props={{source:String(value(field)),alt:field.media?.decorative?'':field.media?.alt??field.label,fit:'contain'}}/>
        {:else if field.kind==='video'}<MediaVideo nodeId={`${owner}/${field.id}`} occurrenceKey={`${owner}/${field.id}`} props={{source:String(value(field)),poster:field.media?.poster??'',captions:field.media?.captions??'',language:field.media?.language??'en',label:field.label}}/>
        {:else if field.kind==='icon'}<MediaIcon nodeId={`${owner}/${field.id}`} occurrenceKey={`${owner}/${field.id}`} props={{pack:field.media?.pack??'lucide',name:String(value(field)),revision:field.media?.revision??'1.27.0',source:String(value(field)).startsWith('asset:')?String(value(field)):'',data:String(value(field)).startsWith('{')?String(value(field)):'',decorative:field.media?.decorative??false,label:field.label,size:32}}/>
        {:else}<MediaVector nodeId={`${owner}/${field.id}`} occurrenceKey={`${owner}/${field.id}`} props={{source:String(value(field)).startsWith('asset:')?String(value(field)):'',data:String(value(field)).startsWith('asset:')?'':String(value(field)),label:field.label,decorative:field.media?.decorative??false}}/>{/if}
        {#if advanced}<label><span>{field.kind==='icon'?'Icon name, managed reference or inert vector JSON':'Managed reference or supplied source'}</span><input {...presentation?.target('field')} class={`vict-input ${presentation?.target('field').class ?? ''}`} value={String(value(field))} disabled={readOnly||field.disabled} onchange={event=>commit(field,event.currentTarget.value)} onblur={event=>commit(field,event.currentTarget.value)}/></label>{/if}
      {:else if field.kind==='list'}
        <label><span>{field.label}</span><textarea {...presentation?.target('field')} class={`vict-textarea ${presentation?.target('field').class ?? ''}`} rows="3" disabled={readOnly||field.disabled} value={(value(field) as string[]).join('\n')} onchange={event=>commit(field,event.currentTarget.value.split('\n'))} onblur={event=>commit(field,event.currentTarget.value.split('\n'))}></textarea></label>
        <ul>{#each (value(field) as string[]) as item}<li>{item}</li>{/each}</ul>
      {:else if field.kind==='textarea'}
        <label><span>{field.label}</span><textarea {...presentation?.target('field')} class={`vict-textarea ${presentation?.target('field').class ?? ''}`} rows="3" disabled={readOnly||field.disabled} value={String(value(field))} onchange={event=>commit(field,event.currentTarget.value)} onblur={event=>commit(field,event.currentTarget.value)}></textarea></label>
      {:else}
        <label><span>{field.label}</span><input {...presentation?.target('field')} class={`vict-input ${presentation?.target('field').class ?? ''}`} type={field.kind==='number'?'number':'text'} disabled={readOnly||field.disabled} value={String(value(field))} min={field.min} max={field.max} step={field.step} onchange={event=>commit(field,field.kind==='number'?event.currentTarget.valueAsNumber:event.currentTarget.value)} onblur={event=>commit(field,field.kind==='number'?event.currentTarget.valueAsNumber:event.currentTarget.value)} /></label>
      {/if}
    </div>
  {/each}
</div>
<style>
  /* Shared field geometry/interaction stays with the VICT recipe; retain the
     graph's explicit input-color override over that recipe's theme default. */
  input,textarea{background:var(--vict-flow-input,var(--vict-rhea-input,var(--vict-color-surface,#fff)))}
  .vict-graph-fields{display:grid;gap:var(--vict-space-2,8px);min-width:0;color:inherit}.vict-graph-field{display:grid;gap:var(--vict-space-1,4px);min-width:0}label{display:grid;gap:var(--vict-space-1,4px)}label span,.field-label{font-size:12px;font-weight:500}input,textarea{box-sizing:border-box;max-width:100%;width:100%}textarea{resize:vertical;min-height:60px}output,li{font-size:12px;overflow-wrap:anywhere}ul{margin:0;padding-left:18px;max-height:100px;overflow:auto}.vict-graph-field :global([data-testid=catalog-select]){min-width:0!important;width:100%}
</style>
