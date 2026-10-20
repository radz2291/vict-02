<script lang="ts">
  import { tick } from 'svelte';
  import type { UiDocument, UiStyleValue, UiExtensionDescriptor, UiOutputBinding, UiExpression, UiValueType, UiFieldTypes } from '@victframework/ui';
  import { repeatExpressionFields } from '@victframework/ui';
  type UiPseudoState = 'hover' | 'focus' | 'active' | 'disabled';
  import { resolveOccurrence } from './occurrence.js';
  import { connectInteraction, bindExpression, setAttribute, setConditionalStyle, setOutputBinding, setStyle, setBaseStyle, setTextLiteral, type TransactionDraft } from './commands.js';
  import { nodeLabel, sourceBreadcrumb, editableStyle, sourceStyles, styleText, styleGroups, type EditorLabels } from './inspector-ux.js';
  import ExpressionEditor from './ExpressionEditor.svelte';
  import InspectorControl from './InspectorControl.svelte';
  import CustomSettings from './CustomSettings.svelte';
  import ToolPages from './ToolPages.svelte';
  import TextTools from './TextTools.svelte';
  import InspectorSpacing from './InspectorSpacing.svelte';
  import ComponentComposition from './ComponentComposition.svelte';
  import NativeInputContent from './NativeInputContent.svelte';
  import StateInitialEditor from './StateInitialEditor.svelte';
  import { conditionalStyleConflicts, allowConditionalStyles } from './responsive-style.js';
  interface Props {
    document: UiDocument; selectedOccurrence?: string; onApply: (draft: TransactionDraft) => boolean | void;
    lastIssues?: readonly { code: string; message: string }[];
    knownActionIds?: readonly string[]; knownRouteIds?: readonly string[]; knownTokenIds?: readonly string[];
    styleConditions?: readonly { id: string; label: string }[];
    readEffective?: (occurrence: string, property: string) => string | undefined;
    labels?: EditorLabels;
    /** Registered component descriptors: descriptor-driven editors (amendment §3.6). */
    componentDescriptors?: readonly UiExtensionDescriptor[];
    /** View-field types for array-prop reference binding (type-filtered). */
    knownViewFields?: UiFieldTypes;
    /** Focused object tools; default retains the full docked Inspector. */
    contextual?: boolean;
    editTextSignal?: symbol;
    onTextDraftChange?: (dirty: boolean) => void;
    section?: 'Content' | 'Style' | 'Behavior';
    actionInputs?: Readonly<Record<string, Readonly<Record<string, UiValueType>>>>;
  }
  let { editTextSignal, onTextDraftChange, contextual = false, section: tab = $bindable('Content'), document, selectedOccurrence, onApply, lastIssues = [], knownActionIds = [], knownRouteIds = [], knownTokenIds = [], styleConditions = [], readEffective, labels = {}, componentDescriptors = [], knownViewFields = {}, actionInputs = {} }: Props = $props();
  // DOM measurements must run again after the canvas consumes new source/selection.
  let measurementVersion = $state(0);
  $effect(() => {
    document; selectedOccurrence; readEffective; condition; pseudo; scope;
    let cancelled = false;
    void tick().then(() => { if (!cancelled) measurementVersion++; });
    return () => { cancelled = true; };
  });
  $effect(() => {
    if (typeof window === 'undefined') return;
    // CSS pseudo states can change without a source edit or a host signal.
    const events = ['resize', 'pointerover', 'pointerout', 'pointerdown', 'pointerup', 'pointercancel', 'focusin', 'focusout', 'keydown', 'keyup'] as const;
    let queued = false;
    let cancelled = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      void tick().then(() => {
        queued = false;
        if (!cancelled) measurementVersion++;
      });
    };
    for (const event of events) window.addEventListener(event, refresh);
    return () => {
      cancelled = true;
      for (const event of events) window.removeEventListener(event, refresh);
    };
  });
  let scope = $state<'shared' | 'instance'>('shared');
  let condition = $state('');
  let pseudo = $state<UiPseudoState | undefined>(undefined);
  let text = $state('');
  let textDraftDirty = $state(false);
  function textDraftChange(dirty: boolean) { textDraftDirty = dirty; onTextDraftChange?.(dirty); }
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
  // Descriptor-driven editors (amendment §3.6): one control per declared
  // prop, one output row per declared output.
  const componentNode = $derived(node?.kind === 'component' ? node : undefined);

  // Finding F15 truthfulness: for these components the `label` prop's visible
  // text is owned by a slot whenever that slot is filled (renderers prefer
  // slot content over the label prop). The Inspector says so instead of
  // silently accepting edits with no visible effect. Slot precedence itself
  // is legitimate and stays.
  const SLOT_OWNED_LABEL: Readonly<Record<string, string>> = {
    'vict.catalog.dropdown-menu': 'trigger',
    'vict.catalog.context-menu': 'trigger',
    'vict.catalog.menubar.menu': 'trigger',
    'vict.catalog.dropdown-menu.item': 'content',
    'vict.catalog.dropdown-menu.sub': 'trigger',
    'vict.catalog.context-menu.item': 'content',
    'vict.catalog.context-menu.sub': 'trigger',
    'vict.catalog.menubar.item': 'content',
    'vict.catalog.menubar.sub': 'trigger',
    'vict.catalog.command.item': 'content',
    'vict.catalog.navigation-menu.item': 'trigger',
    'vict.catalog.navigation-menu.link': 'content',
    'vict.catalog.combobox-item': 'content',
    'vict.catalog.select-item': 'content',
    'vict.catalog.toggle-group-item': 'content',
    'vict.catalog.accordion-item': 'trigger'
  };
  function slotOwnedLabelSlot(descriptorId: string, propName: string, candidate: { kind: string; slots?: Readonly<Record<string, { children: readonly unknown[] }>> } | undefined): string | undefined {
    if (propName !== 'label' || !candidate || candidate.kind !== 'component') return undefined;
    const slot = SLOT_OWNED_LABEL[descriptorId];
    if (!slot) return undefined;
    const fill = candidate.slots?.[slot];
    return fill && fill.children.length > 0 ? slot : undefined;
  }
  const componentDescriptor = $derived.by(() => {
    if (!componentNode) return undefined;
    const candidates = componentDescriptors.filter(entry => entry.id === componentNode.definitionId);
    const revision = componentNode.revision ?? candidates.at(-1)?.revision;
    const matches = candidates.filter(entry => entry.revision === revision);
    return matches.length === 1 ? matches[0] : undefined;
  });
  const stateKeysTyped = $derived(Object.entries(document.localState).map(([key, decl]) => ({ key, type: decl.type })));
  function refs(type: string, payload?: string): string[] {
    const compatible = (actual: string) => actual === type || (type === 'array' && (actual === 'stringList' || actual === 'numberList'));
    const contains = (id: string, sought: string, seen = new Set<string>()): boolean => {
      if (id === sought) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      const candidate = document.nodes[id];
      const children = candidate?.kind === 'element' || candidate?.kind === 'portal' ? candidate.children
        : candidate?.kind === 'component' ? Object.values(candidate.slots ?? {}).flatMap(fill => fill.children)
        : candidate?.kind === 'repeat' ? [candidate.templateRoot]
        : candidate?.kind === 'slot' ? candidate.fallback ?? []
        : candidate?.kind === 'conditional' ? candidate.branches.flatMap(branch => branch.children) : [];
      return children.some(child => contains(child, sought, seen));
    };
    const definition = componentNode && Object.values(document.componentDefinitions).find(entry => contains(entry.root, componentNode.id));
    const references = definition
      ? definition.props.filter(prop => compatible(prop.type)).map(prop => `prop.${prop.name}`)
      : [
        ...stateKeysTyped.filter(entry => compatible(entry.type)).map(entry => `state.${entry.key}`),
        ...Object.entries(knownViewFields).filter(([name, actual]) => !name.includes('.') && compatible(actual)).flatMap(([name]) => [`view.${name}`, `record.${name}`]),
      ];
    // Offer repeat fields only in the authored lexical template containing this instance.
    if (!definition) for (const candidate of Object.values(document.nodes)) {
      if (candidate.kind === 'repeat' && componentNode && contains(candidate.templateRoot, componentNode.id)) {
        for (const [name, actual] of Object.entries(repeatExpressionFields(candidate.collection, knownViewFields))) {
          if (compatible(actual)) references.push(`repeat.${candidate.itemName}.${name}`);
        }
      }
    }
    if (payload !== 'void' && payload !== undefined && compatible(payload)) references.unshift('$output');
    return [...new Set(references)];
  }
  function applyProp(name: string, expression?: UiExpression): boolean | void {
    if (!componentNode) return;
    return onApply(bindExpression({ requestId: request(), nodeId: componentNode.id, target: { kind: 'prop', name }, expression }));
  }
  function outputBindingRaw(output: string): UiOutputBinding | undefined { return componentNode?.outputs?.[output]; }
  function commitBinding(output: string, binding?: UiOutputBinding): boolean | void {
    if (!componentNode) return;
    return onApply(setOutputBinding({ requestId: request(), nodeId: componentNode.id, output, binding }));
  }
  function applySetStateBinding(output: string, key: string): void {
    if (!key) return;
    const prior = outputBindingRaw(output);
    commitBinding(output, { setState: { key, ...(prior && 'setState' in prior && prior.setState.value ? { value: prior.setState.value } : {}) } });
  }
  function applyActionBinding(output: string, actionId: string): void {
    if (!actionId) return;
    const prior = outputBindingRaw(output);
    commitBinding(output, { invokeAction: { actionId, ...(prior && 'invokeAction' in prior ? { input: prior.invokeAction.input } : {}) } });
  }
  function mapInput(output: string, name: string, expression?: UiExpression): boolean | void {
    const prior = outputBindingRaw(output);
    if (!prior || !('invokeAction' in prior)) return;
    const input = { ...prior.invokeAction.input };
    if (expression === undefined) delete input[name]; else input[name] = expression;
    return commitBinding(output, { invokeAction: { ...prior.invokeAction, input } });
  }
  function clearBinding(output: string): void { commitBinding(output); }
  // Descriptor slot ownership is composition, not a shared stored-definition body.
  const nearest = $derived(report?.instancePath.filter(step => document.componentDefinitions[step.definitionId] !== undefined).at(-1));
  const owner = $derived(nearest?.definitionId);
  const shared = $derived(owner !== undefined);
  const styleSourceId = $derived(node?.kind === 'text' ? Object.values(document.nodes).find(n => n.kind === 'element' && n.children.includes(node.id))?.id ?? node.id : node?.id ?? '');
  const target = $derived(scope === 'instance' && nearest ? nearest.sourceNodeId : styleSourceId);
  const targetNode = $derived(document.nodes[target]);
  const conflicts = $derived(conditionalStyleConflicts(document, target, condition || undefined, pseudo));
  const container = $derived(targetNode?.kind === 'element' && !['h1', 'h2', 'h3', 'h4', 'p', 'span', 'strong', 'em', 'button', 'a', 'label', 'input', 'textarea'].includes(targetNode.tag));
  const orderedGroups = $derived([...styleGroups].sort((a, b) => {
    const order = container ? ['Layout', 'Size & spacing', 'Fill & border', 'Typography'] : ['Typography', 'Fill & border', 'Size & spacing', 'Layout'];
    return order.indexOf(a.title) - order.indexOf(b.title);
  }));
  const textNode = $derived(node?.kind === 'text' ? node : node?.kind === 'element' ? node.children.map(id => document.nodes[id]).find(n => n?.kind === 'text') : undefined);
  const simpleText = $derived(contextual && textNode?.kind === 'text' && textNode.content.type === 'literal' && targetNode?.kind === 'element' && !['input', 'textarea'].includes(targetNode.tag));
  const shownGroups = $derived(orderedGroups);
  const referenceLabels = $derived(Object.fromEntries(Object.entries(labels.state ?? {}).map(([key, label]) => [`state.${key}`, label])));
  function friendly(value: string) { return value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('-', ' ').replace(/^./, c => c.toUpperCase()); }
  function outputTitle(name: string) { return ({ press: 'When pressed', checkedChange: 'When toggled', valueChange: 'When the value changes', openChange: 'When opened or closed' } as Record<string, string>)[name] ?? `When ${friendly(name).toLowerCase()}`; }
  const count = $derived(Object.values(document.nodes).filter(n => n.kind === 'component' && n.definitionId === owner).length);
  const canStyle = $derived(targetNode?.kind === 'element' || (targetNode?.kind === 'component' && (!componentDescriptor || (componentDescriptor.styleTargets?.length ?? 0) > 0)));
  const unsupportedTarget = $derived(!!(condition || pseudo) && targetNode?.kind !== 'element');
  const breadcrumb = $derived(node ? sourceBreadcrumb(document, node.id, labels) : []);
  const location = $derived([...(report?.instancePath.map(step => nodeLabel(document, step.sourceNodeId, labels)) ?? []), ...breadcrumb]);
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
  function styleDraft(input: Parameters<typeof setStyle>[0]) {
    return condition || pseudo
      ? setConditionalStyle({ ...input, ...(condition ? { conditionId: condition } : {}), ...(pseudo ? { pseudo } : {}) })
      : setBaseStyle(document, input);
  }
  function changeStyle(property: string, value?: UiStyleValue) {
    const input = { requestId: request(), nodeId: target, property, ...(value ? { value } : {}) };
    return onApply(styleDraft(input));
  }
  function changeStyles(values: readonly { property: string; value?: string }[]) {
    const requestId = request();
    const commands = values.flatMap(({ property, value }) => {
      const input = { requestId, nodeId: target, property, ...(value !== undefined ? { value: { type: 'text' as const, value } } : {}) };
      return styleDraft(input).commands;
    });
    if (commands.length) onApply({ requestId, reason: 'Edit spacing sides together', commands });
  }
  function ownStyle(property: string) { return editableStyle(document, target, property, condition || undefined, pseudo); }
  function originLabel(property: string) {
    return (targetNode?.styleSources ?? []).some(id => { const source = document.styleSources[id]; return !!source && source.conditionId === (condition || undefined) && source.pseudo === pseudo && source.declarations.some(d => d.property === property); }) ? 'Source' : 'Preview';
  }
  function display(property: string) {
    const local = editableStyle(document, target, property, condition || undefined, pseudo);
    if (local) return styleText(local, document);
    // Show unconditioned attached authored values, separately labeled from preview.
    const sources = (targetNode?.styleSources ?? []).map(id => document.styleSources[id]).filter((s): s is NonNullable<typeof s> => !!s && s.conditionId === (condition || undefined) && s.pseudo === pseudo);
    const authored = sources.flatMap(s => s.declarations).filter(d => d.property === property).at(-1)?.value;
    return styleText(authored, document) || effective(property);
  }
  function effective(property: string) { measurementVersion; return selectedOccurrence ? readEffective?.(selectedOccurrence, property)?.trim() ?? '' : ''; }
  function origin(property: string) {
    const local = editableStyle(document, target, property, condition || undefined, pseudo);
    if (local) return local.type === 'token' ? `Override uses token ${local.id}` : local.type === 'binding' ? (contextual ? 'Bound expression; edit in Document → Source' : 'Bound expression; edit in Advanced') : `${shared && scope === 'shared' ? 'Shared definition' : 'Local'} override${condition ? ' · selected condition' : ''}${pseudo ? ` · ${pseudo}` : ''}`;
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
  let toolCategory = $state('');
  let valueProperty = $state('font-size');
  const namedValues=$derived(Object.keys(document.tokens));
  function groupProperties(type:string){return [type,...['top','right','bottom','left'].map(side=>`${type}-${side}`)].filter(property=>ownStyle(property) && ownStyle(property)?.type!=='binding');}
  const nativeFields = $derived(node?.kind === 'element' ? (node.tag === 'img' ? [{name:'src',label:'Image URL'},{name:'alt',label:'Alternative text'}] : node.tag === 'a' ? [{name:'href',label:'Link URL'},{name:'target',label:'Link target'},{name:'aria-label',label:'Accessibility'}] : [{name:'aria-label',label:'Accessibility'},{name:'title',label:'Tooltip'}]) : []);
  const objectCategories = $derived([
    ...(!simpleText ? [{id:'Content',label:componentDescriptor?'Properties':'Content'}] : []),
    ...(canStyle ? [{id:'Text',label:'Text'},{id:'Fill',label:'Fill'},{id:'Spacing',label:'Spacing'},{id:'Layout',label:'Layout'}] : []),
    {id:'Rules',label:'Rules'},
  ]);
  $effect(() => { selectedOccurrence; toolCategory = simpleText ? 'Text' : container ? 'Layout' : 'Content'; });
  $effect(() => { if(editTextSignal && simpleText) toolCategory = 'Text'; });
  const allControls = styleGroups.flatMap(group => [...group.controls]);
  const valueProperties = [...allControls.map(control=>({id:control.property,label:control.label})),{id:'letter-spacing',label:'Letter spacing'},{id:'padding',label:'All padding sides'},{id:'margin',label:'All margin sides'},...['padding','margin'].flatMap(type=>['top','right','bottom','left'].map(side=>({id:`${type}-${side}`,label:`${type} ${side}`})))];
  const stylePageSets: Readonly<Record<string,readonly {id:string;label:string;properties:readonly string[]}[]>> = {
    Fill:[{id:'background',label:'Background',properties:['background-color']},{id:'border',label:'Border',properties:['border-color','border-width','border-style']},{id:'corners',label:'Corners',properties:['border-radius']}],
    Spacing:[{id:'size',label:'Size',properties:['width','height']},{id:'limits',label:'Limits',properties:['min-width','max-width']},{id:'padding',label:'Padding',properties:[]},{id:'margin',label:'Margin',properties:[]}],
    Layout:[{id:'flow',label:'Flow',properties:['display','flex-direction','flex-wrap','gap']},{id:'alignment',label:'Alignment',properties:['align-items','justify-content']},{id:'grid',label:'Grid',properties:['grid-template-columns']}],
  };
  const connectionPages = $derived(componentDescriptor ? (componentDescriptor.outputs ?? []).flatMap(output=>{
    const binding=outputBindingRaw(output.name);
    const declared=binding && 'invokeAction' in binding?actionInputs[binding.invokeAction.actionId] ?? {}:{};
    const mappings=binding && 'invokeAction' in binding ? [...new Set([...Object.keys(declared),...Object.keys(binding.invokeAction.input ?? {})])].map(name=>({id:`input:${output.name}:${name}`,label:friendly(name),output:output.name,input:name})) : [];
    const stateValue=binding && 'setState' in binding && binding.setState.value?[{id:`state:${output.name}`,label:'State value',output:output.name,input:''}]:[];
    return [{id:`event:${output.name}`,label:outputTitle(output.name),output:output.name,input:''},...mappings,...stateValue];
  }) : []);
  function nativeAttribute(name:string):UiExpression | undefined { const value=node?.kind==='element'?node.attributes?.[name]:undefined;return typeof value==='string'?{type:'literal',value}:value; }

</script>

{#snippet ruleControls()}<section><label>Editing condition<select aria-label="Style target" value={condition} onchange={e => condition = e.currentTarget.value}><option value="">Base · all sizes</option>{#each styleConditions as c}<option value={c.id}>{c.label}</option>{/each}</select></label>
        <label>Element state<select aria-label="Pseudo state" value={pseudo ?? ''} onchange={e => pseudo = (e.currentTarget.value || undefined) as UiPseudoState | undefined}><option value="">Normal</option>{#each ['hover', 'focus', 'active', 'disabled'] as p}<option value={p}>{p}</option>{/each}</select></label>
        <p>{condition ? 'Edits are saved in this condition. Resize the preview to test its query.' : 'Base styling applies at every size.'} {pseudo ? `Editing ${pseudo}; this does not force the browser into that state.` : ''}</p>
        {#if unsupportedTarget}<p role="status">Condition and state editing is unavailable on component wrappers. Use base styling or select a shared inner element.</p><button type="button" onclick={() => { condition = ''; pseudo = undefined; }}>Edit base styles</button>{/if}
        {#if node?.kind === 'text'}<p>Text appearance applies to its containing {nodeLabel(document, styleSourceId, labels)}.</p>{/if}
        {#if condition || pseudo}<p>These rules apply only in the selected condition or state.</p>{/if}
      </section>
      {#if conflicts.length}
        <section class="style-conflict" aria-label="Style conflicts"><h3>Base styles are masking this rule</h3>
          <p>Local base overrides mask: {conflicts.map(declaration => declaration.property).join(', ')}. The saved conditional values cannot win against them.</p>
          <button type="button" onclick={() => onApply(allowConditionalStyles(request(), document, target, condition || undefined, pseudo))}>Allow conditional overrides</button>
          <p>Keeps the base values for other sizes and states. Undo restores the original overrides.</p>
          <button type="button" onclick={() => { condition = ''; pseudo = undefined; }}>Edit base styles instead</button>
        </section>
      {/if}
{/snippet}
{#snippet styleContext()}<details class="context" open={!!(condition || pseudo)}><summary>Editing · {styleConditions.find(c => c.id === condition)?.label ?? (condition || 'Base · all sizes')}{pseudo ? ` · ${pseudo}` : ' · normal'}</summary>{@render ruleControls()}</details>{/snippet}

<aside class="uv-inspector ux-panel" class:contextual aria-label={contextual ? "Object properties" : "Inspector"} style:scroll-padding-top={`${headerSize + 8}px`}>
  {#if !contextual}<div class="selection-bar" bind:this={selectionBar}>{#if !contextual}<header>
    {#if node}<h2 title={nodeLabel(document, node.id, labels)}>{nodeLabel(document, node.id, labels)}</h2><details class="breadcrumb"><summary>Location · {location.length > 1 ? location.at(-2) : 'Document root'}</summary><p>{location.join(' / ')}</p></details>
    {:else}<h2>Make a selection</h2><p>Choose an element on the canvas or in Layers to edit it.</p>{/if}
  </header>{/if}
  {#if node}
    <div class="scope">
      {#if shared}
        <strong class="scope-badge">{scope === 'shared' ? `Shared · ${count} authored instances` : 'This instance · wrapper'}</strong>
        <label class="scope-picker"><span class="sr-only">Style edits apply to</span><select aria-label="Edits apply to" value={scope} onchange={e => scope = e.currentTarget.value as 'shared' | 'instance'}><option value="shared">Shared component</option><option value="instance">This instance · component wrapper</option></select></label>
        <details class="scope-help"><summary>Editing boundary</summary><p>{scope === 'shared' ? 'Shared source changes update every occurrence of this component. Count shows authored instances, not repeated runtime records.' : 'Styles apply to this component wrapper. Inner-element overrides and instance text replacement are unavailable.'}</p></details>
      {:else}<span class="source-context">{node.kind === 'text' ? 'Text · appearance on containing element' : 'Source element'}{node.kind === 'repeat' || report?.repeatKeys.length ? ' · repeated occurrences' : ''}</span>{/if}
    </div>
    {#if !contextual}<nav class="tabs" aria-label="Inspector sections">{#each ['Content', 'Style', 'Behavior'] as const as section}<button type="button" aria-pressed={tab === section} onclick={() => tab = section}>{section}</button>{/each}</nav>{/if}
  {/if}</div>{/if}
  {#if node}
    {#if contextual}
      {#if tab === 'Behavior'}
        {#if node.kind === 'element'}
          <ToolPages pages={[{id:'action',label:'Action'},{id:'navigation',label:'Navigation'}]} label="Click connection pages" locked={textDraftDirty}>
            {#snippet children(page)}
              {#if page==='action'}<label>When clicked · declared action<select aria-label="Declared action" bind:value={action}><option value="">Choose an action…</option>{#each knownActionIds as id}<option value={id}>{labels.actions?.[id] ?? id}</option>{/each}</select></label><button type="button" disabled={!knownActionIds.includes(action)} onclick={()=>onApply(connectInteraction({requestId:request(),nodeId:node.id,interaction:{on:'click',action:'invokeAction',actionId:action,...(node.interactions?.find(i=>i.on==='click' && i.action==='invokeAction')?.action==='invokeAction'?{input:(node.interactions.find(i=>i.on==='click' && i.action==='invokeAction') as {input?:Readonly<Record<string,UiExpression>>}).input}:{})}}))}>Connect action</button><p>Uses an application-declared action. Connecting replaces the click interaction.</p>
              {:else}<label>When clicked · destination<select aria-label="Route id" bind:value={route}><option value="">Choose…</option>{#each knownRouteIds as id}<option value={id}>{labels.routes?.[id] ?? id}</option>{/each}</select></label><button type="button" disabled={!knownRouteIds.includes(route)} onclick={connectRoute}>Connect navigation</button>{/if}
            {/snippet}
          </ToolPages>
        {:else if componentDescriptor && connectionPages.length}
          <ToolPages pages={connectionPages} label="Component connection pages" locked={textDraftDirty}>
            {#snippet children(page)}
              {@const entry=connectionPages.find(entry=>entry.id===page)!}
              {@const output=componentDescriptor.outputs!.find(output=>output.name===entry.output)!}
              {@const binding=outputBindingRaw(output.name)}
              {#if page.startsWith('state:') && binding && 'setState' in binding}
                <ExpressionEditor compact label={`${output.name} state value`} type={output.payload==='void'?'string':output.payload} value={binding.setState.value} references={refs(output.payload,output.payload)} onDraftChange={textDraftChange} onCommit={value=>commitBinding(output.name,{setState:{key:binding.setState.key,...(value?{value}:{})}})}/>
              {:else if entry.input && binding && 'invokeAction' in binding}
                <p>{outputTitle(output.name)} → {labels.actions?.[binding.invokeAction.actionId] ?? binding.invokeAction.actionId}</p>
                {#if actionInputs[binding.invokeAction.actionId]?.[entry.input]}<ExpressionEditor compact label={`${output.name} input ${entry.input}`} displayLabel={labels.actionInputs?.[entry.input] ?? friendly(entry.input)} {referenceLabels} type={actionInputs[binding.invokeAction.actionId]![entry.input]!} value={binding.invokeAction.input?.[entry.input]} references={refs(actionInputs[binding.invokeAction.actionId]![entry.input]!,output.payload)} onDraftChange={textDraftChange} onCommit={expression=>mapInput(output.name,entry.input,expression)} />{:else}<p>Existing mapping; static input type is unavailable. Runtime contracts validate it.</p><pre>{JSON.stringify(binding.invokeAction.input?.[entry.input],null,2)}</pre><button type="button" onclick={()=>mapInput(output.name,entry.input)}>Remove {entry.input} mapping</button>{/if}
              {:else}
                <div class="compact-grid">
                  {#if output.payload!=='void'}<label>Update state<select aria-label={`${output.name} state target`} value={binding && 'setState' in binding?binding.setState.key:''} onchange={e=>applySetStateBinding(output.name,e.currentTarget.value)}><option value="">Choose a state key…</option>{#each stateKeysTyped.filter(entry=>entry.type===output.payload) as entry}<option value={entry.key}>{labels.state?.[entry.key] ?? entry.key}</option>{/each}</select></label>{/if}
                  <label>Run action<select aria-label={`${output.name} action`} value={binding && 'invokeAction' in binding?binding.invokeAction.actionId:''} onchange={e=>applyActionBinding(output.name,e.currentTarget.value)}><option value="">Choose an action…</option>{#each knownActionIds as id}<option value={id}>{labels.actions?.[id] ?? id}</option>{/each}</select></label>
                </div>
                <p>{output.description ?? `Declared ${output.payload} event.`}</p>
                {#if binding}<p class="connection-summary">→ {'invokeAction' in binding?labels.actions?.[binding.invokeAction.actionId] ?? binding.invokeAction.actionId:labels.state?.[binding.setState.key] ?? binding.setState.key}</p><button type="button" onclick={()=>clearBinding(output.name)}>Remove connection</button>{/if}
              {/if}
            {/snippet}
          </ToolPages>
        {:else}<p>This selection exposes no component events. Select an interactive element to connect behavior.</p>{/if}
      {:else}
        <ToolPages pages={objectCategories} bind:active={toolCategory} revealSignal={editTextSignal} label="Format categories" locked={textDraftDirty}>
          {#snippet children(category)}
            {#if category==='Content'}
              {#if node.kind==='element' && ['input','textarea'].includes(node.tag)}
                <NativeInputContent compact showStateInitial={false} {document} {node} references={refs('string')} {referenceLabels} {labels} disabled={shared && scope==='instance'} onDraftChange={textDraftChange} {onApply}/>
              {:else if componentDescriptor && componentNode}
                <ToolPages pages={componentDescriptor.props.map(prop=>({id:prop.name,label:friendly(prop.name)}))} label="Component property pages" locked={textDraftDirty}>
                  {#snippet children(name)}
                    {@const prop=componentDescriptor.props.find(prop=>prop.name===name)}
                    {#if prop}<fieldset class="content-boundary" disabled={shared && scope==='instance'}>{#key `${componentNode.id}:${name}`}<ExpressionEditor compact label={name} displayLabel={friendly(name)} {referenceLabels} type={prop.type} value={componentNode.props?.[name]} defaultValue={prop.default} references={refs(prop.type)} onDraftChange={textDraftChange} onCommit={expression=>applyProp(name,expression)}/>{/key}</fieldset>
                    {@const slot=slotOwnedLabelSlot(componentDescriptor.id,name,componentNode)}{#if slot}<p>The {slot} slot supplies the visible text. This property is its fallback. Edit that slot's text through Document → Structure.</p>{/if}
                    {:else}<p>This component exposes no properties. Add content through Insert and its declared slots.</p>{/if}
                  {/snippet}
                </ToolPages>
              {:else if textNode?.kind==='text'}<p>Text comes from an expression. Edit that expression in Document → Source; it is preserved here.</p>
              {:else if nativeFields.length}<fieldset class="content-boundary full" disabled={shared && scope==='instance'}><ToolPages pages={nativeFields.map(field=>({id:field.name,label:field.label}))} label="Element content pages" locked={textDraftDirty}>{#snippet children(name)}{#key `${node.id}:${name}`}<ExpressionEditor compact label={name} displayLabel={nativeFields.find(field=>field.name===name)?.label} type="string" value={nativeAttribute(name)} references={refs('string')} {referenceLabels} onDraftChange={textDraftChange} onCommit={value=>onApply(setAttribute({requestId:request(),nodeId:node.id,name,...(value===undefined?{}:{value})}))}/>{/key}{/snippet}</ToolPages></fieldset>
              {:else}<p>Select a source element or catalog component to edit its exposed properties.</p>{/if}
            {:else if category==='Text'}
              <TextTools value={display} locked={property=>ownStyle(property)?.type==='binding'} disabled={unsupportedTarget || (shared && scope==='instance')} editableContent={!!simpleText} content={textNode?.kind==='text' && textNode.content.type==='literal'?textNode.content.value:''} contentRevision={JSON.stringify(document)} {editTextSignal} onTextDraftChange={textDraftChange} onTextApply={value=>textNode?onApply(setTextLiteral({requestId:request(),nodeId:textNode.id,value})):false} onChange={(property,value)=>changeStyle(property,{type:'text',value})} contextLabel={`${styleConditions.find(c=>c.id===condition)?.label ?? (condition || 'All sizes')}${pseudo?` · ${pseudo}`:' · normal'}`}/>
            {:else if category==='Rules'}
              <ToolPages pages={[{id:'conditions',label:'Conditions'},{id:'values',label:'Values & reset'},{id:'ownership',label:'Ownership'},{id:'custom',label:'Custom'},{id:'details',label:'Details'}]} label="Style rule pages" locked={textDraftDirty}>
                {#snippet children(page)}
                  {#if page==='conditions'}{@render ruleControls()}
                  {:else if page==='values'}
                    <label>Setting<select aria-label="Setting details" value={valueProperty} onchange={event=>valueProperty=event.currentTarget.value}>{#each valueProperties as property}<option value={property.id}>{property.label}</option>{/each}</select></label>
                    {#if valueProperty==='padding' || valueProperty==='margin'}
                      <div class="group-values">{#each ['top','right','bottom','left'] as side}<span>{side}: {display(`${valueProperty}-${side}`) || 'Not set'}</span>{/each}</div>
                      <button type="button" disabled={!canStyle || !groupProperties(valueProperty).length || unsupportedTarget} onclick={()=>changeStyles(groupProperties(valueProperty).map(property=>({property})))}>Reset all {valueProperty}</button><p>Removes this rule's editable shorthand and side overrides in one undo step. Bound values remain.</p>
                    {:else}<p>{display(valueProperty) || 'Not set'} · {origin(valueProperty)}</p>{#if effective(valueProperty)}<p>Browser now: {effective(valueProperty)}</p>{/if}<button type="button" disabled={!canStyle || !ownStyle(valueProperty) || ownStyle(valueProperty)?.type==='binding' || unsupportedTarget} onclick={()=>changeStyle(valueProperty)}>Reset setting</button>{#if !ownStyle(valueProperty) && display(valueProperty)}<button type="button" disabled={unsupportedTarget} onclick={()=>changeStyle(valueProperty,{type:'text',value:display(valueProperty)})}>Override preview value</button>{/if}{/if}
                    <label>Use named value<select aria-label="Named style value" value={ownStyle(valueProperty)?.type==='token'?(ownStyle(valueProperty) as {id:string}).id:''} disabled={unsupportedTarget || !canStyle || ownStyle(valueProperty)?.type==='binding'} onchange={event=>{if(namedValues.includes(event.currentTarget.value))changeStyle(valueProperty,{type:'token',id:event.currentTarget.value});}}><option value="">Choose a named value…</option>{#each namedValues as id}<option value={id}>{id} · {document.tokens[id]?.value}</option>{/each}</select></label>{#if !namedValues.length}<p>No named values declared. Define them in Document → Source → tokens.</p>{/if}
                  {:else if page==='custom'}<CustomSettings {document} attributeNodeId={node.kind==='element' && !(shared && scope==='instance')?node.id:undefined} disabled={unsupportedTarget || !canStyle} blockedProperties={valueProperties.map(property=>property.id)} blockedAttributes={simpleText?[]:node.kind==='element' && ['input','textarea'].includes(node.tag)?['value','placeholder','aria-label']:nativeFields.map(field=>field.name)} readStyle={ownStyle} {origin} onStyle={changeStyle} onAttribute={(name,value)=>node.kind==='element'?onApply(setAttribute({requestId:request(),nodeId:node.id,name,...(value===undefined?{}:{value})})):false} onDraftChange={textDraftChange}/>
                  {:else if page==='details'}
                    <dl class="technical"><dt>Source node</dt><dd>{node.id}</dd><dt>Kind</dt><dd>{node.kind}</dd><dt>Component path</dt><dd>{report?.instancePath.map(step=>`${step.sourceNodeId}@${step.definitionId}`).join(' / ') || 'None'}</dd><dt>Repeat keys</dt><dd>{report?.repeatKeys.join(' / ') || 'None'}</dd><dt>Portal ownership</dt><dd>{JSON.stringify(report?.portalPath)}</dd></dl>
                    {#if componentDescriptor}<p>{componentDescriptor.id} · revision {componentDescriptor.revision}</p>{#each componentDescriptor.outputs ?? [] as output}<p><strong>{output.name}</strong> · {output.payload}<br/>{output.description ?? 'Declared component event.'}</p>{/each}{/if}
                  {:else}{#if shared}<label>Edits apply to<select aria-label="Edits apply to" bind:value={scope}><option value="shared">Shared component</option><option value="instance">This instance · wrapper</option></select></label><p>{count} authored instances. Shared source edits affect every occurrence.</p>{:else}<p>Source element · {location.join(' / ')}</p>{/if}{#if componentDescriptor}<p>{componentDescriptor.id} · revision {componentDescriptor.revision}. Styling targets {componentDescriptor.styleTargets?.join(', ') || 'no exposed part'}. {componentDescriptor.inspectionLimits?.join(' ')}</p>{/if}<p>Canonical source and declarations are in Document → Source.</p>{/if}
                {/snippet}
              </ToolPages>
            {:else}
              {@const pages=stylePageSets[category] ?? []}
              <ToolPages {pages} label={`${category} pages`} locked={textDraftDirty}>{#snippet children(page)}
                {#if page==='padding' || page==='margin'}<InspectorSpacing compact type={page} value={display} {effective} {origin} authored={property=>ownStyle(property)!==undefined} locked={property=>ownStyle(property)?.type==='binding'} disabled={unsupportedTarget} onChange={changeStyles} onReset={properties=>changeStyles(properties.map(property=>({property})))}/>
                {:else}<div class="compact-grid">{#each allControls.filter(control=>pages.find(entry=>entry.id===page)?.properties.includes(control.property)) as control}{#key `${target}:${condition}:${pseudo}:${control.property}`}<InspectorControl compact label={control.label} kind={control.kind} value={display(control.property)} options={'options' in control?control.options:[]} disabled={unsupportedTarget || ownStyle(control.property)?.type==='binding'} onChange={value=>changeStyle(control.property,{type:'text',value})} onReset={()=>changeStyle(control.property)}/>{/key}{/each}</div>{/if}
                <p class="rule-context">{styleConditions.find(c=>c.id===condition)?.label ?? (condition || 'All sizes')} · {pseudo || 'normal'}</p>
              {/snippet}</ToolPages>
            {/if}
          {/snippet}
        </ToolPages>
      {/if}
    {:else}
    <div>
    {#if tab === 'Content'}
      <section><h3>Content</h3>
        {#if node.kind === 'element' && ['input','textarea'].includes(node.tag)}
          <NativeInputContent showStateInitial={!contextual} {document} {node} references={refs('string')} {referenceLabels} {labels} disabled={shared && scope === 'instance'} {onApply} />
        {:else if textNode?.kind === 'text' && textNode.content.type === 'literal'}
          <label>Text content<textarea aria-label="Text content" bind:value={text} disabled={shared && scope === 'instance'} rows="4"></textarea></label>
          {#if shared}<p>Text edits change the shared source. This instance cannot replace definition text.</p>{/if}
          <button type="button" class="primary" disabled={shared && scope === 'instance'} onclick={() => onApply(setTextLiteral({ requestId: request(), nodeId: textNode.id, value: text }))}>Apply text</button>
        {:else if textNode?.kind === 'text'}<p>Text comes from a binding. Edit its expression in {contextual ? 'Document → Source' : 'Advanced'}; literal editing would replace that binding.</p>
          {:else if !componentNode}<p>{container ? 'Arrange this container and style its children.' : 'No direct text content. Expand this element in Layers to select its content.'}</p>{#if container}<button type="button" onclick={() => tab = 'Style'}>Edit layout and spacing</button>{/if}{/if}
      </section>
      {#if componentNode && componentDescriptor}
        <section><h3>Component properties</h3>
            <details><summary>Component details</summary><p class="muted">Descriptor {componentDescriptor.id} · revision {componentDescriptor.revision}.</p></details>
          {#each componentDescriptor.props as propDecl (propDecl.name)}
            {@const ownedBySlot = slotOwnedLabelSlot(componentDescriptor.id, propDecl.name, componentNode)}
            {#key `${componentNode.id}:${propDecl.name}`}
              <ExpressionEditor label={propDecl.name} displayLabel={friendly(propDecl.name)} {referenceLabels} type={propDecl.type} value={componentNode.props?.[propDecl.name]}
                defaultValue={propDecl.default} references={refs(propDecl.type)} onCommit={expression => applyProp(propDecl.name, expression)} />
              {#if !contextual}<StateInitialEditor {document} expression={componentNode.props?.[propDecl.name]} {labels} {onApply} />{/if}
              {#if ownedBySlot}<p class="muted">Shown from the “{ownedBySlot}” slot content while that slot is filled; this value is the fallback text.</p>{/if}
            {/key}
          {/each}
        </section>
      {/if}
      {#if componentNode && componentDescriptor && !contextual}
        <ComponentComposition {document} node={componentNode} descriptor={componentDescriptor} {onApply} {labels} />
      {/if}
    {:else if tab === 'Style'}
      {#if componentDescriptor}
        <p>Instance styling targets {componentDescriptor.styleTargets?.[0] ?? 'no exposed part'}. {componentDescriptor.inspectionLimits?.join(' ') ?? ''}</p>
      {/if}
      {@render styleContext()}
      {#if canStyle}
        {#key `${target}:${container}`}{#each shownGroups as group, index}<details class="style-group" open={contextual || index < 2}><summary>{group.title}</summary><section>
          {#if group.title === 'Size & spacing'}{#each ['padding', 'margin'] as type}{#key `${target}:${condition}:${pseudo}:${type}`}<InspectorSpacing type={type as 'padding' | 'margin'} value={display} {effective} {origin} authored={p => ownStyle(p) !== undefined} locked={p => ownStyle(p)?.type === 'binding'} disabled={unsupportedTarget} onChange={changeStyles} onReset={properties => changeStyles(properties.map(property => ({ property })))} />{/key}{/each}{/if}
          {#each group.controls as control}
            {@const own = editableStyle(document, target, control.property, condition || undefined, pseudo)}
            {#key `${target}:${condition}:${pseudo}:${control.property}`}<InspectorControl label={control.label} kind={control.kind} value={display(control.property)} authored={own !== undefined} origin={origin(control.property)} originLabel={originLabel(control.property)} effective={effective(control.property)} options={'options' in control ? control.options : []} disabled={unsupportedTarget || own?.type === 'binding'} onChange={v => changeStyle(control.property, { type: 'text', value: v })} onReset={() => changeStyle(control.property)} />{/key}
          {/each}
        </section></details>{/each}{/key}
      {:else}<section><p>Select an element or component to style it. Text appearance is controlled by its containing element.</p></section>{/if}
    {:else}
      {#if node.kind === 'element'}<section><h3>When clicked</h3>
        {#if node.kind === 'element'}
          <label>Declared action<select aria-label="Declared action" value={action} onchange={e => action = e.currentTarget.value}><option value="">Choose an action…</option>{#each knownActionIds as id}<option value={id}>{labels.actions?.[id] ?? id}</option>{/each}</select></label>
          <button type="button" disabled={!knownActionIds.includes(action)} onclick={() => onApply(connectInteraction({ requestId: request(), nodeId: node.id, interaction: { on: 'click', action: 'invokeAction', actionId: action, ...(node.interactions?.find(i => i.on === 'click' && i.action === 'invokeAction')?.action === 'invokeAction' ? { input: (node.interactions.find(i => i.on === 'click' && i.action === 'invokeAction') as { input?: Readonly<Record<string, import('@victframework/ui').UiExpression>> }).input } : {}) } }))}>Connect action</button>
          {#if !knownActionIds.length}<p>No declared actions supplied by the host.</p>{/if}
          {#if knownRouteIds.length}<label>Destination<select aria-label="Route id" value={route} onchange={e => route = e.currentTarget.value}><option value="">Choose…</option>{#each knownRouteIds as id}<option value={id}>{labels.routes?.[id] ?? id}</option>{/each}</select></label><button type="button" disabled={!knownRouteIds.includes(route)} onclick={connectRoute}>Connect navigation</button>{/if}
          <p>Connecting replaces the existing click interaction. {shared ? 'Behavior edits change shared source.' : ''}</p>
        {/if}
      </section>{/if}
      {#if componentNode && componentDescriptor && (componentDescriptor.outputs?.length ?? 0) > 0}
        <section><h3>Connections</h3>
          {#each componentDescriptor.outputs as output (output.name)}
            {@const binding = outputBindingRaw(output.name)}
            <div class="output-row">
              <strong>{outputTitle(output.name)}</strong>
              {#if binding}<p class="connection-summary">→ {'invokeAction' in binding ? labels.actions?.[binding.invokeAction.actionId] ?? binding.invokeAction.actionId : labels.state?.[binding.setState.key] ?? binding.setState.key}</p>{/if}
              <details><summary>Event details</summary><p>{output.name} ({output.payload}) · {output.description ?? 'Declared component event.'}</p></details>
              {#if output.payload !== 'void'}
                <label>Update state
                  <select aria-label={`${output.name} state target`} value={binding && 'setState' in binding ? binding.setState.key : ''}
                    onchange={event => applySetStateBinding(output.name, event.currentTarget.value)}>
                    <option value="">Choose a state key…</option>
                    {#each stateKeysTyped.filter(entry => entry.type === output.payload) as entry (entry.key)}<option value={entry.key}>{labels.state?.[entry.key] ?? entry.key}</option>{/each}
                  </select>
                </label>
              {/if}
              <label>Run action
                <select aria-label={`${output.name} action`} value={binding && 'invokeAction' in binding ? binding.invokeAction.actionId : ''}
                  onchange={event => applyActionBinding(output.name, event.currentTarget.value)}>
                  <option value="">Choose an action…</option>
                  {#each knownActionIds as id (id)}<option value={id}>{labels.actions?.[id] ?? id}</option>{/each}
                </select>
              </label>
              {#if binding && 'invokeAction' in binding}
                {@const declaredInputs = actionInputs[binding.invokeAction.actionId]}
                {#if declaredInputs === undefined}<p>Static input types are unavailable. Existing mappings are preserved; runtime contracts validate execution.</p>{/if}
                {#each Object.entries(declaredInputs ?? {}) as [name, type] (name)}
                  <ExpressionEditor label={`${output.name} input ${name}`} displayLabel={labels.actionInputs?.[name] ?? friendly(name)} {referenceLabels} {type} value={binding.invokeAction.input?.[name]}
                    references={refs(type, output.payload)} onCommit={expression => mapInput(output.name, name, expression)} />
                {/each}
                {#each Object.entries(binding.invokeAction.input ?? {}).filter(([name]) => declaredInputs?.[name] === undefined) as [name, expression] (name)}
                  <p>{name}: {expression.type === 'ref' ? expression.path : expression.type === 'literal' ? String(expression.value) : 'Computed expression'}</p>
                  <button type="button" onclick={() => mapInput(output.name, name)}>Remove {name} mapping</button>
                {/each}
              {:else if binding && 'setState' in binding && binding.setState.value}
                <ExpressionEditor label={`${output.name} state value`} type={output.payload === 'void' ? 'string' : output.payload}
                  value={binding.setState.value} references={refs(output.payload, output.payload)}
                  onCommit={expression => commitBinding(output.name, { setState: { key: binding && 'setState' in binding ? binding.setState.key : '', value: expression } })} />
              {/if}
              {#if binding}<button type="button" onclick={() => clearBinding(output.name)}>Remove connection</button>{/if}
            </div>
          {/each}
        </section>
      {:else if componentNode && componentDescriptor}
        <section><h3>Component outputs</h3><p class="muted">{componentDescriptor.id} declares no outputs.</p></section>
      {/if}
    {/if}
    {#if !contextual}<details class="advanced"><summary>Advanced · source & declarations</summary><section>
      <dl><dt>Source node</dt><dd>{node.id}</dd><dt>Component path</dt><dd>{report?.instancePath.map(p => `${p.sourceNodeId}@${p.definitionId}`).join(' / ') || 'None'}</dd><dt>Repeat record keys</dt><dd>{report?.repeatKeys.join(' / ') || 'None'}</dd><dt>Portal ownership</dt><dd>{JSON.stringify(report?.portalPath)}</dd></dl>
      {#if canStyle}<label>CSS property<input aria-label="Style property" bind:value={property} /></label><label><input type="checkbox" bind:checked={token} /> Use token</label>
        {#if token}<label>Token<select aria-label="Token id" bind:value={value}><option value="">Choose…</option>{#each knownTokenIds as id}<option value={id}>{id}</option>{/each}</select></label>{:else}<label>CSS value<input aria-label="Style value" bind:value={value} /></label>{/if}
        <p>{origin(property)}</p><button type="button" disabled={!value.trim() || !property.trim() || unsupportedTarget} onclick={() => changeStyle(property, token ? { type: 'token', id: value } : { type: 'text', value: value.trim() })}>Apply style</button><button type="button" disabled={!editableStyle(document, target, property, condition || undefined, pseudo) || unsupportedTarget} onclick={() => changeStyle(property)}>Reset declaration</button>
      {/if}
      {#if node.kind === 'element'}<label>Attribute name<input aria-label="Attribute name" bind:value={attr} /></label><label>Attribute value<input aria-label="Attribute value" bind:value={attrValue} /></label><button type="button" onclick={() => onApply(setAttribute({ requestId: request(), nodeId: node.id, name: attr, value: attrValue }))}>Set attribute</button>{/if}
      <h3>Canonical source (read only)</h3><pre>{JSON.stringify(node, null, 2)}</pre>
    </section></details>{/if}
    </div>
    {/if}
  {/if}
  {#if lastIssues.length}<section role="alert" class="issues"><strong>Change rejected · source unchanged</strong>{#each lastIssues as issue}<p>{issue.code}: {issue.message}</p>{/each}</section>{/if}
</aside>

<style>
  .ux-panel { background: var(--ui-editor-panel, #f8f9fb); color: var(--ui-editor-ink, #202938); font: 12px/1.5 var(--ui-editor-font, 'Segoe UI', sans-serif); min-width: 0; width: 100%; height: 100%; overflow: auto; box-sizing: border-box; }
  header, section, .scope { padding: var(--ui-editor-section-padding, 10px 14px); min-width: 0; }
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
  .muted { color: var(--ui-editor-muted, #667085); font-size: 11px; }
  .style-conflict {background:#fff5df;border-block:1px solid #ebd5a4;}
  .connection-summary {color:var(--ui-editor-accent,#355cc9);font-weight:600;}
  .output-row { border: 1px solid var(--ui-editor-line, #d7dce5); border-radius: 5px; padding: 6px 8px; margin: 6px 0; background: var(--ui-editor-input, #fff); }
  .issues { background: #fff0ef; }
  .contextual {height:auto;min-height:0;overflow:visible;background:#fff;font-size:11px;--ui-editor-section-padding:6px 2px;}
  .contextual .selection-bar {position:static;box-shadow:none;}
  .group-values {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;font-size:11px;margin:6px 0;}.technical {font-size:11px;}
  .content-boundary {border:0;padding:0;margin:0;min-width:0;}.content-boundary.full {height:auto;}
  .compact-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 10px;}.rule-context {font-size:10px;color:#8a96a8;} .contextual button {padding:4px 7px;font-size:11px;margin:2px 3px 2px 0;}.contextual label {margin:3px 0;font-size:11px;}.contextual label select {padding:4px 6px;min-height:27px;font-size:11px;}
  .contextual h3 {font-size:11px;margin-bottom:5px;}
</style>
