<script lang="ts">
  /**
   * S9-04 CONFIRMATION JOURNEY PAGE (dedicated SvelteKit route, new files;
   * the G1 read-only plan surface is NOT modified and its dispatch stays
   * fail-closed with zero declared actions).
   *
   * Journey: prepare from the form (POST /vict/v1/confirmations relayed by
   * the Studio server with the server-held credential) → human review of
   * the server-issued summary (command, subject, payload digest, expected
   * revision, expiry) → confirm (posting the confirmed shape with the
   * session boundary proven at G1 hooks). Failure views use the truthful
   * per-view banner convention; nothing is fabricated for any state.
   */
  import ConfirmationReview from '$lib/components/ConfirmationReview.svelte';
  import {
    CONFIRMATION_COMMANDS,
    type ConfirmationEffectPanel,
  } from '$lib/confirmation/confirmation.js';

  let { data, form }: { data: { targets: readonly { id: string; label: string }[] }; form: Record<string, unknown> | null } = $props();

  const targetChoices = data?.targets ?? [];
  const defaultTarget = targetChoices.find((entry) => entry.id.startsWith('g2-mutator'))?.id ?? targetChoices[0]?.id ?? 'local';
  let selectedTarget = $state(defaultTarget);

  const commandChoices = Object.keys(CONFIRMATION_COMMANDS);
  let selectedCommand = $state('run.cancel');
  $effect(() => {
    if (form !== null && typeof form['command'] === 'string') {
      const command = form['command'] as string;
      if (command in CONFIRMATION_COMMANDS) selectedCommand = command;
    }
  });
  const spec = $derived(CONFIRMATION_COMMANDS[selectedCommand] ?? CONFIRMATION_COMMANDS['run.cancel']);

  function fieldLabel(field: string): string {
    if (field === 'resolution') return 'resolution (retry | confirm_applied | fail | cancel)';
    return field;
  }

  type EffectPanel = ConfirmationEffectPanel;
  interface WaitRow {
    waitId: string;
    status: string;
    signalName: string | null;
    resolvedBy: string | null;
  }
  /** Merge the before/after wait reads into one ordered row set (by union of
   * waitIds, keyed on the target's real wait identities — nothing invented). */
  function unifiedWaitRows(before: readonly WaitRow[], after: readonly WaitRow[]): WaitRow[] {
    const rows = new Map<string, WaitRow>();
    for (const wait of before) rows.set(wait.waitId, { ...wait, status: wait.status, resolvedBy: wait.resolvedBy } satisfies WaitRow);
    for (const wait of after) {
      const prior = rows.get(wait.waitId);
      rows.set(wait.waitId, prior ? { ...wait, resolvedBy: wait.resolvedBy ?? prior.resolvedBy } : { ...wait, resolvedBy: wait.resolvedBy });
    }
    return [...rows.entries()].map(([waitId, row]) => ({ ...row, waitId }));
  }
</script>

<svelte:head><title>Confirmations — VICT Studio</title></svelte:head>

