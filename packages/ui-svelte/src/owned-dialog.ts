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
interface OwnedLayer {
  panel: HTMLElement;
  restoreTargets: (Element | null)[];
}
const layers = new WeakMap<HTMLElement, OwnedLayer[]>();
const locks = new WeakMap<HTMLElement, {count: number; overflow: string}>();
const focusable = 'button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"],audio[controls],video[controls],summary';

function isRendered(item: Element): item is HTMLElement {
  const Constructor = item.ownerDocument.defaultView?.HTMLElement;
  if (!Constructor || !(item instanceof Constructor) || !item.isConnected || item.matches(':disabled,[aria-disabled="true"]')) return false;
  for (let ancestor: Element | null = item; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'FIELDSET' && ancestor.hasAttribute('disabled')) {
      const legend = Array.from(ancestor.children).find(child => child.tagName === 'LEGEND');
      if (!legend?.contains(item)) return false;
    }
    if (ancestor.tagName === 'DETAILS' && !ancestor.hasAttribute('open')) {
      const summary = Array.from(ancestor.children).find(child => child.tagName === 'SUMMARY');
      if (!summary?.contains(item)) return false;
    }
    const style = item.ownerDocument.defaultView!.getComputedStyle(ancestor);
    if (ancestor.hasAttribute('hidden') || ancestor.hasAttribute('inert') || ancestor.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  }
  return true;
}

export function isOwnedFocusable(item: Element): item is HTMLElement {
  return isRendered(item) && (item.tabIndex >= 0 || item.hasAttribute('tabindex') || item.isContentEditable || item.matches('audio[controls],video[controls],summary'));
}

/** Marker boundaries and active explicitly registered owners use the same
 * identity check for events, initial focus, return focus and portal branches. */
function hasCompetingOwner(owner: HTMLElement, target: Element): boolean {
  const ownerBoundary = owner.closest('[data-ui-application-viewport]');
  for (let ancestor: Element | null = target; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor === owner) return false;
    if (layers.has(ancestor as HTMLElement)) return true;
    if (ancestor.hasAttribute('data-ui-application-viewport')) return ancestor !== ownerBoundary;
  }
  return false;
}

function documentOwnsFocus(document: Document): boolean {
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
  } catch { /* Cross-origin or unavailable embedding cannot prove focus ownership. */ }
  return false;
}

export function restoreOwnedFocus(original: Element | null, fallback?: HTMLElement | null): void {
  const target = original && isOwnedFocusable(original) ? original : fallback && isOwnedFocusable(fallback) ? fallback : undefined;
  target?.focus({preventScroll: true});
}

