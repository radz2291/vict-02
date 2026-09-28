import { getContext, setContext } from 'svelte';
import type { ActionResult } from './logic.js';
const actionsKey = Symbol('vict.component-actions');
export interface VictComponentActions {
  /** Runs an action already declared by the owning application, through its host. */
  run(actionId: string, input?: unknown): Promise<ActionResult | void>;
}
export function provideComponentActions(actions: VictComponentActions): void {
  setContext(actionsKey, actions);
}
/** Call at component initialization inside a registered VICT component. */
export function useVictActions(): VictComponentActions {
  const actions = getContext<VictComponentActions | undefined>(actionsKey);
  if (!actions) throw new Error('useVictActions requires a VICT registered component surface.');
  return actions;
}
