/** Pure admission only. This module does not fetch or relax capture refusals. */
export function approvedCaptureBlobUrl(value: string, sourceBase: string): string | undefined {
  try {
    const base = new URL(sourceBase),
      url = new URL(value);
    if (
      !['http:', 'https:'].includes(base.protocol) ||
      base.username ||
      base.password ||
      url.protocol !== 'blob:' ||
      url.origin !== base.origin
    )
      return;
    const inner = new URL(url.pathname);
    if (inner.username || inner.password || inner.origin !== base.origin) return;
    return url.href;
  } catch {
    return;
  }
}
/** GIF/WebP/AVIF and APNG cannot establish the current animation frame through
 * a source-URL reraster. Static PNG/JPEG have no such frame-restart ambiguity. */
export function isStaticCaptureRaster(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216;
  if (
    mime !== 'image/png' ||
    bytes.length < 20 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((n, index) => bytes[index] === n)
  )
    return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset),
      type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === 'acTL' || offset + length + 12 > bytes.length) return false;
    if (type === 'IEND') return true;
    offset += length + 12;
  }
  return false;
}
