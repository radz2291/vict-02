import {
  isOwnedElementRendered, isOwnedPopupTarget, ownedDocumentHasFocus,
  registerOwnedPopupLayer,ownedPopupBranches,resolveOwnedPopupOwner,isOwnedPopupSourceTarget,
} from './owned-popup.js';

export const OWNED_MENU_CONTEXT = Symbol.for('vict.owned-menu@1');
export type OwnedMenuCloseReason = 'escape' | 'tab' | 'outside' | 'activate' | 'programmatic' | 'source-hidden' | 'arrow-left';
export interface OwnedMenuContext {
  readonly owned: true;
  readonly trigger: () => HTMLElement | undefined;
  readonly panel: () => HTMLElement | undefined;
  readonly parent?: OwnedMenuContext;
  close(reason: OwnedMenuCloseReason, returnFocus?: boolean): void;
  closeAll(reason: OwnedMenuCloseReason, returnFocus?: boolean): void;
  activateChild(child: OwnedMenuContext): void;
  releaseChild(child: OwnedMenuContext): void;
}
export function restoreOwnedMenuFocus(owner:HTMLElement|undefined,panel:HTMLElement,trigger:HTMLElement,previousActive:Element|null=panel.ownerDocument.activeElement):boolean {
  const active=panel.ownerDocument.activeElement;
  const scope=owner??resolveOwnedPopupOwner(trigger,trigger.getAttribute('data-ui-owner')??undefined);
  if(!previousActive||!panel.contains(previousActive)||!trigger.isConnected||!isOwnedElementRendered(trigger)||!ownedDocumentHasFocus(trigger.ownerDocument)||
    !scope||!isOwnedPopupSourceTarget(scope,trigger,previousActive)||(active!==previousActive&&!(active===panel.ownerDocument.body&&!panel.isConnected)))return false;
  trigger.focus({preventScroll:true});return true;
}
export function createOwnedMenuContext(options: {
  trigger: () => HTMLElement | undefined; panel: () => HTMLElement | undefined;
  owner?: () => HTMLElement | undefined; parent?: OwnedMenuContext;
  requestClose: (reason: OwnedMenuCloseReason) => void;
}): OwnedMenuContext {
  let child:OwnedMenuContext|undefined;
  const context: OwnedMenuContext = {
    owned: true, trigger: options.trigger, panel: options.panel, parent: options.parent,
    close(reason, returnFocus = true) {
      const panel = options.panel(), trigger = options.trigger(), owner = options.owner?.();
      const active = panel?.ownerDocument.activeElement;
      child?.close('programmatic',false);child=undefined;
      options.parent?.releaseChild(context);
      if(returnFocus&&reason!=='source-hidden'&&panel&&trigger)restoreOwnedMenuFocus(owner,panel,trigger,active??null);
      // Restore while the actual owned active element still exists. The host's
      // close callback runs afterwards and may deliberately move focus itself.
      options.requestClose(reason);
    },
    closeAll(reason, returnFocus = true) { context.close(reason, returnFocus); options.parent?.closeAll(reason, returnFocus); },
    activateChild(next){if(child===next)return;child?.close('programmatic',false);child=next;},
    releaseChild(next){if(child===next)child=undefined;},
  };
  return context;
}

const itemSelector = '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]';
export function ownedMenuItems(panel: HTMLElement, owner?: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(itemSelector)).filter(item =>
    item.closest('[role="menu"]') === panel && item.getAttribute('aria-disabled') !== 'true' &&
    !item.hasAttribute('disabled') && isOwnedElementRendered(item) && (!owner || isOwnedPopupTarget(owner, item)),
  );
}
export function focusOwnedMenuItem(panel: HTMLElement, edge: 'first' | 'last' | 'selected' = 'first', owner?: HTMLElement): void {
  const items = ownedMenuItems(panel, owner);
  const next = edge === 'last' ? items.at(-1) : edge === 'selected' ? items.find(item => item.getAttribute('aria-checked') === 'true') ?? items[0] : items[0];
  for (const item of items) { item.tabIndex = item === next ? 0 : -1; item.toggleAttribute('data-highlighted',item===next); }
  (next ?? panel).focus({preventScroll: true});
}
export function ownedMenuTriggerKey(event: KeyboardEvent, onOpen: (edge: 'first' | 'last') => void): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return false;
  if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return false;
  const edge=event.key === 'ArrowUp' ? 'last' : 'first';
  event.preventDefault();onOpen(edge);
  const source=event.currentTarget as HTMLElement|null;
  const id=source?.getAttribute?.('aria-controls'),panel=id?source!.ownerDocument.getElementById(id):undefined;
  const owner=source?resolveOwnedPopupOwner(source,source.getAttribute('data-ui-owner')??undefined):undefined;
  if(source&&panel&&owner&&panel.getAttribute('role')==='menu'&&isOwnedPopupTarget(owner,panel)&&
    (panel.getAttribute('aria-labelledby')??'').split(/\s+/).includes(source.id)&&
    (!source.dataset.uiOwner||panel.getAttribute('data-ui-owner')===source.dataset.uiOwner))focusOwnedMenuItem(panel,edge,owner);
  return true;
}

