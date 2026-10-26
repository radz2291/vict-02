/** Caption placement uses only the rendered world-coordinate path, never zoom or DOM size. */
export function edgeCaption(path: string, label: string) {
  const width = Math.min(144, Math.max(42, label.length * 6 + 8)),
    height = 20;
  let current = { x: 0, y: 0 };
  const segments: { x: number; y: number; horizontal: boolean; length: number }[] = [];
  for (const match of path.matchAll(/([MLQ])([^MLQ]*)/g)) {
    const values = (match[2]!.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi) ?? []).map(Number);
    const end = { x: values.at(-2) ?? current.x, y: values.at(-1) ?? current.y };
    if (match[1] === 'L') {
      const dx = Math.abs(end.x - current.x),
        dy = Math.abs(end.y - current.y);
      if (dx + dy > 1 && (dx < 0.01 || dy < 0.01))
        segments.push({
          x: (end.x + current.x) / 2,
          y: (end.y + current.y) / 2,
          horizontal: dy < 0.01,
          length: dx + dy,
        });
    }
    current = end;
  }
  const score = (segment: (typeof segments)[number]) =>
    segment.length / (segment.horizontal ? width + 12 : height + 12);
  const segment = segments.sort((a, b) => score(b) - score(a))[0];
  if (!segment) return { x: current.x + 8, y: current.y - height - 6, width, height };
  return {
    x: segment.horizontal ? segment.x - width / 2 : segment.x + 8,
    y: segment.horizontal ? segment.y - height - 6 : segment.y - height / 2,
    width,
    height,
  };
}
