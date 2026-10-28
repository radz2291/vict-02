import { fileURLToPath } from 'node:url';
import studio from '../../../../apps/studio/vitest.config.js';

// Verify the changed framework source without replacing dependencies under
// the preserved live production server. No new provider or server is started.
export default {
  ...studio,
  resolve: {
    ...studio.resolve,
    alias: { '@victframework/mastra': fileURLToPath(new URL('../../../../packages/mastra/src/index.ts', import.meta.url)) },
  },
  test: { ...studio.test, include: ['tests/designer-agent-mastra.test.ts'] },
};
