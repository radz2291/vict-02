<script lang="ts">
 import MessageNode from './MessageNode.svelte';
 import {messageTree} from './markdown.js';
 let {text}:{text:string}=$props();
 const tree=$derived(messageTree(text));
</script>
<div class="chat-markdown"><MessageNode node={tree}/></div>
<style>
 .chat-markdown{font-size:12px;line-height:1.6;white-space:normal;overflow-wrap:anywhere}
 .chat-markdown :global(p){margin:0 0 .7em}.chat-markdown :global(:last-child){margin-bottom:0}
 .chat-markdown :global(h3),.chat-markdown :global(h4){font-size:12px;font-weight:650;line-height:1.5;margin:.9em 0 .4em}
 .chat-markdown :global(h3:first-child),.chat-markdown :global(h4:first-child){margin-top:0}
 .chat-markdown :global(ul),.chat-markdown :global(ol){margin:.4em 0 .8em;padding-left:1.4em}
 .chat-markdown :global(li){padding-left:.1em;margin:.3em 0}.chat-markdown :global(li p){margin:.2em 0}
 .chat-markdown :global(code){font:11px/1.5 ui-monospace,monospace;background:#edf0f5;border-radius:3px;padding:1px 4px;overflow-wrap:anywhere}
 .chat-markdown :global(pre){max-width:100%;overflow:auto;margin:.6em 0;padding:9px;background:#f1f3f7;border-radius:5px;white-space:pre-wrap}
 .chat-markdown :global(pre code){padding:0;background:none}.chat-markdown :global(blockquote){margin:.6em 0;padding-left:10px;border-left:2px solid #cbd3e1;color:#65738a}
 .chat-markdown :global(a){color:#455ca8;text-decoration:underline;text-underline-offset:2px}.chat-markdown :global(hr){border:0;border-top:1px solid #e4e8ef;margin:12px 0}
</style>
