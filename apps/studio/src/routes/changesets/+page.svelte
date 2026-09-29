<script lang="ts">
  /**
   * S9-03 CHANGESET BROWSER JOURNEY (dedicated SvelteKit route, new files;
   * the G1 read-only surface is NOT modified).
   *
   * Journey: propose (author) → review (operations, evidence, content
   * hash) → evidence run + attach → decide (approver(s), quorum promotion)
   * → commit (authorized operator). All target calls are relayed by the
   * Studio server with server-held per-actor credentials; the Studio never
   * invents receipt/connection/changeset state, and every failed view
   * shows a truthful banner ONLY. Includes the four NEGATIVE
   * demonstrations: self-approval (scope denied), changed content
   * (approvals invalidated), missing approval (not approved), duplicate
   * effect (idempotent replay).
   */
  import type { ChangesetSummary } from '$lib/changesets/changesets.js';

  let {
    data,
    form,
  }: {
    data: { targets: readonly { id: string; label: string }[]; changesets: readonly ChangesetSummary[] };
    form: Record<string, unknown> | null;
  } = $props();

  const targetChoices = data?.targets ?? [];
  const changesetRows = data?.changesets ?? [];
  const defaultTarget = targetChoices[0]?.id ?? 'local';
  let selectedTarget = $state(defaultTarget);

  const banner = $derived(
    typeof form?.bannerText === 'string' ? (form.bannerText as string) : '',
  );
  const summary = $derived((form?.summary as Record<string, never> | undefined) ?? null);
  const runSummary = $derived((form?.runSummary as Record<string, never> | undefined) ?? null);
</script>

<svelte:head><title>Changesets — VICT Studio</title></svelte:head>

