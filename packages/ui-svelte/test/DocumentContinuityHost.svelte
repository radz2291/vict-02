<script lang="ts">
  import type {UiRenderPlan,UiLocalStateDecl,UiValue,UiExtensionDescriptor} from '@victframework/ui';
  import type {UiSvelteComponentImplementation,UiActionStateConnection} from '../src/document/extensions.js';
  import DocumentHost from '../src/document/DocumentHost.svelte';
  let {plan,localState,onStateChange,onDiagnostic,descriptors=[],implementations=[],dispatch=async()=>undefined,actionState={}}:{plan:UiRenderPlan;localState:Readonly<Record<string,UiLocalStateDecl>>;onStateChange?:(key:string,value:UiValue)=>void;onDiagnostic?:(issue:{code:string})=>void;descriptors?:UiExtensionDescriptor[];implementations?:UiSvelteComponentImplementation[];dispatch?:(id:string,input?:unknown)=>Promise<unknown>;actionState?:Readonly<Record<string,UiActionStateConnection>>}=$props();
  let signal=$state(Symbol('initial')),values=$state<Record<string,UiValue>>({});
  export function supply(next:UiRenderPlan,declarations:Readonly<Record<string,UiLocalStateDecl>>,nextValues:Record<string,UiValue>={}){plan=next;localState=declarations;values=nextValues;}
  export function reset(){signal=Symbol('explicit-reset');}
</script>
<DocumentHost {plan} {localState} stateValues={values} resetSignal={signal} {onStateChange} onRenderDiagnostic={onDiagnostic} extensionDescriptors={descriptors} extensionImplementations={implementations} {dispatch} {actionState} navigate={()=>{}}/>
