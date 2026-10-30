import {isUiValueOfType,type UiDocument,type UiValue} from '@victframework/ui';
/** Keep compatible temporary values; never coerce them or edit authored starting values. */
export function compatiblePreviewValues(document:UiDocument,values:Readonly<Record<string,UiValue>>){
 const retained=Object.fromEntries(Object.entries(values).filter(([key,value])=>document.localState[key]&&isUiValueOfType(value,document.localState[key]!.type)));
 return {values:retained,removed:Object.keys(values).filter(key=>!(key in retained))};
}
