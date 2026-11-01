import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
export default defineConfig({plugins:[svelte()],resolve:{conditions:['browser']},test:{environment:'node',include:['docs/studio/foundation-evidence/structure-shared-completion-20261101/independent*.test.ts'],server:{deps:{inline:['@xyflow/svelte','@lucide/svelte','@shadcn-svelte/primitives','svelte-streamdown','svelte-toolbelt','bits-ui','runed','@internationalized/date']}}}});
