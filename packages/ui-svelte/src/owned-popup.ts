import {autoUpdate, computePosition, flip, offset, shift, type Placement, type VirtualElement} from '@floating-ui/dom';

export type OwnedPopupKind = 'dialog' | 'menu' | 'tooltip' | 'hovercard';
export type OwnedPopupEventResult = void | 'continue';
export interface OwnedPopupEventContext { readonly target: Element }
export interface OwnedPopupLayerOptions {
  owner: HTMLElement;
  panel: HTMLElement;
  kind: OwnedPopupKind;
  getTrigger?: () => HTMLElement | null | undefined;
  getBranches?: () => readonly HTMLElement[];
  onKeydown?: (event: KeyboardEvent, context: OwnedPopupEventContext) => OwnedPopupEventResult;
  /** Optional early focus guard. Existing focusin callbacks retain one call
   * per focusin event and are never invoked for the separate focus event. */
  onFocusCapture?: (event: FocusEvent, context: OwnedPopupEventContext) => OwnedPopupEventResult;
  onFocusIn?: (event: FocusEvent, context: OwnedPopupEventContext) => OwnedPopupEventResult;
  onPointerDown?: (event: PointerEvent, context: OwnedPopupEventContext) => OwnedPopupEventResult;
  onClick?: (event: MouseEvent, context: OwnedPopupEventContext) => OwnedPopupEventResult;
  onSourceHidden?: () => void;
}
export interface OwnedPopupLayer {
  readonly owner: HTMLElement;
  readonly panel: HTMLElement;
  readonly kind: OwnedPopupKind;
  readonly restoreTargets: readonly (Element | null)[];
  readonly ancestors: readonly OwnedPopupLayer[];
  isTop(): boolean;
  /** Cleanup may run after its own panel has been removed. Input arbitration
   * still requires isTop/eligibility; this only excludes other live layers. */
  isTopForRestore(): boolean;
  owns(target: Element): boolean;
  contains(target: Element): boolean;
  dispose(): void;
}
interface Layer extends OwnedPopupLayer { options: OwnedPopupLayerOptions; disposed: boolean; ownerId?: string }
interface Hub { layers: Layer[]; removeListeners: () => void }
const hubs = new WeakMap<HTMLElement, Hub>();

/** DOM adoption changes ownerDocument, not an element's creation prototype.
 * Borrow the destination's DOM method for its cross-realm Element brand check;
 * destination-realm instanceof incorrectly rejects parent-created iframe UI. */
function isElementNode(item: unknown): item is Element {
  if (!item || typeof item !== 'object') return false;
  const Constructor = (item as Element).ownerDocument?.defaultView?.Element;
  if (!Constructor) return false;
  try { return Constructor.prototype.matches.call(item, '*'); }
  catch { return false; }
}

function isHtmlElement(item: unknown): item is HTMLElement {
  return isElementNode(item) && item.namespaceURI === 'http://www.w3.org/1999/xhtml';
}

/** Actual HTML rendering, independent of its creation or destination realm. */
export function isOwnedElementRendered(item: Element): item is HTMLElement {
  if (!isHtmlElement(item) || !item.isConnected || item.matches(':disabled,[aria-disabled="true"]')) return false;
  for (let ancestor: Element | null = item; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'FIELDSET' && ancestor.hasAttribute('disabled')) {
      const legend = Array.from(ancestor.children).find(child => child.tagName === 'LEGEND');
      if (!legend?.contains(item)) return false;
    }
    if (ancestor.tagName === 'DETAILS' && !ancestor.hasAttribute('open')) {
      const summary: Element | undefined = Array.from(ancestor.children).find(child => child.tagName === 'SUMMARY');
      if (!summary?.contains(item)) return false;
    }
    const style = item.ownerDocument.defaultView!.getComputedStyle(ancestor);
    if (ancestor.hasAttribute('hidden') || ancestor.hasAttribute('inert') || ancestor.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  }
  return true;
}

/** Logical source lifetime follows CatalogPortal's policy: aria-hidden alone
 * can be imposed by a document modal and does not make its own popup disappear. */
