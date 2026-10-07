<script lang="ts">
  import { Button } from '@victframework/ui-svelte';
  let { actorRole, scenario, mode, diagnostic = '' }: { actorRole: string; scenario: string; mode: string; diagnostic?: string } = $props();
  let scenarioChoice = $state('normal'); let modeChoice = $state('simulated');
  let busy = $state(false); let note = $state('');
  const recordLabels: Record<string, string> = { normal: 'Submitted inspections', empty: 'Empty queue', long: 'Long content' };
  let recordLabel = $derived(recordLabels[scenario] ?? recordLabels.normal);
  $effect(() => { scenarioChoice = scenario in recordLabels ? scenario : 'normal'; modeChoice = mode; });
  async function reset() {
    busy = true; note = 'Resetting demo…';
    try {
      const result = await (await fetch(`/api/inspection/reset?as=${actorRole}&scenario=${scenarioChoice}&mode=${modeChoice}`, { method: 'PUT' })).json();
      if (!result.ok) throw new Error(result.message);
      note = 'Demo reset. The queue is ready.'; window.location.assign(`/?as=${actorRole}`);
    } catch { note = 'The demo could not reset. Try again.'; }
    finally { busy = false; }
  }
</script>
<details class="demo">
  <summary>Demo controls <span>{mode === 'durable-local' ? 'Saved records · Saved locally' : `${recordLabel} · Simulated`}</span></summary>
  <div class="controls">
    <p>This is a fictional inspection workspace. Reset recreates simulated records. Saved locally uses a SQLite file and keeps existing records when settings change.</p>
    <div class="fields">
      <label>View as<select class="vict-select" value={actorRole} onchange={event => window.location.assign(`${window.location.pathname}?as=${event.currentTarget.value}`)} disabled={busy}><option value="supervisor">Supervisor</option><option value="technician">Technician</option></select></label>
      <label>Records (simulated)<select class="vict-select" bind:value={scenarioChoice} disabled={busy}>{#each ['normal', 'empty', 'long'] as value}<option {value}>{recordLabels[value]}</option>{/each}</select></label>
      <label>Storage<select class="vict-select" bind:value={modeChoice} disabled={busy}><option value="simulated">Simulated</option><option value="durable-local">Saved locally (SQLite)</option></select></label>
      <Button label="Reset demo" variant="secondary" disabled={busy} onclick={reset} />
    </div>
    <p role="status">{note}</p>
    <p>For delayed, failed, unavailable, denied and conflicting operation cases, open the test console. These cases do not change ordinary product approval.</p>
    <nav aria-label="Demo tools"><a href="/scenarios">Operation coverage & test console</a><a href="/studio">Edit presentation</a></nav>
    {#if diagnostic}<p class="diagnostic">Technical detail: {diagnostic}</p>{/if}
  </div>
</details>
<style>
  .demo { margin: 0 auto 32px; max-width: 1056px; border-top: 1px solid var(--vict-color-border); font-size: 13px; color: var(--vict-color-textMuted); }
  summary { padding: 16px 0; cursor: pointer; font-weight: 600; } summary span { font-weight: 400; margin-left: 12px; }
  .controls { padding: 0 0 20px; } .fields { display: flex; gap: 12px; flex-wrap: wrap; align-items: end; }
  label { display: flex; flex-direction: column; gap: 6px; flex: 1 1 160px; } nav { display: flex; flex-wrap: wrap; gap: 16px; }
  a { color: var(--vict-color-accent); } .diagnostic { overflow-wrap: anywhere; }
  @media (max-width: 1120px) { .demo { margin-left: 16px; margin-right: 16px; } }
</style>
