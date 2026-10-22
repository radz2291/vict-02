import { mergeConfig } from 'vite';
import base from '../../../apps/studio/tests/visual/vite.config.ts';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
export default mergeConfig(base, {
  resolve: { alias: [
    { find: '@victframework/ui-svelte/primitives', replacement: root + 'packages/ui-svelte/src/primitives.ts' },
    { find: '@victframework/ui-svelte/styles.css', replacement: root + 'packages/ui-svelte/src/styles.css' },
    { find: /^@victframework\/ui-svelte$/, replacement: root + 'packages/ui-svelte/src/index.ts' },
  ] },
  server: { fs: { allow: [root, 'C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1/260831-VCT-02'] } },
});
