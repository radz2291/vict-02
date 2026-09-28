<script lang="ts">
  /**
   * A real custom Svelte component used as the registered code island in
   * the record-context tests: it renders its props (so bindings are
   * observable in the DOM) and can dispatch a declared action with NO
   * explicit input (so the surface's declared input binding is what
   * supplies the dispatch input).
   */
  import { useVictActions } from '@victframework/ui-svelte/component-actions';

  let {
    paramValue,
    recordValue,
    viewValue,
    actionId,
  }: {
    paramValue?: string;
    recordValue?: unknown;
    viewValue?: readonly unknown[];
    actionId?: string;
  } = $props();

  const actions = useVictActions();
  let dispatched = $state<unknown>(null);

  async function dispatch(): Promise<void> {
    const result = await actions.run(actionId ?? 'act.create');
    dispatched = result;
  }
</script>

<div data-testid="record-island" data-param={paramValue ?? ''} data-record={JSON.stringify(recordValue ?? null)}>
  <span data-testid="island-param">{paramValue ?? ''}</span>
  <span data-testid="island-record">{JSON.stringify(recordValue ?? null)}</span>
  <span data-testid="island-view">{JSON.stringify(viewValue ?? null)}</span>
  <button type="button" data-testid="island-dispatch" onclick={() => void dispatch()}>Run</button>
  <span data-testid="island-dispatched">{dispatched === null ? '' : JSON.stringify(dispatched)}</span>
</div>