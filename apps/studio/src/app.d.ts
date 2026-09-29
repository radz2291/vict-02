// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    /**
     * The server-side Studio session (D-2/D-7). Established by the login
     * route from a locally provisioned human credential; carried as an
     * HttpOnly, SameSite cookie. `null` when unauthenticated. The target
     * credential NEVER appears here or anywhere client-visible.
     */
    interface Locals {
      session: {
        readonly sessionId: string;
        readonly csrfToken: string;
        readonly actorLabel: string;
      } | null;
    }
  }
}

export {};
