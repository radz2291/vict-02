const dom = globalThis.document;
const postDiagnostic = (diagnostic: unknown) => window.parent.postMessage({ type: 'vict-structure-responsive-diagnostic', diagnostic }, window.location.origin);
const reportError = (error: unknown) => {
  const diagnostic = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) };
  postDiagnostic({ label: 'Harness runtime/startup error; component DOM is preserved', diagnostic, readyState: dom.readyState, bodyPresent: !!dom.body, innerWidth: window.innerWidth });
};
const nativeObserve = MutationObserver.prototype.observe;
MutationObserver.prototype.observe = function(target: Node, options?: MutationObserverInit) {
  try { return nativeObserve.call(this, target, options); }
  catch (error) {
    postDiagnostic({ label: 'Native MutationObserver.observe refused its target; native validation remains unchanged',
      target: { typeof: typeof target, tag: Object.prototype.toString.call(target), constructor: target?.constructor?.name, nodeType: target?.nodeType, nodeName: target?.nodeName, isCurrentRealmNode: target instanceof Node },
      callsite: new Error('MutationObserver.observe callsite').stack,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error) });
    throw error;
  }
};
window.addEventListener('error', event => reportError(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => reportError(event.reason));
window.addEventListener('vict-harness-diagnostic', event => postDiagnostic((event as CustomEvent).detail));
const start = async () => {
  try {
    const [{ mount }, { default: Fixture }] = await Promise.all([import('svelte'), import('./Fixture.svelte')]);
    const target = dom.getElementById('app');
    if (!target || !(target instanceof Node)) throw new Error('The DOM-ready harness mount target is unavailable.');
    mount(Fixture, { target });
  } catch (error) { reportError(error); }
};
if (dom.readyState === 'loading') dom.addEventListener('DOMContentLoaded', () => { void start(); }, { once: true });
else void start();
