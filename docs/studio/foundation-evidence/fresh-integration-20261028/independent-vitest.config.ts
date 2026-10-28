import studio from '../../../../apps/studio/vitest.config.js';
export default { ...studio, test: { ...studio.test, include: ['../../docs/studio/foundation-evidence/fresh-integration-20261028/independent-schema-check.ts'] } };
