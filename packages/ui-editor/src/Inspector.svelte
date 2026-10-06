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
    setConditionalStyle,
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
    /** Declared conditions offered as style targets (media/container only). */
    readonly styleConditions?: readonly {
      readonly id: string;
      readonly label: string;
    }[];
    /**
     * Effective-value hook (host-provided, e.g. getComputedStyle on the
     * canvas DOM). U2-04: the inspector can EXPLAIN the selected value by
     * showing the effective value next to its authored origin.
     */
    readonly readEffective?: (occurrenceKey: string, property: string) => string | undefined;
  }

  let {
    document,
    selectedOccurrence,
    onApply,
    lastIssues = [],
    knownActionIds = [],
    knownRouteIds = [],
    knownTokenIds = [],
    styleConditions = [],
    readEffective,
  }: Props = $props();

  let textValue = $state('');
  let styleProperty = $state('color');
  let styleValue = $state('');
  let useToken = $state(false);
  let attributeName = $state('data-note');
  let attributeValue = $state('');
  let actionId = $state('');
  /** 'base' or a condition id from styleConditions. */
  let styleTarget = $state('base');
  let stylePseudo: 'hover' | 'focus' | 'active' | 'disabled' | undefined = $state(undefined);
  let requestIdCounter = 0;

  const report = $derived(
    selectedOccurrence !== undefined ? resolveOccurrence(selectedOccurrence, document) : undefined,
  );
  const node = $derived(report?.node);
  const nodeKind = $derived(node?.kind);
  /** How many instances of the owning definition exist (U2-01 blast radius). */
  const definitionInstanceCount = $derived.by(() => {
    if (report?.owningDefinitionId === undefined) return 0;
    let count = 0;
    for (const candidate of Object.values(document.nodes ?? {})) {
      if (candidate.kind === 'component' && candidate.definitionId === report.owningDefinitionId) {
        count += 1;
      }
    }
    return count;
  });
  /** Authored origin of the currently edited property (U2-04). */
  const authoredOrigin = $derived.by(() => {
    if (node === undefined || nodeKind !== 'element') return undefined;
    if (node.localStyle?.some((d) => d.property === styleProperty)) {
      return { layer: 'Instance-local (base source)', conditioned: false };
    }
    for (const sourceId of node.styleSources ?? []) {
      const source = document.styleSources?.[sourceId];
      if (source?.declarations.some((d) => d.property === styleProperty)) {
        const condition = source.conditionId ?? undefined;
        return {
          layer: `Attached style source${condition !== undefined ? ` (${condition})` : ''}${source.pseudo !== undefined ? ` :${source.pseudo}` : ''}`,
          conditioned: condition !== undefined,
        };
      }
    }
    return undefined; // not authored on this node — may be inherited/cascade
  });
  const effectiveValue = $derived.by(() => {
    if (readEffective === undefined || selectedOccurrence === undefined || nodeKind != 'element') {
      return undefined;
    }
    return readEffective(selectedOccurrence, styleProperty);
  });

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
      {#if report.instancePath.length > 0}
        <dt>Inside component</dt>
        <dd>
          {#each report.instancePath as step, index}
            {#if index > 0}→{/if}
            <code>{step.definitionId}</code> ({step.sourceNodeId})
          {/each}
          {#if definitionInstanceCount > 0}
            <span class="uv-inspector-note">
              editing the SHARED definition — {definitionInstanceCount}
              {definitionInstanceCount === 1 ? 'instance' : 'instances'} update together
            </span>
          {/if}
        </dd>
      {/if}
      {#if report.portalPath.length > 0}
        <dt>Portal ownership</dt>
        <dd>
          presented through
          {#each report.portalPath as step, index}
            {#if index > 0}→{/if}
            <code>{step.sourceNodeId}</code> → <code>{step.overlayId}</code>
          {/each}
          (rendering unsupported; ownership preserved)
        </dd>
      {/if}
      {#if report.repeatKeys.length > 0}
        <dt>Record keys</dt>
        <dd>{report.repeatKeys.join(' → ')}</dd>
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
        <legend>Style declaration</legend>
        <label>
          Applies to
          <select
            value={styleTarget}
            aria-label="Style target"
            onchange={(event) => {
              styleTarget = (event.currentTarget as HTMLSelectElement).value;
            }}
          >
            <option value="base">Base styling</option>
            {#each styleConditions as condition}
              <option value={condition.id}>{condition.label}</option>
            {/each}
          </select>
        </label>
        {#if styleTarget !== 'base'}
          <p class="uv-inspector-note">
            Editing <strong>{styleConditions.find((c) => c.id === styleTarget)?.label ?? styleTarget}</strong>
            styling — base styling is NOT changed (the rule applies only under that
            condition).
          </p>
        {/if}
        <label>
          Pseudo state
          <select bind:value={stylePseudo} aria-label="Pseudo state">
            <option value={undefined}>— (none)</option>
            <option value="hover">hover</option>
            <option value="focus">focus</option>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
        </label>
        <label>
          Property
          <input type="text" bind:value={styleProperty} aria-label="Style property" />
        </label>
        {#if authoredOrigin !== undefined}
          <p class="uv-inspector-note">
            Authored in: {authoredOrigin.layer}
            {#if effectiveValue !== undefined}
              · effective value: <code>{effectiveValue}</code>
            {/if}
          </p>
        {:else if effectiveValue !== undefined}
          <p class="uv-inspector-note">
            Not authored on this node — effective value: <code>{effectiveValue}</code>
            (cascade/inheritance/token).
          </p>
        {/if}
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
          onclick={() => {
            const value = useToken
              ? { type: 'token', id: styleValue }
              : { type: 'text', value: styleValue };
            if (styleTarget === 'base' && stylePseudo === undefined) {
              apply((id) =>
                setStyle({
                  requestId: id,
                  nodeId: report.sourceNodeId,
                  property: styleProperty,
                  value,
                }),
            );
            } else {
              apply((id) =>
                setConditionalStyle({
                  requestId: id,
                  nodeId: report.sourceNodeId,
                  property: styleProperty,
                  value,
                  ...(styleTarget !== 'base' ? { conditionId: styleTarget } : {}),
                  ...(stylePseudo !== undefined ? { pseudo: stylePseudo } : {}),
                }),
              );
            }
          }}
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
