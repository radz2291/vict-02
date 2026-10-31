import type { GraphPort } from './editor/model.js';

// Selector-safe UTF-16 encoding is injective even for punctuation or lone
// surrogates accepted by canonical IDs. These are ephemeral renderer IDs only.
function token(value: string) {
  let result = '';
  for (let index = 0; index < value.length; index++)
    result += value.charCodeAt(index).toString(16).padStart(4, '0');
  return result;
}
export function createHandleProjection(owner: string) {
  const id = (nodeId: string, portId: string) =>
    `vict-h:${token(owner)}:${token(nodeId)}:${token(portId)}`;
  return {
    id,
    connection(
      value: {
        source: string;
        target: string;
        sourceHandle?: string | null;
        targetHandle?: string | null;
      },
      portsFor: (nodeId: string) => readonly GraphPort[] | undefined,
    ) {
      const source = portsFor(value.source),
        target = portsFor(value.target);
      if (!source || !target) return;
      // Do not parse opaque IDs: admit only exact currently owned semantic ports.
      const sourcePort = source.find(
        (port) => port.direction === 'output' && id(value.source, port.id) === value.sourceHandle,
      )?.id;
      const targetPort = target.find(
        (port) => port.direction === 'input' && id(value.target, port.id) === value.targetHandle,
      )?.id;
      if (sourcePort === undefined || targetPort === undefined) return;
      return { source: value.source, sourcePort, target: value.target, targetPort };
    },
  };
}
