<script lang="ts">
  import type { UiDocument, UiStyleValue } from '@victframework/ui';
  type UiPseudoState = 'hover' | 'focus' | 'active' | 'disabled';
  import { resolveOccurrence } from './occurrence.js';
  import { connectInteraction, setAttribute, setConditionalStyle, setStyle, setTextLiteral, type TransactionDraft } from './commands.js';
  import { nodeLabel, sourceBreadcrumb, editableStyle, sourceStyles, styleText, styleGroups, type EditorLabels } from './inspector-ux.js';
  import InspectorControl from './InspectorControl.svelte';
  import InspectorSpacing from './InspectorSpacing.svelte';
  interface Props {
    document: UiDocument; selectedOccurrence?: string; onApply: (draft: TransactionDraft) => void;
    lastIssues?: readonly { code: string; message: string }[];
    knownActionIds?: readonly string[]; knownRouteIds?: readonly string[]; knownTokenIds?: readonly string[];
    styleConditions?: readonly { id: string; label: string }[];
    readEffective?: (occurrence: string, property: string) => string | undefined;
    labels?: EditorLabels;
  }
  let { document, selectedOccurrence, onApply, lastIssues = [], knownActionIds = [], knownRouteIds = [], knownTokenIds = [], styleConditions = [], readEffective, labels = {} }: Props = $props();
  let scope = $state<'shared' | 'instance'>('shared');
  let condition = $state('');
  let pseudo = $state<UiPseudoState | undefined>(undefined);
  let tab = $state('Content');
  let text = $state('');
  let property = $state('color');
  let value = $state('');
  let token = $state(false);
  let attr = $state('aria-label');
  let attrValue = $state('');
  let action = $state('');
  let route = $state('');
  const epoch = Math.random().toString(36).slice(2);
  let counter = 0;
  let selectionBar = $state<HTMLDivElement>();
  let headerSize = $state(200);
  $effect(() => {
    if (!selectionBar || typeof ResizeObserver === 'undefined') return;
    const bar = selectionBar;
    const observer = new ResizeObserver(() => headerSize = bar.getBoundingClientRect().height);
    observer.observe(bar);
    return () => observer.disconnect();
  });
  const report = $derived(selectedOccurrence ? resolveOccurrence(selectedOccurrence, document) : undefined);
  const node = $derived(report?.node);
  const nearest = $derived(report?.instancePath.at(-1));
  const owner = $derived(nearest?.definitionId);
  const shared = $derived(owner !== undefined);
  const styleSourceId = $derived(node?.kind === 'text' ? Object.values(document.nodes).find(n => n.kind === 'element' && n.children.includes(node.id))?.id ?? node.id : node?.id ?? '');
  const target = $derived(scope === 'instance' && nearest ? nearest.sourceNodeId : styleSourceId);
  const targetNode = $derived(document.nodes[target]);
  const count = $derived(Object.values(document.nodes).filter(n => n.kind === 'component' && n.definitionId === owner).length);
  const textNode = $derived(node?.kind === 'text' ? node : node?.kind === 'element' ? node.children.map(id => document.nodes[id]).find(n => n?.kind === 'text') : undefined);
  const canStyle = $derived(targetNode?.kind === 'element' || targetNode?.kind === 'component');
  const unsupportedTarget = $derived(!!(condition || pseudo) && targetNode?.kind !== 'element');
  const breadcrumb = $derived(node ? sourceBreadcrumb(document, node.id, labels) : []);
  $effect(() => { selectedOccurrence; scope = 'shared'; });
  $effect(() => { text = textNode?.kind === 'text' && textNode.content.type === 'literal' ? textNode.content.value : ''; });
  $effect(() => {
    const current = editableStyle(document, target, property, condition || undefined, pseudo);
    value = current?.type === 'token' ? current.id : styleText(current, document);
    token = current?.type === 'token';
  });
  $effect(() => {
    const click = node?.interactions?.find(i => i.on === 'click');
    action = click?.action === 'invokeAction' ? click.actionId : '';
    route = click?.action === 'navigate' ? click.routeId : '';
  });
  $effect(() => {
    const current = node?.kind === 'element' ? node.attributes?.[attr] : undefined;
    attrValue = typeof current === 'string' ? current : '';
  });
  function request() { return `inspector-ux-${epoch}-${++counter}`; }
  function connectRoute() {
    if (!node) return;
    const current = node.interactions?.find(i => i.on === 'click');
    onApply(connectInteraction({ requestId: request(), nodeId: node.id, interaction: { on: 'click', action: 'navigate', routeId: route, ...(current?.action === 'navigate' && current.params ? { params: current.params } : {}) } }));
  }
  function changeStyle(property: string, value?: UiStyleValue) {
    const input = { requestId: request(), nodeId: target, property, ...(value ? { value } : {}) };
    onApply(condition || pseudo ? setConditionalStyle({ ...input, ...(condition ? { conditionId: condition } : {}), ...(pseudo ? { pseudo } : {}) }) : setStyle(input));
  }
  function changeStyles(values: readonly { property: string; value?: string }[]) {
    const requestId = request();
    const commands = values.flatMap(({ property, value }) => {
      const input = { requestId, nodeId: target, property, ...(value !== undefined ? { value: { type: 'text' as const, value } } : {}) };
      return (condition || pseudo ? setConditionalStyle({ ...input, ...(condition ? { conditionId: condition } : {}), ...(pseudo ? { pseudo } : {}) }) : setStyle(input)).commands;
    });
    if (commands.length) onApply({ requestId, reason: 'Edit spacing sides together', commands });
  }
  function ownStyle(property: string) { return editableStyle(document, target, property, condition || undefined, pseudo); }
  function originLabel(property: string) {
    return (targetNode?.styleSources ?? []).some(id => { const source = document.styleSources[id]; return source?.conditionId === (condition || undefined) && source.pseudo === pseudo && source.declarations.some(d => d.property === property); }) ? 'Source' : 'Preview';
  }
  function display(property: string) {
    const local = editableStyle(document, target, property, condition || undefined, pseudo);
    if (local) return styleText(local, document);
    // Show unconditioned attached authored values, separately labeled from preview.
    const sources = (targetNode?.styleSources ?? []).map(id => document.styleSources[id]).filter(s => s && s.conditionId === (condition || undefined) && s.pseudo === pseudo);
    const authored = sources.flatMap(s => s.declarations).filter(d => d.property === property).at(-1)?.value;
    return styleText(authored, document) || effective(property);
  }
  function effective(property: string) { return selectedOccurrence ? readEffective?.(selectedOccurrence, property)?.trim() ?? '' : ''; }
  function origin(property: string) {
    const local = editableStyle(document, target, property, condition || undefined, pseudo);
    if (local) return local.type === 'token' ? `Override uses token ${local.id}` : local.type === 'binding' ? 'Bound expression; edit in Advanced' : `${shared && scope === 'shared' ? 'Shared definition' : 'Local'} override${condition ? ' · selected condition' : ''}${pseudo ? ` · ${pseudo}` : ''}`;
    const sources = sourceStyles(document, target, property);
    if (sources.length) return sources.join('; ');
    if (['color', 'font-family', 'font-size', 'font-weight', 'line-height', 'text-align'].includes(property) && node) {
      let ancestor = Object.values(document.nodes).find(n => 'children' in n && n.children.includes(node.id));
      const seen = new Set<string>();
      while (ancestor && !seen.has(ancestor.id)) {
        seen.add(ancestor.id);
        const declaration = ancestor.localStyle?.find(d => d.property === property);
        const attached = sourceStyles(document, ancestor.id, property);
        if (declaration || attached.length) return `Inheritable property · ancestor ${nodeLabel(document, ancestor.id, labels)} declares ${declaration ? styleText(declaration.value, document) : attached.join('; ')}. Browser now shows the result; external cascade origin is not inferred.`;
        const ancestorId = ancestor.id;
        ancestor = Object.values(document.nodes).find(n => 'children' in n && n.children.includes(ancestorId));
        if (!ancestor) {
          const instance = [...(report?.instancePath ?? [])].reverse().find(step => document.componentDefinitions[step.definitionId]?.root === ancestorId && !seen.has(step.sourceNodeId));
          if (instance) ancestor = document.nodes[instance.sourceNodeId];
        }
      }
    }
    return 'No declaration here. Browser preview includes inheritance and defaults; origin unavailable.';
  }
