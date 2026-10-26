import base from '../../../../apps/studio/vitest.config.js';
export default { ...base, test: { ...base.test, include: ['../../docs/studio/cycle-1-4/node-visibility-review/probe.test.ts'] } };
