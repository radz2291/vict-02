import { mount } from 'svelte';
import { Conversation, ConversationToolCall, Input, MessageScroller, Patterns, Trace } from '@victframework/ui-ai-svelte';
import '@victframework/ui-ai-svelte/styles.css';
import Fixture from './Fixture.svelte';
if (![Conversation, ConversationToolCall, Input, MessageScroller.Viewport, Patterns.Message, Trace.Line].every(Boolean)) throw new Error('Missing public controls');
mount(Fixture, { target: document.querySelector('#app')! });
