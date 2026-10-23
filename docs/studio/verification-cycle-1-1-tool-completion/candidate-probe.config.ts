import studio from '../../../apps/studio/vitest.config.ts';
export default {...studio,server:{fs:{allow:[
'C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1-chat-ui-verification/260831-VCT-02',
'C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1/260831-VCT-02'
]}},test:{...studio.test,maxWorkers:1,include:['../../docs/studio/verification-cycle-1-1-tool-completion/candidate-provider.test.ts']}};

