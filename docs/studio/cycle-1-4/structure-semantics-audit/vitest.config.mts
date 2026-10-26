import studio from '../../../../apps/studio/vitest.config';
export default {...studio,test:{...studio.test,include:['../../docs/studio/cycle-1-4/structure-semantics-audit/*.test.ts']}};
