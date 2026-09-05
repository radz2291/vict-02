import { createTool } from '@mastra/core/tools';
import type {
  AgentArtifactBinding,
  AgentHelperToolArtifact,
  AgentHelperToolIO,
} from '@vict/runtime';

/**
 * Mastra-native helper tools (Stage 06A, amendment §6.5).
 *
 * A helper tool is allowed ONLY as genuinely pure (deterministic
 * formatting/computation/text transformation/in-context list manipulation).
 * This module is the ONLY place helper-tool definitions cross into Mastra
 * tool construction, and it enforces the full §6.5 discipline at the
 * boundary:
 *
 * - contract-invalid input NEVER invokes the implementation: the neutral
 *   contract parse runs first and a stable sanitized denial is returned;
 * - contract-invalid output fails safely: the result never reaches the
 *   model unvalidated;
 * - thrown errors (including secret-bearing canaries and nested causes)
 *   are reduced to stable non-echoing codes — raw thrown content, message
 *   text, and stack traces never re-enter the model context;
 * - the definition bound into the activation snapshot is frozen: a
 *   post-activation mutation of the caller's definition cannot widen the
 *   tool's authority metadata or swap its implementation;
 * - helper outputs remain untrusted model input: they are data, never
 *   authority (AI-14); no capability allowlist, permission, or approval
 *   decision can be expressed through a helper.
 */

/** Stable sanitized helper-tool failure codes (never raw error content). */
export type HelperToolFailureCode =
  | 'VICT_HELPER_INPUT_CONTRACT_REJECTED'
  | 'VICT_HELPER_OUTPUT_CONTRACT_REJECTED'
  | 'VICT_HELPER_EXECUTION_FAILED';

/** The result shape returned to the model for a failed helper invocation. */
export interface HelperToolFailure {
  readonly victHelperFailure: HelperToolFailureCode;
}

/**
 * Wrap one neutral VICT contract binding into the Standard-Schema-With-JSON
 * interface Mastra tool schemas accept: `validate` delegates to the
 * authoritative neutral contract parse (CONT-001 — VICT contracts remain
 * the validation authority; the JSON Schema describes the boundary to the
 * model only), `jsonSchema` returns the author-declared document.
 */
function standardSchemaFromNeutral(io: AgentHelperToolIO): unknown {
  return {
    '~standard': {
      version: 1,
      vendor: 'vict.contract',
      validate: (value: unknown) => {
        const result = io.parse(value);
        if (result.ok) {
          return { value: result.value } as const;
        }
        return {
          issues: result.issues.map((issue) => ({ message: issue.message, path: issue.path })),
        } as const;
      },
      jsonSchema: {
        input: () => io.jsonSchema,
        output: () => io.jsonSchema,
      },
    },
  };
}

/**
 * Bridge one frozen helper-tool artifact into a REAL pinned-Mastra tool
 * via `createTool`. The passed artifact MUST come from an activation
 * snapshot (frozen); the raw caller definition is never accepted here.
 *
 * The pinned `createTool` generic instantiation is intentionally loosened
 * at this one boundary: the neutral contract is the validation authority,
 * while the Standard-Schema wrapper only DESCRIBES the boundary to the
 * model — schema validity comes from the VICT contract, never from the
 * schema library (amendment §7 rule 3).
 */
export function bridgeHelperToolToMastra(
  artifact: AgentArtifactBinding<AgentHelperToolArtifact>,
): unknown {
  const definition = artifact.artifact.definition;
  const inputIo = definition.input;
  const outputIo = definition.output;
  const createToolLoose = createTool as unknown as (options: unknown) => unknown;

  return createToolLoose({
    id: artifact.artifact.id,
    description: definition.description,
    inputSchema: standardSchemaFromNeutral(inputIo),
    outputSchema: standardSchemaFromNeutral(outputIo),
    execute: async (inputData: unknown): Promise<unknown> => {
      // 1. Authoritative VICT contract validation BEFORE invocation —
      // contract-invalid input never invokes the implementation.
      const parsedInput = inputIo.parse(inputData);
      if (!parsedInput.ok) {
        return {
          victHelperFailure: 'VICT_HELPER_INPUT_CONTRACT_REJECTED',
        } satisfies HelperToolFailure;
      }
      let rawOutput: unknown;
      try {
        rawOutput = await definition.execute(parsedInput.value);
      } catch {
        // 2. Thrown canaries (secrets in messages, nested causes) never
        // leak: the throw is reduced to a stable code. Nothing from the
        // error object is read or serialized.
        return { victHelperFailure: 'VICT_HELPER_EXECUTION_FAILED' } satisfies HelperToolFailure;
      }
      // 3. Contract-invalid output fails safely: the raw result never
      // reaches the model.
      const parsedOutput = outputIo.parse(rawOutput);
      if (!parsedOutput.ok) {
        return {
          victHelperFailure: 'VICT_HELPER_OUTPUT_CONTRACT_REJECTED',
        } satisfies HelperToolFailure;
      }
      return parsedOutput.value;
    },
  });
}

/** Map a helper-tool id to a deterministic, model-safe tool name. */
export function sanitizeToolName(id: string): string {
  const sanitized = id.replace(/[^A-Za-z0-9_-]/g, '_');
  return sanitized.length > 0 && sanitized.length <= 64 ? sanitized : 'helper_tool';
}

/** The recorded bridge metadata for snapshot/inspection (data only). */
export function describeHelperToolBinding(
  artifact: AgentArtifactBinding<AgentHelperToolArtifact>,
): {
  readonly id: string;
  readonly revision: string;
  readonly effect: 'pure';
  readonly toolName: string;
  readonly inputContract: { readonly id: string; readonly revision: string };
  readonly outputContract: { readonly id: string; readonly revision: string };
} {
  return {
    id: artifact.artifact.id,
    revision: artifact.artifact.revision,
    effect: artifact.artifact.definition.effect,
    toolName: sanitizeToolName(artifact.artifact.id),
    inputContract: {
      id: artifact.artifact.definition.input.id,
      revision: artifact.artifact.definition.input.revision,
    },
    outputContract: {
      id: artifact.artifact.definition.output.id,
      revision: artifact.artifact.definition.output.revision,
    },
  };
}
