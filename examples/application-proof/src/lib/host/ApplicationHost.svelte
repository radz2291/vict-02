<script lang="ts">
  /**
   * The GENERIC application host: renders whatever an immutable Application
   * Plan declares. There is no proof-specific markup in here — the same
   * host renders any conforming plan, and every custom component is
   * resolved through the registry by exact id/revision BEFORE anything is
   * rendered (fail fast, fail safe, structured diagnostics).
   *
   * This module is renderer-side only: it imports browser-safe types and
   * diagnostics, never the runtime and never node builtins. All actions
   * cross the server boundary through the injected `dispatch` callable.
   */
  import type { ComponentRegistry } from '@vict/application/renderer';
  import { RendererDiagnostic } from '@vict/application/renderer';

  interface PlanShape {
    routes: {
      route: { id: string; path: string; screenId: string };
      screen: {
        id: string;
        title: string;
        layout: { name: string; surfaces: SurfaceShape[] }[];
        states?: Record<string, SurfaceShape | undefined>;
      };
    }[];
    views: Record<string, { viewId: string; fields?: string[] } | undefined>;
    forms: Record<
      string,
      | {
          formId: string;
          fields: { name: string; label: string; required?: boolean }[];
          submitActionId: string;
        }
      | undefined
    >;
  }

  interface SurfaceShape {
    role: string;
    id: string;
    content?: string;
    viewId?: string;
    formId?: string;
    actionId?: string;
    label?: string;
    componentId?: string;
    revision?: string;
    props?: Record<string, string | number | boolean>;
  }

  export interface ActionResult {
    ok: boolean;
    value?: unknown;
    code?: string;
    message?: string;
  }

  interface Props {
    plan: PlanShape;
    registry: ComponentRegistry;
    dispatch: (actionId: string, input?: unknown) => Promise<ActionResult>;
    rows?: readonly Record<string, unknown>[];
    path?: string;
  }

  let { plan, registry, dispatch, rows = [], path = '/' }: Props = $props();

  const route = plan.routes.find((candidate) => candidate.route.path === path) ?? plan.routes[0];
  if (route === undefined) {
    throw new RendererDiagnostic(
      'RENDERER_INVALID_PLAN',
      `The plan has no route for path '${path}'.`,
    );
  }
  const screen = route.screen;

  // Pre-resolve every custom component BEFORE rendering: an unknown id or a
  // revision mismatch fails with a structured diagnostic instead of
  // rendering a partial surface. The same pass enforces DECLARED role
  // coverage: a surface role this host does not implement is a structured
  // failure, never a silent omission.
  const supportedRoles: readonly string[] = ['text', 'view', 'form', 'action', 'component'];
  const components = new Map<string, unknown>();
  for (const entry of plan.routes) {
    for (const region of entry.screen.layout) {
      for (const surface of region.surfaces) {
        if (!supportedRoles.includes(surface.role)) {
          throw new RendererDiagnostic(
            'RENDERER_UNSUPPORTED_ROLE',
            `Surface '${surface.id}' has role '${surface.role}', which this renderer does not support.`,
            { surfaceId: surface.id, role: surface.role },
          );
        }
        if (surface.role === 'component') {
          const resolved = registry.resolve({
            componentId: surface.componentId ?? '',
            revision: surface.revision ?? '',
          });
          if (!resolved.ok) {
            throw new RendererDiagnostic(
              resolved.code === 'UNKNOWN_COMPONENT'
                ? 'RENDERER_UNKNOWN_COMPONENT'
                : 'RENDERER_COMPONENT_RESOLUTION_FAILED',
              resolved.message,
              { componentId: surface.componentId },
            );
          }
          components.set(surface.id, resolved.implementation);
        }
      }
    }
  }

  let lastResult: ActionResult | null = $state(null);
  let lastAction: string | null = $state(null);
  let formValues: Record<string, string> = $state({});

  function findForm(formId: string) {
    return plan.forms[formId];
  }

  async function submitForm(formId: string): Promise<void> {
    const form = findForm(formId);
    if (form === undefined) {
      return;
    }
    lastAction = form.formId;
    lastResult = await dispatch(form.submitActionId, { ...formValues });
    if (lastResult.ok) {
      formValues = {};
    }
  }

  async function runAction(actionId: string, input?: unknown): Promise<void> {
    lastAction = actionId;
    lastResult = await dispatch(actionId, input);
  }

  const denied = $derived(lastResult !== null && !lastResult.ok && lastResult.code === 'DATA_UNAUTHORIZED');
  const failed = $derived(
    lastResult !== null &&
      !lastResult.ok &&
      lastResult.code !== 'DATA_UNAUTHORIZED' &&
      lastResult.code !== 'CONTRACT_REJECTED',
  );
  const validationFailed = $derived(
    lastResult !== null && !lastResult.ok && lastResult.code === 'CONTRACT_REJECTED',
  );
