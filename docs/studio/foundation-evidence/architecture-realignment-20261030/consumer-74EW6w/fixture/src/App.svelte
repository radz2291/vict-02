<script lang="ts">
import {DocumentHost,ControlScope} from '@victframework/ui-svelte';
import {createSource,compile,descriptors,implementations} from './fixture';
import '@victframework/ui-svelte/styles.css';import '@victframework/ui-svelte/catalog.css';import '@victframework/ui-flow-svelte/styles.css';
const source=createSource(),plan=compile(source);
</script><h1>Independent review-node fixture</h1><p>Public artifacts and normal registered controls; no execution backend.</p><ControlScope><DocumentHost {plan} localState={source.localState} extensionDescriptors={descriptors} extensionImplementations={implementations} dispatch={async()=>undefined} navigate={()=>{}}/></ControlScope>