<main class="changesets">
  <h2>S9-03 changeset journey</h2>
  <p>
    A ChangeSet is proposed (author) → reviewed (operations, evidence, content hash) →
    decided by a SEPARATE approver → committed by an authorized operator. Governance
    fails closed on the target: self-approval, changed content, missing approval, and
    duplicate effect never pass. Every call is relayed by the Studio server with a
    server-held, per-actor credential; a failed view shows a truthful banner ONLY.
  </p>

  {#if banner.length > 0}
    <p class="banner" class:failure={form?.success !== true}>Result — {banner}</p>
  {/if}

  <section class="step">
    <h3>Review board (truthful list read)</h3>
    {#if changesetRows.length === 0}
      <p class="empty">No changesets are recorded on the target (truthful empty read).</p>
    {:else}
      <ul>
        {#each changesetRows as row, i (i)}
          <li>
            <code>{row.changesetId}</code> — status {row.status}, risk {row.riskClass},
            content hash <code>{row.contentHash}</code>, requires {row.requiredApproverCount} approver(s)
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="step">
    <h3>1 · Prepare — propose (author)</h3>
    <form method="POST" action="?/propose">
      <label>
        Target
        <select name="targetId" bind:value={selectedTarget}>
          {#each targetChoices as target (target.id)}
            <option value={target.id}>{target.id} — {target.label}</option>
          {/each}
        </select>
      </label>
      <label>changesetId <input name="changesetId" required /></label>
      <p>
        The base is the CURRENT subject selection the proposal expects (read it through
        the G1 surface, e.g. the selected activation for the graph).
      </p>
      <label>base.kind (activation | release) <input name="baseKind" value="activation" required /></label>
      <label>base.subjectId <input name="baseSubjectId" required /></label>
      <label>base.expectedVersion <input name="baseExpectedVersion" required /></label>
      <label>operation.kind (select-activation) <input name="operationKind" value="select-activation" required /></label>
      <label>operation.graphId <input name="graphId" required /></label>
      <label>operation.activationVersion <input name="activationVersion" required /></label>
      <label>rationale <input name="rationale" required /></label>
      <label>riskClass (low | medium | high) <input name="riskClass" value="low" required /></label>
      <label>requiredApproverCount (1..8) <input name="requiredApproverCount" value="1" required /></label>
      <label>expiresAt (epoch-ms; must be AFTER creation) <input name="expiresAt" required /></label>
      <label>Idempotency-Key <input name="idempotencyKey" required /></label>
      <button type="submit">Propose changeset</button>
    </form>
    {#if summary && form?.kind === 'propose'}
      <dl>
        <dt>changesetId</dt><dd><code>{summary.changesetId}</code></dd>
        <dt>contentHash (approvals bind EXACTLY this)</dt><dd><code>{summary.contentHash}</code></dd>
        <dt>status</dt><dd>{summary.status}</dd>
        <dt>author</dt><dd>{summary.authorActorId}</dd>
      </dl>
    {/if}
  </section>

  <section class="step">
    <h3>2 · Review — inspect operations, evidence, content hash</h3>
    <form method="POST" action="?/inspect">
      <label>changesetId <input name="changesetId" required /></label>
      <input type="hidden" name="targetId" value={selectedTarget} />
      <button type="submit">Read the changeset record</button>
    </form>
    {#if summary && form?.kind === 'inspect'}
      <dl>
        <dt>status</dt><dd>{summary.status}</dd>
        <dt>contentHash</dt><dd><code>{summary.contentHash}</code></dd>
        <dt>riskClass / requiredApproverCount</dt>
        <dd>{summary.riskClass} / {summary.requiredApproverCount || 'not reported'}</dd>
        <dt>base</dt>
        <dd>{summary.baseKind} {summary.baseSubjectId} — expected {summary.baseExpectedVersion}</dd>
        <dt>operations</dt>
        <dd>
          {#if summary.operations.length === 0}
            none reported
          {:else}
            <ul>
              {#each summary.operations as op, i (i)}
                <li>#{op.index} {op.kind} → {op.subject}</li>
              {/each}
            </ul>
          {/if}
        </dd>
        <dt>validation evidence</dt>
        <dd>
          {summary.validationOutcome === null
            ? 'NONE recorded (missing evidence blocks the commit)'
            : `${summary.validationOutcome} (run ${summary.validationRunId})`}
        </dd>
        <dt>simulation evidence</dt>
        <dd>
          {summary.simulationOutcome === null
            ? 'NONE recorded'
            : `${summary.simulationOutcome} (run ${summary.simulationRunId})`}
        </dd>
        <dt>approvals</dt>
        <dd>
          The target does not expose an approval list on the record: approval decisions
          are auditable events binding the EXACT content hash above; the commit gate
          enforces the quorum against them.
        </dd>
      </dl>
    {/if}
  </section>

  <section class="step">
    <h3>2b · Evidence — execute the validation run (author) and attach its run id</h3>
    <form method="POST" action="?/evidence">
      <label>changesetId <input name="changesetId" required /></label>
      <input type="hidden" name="targetId" value={selectedTarget} />
      <label>Idempotency-Key <input name="idempotencyKey" required /></label>
      <button type="submit">Execute validation evidence run</button>
    </form>
    {#if runSummary && form?.kind === 'evidence'}
      <dl>
        <dt>executed run</dt>
        <dd>{runSummary.kind} — {runSummary.outcome} (run <code>{runSummary.runId}</code>)</dd>
        {#if summary}
          <dt>attached evidence</dt>
          <dd>
            validation {summary.validationOutcome ?? 'not attached'} — the evidence binds
            content hash <code>{summary.contentHash}</code>
          </dd>
        {/if}
      </dl>
    {/if}
  </section>

  <section class="step">
    <h3>3 · Decide — separate approver(s)</h3>
    <p>
      Approvals bind the CURRENT content hash. A single-approver changeset is promoted by
      approver-a alone; with requiredApproverCount 2 the promotion needs DISTINCT approvers
      (approver-a then approver-b — a duplicate decision by the same approver never advances the quorum).
    </p>
    <form method="POST" action="?/decide">
      <label>changesetId <input name="changesetId" required /></label>
      <label>
        Approver
        <select name="actor">
          <option value="approver-a">approver-a (approve + commit)</option>
          <option value="approver-b">approver-b (approve only)</option>
          <option value="author">author — NEGATIVE (self-approval: no changeset.approve scope)</option>
        </select>
      </label>
      <label>decision (approved | declined) <input name="decision" value="approved" required /></label>
      <label>Idempotency-Key <input name="idempotencyKey" required /></label>
      <input type="hidden" name="targetId" value={selectedTarget} />
      <button type="submit">Record decision</button>
    </form>
    {#if summary && form?.kind === 'decide'}
      <dl>
        <dt>recorded decision</dt><dd>{summary.decision} by {summary.approverActorId || 'the target did not report the approver'}</dd>
        <dt>changeset status</dt><dd>{summary.status}</dd>
        <dt>bound contentHash</dt><dd><code>{summary.contentHash}</code></dd>
      </dl>
    {/if}
  </section>

  <section class="step">
    <h3>4 · Commit — authorized operator</h3>
    <p>
      Committed once with the approver-a credential (approve + commit). A SECOND commit of
      the same changeset is the IDEMPOTENT REPLAY of the first: same receipts, one outcome,
      never a second effect (with the same key the target replays the recorded outcome;
      with a fresh key the committed-status replay returns the SAME receipt list).
    </p>
    <form method="POST" action="?/commit">
      <label>changesetId <input name="changesetId" required /></label>
      <label>Idempotency-Key (a fresh key on a second commit still replays the SAME receipts) <input name="idempotencyKey" required /></label>
      <input type="hidden" name="targetId" value={selectedTarget} />
      <button type="submit">Commit changeset</button>
    </form>
    {#if summary && form?.kind === 'commit'}
      <dl>
        <dt>recorded outcome</dt>
        <dd>
          {summary.appliedCount} operation receipt(s) applied exactly once
          ({summary.appliedKinds.join(', ') || 'none reported'}); status {summary.status}
        </dd>
      </dl>
    {/if}
  </section>

  <section class="step">
    <h3>Negative · Changed content — revise an APPROVED proposal (author-only) then commit</h3>
    <p>
      Re-submit the SAME operation content with a CHANGED rationale: the target derives a
      NEW content hash and DEMOTES the approved proposal to draft (revise() sets status
      'draft'), so the earlier approval decisions stop binding. A follow-up commit then
      fails closed with VICT_CONTROL_CHANGESET_NOT_APPROVED — nothing is ever applied on
      unapproved content. (The target's commit path additionally re-checks that approvals
      still bind the current hash before ANY mutation; that
      VICT_CONTROL_APPROVALS_INVALIDATED guard is defense-in-depth for
      the current command surface.)
    </p>
    <form method="POST" action="?/revise">
      <label>changesetId <input name="changesetId" required /></label>
      <label>base.kind (activation | release) <input name="baseKind" value="activation" required /></label>
      <label>base.subjectId <input name="baseSubjectId" required /></label>
      <label>base.expectedVersion <input name="baseExpectedVersion" required /></label>
      <label>operation.kind <input name="operationKind" value="select-activation" required /></label>
      <label>operation.graphId <input name="graphId" required /></label>
      <label>operation.activationVersion <input name="activationVersion" required /></label>
      <label>rationale (CHANGED — this is what moves the content hash) <input name="rationale" required /></label>
      <label>riskClass <input name="riskClass" value="low" required /></label>
      <label>requiredApproverCount <input name="requiredApproverCount" value="1" required /></label>
      <label>expiresAt (epoch-ms) <input name="expiresAt" required /></label>
      <label>Idempotency-Key <input name="idempotencyKey" required /></label>
      <input type="hidden" name="targetId" value={selectedTarget} />
      <button type="submit">Revise (stop approvals binding) — then attempt commit separately</button>
    </form>
    {#if summary && form?.kind === 'revise'}
      <dl>
        <dt>revised status</dt><dd>{summary.status}</dd>
        <dt>NEW contentHash</dt><dd><code>{summary.contentHash}</code></dd>
      </dl>
    {/if}
  </section>
</main>

<style>
  .changesets { max-width: 48rem; margin: 0 auto; padding: 1rem; font-family: system-ui, sans-serif; }
  .step { border-top: 1px solid #ccc; margin-top: 1rem; padding-top: 0.5rem; }
  label { display: block; margin: 0.5rem 0; }
  input, select { display: block; margin-top: 0.25rem; width: 100%; }
  .banner { border: 1px solid #b8860b; border-radius: 4px; padding: 0.5rem; }
  .banner.failure { border-color: #b22; background: #fdf2f2; }
  .empty { color: #555; }
  dl { background: #f7f7f7; padding: 0.5rem; }
  dt { font-weight: bold; margin-top: 0.4rem; }
  dd { margin-left: 0; overflow-wrap: anywhere; }
  code { overflow-wrap: anywhere; }
</style>