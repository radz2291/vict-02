<script lang="ts">
  /**
   * Renders ONE neutral surface. Simple roles render inline; nested
   * surfaces (tabs/dialogs/drawers) render through the recursive
   * `renderSurface` snippet so behavior stays identical at every depth.
   * Complex interactive roles delegate to dedicated components.
   */
  import type { ComponentRegistry } from '@vict/application/renderer';
  import type { VictPlanView, PlanSurface } from './logic.js';
  import { isVisible, isDisabled, headingTagForLevel, type ViewDatum, type ActionResult } from './logic.js';
  import RecordsTable from './RecordsTable.svelte';
  import ChartSurface from './ChartSurface.svelte';
  import ConversationSurface from './ConversationSurface.svelte';
  import FormSurface from './FormSurface.svelte';
  import OverlaySurface from './OverlaySurface.svelte';
  
  interface Props {
    surface: PlanSurface;
    plan: VictPlanView;
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

  let activeTabs = $state<Record<string, number>>({});

  function tabsActive(sn: PlanSurface): number {
    const tabs = Array.isArray(sn.tabs) ? sn.tabs.length : 0;
    const active = activeTabs[String(sn.id)] ?? 0;
    return Math.min(active, Math.max(tabs - 1, 0));
  }

  function selectTab(sn: PlanSurface, index: number): void {
    activeTabs = { ...activeTabs, [String(sn.id)]: index };
  }

  function tabsKeydown(event: KeyboardEvent, sn: PlanSurface): void {
    const count = Array.isArray(sn.tabs) ? sn.tabs.length : 0;
    if (count === 0) {
      return;
    }
    let next = tabsActive(sn);
    if (event.key === 'ArrowRight') {
      next = (next + 1) % count;
    } else if (event.key === 'ArrowLeft') {
      next = (next - 1 + count) % count;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = count - 1;
    } else {
      return;
    }
    event.preventDefault();
    selectTab(sn, next);
    const tabs = (event.currentTarget as HTMLElement | null)?.parentElement;
    const target = tabs?.querySelectorAll('[role="tab"]')[next];
    if (target instanceof HTMLElement) {
      target.focus();
    }
  }

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
        <p class="vict-state" data-surface={sn.id} data-state="empty">Nothing here yet.</p>
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
        <p class="vict-state" data-surface={sn.id} data-state="empty">
          {str(sn.emptyMessage) || 'Nothing here yet.'}
        </p>
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
      <RecordsTable
        surface={sn}
        {plan}
        initialRows={viewRows(sn.viewId)}
        {dispatch}
        {onInvalidate}
      />
    {:else if sn.role === 'detail'}
      {@const row = viewRecord(sn.viewId)}
      {@const fields =
        Array.isArray(sn.fields) && sn.fields.length > 0
          ? (sn.fields as readonly string[])
          : viewFieldNames(sn.viewId)}
      {#if row === null || row === undefined}
        <p class="vict-state" data-surface={sn.id} data-state="empty">
          {str(sn.emptyMessage) || 'This record does not exist.'}
        </p>
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
      <button
        type="button"
        class="vict-btn"
        class:vict-btn--danger={str(sn.actionId).includes('delete')}
        data-surface={sn.id}
        data-action-kind={str(action?.kind) || 'unknown'}
        data-action-id={str(sn.actionId)}
        {disabled}
        onclick={() => {
          void run(str(sn.actionId));
        }}
      >
        {str(sn.label)}
      </button>
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
        <p class="vict-alert" role="alert" data-surface={sn.id}>
          The custom component could not be resolved.
        </p>
      {/if}
    {:else if sn.role === 'status'}
      {@const value =
        typeof sn.value === 'string'
          ? sn.value
          : String((record ?? {})[str(sn.field)] ?? '')}
      {@const tones = (sn.tones ?? {}) as Record<string, string>}
      {@const tone = typeof tones[value] === 'string' ? tones[value] : 'neutral'}
      <span class="vict-status vict-status--{tone}" data-surface={sn.id} role="status">
        {value === '' ? '—' : value}
      </span>
    {:else if sn.role === 'chart'}
      <ChartSurface surface={sn} rows={viewRows(sn.viewId)} />
    {:else if sn.role === 'tabs'}
      <div class="vict-tabs" data-surface={sn.id}>
        <div class="vict-tablist" role="tablist" aria-label={str(sn.id)}>
          {#each (sn.tabs ?? []) as tab, index (tab.name)}
            <button
              type="button"
              role="tab"
              id="vict-tab-{sn.id}-{tab.name}"
              aria-selected={tabsActive(sn) === index}
              aria-controls="vict-tabpanel-{sn.id}-{tab.name}"
              tabindex={tabsActive(sn) === index ? 0 : -1}
              onkeydown={(event) => tabsKeydown(event, sn)}
              onclick={() => selectTab(sn, index)}
            >
              {str(tab.label)}
            </button>
          {/each}
        </div>
        {#each (sn.tabs ?? []) as tab, index (tab.name)}
          <div
            class="vict-tabpanel"
            role="tabpanel"
            id="vict-tabpanel-{sn.id}-{tab.name}"
            aria-labelledby="vict-tab-{sn.id}-{tab.name}"
            hidden={tabsActive(sn) !== index}
          >
            {#each tab.surfaces ?? [] as nested (nested.id)}
              {@render renderSurface(nested)}
            {/each}
          </div>
        {/each}
      </div>
    {:else if sn.role === 'dialog' || sn.role === 'drawer'}
      <OverlaySurface
        surface={sn}
        {plan}
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
