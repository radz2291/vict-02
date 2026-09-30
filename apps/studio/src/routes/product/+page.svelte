<script lang="ts">
  // PRODUCT-VIEW / SAME-TURN PAGE (Stage 9, G3-C). GENERIC rendering: the
  // markup has NO target-name branch — every label, record, banner, and
  // version string arrives server-rendered from the transport payload
  // (+page.server.ts). Only the fields the target returned are projected;
  // failed/absent reads stay truthful banners (never placeholders).
  interface Labeled {
    readonly label: string;
    readonly value: unknown;
  }

  let { data }: { data: Record<string, unknown> } = $props();

  const pinned = $derived((data['pinned'] as Record<string, unknown> | null) ?? null);
  const panel = $derived((data['panel'] as Record<string, unknown> | null) ?? null);
  const refusal = $derived((data['refusal'] as Record<string, unknown> | null) ?? null);
  const pinFailed = $derived(
    pinned === null && typeof data['pin'] === 'object' ? (data['pin'] as Record<string, unknown>) : null,
  );
  const expectedIdentity = $derived((data['expectedIdentity'] as Record<string, unknown>) ?? {});
  const capabilityHonesty = $derived((data['capabilityHonesty'] as string) ?? '');

  function flatten(record: unknown): Labeled[] {
    const out: Labeled[] = [];
    if (record === null || typeof record !== 'object') {
      return out;
    }
    for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
      out.push({
        label: key,
        value: typeof value === 'object' && value !== null ? JSON.stringify(value) : value,
      });
    }
    return out;
  }
</script>

<svelte:head><title>VICT Studio — Product view</title></svelte:head>

<section class="product-view">
  <h1>Product view (same-turn inspection)</h1>

  {#if pinFailed !== null}
    <p class="banner failure" data-testid="pin-failure-banner">
      Pinned target not presented: the identity pin failed closed ({pinFailed['code']}). Nothing
      is claimed about this target.
    </p>
  {/if}

  {#if pinned !== null}
    <h2>Target / version evidence (verified oracle answers, recorded verbatim)</h2>
    <div class="panel" data-testid="target-evidence">
      <p>
        Target: <b>{data['targetLabel']}</b> ({data['targetId']});
        expected release identity:
        {expectedIdentity['releaseSetIdentity']} / {expectedIdentity['version']} /
        {expectedIdentity['frameworkPins']}
      </p>
      <h3>health.inspect answer.</h3>
      <ul data-testid="health-record">
        {#each flatten(pinned['healthRecord']) as row}
          <li><b>{row.label}</b>: {String(row.value)}</li>
        {/each}
      </ul>
      <h3>compatibility.inspect answer.</h3>
      <ul data-testid="compatibility-record">
        {#each flatten(pinned['compatibilityRecord']) as row}
          <li><b>{row.label}</b>: {String(row.value)}</li>
        {/each}
      </ul>
      <h3>Anti-newer probe (required refusal).</h3>
      <p data-testid="probe-outcome">
        Command: {JSON.stringify(pinned['refusalProbe'])}
      </p>
      <h3>Provenance (labeled provenance, never claimed as a runtime oracle).</h3>
      <pre data-testid="provenance-record">{JSON.stringify(pinned['provenance'], null, 2)}</pre>
    </div>

    {#if panel !== null}
      <h2>Same-turn panel (one selected turn, both declared reads)</h2>
      {#if panel['selected'] === null}
        <p class="banner warn">No turn was provisioned for this journey; nothing is invented.</p>
      {/if}
      <div class="panel" data-testid="same-turn-panel">
        <p class="banner" class:aligned={panel['banner']['state'] === 'aligned'} data-testid="same-turn-banner">
          {panel['banner']['text']}
        </p>
        <h3>Read 1 — the target's own turn record (agent.turn.get).</h3>
        {#if panel['turnRecord'] !== null && panel['turnRecord'] !== undefined}
          <ul data-testid="turn-record">
            {#each flatten(panel['turnRecord']) as row}
              <li><b>{row.label}</b>: {String(row.value)}</li>
            {/each}
          </ul>
        {:else}
          <p class="banner warn" data-testid="turn-record-missing">
            Turn record not retrieved: the target truthfully answered no turn record for this
            selection; no substitute is shown.
          </p>
        {/if}
        <h3>Read 2 — the declared inspection projection (app.data.query).</h3>
        {#if panel['inspection'] !== null && panel['inspection'] !== undefined}
          <ul data-testid="inspection-record">
            {#each flatten(panel['inspection']) as row}
              <li><b>{row.label}</b>: {String(row.value)}</li>
            {/each}
          </ul>
        {:else}
          <p class="banner warn" data-testid="inspection-record-missing">
            Inspection projection not retrieved: the target truthfully refused or had no recorded
            assembly for this turn; no substitute is shown.
          </p>
        {/if}
      </div>
    {/if}

    {#if refusal !== null}
      <h2>Agent-identity vs. operator surface (identity evidence)</h2>
      <div class="panel" data-testid="refusal-evidence">
        <h3>actor.whoami — server-held credential A (operator).</h3>
        <ul data-testid="whoami-operator">
          {#each flatten(pinned['whoamiOperator']) as row}
            <li><b>{row.label}</b>: {String(row.value)}</li>
          {/each}
        </ul>
        <h3>actor.whoami — server-held credential B (agent-context).</h3>
        <ul data-testid="whoami-agent">
          {#each flatten(pinned['whoamiAgent']) as row}
            <li><b>{row.label}</b>: {String(row.value)}</li>
          {/each}
        </ul>
        <h3>whoami DIFF (the identity evidence; distinctness demonstrated, not assumed).</h3>
        <p data-testid="whoami-diff">{JSON.stringify(refusal['whoamiDiff'])}</p>
        <h3>Agent-context credential against the operator surface.</h3>
        <p data-testid="refusal-outcome">
          {JSON.stringify({ command: refusal['command'], succeeded: refusal['succeeded'], refusalCode: refusal['refusalCode'] })}
        </p>
        {#if refusal['singleActor'] === true && refusal['succeeded'] === true}
          <p class="banner warn" data-testid="single-actor-banner">
            AGENT-IDENTITY REFUSAL NOT DEMONSTRATED on this existing tree: the whoami answers
            above prove the target resolves both server-held credentials to ONE actor
            (the single-actor tree), so the agent-context credential is not refused. This is the
            recorded single-actor evidence; the denial is never simulated client-side.
          </p>
        {/if}
      </div>
    {/if}
  {/if}

  <h2>Capability honesty</h2>
  <p class="banner warn" data-testid="capability-banner">{capabilityHonesty}</p>
</section>

<style>
  .product-view {
    padding: 1.5rem;
    display: grid;
    gap: 0.75rem;
  }
  .panel {
    border: 1px solid #c9cdd6;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    background: #fafbfd;
    display: grid;
    gap: 0.35rem;
  }
  .banner {
    border-left: 4px solid #4b5bd7;
    padding: 0.5rem 0.75rem;
    background: #eef1ff;
  }
  .banner.warn {
    border-left-color: #b7791f;
    background: #fff8ec;
  }
  .banner.failure {
    border-left-color: #b42318;
    background: #fdeceb;
  }
  .banner.aligned {
    border-left-color: #197a4c;
    background: #eafbf2;
  }
  ul {
    margin: 0;
    padding-left: 1.25rem;
  }
</style>