export function isOwnedPopupSourceVisible(item: Element): item is HTMLElement {
  if (!isHtmlElement(item) || !item.isConnected) return false;
  for (let ancestor: Element | null = item; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor !== item && ancestor.tagName === 'DETAILS' && !ancestor.hasAttribute('open')) {
      const summary: Element | undefined = Array.from(ancestor.children).find(child => child.tagName === 'SUMMARY');
      if (!summary?.contains(item)) return false;
    }
    const style = item.ownerDocument.defaultView!.getComputedStyle(ancestor);
    if (ancestor.hasAttribute('hidden') || ancestor.hasAttribute('inert') || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.contentVisibility === 'hidden') return false;
  }
  return true;
}

export interface OwnedPopupSourceOptions { excludeDisabled?: boolean }
export function isOwnedPopupSourceAvailable(item: Element, options: OwnedPopupSourceOptions = {}): item is HTMLElement {
  if (!isOwnedPopupSourceVisible(item)) return false;
  if (!options.excludeDisabled) return true;
  if (item.matches(':disabled,[aria-disabled="true"]')) return false;
  for (let ancestor: Element | null = item; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'FIELDSET' && ancestor.hasAttribute('disabled')) {
      const legend = Array.from(ancestor.children).find(child => child.tagName === 'LEGEND');
      if (!legend?.contains(item)) return false;
    }
  }
  return true;
}

export function isOwnedPopupSourceTarget(owner: HTMLElement, source: HTMLElement, target: Element): boolean {
  const ownerId = source.dataset.uiOwner ?? source.closest('[data-ui-owner-root]')?.getAttribute('data-ui-owner-root') ?? undefined;
  return isOwnedPopupTarget(owner, source) && !hasCompetingOwnedPopupOwner(owner, source, ownerId) && isOwnedPopupTarget(owner, target) && !hasCompetingOwnedPopupOwner(owner, target, ownerId);
}

export function ownedDocumentHasFocus(document: Document): boolean {
  try {
    if (!document.hasFocus()) return false;
    let window = document.defaultView;
    const visited = new Set<Window>();
    while (window) {
      if (visited.has(window)) return false;
      visited.add(window);
      if (window.parent === window) return true;
      const frame = window.frameElement;
      if (!frame || frame.ownerDocument.activeElement !== frame || !frame.ownerDocument.hasFocus()) return false;
      window = frame.ownerDocument.defaultView;
    }
  } catch { /* Cross-origin/unavailable embedding cannot prove focus ownership. */ }
  return false;
}

export function isOwnedPopupTarget(owner: HTMLElement, target: Element): boolean {
  if (owner.ownerDocument !== target.ownerDocument || !owner.contains(target)) return false;
  return !hasCompetingOwnedPopupOwner(owner, target);
}

export function hasCompetingOwnedPopupOwner(owner: HTMLElement, target: Element, ownerId?: string): boolean {
  if (ownerId) {
    const canonical = target.closest('[data-ui-owner-root]');
    const metadata = target.closest('[data-ui-owner]');
    if (canonical && canonical.getAttribute('data-ui-owner-root') !== ownerId) return true;
    if (metadata && metadata.getAttribute('data-ui-owner') !== ownerId) return true;
  }
  const viewport = owner.closest('[data-ui-application-viewport]');
  const root = owner.closest('[data-ui-owner-root]');
  for (let ancestor: Element | null = target; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor === owner) return false;
    if (hubs.has(ancestor as HTMLElement)) return true;
    if (ancestor.hasAttribute('data-ui-application-viewport') && ancestor !== viewport) return true;
    if (root && ancestor.hasAttribute('data-ui-owner-root') && ancestor !== root) return true;
  }
  return false;
}

/** Prefer the actual application viewport, which includes its sibling portal
 * outlet. Standalone authored hosts use their exact canonical source root. */
export function resolveOwnedPopupOwner(source: HTMLElement, ownerId?: string): HTMLElement | undefined {
  const nearest = source.closest<HTMLElement>('[data-ui-owner-root]');
  if (nearest && ownerId && nearest.getAttribute('data-ui-owner-root') !== ownerId) return undefined;
  const viewport = source.closest<HTMLElement>('[data-ui-application-viewport]');
  if (viewport) return viewport;
  if (nearest) return nearest;
  if (ownerId) {
    const roots = Array.from(source.ownerDocument.querySelectorAll<HTMLElement>('[data-ui-owner-root]')).filter(root => root.getAttribute('data-ui-owner-root') === ownerId && root.contains(source));
    if (roots.length === 1) return roots[0];
    return undefined;
  }
  return undefined;
}

