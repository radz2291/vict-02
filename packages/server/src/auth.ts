import {
  authenticatedActorContext,
  assertControlId,
  type ActorDirectory,
  type ActorRecord,
  type AuthenticatedActorContext,
} from '@vict/runtime';

/**
 * Stage 06B — the authenticated actor boundary (SEC-001, MSTR-007).
 *
 * Authentication and authorization remain DISTINCT: the authenticator only
 * establishes WHO the caller is; scope checks happen below the transport in
 * `@vict/control` and every command handler. Client-supplied actor ids,
 * roles, scopes, and the Mastra memory identity are NEVER authoritative —
 * the authoritative context is derived ONLY from the server-side actor
 * directory.
 *
 * A deterministic local test authenticator is provided; no production
 * identity-provider integration is claimed.
 */

/** Stable, non-echoing authentication failure codes. */
export type AuthErrorCode =
  'VICT_AUTH_TOKEN_MISSING' | 'VICT_AUTH_TOKEN_UNKNOWN' | 'VICT_AUTH_MALFORMED';

/** Structured authentication failure (never echoes the presented token). */
export class AuthenticationError extends Error {
  readonly code: AuthErrorCode;
  constructor(code: AuthErrorCode) {
    super(`Authentication failed (${code}).`);
    this.name = 'AuthenticationError';
    this.code = code;
  }
}

/**
 * The server-side actor context: the ONLY authoritative identity surface.
 * The Mastra memory identity is derived exclusively from the authenticated
 * VICT actor (`vict-actor-<actorId>`; MSTR-007).
 */
export interface ServerActorContext extends AuthenticatedActorContext {
  /** Bounded presentation token of the authenticated session (not a secret). */
  readonly presentedTokenKind: 'local-test';
}

/**
 * The neutral server-side authentication port. Implementations resolve a
 * transport credential to ONE actor id; the directory supplies the record
 * and the context derivation fails closed on unknown, disabled, malformed,
 * or mismatched actors.
 */
export interface Authenticator {
  /** Authenticate the transport credential; returns the actor id. */
  authenticate(token: string | undefined): Promise<string>;
}

/**
 * Deterministic local test authenticator: fixed token → actorId mapping
 * supplied by operator test configuration. NOT a production identity
 * provider; the composition boundary is identical to a real one.
 */
export function createLocalTestAuthenticator(
  mapping: Readonly<Record<string, string>>,
): Authenticator {
  // Tokens must be bounded plain strings; hostile inputs fail closed as
  // unknown tokens (never echoed).
  return {
    async authenticate(token) {
      if (typeof token !== 'string' || token.length === 0 || token.length > 256) {
        throw new AuthenticationError('VICT_AUTH_TOKEN_MISSING');
      }
      const actorId = mapping[token];
      if (actorId === undefined || typeof actorId !== 'string') {
        throw new AuthenticationError('VICT_AUTH_TOKEN_UNKNOWN');
      }
      return actorId;
    },
  };
}

/** Compose the authenticator with the authoritative actor directory. */
export function createServerAuthenticator(options: {
  readonly authenticator: Authenticator;
  readonly directory: ActorDirectory;
}) {
  return {
    async resolve(token: string | undefined): Promise<ServerActorContext> {
      const actorId = await options.authenticator.authenticate(token);
      assertControlId(actorId, 'actorId');
      const actor: ActorRecord | undefined = await options.directory.get(actorId);
      const context = authenticatedActorContext(actor, actorId);
      return { ...context, presentedTokenKind: 'local-test' as const };
    },
  };
}
