<script lang="ts">
  /**
   * The `conversation` role: message history with distinct participant
   * roles, a validated input, and a DECLARED send action (mutation or
   * durable capability) executed below the UI. Safe failure of the send
   * action surfaces through the host's state alerts.
   */
  import type { VictPlanView, PlanSurface, ActionResult } from './logic.js';
  
  interface Props {
    surface: PlanSurface;
    plan: VictPlanView;
    initialRows: readonly Record<string, unknown>[];
    dispatch: (actionId: string, input?: unknown) => Promise<ActionResult>;
    onInvalidate?: () => void;
  }

  let { surface, plan, initialRows, dispatch, onInvalidate }: Props = $props();

  const messageField = $derived(str(surface.messageField));
  const authorField = $derived(str(surface.authorField));
  const participantField = $derived(str(surface.participantField));

  function str(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  // The feed is route data; local draft state only. Updating `initialRows`
  // (after invalidation) re-renders the feed without losing focus.
  let draft = $state('');
  let sending = $state(false);

  const view = $derived(plan.views?.[String(surface.viewId)] as { emptyMessage?: string } | undefined);

  async function send(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const text = draft.trim();
    if (text === '' || sending) {
      return;
    }
    sending = true;
    try {
      const result = await dispatch(str(surface.sendActionId), {
        text,
        author: 'You',
        participant: 'user',
      });
      if (result.ok) {
        draft = '';
        if (onInvalidate !== undefined) {
          onInvalidate();
        }
      }
    } finally {
      sending = false;
    }
  }
</script>

<section class="vict-conversation-panel" data-surface={surface.id} aria-label="Conversation">
  <div class="vict-conversation" data-testid="conversation-feed" aria-live="polite">
    {#if initialRows.length === 0}
      <p class="vict-state" data-state="empty">
        {str(surface.emptyMessage) || str(view?.emptyMessage) || 'No messages yet. Say hello!'}
      </p>
    {:else}
      {#each initialRows as message, index (index)}
        {@const participant = str(message[participantField]) || 'user'}
        <article
          class="vict-conversation-message vict-conversation-message--{participant}"
          data-testid="conversation-message"
          data-participant={participant}
        >
          <p class="vict-conversation-meta">
            {str(message[authorField])}
            {#if participant !== ''}
              · {participant}
            {/if}
          </p>
          <p class="vict-conversation-body">{str(message[messageField])}</p>
        </article>
      {/each}
    {/if}
  </div>
  <form class="vict-conversation-input" onsubmit={(event) => void send(event)}>
    <label class="vict-field-label" for="vict-conversation-input-{String(surface.id)}">
      {str(surface.inputLabel)}
    </label>
    <div class="vict-conversation-input-row">
      <input
        class="vict-input"
        id="vict-conversation-input-{String(surface.id)}"
        data-testid="conversation-input"
        name="message"
        autocomplete="off"
        placeholder={str(surface.inputPlaceholder)}
        bind:value={draft}
      />
      <button class="vict-btn" type="submit" data-testid="conversation-send" disabled={sending || draft.trim() === ''}>
        Send
      </button>
    </div>
  </form>
</section>

<style>
  .vict-conversation-panel {
    background: var(--vict-color-surface);
    border: 1px solid var(--vict-color-border);
    border-radius: var(--vict-radius-base);
    padding: calc(var(--vict-spacing-unit) * 3);
  }

  .vict-conversation-input {
    margin-top: calc(var(--vict-spacing-unit) * 2);
    display: flex;
    flex-direction: column;
    gap: calc(var(--vict-spacing-unit) * 1);
  }

  .vict-conversation-input-row {
    display: flex;
    gap: calc(var(--vict-spacing-unit) * 1);
  }

  .vict-conversation-input-row .vict-input {
    flex: 1;
  }
</style>
