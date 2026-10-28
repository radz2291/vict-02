import config from '../../../../packages/ui-ai-svelte/vitest.config.js';
import {fileURLToPath} from 'node:url';
export default {...config,root:fileURLToPath(new URL('../../../../',import.meta.url)),test:{...config.test,include:['docs/studio/foundation-evidence/current-control-independent-20261028/hovercard-keyboard-probe.svelte.test.ts']}};
