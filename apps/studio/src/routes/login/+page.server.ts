import { fail, redirect } from '@sveltejs/kit';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSession,
} from '../../lib/server/session.js';
import type { Actions } from './$types';

/**
 * The Studio login (D-2). Human credentials are locally provisioned by the
 * deployment administrator — there is deliberately NO identity-provisioning
 * UI (D-7). Failure is NON-ECHOING: unknown label and wrong secret return
 * the identical result; nothing about the credential store is disclosed.
 */
export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData().catch(() => null);
    const label = form?.get('label');
    const secret = form?.get('secret');
    if (typeof label !== 'string' || typeof secret !== 'string') {
      return fail(400, { failed: true });
    }
    const session = createSession(label, secret);
    if (session === null) {
      return fail(401, { failed: true });
    }
    cookies.set(SESSION_COOKIE_NAME, session.sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    redirect(303, '/');
  },
};
