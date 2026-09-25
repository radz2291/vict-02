<script lang="ts">
  /**
   * Renders ONE neutral surface. Simple roles render inline; nested
   * surfaces (tabs/dialogs/drawers) render through the recursive
   * `renderSurface` snippet so behavior stays identical at every depth.
   * Complex interactive roles delegate to dedicated components.
   */
  import type { ComponentRegistry } from '@victframework/application/renderer';
  import type { VictPlanView, PlanSurface } from './logic.js';
  import type { UiPlan, UiStatusTone } from '@victframework/ui';
  import { Button, Feedback, StatusBadge, Tabs } from '@victframework/ui-svelte';
  import { isVisible, isDisabled, headingTagForLevel, type ViewDatum, type ActionResult } from './logic.js';
  import TableAdapter from './TableAdapter.svelte';
  import ChartSurface from './ChartSurface.svelte';
  import ConversationSurface from './ConversationSurface.svelte';
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
    run: (actionId: string, input?: unknown) => Promise<void>;
    dispatch: (actionId: string, input?: unknown) => Promise<ActionResult>;
    onInvalidate?: () => void;
    navigate?: (path: string) => void;
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
    onInvalidate,
    navigate,
  }: Props = $props();

  const visible = $derived(isVisible(surface, context));

  function viewRows(viewId: unknown): readonly Record<string, unknown>[] {
    const datum = viewData[String(viewId)];
    return datum?.rows ?? [];
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

  function resolveComponent(sn: PlanSurface): { Component: unknown } | undefined {
    const resolved = registry.resolve({
      componentId: str(sn.componentId),
      revision: str(sn.revision),
    });
    if (!resolved.ok) {
      return undefined;
    }
    return { Component: resolved.implementation };
  }
</script>

{#snippet renderSurface(sn: PlanSurface)}
  {#if isVisible(sn, context)}
    {#if sn.role === 'text'}
      {@const headingTag = headingTagForLevel(sn.level)}
      {#if headingTag !== null}
        <!-- The tag name comes ONLY from the compiler-validated closed
             heading vocabulary (logic.ts HEADING_TAGS) — never arbitrary. -->
        <svelte:element this={headingTag} class="vict-text" data-surface={sn.id}>{String(sn.content)}</svelte:element>
      {:else}
        <p class="vict-text" data-surface={sn.id}>{String(sn.content)}</p>
      {/if}
    {:else if sn.role === 'view'}
      {@const rows = viewRows(sn.viewId)}
      {@const fields = viewFieldNames(sn.viewId)}
      {#if rows.length === 0}
        <Feedback kind="empty" message="Nothing here yet." surfaceId={sn.id} />
      {:else}
        <div class="vict-table-wrap" data-surface={sn.id} role="region" aria-label="Data table">
          <table class="vict-table">
            <thead>
              <tr>
                {#each fields as field (field)}
                  <th scope="col">{field}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each rows as row, index (index)}
                <tr>
                  {#each fields as field (field)}
                    <td>{String(row[field] ?? '')}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {:else if sn.role === 'list'}
      {@const rows = viewRows(sn.viewId)}
      {#if rows.length === 0}
        <Feedback kind="empty" message={str(sn.emptyMessage) || 'Nothing here yet.'} surfaceId={sn.id} />
      {:else}
        <ul class="vict-list" data-surface={sn.id}>
          {#each rows as row, index (index)}
            <li class="vict-list-item">
              <strong>{String(row[str(sn.titleField)] ?? '')}</strong>
              {#if typeof sn.secondaryField === 'string'}
                <span> — {String(row[sn.secondaryField] ?? '')}</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    {:else if sn.role === 'table'}
      <TableAdapter
        surface={sn}
        intent={uiPlan.tables[sn.id]}
        initialRows={viewRows(sn.viewId)}
        {dispatch}
      />
    {:else if sn.role === 'detail'}
      {@const row = viewRecord(sn.viewId)}
      {@const fields =
        Array.isArray(sn.fields) && sn.fields.length > 0
          ? (sn.fields as readonly string[])
          : viewFieldNames(sn.viewId)}
      {#if row === null || row === undefined}
        <Feedback kind="empty" message={str(sn.emptyMessage) || 'This record does not exist.'} surfaceId={sn.id} />
      {:else}
        <dl class="vict-detail" data-surface={sn.id}>
          {#each fields as field (field)}
            <div class="vict-detail-row">
              <dt>{field}</dt>
              <dd>{String(row[field] ?? '')}</dd>
            </div>
          {/each}
        </dl>
      {/if}
    {:else if sn.role === 'form'}
      <FormSurface surface={sn} {plan} {run} values={record ?? {}} identity={params.id} />
    {:else if sn.role === 'action'}
      {@const action = plan.actions?.[str(sn.actionId)]}
      {@const disabled = isDisabled(sn, params)}
      <Button label={str(sn.label)} variant={str(sn.actionId).includes('delete') ? 'danger' : 'primary'}
        surfaceId={sn.id} actionKind={str(action?.kind) || 'unknown'} actionId={str(sn.actionId)}
        {disabled} onclick={() => { void run(str(sn.actionId)); }} />
    {:else if sn.role === 'component'}
      {@const resolved = resolveComponent(sn)}
      {#if resolved !== undefined}
        <div
          class="vict-component-slot"
          data-surface={sn.id}
          data-component={str(sn.componentId)}
        >
          <resolved.Component {...((sn.props ?? {}) as Record<string, never>)} />
        </div>
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
      <ChartSurface surface={sn} rows={viewRows(sn.viewId)} />
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
        {onInvalidate}
        {navigate}
      />
    {:else if sn.role === 'conversation'}
      <ConversationSurface
        surface={sn}
        {plan}
        initialRows={viewRows(sn.viewId)}
        {dispatch}
        {onInvalidate}
      />
    {:else if sn.role === 'states'}
      <span data-surface={sn.id} class="vict-states-marker" hidden aria-hidden="true"></span>
    {/if}
  {/if}
{/snippet}

{#if visible}
  {@render renderSurface(surface)}
{/if}

<style>
  .vict-detail {
    margin: 0;
    display: grid;
    gap: calc(var(--vict-spacing-unit) * 2);
  }

  .vict-detail-row {
    display: grid;
    grid-template-columns: 10rem 1fr;
    gap: calc(var(--vict-spacing-unit) * 2);
    padding-bottom: calc(var(--vict-spacing-unit) * 1);
    border-bottom: 1px solid var(--vict-color-border);
  }

  .vict-detail dt {
    font-weight: 600;
    color: var(--vict-color-textMuted);
  }

  .vict-detail dd {
    margin: 0;
  }
</style>
