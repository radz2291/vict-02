<script lang="ts">
 import SourceIcon from './SourceIcon.svelte';
 import type {SourceIconKey} from './source-icon.js';
 let {icon,name,kindLabel,context,title=name,variant='row'}:{icon:SourceIconKey;name:string;kindLabel?:string;context?:string;title?:string;variant?:'row'|'node'|'card'}=$props();
</script>
<span class="source-identity" data-variant={variant}>
 {#if kindLabel}<span class="identity-kind">{kindLabel}</span>{/if}
 <span class="identity-icon"><SourceIcon kind={icon} size={variant==='node'?16:14}/></span>
 <strong class="identity-name" {title}>{name}</strong>
 {#if context}<small class="identity-context" title={context}>{context}</small>{/if}
</span>
<style>
 .source-identity{display:grid;grid-template-columns:var(--source-identity-icon-size,14px) minmax(0,1fr);column-gap:6px;row-gap:2px;align-items:start;min-width:0;width:100%;text-align:left}
 .identity-kind,.identity-name,.identity-context{grid-column:2;min-width:0}
 .identity-icon{grid-column:1;align-self:start;height:var(--source-identity-line-height,18px);display:flex;align-items:center;color:var(--source-identity-icon-color,var(--ui-editor-muted,var(--vict-color-textMuted,#65748d)))}
 .identity-name{font:inherit;font-weight:var(--source-identity-weight,inherit);line-height:var(--source-identity-line-height,18px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .identity-context,.identity-kind{font:var(--studio-font-meta,400 11px/16px var(--ui-editor-font,system-ui,sans-serif));color:var(--ui-editor-muted,var(--vict-color-textMuted,#65748d));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 [data-variant=node]{--source-identity-icon-size:16px;--source-identity-line-height:20px;row-gap:3px}
 [data-variant=node] .identity-kind{font:var(--studio-font-ui,400 12px/18px system-ui,sans-serif);line-height:18px}
 [data-variant=node] .identity-name,[data-variant=card] .identity-name{display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;white-space:normal;overflow-wrap:anywhere}
 [data-variant=card]{--source-identity-weight:var(--studio-weight-content,500)}
</style>