/** Observe only the actual source/owner ancestor chain, using its realm. No
 * source mutation or document-wide event listener is installed. */
export function observeOwnedPopupSource(owner: HTMLElement, source: HTMLElement, onHidden: () => void, onVisibilityChange?: (visible: boolean) => void, options: OwnedPopupSourceOptions = {}): () => void {
  const Constructor = source.ownerDocument.defaultView?.MutationObserver;
  if (!Constructor) return () => {};
  let disposed = false, hidden: boolean | undefined;
  const ownerId = source.dataset.uiOwner ?? source.closest('[data-ui-owner-root]')?.getAttribute('data-ui-owner-root') ?? undefined;
  let observed: Element[] = [];
  const observer = new Constructor(reconcile);
  // The source may be detached and later reinserted under a different parent.
  // A read-only membership observer rechecks only our captured references; it
  // does not discover or grant membership to arbitrary document popups.
  const membership = new Constructor(reconcile);
  if (source.ownerDocument.body) membership.observe(source.ownerDocument.body, {childList:true,subtree:true});
  function reconcile() {
    if (disposed) return;
    const next: Element[] = [];
    for (let item: Element | null = source; item; item = item.parentElement) next.push(item);
    for (let item: Element | null = owner; item; item = item.parentElement) if (!next.includes(item)) next.push(item);
    if (next.length !== observed.length || next.some((item, index) => observed[index] !== item)) {
      observer.disconnect(); observed = next;
      for (const item of next) observer.observe(item, {attributes: true, attributeFilter: ['hidden','inert','class','style','disabled','aria-disabled','open'], childList: true});
    }
    const nextHidden = !isOwnedPopupTarget(owner, source) || hasCompetingOwnedPopupOwner(owner, source, ownerId) || !isOwnedPopupSourceAvailable(source, options) || !owner.isConnected;
    if (nextHidden !== hidden) {
      hidden = nextHidden; onVisibilityChange?.(!nextHidden);
      if (nextHidden) onHidden();
    }
  }
  source.ownerDocument.defaultView?.addEventListener('resize', reconcile);
  reconcile();
  return () => { disposed = true; observer.disconnect(); membership.disconnect(); source.ownerDocument.defaultView?.removeEventListener('resize', reconcile); };
}

function eligible(layer: Layer): boolean {
  const {owner, panel, getTrigger} = layer.options;
  // A dialog's visible content remains modal while its launcher is disabled
  // or hidden. A menu/tooltip instead follows its interactive source lifetime.
  const source = layer.kind === 'dialog' ? panel : getTrigger?.() ?? panel;
  return !layer.disposed && layerOwns(layer, panel) && layerOwns(layer, source) && isOwnedPopupSourceAvailable(source, {excludeDisabled: layer.kind !== 'dialog'}) && isOwnedPopupSourceVisible(panel);
}

function layerOwns(layer: Layer, target: Element): boolean {
  return isOwnedPopupTarget(layer.owner, target) && !hasCompetingOwnedPopupOwner(layer.owner, target, layer.ownerId);
}

/** One owner-local listener hub arbitrates all kinds. A callback handles an
 * event unless it returns 'continue'; no callback also continues. This allows
 * menu Tab closure to reach an enclosing dialog without disabling its trap. */
