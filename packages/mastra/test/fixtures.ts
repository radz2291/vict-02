import { defineAgentProfile, AGENT_PROFILE_SCHEMA } from '@vict/sdk';
import type { AgentProfileAuthoring, AgentReference } from '@vict/sdk';

/**
 * Shared Stage 06A fixtures: a complete valid agent profile, its artifacts,
 * and a one-call registry/adapter composition used by the kernel, runtime,
 * and adapter suites. All fixtures are deterministic — no clock, no random.
 */

export const AGENT_ID = 'agent.ara.offline';
export const AGENT_REVISION = '1';

export const instructionsRef: AgentReference = { id: 'instructions.ara', revision: '1' };
export const memoryPolicyRef: AgentReference = { id: 'memory-policy.ara', revision: '1' };
export const helperToolRef: AgentReference = { id: 'helper.uppercase', revision: '1' };
export const guardrailRef: AgentReference = { id: 'guardrail.length', revision: '1' };

/** The complete valid profile used as the identity-vector baseline. */
export function validProfileInput(): AgentProfileAuthoring {
  return {
    schema: AGENT_PROFILE_SCHEMA,
    id: AGENT_ID,
    revision: AGENT_REVISION,
    instructions: instructionsRef,
    modelProfile: {
      id: 'model.ara.offline',
      revision: '1',
      routerModel: `${'offline-fixture'}/deterministic-1`,
      provider: 'offline-fixture',
      providerCredentialVar: 'OFFLINE_FIXTURE_UNUSED',
    },
    generation: { temperature: 0, maxOutputTokens: 512 },
    turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'fail-closed' },
    memoryPolicy: memoryPolicyRef,
    guardrails: [guardrailRef],
    helperTools: [helperToolRef],
    capabilities: [
      { id: 'cap.notes.write', revision: '2' },
      { id: 'cap.notes.read', revision: '1' },
    ],
    adapter: {
      id: '@vict/mastra',
      revision: '1',
      runtimePackages: {
        '@mastra/core': '1.64.0',
        '@mastra/memory': '1.28.2',
        '@mastra/libsql': '1.22.3',
        '@mastra/observability': '1.17.5',
      },
    },
  };
}

/** A valid profile compiled through the SDK factory (deep-frozen capture). */
export function validAuthoredProfile(): AgentProfileAuthoring {
  return defineAgentProfile(validProfileInput());
}
