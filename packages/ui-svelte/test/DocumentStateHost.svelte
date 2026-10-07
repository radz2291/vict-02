<script lang="ts">
  import type { UiLocalStateDecl, UiRenderPlan } from '@victframework/ui';
  import DocumentHost from '../src/document/DocumentHost.svelte';
  let { plan, localState, diagnostic }: { plan: UiRenderPlan; localState: Readonly<Record<string, UiLocalStateDecl>>; diagnostic: (value: { code: string; detail?: Readonly<Record<string, unknown>> }) => void } = $props();
  let values = $state<Readonly<Record<string, string | number | boolean>>>({ busy: false });
  let signal = $state<symbol | undefined>();
  export function update(next: Readonly<Record<string, string | number | boolean>>, reset = false): void {
    values = next;
    if (reset) signal = Symbol('reset');
  }
</script>
<DocumentHost {plan} {localState} stateValues={values} resetSignal={signal} dispatch={async () => {}} navigate={() => {}} onRenderDiagnostic={diagnostic} />
