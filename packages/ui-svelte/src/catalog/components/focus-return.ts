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

/** Pickers may coexist with inline calendars or other document hosts. Restrict
 * open focus to this native content ref rather than a document-wide day query. */
export function catalogPickerOpenFocus(getContent: () => HTMLElement | null): (event: Event) => void {
  return (event) => {
    event.preventDefault();
    const content = getContent();
    const day = content?.querySelector<HTMLElement>('[data-bits-day][data-focused]:not([aria-disabled="true"])');
    (day ?? content)?.focus({ preventScroll: true });
  };
}
