<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { DocumentHost, type ActionResult } from '@victframework/ui-svelte';
  import { inspectionPlan, studioDocumentCatalogs } from '$lib/product/compile.js';
  import { inspectionDetailDocument, productExtensions } from '$lib/product/documents.js';
  import { productImplementations } from '$lib/product/extensions.js';
  import { detailView } from '$lib/product/presentation.js';
  import { createAuthoringStore } from '$lib/authoring/store.js';
  import type { ActivityRow } from '$lib/product/domain.js';
  import DemoControls from '$lib/product/DemoControls.svelte';

  let { data }: { data: { id: string; actorRole: string; record: Record<string, unknown>; activity: readonly ActivityRow[]; scenario?: string; mode?: string } } = $props();
  let source = $state(inspectionDetailDocument);
  const compiled = $derived(inspectionPlan(source));
  onMount(() => {
    const saved = createAuthoringStore(window.localStorage, studioDocumentCatalogs).rawLoad();
    if (saved.status === 'loaded') {
      try { inspectionPlan(saved.document); source = saved.document; }
      catch { diagnostic = 'Saved presentation could not compile. Showing the bundled presentation.'; }
    } else if (saved.status === 'invalid') diagnostic = 'Saved presentation is unavailable. Showing the bundled presentation; saved bytes are preserved.';
  });
  let refreshed = $state<{ record: Record<string, unknown>; activity: readonly ActivityRow[] } | null>(null);
  let routeKey = $state('');
  $effect(() => { const next = data.id + ':' + data.actorRole; if (next !== routeKey) { routeKey = next; refreshed = null; feedback = ''; diagnostic = ''; } });
  const record = $derived(refreshed?.record ?? data.record);
  const activity = $derived(refreshed?.activity ?? data.activity);
  let busy = $state(false);
  let feedback = $state('');
  let feedbackKind = $state('status');
  let diagnostic = $state('');
  let canReload = $state(false);
  let resetSignal = $state(Symbol('initial'));
  const display = $derived(detailView(record, activity, data.actorRole));
  const view = $derived({ findings: display.findings, evidence: display.evidence, activity: display.activity });
  const stateValues = $derived({ actorRole: display.actorRole, actorId: display.actorId, findingCount: display.findingCount, evidenceCount: display.evidenceCount, hasFindings: display.hasFindings, hasEvidence: display.hasEvidence, busy, feedbackMessage: feedback, feedbackKind, hasFeedback: feedback !== '', canReload });

  async function request(actionId: string, input: unknown): Promise<ActionResult> {
    const response = await fetch('/api/inspection/' + actionId.replaceAll('.', '-') + '?as=' + data.actorRole, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    return await response.json() as ActionResult;
  }
  async function refresh(): Promise<void> {
    const result = await request('inspection.get', { id: data.id });
    if (!result.ok) throw new Error(result.message);
    const trail = await request('inspection.activity', { id: data.id });
    if (!trail.ok) throw new Error(trail.message);
    refreshed = { record: result.value as Record<string, unknown>, activity: (trail.value as { rows: readonly ActivityRow[] }).rows };
  }
  const success: Record<string, string> = { 'inspection.approve': 'Inspection approved. The review is complete.', 'inspection.reject': 'Returned for correction. The reason is recorded in activity.', 'inspection.revise': 'Corrections started. Add your changes, then submit for review.', 'inspection.submit': 'Submitted for review. A supervisor can now decide.', 'finding.add': 'Finding added.', 'evidence.add': 'Evidence added.', 'inspection.get': 'Inspection reloaded. Review its current state before continuing.' };
  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    if (busy) return { ok: false, code: 'BUSY', message: 'An operation is already in progress.' };
    busy = true; feedback = actionId === 'inspection.get' ? 'Reloading inspection…' : 'Recording your change…'; feedbackKind = 'status'; diagnostic = ''; canReload = false;
    // Only ephemeral record IDs belong to host orchestration. Fields and action bindings are authored.
    const payload = { ...((input as Record<string, unknown>) ?? {}) };
    if (actionId === 'finding.add' || actionId === 'evidence.add') payload.id = (actionId === 'finding.add' ? 'f' : 'e') + '-' + crypto.randomUUID();
    try {
      const result = await request(actionId, payload);
      if (result.ok) {
        await refresh(); resetSignal = Symbol('operation-complete');
        feedback = success[actionId] ?? 'Change recorded.';
      } else {
        feedbackKind = (result.code ?? '').includes('UNAUTHORIZED') || result.code === 'OPERATION_DENIED' ? 'denied' : 'error';
        diagnostic = result.code + ': ' + result.message; canReload = true;
        feedback = result.code === 'DOMAIN_CONFLICT' ? 'This inspection changed since you opened it. Reload it, review the changes, then try again.'
          : result.code === 'SCENARIO_COVERAGE_MISSING' ? 'Approval is unavailable from the current implementation. Open the test console to review its coverage.'
          : feedbackKind === 'denied' ? 'Your current role cannot make this change. Switch to the appropriate role in Demo controls.'
          : result.code === 'SESSION_STALE' ? 'The demo was reset while this change was in progress. Reload the inspection before continuing.'
          : result.code === 'DATA_INVALID_INPUT' ? 'This change cannot be applied to the current inspection. Reload it to check its status and review your entries.'
          : 'The change was not recorded. Reload the inspection before trying again.';
      }
      return result;
    } catch (error) {
      feedbackKind = 'error'; canReload = true; feedback = 'We could not confirm this change. Reload the inspection before trying again.';
      diagnostic = error instanceof Error ? error.message : String(error);
      return { ok: false, code: 'NETWORK', message: diagnostic };
    } finally {
      busy = false;
      await tick();
      document.querySelector<HTMLElement>('[data-feedback-focus]')?.focus();
    }
  }
</script>

<DocumentHost plan={compiled.detailPlan} {view} {record} localState={source.localState} {stateValues} {resetSignal}
  extensionDescriptors={productExtensions} extensionImplementations={productImplementations} {dispatch} navigate={() => undefined}
  onRenderDiagnostic={issue => { diagnostic = issue.code + ': ' + issue.message; }} ariaLabel="Inspection detail" />
<DemoControls actorRole={data.actorRole} scenario={data.scenario ?? 'normal'} mode={data.mode ?? 'simulated'} {diagnostic} />
