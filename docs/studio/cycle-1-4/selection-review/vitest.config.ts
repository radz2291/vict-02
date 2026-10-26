import base from '../../../../apps/studio/vitest.config';
export default {...base,test:{...base.test,include:['../../docs/studio/cycle-1-4/selection-review/*.test.ts']}};
