<script lang="ts">
  import Conversation from '../src/Conversation.svelte';
  import type { ConversationMessage } from '../src/adapters.js';
  let { messages: initial }: { messages: ConversationMessage[] } = $props();
  let messages = $state<ConversationMessage[]>([]);
  $effect(() => { messages = initial; });
  export function update(next: ConversationMessage[]) { messages = next; }
</script>
<Conversation {messages}/>
