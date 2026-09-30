<script lang="ts">
  /**
   * S9-02 RUN-DETAIL PAGE (WP-G3-B). Dedicated SvelteKit route
   * `/runs/[runId]`, reached by the FT-1 "Open run" row link on the
   * definition-hosted run list. Everything rendered below is verbatim
   * from the target's own G1 reads (replay of the page server's bundle);
   * failed/absent reads render truthful banners — nothing is invented.
   */
  import type {
    RevealFormResult,
    RevealOutcome,
    RunDetailAuditRows,
    RunDetailEventRows,
    RunDetailWaitRows,
  } from './+page.server';

  interface RevealOutcome {
    kind: 'revealed' | 'retention' | 'denied' | 'unavailable' | 'unreachable';
    bannerText: string;
    retention: string | null;
    protectedOutput: unknown;
    accessAuditRows: Record<string, unknown>[];
  }
  interface RunDetailEventRows extends Array<Record<string, unknown>> {}
  interface RunDetailWaitRows extends Array<Record<string, unknown>> {}
  interface RunDetailAuditRows extends Array<Record<string, unknown>> {}

  interface RunDetailData {
    runId: string;
    targetId: string;
    record: Record<string, unknown> | null;
    readFailure: string | null;
    recordAgain: Record<string, unknown> | null;
    recordAgainFailure: string | null;
    compare: { moved: boolean; fields: readonly { key: string; first: string; second: string; changed: boolean }[] };
    events: RunDetailEventRows;
    eventsFailure: string | null;
    waits: RunDetailWaitRows;
    waitsFailure: string | null;
    audit: RunDetailAuditRows;
    auditFailure: string | null;
    options: readonly string[];
  }

  let { data, form }: { data: RunDetailData; form: { reveal?: RevealOutcome; bannerText?: string } | null } = $props();

  const record = $derived(data.record as Record<string, unknown> | null);
  const reveal = $derived(revealOf(form));
  const failed = $derived(form !== null && reveal === null);

  function text(value: unknown): string {
    if (value === undefined || value === null) return '(not reported)';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  function revealOf(form: { reveal?: RevealOutcome; bannerText?: string } | null): RevealOutcome | null {
    if (form === null) return null;
    const value = (form as Record<string, unknown>)['reveal'];
    return value !== null && typeof value === 'object' ? (value as RevealOutcome) : null;
  }
</script>

<svelte:head><title>Run {data.runId} — VICT Studio</title></svelte:head>

<main class="run-detail">
  <h2>Run {data.runId}</h2>
  <p class="note">
    This page renders ONLY what the target returned for its G1 reads (target
    <code>{data.targetId}</code>). A failed or absent read shows a truthful banner; nothing
    is synthesized. The generic record below is the target's REDACTED projection —
    protected bytes never cross it; the separate reveal control is the only
    authorized detail request.
  </p>

  {#if failed && typeof form?.bannerText === 'string'}
    <p class="banner">{form.bannerText}</p>
  {/if}

  <section>
    <h3>Record (redacted generic read)</h3>
    {#if data.readFailure !== null}
      <p class="banner">
        Run record unavailable: the target refused the read with its own code
        <code>{data.readFailure}</code>. No record is shown and nothing was changed.
      </p>
    {:else if record === null}
      <p class="banner">
        Run record absent: the target answered without a record for {data.runId}.
      </p>
    {:else}
      <table>
        <tbody>
          {#each Object.entries(record) as [key, value] (key)}
            <tr><th>{key}</th><td><code>{text(value)}</code></td></tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <section>
    <h3>Version compare (honest dual read)</h3>
    <p class="note">
      Design decision: the G1 <code>run.get</code> surface has no revision-time read, so the
      honest version compare is TWO sequential generic reads of the same run. Both snapshots
      are the target's own answers; a difference means the record MOVED between reads.
    </p>
    {#if data.recordAgainFailure !== null || data.readFailure !== null || record === null || data.recordAgain === null}
      <p class="banner">
        The dual read could not complete on the target; no compare is claimed.
      </p>
    {:else}
      <table>
        <thead>
          <tr><th>field</th><th>read A</th><th>read B</th><th></th></tr>
        </thead>
        <tbody>
          {#each data.compare.fields as field (field.key)}
            <tr>
              <th>{field.key}</th>
              <td><code>{field.first}</code></td>
              <td><code>{field.second}</code></td>
              <td>{field.changed ? 'CHANGED between reads' : ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="note">
        {data.compare.moved
          ? 'The record moved between the two reads — both reads stay visible; no merged state is claimed.'
          : 'Both reads returned the same record — no movement is claimed.'}
      </p>
    {/if}
  </section>

  <section>
    <h3>Ordered events</h3>
    {#if data.eventsFailure !== null}
      <p class="banner">
        Events unavailable: the target refused the read with its own code
        <code>{data.eventsFailure}</code>.
      </p>
    {:else if data.events.length === 0}
      <p class="banner">No events recorded for this run (truthful absence).</p>
    {:else}
      <table>
        <thead>
          <tr><th>seq</th><th>type</th><th>node</th><th>activation version</th><th>timestamp</th></tr>
        </thead>
        <tbody>
          {#each data.events as event (String(event['seq']))}
            <tr>
              <td>{text(event['seq'])}</td>
              <td>{text(event['type'])}</td>
              <td>{text(event['nodeId'])}</td>
              <td>{text(event['activationVersion'])}</td>
              <td>{text(event['timestamp'])}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <section>
    <h3>Durable waits</h3>
    {#if data.waitsFailure !== null}
      <p class="banner">
        Waits unavailable: the target refused the read with its own code
        <code>{data.waitsFailure}</code>.
      </p>
    {:else if data.waits.length === 0}
      <p class="banner">No durable waits for this run (truthful absence).</p>
    {:else}
      <table>
        <thead>
          <tr><th>wait</th><th>kind</th><th>signal</th><th>status</th><th>resolved by</th></tr>
        </thead>
        <tbody>
          {#each data.waits as wait (text(wait['waitId']))}
            <tr>
              <td>{text(wait['waitId'])}</td>
              <td>{text(wait['kind'])}</td>
              <td>{text(wait['signalName'])}</td>
              <td>{text(wait['status'])}</td>
              <td>{text(wait['resolvedBy'])}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <section>
    <h3>Bounded options (explanation only — no actions on this page)</h3>
    <ul>
      {#each data.options as option (option)}
        <li>{option}</li>
      {/each}
    </ul>
  </section>

  <section>
    <h3>Provenance and per-access audit (target's own audit trail)</h3>
    {#if data.auditFailure !== null}
      <p class="banner">
        Audit unavailable: the target refused the read with its own code
        <code>{data.auditFailure}</code>.
      </p>
    {:else if data.audit.length === 0}
      <p class="banner">No audit rows for this run (truthful absence).</p>
    {:else}
      <table>
        <thead>
          <tr><th>at</th><th>actor</th><th>action</th><th>subject</th><th>summary</th></tr>
        </thead>
        <tbody>
          {#each data.audit as row (text(row['auditId']))}
            <tr>
              <td>{text(row['at'])}</td>
              <td>{text(row['actorId'])}</td>
              <td><code>{text(row['action'])}</code></td>
              <td>{text(row['subjectId'])}</td>
              <td>{text(row['summary'])}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <section>
    <h3>Protected detail (D-5 — separately scoped authorized request)</h3>
    <p class="note">
      Default state: REDACTED. Stored output bytes never cross the generic read above;
      the button below issues the one authorized <code>run.detail</code> request with the
      server-held run.detail-grant credential (the browser never holds it). The target
      itself records a per-access audit row for every retrieval.
    </p>
    <form method="POST" action="?/reveal">
      <input type="hidden" name="runId" value={data.runId} />
      <input type="hidden" name="targetId" value={data.targetId} />
      <button type="submit">Reveal protected detail</button>
    </form>
    {#if reveal !== null}
      <p class="banner">{reveal.bannerText}</p>
      {#if reveal.kind === 'revealed'}
        <table>
          <tbody>
            <tr><th>retention</th><td><code>{text(reveal.retention)}</code></td></tr>
            <tr><th>protected output</th><td><code>{text(reveal.protectedOutput)}</code></td></tr>
          </tbody>
        </table>
      {/if}
      {#if reveal.accessAuditRows.length > 0}
        <h4>Per-access audit evidence (run.detail.accessed)</h4>
        <table>
          <thead>
            <tr><th>at</th><th>actor</th><th>action</th><th>subject</th></tr>
          </thead>
          <tbody>
            {#each reveal.accessAuditRows as row (text(row['auditId']))}
              <tr>
                <td>{text(row['at'])}</td>
                <td>{text(row['actorId'])}</td>
                <td><code>{text(row['action'])}</code></td>
                <td>{text(row['subjectId'])}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/if}
  </section>
</main>

<style>
  main { max-width: 60rem; margin: 0 auto; padding: 1rem; }
  table { border-collapse: collapse; margin: 0.5rem 0 1.5rem; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 0.25rem 0.5rem; text-align: left; vertical-align: top; font-size: 0.9rem; }
  th { background: #f5f5f5; font-weight: 600; }
  .banner { border-left: 4px solid #b53; padding: 0.5rem 0.75rem; background: #fdf3f2; }
  .note { color: #333; }
</style>