import type { UiDocument, UiValue } from '@victframework/ui';
import {
  authoredGraphBinding,
  graphLexicalOwners,
  graphStateDocument,
  graphStateKeys,
  rebaseGraphRuntime,
} from './graph-authoring.js';

/** DocumentHost has already accepted the local write when this callback runs.
 * A refused authored graph edit must reset that internal state as well as the
 * supplied values, even when its canonical value was supplied previously. */
export function graphRuntimeChanged(
  source: UiDocument,
  key: string,
  value: UiValue,
  host: {
    values: Readonly<Record<string, UiValue>>;
    applyGraph: (next: UiDocument) => boolean;
    reset: () => void;
    supply: (values: Record<string, UiValue>) => void;
    invalid: () => void;
  },
): void {
  if (
    !graphLexicalOwners(source).complete &&
    Object.values(source.nodes).some((node) => authoredGraphBinding(node) === key)
  ) {
    const retained = { ...host.values };
    if (source.localState[key]?.type === 'string') retained[key] = source.localState[key]!.initial;
    else delete retained[key];
    host.reset();
    host.supply(retained);
    host.invalid();
    return;
  }
  const next = graphStateDocument(source, key, value);
  const invalid = graphStateKeys(source).includes(key) && !next;
  if (invalid || (next && next !== source && !host.applyGraph(next))) {
    const retained = rebaseGraphRuntime(source, host.values);
    host.reset();
    host.supply(retained);
    if (invalid) host.invalid();
    return;
  }
  host.supply({ ...host.values, [key]: value });
}
