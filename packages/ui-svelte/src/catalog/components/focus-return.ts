import { onDestroy } from 'svelte';

/** Use the library's close-auto-focus lifecycle with this occurrence's ref.
 * No saved DOM identity survives replacement or wrapper destruction. */
export function catalogFocusReturn(getTrigger: () => HTMLButtonElement | null): (event: Event) => void {
  let alive = true;
  onDestroy(() => { alive = false; });
  return (event) => {
    event.preventDefault();
    if (!alive) return;
    const trigger = getTrigger();
    if (trigger?.isConnected && !trigger.disabled && !trigger.closest('[inert]')) {
      trigger.focus({ preventScroll: true });
    }
  };
}
