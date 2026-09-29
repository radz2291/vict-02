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
  import { CONFIRMATION_COMMANDS } from '$lib/confirmation/confirmation.js';

  let { form }: { form: Record<string, unknown> | null } = $props();

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
</main>

<style>
  .confirmations { max-width: 46rem; margin: 0 auto; padding: 1rem; font-family: system-ui, sans-serif; }
  .step { border-top: 1px solid #ccc; margin-top: 1rem; padding-top: 0.5rem; }
  label { display: block; margin: 0.5rem 0; }
  input, select { display: block; margin-top: 0.25rem; width: 100%; }
  .fence-note { color: #555; }
</style>