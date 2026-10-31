/** Pure admission only. This module does not fetch or relax capture refusals. */
export function assertCaptureActive(signal?:AbortSignal):void {
  if(signal?.aborted)throw Object.assign(new Error('STUDIO_CAPTURE_CANCELLED'),{captureReason:'capture-aborted'});
}
/** Stop waiting on owner cancellation without claiming underlying browser work stopped. */
export function awaitCaptureWork<T>(operation:PromiseLike<T>,signal?:AbortSignal):Promise<T> {
  if(!signal)return Promise.resolve(operation);
  return new Promise<T>((resolve,reject)=>{
    const abort=()=>{cleanup();reject(Object.assign(new Error('STUDIO_CAPTURE_CANCELLED'),{captureReason:'capture-aborted'}));};
    const cleanup=()=>signal.removeEventListener('abort',abort);
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(operation).then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
    if(signal.aborted)abort();
  });
}
/** Inspect the JPEG frame dimensions without decompressing untrusted pixels. */
export function captureJpegDimensions(bytes:Uint8Array):{width:number;height:number}|undefined {
  if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8||bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9)return;
  let offset=2;
  while(offset+4<bytes.length){
    if(bytes[offset]!==0xff)return;
    while(bytes[offset]===0xff)offset++;
    const marker=bytes[offset++]!;
    if(marker===0xda||marker===0xd9)return;
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
    const length=(bytes[offset]!<<8)|bytes[offset+1]!;
    if(length<2||offset+length>bytes.length)return;
    if([0xc0,0xc1,0xc2].includes(marker)&&length>=8){
      const height=(bytes[offset+3]!<<8)|bytes[offset+4]!,width=(bytes[offset+5]!<<8)|bytes[offset+6]!;
      return width&&height?{width,height}:undefined;
    }
    offset+=length;
  }
}
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
