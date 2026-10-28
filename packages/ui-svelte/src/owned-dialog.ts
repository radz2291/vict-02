import {registerOwnedPopupLayer, ownedPopupBranches, isOwnedPopupTarget, hasCompetingOwnedPopupOwner as hasCompetingOwner, isOwnedElementRendered as isRendered, ownedDocumentHasFocus as documentOwnsFocus, type OwnedPopupLayer,type OwnedPopupEventResult,type OwnedPopupEventContext} from './owned-popup.js';

/** Application-owned dialog behavior. No document/global event or layer stack. */
export interface OwnedDialogOptions {
  owner: HTMLElement;
  panel: HTMLElement;
  getTrigger?: () => HTMLElement | null | undefined;
  getBranches?: () => readonly HTMLElement[];
  canDismiss?: () => boolean;
  onDismiss: (reason: 'escape' | 'outside') => void;
  focusOnOpen?: boolean;
  lockScroll?: boolean;
}
const locks = new WeakMap<HTMLElement, {count: number; overflow: string}>();
const focusable = 'button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"],audio[controls],video[controls],summary';

export function isOwnedFocusable(item: Element): item is HTMLElement {
  return isRendered(item) && (item.tabIndex >= 0 || item.hasAttribute('tabindex') || item.isContentEditable || item.matches('audio[controls],video[controls],summary'));
}

export function restoreOwnedFocus(original: Element | null, fallback?: HTMLElement | null): void {
  const target = original && isOwnedFocusable(original) ? original : fallback && isOwnedFocusable(fallback) ? fallback : undefined;
  target?.focus({preventScroll: true});
}

/** Canonical native tab order shared by owned dialogs and interactive popups. */
export function ownedFocusableOrder(panel: HTMLElement, branches: readonly HTMLElement[] = [], owner = panel.closest<HTMLElement>('[data-ui-application-viewport]')): HTMLElement[] {
  const roots = [panel, ...branches];
  const sourceOwnerId = panel.dataset.uiOwner ?? panel.closest('[data-ui-owner-root]')?.getAttribute('data-ui-owner-root') ?? undefined;
  const eligible = [...new Set(roots.flatMap(root => Array.from(root.querySelectorAll<HTMLElement>(focusable))))]
    .filter(item => isOwnedFocusable(item) && (!item.hasAttribute('tabindex') || item.tabIndex >= 0) && (!owner || !hasCompetingOwner(owner, item, sourceOwnerId)));
  return eligible.filter(item => {
      if (item.tagName !== 'INPUT') return true;
      const radio = item as HTMLInputElement;
      if (radio.type !== 'radio' || !radio.name) return true;
      const group = eligible.filter((candidate): candidate is HTMLInputElement => candidate.tagName === 'INPUT' && (candidate as HTMLInputElement).type === 'radio' && (candidate as HTMLInputElement).name === radio.name && (candidate as HTMLInputElement).form === radio.form && candidate.getRootNode() === radio.getRootNode());
      // Native radio groups belong to their actual tree/form/name, even if a
      // checked member is outside this panel. It may exclude an owned Tab stop;
      // it never grants focus or popup membership to that outside element.
      const root = radio.getRootNode() as Document | ShadowRoot;
      const checked = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(candidate => candidate.name === radio.name && candidate.form === radio.form && candidate.checked);
      return radio === (checked ?? group[0]);
    })
    .map((item,index)=>({item,index}))
    .sort((a,b)=>(a.item.tabIndex>0?a.item.tabIndex:Infinity)-(b.item.tabIndex>0?b.item.tabIndex:Infinity)||a.index-b.index)
    .map(({item})=>item);
}

export function loopOwnedDialogFocus(event: KeyboardEvent, panel: HTMLElement, branches: readonly HTMLElement[] = [], owner = panel.closest<HTMLElement>('[data-ui-application-viewport]')): void {
  if (event.key !== 'Tab' || event.defaultPrevented) return;
  const roots = [panel, ...branches];
  const items = ownedFocusableOrder(panel, branches, owner);
  const first = items[0], last = items[items.length - 1], active = panel.ownerDocument.activeElement;
  if (!first || !last) { event.preventDefault(); panel.focus({preventScroll: true}); return; }
  if (event.shiftKey && (active === first || !roots.some(root => root.contains(active)))) {
    event.preventDefault(); last.focus({preventScroll: true});
  } else if (!event.shiftKey && (active === last || !roots.some(root => root.contains(active)))) {
    event.preventDefault(); first.focus({preventScroll: true});
  }
}

export function lockOwnedDialogViewport(owner: HTMLElement): () => void {
  const lock = locks.get(owner) ?? {count: 0, overflow: owner.style.overflow};
  lock.count++; locks.set(owner, lock); owner.style.overflow = 'hidden';
  let released = false;
  return () => { if (released) return; released = true; if (--lock.count === 0) { owner.style.overflow = lock.overflow; locks.delete(owner); } };
}

