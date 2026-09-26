/**
 * Product-local coordination between the registered agent surfaces.
 *
 * The renderer's invalidation hook refreshes ROUTE data (standard
 * surfaces); self-fetching product islands subscribe here so a console
 * action also refreshes the picker and the output log. This is plain
 * product code inside one product feature — it grants no authority and
 * touches no renderer machinery.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function onAgentDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyAgentDataChanged(): void {
  for (const listener of [...listeners]) listener();
}