export function registerOwnedPopupLayer(options: OwnedPopupLayerOptions): OwnedPopupLayer {
  const {owner, panel} = options;
  const trigger = options.getTrigger?.();
  const ownerId = trigger?.dataset.uiOwner ?? trigger?.closest('[data-ui-owner-root]')?.getAttribute('data-ui-owner-root') ?? panel.dataset.uiOwner;
  const source = options.kind === 'dialog' ? panel : trigger ?? panel;
  if (!isOwnedPopupTarget(owner, panel) || !isOwnedPopupTarget(owner, source) || hasCompetingOwnedPopupOwner(owner, panel, ownerId) || hasCompetingOwnedPopupOwner(owner, source, ownerId)) throw Error('Owned popup content must be inside its actual owner and document.');
  let hub = hubs.get(owner);
  if (!hub) {
    const created: Hub = {layers: [], removeListeners: () => {}};
    const dispatch = (name: 'onKeydown'|'onFocusCapture'|'onFocusIn'|'onPointerDown'|'onClick', event: Event) => {
      const originalTarget = event.target;
      if (!isElementNode(originalTarget) || !isOwnedPopupTarget(owner, originalTarget)) return;
      let target: Element = originalTarget;
      const visited = new Set<Layer>();
      while (!event.defaultPrevented) {
        const layer = [...created.layers].reverse().find(item => !visited.has(item) && eligible(item) && layerOwns(item, target));
        if (!layer) return;
        visited.add(layer);
        const callback = layer.options[name] as ((event: Event, context: OwnedPopupEventContext) => OwnedPopupEventResult) | undefined;
        if (!callback) continue;
        const activeBefore = owner.ownerDocument.activeElement;
        // Capture trusted return anchors before a close callback may dispose
        // its layer or remove the original event target from the DOM.
        const returnAnchors = [layer.options.getTrigger?.(), ...layer.restoreTargets, ...layer.ancestors.flatMap(ancestor => [ancestor.panel, ancestor.restoreTargets[0], (ancestor as Layer).options?.getTrigger?.()])];
        if (callback(event, {target}) !== 'continue') return;
        const active = owner.ownerDocument.activeElement;
        if (name === 'onKeydown' && active && (active !== activeBefore || !isOwnedPopupTarget(owner, target)) && layerOwns(layer, active) && returnAnchors.some(anchor => !!anchor && (anchor === active || (layer.ancestors.some(ancestor => ancestor.panel === anchor) && anchor.contains(active))))) target = active;
      }
    };
    const key = (event: KeyboardEvent) => dispatch('onKeydown', event);
    const focusCapture = (event: FocusEvent) => dispatch('onFocusCapture', event);
    const focus = (event: FocusEvent) => dispatch('onFocusIn', event);
    const pointer = (event: PointerEvent) => dispatch('onPointerDown', event);
    const click = (event: MouseEvent) => dispatch('onClick', event);
    owner.addEventListener('keydown', key);
    owner.addEventListener('focus', focusCapture, true);
    owner.addEventListener('focusin', focus, true);
    owner.addEventListener('pointerdown', pointer);
    owner.addEventListener('click', click);
    created.removeListeners = () => {
      owner.removeEventListener('keydown', key); owner.removeEventListener('focus', focusCapture, true); owner.removeEventListener('focusin', focus, true);
      owner.removeEventListener('pointerdown', pointer); owner.removeEventListener('click', click);
    };
    hubs.set(owner, created); hub = created;
  }
  const currentHub = hub;
  let stopSourceObserver = () => {};
  const layer: Layer = {
    owner, panel, kind: options.kind, options, disposed: false,
    ownerId,
    restoreTargets: [owner.ownerDocument.activeElement, options.getTrigger?.() ?? null],
    ancestors: [...hub.layers],
    isTop: () => [...currentHub.layers].reverse().find(item => eligible(item) && item.ownerId === layer.ownerId) === layer,
    isTopForRestore: () => !layer.disposed && !currentHub.layers.slice(currentHub.layers.indexOf(layer) + 1).some(item => item.ownerId === layer.ownerId && eligible(item)),
    owns: target => layerOwns(layer, target),
    contains: target => layerOwns(layer, target) && [panel, ...ownedPopupBranches(owner, panel, options.getBranches?.())].some(root => root.contains(target)),
    dispose: () => {
      if (layer.disposed) return;
      layer.disposed = true; stopSourceObserver();
      const index = currentHub.layers.indexOf(layer);
      if (index !== -1) currentHub.layers.splice(index, 1);
      if (!currentHub.layers.length) { currentHub.removeListeners(); hubs.delete(owner); }
    },
  };
  hub.layers.push(layer);
  if (options.onSourceHidden) stopSourceObserver = observeOwnedPopupSource(owner, options.kind === 'dialog' ? panel : options.getTrigger?.() ?? panel, options.onSourceHidden, undefined, {excludeDisabled: options.kind !== 'dialog'});
  return layer;
}