</script>

<aside class="uv-inspector ux-panel" aria-label="Inspector" style:scroll-padding-top={`${headerSize + 8}px`}>
  <div class="selection-bar" bind:this={selectionBar}><header>
    {#if node}<h2 title={nodeLabel(document, node.id, labels)}>{nodeLabel(document, node.id, labels)}</h2><details class="breadcrumb"><summary>Location · {breadcrumb.length > 1 ? breadcrumb.at(-2) : 'Page'}</summary><p>{breadcrumb.join(' / ')}</p></details>
    {:else}<h2>Make a selection</h2><p>Choose an element on the canvas or in Layers to edit it.</p>{/if}
  </header>
  {#if node}
    <div class="scope">
      {#if shared}
        <strong class="scope-badge">{scope === 'shared' ? `Shared · ${count} authored instances` : 'This instance · wrapper'}</strong>
        <label class="scope-picker"><span class="sr-only">Style edits apply to</span><select aria-label="Edits apply to" value={scope} onchange={e => scope = e.currentTarget.value as 'shared' | 'instance'}><option value="shared">Shared component</option><option value="instance">This instance · component wrapper</option></select></label>
        <details class="scope-help"><summary>Editing boundary</summary><p>{scope === 'shared' ? 'Shared source changes update every occurrence of this component. Count shows authored instances, not repeated runtime records.' : 'Styles apply to this component wrapper. Inner-element overrides and instance text replacement are unavailable.'}</p></details>
      {:else}<span class="source-context">{node.kind === 'text' ? 'Text · appearance on containing element' : 'Source element'}{node.kind === 'repeat' || report?.repeatKeys.length ? ' · repeated occurrences' : ''}</span>{/if}
    </div>
    <nav class="tabs" aria-label="Inspector sections">{#each ['Content', 'Style', 'Behavior'] as section}<button type="button" aria-pressed={tab === section} onclick={() => tab = section}>{section}</button>{/each}</nav>
  {/if}</div>
  {#if node}
    {#if tab === 'Content'}
      <section><h3>Content</h3>
        {#if textNode?.kind === 'text' && textNode.content.type === 'literal'}
          <label>Text content<textarea aria-label="Text content" bind:value={text} disabled={shared && scope === 'instance'} rows="4"></textarea></label>
          {#if shared}<p>Text edits change the shared source. This instance cannot replace definition text.</p>{/if}
          <button type="button" class="primary" disabled={shared && scope === 'instance'} onclick={() => onApply(setTextLiteral({ requestId: request(), nodeId: textNode.id, value: text }))}>Apply text</button>
        {:else if textNode?.kind === 'text'}<p>Text comes from a binding. Its expression is available in Advanced; literal editing would replace that binding.</p>
        {:else}<p>No direct text content. Expand this element in Layers to select its content.</p>{/if}
      </section>
    {:else if tab === 'Style'}
      <details class="context" open={!!(condition || pseudo)}><summary>Editing · {styleConditions.find(c => c.id === condition)?.label ?? (condition || 'Base · all sizes')}{pseudo ? ` · ${pseudo}` : ' · normal'}</summary><section><label>Editing condition<select aria-label="Style target" value={condition} onchange={e => condition = e.currentTarget.value}><option value="">Base · all sizes</option>{#each styleConditions as c}<option value={c.id}>{c.label}</option>{/each}</select></label>
        <label>Element state<select aria-label="Pseudo state" value={pseudo ?? ''} onchange={e => pseudo = (e.currentTarget.value || undefined) as UiPseudoState | undefined}><option value="">Normal</option>{#each ['hover', 'focus', 'active', 'disabled'] as p}<option value={p}>{p}</option>{/each}</select></label>
        <p>{condition ? 'Edits are saved in this condition. Resize the preview to test its query.' : 'Base styling applies at every size.'} {pseudo ? `Editing ${pseudo}; this does not force the browser into that state.` : ''}</p>
        {#if unsupportedTarget}<p role="status">Condition and state editing is unavailable on component wrappers. Select the shared inner element or use base styling.</p>{/if}
        {#if node.kind === 'text'}<p>Text appearance applies to its containing {nodeLabel(document, styleSourceId, labels)}.</p>{/if}
        {#if condition || pseudo}<p>Conditional rules are attached sources. A local base override can take precedence; Reset that base override if needed.</p>{/if}
      </section></details>
      {#if canStyle}
        {#each styleGroups as group, index}<details open={index < 2}><summary>{group.title}</summary><section>
          {#if group.title === 'Size & spacing'}{#each ['padding', 'margin'] as type}{#key `${target}:${condition}:${pseudo}:${type}`}<InspectorSpacing type={type as 'padding' | 'margin'} value={display} {effective} {origin} authored={p => ownStyle(p) !== undefined} locked={p => ownStyle(p)?.type === 'binding'} disabled={unsupportedTarget} onChange={changeStyles} onReset={properties => changeStyles(properties.map(property => ({ property })))} />{/key}{/each}{/if}
          {#each group.controls as control}
            {@const own = editableStyle(document, target, control.property, condition || undefined, pseudo)}
            {#key `${target}:${condition}:${pseudo}:${control.property}`}<InspectorControl label={control.label} kind={control.kind} value={display(control.property)} authored={own !== undefined} origin={origin(control.property)} originLabel={originLabel(control.property)} effective={effective(control.property)} options={'options' in control ? control.options : []} disabled={unsupportedTarget || own?.type === 'binding'} onChange={v => changeStyle(control.property, { type: 'text', value: v })} onReset={() => changeStyle(control.property)} />{/key}
          {/each}
        </section></details>{/each}
      {:else}<section><p>Select an element or component to style it. Text appearance is controlled by its containing element.</p></section>{/if}
    {:else}
      <section><h3>On click</h3>
        {#if node.kind === 'element'}
          <label>Declared action<select aria-label="Declared action" value={action} onchange={e => action = e.currentTarget.value}><option value="">Choose an action…</option>{#each knownActionIds as id}<option value={id}>{labels.actions?.[id] ?? id}</option>{/each}</select></label>
          <button type="button" disabled={!knownActionIds.includes(action)} onclick={() => onApply(connectInteraction({ requestId: request(), nodeId: node.id, interaction: { on: 'click', action: 'invokeAction', actionId: action, ...(node.interactions?.find(i => i.on === 'click' && i.action === 'invokeAction')?.action === 'invokeAction' ? { input: (node.interactions.find(i => i.on === 'click' && i.action === 'invokeAction') as { input?: Readonly<Record<string, import('@victframework/ui').UiExpression>> }).input } : {}) } }))}>Connect action</button>
          {#if !knownActionIds.length}<p>No declared actions supplied by the host.</p>{/if}
          {#if knownRouteIds.length}<label>Destination<select aria-label="Route id" value={route} onchange={e => route = e.currentTarget.value}><option value="">Choose…</option>{#each knownRouteIds as id}<option value={id}>{labels.routes?.[id] ?? id}</option>{/each}</select></label><button type="button" disabled={!knownRouteIds.includes(route)} onclick={connectRoute}>Connect navigation</button>{/if}
          <p>Connecting replaces the existing click interaction. {shared ? 'Behavior edits change shared source.' : ''}</p>
        {:else}<p>Click actions are available on elements. Select an inner button or link.</p>{/if}
      </section>
    {/if}
    <details class="advanced"><summary>Advanced · source & declarations</summary><section>
      <dl><dt>Source node</dt><dd>{node.id}</dd><dt>Component path</dt><dd>{report?.instancePath.map(p => `${p.sourceNodeId}@${p.definitionId}`).join(' / ') || 'None'}</dd><dt>Repeat record keys</dt><dd>{report?.repeatKeys.join(' / ') || 'None'}</dd><dt>Portal ownership</dt><dd>{JSON.stringify(report?.portalPath)}</dd></dl>
      {#if canStyle}<label>CSS property<input aria-label="Style property" bind:value={property} /></label><label><input type="checkbox" bind:checked={token} /> Use token</label>
        {#if token}<label>Token<select aria-label="Token id" bind:value={value}><option value="">Choose…</option>{#each knownTokenIds as id}<option value={id}>{id}</option>{/each}</select></label>{:else}<label>CSS value<input aria-label="Style value" bind:value={value} /></label>{/if}
        <p>{origin(property)}</p><button type="button" disabled={!value.trim() || !property.trim() || unsupportedTarget} onclick={() => changeStyle(property, token ? { type: 'token', id: value } : { type: 'text', value: value.trim() })}>Apply style</button><button type="button" disabled={!editableStyle(document, target, property, condition || undefined, pseudo) || unsupportedTarget} onclick={() => changeStyle(property)}>Reset declaration</button>
      {/if}
      {#if node.kind === 'element'}<label>Attribute name<input aria-label="Attribute name" bind:value={attr} /></label><label>Attribute value<input aria-label="Attribute value" bind:value={attrValue} /></label><button type="button" onclick={() => onApply(setAttribute({ requestId: request(), nodeId: node.id, name: attr, value: attrValue }))}>Set attribute</button>{/if}
      <h3>Canonical source (read only)</h3><pre>{JSON.stringify(node, null, 2)}</pre>
    </section></details>
  {/if}
  {#if lastIssues.length}<section role="alert" class="issues"><strong>Change rejected · source unchanged</strong>{#each lastIssues as issue}<p>{issue.code}: {issue.message}</p>{/each}</section>{/if}
</aside>

<style>
  .ux-panel { background: var(--ui-editor-panel, #f8f9fb); color: var(--ui-editor-ink, #202938); font: 12px/1.5 var(--ui-editor-font, 'Segoe UI', sans-serif); min-width: 0; width: 100%; height: 100%; overflow: auto; box-sizing: border-box; }
  header, section, .scope { padding: 10px 14px; min-width: 0; }
  .selection-bar { position: sticky; top: 0; z-index: 2; background: var(--ui-editor-panel, #f8f9fb); box-shadow: 0 1px 0 var(--ui-editor-line, #d7dce5); }
  header { background: var(--ui-editor-input, #fff); border-bottom: 1px solid var(--ui-editor-line, #d7dce5); }
  h2 { font-size: 14px; line-height: 1.35; margin: 0 0 4px; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  h3 { font-size: 12px; margin: 0 0 10px; }
  p { color: var(--ui-editor-muted, #667085); margin: 6px 0; overflow-wrap: anywhere; font-size: 11px; }
  .breadcrumb, .scope-help { font-size: 11px; border: 0; color: var(--ui-editor-muted, #667085); } .breadcrumb summary, .scope-help summary { padding: 0; font-weight: normal; } .breadcrumb p, .scope-help p { margin: 4px 0; }
  .breadcrumb:not([open]) summary { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .scope { padding-block: 6px; } .scope-badge { display: block; font-size: 12px; color: var(--ui-editor-accent, #355cc9); } .scope-picker { margin: 3px 0; } .scope-picker select { padding-block: 4px; } .source-context { font-size: 11px; color: var(--ui-editor-muted, #667085); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  label { display: block; margin: 6px 0; }
  input:not([type=checkbox]), select, textarea { width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; padding: 7px 8px; border: 1px solid var(--ui-editor-line, #d7dce5); border-radius: 5px; background: var(--ui-editor-input, #fff); color: inherit; font: inherit; }
  textarea { resize: vertical; margin-top: 5px; }
  button { padding: 7px 10px; font: inherit; color: inherit; border: 1px solid var(--ui-editor-line, #d7dce5); border-radius: 5px; background: var(--ui-editor-input, #fff); cursor: pointer; margin: 3px 3px 3px 0; }
  .primary, .tabs [aria-pressed=true] { color: var(--ui-editor-accent, #355cc9); background: var(--ui-editor-selection, #edf1ff); }
  .tabs { display: flex; padding: 0 10px 5px; border-bottom: 1px solid var(--ui-editor-line, #d7dce5); }
  .tabs button { flex: 1; }
  details { border-bottom: 1px solid var(--ui-editor-line, #d7dce5); }
  summary { padding: 10px 16px; font-weight: 600; cursor: pointer; }
  details section { padding-top: 0; }
  .advanced { margin-top: 12px; }
  dl { margin: 0; font-size: 11px; } dt { color: var(--ui-editor-muted, #667085); } dd { margin: 0 0 8px; overflow-wrap: anywhere; }
  pre { overflow: auto; max-height: 240px; font-size: 10px; background: var(--ui-editor-input, #fff); padding: 8px; }
  :focus-visible { outline: 2px solid var(--ui-editor-accent, #355cc9); outline-offset: 2px; }
  :disabled { opacity: .5; cursor: default; }
  .issues { background: #fff0ef; }
</style>
