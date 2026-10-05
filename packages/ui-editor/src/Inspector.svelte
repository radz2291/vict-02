<script lang="ts">
  /**
   * Inspector — edits the SELECTED source node through exported transactional
   * commands only. U1 bounded surface: text literal, one style declaration
   * (property + text or token value), attribute set, and interaction connect
   * (action id / route id). Every change is a transaction; invalid changes
   * surface the structured diagnostics and leave the source unchanged.
   */
  import type { UiDocument } from '@victframework/ui';
  import { resolveOccurrence } from './occurrence.js';
  import {
    connectInteraction,
    setAttribute,
    setStyle,
    setTextLiteral,
    type TransactionDraft,
  } from './commands.js';

  interface Props {
    readonly document: UiDocument;
    readonly selectedOccurrence?: string;
    readonly onApply: (draft: TransactionDraft) => void;
    readonly lastIssues?: readonly { readonly code: string; readonly message: string }[];
    readonly knownActionIds?: readonly string[];
    readonly knownRouteIds?: readonly string[];
    readonly knownTokenIds?: readonly string[];
  }

  let {
    document,
    selectedOccurrence,
    onApply,
    lastIssues = [],
    knownActionIds = [],
    knownRouteIds = [],
    knownTokenIds = [],
  }: Props = $props();

  let textValue = $state('');
  let styleProperty = $state('color');
  let styleValue = $state('');
  let useToken = $state(false);
  let attributeName = $state('data-note');
  let attributeValue = $state('');
  let actionId = $state('');
  let requestIdCounter = 0;

  const report = $derived(selectedOccurrence !== undefined ? resolveOccurrence(selectedOccurrence, document) : undefined);
  const node = $derived(report?.node);
  const nodeKind = $derived(node?.kind);

  $effect(() => {
    if (node?.kind === 'text' && node.content.type === 'literal') {
      textValue = node.content.value;
    }
  });

  function apply(build: (requestId: string) => TransactionDraft): void {
    requestIdCounter += 1;
    onApply(build(`inspector-${requestIdCounter}`));
  }
</script>

<aside class="uv-inspector" aria-label="Inspector">
  <h2>Inspector</h2>
  {#if report === undefined || node === undefined}
    <p>Select an element in the canvas to inspect its source.</p>
  {:else}
    <dl>
      <dt>Source node</dt>
      <dd>
        <code>{report.sourceNodeId}</code>
      </dd>
      <dt>Kind</dt>
      <dd>{nodeKind}</dd>
      {#if report.owningDefinitionId !== undefined}
        <dt>Definition</dt>
        <dd><code>{report.owningDefinitionId}</code> (instance)</dd>
      {/if}
      {#if report.repeatKeys.length > 0}
        <dt>Record keys</dt>
        <dd>{report.repeatKeys.join(', ')}</dd>
      {/if}
    </dl>

    {#if nodeKind === 'text'}
      <label>
        Text
        <input
          type="text"
          bind:value={textValue}
          aria-label="Text content"
        />
      </label>
      <button type="button" onclick={() => apply((id) => setTextLiteral({ requestId: id, nodeId: report.sourceNodeId, value: textValue }))}>
        Apply text
      </button>
    {/if}

    {#if nodeKind === 'element' || nodeKind === 'component'}
      <fieldset>
        <legend>Style declaration (instance-local)</legend>
        <label>
          Property
          <input type="text" bind:value={styleProperty} aria-label="Style property" />
        </label>
        <label>
          <input type="checkbox" bind:checked={useToken} />
          Token value
        </label>
        {#if useToken}
          <label>
            Token
            <select bind:value={styleValue} aria-label="Token id">
              {#each knownTokenIds as tokenId}
                <option value={tokenId}>{tokenId}</option>
              {/each}
            </select>
          </label>
        {:else}
          <label>
            Value
            <input type="text" bind:value={styleValue} aria-label="Style value" />
          </label>
        {/if}
        <button
          type="button"
          onclick={() =>
            apply((id) =>
              setStyle({
                requestId: id,
                nodeId: report.sourceNodeId,
                property: styleProperty,
                value: useToken ? { type: 'token', id: styleValue } : { type: 'text', value: styleValue },
              }),
            )}
        >
          Apply style
        </button>
      </fieldset>

      {#if nodeKind === 'element'}
        <fieldset>
          <legend>Attribute</legend>
          <label>
            Name
            <input type="text" bind:value={attributeName} aria-label="Attribute name" />
          </label>
          <label>
            Value
            <input type="text" bind:value={attributeValue} aria-label="Attribute value" />
          </label>
          <button
            type="button"
            onclick={() =>
              apply((id) =>
                setAttribute({
                  requestId: id,
                  nodeId: report.sourceNodeId,
                  name: attributeName,
                  value: attributeValue,
                }),
              )}
          >
            Set attribute
          </button>
        </fieldset>

        <fieldset>
          <legend>Interaction (click)</legend>
          <label>
            Action id
            <input type="text" bind:value={actionId} list="uv-known-actions" aria-label="Action id" />
          </label>
          <datalist id="uv-known-actions">
            {#each knownActionIds as known}
              <option value={known}>{known}</option>
            {/each}
          </datalist>
          <button
            type="button"
            onclick={() =>
              apply((id) =>
                connectInteraction({
                  requestId: id,
                  nodeId: report.sourceNodeId,
                  interaction: { on: 'click', action: 'invokeAction', actionId },
                }),
              )}
          >
            Connect action
          </button>
          {#if knownRouteIds.length > 0}
            <label>
              Navigate to route
              <select
                bind:value={actionId}
                aria-label="Route id"
              >
                {#each knownRouteIds as routeId}
                  <option value={routeId}>{routeId}</option>
                {/each}
              </select>
            </label>
            <button
              type="button"
              onclick={() =>
                apply((id) =>
                  connectInteraction({
                    requestId: id,
                    nodeId: report.sourceNodeId,
                    interaction: { on: 'click', action: 'navigate', routeId: actionId },
                  }),
                )}
            >
              Connect navigation
            </button>
          {/if}
        </fieldset>
      {/if}
    {/if}
  {/if}

  {#if lastIssues.length > 0}
    <div class="uv-inspector-issues" role="alert">
      Last change rejected (source unchanged):
      <ul>
        {#each lastIssues as issue}
          <li>{issue.code}: {issue.message}</li>
        {/each}
      </ul>
    </div>
  {/if}
</aside>
