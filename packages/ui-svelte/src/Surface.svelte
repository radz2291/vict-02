<script lang="ts">
  /**
   * Interprets ONE neutral surface. Application bindings and recursive
   * traversal stay here; presentation is delegated to ui-svelte.
   */
  import type { ComponentRegistry } from '@victframework/application/renderer';
  import type { VictPlanView, PlanSurface } from './logic.js';
  import type { UiPlan, UiStatusTone } from '@victframework/ui';
  import ActionButton from './ActionButton.svelte';
  import Chart from './Chart.svelte';
  import ComponentSlot from './ComponentSlot.svelte';
  import Conversation from './Conversation.svelte';
  import DataView from './DataView.svelte';
  import Detail from './Detail.svelte';
  import Feedback from './Feedback.svelte';
  import List from './List.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import Tabs from './Tabs.svelte';
  import Text from './Text.svelte';
  import { isVisible, isDisabled, headingTagForLevel, type ViewDatum, type ActionResult } from './logic.js';
  import { chartPoints, conversationMessages, detailFields, displayRows, listItems } from './presentation.js';
  import TableAdapter from './TableAdapter.svelte';
  import FormSurface from './FormSurface.svelte';
  import OverlaySurface from './OverlaySurface.svelte';
  
  interface Props {
    surface: PlanSurface;
    plan: VictPlanView;
    uiPlan: UiPlan;
    registry: ComponentRegistry;
    context: {
      readonly params: Readonly<Record<string, string>>;
      readonly viewRowCount: (viewId: string) => number;
    };
    params: Readonly<Record<string, string>>;
    viewData: Readonly<Record<string, ViewDatum>>;
    record: Record<string, unknown> | null;
    run: (actionId: string, input?: unknown) => Promise<ActionResult | void>;
    dispatch: (actionId: string, input?: unknown) => Promise<ActionResult>;
    sendConversation: (actionId: string, text: string) => Promise<ActionResult>;
  }

  let {
    surface,
    plan,
    uiPlan,
    registry,
    context,
    params,
    viewData,
    record,
    run,
    dispatch,
    sendConversation,
  }: Props = $props();

  const visible = $derived(isVisible(surface, context));

  function viewRows(viewId: unknown): readonly Record<string, unknown>[] {
    const datum = viewData[String(viewId)];
    return datum?.rows ?? [];
  }

  function runComponentAction(actionId: string, input?: unknown): Promise<ActionResult | void> {
    if (!plan.actions?.[actionId]) {
      return Promise.resolve({
        ok: false,
        code: 'UNKNOWN_ACTION',
        message: 'This action is not declared by the application.',
      });
    }
    return run(actionId, input);
  }

  function viewRecord(viewId: unknown): Record<string, unknown> | null {
    const datum = viewData[String(viewId)];
    if (datum?.record !== undefined && datum.record !== null) {
      return datum.record;
    }
    return record;
  }

  function viewFieldNames(viewId: unknown): readonly string[] {
    const view = plan.views?.[String(viewId)] as { fields?: readonly string[] } | undefined;
    return view?.fields ?? [];
  }

  function str(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  function statusTone(value: unknown): UiStatusTone {
    return value === 'success' || value === 'warning' || value === 'danger' || value === 'info'
      ? value : 'neutral';
  }

  function resolveComponent(sn: PlanSurface): { Component: import('svelte').Component<Record<string, never>> } | undefined {
    const resolved = registry.resolve({
      componentId: str(sn.componentId),
      revision: str(sn.revision),
    });
    if (!resolved.ok) {
      return undefined;
    }
    return { Component: resolved.implementation as import('svelte').Component<Record<string, never>> };
  }
</script>

{#snippet renderSurface(sn: PlanSurface)}
  {#if isVisible(sn, context)}
    {#if sn.role === 'text'}
      <Text surfaceId={sn.id} content={String(sn.content)} tag={headingTagForLevel(sn.level) ?? 'p'} />
    {:else if sn.role === 'view'}
      {@const fields = viewFieldNames(sn.viewId)}
      <DataView surfaceId={sn.id} columns={fields} rows={displayRows(viewRows(sn.viewId), fields)} />
    {:else if sn.role === 'list'}
      <List surfaceId={sn.id} items={listItems(viewRows(sn.viewId), str(sn.titleField),
        typeof sn.secondaryField === 'string' ? sn.secondaryField : undefined)}
        emptyMessage={str(sn.emptyMessage) || 'Nothing here yet.'} />
    {:else if sn.role === 'table'}
      <TableAdapter
        surface={sn}
        intent={uiPlan.tables[sn.id]!}
        initialRows={viewRows(sn.viewId)}
        {dispatch}
      />
    {:else if sn.role === 'detail'}
      {@const row = viewRecord(sn.viewId)}
      {@const fields =
        Array.isArray(sn.fields) && sn.fields.length > 0
          ? (sn.fields as readonly string[])
          : viewFieldNames(sn.viewId)}
      <Detail surfaceId={sn.id} fields={detailFields(row, fields)}
        emptyMessage={str(sn.emptyMessage) || 'This record does not exist.'} />
    {:else if sn.role === 'form'}
      <FormSurface surface={sn} {plan} {run} values={record ?? {}} identity={params.id} />
    {:else if sn.role === 'action'}
      <ActionButton surface={sn} {plan} disabled={isDisabled(sn, params)} {run} />
    {:else if sn.role === 'component'}
      {@const resolved = resolveComponent(sn)}
      {#if resolved !== undefined}
        <ComponentSlot surfaceId={sn.id} componentId={str(sn.componentId)} run={runComponentAction}>
          <resolved.Component {...((sn.props ?? {}) as Record<string, never>)} />
        </ComponentSlot>
      {:else}
        <Feedback kind="error" message="The custom component could not be resolved." surfaceId={sn.id} />
      {/if}
    {:else if sn.role === 'status'}
      {@const value =
        typeof sn.value === 'string'
          ? sn.value
          : String((record ?? {})[str(sn.field)] ?? '')}
      {@const tones = (sn.tones ?? {}) as Record<string, string>}
      <StatusBadge {value} tone={statusTone(tones[value])} surfaceId={sn.id} />
    {:else if sn.role === 'chart'}
      <Chart surfaceId={sn.id} title={typeof sn.title === 'string' ? sn.title : undefined}
        summary={str(sn.summary)} kind={str(sn.kind) === 'line' ? 'line' : 'bar'}
        xLabel={str(sn.xField)} yLabel={str(sn.yField)}
        points={chartPoints(viewRows(sn.viewId), str(sn.xField), str(sn.yField))} />
    {:else if sn.role === 'tabs'}
      {@const tabs = (sn.tabs ?? []) as readonly { name: string; label: string; surfaces?: readonly PlanSurface[] }[]}
      {#snippet tabPanel(index: number)}
        {#each tabs[index]?.surfaces ?? [] as nested (nested.id)}
          {@render renderSurface(nested)}
        {/each}
      {/snippet}
      <Tabs surfaceId={sn.id} tabs={tabs.map((tab) => ({ name: tab.name, label: tab.label }))} panel={tabPanel} />
    {:else if sn.role === 'dialog' || sn.role === 'drawer'}
      <OverlaySurface
        surface={sn}
        {plan}
        {uiPlan}
        {registry}
        {context}
        {params}
        {viewData}
        {record}
        {run}
        {dispatch}
        {sendConversation}
      />
    {:else if sn.role === 'conversation'}
      {@const view = plan.views?.[String(sn.viewId)] as { emptyMessage?: string } | undefined}
      <Conversation surfaceId={sn.id}
        messages={conversationMessages(viewRows(sn.viewId), str(sn.messageField), str(sn.authorField), str(sn.participantField))}
        emptyMessage={str(sn.emptyMessage) || str(view?.emptyMessage) || 'No messages yet. Say hello!'}
        inputLabel={str(sn.inputLabel)} inputPlaceholder={str(sn.inputPlaceholder)}
        onSend={(text) => sendConversation(str(sn.sendActionId), text)} />
    {:else if sn.role === 'states'}
      <span data-surface={sn.id} class="vict-states-marker" hidden aria-hidden="true"></span>
    {/if}
  {/if}
{/snippet}

{#if visible}
  {@render renderSurface(surface)}
{/if}