/** Compatibility name delegates to the shared exact branch authority. */
export {ownedPopupBranches as ownedDialogBranches} from './owned-popup.js';

export function createOwnedDialogBehavior(options: OwnedDialogOptions): () => void {
  const {owner, panel} = options, document = panel.ownerDocument;
  const source = options.getTrigger?.() ?? panel;
  const sourceOwnerId = source.dataset.uiOwner ?? source.closest('[data-ui-owner-root]')?.getAttribute('data-ui-owner-root') ?? undefined;
  if (!isOwnedPopupTarget(owner, panel)) throw Error('Owned dialog content must be inside its actual owner and document.');
  let layer: OwnedPopupLayer;
  const releaseScroll = options.lockScroll ? lockOwnedDialogViewport(owner) : () => {};
  let disposed = false, redirecting = false, pointerStartedInside = false, lastFocused: Element | null = panel;
  let roots: HTMLElement[] = [panel];
  const currentRoots = () => (roots = [panel, ...ownedPopupBranches(owner, panel, options.getBranches?.())]);
  const top = () => !disposed && layer.isTopForRestore();
  const element = (target: EventTarget | null): Element | undefined => {
    const Constructor = document.defaultView?.Element;
    if (!Constructor || !target) return undefined;
    // Adoption retains the creation prototype. Borrow the destination DOM
    // method for its Element brand check, as the shared owner hub does.
    try { Constructor.prototype.matches.call(target, '*'); return target as Element; }
    catch { return undefined; }
  };
  const isOwnerTarget = (target: Element) => {
    if (!owner.contains(target)) return false;
    return !hasCompetingOwner(owner, target, sourceOwnerId);
  };
  const includes = (target: Element | null, current = currentRoots()) => !!target && current.some(root => root.contains(target));
  const dismiss = (reason: 'escape' | 'outside') => { if (options.canDismiss?.() !== false) options.onDismiss(reason); };
  const focus = (event: FocusEvent) => {
    const target = element(event.target);
    if (redirecting || !target || !isOwnerTarget(target)) return;
    if (includes(target)) { lastFocused = target; return; }
    // Focus itself precedes focusin. Stop the blocked outside target's handlers
    // before recapture, so automatic tabs cannot activate and remove the dialog.
    event.stopPropagation();
    const next = lastFocused && includes(lastFocused) && isOwnedFocusable(lastFocused) ? lastFocused : panel;
    redirecting = true; (next as HTMLElement).focus({preventScroll: true}); redirecting = false;
  };
  const keydown = (event: KeyboardEvent, context?: OwnedPopupEventContext): OwnedPopupEventResult => {
    const target = context?.target ?? element(event.target);
    if (event.defaultPrevented || !target || !isOwnerTarget(target)) return;
    const current = currentRoots();
    if (event.key === 'Tab') loopOwnedDialogFocus(event, panel, current.slice(1), owner);
    else if (event.key === 'Escape') {
      // A verified open child popup retains its own public library dismissal.
      if (current.length > 1) return 'continue';
      event.preventDefault(); event.stopPropagation(); dismiss('escape');
    } else return 'continue';
  };
  const pointerdown = (event: PointerEvent) => { const target = element(event.target); if (target && isOwnerTarget(target)) pointerStartedInside = includes(target); };
  const click = (event: MouseEvent) => {
    const target = element(event.target), startedInside = pointerStartedInside;
    pointerStartedInside = false;
    if (event.defaultPrevented || !target || !isOwnerTarget(target) || includes(target) || (event.detail !== 0 && startedInside)) return;
    dismiss('outside');
  };
  layer = registerOwnedPopupLayer({owner,panel,kind:'dialog',getTrigger:options.getTrigger,getBranches:options.getBranches,onFocusCapture:focus,onFocusIn:focus,onKeydown:keydown,onPointerDown:pointerdown,onClick:click});
  const originalFocus = document.activeElement;
  if (options.focusOnOpen !== false && documentOwnsFocus(document) && (!originalFocus || !hasCompetingOwner(owner, originalFocus, sourceOwnerId))) panel.focus({preventScroll: true});
  return () => {
    if (disposed) return;
    const wasTop = top(), active = document.activeElement;
    disposed = true;
    layer.dispose();
    releaseScroll();
    if (!wasTop || !documentOwnsFocus(document) || (active && hasCompetingOwner(owner, active, sourceOwnerId)) || (active !== document.body && active !== null && !roots.some(root => root.contains(active)))) return;
    const candidates = [...layer.restoreTargets, options.getTrigger?.() ?? null, ...[...layer.ancestors].reverse().flatMap(ancestor => ancestor.restoreTargets)];
    const target = candidates.find(candidate => {
      if (!candidate || !isOwnedFocusable(candidate)) return false;
      return !hasCompetingOwner(owner, candidate, sourceOwnerId);
    });
    (target as HTMLElement | undefined)?.focus({preventScroll: true});
  };
}