<main class="confirmations">
  <h2>S9-04 confirmation journey</h2>
  <p>
    Every Stage 9 target mutation runs prepare → human review → confirm. A receipt
    here is the target's own server-issued record; the Studio never invents
    connection or receipt state, and a failed view shows a truthful banner only.
  </p>

  {#if form?.bannerText && form?.success !== true}
    <p class="fence-note">Failure banners restate the stable code the target issued (e.g. VICT_CONFIRMATION_REQUIRED, _EXPIRED, _SPENT, _STALE) — nothing else.</p>
  {/if}

  <section class="step">
    <h3>1 · Prepare</h3>
    <form method="POST" action="?/prepare">
      <label>
        Target
        <select name="targetId" bind:value={selectedTarget}>
          {#each targetChoices as target (target.id)}
            <option value={target.id}>{target.id} — {target.label}</option>
          {/each}
        </select>
      </label>
      <label>
        Command
        <select name="command" bind:value={selectedCommand}>
          {#each Object.entries(CONFIRMATION_COMMANDS) as [key, value] (key)}
            <option value={key}>{key} — {value.label}</option>
          {/each}
        </select>
      </label>
      {#each spec.payloadFields as field (field)}
        <label>
          {fieldLabel(field)}
          <input name={field} required />
        </label>
      {/each}
      <label>
        expectedRevision (the subject's CURRENT revision — read through the G1 surface; the literal word <code>null</code> only where the contract says none is selected)
        <input name="expectedRevision" />
      </label>
      <label>
        Idempotency-Key
        <input name="idempotencyKey" required />
      </label>
      <button type="submit">Prepare receipt</button>
    </form>
  </section>

  <section class="step">
    <h3>2 · Human review</h3>
    <ConfirmationReview
      summary={(form?.summary as Record<string, never> | undefined) ?? null}
      status={null}
      bannerText={typeof form?.bannerText === 'string' && form.bannerText.length > 0 ? form.bannerText : ''}
      bannerTone={form?.success === true ? 'neutral' : 'warning'}
    />
  </section>

  <section class="step">
    <h3>3 · Confirm (or check status)</h3>
    <form method="POST" action="?/status">
      <label>
        Target
        <select name="targetId" bind:value={selectedTarget}>
          {#each targetChoices as target (target.id)}
            <option value={target.id}>{target.id} — {target.label}</option>
          {/each}
        </select>
      </label>
      <label>
        Receipt id (status read)
        <input name="receiptId" required />
      </label>
      <button type="submit">Read receipt status</button>
    </form>
    {#if form?.status}
      <ConfirmationReview
        status={(form.status as Record<string, never> | undefined) ?? null}
        label="Receipt status"
      />
    {/if}
    <form method="POST" action="?/confirm">
      <label>
        Target
        <select name="targetId" bind:value={selectedTarget}>
          {#each targetChoices as target (target.id)}
            <option value={target.id}>{target.id} — {target.label}</option>
          {/each}
        </select>
      </label>
      <label>
        Command
        <select name="command" bind:value={selectedCommand}>
          {#each Object.entries(CONFIRMATION_COMMANDS) as [key, value] (key)}
            <option value={key}>{key} — {value.label}</option>
          {/each}
        </select>
      </label>
      {#each spec.payloadFields as field (field)}
        <label>
          {fieldLabel(field)}
          <input name={field} required />
        </label>
      {/each}
      <label>
        receiptId
        <input name="receiptId" required />
      </label>
      <label>
        Idempotency-Key (same key replays the recorded outcome; a fresh key on a spent receipt fails truthfully)
        <input name="idempotencyKey" required />
      </label>
      <button type="submit">Confirm</button>
    </form>
  </section>

  {#if form?.effect}
    <section class="step">
      <h3>4 · After the confirm — resulting truth read back from the target</h3>
      <p class="fence-note">
        Every line below comes verbatim from the target's own read surfaces. Nothing
        here is summarized or fabricated; reads that did not return truthfully say so.
      </p>
      {@const effect = form.effect as ConfirmationEffectPanel}
      <table class="effect">
        <tbody>
          <tr><th>actor</th><td>{effect.audit.available ? 'see audit rows' : '(audit read unavailable)'}</td></tr>
          <tr><th>target</th><td>{effect.targetId}</td></tr>
          <tr><th>command</th><td>{effect.command}</td></tr>
          <tr><th>subject</th><td>{effect.subjectId ?? '(no run subject)'}</td></tr>
          <tr><th>reason</th><td>{effect.reason ?? '(no reason member on this payload)'}</td></tr>
          {#each Object.entries(effect.payload) as [key, value] (key)}
            <tr><th>payload · {key}</th><td><code>{value}</code></td></tr>
          {/each}
        </tbody>
      </table>
      <h4>Run state before → after (target's own run read)</h4>
      <table class="effect">
        <tbody>
          <tr>
            <th>run status</th>
            <td>{effect.before.run.available ? effect.before.run.status : 'unavailable'} → {effect.after.run.available ? effect.after.run.status : 'unavailable'}</td>
          </tr>
          <tr>
            <th>run recordRevision</th>
            <td>{effect.before.run.available ? effect.before.run.recordRevision : 'unavailable'} → {effect.after.run.available ? effect.after.run.recordRevision : 'unavailable'}</td>
          </tr>
        </tbody>
      </table>
      <h4>Durable waits before → after (target's own waits read)</h4>
      {#if effect.before.waits.available && effect.after.waits.available}
        <table class="effect">
          <thead><tr><th>waitId</th><th>signalName</th><th>before</th><th>after</th><th>resolvedBy (after)</th></tr></thead>
          <tbody>
            {#each unifiedWaitRows(effect.before.waits.waits, effect.after.waits.waits) as row (row.waitId)}
              <tr><td><code>{row.waitId}</code></td><td>{row.signalName ?? '—'}</td><td>{row.before}</td><td>{row.after}</td><td>{row.resolvedBy ?? '—'}</td></tr>
            {/each}
            {#if effect.before.waits.waits.length === 0 && effect.after.waits.waits.length === 0}
              <tr><td colspan="5">No waits on this run at either read.</td></tr>
            {/if}
          </tbody>
        </table>
      {:else}
        <p class="fence-note">{effect.before.waits.available ? effect.after.waits.note : effect.before.waits.note}</p>
      {/if}
      <h4>Executor result (verbatim; the target's own confirmed-call answer)</h4>
      {#if effect.executorResult !== null}
        <pre>{effect.executorResult}</pre>
      {:else}
        <p class="fence-note">The confirmed call returned no executor result member.</p>
      {/if}
      <h4>Audit trail (subjectType=confirmation, subjectId={effect.audit.available ? 'the receipt' : '—'})</h4>
      {#if effect.audit.available}
        <table class="effect">
          <thead><tr><th>at</th><th>action</th><th>actorId</th><th>summary</th></tr></thead>
          <tbody>
            {#each effect.audit.events as auditEvent (auditEvent.auditId)}
              <tr><td>{auditEvent.at}</td><td>{auditEvent.action}</td><td>{auditEvent.actorId}</td><td>{auditEvent.summary}</td></tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="fence-note">{effect.audit.note}</p>
      {/if}
    </section>
  {/if}
</main>

<style>
  .confirmations { max-width: 46rem; margin: 0 auto; padding: 1rem; font-family: system-ui, sans-serif; }
  .step { border-top: 1px solid #ccc; margin-top: 1rem; padding-top: 0.5rem; }
  label { display: block; margin: 0.5rem 0; }
  input, select { display: block; margin-top: 0.25rem; width: 100%; }
  .fence-note { color: #555; }
  table.effect { width: 100%; border-collapse: collapse; margin: 0.5rem 0; }
  table.effect th, table.effect td { border: 1px solid #ddd; padding: 0.25rem 0.4rem; text-align: left; vertical-align: top; }
  table.effect th { white-space: nowrap; background: #fafafa; }
  pre { background: #f6f6f6; padding: 0.5rem; overflow-x: auto; }
</style>