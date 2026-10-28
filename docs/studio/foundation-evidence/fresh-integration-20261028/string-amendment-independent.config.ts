import sourceStudio from './studio-source-mastra.config.js';
// Explicit replacement, not mergeConfig: no inherited broad test include.
export default { ...sourceStudio, test: { ...sourceStudio.test, include: ['../../docs/studio/foundation-evidence/fresh-integration-20261028/string-amendment-independent.test.ts'] } };
