import {lockOwnedDialogViewport} from '@victframework/ui-svelte';
/** Compatibility exports share the renderer's single owned-focus authority. */
export {isOwnedFocusable as isFocusable,restoreOwnedFocus as restoreFocus,loopOwnedDialogFocus as trapFocus} from '@victframework/ui-svelte';
export function lockViewport(panel:HTMLElement):()=>void {
  const owner=panel.closest<HTMLElement>('[data-ui-application-viewport]');
  return owner?lockOwnedDialogViewport(owner):()=>{};
}
