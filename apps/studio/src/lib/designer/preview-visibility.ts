/** Conservative owned-preview coverage. A viewport intersection alone cannot
 * establish visibility through nested scrolling/clipping containers. */
export function previewVisibility(element:HTMLElement):{visible:boolean;reason:'visible'|'hidden'|'clipped'|'clip-path-unverified'} {
  const doc=element.ownerDocument,view=doc.defaultView;
  const rect=element.getBoundingClientRect();
  if(!view||!element.isConnected||!element.getClientRects().length||rect.width<=0||rect.height<=0)return {visible:false,reason:'hidden'};
  let left=Math.max(0,rect.left),right=Math.min(view.innerWidth,rect.right),top=Math.max(0,rect.top),bottom=Math.min(view.innerHeight,rect.bottom);
  for(let parent:HTMLElement|null=element;parent;parent=parent.parentElement){
    const style=view.getComputedStyle(parent);
    if(style.display==='none'||style.opacity==='0'||parent===element&&(style.visibility==='hidden'||style.visibility==='collapse'))return {visible:false,reason:'hidden'};
    if(style.clipPath&&style.clipPath!=='none')return {visible:false,reason:'clip-path-unverified'};
    if(parent===element)continue;
    const bounds=parent.getBoundingClientRect();
    if(/^(hidden|clip|auto|scroll)$/.test(style.overflowX||style.overflow)){left=Math.max(left,bounds.left);right=Math.min(right,bounds.right);}
    if(/^(hidden|clip|auto|scroll)$/.test(style.overflowY||style.overflow)){top=Math.max(top,bounds.top);bottom=Math.min(bottom,bounds.bottom);}
  }
  return {visible:right>left&&bottom>top,reason:right>left&&bottom>top?'visible':'clipped'};
}
