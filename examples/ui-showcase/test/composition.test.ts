import { describe, expect, it } from 'vitest';
import {
  compileCompositionPlan,
  requestsApplication,
  workspaceApplication,
} from '../src/lib/application/composition.js';
import { createShowcaseServer } from '../src/lib/server/application-server.js';
describe('independent composition applications', () => {
  it('keeps independent shells and declares the registered planner extension explicitly', async () => {
    const requests = compileCompositionPlan(requestsApplication);
    const workspace = compileCompositionPlan(workspaceApplication);
    expect(requests.applicationId).not.toBe(workspace.applicationId);
    expect(requests.applicationVersion).not.toBe(workspace.applicationVersion);
    expect(requests.components).toEqual([{ componentId: 'cmp.request-planner', revision: '1' }]);
    expect(workspace.components).toEqual([]);
    expect((requests.manifest.composition as { navigation?: string }).navigation).toBe('sidebar');
    expect((workspace.manifest.composition as { navigation?: string }).navigation).toBe('top');
    const a = createShowcaseServer({ plan: requests, foundation: true });
    const b = createShowcaseServer({ plan: workspace, foundation: true });
    expect((await a.loadRoute('/requests'))?.viewData['v.requests']?.rows).toHaveLength(6);
    expect((await b.loadRoute('/workspace'))?.viewData['v.messages']?.rows).toHaveLength(3);
    expect((await b.dispatch('act.create', {})).code).toBe('UNKNOWN_ACTION');
    expect((await a.dispatch('act.failure', { note: 'Draft' })).code).toBe('ACTION_FAILED');
    expect((await a.dispatch('act.denial', { note: 'Draft' })).code).toBe('DATA_UNAUTHORIZED');
  });
});