/** Portal membership is proven by a live control/owned popup pair, not by
 * a document-wide class or a blanket permission for every application portal. */
export function ownedPopupBranches(owner: HTMLElement, panel: HTMLElement, explicit: readonly HTMLElement[] = []): HTMLElement[] {
  const document = panel.ownerDocument;
  const sourceOwnerId = panel.dataset.uiOwner ?? panel.closest('[data-ui-owner-root]')?.getAttribute('data-ui-owner-root') ?? undefined;
  const accepted = new Set<HTMLElement>();
  const inOwner = (node: HTMLElement) => node.ownerDocument === document && owner.contains(node) && node !== owner && !node.contains(panel) && !hasCompetingOwnedPopupOwner(owner, node, sourceOwnerId);
  const popupRole = (node: HTMLElement) => ['dialog','alertdialog','listbox','menu','tree','grid','tooltip'].includes(node.getAttribute('role') ?? '');
  const matches = (node: HTMLElement, sourceOwner: string, occurrence: string) => inOwner(node) && isOwnedElementRendered(node) && node.getAttribute('data-ui-owner') === sourceOwner && node.getAttribute('data-ui-occ') === occurrence && node.hasAttribute('data-ui-part') && popupRole(node);
  for (const node of explicit) if (inOwner(node) && isOwnedElementRendered(node)) accepted.add(node);
  const roots = [panel, ...accepted];
  for (let index = 0; index < roots.length; index++) {
    // Public coded consumers may have no canonical part metadata. A registered
    // live layer supplies stronger actual trigger/panel references; admission
    // still requires a descendant trigger and the exact logical owner group.
    for (const registered of hubs.get(owner)?.layers ?? []) {
      const trigger = registered.options.getTrigger?.();
      const candidate = registered.panel;
      if (!trigger || !roots[index]!.contains(trigger) || candidate === panel || accepted.has(candidate) || (sourceOwnerId && registered.ownerId !== sourceOwnerId) || !eligible(registered) || !inOwner(candidate)) continue;
      accepted.add(candidate); roots.push(candidate);
    }
    for (const trigger of roots[index]!.querySelectorAll<HTMLElement>('[aria-controls],[aria-owns],[aria-describedby],[aria-activedescendant],[aria-expanded="true"][aria-haspopup]')) {
      if (!isOwnedElementRendered(trigger) || hasCompetingOwnedPopupOwner(owner, trigger, sourceOwnerId) || trigger.getAttribute('aria-expanded') === 'false') continue;
      const sourceOwner = trigger.getAttribute('data-ui-owner'), occurrence = trigger.getAttribute('data-ui-occ');
      if (!sourceOwner || !occurrence) continue;
      const references = ['aria-controls','aria-owns','aria-describedby','aria-activedescendant'].flatMap(name => (trigger.getAttribute(name) ?? '').split(/\s+/).filter(Boolean));
      const candidates = new Set<HTMLElement>();
      for (const id of references) {
        const node = document.getElementById(id);
        if (!isHtmlElement(node)) continue;
        candidates.add(node);
        // Select may expose the active option instead of aria-controls.
        const popup=node.closest<HTMLElement>('[role="listbox"],[role="menu"],[role="tree"],[role="grid"]');
        if(popup)candidates.add(popup);
      }
      // Some public popup primitives omit a control ID. Require one unique,
      // visible exact source occurrence paired with an expanded popup trigger.
      const declaredPopup=trigger.getAttribute('aria-haspopup'),expectedRole=declaredPopup==='true'?'menu':declaredPopup;
      if(trigger.getAttribute('aria-expanded')==='true'&&expectedRole&&['dialog','listbox','menu','tree','grid'].includes(expectedRole)){
        const paired=Array.from(owner.querySelectorAll<HTMLElement>('[data-ui-part]')).filter(node=>matches(node,sourceOwner,occurrence)&&node.getAttribute('role')===expectedRole);
        if(paired.length===1)candidates.add(paired[0]!);
      }
      for(const node of candidates){
        if(!accepted.has(node)&&matches(node,sourceOwner,occurrence)){accepted.add(node);roots.push(node);}
      }
    }
  }
  return [...accepted];
}

