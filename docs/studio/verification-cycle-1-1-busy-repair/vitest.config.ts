import studio from '../../../apps/studio/vitest.config.js';
export default {...studio,server:{fs:{allow:[
 'C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1-verification/260831-VCT-02',
 'C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1/260831-VCT-02',
]}},test:{...studio.test,include:[
 'tests/designer-agent-mastra.test.ts','tests/ui/agent-chat.test.ts',
 '../../docs/studio/verification-cycle-1-1-busy-repair/lifecycle.test.ts',
]}};