/** Shared menu keyboard engine. Item wrappers retain controlled value outputs;
 * Enter/Space invoke their ordinary click once, never a second action channel. */
export function createOwnedMenuBehavior(options: {
  owner: HTMLElement; panel: HTMLElement; context: OwnedMenuContext;
  getBranches?: () => readonly HTMLElement[];
}): () => void {
  const {owner, panel, context} = options;
  let search = '', searchedAt = 0, pointerStartedInside = false;
  const currentItems = () => ownedMenuItems(panel, owner);
  const branches=()=>ownedPopupBranches(owner,panel,options.getBranches?.());
  const inside=(target:Node)=>panel.contains(target)||branches().some(branch=>branch.contains(target));
  const layer = registerOwnedPopupLayer({
    owner, panel, kind: 'menu', getTrigger: context.trigger, getBranches: branches,
    onKeydown(event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); context.close('escape'); return; }
      if (event.key === 'Tab') { context.closeAll('tab'); return 'continue'; }
      const target = event.target as Element | null;
      if (!target || !panel.contains(target) || target.closest('[role="menu"]') !== panel) return 'continue';
      if(target.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""]'))return 'continue';
      if (event.key === 'ArrowLeft' && context.parent) { event.preventDefault(); event.stopPropagation(); context.close('arrow-left'); return; }
      const items = currentItems(), active = panel.ownerDocument.activeElement as HTMLElement | null;
      const index = active ? items.indexOf(active) : -1;
      let next: HTMLElement | undefined;
      if (event.key === 'ArrowDown') next = items[(index + 1) % items.length];
      else if (event.key === 'ArrowUp') next = items[(index <= 0 ? items.length : index) - 1];
      else if (event.key === 'Home') next = items[0];
      else if (event.key === 'End') next = items.at(-1);
      else if ((event.key === 'Enter' || event.key === ' ') && active && items.includes(active)) {
        event.preventDefault(); event.stopPropagation(); active.click(); return;
      } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const now = Date.now(); search = (now - searchedAt > 700 ? event.key : search + event.key).slice(0,128); searchedAt = now;
        const normalized = search.toLocaleLowerCase();
        const term = [...normalized].every(character => character === normalized[0]) ? normalized[0]! : normalized;
        const ordered = [...items.slice(index + 1), ...items.slice(0, index + 1)];
        next = ordered.find(item => (item.getAttribute('data-text-value') ?? item.textContent ?? '').trim().toLocaleLowerCase().startsWith(term));
      } else return 'continue';
      if (next) { event.preventDefault(); for (const item of items) {item.tabIndex = item === next ? 0 : -1;item.toggleAttribute('data-highlighted',item===next);} next.focus({preventScroll: true}); }
    },
    onFocusIn(event) {
      const item = (event.target as Element | null)?.closest<HTMLElement>(itemSelector);
      if (item && currentItems().includes(item)) for (const candidate of currentItems()) {candidate.tabIndex = candidate === item ? 0 : -1;candidate.toggleAttribute('data-highlighted',candidate===item);}
      return 'continue';
    },
    onPointerDown(event) { pointerStartedInside = inside(event.target as Node);return 'continue'; },
    onClick(event) {
      const target = event.target as Node;
      const beganInside = pointerStartedInside; pointerStartedInside = false;
      if (!inside(target) && !context.trigger()?.contains(target) && !(event.detail !== 0 && beganInside)) context.closeAll('outside', false);
      return 'continue';
    },
  });
  return () => layer.dispose();
}
