<script lang="ts">
  import * as Message from '../upstream/ui/message/index.js';
  import * as Bubble from '../upstream/ui/bubble/index.js';
  import {Button} from '../upstream/ui/button/index.js';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import Markdown from '../upstream/markdown/markdown.svelte';
  let {role, text, onCopy}:{role:'user'|'assistant';text:string;onCopy?:()=>void}=$props();
</script>
<Message.Root align={role==='user'?'end':'start'}><Message.Content>{#if role==='user'}<Bubble.Root align="end" variant="muted"><Bubble.Content>{text}</Bubble.Content></Bubble.Root>{:else}<Markdown content={text}/>{/if}{#if onCopy}<Message.Footer><Button variant="ghost" size="icon" onclick={onCopy} aria-label="Copy message" title="Copy message"><CopyIcon aria-hidden="true"/></Button></Message.Footer>{/if}</Message.Content></Message.Root>
