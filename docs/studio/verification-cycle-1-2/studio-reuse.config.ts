// Environment-only allowance for the documented dependency junction reuse.
// The candidate Studio config, test files and product source remain unchanged.
import studio from '../../../apps/studio/vitest.config.js';
export default {...studio,server:{fs:{allow:[
 'C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1-chat-ui-verification/260831-VCT-02',
 'C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1/260831-VCT-02',
]}}};

