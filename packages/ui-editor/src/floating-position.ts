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
  preferred: 'above' | 'below' = 'above',
  previous?: { left: number; top: number; width: number },
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
  // Keep a usable screen position across selection changes. Changing tools must
  // never cause an automatic flip; only a collision or viewport change does.
  if (
    previous &&
    previous.left >= left &&
    previous.left + width <= right &&
    previous.top >= top &&
    previous.top + height <= bottom &&
    (anchor.bottom + 8 <= previous.top ||
      anchor.top >= previous.top + height + 8 ||
      anchor.right + 8 <= previous.left ||
      anchor.left >= previous.left + width + 8)
  ) {
    return { left: previous.left, top: previous.top, width };
  }
  const above = anchor.top - height - 10;
  const below = anchor.bottom + height + 10 <= bottom;
  const y =
    preferred === 'below' && below
      ? anchor.bottom + 10
      : above >= top
        ? above
        : below
          ? anchor.bottom + 10
          : top;
  return {
    left: Math.max(left, Math.min(anchor.left, right - width)),
    top: Math.max(top, Math.min(y, bottom - height)),
    width,
  };
}
