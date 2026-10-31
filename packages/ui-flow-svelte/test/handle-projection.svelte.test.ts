import { expect, test } from 'vitest';
import { createHandleProjection } from '../src/handle-projection.js';
import type { GraphPort } from '../src/editor/model.js';
const ports: GraphPort[] = [
  { id: 'i', label: 'Input', direction: 'input', type: 'text' },
  { id: 'o', label: 'Output', direction: 'output', type: 'text' },
];
test('projection is injective across viewports/nodes/hostile semantic strings without parsing opaque IDs', () => {
  const values = ['a', 'a:b', 'b:c', '"[]\\', String.fromCharCode(0xd800), '😀'];
  const ids = values.flatMap((owner) =>
    values.flatMap((node) => values.map((port) => createHandleProjection(owner).id(node, port))),
  );
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((id) => /^vict-h:[\da-f]*:[\da-f]*:[\da-f]*$/.test(id))).toBe(true);
});
test('translation admits only current node/viewport/direction and emits canonical ports', () => {
  const own = createHandleProjection('outer'),
    other = createHandleProjection('inner');
  const candidate = {
    source: 'a',
    sourceHandle: own.id('a', 'o'),
    target: 'b',
    targetHandle: own.id('b', 'i'),
  };
  const lookup = (id: string) => (['a', 'b'].includes(id) ? ports : undefined);
  expect(own.connection(candidate, lookup)).toEqual({
    source: 'a',
    sourcePort: 'o',
    target: 'b',
    targetPort: 'i',
  });
  expect(own.connection({ ...candidate, sourceHandle: 'o' }, lookup)).toBeUndefined();
  expect(
    own.connection({ ...candidate, sourceHandle: other.id('a', 'o') }, lookup),
  ).toBeUndefined();
  expect(own.connection({ ...candidate, sourceHandle: own.id('b', 'o') }, lookup)).toBeUndefined();
  expect(own.connection({ ...candidate, targetHandle: own.id('b', 'o') }, lookup)).toBeUndefined();
  expect(own.connection({ ...candidate, target: 'missing' }, lookup)).toBeUndefined();
  expect(
    own.connection(candidate, (id) => lookup(id)?.filter((port) => port.id !== 'i')),
  ).toBeUndefined();
});
