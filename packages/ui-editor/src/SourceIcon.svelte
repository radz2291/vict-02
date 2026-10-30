<script lang="ts">
 import {sourceIconPaths,type SourceIconKey} from './source-icon.js';
 let {kind,size=14}:{kind:SourceIconKey;size?:number}=$props();
</script>
<svg data-source-icon={kind} viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={sourceIconPaths[kind]}/></svg>
<style>
 svg{display:block;flex:none}
 svg[data-source-icon=state]{color:var(--source-icon-state,#0f766e)}
 svg[data-source-icon=action]{color:var(--source-icon-action,#7c3aed)}
 svg[data-source-icon=catalog]{color:var(--source-icon-catalog,#3566a4)}
 svg[data-source-icon=route]{color:var(--source-icon-route,#0369a1)}
</style>
