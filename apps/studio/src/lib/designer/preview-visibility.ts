/** Conservative owned-preview coverage. A viewport intersection alone cannot
 * establish visibility through nested scrolling/clipping containers. */
type VisibilityReason='visible'|'hidden'|'clipped'|'clip-path-unverified'|'clip-geometry-unverified'|'rounded-clip-unverified';
/** Integer client/offset metrics do not establish exact subpixel edges. Use
 * inner bounds for positive proof and outer bounds only for certain refusal. */
function clientAxis(origin:number,extent:number,offset:number,clientStart:number,clientExtent:number){
  if(!Number.isFinite(offset)||offset<=1||extent<=0||![origin,extent,clientStart,clientExtent].every(Number.isFinite)||clientStart<0||clientExtent<0)return undefined;
  const minScale=extent/(offset+1),maxScale=extent/(offset-1);
  return {
    safeStart:Math.min(origin+extent,origin+(clientStart+1)*maxScale),
    safeEnd:Math.max(origin,origin+Math.max(0,clientStart+clientExtent-2)*minScale),
    possibleStart:Math.max(origin,origin+Math.max(0,clientStart-1)*minScale),
    possibleEnd:Math.min(origin+extent,origin+(clientStart+clientExtent+2)*maxScale),
    maxScale,
  };
}
function cornerRadius(value:string,extent:number,maxScale:number):number|undefined {
  const token=value.trim();if(!token||token==='0')return 0;
  const match=/^(\d+(?:\.\d*)?|\.\d+)(px|%)$/.exec(token);
  if(!match)return undefined;
  return Number(match[1])*(match[2]==='%'?extent/100:maxScale);
}
export function previewVisibility(element:HTMLElement):{visible:boolean;reason:VisibilityReason} {
  const doc=element.ownerDocument,view=doc.defaultView;
  const rect=element.getBoundingClientRect();
  if(!view||!element.isConnected||!element.getClientRects().length||rect.width<=0||rect.height<=0)return {visible:false,reason:'hidden'};
  let left=Math.max(0,rect.left),right=Math.min(view.innerWidth,rect.right),top=Math.max(0,rect.top),bottom=Math.min(view.innerHeight,rect.bottom);
  let possibleLeft=left,possibleRight=right,possibleTop=top,possibleBottom=bottom,rounded=false;
  for(let parent:HTMLElement|null=element;parent;parent=parent.parentElement){
    const style=view.getComputedStyle(parent);
    if(style.display==='none'||style.opacity==='0'||parent===element&&(style.visibility==='hidden'||style.visibility==='collapse'))return {visible:false,reason:'hidden'};
    if(style.clipPath&&style.clipPath!=='none')return {visible:false,reason:'clip-path-unverified'};
    // Rect/client metrics can represent translation and positive axis-aligned
    // scaling, but not a rotated/skewed/perspective clipping shape. Refuse that
    // uncertainty rather than use its larger axis-aligned bounding rectangle.
    const transform=style.transform;
    if(transform&&transform!=='none'){
      const matrix=/^matrix\(([^)]+)\)$/.exec(transform)?.[1]?.split(',').map(Number);
      if(!matrix||matrix.length!==6||matrix.some(value=>!Number.isFinite(value))||matrix[0]!<=0||matrix[3]!<=0||Math.abs(matrix[1]!)>1e-8||Math.abs(matrix[2]!)>1e-8)return {visible:false,reason:'clip-geometry-unverified'};
    }
    const scale=style.getPropertyValue('scale');
    if(scale&&scale!=='none'&&!scale.trim().split(/\s+/).every(value=>/^\+?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(value)&&Number.parseFloat(value)>0))return {visible:false,reason:'clip-geometry-unverified'};
    const rotate=style.getPropertyValue('rotate'),perspective=style.getPropertyValue('perspective');
    if(rotate&&rotate!=='none'&&!/^0(?:deg|rad|turn)?$/.test(rotate)||perspective&&perspective!=='none')return {visible:false,reason:'clip-geometry-unverified'};
    if(parent===element)continue;
    const clipsX=/^(hidden|clip|auto|scroll)$/.test(style.overflowX||style.overflow);
    const clipsY=/^(hidden|clip|auto|scroll)$/.test(style.overflowY||style.overflow);
    if(!clipsX&&!clipsY)continue;
    const bounds=parent.getBoundingClientRect();
    // Overflow clips at the inner client box, excluding borders and scrollbar
    // gutters. clientLeft also accounts for a left-hand scrollbar in RTL.
    // DOM client/offset dimensions are rounded layout pixels; bounds include
    // ancestor scale/zoom. A one-layout-pixel uncertainty on each integer
    // measurement prevents rounding from becoming a false positive at an edge.
    const x=clipsX?clientAxis(bounds.left,bounds.width,parent.offsetWidth,parent.clientLeft,parent.clientWidth):undefined;
    const y=clipsY?clientAxis(bounds.top,bounds.height,parent.offsetHeight,parent.clientTop,parent.clientHeight):undefined;
    if(clipsX){
      if(!x)return {visible:false,reason:'clip-geometry-unverified'};
      left=Math.max(left,x.safeStart);right=Math.min(right,x.safeEnd);
      possibleLeft=Math.max(possibleLeft,x.possibleStart);possibleRight=Math.min(possibleRight,x.possibleEnd);
    }
    if(clipsY){
      if(!y)return {visible:false,reason:'clip-geometry-unverified'};
      top=Math.max(top,y.safeStart);bottom=Math.min(bottom,y.safeEnd);
      possibleTop=Math.max(possibleTop,y.possibleStart);possibleBottom=Math.min(possibleBottom,y.possibleEnd);
    }
    if(x&&y){
      // A central inscribed rectangle proves only a subset of a rounded clip.
      // Use the greatest outer corner radius on each axis (conservative also
      // when borders reduce the padding-edge radius or CSS normalizes radii).
      let radiusX=0,radiusY=0;
      for(const property of ['border-top-left-radius','border-top-right-radius','border-bottom-left-radius','border-bottom-right-radius']){
        const tokens=style.getPropertyValue(property).trim().split(/\s+/);
        if(tokens.length>2)return {visible:false,reason:'rounded-clip-unverified'};
        const rx=cornerRadius(tokens[0]??'',bounds.width,x.maxScale),ry=cornerRadius(tokens[1]??tokens[0]??'',bounds.height,y.maxScale);
        if(rx===undefined||ry===undefined)return {visible:false,reason:'rounded-clip-unverified'};
        radiusX=Math.max(radiusX,rx);radiusY=Math.max(radiusY,ry);
      }
      if(radiusX>0||radiusY>0){
        rounded=true;const factor=1-1/Math.sqrt(2);
        left=Math.max(left,x.safeStart+radiusX*factor);right=Math.min(right,x.safeEnd-radiusX*factor);
        top=Math.max(top,y.safeStart+radiusY*factor);bottom=Math.min(bottom,y.safeEnd-radiusY*factor);
      }
    }
  }
  if(right>left&&bottom>top)return {visible:true,reason:'visible'};
  if(possibleRight<=possibleLeft||possibleBottom<=possibleTop)return {visible:false,reason:'clipped'};
  return {visible:false,reason:rounded?'rounded-clip-unverified':'clip-geometry-unverified'};
}
