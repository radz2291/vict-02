<script lang="ts">
 import {getContext} from 'svelte';
 import {GRAPH_WORKSPACE,type GraphWorkspaceContext} from '../src/composition/context.js';
 import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
 let {props}:UiSvelteComponentProps=$props();
 const workspace=getContext<GraphWorkspaceContext>(GRAPH_WORKSPACE);
 (globalThis as unknown as {edgeTestContext?:GraphWorkspaceContext}).edgeTestContext=workspace;
</script>
<span data-edge-test-context={!!workspace} aria-label={String(props.label??'Test graph context')}></span>
