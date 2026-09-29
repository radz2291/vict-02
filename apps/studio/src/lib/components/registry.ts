import { createComponentRegistry } from '@victframework/application/renderer';
import type { ComponentRegistry } from '@victframework/application/renderer';
import TargetConnectionStatus from './TargetConnectionStatus.svelte';
import ConfirmationReview from './ConfirmationReview.svelte';

/**
 * The trusted local component registry of the Studio deployment (code
 * islands live OUTSIDE the serializable manifest). The SAME factory is
 * used by the generic host page and the UI tests, so the deployed
 * component identity is never re-declared text.
 *
 * `cmp.target-connection-status@1` is the NAMED, justified custom
 * operator component: target connection semantics (four truthful
 * states with per-state disclosure) do not fit any shipped surface
 * role — see the justification comment in TargetConnectionStatus.svelte.
 *
 * `cmp.confirmation-review@1` (Stage 9 G2, S9-04 confirmation journey,
 * proposal §6.2): additively registered for the dedicated
 * /confirmations journey route. No existing binding or component is
 * changed; Studio stays read-only for the G1 surface.
 */
export function createStudioRegistry(): ComponentRegistry {
  const registry = createComponentRegistry('registry.studio', '1');
  registry.register({
    componentId: 'cmp.target-connection-status',
    revision: '1',
    implementation: TargetConnectionStatus,
  });
  registry.register({
    componentId: 'cmp.confirmation-review',
    revision: '1',
    implementation: ConfirmationReview,
  });
  return registry;
}
