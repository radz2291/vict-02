import {
  isOwnedElementRendered,
  observeOwnedPopupSource,
  registerOwnedPopupLayer,
  isOwnedPopupSourceTarget,
} from './owned-popup.js';
import {ownedFocusableOrder} from './owned-dialog.js';

export interface OwnedTooltipOptions {
  owner: HTMLElement;
  trigger: HTMLElement;
  id: string;
  getPanel: () => HTMLElement | null | undefined;
  isOpen: () => boolean;
  isDisabled?: () => boolean;
  delay?: () => number;
  onOpenChange: (open: boolean) => void;
}

/** Adds/removes only this tooltip's description, retaining current host IDs. */
function describe(trigger: HTMLElement, id: string, open: boolean): void {
  const ids = (trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  const next = [...new Set(ids.filter(value => value !== id).concat(open ? [id] : []))].join(' ');
  if (next === trigger.getAttribute('aria-describedby')) return;
  if (next) trigger.setAttribute('aria-describedby', next);
  else trigger.removeAttribute('aria-describedby');
}

/** Tooltip lifetime only. Keyboard/owner arbitration belongs to the shared hub.
 * No document input listener, autofocus, focus return or body mutation. */
export function createOwnedTooltipBehavior(options: OwnedTooltipOptions): {sync: () => void; dispose: () => void} {
  return createOwnedHoverBehavior(options, 'tooltip');
}

/** Interactive hover content shares lifetime/arbitration, without tooltip
 * description semantics or closing an interactive source on activation. */
export function createOwnedHoverCardBehavior(options: OwnedTooltipOptions): {sync: () => void; dispose: () => void} {
  return createOwnedHoverBehavior(options, 'hovercard');
}

function createOwnedHoverBehavior(options: OwnedTooltipOptions, kind: 'tooltip' | 'hovercard'): {sync: () => void; dispose: () => void} {
  const {owner, trigger, id} = options;
  const view = trigger.ownerDocument.defaultView!;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let hovered = false, panelHovered = false, focused = false, dismissed = false, disposed = false;
  let currentPanel: HTMLElement | null | undefined;
  let releaseLayer: (() => void) | undefined;
  let releasePanel: (() => void) | undefined;
  const disabled = () => options.isDisabled?.() === true || trigger.matches(':disabled,[aria-disabled="true"]');
  const clearTimers = () => {clearTimeout(openTimer); clearTimeout(closeTimer); openTimer = closeTimer = undefined;};
  const request = (next: boolean) => {
    if (disposed) return;
    if (next && (disabled() || dismissed || !isOwnedElementRendered(trigger))) return;
    if (options.isOpen() !== next) options.onOpenChange(next);
  };
  const close = () => {clearTimers(); request(false);};
  const resetDismissal = () => {if (!hovered && !panelHovered && !focused) dismissed = false;};
  const open = (immediate: boolean) => {
    clearTimeout(closeTimer); clearTimeout(openTimer);
    if (disabled() || dismissed) return;
    const configuredDelay = options.delay?.() ?? 700;
    const delay = immediate ? 0 : Number.isFinite(configuredDelay) ? Math.min(10000, Math.max(0, configuredDelay)) : 700;
    if (delay === 0) request(true);
    else openTimer = setTimeout(() => request(true), delay);
  };
  const leave = () => {
    clearTimeout(openTimer); clearTimeout(closeTimer);
    resetDismissal();
    // A brief corridor permits the pointer to reach visible tooltip content.
    if (!hovered && !panelHovered && !focused) closeTimer = setTimeout(() => request(false), 100);
  };
  const contains = (root: HTMLElement | null | undefined, target: EventTarget | null) => {
    // Adoption preserves the creation prototype. The native DOM method performs
    // its own Node brand check across realms; non-Node EventTargets are refused.
    try {return !!root && view.Node.prototype.contains.call(root, target as Node | null);}
    catch {return false;}
  };
  const tabStops = (root: HTMLElement) => ownedFocusableOrder(root, [], owner)
    .filter(item => isOwnedPopupSourceTarget(owner, trigger, item));
  const enterTrigger = (event: PointerEvent) => {if (event.pointerType === 'touch') return; hovered = true; open(false);};
  const leaveTrigger = () => {hovered = false; leave();};
  const focusTrigger = () => {focused = true; open(true);};
  const blurTrigger = (event: FocusEvent) => {focused = contains(currentPanel, event.relatedTarget); leave();};
  const activateTrigger = () => {if (kind === 'tooltip') {dismissed = true; close();}};
  focused = contains(trigger, trigger.ownerDocument.activeElement);
  trigger.addEventListener('pointerenter', enterTrigger);
  trigger.addEventListener('pointerleave', leaveTrigger);
  trigger.addEventListener('focusin', focusTrigger);
  trigger.addEventListener('focusout', blurTrigger);
  trigger.addEventListener('click', activateTrigger);
  const sourceCleanup = observeOwnedPopupSource(owner, trigger, () => {dismissed = true; hovered = panelHovered = focused = false; close();});
  const descriptionObserver = kind === 'tooltip' ? new view.MutationObserver(() => describe(trigger, id, !!currentPanel && options.isOpen() && !disabled())) : undefined;
  descriptionObserver?.observe(trigger, {attributes: true, attributeFilter: ['aria-describedby']});

  function sync(): void {
    if (disposed) return;
    const nextPanel = options.isOpen() && !disabled() ? options.getPanel() : undefined;
    if (nextPanel !== currentPanel) {
      releasePanel?.(); releaseLayer?.(); releasePanel = releaseLayer = undefined;
      currentPanel = nextPanel;
      if (nextPanel) {
        const panel = nextPanel;
        const enter = () => {panelHovered = true; clearTimeout(closeTimer);};
        const exit = () => {panelHovered = false; leave();};
        const focus = () => {focused = true; clearTimeout(closeTimer);};
        const blur = (event: FocusEvent) => {focused = contains(trigger, event.relatedTarget) || contains(panel, event.relatedTarget); leave();};
        panel.addEventListener('pointerenter', enter); panel.addEventListener('pointerleave', exit);
        panel.addEventListener('focusin', focus); panel.addEventListener('focusout', blur);
        releasePanel = () => {panel.removeEventListener('pointerenter', enter); panel.removeEventListener('pointerleave', exit); panel.removeEventListener('focusin', focus); panel.removeEventListener('focusout', blur); panelHovered = false;};
        const layer = registerOwnedPopupLayer({owner, panel, kind, getTrigger: () => trigger,
          onKeydown: event => {
            if (kind === 'hovercard' && event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
              const items = tabStops(panel), active = trigger.ownerDocument.activeElement;
              const enter = !event.shiftKey && contains(trigger, event.target);
              if (enter && items[0]) {event.preventDefault(); items[0].focus({preventScroll: true}); return;}
              if (event.shiftKey && active === items[0]) {event.preventDefault(); trigger.focus({preventScroll: true}); return;}
              if (!event.shiftKey && items.length && active === items[items.length - 1]) {
                // A portal changes physical DOM order. Exit to the source's
                // logical successor, without wrapping or trapping app focus.
                const root = trigger.closest<HTMLElement>('[data-owned-dialog-content]') ?? owner;
                const order = tabStops(root).filter(item => !contains(panel, item));
                const sourceIndex = order.indexOf(trigger), next = sourceIndex >= 0 ? order[sourceIndex + 1] : undefined;
                if (next) {event.preventDefault(); dismissed = true; close(); next.focus({preventScroll: true}); return;}
                return 'continue';
              }
            }
            if (event.key !== 'Escape') return 'continue';
            event.preventDefault(); event.stopPropagation(); dismissed = true;
            const returnFocus = kind === 'hovercard' && contains(panel, trigger.ownerDocument.activeElement);
            close();
            if (returnFocus && isOwnedElementRendered(trigger)) trigger.focus({preventScroll: true});
          },
          onSourceHidden: () => {dismissed = true; close();},
        });
        releaseLayer = () => layer.dispose();
      }
    }
    if (kind === 'tooltip') describe(trigger, id, !!currentPanel && options.isOpen() && !disabled());
    if (disabled()) close();
  }
  return {sync, dispose() {
    if (disposed) return;
    disposed = true; clearTimers(); sourceCleanup(); descriptionObserver?.disconnect(); releasePanel?.(); releaseLayer?.();
    trigger.removeEventListener('pointerenter', enterTrigger); trigger.removeEventListener('pointerleave', leaveTrigger);
    trigger.removeEventListener('focusin', focusTrigger); trigger.removeEventListener('focusout', blurTrigger); trigger.removeEventListener('click', activateTrigger);
    if (kind === 'tooltip') describe(trigger, id, false);
  }};
}
