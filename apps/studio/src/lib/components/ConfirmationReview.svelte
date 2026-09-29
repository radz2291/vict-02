<script lang="ts">
  /**
   * NAMED CUSTOM OPERATOR COMPONENT `cmp.confirmation-review@1`
   * (code island, trusted local registry) — the S9-04 confirmation journey
   * human-review surface (proposal §6.2 note).
   *
   * JUSTIFICATION: the prepare → human review → confirm journey needs a
   * receipt summary display with per-state tone and truthful absence —
   * no shipped surface role can express a bounded receipt summary with
   * status-dependent disclosure, so a named island is warranted (same
   * justification pattern as `cmp.target-connection-status@1`).
   *
   * TRUTHFULNESS CONTRACT (hard): the component renders ONLY its props.
   * It never fabricates connection or receipt state; when data is absent
   * it says so and renders nothing else. `payloadDigest`, `expiryAt`,
   * `expectedRevision` and the receipt id are echoed verbatim from the
   * server-issued prepare summary / status read. Failure views come as
   * truthful banner text (the G1 partial-banner convention, per-view).
   */
  import type {
    ConfirmationPrepareSummary,
    ConfirmationStatusResult,
  } from '$lib/confirmation/confirmation.js';

  interface Props {
    /** Server-issued prepare summary (human-reviewable); absent = nothing. */
    summary?: ConfirmationPrepareSummary | null;
    /** Single-receipt status read result (truthful; optional). */
    status?: ConfirmationStatusResult | null;
    /** Truthful per-view failure banner text (empty when no failure). */
    bannerText?: string;
    /** Banner tone derives from the journey's failure/success split. */
    bannerTone?: 'neutral' | 'warning' | 'danger';
    label?: string;
  }
  let { summary = null, status = null, bannerText = '', bannerTone = 'warning', label = 'Confirmation journey' }: Props = $props();

  const STATUS_LABELS: Record<string, string> = {
    prepared: 'prepared — awaiting human confirmation',
    consumed: 'consumed — the target effect was created',
    expired: 'expired — expired without effect; prepare again',
    spent: 'spent — already consumed by a different request',
    unavailable: 'unavailable — no matching receipt is visible (non-echoing)',
  };

  function bannerClass(): 'banner banner-warning' | 'banner banner-neutral' | 'banner banner-error' {
    return bannerTone === 'neutral'
      ? 'banner banner-neutral'
      : `banner banner-${bannerTone === 'warning' ? 'warning' : 'error'}`;
  }
</script>

<section class="confirmation-review" role="status" aria-live="polite">
  <h3 class="confirmation-label">{label}</h3>

  {#if bannerText}
    <p class={bannerClass()} role="alert">{bannerText}</p>
  {/if}

  {#if summary === null}
    {#if bannerText === ''}
      <p class="confirmation-empty">No confirmation receipt is being reviewed. Nothing is shown that was not issued by the target.</p>
    {/if}
  {:else}
    <dl class="confirmation-summary">
      <dt>Command</dt>
      <dd class="confirmation-command">{summary.command}</dd>
      <dt>Receipt</dt>
      <dd class="confirmation-receipt">{summary.receiptId}</dd>
      <dt>Payload digest</dt>
      <dd class="confirmation-digest">{summary.payloadDigest}</dd>
      <dt>Expected revision</dt>
      <dd class="confirmation-revision">{summary.expectedRevision ?? 'none recorded'}</dd>
      <dt>Expiry</dt>
      <dd class="confirmation-expiry">{summary.expiryAt}</dd>
    </dl>
  {/if}

  {#if status !== null}
    <p class="confirmation-status">Status: {STATUS_LABELS[status.name] ?? status.name}</p>
  {/if}
</section>

<style>
  .confirmation-review { border: 1px solid #d0d0d0; padding: 1rem; }
  .banner { padding: 0.5rem; margin: 0 0 0.75rem; }
  .banner-warning { background: #fdf6e3; color: #6b4e00; }
  .banner-error { background: #fdecea; color: #7a2413; }
  .banner-neutral { background: #eef2f7; color: #26343f; }
  .confirmation-empty { color: #444; }
  .confirmation-summary dt { font-weight: 600; }
  .confirmation-summary dd { margin: 0 0 0.5rem; overflow-wrap: anywhere; }
</style>