export function loopOwnedDialogFocus(event: KeyboardEvent, panel: HTMLElement, branches: readonly HTMLElement[] = [], owner = panel.closest<HTMLElement>('[data-ui-application-viewport]')): void {
  if (event.key !== 'Tab' || event.defaultPrevented) return;
  const roots = [panel, ...branches];
  const eligible = [...new Set(roots.flatMap(root => Array.from(root.querySelectorAll<HTMLElement>(focusable))))]
    .filter(item => isOwnedFocusable(item) && (!item.hasAttribute('tabindex') || item.tabIndex >= 0) && (!owner || !hasCompetingOwner(owner, item)));
  const items = eligible.filter(item => {
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

/** Portal membership is proven by a live control/owned popup pair, not by
 * a document-wide class or a blanket permission for every application portal. */
export function ownedDialogBranches(owner: HTMLElement, panel: HTMLElement, explicit: readonly HTMLElement[] = []): HTMLElement[] {
  const document = panel.ownerDocument;
  const accepted = new Set<HTMLElement>();
  const inOwner = (node: HTMLElement) => node.ownerDocument === document && owner.contains(node) && node !== owner && !node.contains(panel) && !hasCompetingOwner(owner, node);
  const popupRole = (node: HTMLElement) => ['dialog','alertdialog','listbox','menu','tree','grid','tooltip'].includes(node.getAttribute('role') ?? '');
  const matches = (node: HTMLElement, sourceOwner: string, occurrence: string) => inOwner(node) && isRendered(node) && node.getAttribute('data-ui-owner') === sourceOwner && node.getAttribute('data-ui-occ') === occurrence && node.hasAttribute('data-ui-part') && popupRole(node);
  for (const node of explicit) if (inOwner(node) && isRendered(node)) accepted.add(node);
  const roots = [panel, ...accepted];
  for (let index = 0; index < roots.length; index++) {
    for (const trigger of roots[index]!.querySelectorAll<HTMLElement>('[aria-controls],[aria-owns],[aria-describedby],[aria-activedescendant],[aria-expanded="true"][aria-haspopup]')) {
      if (!isRendered(trigger) || hasCompetingOwner(owner, trigger) || trigger.getAttribute('aria-expanded') === 'false') continue;
      const sourceOwner = trigger.getAttribute('data-ui-owner'), occurrence = trigger.getAttribute('data-ui-occ');
      if (!sourceOwner || !occurrence) continue;
      const references = ['aria-controls','aria-owns','aria-describedby','aria-activedescendant'].flatMap(name => (trigger.getAttribute(name) ?? '').split(/\s+/).filter(Boolean));
      const candidates = new Set<HTMLElement>();
      for (const id of references) {
        const node = document.getElementById(id);
        const Constructor = document.defaultView?.HTMLElement;
        if (!Constructor || !(node instanceof Constructor)) continue;
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

export function createOwnedDialogBehavior(options: OwnedDialogOptions): () => void {
  const {owner, panel} = options, document = panel.ownerDocument;
  if (owner.ownerDocument !== document || !owner.contains(panel) || hasCompetingOwner(owner, panel)) throw Error('Owned dialog content must be inside its actual owner and document.');
  const stack = layers.get(owner) ?? [];
  const ancestors = [...stack];
  const layer: OwnedLayer = {panel, restoreTargets: [document.activeElement, options.getTrigger?.() ?? null]};
  stack.push(layer); layers.set(owner, stack);
  const releaseScroll = options.lockScroll ? lockOwnedDialogViewport(owner) : () => {};
  let disposed = false, redirecting = false, pointerStartedInside = false, lastFocused: Element | null = panel;
  let roots: HTMLElement[] = [panel];
  const currentRoots = () => (roots = [panel, ...ownedDialogBranches(owner, panel, options.getBranches?.())]);
  const top = () => !disposed && stack.at(-1) === layer;
  const element = (target: EventTarget | null) => { const Constructor = document.defaultView?.Element; return Constructor && target instanceof Constructor ? target : undefined; };
  const isOwnerTarget = (target: Element) => {
    if (!owner.contains(target)) return false;
    return !hasCompetingOwner(owner, target);
  };
  const includes = (target: Element | null, current = currentRoots()) => !!target && current.some(root => root.contains(target));
  const dismiss = (reason: 'escape' | 'outside') => { if (options.canDismiss?.() !== false) options.onDismiss(reason); };
  const focus = (event: FocusEvent) => {
    const target = element(event.target);
    if (!top() || redirecting || !target || !isOwnerTarget(target)) return;
    if (includes(target)) { lastFocused = target; return; }
    const next = lastFocused && includes(lastFocused) && isOwnedFocusable(lastFocused) ? lastFocused : panel;
    redirecting = true; (next as HTMLElement).focus({preventScroll: true}); redirecting = false;
  };
  const keydown = (event: KeyboardEvent) => {
    const target = element(event.target);
    if (!top() || event.defaultPrevented || !target || !isOwnerTarget(target)) return;
    const current = currentRoots();
    if (event.key === 'Tab') loopOwnedDialogFocus(event, panel, current.slice(1), owner);
    else if (event.key === 'Escape') {
      // A verified open child popup retains its own public library dismissal.
      if (current.length > 1) return;
      event.preventDefault(); event.stopPropagation(); dismiss('escape');
    }
  };
  const pointerdown = (event: PointerEvent) => { const target = element(event.target); if (top() && target && isOwnerTarget(target)) pointerStartedInside = includes(target); };
  const click = (event: MouseEvent) => {
    const target = element(event.target), startedInside = pointerStartedInside;
    pointerStartedInside = false;
    if (!top() || event.defaultPrevented || !target || !isOwnerTarget(target) || includes(target) || (event.detail !== 0 && startedInside)) return;
    dismiss('outside');
  };
  owner.addEventListener('focusin', focus, true);
  owner.addEventListener('keydown', keydown);
  owner.addEventListener('pointerdown', pointerdown);
  owner.addEventListener('click', click);
  const originalFocus = document.activeElement;
  if (options.focusOnOpen !== false && documentOwnsFocus(document) && (!originalFocus || !hasCompetingOwner(owner, originalFocus))) panel.focus({preventScroll: true});
  return () => {
    if (disposed) return;
    const wasTop = top(), active = document.activeElement;
    disposed = true;
    owner.removeEventListener('focusin', focus, true); owner.removeEventListener('keydown', keydown);
    owner.removeEventListener('pointerdown', pointerdown); owner.removeEventListener('click', click);
    const index = stack.indexOf(layer); if (index !== -1) stack.splice(index, 1);
    if (!stack.length) layers.delete(owner);
    releaseScroll();
    if (!wasTop || !documentOwnsFocus(document) || (active && hasCompetingOwner(owner, active)) || (active !== document.body && active !== null && !roots.some(root => root.contains(active)))) return;
    const candidates = [...layer.restoreTargets, options.getTrigger?.() ?? null, ...ancestors.reverse().flatMap(ancestor => ancestor.restoreTargets)];
    const target = candidates.find(candidate => {
      if (!candidate || !isOwnedFocusable(candidate)) return false;
      return !hasCompetingOwner(owner, candidate);
    });
    (target as HTMLElement | undefined)?.focus({preventScroll: true});
  };
}