</script>

<div class="vict-app" data-testid="vict-host">
  <h1>{screen.title}</h1>

  {#each screen.layout as region (region.name)}
    <section data-region={region.name}>
      {#each region.surfaces as surface (surface.id)}
        {#if surface.role === 'text'}
          <p data-surface={surface.id}>{surface.content}</p>
        {:else if surface.role === 'view'}
          {#if rows.length === 0}
            <p data-surface={surface.id} data-state="empty">
              {screen.states?.empty?.role === 'text' ? screen.states.empty.content : 'Nothing here yet.'}
            </p>
          {:else}
            <table data-surface={surface.id}>
              <thead>
                <tr>
                  {#each plan.views[surface.viewId ?? '']?.fields ?? [] as field}
                    <th>{field}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each rows as row (String(row.id))}
                  <tr>
                    {#each plan.views[surface.viewId ?? '']?.fields ?? [] as field}
                      <td>{String(row[field] ?? '')}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        {:else if surface.role === 'form'}
          {@const form = findForm(surface.formId ?? '')}
          <form
            data-surface={surface.id}
            onsubmit={(event) => {
              event.preventDefault();
              void submitForm(surface.formId ?? '');
            }}
          >
            {#each form?.fields ?? [] as field}
              <label>
                {field.label}{field.required === true ? ' *' : ''}
                <input name={field.name} data-field={field.name} bind:value={formValues[field.name]} />
              </label>
            {/each}
            <button type="submit">Submit</button>
          </form>
        {:else if surface.role === 'action'}
          <button data-surface={surface.id} onclick={() => void runAction(surface.actionId ?? '')}>
            {surface.label}
          </button>
        {:else if surface.role === 'component'}
          {@const Component = /** @type {any} */ (components.get(surface.id))}
          <div data-surface={surface.id}>
            <Component {...(surface.props ?? {})} />
          </div>
        {/if}
      {/each}
    </section>
  {/each}

  {#if validationFailed}
    <p role="alert" data-testid="validation-state">
      {screen.states?.validation?.role === 'text' ? screen.states.validation.content : 'Validation failed.'}
    </p>
  {:else if denied}
    <p role="alert" data-testid="denied-state">
      {screen.states?.denied?.role === 'text' ? screen.states.denied.content : 'Denied.'}
    </p>
  {:else if failed}
    <p role="alert" data-testid="failure-state">
      {screen.states?.failure?.role === 'text' ? screen.states.failure.content : 'Failed.'}
    </p>
  {:else if lastResult?.ok}
    <p data-testid="result-state" data-last-action={lastAction}>Done.</p>
  {/if}
</div>

<style>
  .vict-app {
    font-family: system-ui, sans-serif;
    max-width: 42rem;
    margin: 0 auto;
  }
  section {
    margin: 1rem 0;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th,
  td {
    border: 1px solid #ddd;
    padding: 0.3rem 0.6rem;
    text-align: left;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 20rem;
  }
  button {
    align-self: flex-start;
  }
</style>
