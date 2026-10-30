import { describe, expect, it } from 'vitest';
import { graphAuthoringContract, graphAuthoringRegistrations } from '../src/editor/authoring-contract.js';
import { graphWorkspaceDescriptor, graphWorkspaceDescriptorV2 } from '../src/composition/descriptors.js';
import { flowEditorDescriptor, flowEditorDescriptorV2 } from '../src/authoring/descriptors.js';

describe('public graph authoring host registrations', () => {
  it('selects grammar by exact registered identity and retains omitted-revision compatibility', () => {
    expect(graphAuthoringContract('vict.flow.workspace', '2')).toMatchObject({ schema: 'vict.flow-authoring@1', modelVersion: 2 });
    expect(graphAuthoringContract('vict.flow.workspace')?.modelVersion).toBe(1);
    expect(graphAuthoringContract('vict.flow.editor', '2')?.modelVersion).toBe(1);
    expect(graphAuthoringContract('vict.flow.editor')?.revision).toBe('1');
    for (const id of ['vict.flow.viewport', 'vict.flow.port', 'arbitrary.graph', '__proto__']) expect(graphAuthoringContract(id)).toBeUndefined();
    for (const revision of ['', '3', 'latest']) expect(graphAuthoringContract('vict.flow.workspace', revision)).toBeUndefined();
  });

  it('binds host metadata to actual descriptors without granting ordinary controls persistence', () => {
    for (const descriptor of [graphWorkspaceDescriptor, graphWorkspaceDescriptorV2, flowEditorDescriptor, flowEditorDescriptorV2]) {
      const contract = graphAuthoringContract(descriptor.id, descriptor.revision)!;
      expect(descriptor.props).toContainEqual(expect.objectContaining({ name: contract.valueProp, type: 'string' }));
      expect(descriptor.outputs).toContainEqual(expect.objectContaining({ name: contract.changeOutput, payload: 'string' }));
      expect(contract.persistence).toBe('explicit-bidirectional-state');
      if (contract.body) expect(descriptor.scopedSlots).toContain(contract.body.slot);
      expect(Object.isFrozen(contract)).toBe(true);
      if (contract.body) expect(Object.isFrozen(contract.body)).toBe(true);
    }
    expect(Object.isFrozen(graphAuthoringRegistrations)).toBe(true);
    expect(graphAuthoringContract('vict.flow.workspace', '2')?.body).toEqual({ slot: 'body', nodeIdProp: 'nodeId', controlledState: 'node-parameters' });
    expect(graphAuthoringContract('vict.flow.workspace', '1')?.body?.controlledState).toBe('legacy-node-fields');
    expect(graphAuthoringContract('vict.flow.editor', '2')?.body).toBeUndefined();
  });
});
