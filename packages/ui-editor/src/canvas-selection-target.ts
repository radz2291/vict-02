import type {UiDocument} from '@victframework/ui';
import {resolveOccurrence} from './occurrence.js';

/** Resolve a visual marker only. Callers supply elements belonging to one canvas owner. */
export function canvasSelectionTarget(document:UiDocument,occurrence:string,elements:readonly HTMLElement[],textContainer=false):HTMLElement|undefined{
 const visible=(element:HTMLElement)=>[...element.getClientRects()].some(rect=>rect.width>0&&rect.height>0);
 const matching=elements.filter(element=>element.dataset.uiOcc===occurrence);
 const exact=matching.find(element=>element.hasAttribute('data-ui-primary'))??matching[0];
 if(!exact||!textContainer||resolveOccurrence(occurrence,document).node?.kind!=='text'||visible(exact))return exact;
 const owner=exact.dataset.uiOwner;if(!owner)return exact;
 const hidden=(element:HTMLElement)=>{const style=getComputedStyle(element);return style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse';};
 if(hidden(exact))return exact;
 let parent=exact.parentElement;
 while(parent){
  if(hidden(parent)||parent.dataset.uiOwner&&parent.dataset.uiOwner!==owner||parent.dataset.uiOwnerRoot&&parent.dataset.uiOwnerRoot!==owner)return exact;
  if(parent.dataset.uiOwner===owner&&parent.dataset.uiOcc&&visible(parent))return parent;
  if(parent.hasAttribute('data-ui-owner-root'))break;
  parent=parent.parentElement;
 }
 return exact;
}
