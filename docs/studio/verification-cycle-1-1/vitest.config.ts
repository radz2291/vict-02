import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
export default defineConfig({plugins:[sveltekit()],resolve:{conditions:['browser']},test:{environment:'node',include:['../../docs/studio/verification-cycle-1-1/independent.test.ts']}});
