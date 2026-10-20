export interface FloatingBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
/** Prefer clear space above/below the selection, then clamp to its visible editing surface. */
export function floatingPlacement(
  anchor: FloatingBounds,
  visible: FloatingBounds,
  height: number,
): { left: number; top: number; width: number } | undefined {
  const { left, right, top, bottom } = visible;
  if (
    anchor.bottom <= top ||
    anchor.top >= bottom ||
    anchor.right <= left ||
    anchor.left >= right ||
    right <= left ||
    bottom <= top
  )
    return undefined;
  const width = Math.min(480, right - left);
  const above = anchor.top - height - 10;
  const y = above >= top ? above : anchor.bottom + height + 10 <= bottom ? anchor.bottom + 10 : top;
  return {
    left: Math.max(left, Math.min(anchor.left, right - width)),
    top: Math.max(top, Math.min(y, bottom - height)),
    width,
  };
}
