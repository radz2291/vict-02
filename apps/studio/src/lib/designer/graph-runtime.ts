import type {UiDocument,UiValue} from '@victframework/ui';
import {graphStateDocument,graphStateKeys,rebaseGraphRuntime} from './graph-authoring.js';

/** DocumentHost has already accepted the local write when this callback runs.
 * A refused authored graph edit must reset that internal state as well as the
 * supplied values, even when its canonical value was supplied previously. */
export function graphRuntimeChanged(source:UiDocument,key:string,value:UiValue,host:{
  values:Readonly<Record<string,UiValue>>;
  applyGraph:(next:UiDocument)=>boolean;
  reset:()=>void;
  supply:(values:Record<string,UiValue>)=>void;
  invalid:()=>void;
}):void {
  const next=graphStateDocument(source,key,value);
  const invalid=graphStateKeys(source).includes(key)&&!next;
  if(invalid||(next&&next!==source&&!host.applyGraph(next))){
    const retained=rebaseGraphRuntime(source,host.values);
    host.reset();host.supply(retained);
    if(invalid)host.invalid();
    return;
  }
  host.supply({...host.values,[key]:value});
}