export interface OwnedPopupPositionOptions {
  owner: HTMLElement;
  trigger: HTMLElement;
  panel: HTMLElement;
  side?: 'top'|'bottom'|'left'|'right';
  align?: 'start'|'center'|'end';
  sideOffset?: number;
  collisionPadding?: number;
  /** Context-menu anchor in owner-document client coordinates. */
  point?: {x: number; y: number};
}
/** Public Floating UI positioning, with no private Bits state or geometry copy.
 * Cleanup fences pending asynchronous computations and all auto-update hooks. */
export function positionOwnedPopup(options: OwnedPopupPositionOptions): () => void {
  const {owner, trigger, panel, side = 'bottom', align = 'start', sideOffset = 4, collisionPadding = 4} = options;
  if (!isOwnedPopupTarget(owner, trigger) || !isOwnedPopupTarget(owner, panel)) throw Error('Owned popup positioning requires an actual same-owner trigger and panel.');
  let disposed = false, revision = 0;
  const placement = `${side}${align === 'center' ? '' : `-${align}`}` as Placement;
  const viewport = owner.closest<HTMLElement>('[data-ui-application-viewport]');
  const boundary = viewport ?? 'clippingAncestors';
  const reference: HTMLElement | VirtualElement = options.point ? {
    contextElement: trigger,
    getBoundingClientRect: () => ({x:options.point!.x,y:options.point!.y,left:options.point!.x,right:options.point!.x,top:options.point!.y,bottom:options.point!.y,width:0,height:0}),
  } : trigger;
  const authoredGeometry = {position:panel.style.position,left:panel.style.left,top:panel.style.top};
  const originalSide = panel.getAttribute('data-side');
  let applied: typeof authoredGeometry | undefined, appliedSide: string | undefined;
  panel.dataset.ownedPopupPosition = 'pending';
  const update = async () => {
    const current = ++revision;
    const result = await computePosition(reference, panel, {placement, strategy: 'fixed', middleware: [offset(sideOffset), flip({boundary, padding: collisionPadding}), shift({boundary, padding: collisionPadding})]});
    if (disposed || current !== revision || !isOwnedPopupTarget(owner, trigger) || !isOwnedPopupTarget(owner, panel)) return;
    if (!Number.isFinite(result.x) || !Number.isFinite(result.y)) { panel.dataset.ownedPopupPosition = 'unavailable'; return; }
    applied = {position: result.strategy, left: `${result.x}px`, top: `${result.y}px`};
    Object.assign(panel.style, applied);
    appliedSide = result.placement.split('-')[0]; panel.dataset.side = appliedSide;
    panel.dataset.ownedPopupPosition = 'ready';
  };
  const stop = autoUpdate(reference, panel, () => { void update().catch(() => {
    if (!disposed) panel.dataset.ownedPopupPosition = 'unavailable';
  }); }, {animationFrame: false});
  // Canonical dynamic part updates can replace the entire style attribute.
  // Restore only our geometry after such a write, keeping authored variables
  // and every other style declaration. Our own writes already match applied.
  const Mutation = panel.ownerDocument.defaultView?.MutationObserver;
  const styleObserver = Mutation ? new Mutation(() => {
    if (disposed) return;
    const drifted = !applied || (['position','left','top'] as const).some(key => panel.style[key] !== applied![key]);
    if (!drifted) return;
    for (const key of ['position','left','top'] as const) if (!applied || panel.style[key] !== applied[key]) authoredGeometry[key] = panel.style[key];
    void update().catch(() => { if (!disposed) panel.dataset.ownedPopupPosition = 'unavailable'; });
  }) : undefined;
  styleObserver?.observe(panel, {attributes:true,attributeFilter:['style']});
  return () => {
    disposed = true; revision++; stop(); styleObserver?.disconnect();
    for (const key of ['position','left','top'] as const) if (applied && panel.style[key] === applied[key]) panel.style[key] = authoredGeometry[key];
    if (appliedSide && panel.getAttribute('data-side') === appliedSide) {
      if (originalSide === null) panel.removeAttribute('data-side'); else panel.setAttribute('data-side', originalSide);
    }
    delete panel.dataset.ownedPopupPosition;
  };
}
