/** Await transport demand without letting a detached sink retain turn ownership.
 * This does not cancel the pending operation. The hub applies it only after
 * ledger append; compositions wrapping publication callbacks must drain their
 * publication chain before settling the durable turn. Late sink failures remain
 * observed; an aborted delivery can never be reported as successful. */
export function awaitAgentDelivery<T>(
  delivery: T | PromiseLike<T>,
  signal?: AbortSignal,
): Promise<{ delivered: true; value: T } | { delivered: false }> {
  const pending = Promise.resolve(delivery);
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ delivered: false });
    };
    pending.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ delivered: true, value });
      },
      (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}
